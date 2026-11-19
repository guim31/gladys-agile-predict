// -----------------------------------------------------------------------------
// The integration end to end, on the real AgilePredict forecasts of
// 19 November 2026 (regions A and P), against the SDK's fake Gladys. Expected
// values computed by hand (Python, from the fixtures) — not from the code
// under test.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createApp } from '../src/app.js';
import { normalizeConfig } from '../src/config.js';
import { buildDevice, FEATURE } from '../src/device.js';
import { createFakeSource, createWorld, last } from './helpers/world.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`);

test('the device shows the forecast of region A at 17:10 in London', async () => {
  const { gladys } = await createWorld();
  // £/kWh: the p/kWh of the forecast divided by 100.
  near(last(gladys, FEATURE.PRICE_NOW), 0.5625);
  near(last(gladys, FEATURE.PRICE_AVG_24H), 0.3879);
  near(last(gladys, FEATURE.PRICE_MIN_24H), 0.2964);
  near(last(gladys, FEATURE.PRICE_MAX_24H), 0.6404);
  near(last(gladys, FEATURE.PRICE_AVG_7D), 0.3899);
  near(last(gladys, FEATURE.PRICE_MIN_7D), 0.2151);
  near(last(gladys, FEATURE.PRICE_MAX_7D), 0.6427);
  // The cheapest 3 hours of the next 24: Friday 02:00-05:00, 29.977 p.
  assert.equal(last(gladys, FEATURE.CHEAPEST_WINDOW_START), 'ven. 02:00');
  near(last(gladys, FEATURE.CHEAPEST_WINDOW_PRICE), 0.2998);
  // created_at 16:16 UTC; the last half-hour ends 27 Nov 16:00 UTC.
  assert.equal(last(gladys, FEATURE.FORECAST_UPDATED), '19/11 16:16');
  assert.equal(last(gladys, FEATURE.FORECAST_UNTIL), '27/11 16:00');
  assert.deepEqual(gladys.fake.connectionStatus, { connected: true });
});

test('one device per region, the window and the names follow the configuration', async () => {
  const { gladys } = await createWorld({
    config: { language: 'en', regions: ['P', 'A'], window_hours: '1', window_horizon: '168' },
  });
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((device) => device.name),
    ['Agile forecast Eastern England', 'Agile forecast Northern Scotland'],
  );
  // The cheapest hour of the week: Sunday 22 Nov, 05:30, 22.25 p in A.
  assert.equal(last(gladys, FEATURE.CHEAPEST_WINDOW_START), 'Sun 05:30');
  near(last(gladys, FEATURE.CHEAPEST_WINDOW_PRICE), 0.2225);
  near(last(gladys, FEATURE.PRICE_NOW, 'P'), 0.6191);
  near(last(gladys, FEATURE.PRICE_MIN_7D, 'P'), 0.2506);
});

test('each configured region is read once an hour, the others never', async () => {
  const world = await createWorld({ config: { regions: ['A', 'P'] } });
  for (let i = 0; i < 120; i += 1) {
    world.clock.advance(MINUTE);
    await world.app.cycle();
  }
  assert.equal(world.source.reads('A').length, 3);
  assert.equal(world.source.reads('P').length, 3);
  assert.equal(world.source.requests.length, 6);
  assert.equal(world.source.requests[0].url.search, '?days=8');
  assert.match(world.source.requests[0].headers['User-Agent'], /gladys-agile-predict/);
});

test('a new forecast is published at the next read', async () => {
  const world = await createWorld();
  const [forecast] = world.source.bodies.A;
  world.source.bodies.A = [
    {
      ...forecast,
      created_at: '2026-11-19T17:45:00Z',
      prices: forecast.prices.map((p) => ({ ...p, agile_pred: p.agile_pred + 10 })),
    },
  ];
  world.clock.advance(61 * MINUTE);
  await world.app.cycle();
  // 18:11: the 18:00 half-hour, 55.78 p + 10 p.
  near(last(world.gladys, FEATURE.PRICE_NOW), 0.6578);
  assert.equal(last(world.gladys, FEATURE.FORECAST_UPDATED), '19/11 17:45');
});

test('an outage keeps the forecast and says so after 2 hours; the return clears it', async () => {
  const world = await createWorld();
  world.source.down = true;
  world.clock.advance(HOUR);
  await world.app.cycle();
  // A blip: the forecast covers days, the status stays green.
  assert.deepEqual(world.gladys.fake.connectionStatus, { connected: true });
  world.clock.advance(HOUR);
  await world.app.cycle();
  assert.equal(world.gladys.fake.connectionStatus.connected, false);
  assert.match(world.gladys.fake.connectionStatus.message.fr, /AgilePredict injoignable/);
  // The forecast in memory still moves with the clock: 19:10, 42.41 p.
  near(last(world.gladys, FEATURE.PRICE_NOW), 0.4241);
  world.source.down = false;
  // The backoff: the next try within the hour.
  world.clock.advance(HOUR);
  await world.app.cycle();
  assert.deepEqual(world.gladys.fake.connectionStatus, { connected: true });
});

test('a forecast that stopped moving is stale', async () => {
  const world = await createWorld({ at: '2026-11-26T17:00:00Z' });
  assert.equal(world.gladys.fake.connectionStatus.connected, false);
  assert.match(world.gladys.fake.connectionStatus.message.en, /no longer updated/);
});

test('an empty answer at startup: no state, a red status, nothing made up', async () => {
  const world = await createWorld({
    prepare: (source) => (source.bodies.A = [{ name: 'Region | A', prices: [] }]),
  });
  assert.equal(world.gladys.fake.states.length, 0);
  assert.equal(world.gladys.fake.connectionStatus.connected, false);
});

test('without a region: no device, no request, the status asks for one', async () => {
  const world = await createWorld({ config: {} });
  assert.deepEqual(world.gladys.fake.discoveredDevices, []);
  assert.equal(world.source.requests.length, 0);
  assert.equal(world.gladys.fake.connectionStatus.connected, false);
  assert.match(world.gladys.fake.connectionStatus.message.fr, /Choisissez votre région/);
  const action = await world.gladys.fake.action('refresh');
  assert.equal(action.success, false);
  await world.gladys.fake.configUpdated({ regions: ['A'] });
  assert.equal(world.gladys.fake.discoveredDevices.length, 1);
  assert.deepEqual(world.gladys.fake.connectionStatus, { connected: true });
});

test('the price goes under 35 p at 20:30 in region A, for 10 hours', async () => {
  const { gladys } = await createWorld({ at: '2026-11-19T20:30:30Z' });
  const below = gladys.fake.sceneEvents.filter((e) => e.key === 'price_below_started');
  // Under 40 p since 20:00: only the 35 p threshold is crossed now.
  assert.deepEqual(
    below.map((e) => e.data.threshold),
    ['35'],
  );
  assert.deepEqual(below[0].data, {
    region: 'A',
    threshold: '35',
    price: 34.24,
    hours: 10,
    start_time: '20:30',
    end_time: '06:30',
  });
});

test('the cheapest window fires once per horizon, not every half-hour', async () => {
  const world = await createWorld({ at: '2026-11-19T23:00:30Z' });
  const starts = [];
  for (let slot = 0; slot < 2 * 72; slot += 1) {
    world.clock.advance(30 * MINUTE);
    const before = world.gladys.fake.sceneEvents.length;
    await world.app.cycle();
    for (const event of world.gladys.fake.sceneEvents.slice(before)) {
      if (
        event.key === 'cheapest_window_started' &&
        event.data.hours === '3' &&
        event.data.horizon === '24'
      ) {
        starts.push({ at: world.clock.now(), data: event.data });
      }
    }
  }
  // 20 Nov 02:00: the cheapest 3 h of the next 24, by hand. With falling
  // prices it would start "now" again at 02:30, 03:00...: silent until the
  // 24 hours are over; then 22 Nov 05:30.
  assert.equal(starts[0].data.region, 'A');
  assert.equal(starts[0].data.start_time, '02:00');
  assert.equal(starts[0].data.end_time, '05:00');
  near(starts[0].data.average_price, 29.98);
  assert.deepEqual(
    starts.map((s) => new Date(s.at).toISOString().slice(0, 16)),
    ['2026-11-20T02:00', '2026-11-22T05:30'],
  );
});

test('a half-hour seen late fires nothing, a restart does not fire twice', async () => {
  const late = await createWorld({ at: '2026-11-19T20:41:00Z' });
  assert.equal(late.gladys.fake.sceneEvents.length, 0);

  const first = await createWorld({ at: '2026-11-19T20:30:30Z' });
  const fired = first.gladys.fake.sceneEvents.length;
  assert.ok(fired > 0);
  const again = await createWorld({ at: '2026-11-19T20:32:00Z', dataDir: first.dataDir });
  assert.equal(again.gladys.fake.sceneEvents.length, 0);
});

test('the refresh action: green when read, red with the reason otherwise', async () => {
  const world = await createWorld({ config: { regions: ['A', 'P'] } });
  const ok = await world.gladys.fake.action('refresh');
  assert.equal(ok.success, true);
  assert.equal(ok.data.message.fr, "Prévision lue pour 2 région(s), jusqu'au 27/11 16:00.");
  // A region only the widget shows, failing (K answers an empty forecast),
  // does not turn the user's action red.
  await world.gladys.fake.widgetGet('forecast', { language: 'en', settings: { region: 'K' } });
  const still = await world.gladys.fake.action('refresh');
  assert.equal(still.success, true);
  world.source.down = true;
  const failed = await world.gladys.fake.action('refresh');
  assert.equal(failed.success, false);
  assert.match(failed.error.fr, /n'a pas pu être lue \(forecast unreachable \(ENOTFOUND\)\)/);
});

test('the scene action finds the cheapest hours, or fails in red', async () => {
  const world = await createWorld();
  const ok = await world.gladys.fake.sceneAction('find_cheapest_window', {
    region: 'A',
    hours: '3',
    within: '24',
  });
  assert.equal(ok.success, true);
  assert.deepEqual(ok.data.outputs, {
    found: true,
    starts_now: false,
    start_date: '2026-11-20',
    start_time: '02:00',
    end_time: '05:00',
    average_price: 29.98,
    minutes_to_start: 8 * 60 + 50,
  });
  // A region not configured: read on demand.
  const other = await world.gladys.fake.sceneAction('find_cheapest_window', {
    region: 'P',
    hours: '1',
    within: '168',
  });
  assert.equal(other.data.outputs.start_date, '2026-11-22');
  assert.equal(other.data.outputs.start_time, '05:30');
  assert.equal(world.source.reads('P').length, 1);
  const tooShort = await world.gladys.fake.sceneAction('find_cheapest_window', {
    region: 'A',
    hours: '8',
    within: '6',
  });
  assert.equal(tooShort.success, true);
  assert.equal(tooShort.data.outputs.found, false);
  for (const [fields, field] of [
    [{ region: 'I', hours: '3', within: '24' }, 'region'],
    [{ region: 'A', hours: '7', within: '24' }, 'hours'],
    [{ region: 'A', hours: '3' }, 'within'],
  ]) {
    const invalid = await world.gladys.fake.sceneAction('find_cheapest_window', fields);
    assert.equal(invalid.success, false);
    assert.ok(invalid.error.fr.includes(`champ « ${field} »`), invalid.error.fr);
  }

  const down = await createWorld({ prepare: (source) => (source.down = true) });
  const none = await down.gladys.fake.sceneAction('find_cheapest_window', {
    region: 'A',
    hours: '2',
    within: '24',
  });
  assert.equal(none.success, false);
  assert.match(none.error.fr, /Aucune prévision/);
});

test('the device just added receives every state again', async () => {
  const world = await createWorld({ created: false });
  assert.equal(world.gladys.fake.states.length, 0);
  const device = world.gladys.fake.discoveredDevices[0];
  world.gladys.fake.devices = [device];
  await world.gladys.fake.deviceCreated(device);
  assert.equal(world.gladys.fake.states.length, device.features.length);
});

test('the widget fits the core budget, in every language and setting', async () => {
  const world = await createWorld();
  for (const language of ['en', 'fr', 'de', 'es', 'it']) {
    for (const settings of [
      {},
      { days: '2', show_tiles: false, show_status: false },
      { days: '4', show_tiles: true, region: 'P' },
    ]) {
      const ack = await world.gladys.fake.widgetGet('forecast', { language, settings });
      assert.equal(ack.success, true);
      const content = ack.data.content;
      assert.deepEqual(
        validateWidgetContent(content),
        [],
        `${language} ${JSON.stringify(settings)}`,
      );
      const chart = content.components.find((c) => c.type === 'chart');
      const days = Number(settings.days ?? 7);
      // Half-hours up to 4 days, hours for 7 (300 points at most).
      assert.equal(chart.series[0].points.length, days === 7 ? 7 * 24 : days * 48);
      const tiles = content.components.filter((c) => c.type === 'value').length;
      assert.equal(tiles, settings.show_tiles === false ? 0 : 3);
      const status = content.components.some((c) => c.type === 'status');
      assert.equal(status, settings.show_status !== false);
    }
  }
  const p = await world.gladys.fake.widgetGet('forecast', {
    language: 'en',
    settings: { region: 'P' },
  });
  assert.match(p.data.content.components[0].text, /Northern Scotland/);
  assert.equal(p.data.content.components[1].value, 61.91);

  const none = await createWorld({ config: {} });
  const ask = await none.gladys.fake.widgetGet('forecast', { language: 'fr' });
  assert.match(ask.data.content.components[0].text, /Choisissez votre région/);
  const empty = await createWorld({ prepare: (source) => (source.down = true) });
  const ack = await empty.gladys.fake.widgetGet('forecast', { language: 'fr' });
  assert.deepEqual(validateWidgetContent(ack.data.content), []);
  assert.match(ack.data.content.components[0].text, /Pas encore de prévision/);
  const old = await createWorld({ at: '2026-11-28T12:00:00Z' });
  const outdated = await old.gladys.fake.widgetGet('forecast', { language: 'en' });
  assert.match(outdated.data.content.components[0].text, /no longer publishes/);
});

test('an action reads the source but fires no scene event', async () => {
  const world = await createWorld({ at: '2026-11-19T20:20:00Z' });
  const before = world.gladys.fake.sceneEvents.length;
  world.clock.set('2026-11-19T20:30:30Z');
  await world.gladys.fake.action('refresh');
  assert.equal(world.gladys.fake.sceneEvents.length, before);
  await world.app.cycle();
  assert.ok(world.gladys.fake.sceneEvents.length > before, 'the next cycle fires them');
});

test('the states refresh on the container timer alone, without onPoll', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: new Date('2026-11-19T17:28:00Z') });
  const source = createFakeSource();
  const config = { regions: ['A'] };
  const gladys = createFakeGladys({ config });
  gladys.fake.devices = [buildDevice(gladys, 'A', normalizeConfig(config))];
  t.mock.method(gladys, 'onPoll', () => {});
  const app = createApp(gladys, {
    fetch: source.fetch,
    dataDir: mkdtempSync(join(tmpdir(), 'gladys-agile-predict-')),
  });
  await gladys.connect();
  near(last(gladys, FEATURE.PRICE_NOW), 0.5625);
  for (let i = 0; i < 3; i += 1) {
    t.mock.timers.tick(MINUTE);
    for (let j = 0; j < 20; j += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }
  // 17:31: the 17:30 half-hour, 56.43 p.
  near(last(gladys, FEATURE.PRICE_NOW), 0.5643);
  assert.equal(gladys.onPoll.mock.callCount(), 1, 'replaced by a mock: the core could not call it');
  app.stop();
});

test("the core's onPoll runs a cycle only when the timer missed one", async () => {
  const world = await createWorld();
  const device = world.gladys.fake.discoveredDevices[0];
  world.clock.advance(MINUTE);
  await world.gladys.fake.poll(device);
  const before = world.source.reads().length;
  world.clock.advance(61 * MINUTE);
  await world.gladys.fake.poll(device);
  assert.equal(world.source.reads().length, before + 1, 'the stalled timer is replaced');
});
