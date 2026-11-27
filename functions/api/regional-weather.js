const SOLBERG_URL = 'https://www.digiwx-n51.com/';
const SOMERSET_URL = 'https://api.weather.gov/stations/KSMQ/observations/latest';
const USER_AGENT = 'PikulinWeather/1.0 (https://pikulin.net)';

function plainText(html) {
  return html.replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:nbsp|#160|#xa0);/gi, ' ')
    .replace(/&(?:deg|#176|#xb0);/gi, '°')
    .replace(/&(?:minus|#8722);/gi, '-')
    .replace(/\s+/g, ' ').trim();
}

function parseSolberg(html, now = Date.now()) {
  const text = plainText(html);
  if (!/Solberg[\s-]+Hunterdon\s*\(N51\)/i.test(text)) return null;
  const stamp = text.match(/Weather Advisories\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2})\s*Z\b/i);
  const temp = text.match(/\bTemperature\s+([-+]?\d+(?:\.\d+)?)\s*°?\s*C\b/i);
  if (!stamp || !temp) return null;
  const timestamp = Date.parse(stamp[1] + 'T' + stamp[2] + ':' + stamp[3] + ':00Z');
  const age = now - timestamp;
  const temperature = Number(temp[1]);
  if (!Number.isFinite(timestamp) || age < -120000 || age > 3600000 || temperature < -70 || temperature > 65) return null;
  const rh = text.match(/\bRelative Humidity\s+(\d+(?:\.\d+)?)\s*%/i);
  const wind = text.match(/\bWind\s+(?:\d{1,3}\s*°?|VRB|Variable)\s*@\s*(\d+(?:\.\d+)?)\s*KT\b/i);
  const calm = /\bWind\s+(?:Calm|00000KT)\b/i.test(text);
  const humidity = rh && Number(rh[1]) <= 100 ? Number(rh[1]) : null;
  const knots = calm ? 0 : wind && Number(wind[1]) <= 150 ? Number(wind[1]) : null;
  return {
    timestamp: new Date(timestamp).toISOString(),
    temperature: { value: temperature, unitCode: 'wmoUnit:degC' },
    relativeHumidity: { value: humidity, unitCode: 'wmoUnit:percent' },
    windSpeed: { value: knots === null ? null : knots * 1.852, unitCode: 'wmoUnit:km_h-1' },
    textDescription: 'Airport advisory observation',
  };
}

function validSomerset(p, now = Date.now()) {
  const age = now - Date.parse(p?.timestamp);
  return Number.isFinite(age) && age >= -120000 && age <= 3 * 3600000
    && typeof p?.temperature?.value === 'number' && Number.isFinite(p.temperature.value);
}

function reply(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': status === 200 ? 'public, max-age=120' : 'no-store' },
  });
}

// Independent of the private Tempest credentials. Prefer the local airport
// advisory webpage; fail closed on stale/unrecognized data, then use NWS.
export async function onRequestGet() {
  try {
    const response = await fetch(SOLBERG_URL, { headers: { Accept: 'text/html', 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(4000) });
    if (response.ok) {
      const properties = parseSolberg(await response.text());
      if (properties) return reply({ source: 'N51', properties });
    }
  } catch { /* Try the nationally reporting airport instead. */ }
  try {
    const response = await fetch(SOMERSET_URL, { headers: { Accept: 'application/geo+json', 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('Upstream error');
    const { properties: p } = await response.json();
    if (!validSomerset(p)) throw new Error('No recent observation');
    return reply({ source: 'KSMQ', properties: {
      timestamp: p.timestamp,
      temperature: p.temperature,
      relativeHumidity: p.relativeHumidity,
      windSpeed: p.windSpeed,
      textDescription: p.textDescription,
    } });
  } catch {
    return reply({ error: 'Regional weather unavailable.' }, 503);
  }
}
