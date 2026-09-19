const BEACH = {
  name: 'Marine St Beach, Beach Haven, NJ',
  lat: 39.5585,
  lon: -74.2382,
  tideStation: '8534208',
  buoyStation: '44091',
};

const NWS_HEADERS = {
  Accept: 'application/geo+json, application/json',
  'User-Agent': 'pikulin.net beach dashboard (personal weather site)',
};

export async function onRequestGet() {
  const result = {
    location: { name: BEACH.name, lat: BEACH.lat, lon: BEACH.lon },
    updated: new Date().toISOString(),
    weather: null,
    surf: null,
    tide: null,
    ocean: null,
    errors: [],
  };

  const tasks = await Promise.allSettled([
    fetchLocalWeather(),
    fetchSurfForecast(),
    fetchTides(),
    fetchOceanBuoy(),
  ]);

  const keys = ['weather', 'surf', 'tide', 'ocean'];
  tasks.forEach((task, index) => {
    if (task.status === 'fulfilled') result[keys[index]] = task.value;
    else result.errors.push(`${keys[index]}: ${task.reason?.message || 'unavailable'}`);
  });

  if (!result.weather && !result.surf && !result.tide && !result.ocean) {
    return json({ error: 'Beach data sources are temporarily unavailable.', details: result.errors }, 502);
  }

  return json(result, 200, 'public, max-age=180');
}

async function fetchLocalWeather() {
  const params = new URLSearchParams({
    latitude: String(BEACH.lat),
    longitude: String(BEACH.lon),
    current: [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'precipitation',
      'weather_code',
      'cloud_cover',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
    ].join(','),
    hourly: 'precipitation_probability,uv_index',
    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'apparent_temperature_max',
      'precipitation_probability_max',
      'precipitation_sum',
      'uv_index_max',
      'wind_speed_10m_max',
      'wind_gusts_10m_max',
      'sunrise',
      'sunset',
    ].join(','),
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    precipitation_unit: 'inch',
    timezone: 'America/New_York',
    forecast_days: '2',
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!response.ok) throw new Error(`local weather failed (${response.status})`);
  const data = await response.json();

  let hourlyIndex = -1;
  if (data.current?.time && Array.isArray(data.hourly?.time)) {
    const currentMs = new Date(data.current.time).getTime();
    let best = Infinity;
    data.hourly.time.forEach((time, index) => {
      const distance = Math.abs(new Date(time).getTime() - currentMs);
      if (distance < best) {
        best = distance;
        hourlyIndex = index;
      }
    });
  }

  return {
    current: {
      time: data.current?.time || null,
      temperatureF: num(data.current?.temperature_2m),
      apparentTemperatureF: num(data.current?.apparent_temperature),
      humidity: num(data.current?.relative_humidity_2m),
      precipitationIn: num(data.current?.precipitation),
      weatherCode: num(data.current?.weather_code),
      cloudCover: num(data.current?.cloud_cover),
      windMph: num(data.current?.wind_speed_10m),
      windDirectionDeg: num(data.current?.wind_direction_10m),
      windGustMph: num(data.current?.wind_gusts_10m),
      precipProbability: hourlyIndex >= 0 ? num(data.hourly?.precipitation_probability?.[hourlyIndex]) : null,
      uvIndex: hourlyIndex >= 0 ? num(data.hourly?.uv_index?.[hourlyIndex]) : null,
    },
    today: dailyAt(data.daily, 0),
    tomorrow: dailyAt(data.daily, 1),
    source: 'Open-Meteo point forecast at Marine St Beach',
  };
}

function dailyAt(daily, index) {
  if (!daily?.time?.[index]) return null;
  return {
    date: daily.time[index],
    highF: num(daily.temperature_2m_max?.[index]),
    lowF: num(daily.temperature_2m_min?.[index]),
    apparentHighF: num(daily.apparent_temperature_max?.[index]),
    precipProbabilityMax: num(daily.precipitation_probability_max?.[index]),
    precipitationIn: num(daily.precipitation_sum?.[index]),
    uvIndexMax: num(daily.uv_index_max?.[index]),
    windMphMax: num(daily.wind_speed_10m_max?.[index]),
    windGustMphMax: num(daily.wind_gusts_10m_max?.[index]),
    sunrise: daily.sunrise?.[index] || null,
    sunset: daily.sunset?.[index] || null,
  };
}

async function fetchSurfForecast() {
  const listResponse = await fetch('https://api.weather.gov/products/types/SRF/locations/PHI', { headers: NWS_HEADERS });
  if (!listResponse.ok) throw new Error(`NWS surf product list failed (${listResponse.status})`);
  const list = await listResponse.json();
  const products = list['@graph'] || list.products || [];
  if (!products.length) throw new Error('NWS returned no surf-zone products.');

  const latest = [...products].sort((a, b) =>
    new Date(b.issuanceTime || b.issueTime || 0) - new Date(a.issuanceTime || a.issueTime || 0)
  )[0];
  if (!latest?.id) throw new Error('NWS surf product had no product id.');

  const productResponse = await fetch(`https://api.weather.gov/products/${latest.id}`, { headers: NWS_HEADERS });
  if (!productResponse.ok) throw new Error(`NWS surf product failed (${productResponse.status})`);
  const product = await productResponse.json();
  const text = product.productText || '';
  const section = zoneSection(text, 'NJZ026');
  if (!section) throw new Error('Long Beach Island section not found in NWS surf forecast.');

  const blocks = forecastBlocks(section);
  return {
    issued: product.issuanceTime || latest.issuanceTime || null,
    today: blocks[0] || null,
    tomorrow: blocks[1] || null,
    source: 'NWS Mount Holly Surf Zone Forecast - Coastal Ocean / Long Beach Island',
  };
}

function zoneSection(text, zone) {
  const index = text.indexOf(zone);
  if (index < 0) return '';
  const end = text.indexOf('\n$$', index);
  return text.slice(index, end > index ? end : undefined);
}

function forecastBlocks(section) {
  const starts = [...section.matchAll(/^\.([A-Z][A-Z ]+)\.\.\./gm)];
  if (!starts.length) return [];
  return starts.slice(0, 2).map((match, i) => {
    const start = match.index;
    const end = starts[i + 1]?.index ?? section.length;
    const block = section.slice(start, end);
    return {
      label: titleCase(match[1].trim()),
      ripCurrentRisk: field(block, 'Rip Current Risk'),
      surfHeight: field(block, 'Surf Height'),
      thunderstormPotential: field(block, 'Thunderstorm Potential'),
      uvIndex: field(block, 'UV Index'),
      waterTemperature: field(block, 'Water Temperature'),
      weather: field(block, 'Weather'),
      highTemperature: field(block, 'High Temperature'),
      winds: field(block, 'Winds'),
      sunrise: field(block, 'Sunrise'),
      sunset: field(block, 'Sunset'),
    };
  });
}

function field(block, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^\\s*${escaped}(?:\\*+)?\\.*\\s*(.+)$`, 'im');
  return block.match(regex)?.[1]?.trim() || null;
}

async function fetchTides() {
  const begin = localYmd(0);
  const end = localYmd(1);
  const params = new URLSearchParams({
    begin_date: begin,
    end_date: end,
    station: BEACH.tideStation,
    product: 'predictions',
    datum: 'MLLW',
    time_zone: 'lst_ldt',
    interval: 'hilo',
    units: 'english',
    format: 'json',
    application: 'pikulin.net',
  });
  const response = await fetch(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?${params}`);
  if (!response.ok) throw new Error(`NOAA tide predictions failed (${response.status})`);
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'NOAA tide prediction error.');

  const events = (data.predictions || []).map(item => ({
    time: item.t,
    heightFt: num(item.v),
    type: item.type === 'H' ? 'High' : item.type === 'L' ? 'Low' : item.type,
  }));

  return {
    stationId: BEACH.tideStation,
    stationName: 'Beach Haven Coast Guard Station',
    distanceMilesApprox: 1.2,
    datum: 'MLLW',
    events,
    source: 'NOAA Tides & Currents',
  };
}

async function fetchOceanBuoy() {
  const response = await fetch(`https://www.ndbc.noaa.gov/data/realtime2/${BEACH.buoyStation}.txt`, {
    headers: { 'User-Agent': 'pikulin.net beach dashboard (personal weather site)' },
  });
  if (!response.ok) throw new Error(`NDBC buoy feed failed (${response.status})`);
  const text = await response.text();
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 3) throw new Error('NDBC buoy feed contained no observations.');

  const headers = lines[0].trim().replace(/^#/, '').split(/\s+/);
  const values = lines[2].trim().split(/\s+/);
  const row = {};
  headers.forEach((header, i) => { row[header] = values[i]; });
  const value = key => row[key] && row[key] !== 'MM' ? Number(row[key]) : null;

  const year = value('YY');
  const month = value('MM');
  const day = value('DD');
  const hour = value('hh');
  const minute = value('mm');
  const observed = [year, month, day, hour, minute].every(Number.isFinite)
    ? new Date(Date.UTC(year, month - 1, day, hour, minute)).toISOString()
    : null;

  return {
    stationId: BEACH.buoyStation,
    stationName: 'Barnegat, NJ Waverider',
    distanceMilesApprox: 29,
    observed,
    waveHeightFt: metersToFeet(value('WVHT')),
    dominantPeriodSec: value('DPD'),
    averagePeriodSec: value('APD'),
    waveDirectionDeg: value('MWD'),
    waterTemperatureF: celsiusToF(value('WTMP')),
    airTemperatureF: celsiusToF(value('ATMP')),
    source: 'NOAA/NDBC station 44091',
  };
}

function localYmd(offsetDays) {
  const date = new Date(Date.now() + offsetDays * 86400000);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = type => parts.find(part => part.type === type)?.value || '';
  return `${get('year')}${get('month')}${get('day')}`;
}

function titleCase(value) {
  return value.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

function num(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function metersToFeet(value) {
  return Number.isFinite(value) ? value * 3.28084 : null;
}

function celsiusToF(value) {
  return Number.isFinite(value) ? (value * 9 / 5) + 32 : null;
}

function json(payload, status = 200, cacheControl = 'no-store') {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cacheControl,
    },
  });
}
