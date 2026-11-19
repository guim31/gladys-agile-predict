# gladys-agile-predict

[Gladys Assistant](https://gladysassistant.com) external integration: **Octopus
Agile electricity prices forecast up to 7 days ahead** (Great Britain), from
[AgilePredict](https://agilepredict.com), to plan the big loads beyond
tomorrow's published prices.

- One device per Agile region you choose (A to P, or the national average X):
  the forecast price of the current half-hour, the average, lowest and highest
  price of the next 24 hours and 7 days, the start and price of the cheapest
  window of N hours, the forecast date and end.
- A dashboard widget with the forecast curve, in p/kWh.
- Scene triggers: the cheapest forecast hours begin, the forecast price drops
  below a threshold (negative prices included).
- Scene action: find the cheapest forecast hours within a given time.

A **forecast**, complementary to the published prices: for tomorrow's real
Agile prices, your meters and your contract, use
[gladys-octopus-energy](https://github.com/LM1LC3N7/gladys-octopus-energy).

**Developed without an Agile contract to compare with: feedback welcome.** Not
affiliated with Octopus Energy nor with AgilePredict.

User documentation: [English](docs/en.md) · [Français](docs/fr.md) ·
[Deutsch](docs/de.md) · [Español](docs/es.md).

## Requirements

- Gladys Assistant 5.3.0 or later.
- Internet access from Gladys. No account, no key.

## Installation

In Gladys: **Integrations → Install from GitHub**, then enter
`https://github.com/guim31/gladys-agile-predict`. Tick your region in the
integration's settings and add its device from the **Discovery** tab.

## How it works

```
Gladys ⇄ SDK ⇄ src/app.js     cycle every minute: read, publish, fire the scene events
                 ├─ src/source.js    GET agilepredict.com/api/{region}?days=8 (half-hours, p/kWh)
                 ├─ src/forecast.js  one forecast per region: hourly refresh, backoff, snapshot
                 ├─ src/prices.js    current slot, summaries, cheapest window (pure)
                 ├─ src/device.js    the region's device and its states (£/kWh)
                 ├─ src/triggers.js  scene events when a half-hour begins
                 ├─ src/scenes.js    the scene action
                 └─ src/widget.js    the dashboard widget
```

Each region in use is read once an hour, as AgilePredict's fair-use notes ask
(about 60 requests a minute per address at most, "once every few hours is
plenty").

## Limits

- A forecast, with errors of several pence; import prices only, VAT included.
- The source is a free hobby service: it may slow down or stop.

## Credits

Forecasts by [AgilePredict](https://agilepredict.com) (free API, no licence
stated: the integration credits it and reads it sparingly). Built on the
sibling integration
[gladys-spot-forecast](https://github.com/guim31/gladys-spot-forecast) and the
official [integration template](https://github.com/GladysAssistant/integration-template-js).

## License

Apache-2.0, see [LICENSE](LICENSE).
