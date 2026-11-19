// -----------------------------------------------------------------------------
// Every text the integration shows to the user, in the four languages of the
// Gladys interface (en, fr, de, es). German says "du", Spanish says "usted",
// like the rest of guim31's integrations.
//
//   - DEVICE_NAME  : the device, followed by REGION_NAMES (its region);
//   - NAMES        : the feature names, frozen when the user adds the device,
//                    in the language of the configuration;
//   - TEXT         : the fixed texts (widget, connection status, errors);
//   - MESSAGES     : the texts built from a value.
//
// test/i18n.test.js checks that every entry carries exactly the four
// languages.
// -----------------------------------------------------------------------------

/** Device name, by language: followed by the region name. */
export const DEVICE_NAME = {
  en: 'Agile forecast',
  fr: 'Prévision Agile',
  de: 'Agile-Prognose',
  es: 'Previsión Agile',
};

/** The regions, by language then letter (the distribution areas of GB). */
export const REGION_NAMES = {
  en: {
    A: 'Eastern England',
    B: 'East Midlands',
    C: 'London',
    D: 'Merseyside and North Wales',
    E: 'West Midlands',
    F: 'North Eastern England',
    G: 'North Western England',
    H: 'Southern England',
    J: 'South Eastern England',
    K: 'South Wales',
    L: 'South Western England',
    M: 'Yorkshire',
    N: 'Southern Scotland',
    P: 'Northern Scotland',
    X: 'National average',
  },
  fr: {
    A: "Est de l'Angleterre",
    B: 'Midlands de l’Est',
    C: 'Londres',
    D: 'Merseyside et nord du pays de Galles',
    E: 'Midlands de l’Ouest',
    F: "Nord-Est de l'Angleterre",
    G: "Nord-Ouest de l'Angleterre",
    H: "Sud de l'Angleterre",
    J: "Sud-Est de l'Angleterre",
    K: 'Sud du pays de Galles',
    L: "Sud-Ouest de l'Angleterre",
    M: 'Yorkshire',
    N: "Sud de l'Écosse",
    P: "Nord de l'Écosse",
    X: 'Moyenne nationale',
  },
  de: {
    A: 'Ostengland',
    B: 'East Midlands',
    C: 'London',
    D: 'Merseyside und Nordwales',
    E: 'West Midlands',
    F: 'Nordostengland',
    G: 'Nordwestengland',
    H: 'Südengland',
    J: 'Südostengland',
    K: 'Südwales',
    L: 'Südwestengland',
    M: 'Yorkshire',
    N: 'Südschottland',
    P: 'Nordschottland',
    X: 'Landesdurchschnitt',
  },
  es: {
    A: 'Este de Inglaterra',
    B: 'Midlands del Este',
    C: 'Londres',
    D: 'Merseyside y norte de Gales',
    E: 'Midlands del Oeste',
    F: 'Noreste de Inglaterra',
    G: 'Noroeste de Inglaterra',
    H: 'Sur de Inglaterra',
    J: 'Sureste de Inglaterra',
    K: 'Sur de Gales',
    L: 'Suroeste de Inglaterra',
    M: 'Yorkshire',
    N: 'Sur de Escocia',
    P: 'Norte de Escocia',
    X: 'Media nacional',
  },
};

/** Feature names, by language then feature key (≤ 40 characters). */
export const NAMES = {
  en: {
    price_now: 'Forecast price now (£/kWh)',
    price_avg_24h: 'Average next 24 h (£/kWh)',
    price_min_24h: 'Lowest next 24 h (£/kWh)',
    price_max_24h: 'Highest next 24 h (£/kWh)',
    price_avg_7d: 'Average next 7 days (£/kWh)',
    price_min_7d: 'Lowest next 7 days (£/kWh)',
    price_max_7d: 'Highest next 7 days (£/kWh)',
    cheapest_window_start: 'Start of the cheapest window',
    cheapest_window_price: 'Cheapest window average (£/kWh)',
    forecast_updated: 'Forecast made',
    forecast_until: 'Forecast until',
  },
  fr: {
    price_now: 'Prix prévu maintenant (£/kWh)',
    price_avg_24h: 'Moyenne 24 h à venir (£/kWh)',
    price_min_24h: 'Min 24 h à venir (£/kWh)',
    price_max_24h: 'Max 24 h à venir (£/kWh)',
    price_avg_7d: 'Moyenne 7 jours à venir (£/kWh)',
    price_min_7d: 'Min 7 jours à venir (£/kWh)',
    price_max_7d: 'Max 7 jours à venir (£/kWh)',
    cheapest_window_start: 'Début de la plage la moins chère',
    cheapest_window_price: 'Moyenne plage moins chère (£/kWh)',
    forecast_updated: 'Prévision établie',
    forecast_until: "Prévision jusqu'au",
  },
  de: {
    price_now: 'Prognosepreis jetzt (£/kWh)',
    price_avg_24h: 'Mittel nächste 24 h (£/kWh)',
    price_min_24h: 'Tiefst nächste 24 h (£/kWh)',
    price_max_24h: 'Höchst nächste 24 h (£/kWh)',
    price_avg_7d: 'Mittel nächste 7 Tage (£/kWh)',
    price_min_7d: 'Tiefst nächste 7 Tage (£/kWh)',
    price_max_7d: 'Höchst nächste 7 Tage (£/kWh)',
    cheapest_window_start: 'Beginn des günstigsten Blocks',
    cheapest_window_price: 'Mittel günstigster Block (£/kWh)',
    forecast_updated: 'Prognose erstellt',
    forecast_until: 'Prognose bis',
  },
  es: {
    price_now: 'Precio previsto ahora (£/kWh)',
    price_avg_24h: 'Media próximas 24 h (£/kWh)',
    price_min_24h: 'Mínimo próximas 24 h (£/kWh)',
    price_max_24h: 'Máximo próximas 24 h (£/kWh)',
    price_avg_7d: 'Media próximos 7 días (£/kWh)',
    price_min_7d: 'Mínimo próximos 7 días (£/kWh)',
    price_max_7d: 'Máximo próximos 7 días (£/kWh)',
    cheapest_window_start: 'Inicio del tramo más barato',
    cheapest_window_price: 'Media tramo más barato (£/kWh)',
    forecast_updated: 'Previsión elaborada',
    forecast_until: 'Previsión hasta',
  },
};

/** Fixed texts. */
export const TEXT = {
  caption: {
    en: 'Octopus Agile forecast by AgilePredict, {region}',
    fr: 'Prévision Octopus Agile par AgilePredict, {region}',
    de: 'Octopus-Agile-Prognose von AgilePredict, {region}',
    es: 'Previsión Octopus Agile de AgilePredict, {region}',
  },
  noRegion: {
    en: 'Choose your Octopus Agile region in the integration settings.',
    fr: "Choisissez votre région Octopus Agile dans la configuration de l'intégration.",
    de: 'Wähle deine Octopus-Agile-Region in den Einstellungen der Integration.',
    es: 'Elija su región Octopus Agile en la configuración de la integración.',
  },
  noForecast: {
    en: 'No forecast yet: the source has not answered. It is asked again within minutes.',
    fr: "Pas encore de prévision : la source n'a pas répondu. Elle est réinterrogée dans quelques minutes.",
    de: 'Noch keine Prognose: Die Quelle hat nicht geantwortet. Neue Abfrage in wenigen Minuten.',
    es: 'Aún no hay previsión: la fuente no ha respondido. Se volverá a consultar en unos minutos.',
  },
  outdated: {
    en: 'The last forecast read is over: the source no longer publishes.',
    fr: 'La dernière prévision lue est dépassée : la source ne publie plus.',
    de: 'Die zuletzt gelesene Prognose ist abgelaufen: Die Quelle veröffentlicht nicht mehr.',
    es: 'La última previsión leída ha caducado: la fuente ya no publica.',
  },
  unreachable: {
    en: 'The price forecast cannot be read (AgilePredict unreachable): the last forecast read stays in use.',
    fr: 'La prévision des prix est illisible (AgilePredict injoignable) : la dernière prévision lue reste utilisée.',
    de: 'Die Preisprognose ist nicht lesbar (AgilePredict nicht erreichbar): Die zuletzt gelesene Prognose bleibt in Gebrauch.',
    es: 'No se puede leer la previsión de precios (AgilePredict inaccesible): se sigue usando la última previsión leída.',
  },
  stale: {
    en: 'The forecast is no longer updated: it covers less than a day ahead.',
    fr: "La prévision n'est plus mise à jour : elle couvre moins d'une journée à venir.",
    de: 'Die Prognose wird nicht mehr aktualisiert und reicht weniger als einen Tag voraus.',
    es: 'La previsión ya no se actualiza: cubre menos de un día por delante.',
  },
  initFailed: {
    en: 'The integration could not start: see its logs.',
    fr: "L'intégration n'a pas pu démarrer : voir ses journaux.",
    de: 'Die Integration konnte nicht starten: siehe ihre Protokolle.',
    es: 'La integración no pudo iniciarse: consulte sus registros.',
  },
  now: { en: 'Now', fr: 'Maintenant', de: 'Jetzt', es: 'Ahora' },
  average24h: { en: 'Average 24 h', fr: 'Moyenne 24 h', de: 'Mittel 24 h', es: 'Media 24 h' },
  average7d: {
    en: 'Average 7 days',
    fr: 'Moyenne 7 jours',
    de: 'Mittel 7 Tage',
    es: 'Media 7 días',
  },
  forecast: { en: 'Forecast', fr: 'Prévision', de: 'Prognose', es: 'Previsión' },
  min: { en: 'Min', fr: 'Min', de: 'Min', es: 'Mín' },
  max: { en: 'Max', fr: 'Max', de: 'Max', es: 'Máx' },
  cheapestWindow: {
    en: 'Cheapest {hours} h',
    fr: '{hours} h moins chères',
    de: 'Günstigste {hours} h',
    es: '{hours} h más baratas',
  },
  updated: { en: 'Forecast made', fr: 'Prévision établie', de: 'Erstellt', es: 'Elaborada' },
  until: { en: 'Until', fr: "Jusqu'au", de: 'Bis', es: 'Hasta' },
};

/**
 * The text of a language, English when the language is unknown.
 * @param {Record<string, string>} text
 * @param {string} [language]
 */
export function pick(text, language) {
  return text[language] ?? text.en;
}

/**
 * @param {Record<string, string>} text
 * @param {Record<string, string | number>} values
 */
export function fill(text, values) {
  return Object.fromEntries(
    Object.entries(text).map(([lang, value]) => [
      lang,
      value.replace(/\{(\w+)\}/g, (_, key) => String(values[key])),
    ]),
  );
}

/** Texts built from values. */
export const MESSAGES = {
  /**
   * @param {{ regions: number, until: string }} values
   */
  refreshed({ regions, until }) {
    return {
      en: `Forecast read for ${regions} region(s), until ${until}.`,
      fr: `Prévision lue pour ${regions} région(s), jusqu'au ${until}.`,
      de: `Prognose für ${regions} Region(en) gelesen, bis ${until}.`,
      es: `Previsión leída para ${regions} región(es), hasta ${until}.`,
    };
  },

  /** @param {string} reason */
  refreshFailed(reason) {
    return {
      en: `The forecast could not be read (${reason}). The last forecast read stays in use.`,
      fr: `La prévision n'a pas pu être lue (${reason}). La dernière prévision lue reste utilisée.`,
      de: `Die Prognose konnte nicht gelesen werden (${reason}). Die zuletzt gelesene Prognose bleibt in Gebrauch.`,
      es: `No se pudo leer la previsión (${reason}). Se sigue usando la última previsión leída.`,
    };
  },

  noForecastForScene: {
    en: 'No price forecast known yet: the source has not answered.',
    fr: "Aucune prévision de prix connue pour l'instant : la source n'a pas répondu.",
    de: 'Noch keine Preisprognose bekannt: Die Quelle hat nicht geantwortet.',
    es: 'Todavía no se conoce ninguna previsión de precios: la fuente no ha respondido.',
  },

  /** @param {string} field */
  invalidField(field) {
    return {
      en: `Unknown value for the field "${field}".`,
      fr: `Valeur inconnue pour le champ « ${field} ».`,
      de: `Unbekannter Wert für das Feld „${field}“.`,
      es: `Valor desconocido para el campo «${field}».`,
    };
  },
};

/**
 * An action failure: Gladys shows in red what a handler throws, and the
 * message is the multi-language object.
 */
export class ActionFailure extends Error {
  /** @param {Record<string, string>} text */
  constructor(text) {
    super(text.en);
    this.message = text;
  }
}
