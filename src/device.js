// -----------------------------------------------------------------------------
// One device per Octopus Agile region: the forecast prices of that region.
//
// Its external id is built on the region letter ("a"), the only identity a
// forecast has. Feature keys are forever, like the ids built on them.
//
// Every feature is a read-only sensor. Prices use `currency/decimal` in pounds
// sterling (Gladys has neither pence nor a £/kWh unit: the name carries
// "£/kWh", the value is the forecast in p/kWh divided by 100, 0.4369 for
// 43.69 p); the times are `text/text` ("Tue 03:00", UK clock), the weekday
// telling which day of the week ahead.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
  DEVICE_POLL_FREQUENCIES,
} from '@gladysassistant/integration-sdk';
import { DEVICE_NAME, NAMES, REGION_NAMES } from './i18n.js';
import { toPounds } from './prices.js';
import { dayMonthTime, weekdayTime } from './time.js';

const DEVICE_TYPE = 'agile-predict';

export const FEATURE = {
  PRICE_NOW: 'price_now',
  PRICE_AVG_24H: 'price_avg_24h',
  PRICE_MIN_24H: 'price_min_24h',
  PRICE_MAX_24H: 'price_max_24h',
  PRICE_AVG_7D: 'price_avg_7d',
  PRICE_MIN_7D: 'price_min_7d',
  PRICE_MAX_7D: 'price_max_7d',
  CHEAPEST_WINDOW_START: 'cheapest_window_start',
  CHEAPEST_WINDOW_PRICE: 'cheapest_window_price',
  FORECAST_UPDATED: 'forecast_updated',
  FORECAST_UNTIL: 'forecast_until',
};

// Display bounds only (the core never applies them), symmetric for the gauge:
// Agile prices go below zero on windy nights, and reached £1/kWh in 2022.
const PRICE_BOUNDS = { min: -1, max: 1 };
// text/text: min and max are NOT NULL in the core (422 on "Add to Gladys").
const TEXT_BOUNDS = { min: 0, max: 0 };

/**
 * @param {object} gladys
 * @param {string} region one of REGIONS ("A")
 */
export function deviceIds(gladys, region) {
  return gladys.externalIds(DEVICE_TYPE, region.toLowerCase());
}

/**
 * @param {object} gladys
 * @param {string} region
 * @param {ReturnType<import('./config.js').normalizeConfig>} config
 */
export function buildDevice(gladys, region, config) {
  const ids = deviceIds(gladys, region);
  const names = NAMES[config.language];
  const sensor = (key, category, type, bounds, extra = {}) => ({
    name: names[key],
    external_id: ids.feature(key),
    category,
    type,
    ...bounds,
    read_only: true,
    has_feedback: false,
    keep_history: true,
    ...extra,
  });
  const price = (key) =>
    sensor(
      key,
      DEVICE_FEATURE_CATEGORIES.CURRENCY,
      DEVICE_FEATURE_TYPES.CURRENCY.DECIMAL,
      PRICE_BOUNDS,
      { unit: DEVICE_FEATURE_UNITS.POUND_STERLING },
    );
  const text = (key) =>
    sensor(key, DEVICE_FEATURE_CATEGORIES.TEXT, DEVICE_FEATURE_TYPES.TEXT.TEXT, TEXT_BOUNDS, {
      keep_history: false,
    });

  return {
    name: `${DEVICE_NAME[config.language]} ${REGION_NAMES[config.language][region]}`,
    external_id: ids.device,
    model: 'AgilePredict',
    // Polled once a minute by the core when it does (Gladys#3198: often not):
    // the container's own timer does the work, onPoll is the fallback.
    should_poll: true,
    poll_frequency: DEVICE_POLL_FREQUENCIES.EVERY_MINUTES,
    features: [
      price(FEATURE.PRICE_NOW),
      price(FEATURE.PRICE_AVG_24H),
      price(FEATURE.PRICE_MIN_24H),
      price(FEATURE.PRICE_MAX_24H),
      price(FEATURE.PRICE_AVG_7D),
      price(FEATURE.PRICE_MIN_7D),
      price(FEATURE.PRICE_MAX_7D),
      text(FEATURE.CHEAPEST_WINDOW_START),
      price(FEATURE.CHEAPEST_WINDOW_PRICE),
      text(FEATURE.FORECAST_UPDATED),
      text(FEATURE.FORECAST_UNTIL),
    ],
  };
}

/**
 * The states of a device for a snapshot. A value the snapshot does not know
 * is left out: the feature keeps its last state rather than a made-up one.
 * @param {object} gladys
 * @param {ReturnType<ReturnType<import('./forecast.js').createForecast>['snapshot']>} snapshot
 * @param {ReturnType<import('./config.js').normalizeConfig>} config
 */
export function buildStates(gladys, snapshot, config) {
  const ids = deviceIds(gladys, snapshot.region);
  const { language } = config;
  const { timeZone } = snapshot;
  const states = [];
  const number = (key, value) =>
    states.push({ device_feature_external_id: ids.feature(key), state: toPounds(value) });
  const text = (key, value) =>
    states.push({ device_feature_external_id: ids.feature(key), text: value });

  if (snapshot.current) {
    number(FEATURE.PRICE_NOW, snapshot.current.price);
  }
  for (const [summary, avg, min, max] of [
    [snapshot.next24h, FEATURE.PRICE_AVG_24H, FEATURE.PRICE_MIN_24H, FEATURE.PRICE_MAX_24H],
    [snapshot.next7d, FEATURE.PRICE_AVG_7D, FEATURE.PRICE_MIN_7D, FEATURE.PRICE_MAX_7D],
  ]) {
    if (summary) {
      number(avg, summary.average);
      number(min, summary.min.price);
      number(max, summary.max.price);
    }
  }
  if (snapshot.window) {
    text(FEATURE.CHEAPEST_WINDOW_START, weekdayTime(snapshot.window.start, timeZone, language));
    number(FEATURE.CHEAPEST_WINDOW_PRICE, snapshot.window.average);
  }
  if (snapshot.updatedAt) {
    text(FEATURE.FORECAST_UPDATED, dayMonthTime(snapshot.updatedAt, timeZone, language));
  }
  if (snapshot.lastEnd) {
    text(FEATURE.FORECAST_UNTIL, dayMonthTime(snapshot.lastEnd, timeZone, language));
  }
  return states;
}
