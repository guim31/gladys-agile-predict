// -----------------------------------------------------------------------------
// The integration: registers every SDK handler on a GladysIntegration (or the
// SDK's fake Gladys in the tests) and runs the refresh cycle, so index.js stays
// a few lines and the tests drive the very same wiring.
//
// One cycle, every minute on the container's own timer (the core's onPoll is
// only a fallback, Gladys#3198), for each region in use — the configured
// ones, plus a region a widget or a scene action asked for in the last day:
//   1. read the forecast again when the refresh policy says so
//      (src/forecast.js);
//   2. configured regions: publish the states of the region's device, if the
//      user added it — only the values that changed, plus a heartbeat (the
//      SDK deduplicates);
//   3. configured regions: when a half-hour begins, fire the scene triggers
//      it matches.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './config.js';
import { buildDevice, buildStates, deviceIds } from './device.js';
import { createForecast } from './forecast.js';
import { ActionFailure, MESSAGES, TEXT } from './i18n.js';
import { createIssueLog } from './issues.js';
import { createSceneLedger } from './ledger.js';
import { SCENE_ACTION, findCheapestWindow, invalidField } from './scenes.js';
import { dayMonthTime } from './time.js';
import { eventsForSlot, TRIGGER } from './triggers.js';
import { buildForecastContent, WIDGET, widgetRegion } from './widget.js';

const logger = createLogger({ name: 'agile-predict' });

const MINUTE = 60 * 1000;
// A value that does not change (a weekly minimum) is sent again every 6
// hours: without a recent value, Gladys shows "no recent value".
export const HEARTBEAT_MS = 6 * 60 * MINUTE;
// The core's onPoll runs a cycle only when the timer missed one.
const POLL_FALLBACK_MS = 90 * 1000;
// A half-hour that began longer ago than this when the container saw it
// (started late, forecast just read) fires no trigger: a scene waiting for
// "the cheapest hours begin" must not run at 03:25.
export const LATE_EVENT_MS = 10 * MINUTE;
// A region only a widget or a scene action uses stays read this long after.
export const ON_DEMAND_MS = 24 * 60 * MINUTE;

/**
 * @param {object} gladys GladysIntegration instance
 * @param {object} [options] test seams
 * @param {typeof fetch} [options.fetch]
 * @param {() => number} [options.now]
 * @param {boolean} [options.timers] run the minute timer
 * @param {string} [options.dataDir] where the scene ledger is kept
 */
export function createApp(gladys, options = {}) {
  const now = options.now ?? (() => Date.now());
  // Every region read so far, and when a widget or scene last asked for it.
  const forecasts = new Map();
  const askedAt = new Map();
  const ledger = createSceneLedger(options.dataDir ?? '/data');
  const issues = createIssueLog(logger);
  const timers = options.timers ?? true;

  let config = normalizeConfig();
  let timer = null;
  let stopped = false;
  let running = null;
  let lastCycleAt = null;
  let lastStatus = null;
  // The regions whose first successful read was logged.
  const announced = new Set();
  // Set once the configuration and the scene ledger are loaded.
  let initialized = false;
  let initializing = Promise.resolve();

  const deviceCreated = (region) =>
    (gladys.devices ?? []).some(
      (device) => device.external_id === deviceIds(gladys, region).device,
    );

  /** @param {string} region */
  function forecastOf(region) {
    let found = forecasts.get(region);
    if (!found) {
      found = createForecast({ region, fetch: options.fetch, now });
      forecasts.set(region, found);
    }
    return found;
  }

  /** The configured regions' forecasts. */
  const configured = () => config.regions.map(forecastOf);

  /** The forecasts to keep reading: configured, or asked for lately. */
  function inUse() {
    for (const [region, at] of askedAt) {
      if (now() - at >= ON_DEMAND_MS) {
        askedAt.delete(region);
      }
    }
    const regions = new Set([...config.regions, ...askedAt.keys()]);
    return [...regions].map(forecastOf);
  }

  async function setStatus(connected, message) {
    const key = JSON.stringify([connected, message ?? null]);
    if (key === lastStatus) {
      return;
    }
    try {
      await gladys.setConnectionStatus(connected, message);
      lastStatus = key;
    } catch (err) {
      // Sent again on the next cycle.
      logger.debug(`Connection status not sent (${err.message})`);
    }
  }

  /** Nudge the open dashboards; dropped silently while disconnected. */
  function refreshWidget() {
    try {
      gladys.requestWidgetRefresh(WIDGET.FORECAST);
    } catch (err) {
      logger.debug(`Widget refresh not sent (${err.message})`);
    }
  }

  /**
   * @param {ReturnType<typeof createForecast>} forecast
   * @param {string} reason
   * @param {{ rethrow?: boolean }} [options]
   */
  async function refresh(forecast, reason, { rethrow = false } = {}) {
    const zone = forecast.region;
    logger.debug(`Reading the ${zone} forecast (${reason})`);
    try {
      const { changed } = await forecast.refresh();
      const snapshot = forecast.snapshot(config);
      const summary = `${snapshot.slotsAhead} half-hours ahead`;
      if (!announced.has(zone)) {
        logger.info(`Forecast ${zone} reachable: ${summary}`);
        announced.add(zone);
      } else {
        logger.debug(`Forecast ${zone} read: ${summary}${changed ? ', new forecast' : ''}`);
      }
      issues.ok(`api:${zone}`, `Forecast ${zone} answers again: ${summary}`);
      if (changed) {
        refreshWidget();
      }
    } catch (err) {
      issues.fail(`api:${zone}`, `Forecast ${zone} read failed (${err.message})`);
      if (rethrow) {
        throw err;
      }
    }
  }

  /** The status of the integration: the worst of the configured regions. */
  async function updateStatus() {
    if (config.regions.length === 0) {
      await setStatus(false, TEXT.noRegion);
      return;
    }
    for (const forecast of configured()) {
      if (forecast.outage()) {
        await setStatus(false, TEXT.unreachable);
        return;
      }
      const snapshot = forecast.snapshot(config);
      if (snapshot.stale) {
        issues.fail(
          `stale:${forecast.region}`,
          `Forecast ${forecast.region} covers less than a day`,
        );
        await setStatus(false, TEXT.stale);
        return;
      }
      issues.ok(
        `stale:${forecast.region}`,
        `Forecast ${forecast.region} covers the days ahead again`,
      );
    }
    await setStatus(true);
  }

  async function publishStates(forecast) {
    if (!deviceCreated(forecast.region)) {
      return;
    }
    try {
      const { count } = await gladys.publishChangedStates(
        buildStates(gladys, forecast.snapshot(config), config),
        { heartbeat: HEARTBEAT_MS },
      );
      if (count > 0) {
        logger.debug(`${count} state(s) published`);
      }
      issues.ok('states', 'States accepted by Gladys again');
    } catch (err) {
      issues.fail('states', `Publishing the states failed (${err.message})`);
    }
  }

  async function fireSceneEvents(forecast) {
    const zone = forecast.region;
    const snapshot = forecast.snapshot(config);
    const slot = snapshot.current;
    if (!slot || ledger.done(zone, slot.start)) {
      return;
    }
    if (now() - slot.start.getTime() > LATE_EVENT_MS) {
      logger.debug(`Slot ${slot.start.toISOString()} began too long ago: no scene event`);
      await ledger.markDone(zone, slot.start);
      return;
    }
    for (const event of eventsForSlot(zone, snapshot.slots, slot, snapshot.timeZone)) {
      const id = `${zone}:${event.id}`;
      const windowEvent = event.key === TRIGGER.CHEAPEST_WINDOW;
      if (ledger.sent(slot.start, id) || (windowEvent && ledger.silent(id, now()))) {
        continue;
      }
      try {
        await gladys.publishSceneEvent(event.key, event.data);
        ledger.markSent(slot.start, id);
        if (windowEvent) {
          // With falling prices, the cheapest window starts "now" again
          // half an hour later: one start per horizon.
          await ledger.silence(id, event.until);
        }
        logger.debug(`Scene event ${id} (${event.data.start_time})`);
        issues.ok('scene', 'Scene events accepted by Gladys again');
      } catch (err) {
        // Tried again on the next cycle, within LATE_EVENT_MS.
        issues.fail('scene', `Firing the scene event ${event.key} failed (${err.message})`);
        return;
      }
    }
    await ledger.markDone(zone, slot.start);
  }

  /**
   * @param {object} [cycleOptions]
   * @param {boolean} [cycleOptions.forceRefresh] read the source now
   * @param {boolean} [cycleOptions.events] fire the scene events; never from
   *   an action (a scene bound to the event would loop, SDK README)
   */
  async function runCycle({ forceRefresh = false, events = true } = {}) {
    lastCycleAt = now();
    for (const forecast of inUse()) {
      const reason = forceRefresh ? 'asked by the user' : forecast.dueReason();
      if (reason) {
        await refresh(forecast, reason, { rethrow: forceRefresh });
      }
    }
    if (gladys.connected === false) {
      logger.debug('Gladys unreachable: nothing published');
      return;
    }
    await updateStatus();
    for (const forecast of configured()) {
      if (forecast.lastSuccessAt === null) {
        continue;
      }
      await publishStates(forecast);
      if (events) {
        await fireSceneEvents(forecast);
      }
    }
  }

  /**
   * One cycle; a second caller waits for the one in progress. A forced
   * refresh (the user's action) waits for it, then runs its own.
   */
  async function cycle(cycleOptions = {}) {
    while (running && cycleOptions.forceRefresh) {
      await running.catch(() => {});
    }
    if (running) {
      return running;
    }
    running = runCycle(cycleOptions);
    try {
      return await running;
    } finally {
      running = null;
    }
  }

  // The timer ticks 2 s after every minute, so a half-hour that begins is
  // seen within seconds.
  function schedule() {
    clearTimeout(timer);
    timer = null;
    if (!timers || stopped) {
      return;
    }
    const delay = MINUTE - (now() % MINUTE) + 2000;
    timer = setTimeout(async () => {
      timer = null;
      try {
        await cycle();
      } catch (err) {
        logger.error(`Refresh cycle failed (${err.message})`);
      } finally {
        schedule();
      }
    }, delay);
  }

  async function publishDevices() {
    await gladys.publishDiscoveredDevices(
      config.regions.map((region) => buildDevice(gladys, region, config)),
    );
  }

  // --- Handlers ---------------------------------------------------------------

  gladys.onScanRequest(async () => {
    logger.debug('onScanRequest -> publishing the devices');
    await publishDevices();
  });

  // The fallback: the core polls the device (when it does, Gladys#3198).
  gladys.onPoll(async () => {
    // Not before the configuration and the scene ledger are loaded: a cycle
    // with an empty ledger would fire events again.
    if (!initialized) {
      logger.debug('onPoll skipped: not initialized yet');
      return;
    }
    if (lastCycleAt !== null && now() - lastCycleAt < POLL_FALLBACK_MS) {
      logger.debug('onPoll skipped: the timer is running');
      return;
    }
    await cycle();
  });

  // The device was just added: the SDK forgot what it had published (Gladys
  // drops the states of a feature that did not exist yet), send it all now.
  const onDeviceChange = async () => {
    gladys.forgetPublishedStates();
    for (const forecast of configured()) {
      if (forecast.lastSuccessAt !== null) {
        await publishStates(forecast);
      }
    }
    refreshWidget();
  };
  gladys.onDeviceCreated(onDeviceChange);
  gladys.onDeviceUpdated(onDeviceChange);
  gladys.onDeviceDeleted(() => refreshWidget());

  gladys.onAction('refresh', async () => {
    logger.info('Action refresh <- reading the forecast now');
    if (config.regions.length === 0) {
      throw new ActionFailure(TEXT.noRegion);
    }
    try {
      await cycle({ forceRefresh: true, events: false });
    } catch (err) {
      throw new ActionFailure(MESSAGES.refreshFailed(err.message));
    }
    const snapshots = configured().map((forecast) => forecast.snapshot(config));
    const ends = snapshots.map((snapshot) => snapshot.lastEnd);
    if (ends.some((end) => end === null || end.getTime() <= now())) {
      throw new ActionFailure(MESSAGES.refreshFailed('no half-hour ahead'));
    }
    const until = new Date(Math.min(...ends.map((end) => end.getTime())));
    return MESSAGES.refreshed({
      regions: snapshots.length,
      until: dayMonthTime(until, snapshots[0].timeZone, config.language),
    });
  });

  /**
   * The snapshot of a region a widget or a scene action asks for, read now
   * when nothing is known yet (one try); null when the source never answered.
   * @param {string} region
   */
  async function snapshotFor(region) {
    if (!config.regions.includes(region)) {
      askedAt.set(region, now());
    }
    const forecast = forecastOf(region);
    if (forecast.lastSuccessAt === null && forecast.dueReason() !== null) {
      await refresh(forecast, 'asked by a widget or a scene');
    }
    return forecast.lastSuccessAt === null ? null : forecast.snapshot(config);
  }

  gladys.onSceneAction(SCENE_ACTION.CHEAPEST_WINDOW, async (fields) => {
    await initializing;
    const invalid = invalidField(fields);
    if (invalid) {
      throw new ActionFailure(MESSAGES.invalidField(invalid));
    }
    const snapshot = await snapshotFor(String(fields.region));
    if (snapshot === null) {
      logger.info(`Scene action ${SCENE_ACTION.CHEAPEST_WINDOW} -> no forecast known`);
      throw new ActionFailure(MESSAGES.noForecastForScene);
    }
    const result = findCheapestWindow(snapshot, fields);
    logger.info(
      `Scene action ${SCENE_ACTION.CHEAPEST_WINDOW} (${fields.region}, ${fields.hours} h within ${fields.within} h) -> ` +
        (result.found ? `${result.start_date} ${result.start_time}` : 'no window'),
    );
    return result;
  });

  gladys.onWidgetGet(WIDGET.FORECAST, async ({ language, settings }) => {
    await initializing;
    const region = widgetRegion(settings, config.regions);
    if (region === null) {
      return buildForecastContent({ snapshot: null, language, settings });
    }
    const snapshot = (await snapshotFor(region)) ?? forecastOf(region).snapshot(config);
    return buildForecastContent({ snapshot, language, settings });
  });

  gladys.onConfigUpdated(async (newConfig) => {
    logger.info('Configuration updated');
    config = normalizeConfig(newConfig);
    // Other regions, window or language: every value may change, send them
    // all again.
    gladys.forgetPublishedStates();
    await publishDevices();
    await cycle();
    refreshWidget();
  });

  gladys.on('connected', async () => {
    let done;
    if (!initialized) {
      initializing = new Promise((resolve) => {
        done = resolve;
      });
    }
    try {
      // Whatever was shown before the connection dropped, say it again.
      lastStatus = null;
      await ledger.load();
      config = normalizeConfig(await gladys.getConfig());
      initialized = true;
      done?.();
      await publishDevices();
      stopped = false;
      schedule();
      await cycle();
      // The nudges sent while the socket was down were dropped.
      refreshWidget();
    } catch (err) {
      logger.error(`Post-connection initialization failed (${err.message})`);
      await gladys.setConnectionStatus(false, TEXT.initFailed).catch(() => {});
    } finally {
      done?.();
    }
  });

  return {
    forecasts,
    cycle,
    get config() {
      return config;
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      timer = null;
    },
  };
}
