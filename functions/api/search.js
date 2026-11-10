import {
  CACHE_SECONDS,
  apiError,
  cacheMatch,
  cachePut,
  cleanRequiredText,
  fetchUpstream,
  json,
} from './_lib.js';

const GEOCODING_ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search';

export async function onRequestGet(context) {
  const { request } = context;
  const q = cleanRequiredText(new URL(request.url).searchParams.get('q') ?? '', 80);

  if (!q) {
    return apiError(400, 'Le paramètre « q » est requis (1 à 80 caractères).');
  }

  const upstream = new URL(GEOCODING_ENDPOINT);
  upstream.searchParams.set('name', q);
  upstream.searchParams.set('count', '5');
  upstream.searchParams.set('language', 'fr');
  upstream.searchParams.set('format', 'json');

  const cacheKey = upstream.toString();
  const cached = await cacheMatch(context, cacheKey);
  if (cached) return cached;

  let upstreamResponse;
  try {
    upstreamResponse = await fetchUpstream(upstream);
  } catch {
    return apiError(502, 'Le service de recherche est momentanément indisponible.');
  }

  if (!upstreamResponse.ok) {
    return apiError(502, 'Le service de recherche est momentanément indisponible.');
  }

  let payload;
  try {
    payload = await upstreamResponse.json();
  } catch {
    return apiError(502, 'Réponse du service de recherche invalide.');
  }

  // L'API omet complètement `results` quand aucune ville ne correspond.
  const rawResults = Array.isArray(payload?.results) ? payload.results : [];
  const results = rawResults
    .slice(0, 5)
    .map((item) => {
      const latitude = Number(item?.latitude);
      const longitude = Number(item?.longitude);
      const name = cleanRequiredText(item?.name, 100);
      if (!name) return null;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
      return {
        name,
        admin1: typeof item.admin1 === 'string' ? item.admin1.slice(0, 100) : null,
        country: typeof item.country === 'string' ? item.country.slice(0, 100) : null,
        latitude: Math.round(latitude * 1e4) / 1e4,
        longitude: Math.round(longitude * 1e4) / 1e4,
      };
    })
    .filter(Boolean);

  const response = json(results, {
    headers: {
      'cache-control': `public, max-age=${CACHE_SECONDS}`,
    },
  });

  cachePut(context, cacheKey, response);
  return response;
}
