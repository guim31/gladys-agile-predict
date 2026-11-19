# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.0] - 2026-11-19

### Added

- One device per Octopus Agile region chosen in the settings, with the
  AgilePredict forecast price of the current half-hour, the average, lowest and
  highest price of the next 24 hours and 7 days, the start and average price of
  the cheapest window of consecutive hours, and the date and end of the
  forecast (import prices, VAT included).
- A dashboard widget with the forecast curve of the next 2, 4 or 7 days, in
  p/kWh.
- Scene triggers: the cheapest forecast hours begin, the forecast price drops
  below a threshold (0 to 40 p/kWh), by region.
- Scene action: find the cheapest forecast hours within a given time, in a
  region.
- A "Read the forecast now" action.
- English, French, German and Spanish texts and documentation.

[Unreleased]: https://github.com/guim31/gladys-agile-predict/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/guim31/gladys-agile-predict/releases/tag/v1.0.0
