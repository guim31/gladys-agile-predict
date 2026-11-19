// -----------------------------------------------------------------------------
// Dashboard widget (manifest `widgets`, Gladys 5.1+): the price forecast of
// the days ahead, for one region.
//
// Inline values, not device-bound tiles: the widget works before the device is
// added, and shows "p/kWh", the unit UK tariffs speak, where a device tile
// could only say "£". Layout, within the core budget (8 components, 2 texts):
//   caption   what the price is (AgilePredict forecast, region)
//   tiles     now, average of the next 24 h and 7 days        (show_tiles)
//   chart     the next 2, 4 or 7 days (step line: a price holds for the
//             half-hour; 7 days drawn hour by hour, the core takes 300
//             points at most), lowest and highest marked, "now" by the core
//   status    the cheapest window, when the forecast was updated, how far it
//             goes                                            (show_status)
// -----------------------------------------------------------------------------

import { WIDGET_CHART_TYPES, WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { LANGUAGES } from './config.js';
import { fill, pick, REGION_NAMES, TEXT } from './i18n.js';
import { roundPence, summarize } from './prices.js';
import { REGIONS, SLOT_MS } from './source.js';
import { dayMonthTime, weekdayTime } from './time.js';

export const WIDGET = { FORECAST: 'forecast' };
export const WIDGET_DAYS = ['2', '4', '7'];
export const WIDGET_DEFAULTS = { days: '7', show_tiles: true, show_status: true };
const UNIT = 'p/kWh';
const HOUR = 60 * 60 * 1000;
const MAX_POINTS = 300;

/**
 * @param {number} value
 * @param {string} language
 */
export function formatPrice(value, language) {
  return new Intl.NumberFormat(language, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'negative',
  }).format(value);
}

/**
 * Seconds until the next half-hour starts (the current price changes),
 * within the core bounds.
 * @param {Date} at
 */
function ttlSeconds(at) {
  const toNextSlot = SLOT_MS / 1000 - Math.floor((at.getTime() % SLOT_MS) / 1000);
  return Math.min(3600, Math.max(10, toNextSlot + 5));
}

/**
 * The chart points: one per half-hour, or the average of each hour when that
 * would exceed the core's limit.
 * @param {Array} slots
 */
function chartPoints(slots) {
  if (slots.length <= MAX_POINTS) {
    return slots.map((slot) => ({ t: slot.start.toISOString(), v: roundPence(slot.price) }));
  }
  const hours = new Map();
  for (const slot of slots) {
    const hour = Math.floor(slot.start.getTime() / HOUR) * HOUR;
    const found = hours.get(hour) ?? { sum: 0, count: 0 };
    found.sum += slot.price;
    found.count += 1;
    hours.set(hour, found);
  }
  return [...hours.entries()].map(([hour, { sum, count }]) => ({
    t: new Date(hour).toISOString(),
    v: roundPence(sum / count),
  }));
}

/**
 * The region a widget shows: its setting, else the first configured region.
 * @param {Record<string, unknown>} settings
 * @param {string[]} configured
 * @returns {string | null}
 */
export function widgetRegion(settings, configured) {
  const asked = String(settings?.region ?? '');
  return REGIONS.includes(asked) ? asked : (configured[0] ?? null);
}

/**
 * @param {object} options
 * @param {ReturnType<ReturnType<import('./forecast.js').createForecast>['snapshot']>} options.snapshot
 * @param {string} options.language the user's language, sent by the core
 * @param {Record<string, unknown>} [options.settings] the widget's settings
 */
export function buildForecastContent({ snapshot, language: raw, settings = {} }) {
  const language = LANGUAGES.includes(raw) ? raw : 'en';
  const t = (text) => pick(text, language);
  if (!snapshot) {
    return {
      ttl_seconds: 300,
      components: [{ type: 'text', variant: 'body', text: t(TEXT.noRegion) }],
    };
  }
  const days = WIDGET_DAYS.includes(String(settings.days))
    ? Number(settings.days)
    : Number(WIDGET_DEFAULTS.days);
  const showTiles = settings.show_tiles ?? WIDGET_DEFAULTS.show_tiles;
  const showStatus = settings.show_status ?? WIDGET_DEFAULTS.show_status;
  const { timeZone } = snapshot;

  const slotStart = Math.floor(snapshot.at.getTime() / SLOT_MS) * SLOT_MS;
  const shown = snapshot.upcoming.filter(
    (slot) => slot.start.getTime() < slotStart + days * 24 * HOUR,
  );
  if (shown.length === 0) {
    const text = snapshot.slots.length > 0 ? TEXT.outdated : TEXT.noForecast;
    return {
      ttl_seconds: 300,
      components: [{ type: 'text', variant: 'body', text: t(text) }],
    };
  }

  const region = REGION_NAMES[language][snapshot.region];
  const components = [
    { type: 'text', variant: 'caption', text: t(fill(TEXT.caption, { region })) },
  ];

  if (showTiles !== false) {
    const tile = (label, price, icon) => {
      if (price !== undefined) {
        components.push({
          type: 'value',
          label: t(label),
          value: roundPence(price),
          unit: UNIT,
          icon,
        });
      }
    };
    tile(TEXT.now, snapshot.current?.price, 'zap');
    tile(TEXT.average24h, snapshot.next24h?.average, 'activity');
    tile(TEXT.average7d, snapshot.next7d?.average, 'calendar');
  }

  const points = chartPoints(shown);
  // The marks sit on the points drawn (hourly averages on 7 days).
  const summary = summarize(points.map((point) => ({ start: new Date(point.t), price: point.v })));
  const label = (prefix, slot) => `${t(prefix)} ${weekdayTime(slot.start, timeZone, language)}`;
  components.push({
    type: 'chart',
    chart_type: WIDGET_CHART_TYPES.STEPLINE,
    unit: UNIT,
    series: [{ name: t(TEXT.forecast), points }],
    annotations: [
      {
        t: summary.min.start.toISOString(),
        value: roundPence(summary.min.price),
        label: label(TEXT.min, summary.min),
        color: WIDGET_COLORS.SUCCESS,
      },
      {
        t: summary.max.start.toISOString(),
        value: roundPence(summary.max.price),
        label: label(TEXT.max, summary.max),
        color: WIDGET_COLORS.DANGER,
      },
    ],
    now_marker: true,
  });

  if (showStatus !== false) {
    const items = [];
    if (snapshot.window) {
      items.push({
        label: t(
          fill(TEXT.cheapestWindow, {
            hours: new Intl.NumberFormat(language).format(snapshot.windowHours),
          }),
        ),
        value:
          `${weekdayTime(snapshot.window.start, timeZone, language)} · ` +
          `${formatPrice(snapshot.window.average, language)} ${UNIT}`,
        icon: 'trending-down',
        color: WIDGET_COLORS.SUCCESS,
      });
    }
    if (snapshot.updatedAt) {
      items.push({
        label: t(TEXT.updated),
        value: dayMonthTime(snapshot.updatedAt, timeZone, language),
        icon: 'refresh-cw',
        color: snapshot.stale ? WIDGET_COLORS.WARNING : WIDGET_COLORS.NEUTRAL,
      });
    }
    if (snapshot.lastEnd) {
      items.push({
        label: t(TEXT.until),
        value: dayMonthTime(snapshot.lastEnd, timeZone, language),
        icon: 'calendar',
        color: snapshot.stale ? WIDGET_COLORS.WARNING : WIDGET_COLORS.INFO,
      });
    }
    if (items.length > 0) {
      components.push({ type: 'status', items });
    }
  }

  return { ttl_seconds: ttlSeconds(snapshot.at), components };
}
