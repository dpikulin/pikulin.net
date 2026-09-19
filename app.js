const APP = {
  unitSystem: localStorage.getItem('unitSystem') || 'imperial',
  archiveDays: 1,
  archiveData: [],
  archiveChart: null,
  lastCurrent: null,
  lastBeach: null,
};

const DEMO_CURRENT = {
  timestamp: Math.floor(Date.now() / 1000),
  air_temperature: 21.4,
  sea_level_pressure: 1017.8,
  relative_humidity: 66,
  precip: 0,
  precip_accum_last_1hr: 0,
  wind_avg: 1.8,
  wind_direction: 240,
  wind_gust: 3.9,
  solar_radiation: 420,
  uv: 3.1,
  lightning_strike_count_last_3hr: 0,
  lightning_strike_last_distance: null,
  precip_accum_local_day: 0.4,
};

const WARDROBE_LINES = {
  hot: [
    ['No layers. The atmosphere has already brought enough of them.', 'Original chaos'],
    ['This is “find shade and complain dramatically” weather.', 'Pikulin house rules'],
    ['Top Chef briefing: light clothes, cold drink, do not overcook yourself.', 'Top Chef-ish'],
    ['The ton would call this indecently warm. Linen wins.', 'Bridgerton-ish'],
    ['Princess Donut would reject sleeves on aesthetic grounds alone.', 'Dungeon crawler reference'],
    ['The dungeon has activated the Sweaty Human debuff. Shorts are mandatory equipment.', 'Dungeon rules'],
  ],
  warm: [
    ['T-shirt weather. A backup layer is optional, but Linda will probably bring one anyway.', 'Domestic forecasting'],
    ['Central Perk logic: coffee, light top, cardigan only if the AC gets ambitious.', 'Friends-ish'],
    ['Chef, your mise en place is simple: shirt, sunglasses, done.', 'Top Chef-ish'],
    ['A perfectly respectable promenade temperature. No dramatic cape required.', 'Bridgerton-ish'],
    ['Princess Donut approves the temperature but remains concerned about your accessories.', 'Dungeon crawler reference'],
  ],
  mild: [
    ['Sweater territory. Not technically cold, which has never stopped this family.', 'Pikulin standard'],
    ['This is a cardigan episode. The laugh track agrees.', 'Sitcom weather'],
    ['Dearest gentle wearer: a light layer will prevent an entirely avoidable scandal.', 'Bridgerton-ish'],
    ['Top Chef challenge: construct one functional outfit using exactly one sweater.', 'Top Chef-ish'],
    ['The dungeon AI has awarded you a Common Cardigan. Equip it before leaving the house.', 'Dungeon rules'],
    ['Katia would pack the practical layer. Be like Katia.', 'Dungeon crawler reference'],
  ],
  chilly: [
    ['Jacket weather. The sun may file an appeal later.', 'Pikulin standard'],
    ['Bring the jacket. Yes, even if you are “just going from the car to inside.”', 'Marriage-tested guidance'],
    ['The judges have spoken: bare arms have been eliminated.', 'Top Chef-ish'],
    ['The ton is whispering. Apparently you left home without a proper coat.', 'Bridgerton-ish'],
    ['NEW ACHIEVEMENT: You remembered a jacket before becoming miserable.', 'Dungeon rules'],
    ['Princess Donut says the coat is acceptable. Your shoes remain under review.', 'Dungeon crawler reference'],
  ],
  cold: [
    ['Coat. Real coat. The decorative little jacket has been disqualified.', 'Pikulin standard'],
    ['Layer up like your comfort depends on it, because it very much does.', 'Common sense, reluctantly'],
    ['This weather has no friends. Wear the coat.', 'Sitcom-ish'],
    ['Dearest gentle wearer: frostbite is not a fashionable intrigue.', 'Bridgerton-ish'],
    ['The dungeon has entered a cold biome. Armor bonus: gloves, scarf, actual coat.', 'Dungeon rules'],
    ['Katia packed layers. Carl ignored the briefing. You know which one to copy.', 'Dungeon crawler reference'],
  ],
  brutal: [
    ['Absolutely not. Coat, gloves, hat, scarf, and whatever dignity survives.', 'Pikulin emergency protocol'],
    ['Outside has been canceled until further notice.', 'Family decree'],
    ['Top Chef quickfire: create warmth using every layer in the closet. Your time starts now.', 'Top Chef-ish'],
    ['The ton has fled indoors. This is your sign.', 'Bridgerton-ish'],
    ['NEW ACHIEVEMENT: Why Are You Going Outside? Reward: one frozen face.', 'Dungeon rules'],
    ['Princess Donut has declared the outdoors beneath her. Sensible, frankly.', 'Dungeon crawler reference'],
  ],
  rain: [
    ['Add the rain shell. Wet sweater is not a personality.', 'Pikulin house rules'],
    ['Umbrella or hood. “I thought it would stop” is not a waterproofing strategy.', 'Experience speaking'],
    ['The judges dislike soggy presentation. Add a waterproof layer.', 'Top Chef-ish'],
    ['A damp promenade is still damp. Bring the umbrella, gentle wearer.', 'Bridgerton-ish'],
    ['The dungeon floor is wet. This is not a trap. Probably. Wear sensible shoes.', 'Dungeon rules'],
  ],
  windy: [
    ['The wind has opinions today. Secure the light layer and maybe the hair.', 'Pikulin advisory'],
    ['Cardigan plus wind: adorable in theory, airborne in practice.', 'Domestic aerodynamics'],
    ['The dungeon has activated aggressive ventilation. Hood recommended.', 'Dungeon rules'],
  ],
};

const WEATHER_CODES = {
  0: ['☀️', 'Clear'],
  1: ['🌤️', 'Mostly clear'],
  2: ['⛅', 'Partly cloudy'],
  3: ['☁️', 'Overcast'],
  45: ['🌫️', 'Fog'],
  48: ['🌫️', 'Rime fog'],
  51: ['🌦️', 'Light drizzle'],
  53: ['🌦️', 'Drizzle'],
  55: ['🌧️', 'Heavy drizzle'],
  56: ['🌧️', 'Freezing drizzle'],
  57: ['🌧️', 'Heavy freezing drizzle'],
  61: ['🌦️', 'Light rain'],
  63: ['🌧️', 'Rain'],
  65: ['🌧️', 'Heavy rain'],
  66: ['🌧️', 'Freezing rain'],
  67: ['🌧️', 'Heavy freezing rain'],
  71: ['🌨️', 'Light snow'],
  73: ['🌨️', 'Snow'],
  75: ['❄️', 'Heavy snow'],
  77: ['🌨️', 'Snow grains'],
  80: ['🌦️', 'Rain showers'],
  81: ['🌧️', 'Rain showers'],
  82: ['⛈️', 'Heavy showers'],
  85: ['🌨️', 'Snow showers'],
  86: ['❄️', 'Heavy snow showers'],
  95: ['⛈️', 'Thunderstorms'],
  96: ['⛈️', 'Thunderstorms with hail'],
  99: ['⛈️', 'Severe thunderstorms with hail'],
};

function $(id) { return document.getElementById(id); }
function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }
function isLocalPreview() { return ['localhost', '127.0.0.1'].includes(location.hostname); }
function cToF(c) { return (c * 9 / 5) + 32; }
function fToC(f) { return (f - 32) * 5 / 9; }
function mphToKph(mph) { return mph * 1.609344; }
function inToMm(value) { return value * 25.4; }
function mbToInHg(mb) { return mb * 0.0295299830714; }
function inHgToMb(inHg) { return inHg / 0.0295299830714; }

function deterministicPick(items, salt = '') {
  const key = `${new Date().toISOString().slice(0, 10)}-${Math.floor(new Date().getHours() / 3)}-${salt}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  return items[Math.abs(hash) % items.length];
}

function cardinal(deg) {
  if (deg == null || Number.isNaN(Number(deg))) return '—';
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(Number(deg) / 45) % 8];
}

function computeFeelsLike(tempF, humidity, windMph) {
  const t = Number(tempF);
  const rh = Number(humidity);
  const w = Number(windMph);
  if (t <= 50 && w > 3) {
    return 35.74 + (0.6215 * t) - (35.75 * Math.pow(w, 0.16)) + (0.4275 * t * Math.pow(w, 0.16));
  }
  if (t >= 80 && rh >= 40) {
    let hi = -42.379 + 2.04901523*t + 10.14333127*rh - 0.22475541*t*rh - 0.00683783*t*t - 0.05481717*rh*rh + 0.00122874*t*t*rh + 0.00085282*t*rh*rh - 0.00000199*t*t*rh*rh;
    return hi;
  }
  return t;
}

function wardrobeForConditions({ feelsF, windMph = 0, rain = 0, precipProbability = 0 }) {
  let category = 'mild';
  let emoji = '🧥';
  let title = 'A light layer earns the start.';
  if (feelsF >= 84) { category = 'hot'; emoji = '🩳'; title = 'Keep it light.'; }
  else if (feelsF >= 70) { category = 'warm'; emoji = '👕'; title = 'Easy weather. Don’t overthink it.'; }
  else if (feelsF >= 57) { category = 'mild'; emoji = '🧶'; title = 'Cardigan jurisdiction.'; }
  else if (feelsF >= 42) { category = 'chilly'; emoji = '🧥'; title = 'Jacket wins.'; }
  else if (feelsF >= 25) { category = 'cold'; emoji = '🧥🧣'; title = 'Real coat weather.'; }
  else { category = 'brutal'; emoji = '🥶'; title = 'Outside is hostile.'; }

  let lines = WARDROBE_LINES[category];
  if (rain > 0.02 || precipProbability >= 55) {
    lines = lines.concat(WARDROBE_LINES.rain);
    emoji += ' ☔';
  }
  if (windMph >= 16) lines = lines.concat(WARDROBE_LINES.windy);
  const [text, source] = deterministicPick(lines, `${Math.round(feelsF)}-${category}`);
  return { category, emoji, title, text, source };
}

function formatTempF(tempF, digits = 0) {
  if (tempF == null || Number.isNaN(Number(tempF))) return '—';
  return APP.unitSystem === 'imperial'
    ? `${Number(tempF).toFixed(digits)}°F`
    : `${fToC(Number(tempF)).toFixed(digits)}°C`;
}

function formatWindMph(mph, digits = 0) {
  if (mph == null || Number.isNaN(Number(mph))) return '—';
  return APP.unitSystem === 'imperial'
    ? `${Number(mph).toFixed(digits)} mph`
    : `${mphToKph(Number(mph)).toFixed(digits)} km/h`;
}

function formatPressureMb(mb) {
  if (mb == null || Number.isNaN(Number(mb))) return '—';
  return APP.unitSystem === 'imperial' ? `${mbToInHg(Number(mb)).toFixed(2)} inHg` : `${Number(mb).toFixed(0)} hPa`;
}

function formatRainIn(inches) {
  if (inches == null || Number.isNaN(Number(inches))) return '—';
  return APP.unitSystem === 'imperial' ? `${Number(inches).toFixed(2)} in` : `${inToMm(Number(inches)).toFixed(1)} mm`;
}

function normalizeCurrent(payload) {
  const obs = payload?.obs?.[0] || payload?.stations?.[0]?.last_ob || payload?.ob || null;
  if (!obs) throw new Error('No current observation returned.');
  if (Array.isArray(obs)) {
    return {
      timestamp: obs[0],
      wind_avg: obs[2],
      wind_gust: obs[3],
      wind_direction: obs[4],
      sea_level_pressure: obs[6],
      air_temperature: obs[7],
      relative_humidity: obs[8],
      uv: obs[10],
      solar_radiation: obs[11],
      precip: obs[12],
      precip_accum_local_day: obs[20] ?? obs[18],
      lightning_strike_count_last_3hr: obs[15],
      lightning_strike_last_distance: obs[14],
    };
  }
  return obs;
}

async function fetchCurrentWeather() {
  try {
    const response = await fetch('/api/tempest?action=current', { cache: 'no-store' });
    if (!response.ok) throw new Error((await safeJson(response))?.error || `Tempest request failed (${response.status})`);
    return normalizeCurrent(await response.json());
  } catch (error) {
    if (isLocalPreview()) return DEMO_CURRENT;
    throw error;
  }
}

async function safeJson(response) {
  try { return await response.json(); } catch { return null; }
}

function renderCurrent(obs) {
  APP.lastCurrent = obs;
  const tempF = cToF(Number(obs.air_temperature));
  const humidity = Number(obs.relative_humidity ?? 0);
  const windMps = Number(obs.wind_avg ?? 0);
  const gustMps = Number(obs.wind_gust ?? windMps);
  const windMph = windMps * 2.236936;
  const gustMph = gustMps * 2.236936;
  const feelsF = Number.isFinite(Number(obs.feels_like)) ? cToF(Number(obs.feels_like)) : computeFeelsLike(tempF, humidity, windMph);
  const rainTodayMm = Number(obs.precip_accum_local_day ?? obs.precip_accum_local_yesterday ?? 0);
  const rainTodayIn = rainTodayMm / 25.4;
  const rain1hMm = Number(obs.precip_accum_last_1hr ?? obs.precip ?? 0);

  $('liveTemp').textContent = formatTempF(tempF);
  $('liveFeels').textContent = formatTempF(feelsF);
  $('liveHumidity').textContent = `${Math.round(humidity)}%`;
  $('livePressure').textContent = formatPressureMb(obs.sea_level_pressure ?? obs.barometric_pressure ?? obs.station_pressure);
  $('liveRain').textContent = formatRainIn(rainTodayIn);
  $('windAvg').textContent = formatWindMph(windMph, 1);
  $('windDetail').textContent = `Gust ${formatWindMph(gustMph, 1)} · ${cardinal(obs.wind_direction)}`;
  $('uvIndex').textContent = obs.uv == null ? '—' : Number(obs.uv).toFixed(1);
  $('uvDetail').textContent = uvLabel(obs.uv);
  $('solarRadiation').textContent = obs.solar_radiation == null ? '—' : Math.round(Number(obs.solar_radiation));
  $('lightningCount').textContent = obs.lightning_strike_count_last_3hr ?? '0';
  $('lightningDetail').textContent = obs.lightning_strike_last_distance ? `last strike ~${Math.round(Number(obs.lightning_strike_last_distance) * 0.621371)} mi` : 'last 3 hr';
  $('liveSummary').textContent = currentSummary(feelsF, windMph, rain1hMm, humidity);
  $('liveWeatherIcon').textContent = rain1hMm > 0 ? '🌧️' : feelsF < 35 ? '❄️' : obs.solar_radiation > 500 ? '☀️' : '⛅';

  const advice = wardrobeForConditions({ feelsF, windMph, rain: rain1hMm / 25.4 });
  $('wardrobeEmoji').textContent = advice.emoji;
  $('wardrobeTitle').textContent = advice.title;
  $('wardrobeAdvice').textContent = advice.text;
  $('wardrobeSource').textContent = advice.source;

  const updated = obs.timestamp ? new Date(Number(obs.timestamp) * 1000) : new Date();
  $('liveUpdated').textContent = `Updated ${updated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  $('unitToggle').textContent = APP.unitSystem === 'imperial' ? '°F / mph' : '°C / km/h';
}

function currentSummary(feelsF, windMph, rainMm, humidity) {
  if (rainMm > 0.2) return 'Rain is being measured at the station right now.';
  if (windMph > 20) return 'Breezy enough to deserve your attention.';
  if (feelsF >= 86) return 'Warm, humid, and fully committed to summer behavior.';
  if (feelsF <= 28) return 'Cold enough that “just running out for a second” is a lie.';
  if (humidity > 78 && feelsF > 65) return 'Comfortable on paper, suspiciously muggy in practice.';
  return 'A live backyard reading from the Tempest station.';
}

function uvLabel(value) {
  const uv = Number(value);
  if (!Number.isFinite(uv)) return 'UV unavailable';
  if (uv < 3) return 'Low';
  if (uv < 6) return 'Moderate';
  if (uv < 8) return 'High';
  if (uv < 11) return 'Very high';
  return 'Extreme';
}

async function updateLiveWeather() {
  $('liveError').classList.add('hidden');
  try {
    renderCurrent(await fetchCurrentWeather());
  } catch (error) {
    $('liveError').textContent = `${error.message} The site is configured to keep the Tempest token server-side; check the Cloudflare Pages secret if this persists.`;
    $('liveError').classList.remove('hidden');
    $('liveUpdated').textContent = 'Station unavailable';
  }
}

function setTab(tabId) {
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.id === tabId));
  document.querySelectorAll('.tab-button').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
  history.replaceState(null, '', `#${tabId}`);
  if (tabId === 'radar') { loadAlerts(false); loadBeachData(false); }
  if (tabId === 'archive' && APP.archiveData.length === 0) loadArchive(APP.archiveDays);
}

document.querySelectorAll('.tab-button').forEach(button => button.addEventListener('click', () => setTab(button.dataset.tab)));

$('unitToggle').addEventListener('click', () => {
  APP.unitSystem = APP.unitSystem === 'imperial' ? 'metric' : 'imperial';
  localStorage.setItem('unitSystem', APP.unitSystem);
  if (APP.lastCurrent) renderCurrent(APP.lastCurrent);
  if (APP.archiveData.length) renderArchive(APP.archiveData, APP.archiveDays);
  if (APP.lastBeach) renderBeach(APP.lastBeach);
  if (!$('forecastGrid').hasChildNodes()) return;
  const previous = $('locationInput').dataset.lastQuery;
  if (previous) searchForecast(previous);
});

$('forecastForm').addEventListener('submit', event => {
  event.preventDefault();
  searchForecast($('locationInput').value.trim());
});

$('geoButton').addEventListener('click', () => {
  if (!navigator.geolocation) return showForecastNotice('Location services are not available in this browser.', true);
  showForecastNotice('Getting your location…');
  navigator.geolocation.getCurrentPosition(
    position => loadForecast(position.coords.latitude, position.coords.longitude, 'Your location'),
    () => showForecastNotice('Could not get your location. Try a ZIP code or city instead.', true),
    { timeout: 10000 }
  );
});

async function searchForecast(query) {
  if (!query) return;
  $('locationInput').dataset.lastQuery = query;
  showForecastNotice('Finding that location…');
  try {
    const isUsZip = /^\d{5}(?:-\d{4})?$/.test(query);
    const params = new URLSearchParams({ name: query, count: '5', language: 'en', format: 'json' });
    if (isUsZip) params.set('countryCode', 'US');
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
    if (!response.ok) throw new Error('Location search failed.');
    const data = await response.json();
    if (!data.results?.length) throw new Error('No matching location found.');
    let result = data.results[0];
    if (isUsZip) result = data.results.find(item => item.country_code === 'US') || result;
    const label = [result.name, result.admin1, result.country_code === 'US' ? result.postcodes?.[0] : result.country].filter(Boolean).join(', ');
    await loadForecast(result.latitude, result.longitude, label || query);
  } catch (error) {
    showForecastNotice(error.message || 'Could not find that location.', true);
  }
}

async function loadForecast(lat, lon, label) {
  showForecastNotice('Building the forecast…');
  const imperial = APP.unitSystem === 'imperial';
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,sunrise,sunset',
    timezone: 'auto',
    forecast_days: '7',
    temperature_unit: imperial ? 'fahrenheit' : 'celsius',
    wind_speed_unit: imperial ? 'mph' : 'kmh',
    precipitation_unit: imperial ? 'inch' : 'mm',
  });
  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!response.ok) throw new Error('Forecast service returned an error.');
    const data = await response.json();
    renderForecast(data, label);
    hideForecastNotice();
  } catch (error) {
    showForecastNotice(error.message || 'Error fetching forecast.', true);
  }
}

function renderForecast(data, label) {
  const daily = data.daily;
  if (!daily?.time?.length) return showForecastNotice('No forecast data came back for that location.', true);
  $('forecastLocation').textContent = `${label} · ${data.timezone_abbreviation || data.timezone || ''}`;
  $('forecastLocation').classList.remove('hidden');
  $('forecastGrid').innerHTML = daily.time.map((date, i) => {
    const [icon, condition] = WEATHER_CODES[daily.weather_code[i]] || ['🌡️', 'Weather'];
    const dt = new Date(`${date}T12:00:00`);
    const dayName = i === 0 ? 'Today' : dt.toLocaleDateString([], { weekday: 'short' });
    const tempUnit = APP.unitSystem === 'imperial' ? '°F' : '°C';
    const windUnit = APP.unitSystem === 'imperial' ? 'mph' : 'km/h';
    const rainUnit = APP.unitSystem === 'imperial' ? 'in' : 'mm';
    const high = daily.temperature_2m_max[i];
    const low = daily.temperature_2m_min[i];
    const apparentHigh = daily.apparent_temperature_max[i];
    const pop = daily.precipitation_probability_max[i] ?? 0;
    const wind = daily.wind_speed_10m_max[i] ?? 0;
    const rain = daily.precipitation_sum[i] ?? 0;
    const feelsF = APP.unitSystem === 'imperial' ? apparentHigh : cToF(apparentHigh);
    const windMph = APP.unitSystem === 'imperial' ? wind : wind / 1.609344;
    const rainIn = APP.unitSystem === 'imperial' ? rain : rain / 25.4;
    const advice = wardrobeForConditions({ feelsF, windMph, rain: rainIn, precipProbability: pop });
    return `
      <article class="forecast-card card ${i === 0 ? 'today' : ''}">
        <div class="forecast-day">${dayName}</div>
        <div class="forecast-icon" aria-hidden="true">${icon}</div>
        <div class="forecast-condition">${condition}</div>
        <div class="forecast-temps"><strong>${Math.round(high)}${tempUnit}</strong><span>${Math.round(low)}${tempUnit}</span></div>
        <div class="forecast-detail"><span>Rain</span><strong>${Math.round(pop)}%</strong></div>
        <div class="forecast-detail"><span>Wind</span><strong>${Math.round(wind)} ${windUnit}</strong></div>
        <div class="forecast-detail"><span>Precip</span><strong>${Number(rain).toFixed(APP.unitSystem === 'imperial' ? 2 : 1)} ${rainUnit}</strong></div>
        <p class="forecast-quip">${advice.emoji} ${advice.title}</p>
      </article>`;
  }).join('');
}

function showForecastNotice(message, error = false) {
  $('forecastNotice').textContent = message;
  $('forecastNotice').classList.toggle('error-notice', error);
  $('forecastNotice').classList.remove('hidden');
}
function hideForecastNotice() { $('forecastNotice').classList.add('hidden'); }

const rangeLabels = { 1: 'Last 24 hours', 7: 'Last 7 days', 30: 'Last 30 days', 365: 'Last year' };
document.querySelectorAll('.range-button').forEach(button => button.addEventListener('click', () => loadArchive(Number(button.dataset.days))));

async function loadArchive(days) {
  APP.archiveDays = days;
  document.querySelectorAll('.range-button').forEach(btn => btn.classList.toggle('active', Number(btn.dataset.days) === days));
  $('archiveNotice').textContent = 'Loading station observations…';
  $('archiveNotice').className = 'notice';
  $('downloadCsv').disabled = true;
  try {
    let points;
    const response = await fetch(`/api/tempest?action=archive&days=${days}`, { cache: 'no-store' });
    if (!response.ok) throw new Error((await safeJson(response))?.error || `Archive request failed (${response.status})`);
    const payload = await response.json();
    points = payload.points || [];
    if (!points.length) throw new Error('No archive observations were returned for that range.');
    APP.archiveData = points;
    renderArchive(points, days);
    $('archiveNotice').classList.add('hidden');
    $('downloadCsv').disabled = false;
  } catch (error) {
    if (isLocalPreview()) {
      const now = Date.now();
      const count = days === 1 ? 96 : days === 7 ? 168 : days === 30 ? 240 : 365;
      const step = (days * 86400000) / count;
      APP.archiveData = Array.from({ length: count }, (_, i) => ({
        timestamp: Math.floor((now - ((count - i) * step)) / 1000),
        air_temp_f: 52 + 14 * Math.sin(i / 12),
        humidity: 58 + 12 * Math.cos(i / 10),
        wind_mph: 4 + Math.abs(5 * Math.sin(i / 7)),
        gust_mph: 7 + Math.abs(7 * Math.sin(i / 7)),
        pressure_mb: 1015 + 5 * Math.cos(i / 25),
        precip_in: i % 39 === 0 ? 0.03 : 0,
      }));
      renderArchive(APP.archiveData, days);
      $('archiveNotice').textContent = 'Local preview is showing demo archive data. Production uses the Tempest API.';
      $('archiveNotice').className = 'notice';
      $('downloadCsv').disabled = false;
      return;
    }
    $('archiveNotice').textContent = error.message;
    $('archiveNotice').className = 'notice error-notice';
  }
}

function renderArchive(points, days) {
  const canvas = $('archiveChart');
  if (!window.Chart) {
    $('archiveNotice').textContent = 'Chart library did not load.';
    $('archiveNotice').className = 'notice error-notice';
    return;
  }
  $('archiveChartTitle').textContent = rangeLabels[days];
  const labels = points.map(point => new Date(point.timestamp * 1000));
  const temps = points.map(point => APP.unitSystem === 'imperial' ? point.air_temp_f : fToC(point.air_temp_f));
  const humidity = points.map(point => point.humidity);
  if (APP.archiveChart) APP.archiveChart.destroy();
  APP.archiveChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: `Temperature (${APP.unitSystem === 'imperial' ? '°F' : '°C'})`, data: temps, yAxisID: 'yTemp', borderWidth: 2, pointRadius: 0, tension: 0.2 },
        { label: 'Humidity (%)', data: humidity, yAxisID: 'yHumidity', borderWidth: 1.5, pointRadius: 0, tension: 0.2 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      scales: {
        x: {
          type: 'category',
          ticks: {
            maxTicksLimit: 9,
            callback(value) {
              const d = labels[value];
              if (!d) return '';
              return days <= 1 ? d.toLocaleTimeString([], { hour: 'numeric' }) : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
            },
          },
          grid: { display: false },
        },
        yTemp: { position: 'left', title: { display: true, text: APP.unitSystem === 'imperial' ? '°F' : '°C' } },
        yHumidity: { position: 'right', min: 0, max: 100, title: { display: true, text: '%' }, grid: { drawOnChartArea: false } },
      },
      plugins: { legend: { labels: { usePointStyle: true } } },
    },
  });

  const tempsF = points.map(p => Number(p.air_temp_f)).filter(Number.isFinite);
  const winds = points.map(p => Number(p.wind_mph)).filter(Number.isFinite);
  const gusts = points.map(p => Number(p.gust_mph)).filter(Number.isFinite);
  const precip = points.reduce((sum, p) => sum + (Number(p.precip_in) || 0), 0);
  const avgTempF = tempsF.reduce((a,b) => a+b, 0) / Math.max(tempsF.length, 1);
  $('archiveSummary').innerHTML = `
    <article class="metric-card card"><span class="metric-label">High</span><strong>${formatTempF(Math.max(...tempsF))}</strong><span class="metric-sub">selected range</span></article>
    <article class="metric-card card"><span class="metric-label">Low</span><strong>${formatTempF(Math.min(...tempsF))}</strong><span class="metric-sub">selected range</span></article>
    <article class="metric-card card"><span class="metric-label">Average</span><strong>${formatTempF(avgTempF)}</strong><span class="metric-sub">temperature</span></article>
    <article class="metric-card card"><span class="metric-label">Max gust</span><strong>${formatWindMph(Math.max(...gusts, ...winds), 1)}</strong><span class="metric-sub">selected range</span></article>
    <article class="metric-card card"><span class="metric-label">Measured rain</span><strong>${formatRainIn(precip)}</strong><span class="metric-sub">bucket accumulation</span></article>`;
}

$('downloadCsv').addEventListener('click', () => {
  if (!APP.archiveData.length) return;
  const rows = [['timestamp_local','temperature_f','humidity_pct','wind_mph','gust_mph','pressure_mb','precip_in']];
  APP.archiveData.forEach(p => rows.push([
    new Date(p.timestamp * 1000).toISOString(),
    numberOrBlank(p.air_temp_f), numberOrBlank(p.humidity), numberOrBlank(p.wind_mph), numberOrBlank(p.gust_mph), numberOrBlank(p.pressure_mb), numberOrBlank(p.precip_in)
  ]));
  const csv = rows.map(row => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pikulin-weather-${APP.archiveDays}d.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});
function numberOrBlank(v) { return Number.isFinite(Number(v)) ? Number(v) : ''; }
function csvCell(value) { const s = String(value ?? ''); return /[",\n]/.test(s) ? `"${s.replaceAll('"','""')}"` : s; }

const alertLocations = [
  { lat: 40.6, lon: -74.6, divId: 'alerts-home', updatedId: 'updated-home' },
  { lat: 39.6, lon: -74.2, divId: 'alerts-lbi', updatedId: 'updated-lbi' },
];
let alertsLoadedAt = 0;

$('refreshAlerts').addEventListener('click', () => loadAlerts(true));
async function loadAlerts(force = false) {
  if (!force && Date.now() - alertsLoadedAt < 5 * 60 * 1000) return;
  alertsLoadedAt = Date.now();
  await Promise.all(alertLocations.map(async loc => {
    const div = $(loc.divId);
    div.innerHTML = '<p class="muted">Loading alerts…</p>';
    try {
      const pointResponse = await fetch(`https://api.weather.gov/points/${loc.lat},${loc.lon}`);
      if (!pointResponse.ok) throw new Error('NOAA point lookup failed.');
      const pointData = await pointResponse.json();
      const zone = pointData.properties.forecastZone.split('/').pop();
      const alertResponse = await fetch(`https://api.weather.gov/alerts/active?zone=${zone}`);
      if (!alertResponse.ok) throw new Error('NOAA alerts lookup failed.');
      const data = await alertResponse.json();
      if (!data.features?.length) {
        div.innerHTML = '<p class="muted">No active alerts.</p>';
      } else {
        div.innerHTML = data.features.map(feature => renderAlert(feature.properties)).join('');
      }
      $(loc.updatedId).textContent = `Last checked ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    } catch (error) {
      div.innerHTML = `<div class="alert-item"><strong>Alert feed unavailable</strong><p>${escapeHtml(error.message)}</p></div>`;
    }
  }));
}

function renderAlert(alert) {
  const severity = String(alert.severity || '').toLowerCase();
  const event = String(alert.event || '').toLowerCase();
  const cls = event.includes('warning') ? 'warning' : event.includes('watch') ? 'watch' : severity;
  return `<div class="alert-item ${cls}"><strong>${escapeHtml(alert.headline || alert.event || 'Weather alert')}</strong><details><summary>Details</summary><p>${escapeHtml(alert.description || alert.instruction || 'See NOAA for details.')}</p></details></div>`;
}
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch])); }


let beachLoadedAt = 0;
$('beachVoice').value = localStorage.getItem('beachVoice') || 'random';

$('refreshBeach').addEventListener('click', () => loadBeachData(true));
$('beachVoice').addEventListener('change', () => {
  localStorage.setItem('beachVoice', $('beachVoice').value);
  if (APP.lastBeach) renderBeach(APP.lastBeach);
});

async function loadBeachData(force = false) {
  if (!force && APP.lastBeach && Date.now() - beachLoadedAt < 5 * 60 * 1000) {
    renderBeach(APP.lastBeach);
    return;
  }

  $('beachNotice').textContent = 'Checking Marine Street weather, surf, tide, and ocean data…';
  $('beachNotice').className = 'notice';

  try {
    const response = await fetch('/api/beach', { cache: 'no-store' });
    const payload = await safeJson(response);
    if (!response.ok) throw new Error(payload?.error || `Beach data request failed (${response.status})`);
    beachLoadedAt = Date.now();
    APP.lastBeach = payload;
    renderBeach(payload);

    if (payload.errors?.length) {
      $('beachNotice').textContent = `Most beach data is live. A feed is temporarily unavailable: ${payload.errors.join(' · ')}`;
      $('beachNotice').className = 'notice';
    } else {
      $('beachNotice').classList.add('hidden');
    }
  } catch (error) {
    $('beachNotice').textContent = error.message || 'Beach data is temporarily unavailable.';
    $('beachNotice').className = 'notice error-notice';
  }
}

function renderBeach(data) {
  APP.lastBeach = data;
  const current = data.weather?.current || {};
  const today = data.weather?.today || {};
  const surf = data.surf?.today || {};
  const ocean = data.ocean || {};
  const tideEvents = data.tide?.events || [];

  const [icon, condition] = WEATHER_CODES[current.weatherCode] || ['🏖️', 'Beach conditions'];
  const rainChance = finiteOr(current.precipProbability, today.precipProbabilityMax);
  const windMph = finiteOr(current.windMph, today.windMphMax);
  const gustMph = finiteOr(today.windGustMphMax, current.windGustMph);

  $('beachNowIcon').textContent = icon;
  $('beachNowTitle').textContent = surf.weather || condition;
  $('beachAirTemp').textContent = formatTempF(current.temperatureF);
  $('beachFeelsTemp').textContent = formatTempF(current.apparentTemperatureF);
  $('beachRainChance').textContent = rainChance == null ? '—' : `${Math.round(rainChance)}%`;
  $('beachWindNow').textContent = formatWindMph(windMph);

  const summaryBits = [];
  if (today.highF != null) summaryBits.push(`High ${formatTempF(today.highF)}`);
  if (rainChance != null) summaryBits.push(`${Math.round(rainChance)}% rain chance`);
  if (surf.surfHeight) summaryBits.push(`surf ${surf.surfHeight.toLowerCase()}`);
  if (surf.ripCurrentRisk) summaryBits.push(`${surf.ripCurrentRisk.toLowerCase()} rip-current risk`);
  $('beachNowSummary').textContent = summaryBits.length
    ? `${summaryBits.join(' · ')}.`
    : 'Live beach conditions for Marine Street are partially available.';

  const next = nextTide(tideEvents);
  if (next) {
    $('beachNextTide').textContent = `${next.type} ${formatTideTime(next.time)}`;
    $('beachTideDetail').textContent = `${formatTideHeight(next.heightFt)} · MLLW · ~${data.tide?.distanceMilesApprox || 1.2} mi`;
  } else {
    $('beachNextTide').textContent = '—';
    $('beachTideDetail').textContent = 'Beach Haven Coast Guard Station';
  }

  const nwsWaterF = parseWaterTempF(surf.waterTemperature);
  const waterF = finiteOr(nwsWaterF, ocean.waterTemperatureF);
  $('beachWaterTemp').textContent = formatTempF(waterF);
  $('beachWaterDetail').textContent = surf.waterTemperature
    ? `NWS LBI: ${surf.waterTemperature}`
    : ocean.observed ? `Buoy 44091 · ${timeAgo(ocean.observed)}` : 'Long Beach Island surf zone';

  $('beachWaves').textContent = formatWaveHeight(ocean.waveHeightFt);
  const waveBits = [];
  if (ocean.dominantPeriodSec != null) waveBits.push(`${Math.round(ocean.dominantPeriodSec)} s period`);
  if (ocean.waveDirectionDeg != null) waveBits.push(`${cardinal(ocean.waveDirectionDeg)} swell`);
  $('beachWaveDetail').textContent = waveBits.length
    ? `${waveBits.join(' · ')} · buoy ~${ocean.distanceMilesApprox || 29} mi offshore`
    : 'NOAA buoy 44091';

  $('beachRipRisk').textContent = surf.ripCurrentRisk || '—';
  $('beachRipDetail').textContent = surf.surfHeight ? `Surf ${surf.surfHeight}` : 'NWS Long Beach Island';

  const uv = finiteOr(today.uvIndexMax, current.uvIndex);
  $('beachUV').textContent = uv == null ? (surf.uvIndex || '—') : Number(uv).toFixed(1);
  $('beachUVDetail').textContent = uv == null ? (surf.uvIndex || 'NWS / Marine St') : `${uvLabel(uv)} · daily maximum`;

  $('beachWind').textContent = formatWindMph(today.windMphMax ?? current.windMph);
  const windDetails = [];
  if (current.windDirectionDeg != null) windDetails.push(cardinal(current.windDirectionDeg));
  if (gustMph != null) windDetails.push(`gusts to ${formatWindMph(gustMph)}`);
  $('beachWindDetail').textContent = windDetails.length ? windDetails.join(' · ') : (surf.winds || 'Marine St point forecast');

  renderTideStrip(tideEvents);
  renderBeachAdvisory(data, { rainChance, windMph, gustMph, waterF, uv });

  const updated = data.updated ? new Date(data.updated) : new Date();
  $('updated-beach').textContent = `Updated ${updated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · tide: NOAA 8534208 · surf: NWS PHI · waves: NOAA 44091`;
}

function renderTideStrip(events) {
  const strip = $('beachTideStrip');
  if (!events?.length) {
    strip.innerHTML = '<p class="muted">Tide predictions are temporarily unavailable.</p>';
    return;
  }
  strip.innerHTML = events.slice(0, 8).map(event => `
    <div class="tide-event">
      <span>${escapeHtml(tideDayLabel(event.time))}</span>
      <strong>${escapeHtml(event.type)} · ${escapeHtml(formatTideTime(event.time))}</strong>
      <small>${escapeHtml(formatTideHeight(event.heightFt))} MLLW</small>
    </div>`).join('');
}

function renderBeachAdvisory(data, context) {
  const current = data.weather?.current || {};
  const today = data.weather?.today || {};
  const surf = data.surf?.today || {};
  const rip = String(surf.ripCurrentRisk || '').toLowerCase();
  const thunder = String(surf.thunderstormPotential || '').toLowerCase();
  const rainChance = finiteOr(context.rainChance, 0);
  const gust = finiteOr(context.gustMph, 0);
  const uv = finiteOr(context.uv, 0);
  const highF = finiteOr(today.apparentHighF, today.highF, current.apparentTemperatureF, current.temperatureF);
  const waterF = context.waterF;

  let title = 'A workable beach day with a few caveats.';
  if (rip.includes('high')) title = 'Good sand day. Skip the surf.';
  else if (thunder && !thunder.includes('none')) title = 'Beach day with an exit plan.';
  else if (rainChance >= 60) title = 'Beach window, not an all-day lock.';
  else if (gust >= 28) title = 'Windy setup. Keep the beach gear low-profile.';
  else if (highF != null && highF >= 75 && rainChance < 40 && gust < 22) title = 'Marine Street looks beach-worthy.';
  else if (highF != null && highF < 68) title = 'Beach walk weather more than bake-on-the-sand weather.';

  const gear = beachGear({ highF, rainChance, gust, uv, waterF, rip, thunder });
  $('beachGear').innerHTML = gear.map(item => `<span class="gear-chip">${escapeHtml(item)}</span>`).join('');

  const factBits = [];
  if (today.highF != null) factBits.push(`High around ${formatTempF(today.highF)}`);
  if (rainChance != null) factBits.push(`${Math.round(rainChance)}% rain chance`);
  if (surf.surfHeight) factBits.push(`surf ${surf.surfHeight.toLowerCase()}`);
  if (surf.ripCurrentRisk) factBits.push(`${surf.ripCurrentRisk.toLowerCase()} rip-current risk`);
  if (gust > 0) factBits.push(`gusts near ${formatWindMph(gust)}`);
  const facts = factBits.length ? `${factBits.join(', ')}.` : 'The beach feeds are giving us a partial report today.';

  const requestedVoice = $('beachVoice').value || 'random';
  const voice = requestedVoice === 'random'
    ? deterministicPick(['pikulin', 'dungeon', 'pirate', 'sponge', 'squid'], 'marine-st-beach-voice')
    : requestedVoice;

  $('beachAdvisoryTitle').textContent = title;
  $('beachAdvisoryText').textContent = beachVoiceLine(voice, facts, gear, { rip, thunder, gust });
  $('beachAdvisorySource').textContent = `${beachVoiceName(voice)} · safety calls still come from NWS / NOAA`;
}

function beachGear({ highF, rainChance, gust, uv, waterF, rip, thunder }) {
  const items = ['Water'];
  if (uv >= 3) items.push('SPF / sunscreen');
  if (uv >= 6) items.push('Hat + real shade');

  if (gust >= 28) items.push('Skip loose umbrellas / canopies');
  else if (gust >= 20) items.push('Low-profile shade + serious sand anchor');
  else items.push('Beach umbrella + sand anchor');

  if (rainChance >= 35) items.push('Rain shell / compact umbrella');
  if (highF != null && highF < 73) items.push('Light layer / hoodie');
  if (waterF != null && waterF < 70) items.push('Extra dry towel / warm layer');

  if (rip.includes('high')) items.push('Stay out of the surf');
  else if (rip.includes('moderate')) items.push('Swim near a lifeguard');

  if (thunder && !thunder.includes('none')) items.push('Fast exit plan for thunder');
  return [...new Set(items)];
}

function beachVoiceLine(voice, facts, gear, context) {
  const pack = gear.slice(0, 3).join(', ').toLowerCase();
  const safety = context.rip.includes('high')
    ? 'The ocean has veto power today, so keep the swimming out of the plan.'
    : context.thunder && !context.thunder.includes('none')
      ? 'Keep the sky on a short leash and be ready to leave.'
      : context.gust >= 28
        ? 'Anything light and sail-shaped is volunteering for a trip down the beach.'
        : '';

  const lines = {
    pikulin: `Marine Street report: ${facts} Bring ${pack}. ${safety}`.trim(),
    dungeon: `NEW ACHIEVEMENT: BEACH LOGISTICS. ${facts} Your loadout requires ${pack}. ${safety}`.trim(),
    pirate: `Arrr, the Marine Street report says: ${facts} Stow ${pack}, matey. ${safety}`.trim(),
    sponge: `Marine Street is looking pretty cheerful: ${facts} Beach-bag mission: ${pack}. ${safety}`.trim(),
    squid: `Ah, yes. Sand, but with additional meteorology. ${facts} Bring ${pack} and try not to donate it to the wind. ${safety}`.trim(),
  };
  return lines[voice] || lines.pikulin;
}

function beachVoiceName(voice) {
  return ({
    pikulin: 'Pikulin',
    dungeon: 'Dungeon AI-ish',
    pirate: 'Pirate',
    sponge: 'SpongeBob-ish',
    squid: 'Squidward-ish',
  })[voice] || 'Pikulin';
}

function parseWaterTempF(text) {
  if (!text) return null;
  const exact = String(text).match(/\b(\d{2,3})\s*(?:degrees?|°)?\b/i);
  if (exact) return Number(exact[1]);
  const range = String(text).match(/\b(lower|low|mid|middle|upper|high)\s+(\d{2})s\b/i);
  if (!range) return null;
  const base = Number(range[2]);
  const offset = /lower|low/i.test(range[1]) ? 2 : /upper|high/i.test(range[1]) ? 8 : 5;
  return base + offset;
}

function nextTide(events) {
  if (!events?.length) return null;
  const now = Date.now();
  return events.find(event => tideDate(event.time)?.getTime() >= now) || events[0];
}

function tideDate(value) {
  if (!value) return null;
  const parsed = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatTideTime(value) {
  const date = tideDate(value);
  return date ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—';
}

function tideDayLabel(value) {
  const date = tideDate(value);
  if (!date) return '';
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Today';
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTideHeight(feet) {
  if (feet == null || Number.isNaN(Number(feet))) return '—';
  return APP.unitSystem === 'imperial'
    ? `${Number(feet).toFixed(1)} ft`
    : `${(Number(feet) * 0.3048).toFixed(2)} m`;
}

function formatWaveHeight(feet) {
  if (feet == null || Number.isNaN(Number(feet))) return '—';
  return APP.unitSystem === 'imperial'
    ? `${Number(feet).toFixed(1)} ft`
    : `${(Number(feet) * 0.3048).toFixed(1)} m`;
}

function finiteOr(...values) {
  for (const value of values) {
    if (value != null && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function timeAgo(iso) {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return 'recent observation';
  const minutes = Math.max(0, Math.round((Date.now() - when.getTime()) / 60000));
  if (minutes < 2) return 'just updated';
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)} hr ago`;
}

$('drawingImg').addEventListener('error', () => {
  $('drawingImg').classList.add('hidden');
  $('drawingFallback').classList.remove('hidden');
});
$('drawingImg').src = `${$('drawingImg').src}&t=${Date.now()}`;

function boot() {
  const requestedTab = location.hash.replace('#','');
  if (document.getElementById(requestedTab)?.classList.contains('tab-panel')) setTab(requestedTab);
  $('unitToggle').textContent = APP.unitSystem === 'imperial' ? '°F / mph' : '°C / km/h';
  updateLiveWeather();
  loadAlerts(false);
  setInterval(updateLiveWeather, 5 * 60 * 1000);
}

boot();
