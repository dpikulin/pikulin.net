const WEATHERFLOW_BASE = 'https://swd.weatherflow.com/swd/rest';
const DEFAULT_STATION_ID = '148425';

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
      units_temp: 'f',
      units_wind: 'mph',
      units_pressure: 'mb',
      units_precip: 'in',
      units_distance: 'mi',
    });
    const response = await fetch(`${WEATHERFLOW_BASE}/observations/stn/${encodeURIComponent(stationId)}?${params}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Tempest archive failed (${response.status}) for a ${window.bucket}-minute bucket.`);
    const payload = await response.json();
    allPoints.push(...normalizeArchivePayload(payload));
  }

  const deduped = dedupeByTimestamp(allPoints).filter(point => point.timestamp >= start && point.timestamp <= now);
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

function normalizeArchivePayload(payload) {
  const obs = Array.isArray(payload?.obs) ? payload.obs : [];
  if (!obs.length) return [];

  if (!Array.isArray(obs[0])) {
    return obs.map(item => ({
      timestamp: Number(item.timestamp),
      air_temp_f: item.air_temperature ?? item.air_temp,
      humidity: item.relative_humidity ?? item.rh,
      wind_mph: item.wind_avg,
      gust_mph: item.wind_gust,
      pressure_mb: item.sea_level_pressure ?? item.barometric_pressure ?? item.station_pressure,
      precip_in: item.precip ?? item.precip_accumulation ?? 0,
    })).filter(validPoint);
  }

  if (payload.type === 'obs_st' || obs[0].length >= 18) {
    return obs.map(row => ({
      timestamp: Number(row[0]),
      wind_mph: nullableNumber(row[2]),
      gust_mph: nullableNumber(row[3]),
      pressure_mb: nullableNumber(row[6]),
      air_temp_f: nullableNumber(row[7]),
      humidity: nullableNumber(row[8]),
      precip_in: nullableNumber(row[12]) || 0,
    })).filter(validPoint);
  }

  throw new Error('Tempest returned an archive format this site does not recognize yet.');
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validPoint(point) {
  return Number.isFinite(point.timestamp) && Number.isFinite(Number(point.air_temp_f));
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
