# Pikulin Weather 2.0 deployment notes

## Required Cloudflare Pages secret

The old site exposed the Tempest personal access token in public browser source. This version moves Tempest calls into a Cloudflare Pages Function.

In Cloudflare:

1. Workers & Pages → `pikulin-net` → Settings.
2. Find Variables and Secrets / Environment variables.
3. Add a production secret named `TEMPEST_TOKEN` and paste the existing Tempest personal access token.
4. Optional: add `TEMPEST_STATION_ID=148425`. If omitted, the function already defaults to station 148425.
5. Redeploy after adding the secret if Cloudflare does not automatically make it available to the current deployment.

Do **not** commit the Tempest token to GitHub.

## What changed

- Live weather keeps the same WeatherFlow station endpoint, but now the token remains server-side.
- Forecast uses Open-Meteo geocoding and forecast data, so ZIP/city search no longer depends on WeatherFlow's `better_forecast` endpoint.
- Archive is implemented against the current WeatherFlow station observation endpoint with bucketed history and CSV export.
- Radar and NOAA alerts are preserved and restyled.
- Dad's Drawing is preserved with an explicit fallback while the gallery mechanism is redesigned.
- Webcam remains a clean development placeholder.

## Safe rollout

Before merging into `main`, a Cloudflare Pages preview deployment is ideal. Confirm:

- `/api/tempest?action=current` returns JSON, not a secret-configuration error.
- Live data matches the Tempest app closely.
- Forecast works for `08853` and at least one other ZIP/city.
- Archive loads 24 hours, 7 days, 30 days, and 1 year.
- Radar and alerts render.
- Mobile navigation and cards look correct.

If the archive endpoint reports an unrecognized WeatherFlow format, the live site is still safe. The function deliberately fails with a readable error rather than fabricating archive values.
