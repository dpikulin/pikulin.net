const WEATHERFLOW_BASE = 'https://swd.weatherflow.com/swd/rest';
const DEFAULT_STATION_ID = '148425';

// The station-history endpoint does NOT use the same compact array layout as
// device obs_st messages. Request only the fields we need, in an explicit
// order, so the response can be decoded deterministically.
const ARCHIVE_FIELDS = [
  'timestamp',
  'air_temp',
  'rh',
  'wind_avg',
  'wind_gust',
  'sea_level_pressure',
  'precip_accumulation',
  'report_interval',
];

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'current';
  const token = env.TEMPEST_TOKEN;
  const stationId = env.TEMPEST_STATION_ID || DEFAULT_STATION_ID;

  if (!token) return json({ error: 'TEMPEST_TOKEN is not configured in Cloudflare Pages.' }, 500);

  try {
    if (action === 'current') return await currentObservation(token, stationId);
    if (action === 'archive') {
      const days = Number(url.searchParams.get('days') || 1);
      if (![1, 7, 30, 365].includes(days)) return json({ error: 'Unsupported archive range.' }, 400);
      return await archiveObservations(token, stationId, days);
    }
    return json({ error: 'Unknown Tempest action.' }, 400);
  } catch (error) {
    return json({ error: error.message || 'Tempest request failed.' }, 502);
  }
}

async function currentObservation(token, stationId) {
  const upstream = `${WEATHERFLOW_BASE}/observations/station/${encodeURIComponent(stationId)}?token=${encodeURIComponent(token)}`;
  const response = await fetch(upstream, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Tempest current observation failed (${response.status}).`);
  return new Response(await response.text(), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=30' },
  });
}

async function archiveObservations(token, stationId, days) {
  const now = Math.floor(Date.now() / 1000);
  const start = now - (days * 86400);
  const windows = buildWindows(start, now, days);
  const allPoints = [];

  for (const window of windows) {
    const params = new URLSearchParams({
      token,
      time_start: String(window.start),
      time_end: String(window.end),
      bucket: String(window.bucket),
      ob_fields: ARCHIVE_FIELDS.join(','),
      units_temp: 'f',
      units_wind: 'mph',
      units_pressure: 'mb',
      units_precip: 'in',
      units_distance: 'mi',
    });
    const response = await fetch(`${WEATHERFLOW_BASE}/observations/stn/${encodeURIComponent(stationId)}?${params}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Tempest archive failed (${response.status}) for a ${window.bucket}-minute bucket.`);
    const payload = await response.json();
    allPoints.push(...normalizeArchivePayload(payload, ARCHIVE_FIELDS));
  }

  const deduped = dedupeByTimestamp(allPoints).filter(point => point.timestamp >= start && point.timestamp <= now);
  if (!deduped.length) {
    throw new Error('Tempest returned archive data, but no plausible weather observations could be decoded.');
  }
  return json({ station_id: Number(stationId), days, points: deduped }, 200, 'public, max-age=120');
}

function buildWindows(start, end, days) {
  if (days <= 1) return [{ start, end, bucket: 1 }];
  if (days <= 30) return [{ start, end, bucket: 30 }];

  const maxWindow = 180 * 86400;
  const windows = [];
  let cursor = start;
  while (cursor < end) {
    const next = Math.min(cursor + maxWindow, end);
    windows.push({ start: cursor, end: next, bucket: 180 });
    cursor = next + 1;
  }
  return windows;
}

function normalizeArchivePayload(payload, requestedFields) {
  const obs = Array.isArray(payload?.obs) ? payload.obs : [];
  if (!obs.length) return [];

  // Some WeatherFlow responses are object-shaped.
  if (!Array.isArray(obs[0])) {
    return obs.map(item => ({
      timestamp: nullableNumber(item.timestamp),
      air_temp_f: nullableNumber(item.air_temp ?? item.air_temperature),
      humidity: nullableNumber(item.rh ?? item.relative_humidity),
      wind_mph: nullableNumber(item.wind_avg),
      gust_mph: nullableNumber(item.wind_gust),
      pressure_mb: nullableNumber(item.sea_level_pressure ?? item.barometric_pressure ?? item.station_pressure),
      precip_in: nullableNumber(item.precip_accumulation ?? item.precip) ?? 0,
    })).filter(validPoint);
  }

  // Newer station-observation responses may echo the selected field order.
  const echoedFields = normalizeFieldList(payload.ob_fields ?? payload.obs_fields ?? payload.fields);
  const fields = echoedFields.length === obs[0].length ? echoedFields : requestedFields;

  if (fields.length !== obs[0].length) {
    throw new Error(`Tempest archive field count mismatch (expected ${fields.length}, received ${obs[0].length}).`);
  }

  const index = Object.fromEntries(fields.map((field, i) => [field, i]));
  return obs.map(row => ({
    timestamp: nullableNumber(row[index.timestamp]),
    air_temp_f: nullableNumber(row[index.air_temp]),
    humidity: nullableNumber(row[index.rh]),
    wind_mph: nullableNumber(row[index.wind_avg]),
    gust_mph: nullableNumber(row[index.wind_gust]),
    pressure_mb: nullableNumber(row[index.sea_level_pressure]),
    precip_in: nullableNumber(row[index.precip_accumulation]) ?? 0,
  })).filter(validPoint);
}

function normalizeFieldList(value) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') return value.split(',').map(v => v.trim()).filter(Boolean);
  return [];
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validPoint(point) {
  if (!Number.isFinite(point.timestamp)) return false;
  if (!Number.isFinite(point.air_temp_f) || point.air_temp_f < -150 || point.air_temp_f > 160) return false;
  if (point.humidity !== null && (!Number.isFinite(point.humidity) || point.humidity < 0 || point.humidity > 100)) return false;
  if (point.pressure_mb !== null && (!Number.isFinite(point.pressure_mb) || point.pressure_mb < 800 || point.pressure_mb > 1100)) return false;
  if (point.precip_in !== null && (!Number.isFinite(point.precip_in) || point.precip_in < 0 || point.precip_in > 10)) return false;
  return true;
}

function dedupeByTimestamp(points) {
  const map = new Map();
  for (const point of points) map.set(point.timestamp, point);
  return [...map.values()].sort((a, b) => a.timestamp - b.timestamp);
}

function json(body, status = 200, cacheControl = 'no-store') {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cacheControl,
    },
  });
}
