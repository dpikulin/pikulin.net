// Public airport observation, independent of the private Tempest credentials.
export async function onRequestGet() {
  try {
    const response = await fetch('https://api.weather.gov/stations/KSMQ/observations/latest', {
      headers: { Accept: 'application/geo+json', 'User-Agent': 'PikulinWeather/1.0 (https://pikulin.net)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('Upstream error');
    const { properties: p } = await response.json();
    if (!p?.timestamp) throw new Error('No observation');
    const properties = {
      timestamp: p.timestamp,
      temperature: p.temperature,
      relativeHumidity: p.relativeHumidity,
      windSpeed: p.windSpeed,
      textDescription: p.textDescription,
    };
    return new Response(JSON.stringify({ properties }), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=120' } });
  } catch {
    return new Response(JSON.stringify({ error: 'Regional weather unavailable.' }), { status: 503, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  }
}
