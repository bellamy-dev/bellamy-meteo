export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, signal, cache = 'default' } = {}) {
  const headers = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';

  let response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      cache,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new ApiError(
      navigator.onLine === false
        ? 'Vous êtes hors ligne. Vérifiez votre connexion.'
        : 'Le serveur est injoignable. Réessayez dans un instant.',
      0,
    );
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Une réponse vide ou non-JSON sera signalée ci-dessous.
  }

  if (!response.ok) {
    throw new ApiError(
      typeof data?.error === 'string' ? data.error : 'Une erreur est survenue.',
      response.status,
    );
  }

  return data;
}

export function searchCities(query, signal) {
  return request(`/api/search?q=${encodeURIComponent(query)}`, { signal });
}

export function getWeather(latitude, longitude, { signal, cache } = {}) {
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
  });
  return request(`/api/weather?${params.toString()}`, { signal, cache });
}

export function listCities() {
  return request('/api/cities');
}

export function addCity(city) {
  return request('/api/cities', {
    method: 'POST',
    body: {
      name: city.name,
      country: city.country ?? null,
      latitude: city.latitude,
      longitude: city.longitude,
    },
  });
}

export function removeCity(id) {
  return request(`/api/cities?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}
