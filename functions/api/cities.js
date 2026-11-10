import {
  apiError,
  cleanOptionalText,
  cleanRequiredText,
  coordinateFromBody,
  json,
  readJsonBody,
} from './_lib.js';

const NO_STORE = { 'cache-control': 'no-store' };

function database(context) {
  return context.env?.DB ?? null;
}

function cleanCountry(value) {
  if (value === undefined || value === null || value === '') return null;
  return cleanOptionalText(value, 80);
}

export async function onRequestGet(context) {
  const db = database(context);
  if (!db) return apiError(500, 'La base de données est indisponible.');

  try {
    const { results } = await db
      .prepare('SELECT id, name, country, latitude, longitude FROM cities ORDER BY id ASC')
      .all();
    return json(results ?? [], { headers: NO_STORE });
  } catch (error) {
    console.error('cities GET failed', error);
    return apiError(500, 'Impossible de charger les favoris.');
  }
}

export async function onRequestPost(context) {
  const db = database(context);
  if (!db) return apiError(500, 'La base de données est indisponible.');

  const parsed = await readJsonBody(context.request);
  if (parsed.error) return parsed.error;
  const body = parsed.body;

  const name = cleanRequiredText(body.name, 80);
  const latitude = coordinateFromBody(body.latitude, -90, 90);
  const longitude = coordinateFromBody(body.longitude, -180, 180);
  const country = cleanCountry(body.country);

  if (!name) {
    return apiError(400, 'Le nom de la ville doit contenir entre 1 et 80 caractères.');
  }
  if (body.country !== undefined && body.country !== null && body.country !== '' && country === null) {
    return apiError(400, 'Le pays doit être une chaîne de 80 caractères maximum.');
  }
  if (latitude === null || longitude === null) {
    return apiError(400, 'Coordonnées invalides.');
  }

  try {
    const insertion = await db
      .prepare(
        'INSERT INTO cities (name, country, latitude, longitude) VALUES (?, ?, ?, ?) ON CONFLICT(latitude, longitude) DO NOTHING',
      )
      .bind(name, country, latitude, longitude)
      .run();

    const row = await db
      .prepare(
        'SELECT id, name, country, latitude, longitude FROM cities WHERE latitude = ? AND longitude = ?',
      )
      .bind(latitude, longitude)
      .first();

    if (!row) return apiError(500, 'Impossible d’enregistrer le favori.');

    const created = Number(insertion?.meta?.changes) > 0;
    return json(row, {
      status: created ? 201 : 200,
      headers: NO_STORE,
    });
  } catch (error) {
    console.error('cities POST failed', error);
    return apiError(500, 'Impossible d’enregistrer le favori.');
  }
}

export async function onRequestDelete(context) {
  const db = database(context);
  if (!db) return apiError(500, 'La base de données est indisponible.');

  const rawId = new URL(context.request.url).searchParams.get('id');
  if (!rawId || !/^[1-9]\d{0,15}$/.test(rawId)) {
    return apiError(400, 'Identifiant de favori invalide.');
  }
  const id = Number(rawId);
  if (!Number.isSafeInteger(id)) {
    return apiError(400, 'Identifiant de favori invalide.');
  }

  try {
    const deletion = await db.prepare('DELETE FROM cities WHERE id = ?').bind(id).run();
    if (Number(deletion?.meta?.changes) === 0) {
      return apiError(404, 'Favori introuvable.');
    }
    return json({ ok: true, id }, { headers: NO_STORE });
  } catch (error) {
    console.error('cities DELETE failed', error);
    return apiError(500, 'Impossible de supprimer le favori.');
  }
}

export async function onRequest() {
  return apiError(405, 'Méthode non autorisée.', { allow: 'GET, POST, DELETE' });
}
