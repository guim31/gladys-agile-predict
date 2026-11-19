// -----------------------------------------------------------------------------
// The forecast the integration knows for one region, and when to read it again.
//
// AgilePredict publishes a new forecast a few times a day and asks automated
// clients to poll sparingly: one read an hour per region sees a new forecast
// soon enough for half-hour scenes. After a failure, again after 5, 10, 20,
// 40 then 60 minutes. The last forecast read stays in use while the source is
// down: it covers a week, an hour without it changes nothing to the current
// half-hour.
// -----------------------------------------------------------------------------

import { fetchForecast, SLOT_MS, TIME_ZONE } from './source.js';
import { cheapestWindow, slotAt, slotsBetween, summarize } from './prices.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
export const REFRESH_MS = 60 * MINUTE;
const FAILURE_BACKOFF_MS = [5, 10, 20, 40, 60].map((minutes) => minutes * MINUTE);
/** A forecast whose last slot is closer than this is stale (the model stopped). */
export const STALE_AHEAD_MS = 24 * HOUR;
/** Failed reads only turn the status red once the last success is this old. */
export const OUTAGE_MS = 2 * HOUR;

/**
 * @param {object} options
 * @param {string} options.region one of REGIONS
 * @param {typeof fetch} [options.fetch]
 * @param {() => number} [options.now]
 */
export function createForecast({ region, fetch = globalThis.fetch, now = () => Date.now() }) {
  let slots = [];
  let updatedAt = null;
  let lastSuccessAt = null;
  let lastAttemptAt = null;
  let failures = 0;

  return {
    region,

    get lastSuccessAt() {
      return lastSuccessAt;
    },

    /** Failing for long enough to say so (a blip stays green). */
    outage() {
      return failures > 0 && (lastSuccessAt === null || now() - lastSuccessAt >= OUTAGE_MS);
    },

    /** Why a refresh is due now (for the debug log), or null. */
    dueReason() {
      if (lastAttemptAt === null) {
        return 'first read';
      }
      const elapsed = now() - lastAttemptAt;
      if (failures > 0) {
        const wait = FAILURE_BACKOFF_MS[Math.min(failures, FAILURE_BACKOFF_MS.length) - 1];
        return elapsed >= wait ? `retry after ${failures} failure(s)` : null;
      }
      return elapsed >= REFRESH_MS ? 'periodic' : null;
    },

    /**
     * Read the source. Throws a SourceError, the forecast in memory kept.
     * @returns {Promise<{ changed: boolean }>}
     */
    async refresh() {
      lastAttemptAt = now();
      try {
        const result = await fetchForecast(region, { fetch, now: now() });
        lastSuccessAt = now();
        failures = 0;
        const changed =
          result.slots.length !== slots.length ||
          result.slots.some(
            (slot, index) =>
              slot.start.getTime() !== slots[index].start.getTime() ||
              slot.price !== slots[index].price,
          );
        slots = result.slots;
        updatedAt =
          result.createdAt ?? (changed || updatedAt === null ? new Date(now()) : updatedAt);
        return { changed };
      } catch (err) {
        failures += 1;
        throw err;
      }
    },

    /**
     * Everything the device, the widget and the scenes read, at one instant.
     * Prices in p/kWh.
     * @param {{ windowHours: number, windowHorizon: number }} config
     */
    snapshot({ windowHours, windowHorizon }) {
      const at = new Date(now());
      const slotStart = Math.floor(at.getTime() / SLOT_MS) * SLOT_MS;
      const current = slotAt(slots, at);
      const ahead = (hours) => slotsBetween(slots, slotStart, slotStart + hours * HOUR);
      const lastEnd = slots.length > 0 ? slots.at(-1).end.getTime() : null;
      // The window may start in the half-hour in progress: it is the slot a
      // scene can still catch.
      const window = cheapestWindow(ahead(windowHorizon), (windowHours * HOUR) / SLOT_MS);
      return {
        region,
        timeZone: TIME_ZONE,
        at,
        slots,
        current,
        next24h: summarize(ahead(24)),
        next7d: summarize(ahead(7 * 24)),
        upcoming: ahead(7 * 24),
        // Every half-hour from the current one to the end of the forecast.
        slotsAhead: slots.filter((slot) => slot.end.getTime() > slotStart).length,
        window,
        windowHours,
        windowHorizon,
        updatedAt,
        lastEnd: lastEnd === null ? null : new Date(lastEnd),
        stale: lastEnd === null || lastEnd - at.getTime() < STALE_AHEAD_MS,
      };
    },
  };
}
