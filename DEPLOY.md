# Pikulin Weather 2.0 deployment notes

## Required Cloudflare Pages secrets

The old site exposed Tempest connection details in public browser source. This version moves Tempest calls into a Cloudflare Pages Function and keeps both the API token and station identifier in Cloudflare.

In Cloudflare:

1. Workers & Pages → `pikulin-net` → Settings.
2. Choose the environment you are deploying to (`Preview` while testing, `Production` for the live site).
3. Find Variables and Secrets / Environment variables.
4. Add a secret named `TEMPEST_TOKEN` containing the Tempest personal access token.
5. Add a secret named `TEMPEST_STATION_ID` containing the station identifier.
6. Redeploy after adding or changing either secret so it is available to the new deployment.

Do **not** commit either Tempest value to GitHub.

The `/api/tempest` proxy intentionally returns only weather observations needed by the site. It does not pass station identifiers, coordinates, or other upstream station metadata to the browser.

## What changed

- Live weather uses a server-side WeatherFlow request and returns a sanitized observation payload.
- Forecast uses Open-Meteo geocoding and forecast data, so ZIP/city search does not depend on WeatherFlow's `better_forecast` endpoint.
- Archive uses the WeatherFlow station observation endpoint with bucketed history and CSV export while omitting the station identifier from the browser response.
- Radar and NOAA alerts are preserved and restyled.
- Dad's Drawing is preserved with an explicit fallback while the gallery mechanism is redesigned.
- Webcam remains a clean development placeholder.

## Safe rollout

For future weather-function changes, use a Cloudflare Pages preview deployment first. Add both Tempest secrets to the Preview environment before testing. Confirm:

- `/api/tempest?action=current` returns sanitized weather JSON, not a secret-configuration error.
- Live data matches the Tempest app closely.
- Forecast works for the home area and at least one other ZIP/city.
- Archive loads 24 hours, 7 days, 30 days, and 1 year.
- Radar and alerts render.
- Mobile navigation and cards look correct.

If the archive endpoint reports an unrecognized WeatherFlow format, the live site is still safe. The function deliberately fails with a readable error rather than fabricating archive values.
