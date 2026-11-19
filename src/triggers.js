// -----------------------------------------------------------------------------
// Scene triggers (manifest `scene_triggers`, Gladys 5.1+).
//
// What the device states cannot say: "it starts NOW".
//
//   cheapest_window_started  the cheapest run of N consecutive hours (whole
//                            half-hour slots) of the next H hours begins
//                            now: nothing cheaper is
//                            forecast before the horizon. Once it fired, the
//                            same choice stays silent until the horizon it
//                            looked at is over (src/app.js): with falling
//                            prices the cheapest window "starts now" hour
//                            after hour, and a dishwasher must start once a
//                            day, not every hour;
//   price_below_started      the forecast price goes under a threshold (in
//                            p/kWh): the first half-hour of a run under it
//                            begins, with the end of that run.
//
// Every event carries its region (one of the configured ones). The core
// filters scene events on equality and membership only, so the scene author
// picks the region, N, H and the threshold in selects, and the integration
// fires one event per region and choice that matches the half-hour. At most
// 30 events per region and half-hour, far from the 300 per minute of the core.
// -----------------------------------------------------------------------------

import { cheapestWindow, roundPence, slotAfter, slotsBetween } from './prices.js';
import { SLOT_MS } from './source.js';
import { clockTime } from './time.js';

const HOUR = 60 * 60 * 1000;

export const TRIGGER = {
  CHEAPEST_WINDOW: 'cheapest_window_started',
  PRICE_BELOW: 'price_below_started',
};

/** The values the scene author can pick, as declared in the manifest options. */
export const TRIGGER_HOURS = ['0.5', '1', '2', '3', '4', '6', '8'];
export const TRIGGER_HORIZONS = ['12', '24', '48'];
/** p/kWh: Agile goes negative on windy nights, and above 40 p at peak. */
export const THRESHOLDS = ['0', '5', '10', '15', '20', '25', '30', '35', '40'];

/**
 * The scene events to fire when `slot` begins.
 * @param {string} region added to every event
 * @param {Array} slots every known slot, sorted
 * @param {{ start: Date, end: Date, price: number }} slot
 * @param {string} timeZone clock of the times sent
 * @returns {Array<{ key: string, id: string, until: number, data: object }>}
 *   `id` names the choice, `until` the end of what it announced
 */
export function eventsForSlot(region, slots, slot, timeZone) {
  if (!slots.includes(slot)) {
    return [];
  }
  const time = (date) => clockTime(date, timeZone);
  const start = slot.start.getTime();
  const lastEnd = slots.at(-1).end.getTime();
  const events = [];

  for (const horizon of TRIGGER_HORIZONS) {
    const to = start + Number(horizon) * HOUR;
    // A forecast shorter than the horizon cannot say nothing cheaper comes.
    if (lastEnd < to) {
      continue;
    }
    const candidates = slotsBetween(slots, start, to);
    for (const hours of TRIGGER_HOURS) {
      const window = cheapestWindow(candidates, (Number(hours) * HOUR) / SLOT_MS);
      if (window && window.start.getTime() === start) {
        events.push({
          key: TRIGGER.CHEAPEST_WINDOW,
          id: `${TRIGGER.CHEAPEST_WINDOW}:${hours}:${horizon}`,
          until: to,
          data: {
            region,
            hours,
            horizon,
            average_price: roundPence(window.average),
            start_time: time(window.start),
            end_time: time(window.end),
          },
        });
      }
    }
  }

  // Without the half-hour before, a crossing cannot be told from a run that
  // was already under the threshold: nothing fires.
  const before = slots.find((other) => other.end.getTime() === start);
  for (const threshold of before ? THRESHOLDS : []) {
    const limit = Number(threshold);
    if (slot.price >= limit || before.price < limit) {
      continue;
    }
    // The run of slots under the threshold, as far as the forecast goes.
    let last = slot;
    let count = 1;
    for (
      let next = slotAfter(slots, last);
      next && next.price < limit;
      next = slotAfter(slots, next)
    ) {
      last = next;
      count += 1;
    }
    events.push({
      key: TRIGGER.PRICE_BELOW,
      id: `${TRIGGER.PRICE_BELOW}:${threshold}`,
      until: last.end.getTime(),
      data: {
        region,
        threshold,
        price: roundPence(slot.price),
        hours: (count * SLOT_MS) / HOUR,
        start_time: time(slot.start),
        end_time: time(last.end),
      },
    });
  }
  return events;
}
