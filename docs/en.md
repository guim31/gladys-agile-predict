# Octopus Agile Forecast

Forecast Octopus Agile electricity prices for the days **after** the published
ones, to plan the washing machine, the water heater, the battery or the car
charging up to a week ahead.

The forecast comes from [AgilePredict](https://agilepredict.com), a free
service that forecasts the GB day-ahead wholesale price with machine learning
and turns it into the Agile import unit rate of each region with Octopus's
published formulas, half-hour by half-hour, up to about a week ahead.

Developed without an Agile contract to compare with: feedback welcome. Not
affiliated with Octopus Energy nor with AgilePredict.

## Overview

- One device per region you choose, e.g. **Agile forecast London**: the
  forecast price of the current half-hour, the average, lowest and highest
  price of the next 24 hours and of the next 7 days, the start and average
  price of the cheapest window of consecutive hours, when the forecast was made
  and how far it goes.
- A dashboard widget: the forecast curve of the next 2, 4 or 7 days.
- Two scene triggers: the cheapest forecast hours begin, the forecast price
  drops below a threshold.
- One scene action: find the cheapest forecast hours within a given time.

Prices are Agile **import** rates, **VAT included**, without the standing
charge. The device shows them in **£/kWh** (Gladys has no pence unit: 0.2551
means 25.51 p/kWh); the widget, the triggers and the scene action speak
**p/kWh**.

This is a **forecast**, not the published prices: Octopus publishes tomorrow's
real Agile prices around 16:00 (UK time). For them and for your meter, use the
Octopus Energy integration next to this one: this one only adds the days
after.

## Requirements

- Gladys Assistant 5.3.0 or later.
- Internet access from Gladys: the forecast comes from agilepredict.com. No
  account, no key.

## Installation

1. In Gladys, open **Integrations → Install from GitHub**.
2. Enter `https://github.com/guim31/gladys-agile-predict`.
3. In the integration's settings, tick your **region**.
4. Open the **Discovery** tab of the integration and add the device.
5. Add the **Octopus Agile forecast** widget to a dashboard.

## Configuration

- **Regions**: the region of your meter, the letter at the end of your Agile
  tariff code (`E-1R-AGILE-24-10-01-C` is London, C). A through P are the
  fourteen distribution areas, X the national average. One device per region
  ticked; none ticked, the integration waits and says so.
- **Length of the cheapest window** (30 minutes to 8 hours, 3 hours by
  default) and **Search the cheapest window in** (the next 12 hours to 7 days,
  24 hours by default): the window the devices show.
- **Language of the feature names** (French by default): used when the device
  is added; the names do not change afterwards.

## The forecast device

| Feature                                | Meaning                                                   |
| -------------------------------------- | --------------------------------------------------------- |
| Forecast price now (£/kWh)             | the forecast price of the half-hour in progress           |
| Average / Lowest / Highest next 24 h   | over the 48 half-hours from the current one               |
| Average / Lowest / Highest next 7 days | over the 336 half-hours from the current one              |
| Start of the cheapest window           | weekday and time (UK), e.g. `Tue 03:00`                   |
| Cheapest window average (£/kWh)        | the average forecast price of that window                 |
| Forecast made / Forecast until         | when AgilePredict made it, and the end of its last period |

Times are in UK time (Europe/London), the clock of the Agile half-hours.

## Dashboard widget

The forecast curve of the next 2 or 4 days (one step per half-hour) or 7 days
(one step per hour: the dashboard takes 300 points at most), with its lowest
and highest periods marked; three tiles in p/kWh (now, average of the next 24
hours and of the next 7 days); the cheapest window, the forecast time and the
end of the forecast. The **region** setting picks the region (by default the
first one ticked in the configuration); the tiles and the status lines can be
hidden.

## Scene triggers

Both triggers have a required **region** filter. They only fire for the
regions ticked in the configuration.

### Cheapest forecast hours begin

Fires when the cheapest run of N consecutive hours (30 minutes to 8 hours) of
the next 12, 24 or 48 hours begins: nothing cheaper is forecast before that
horizon. Then the same choice stays silent until the horizon is over: with
prices falling for a whole day, the cheapest window would otherwise start
"now" every half-hour. Variables: average price (p/kWh), start and end
(HH:MM).

### The forecast price drops below a threshold

Fires at the start of a run of half-hours under the threshold (0 to 40 p/kWh),
when the half-hour before was above it. Variables: the price of the half-hour
(p/kWh), the number of hours under the threshold, start and end (HH:MM).

## Scene action

**Find the cheapest forecast hours**: in a region, the cheapest run of N
consecutive hours (30 minutes to 8 hours) from now, within the next 6 hours to
7 days. Outputs: found, starts now, start date (YYYY-MM-DD), start and end
(HH:MM), average price (p/kWh), minutes until the start. A region not ticked
in the configuration is read on demand. With no forecast known (the source
unreachable), the action fails in red.

## Scene examples

- **Water heater**: trigger "Cheapest forecast hours begin" (region C, 3
  hours, nothing cheaper in the next 24 hours) → turn the water heater's plug
  on; a second scene turns it off three hours later.
- **Car charging**: every evening at 20:00, action "Find the cheapest forecast
  hours" (region C, 4 hours within 48 hours) → send a message "charge on
  {start_date} at {start_time}".
- **Plunge prices**: trigger "The forecast price drops below a threshold"
  (region C, 0 p/kWh) → notify.

## Refresh and source usage

Each region in use is read once an hour (`/api/{region}?days=8`, about 35 KB).
AgilePredict is a free, hobby-scale service: it allows about 60 requests a
minute per address and asks for sparing polling, as new forecasts come a few
times a day. After a failure, the next tries come after 5, 10, 20, 40 then 60
minutes; the last forecast read stays in use meanwhile. A region read on
demand by the widget or the scene action stays read for 24 hours. Forecast by
AgilePredict (agilepredict.com): credit it if you share its figures.

## Troubleshooting

- **The integration asks for a region**: tick at least one region in its
  settings.
- **The integration shows an error status**: the forecast cannot be read
  (AgilePredict unreachable for 2 hours, or since the start), or it covers less than a day ahead
  (the service stopped publishing). The last forecast read stays in use.
- **No state on the device**: add the device from the Discovery tab, then use
  the **Read the forecast now** action.
- Full detail in the integration logs, with `LOG_LEVEL=debug`.

## Limitations

- A forecast is not a price: expect errors of several pence, more for the
  days furthest ahead or in unusual weather. AgilePredict's site shows its
  past accuracy.
- Import prices only (no Agile Outgoing export prices), VAT included at the
  current domestic rate.
- The forecast depends on a free hobby service: it may slow down or stop.
