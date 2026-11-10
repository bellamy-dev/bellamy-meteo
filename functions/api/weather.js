import {
  CACHE_SECONDS,
  apiError,
  cacheMatch,
  cachePut,
  coordinateFromQuery,
  fetchUpstream,
} from './_lib.js';

const FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

export async function onRequestGet(context) {
  const { request } = context;
  const searchParams = new URL(request.url).searchParams;

  const latitude = coordinateFromQuery(searchParams.get('lat'), -90, 90);
  const longitude = coordinateFromQuery(searchParams.get('lon'), -180, 180);

  if (latitude === null || longitude === null) {
    return apiError(400, 'Des coordonnées « lat » et « lon » valides sont requises.');
  }

  const upstream = new URL(FORECAST_ENDPOINT);
  upstream.searchParams.set('latitude', latitude.toFixed(4));
  upstream.searchParams.set('longitude', longitude.toFixed(4));
  upstream.searchParams.set('timezone', 'auto');
  upstream.searchParams.set('forecast_days', '7');
  upstream.searchParams.set(
    'current',
    'temperature_2m,apparent_temperature,relative_humidity_2m,is_day,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,visibility,precipitation,cloud_cover',
  );
  upstream.searchParams.set(
    'hourly',
    'temperature_2m,weather_code,precipitation_probability,is_day',
  );
  upstream.searchParams.set(
    'daily',
    'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max',
  );
  upstream.searchParams.set('temperature_unit', 'celsius');
  upstream.searchParams.set('wind_speed_unit', 'kmh');
  upstream.searchParams.set('precipitation_unit', 'mm');

  const cacheKey = upstream.toString();
  const cached = await cacheMatch(context, cacheKey);
  if (cached) return cached;

  let upstreamResponse;
  try {
    upstreamResponse = await fetchUpstream(upstream);
  } catch {
    return apiError(502, 'Le service météo est momentanément indisponible.');
  }

  if (!upstreamResponse.ok) {
    return apiError(502, 'Le service météo est momentanément indisponible.');
  }

  let raw;
  try {
    raw = await upstreamResponse.text();
    JSON.parse(raw);
  } catch {
    return apiError(502, 'Réponse du service météo invalide.');
  }

  const response = new Response(raw, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${CACHE_SECONDS}`,
      'x-content-type-options': 'nosniff',
    },
  });

  cachePut(context, cacheKey, response);
  return response;
}
