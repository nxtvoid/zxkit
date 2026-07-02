# @zxkit/chrono

## 1.1.0

### Minor Changes

- c9a6380: Initial release. Zero-dependency calendar dates and timezone-aware instants built on native `Intl`, with a total API that never throws: invalid input returns `null` at the boundary (`parsePlainDate`, `plainDate`, `dayOf`, `toInstant`), arithmetic saturates instead of failing, and formatters fall back to ISO strings on bad locales or options.

  Includes the branded `PlainDate` type with full arithmetic (`addDays`/`addMonths`/`addYears`, `diffDays`/`diffMonths`/`diffYears`, period boundaries, `eachDay`/`eachMonth`, `clampDate`, `toUtcRange`), `Intl`-based formatting (`formatPlain`, `formatPlainRange`), and the `zone()` factory with day resolution, DST-safe local midnights, wall-clock `toInstant`, half-open query ranges (`dayRange`/`weekRange`/`monthRange`/`yearRange`/`rangeBetween`), and localized formatters including `formatRelative`.

  Verified by unit suites plus fast-check property tests (totality across hostile inputs) run under multiple process timezones.
