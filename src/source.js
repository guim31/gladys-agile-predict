// -----------------------------------------------------------------------------
// The AgilePredict forecast of the Octopus Agile prices, one per region.
//
// AgilePredict (agilepredict.com) forecasts the GB day-ahead wholesale price
// with a machine-learning ensemble, then turns it into the Octopus Agile
// import unit rate of each region with Octopus's published formulas. Its open
// REST API, without account or key, answers `GET /api/{region}?days=N` with:
//
//   [{ "name": "Region | A 2026-11-19 16:15",
//      "created_at": "2026-11-19T16:16:18.563039Z",
//      "prices": [{ "date_time": "2026-11-19T15:30:00Z",
//                   "agile_pred": 43.69, "agile_low": 43.48, "agile_high": 43.9 }, ...] }]
//
// Half-hour slots in p/kWh (VAT included, as Octopus bills them), starting
// with the half-hour the forecast was made in: the past slots are left to the
// snapshot to skip. `/api/A` answers a 301 to `/api/A/`, which fetch follows.
// An unknown region answers 200 with an empty `prices` list.
//
// Fair use (agilepredict.com/v2/limitations): about 60 requests a minute per
// IP, "once every few hours is plenty"; the integration reads each region it
// needs once an hour (src/forecast.js).
// -----------------------------------------------------------------------------

const MINUTE = 60 * 1000;
export const SLOT_MS = 30 * MINUTE;
const TIMEOUT_MS = 20 * 1000;
/** Slots further than this from now are not a forecast (a bad timestamp). */
const MAX_AHEAD_MS = 31 * 24 * 60 * MINUTE;
/** Days asked: the 7 days ahead, plus the hours already past in the forecast. */
export const DAYS = 8;

/**
 * The Octopus Agile regions AgilePredict serves (the letters of the
 * electricity distribution areas), and its national average "X".
 */
export const REGIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'X'];

export const TIME_ZONE = 'Europe/London';

/** A failure, with a short reason for the logs (never the URL). */
export class SourceError extends Error {}

const USER_AGENT = 'gladys-agile-predict (+https://github.com/guim31/gladys-agile-predict)';

/** @param {string} region */
export function forecastUrl(region) {
  return `https://agilepredict.com/api/${region}?days=${DAYS}`;
}

/**
 * Turn the body into sorted half-hour slots in p/kWh. Entries that are not a
 * slot start and a finite price are skipped; a body without a single valid
 * entry is an error (an unknown region, a forecast that failed).
 * @param {unknown} body
 * @param {number} now ms
 * @returns {{ slots: Array<{ start: Date, end: Date, price: number }>, createdAt: Date | null }}
 */
export function parseForecast(body, now) {
  const forecast = Array.isArray(body) ? body[0] : null;
  if (!forecast || typeof forecast !== 'object' || !Array.isArray(forecast.prices)) {
    throw new SourceError('forecast has no price list');
  }
  const byStart = new Map();
  for (const entry of forecast.prices) {
    const time = Date.parse(entry?.date_time);
    const price = entry?.agile_pred;
    if (!Number.isFinite(time) || typeof price !== 'number' || !Number.isFinite(price)) {
      continue;
    }
    if (time % SLOT_MS !== 0 || Math.abs(time - now) > MAX_AHEAD_MS) {
      continue;
    }
    byStart.set(time, price);
  }
  if (byStart.size === 0) {
    throw new SourceError('forecast is empty');
  }
  const created = new Date(forecast.created_at);
  return {
    slots: [...byStart.entries()]
      .sort(([a], [b]) => a - b)
      .map(([start, price]) => ({
        start: new Date(start),
        end: new Date(start + SLOT_MS),
        price,
      })),
    createdAt: Number.isNaN(created.getTime()) ? null : created,
  };
}

/**
 * @param {string} region one of REGIONS
 * @param {object} options
 * @param {typeof fetch} options.fetch
 * @param {number} options.now ms
 */
export async function fetchForecast(region, { fetch: fetchImpl, now }) {
  if (!REGIONS.includes(region)) {
    throw new SourceError(`unknown region ${region}`);
  }
  let response;
  try {
    response = await fetchImpl(forecastUrl(region), {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const code = err.cause?.code ?? err.name;
    throw new SourceError(`forecast unreachable (${code})`);
  }
  if (!response.ok) {
    throw new SourceError(`forecast answered HTTP ${response.status}`);
  }
  let body;
  try {
    body = await response.json();
  } catch {
    throw new SourceError('forecast is not JSON');
  }
  return parseForecast(body, now);
}
