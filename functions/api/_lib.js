export const USER_AGENT =
  'BellamyMeteo/1.0 (+https://bellamy-meteo.bellamy.stream)';

export const CACHE_SECONDS = 600;

const JSON_TYPE = 'application/json; charset=utf-8';

export function json(data, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': JSON_TYPE,
      'x-content-type-options': 'nosniff',
      ...headers,
    },
  });
}

export function apiError(status, message, headers = {}) {
  return json({ error: message }, {
    status,
    headers: {
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

/** Nettoie un texte obligatoire : chaîne, 1..max caractères, sans caractères de contrôle. */
export function cleanRequiredText(value, maxLength) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/\s+/g, ' ');
  if (!cleaned || cleaned.length > maxLength) return null;
  if (/[\u0000-\u001f\u007f]/.test(cleaned)) return null;
  return cleaned;
}

export function cleanOptionalText(value, maxLength) {
  if (value === undefined || value === null || value === '') return null;
  return cleanRequiredText(value, maxLength);
}

/** Coordonnée issue de la query string (donc forcément une chaîne). */
export function coordinateFromQuery(value, min, max) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) return null;
  return Math.round(number * 1e4) / 1e4;
}

/** Coordonnée issue d'un corps JSON : le type doit être un nombre strict. */
export function coordinateFromBody(value, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < min || value > max) return null;
  return Math.round(value * 1e4) / 1e4;
}

export async function readJsonBody(request) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return { error: apiError(415, 'Le corps doit être au format JSON.') };
  }

  let raw;
  try {
    raw = await request.text();
  } catch {
    return { error: apiError(400, 'Corps de requête illisible.') };
  }

  if (raw.length === 0) {
    return { error: apiError(400, 'Corps de requête vide.') };
  }
  if (raw.length > 8_192) {
    return { error: apiError(413, 'Corps de requête trop volumineux.') };
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return { error: apiError(400, 'JSON invalide.') };
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: apiError(400, 'Un objet JSON est attendu.') };
  }

  return { body };
}

export async function fetchUpstream(url, { timeout = 8_000 } = {}) {
  return fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': USER_AGENT,
    },
    signal: AbortSignal.timeout(timeout),
    cf: { cacheTtl: CACHE_SECONDS, cacheEverything: false },
  });
}

/** Cache edge de 10 minutes, silencieusement ignoré si indisponible en local. */
export async function cacheMatch(context, key) {
  try {
    if (typeof caches === 'undefined' || !caches.default) return null;
    return await caches.default.match(new Request(key, { method: 'GET' }));
  } catch {
    return null;
  }
}

export function cachePut(context, key, response) {
  try {
    if (typeof caches === 'undefined' || !caches.default) return;
    context.waitUntil(
      caches.default
        .put(new Request(key, { method: 'GET' }), response.clone())
        .catch(() => {}),
    );
  } catch {
    // Le cache est un bonus : la réponse reste valide sans lui.
  }
}
