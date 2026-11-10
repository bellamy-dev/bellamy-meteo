import './style.css';
import * as api from './api.js';
import {
  coordinateKey,
  formatClock,
  formatTemp,
  formatTempAria,
  getWeather,
  samePlace,
} from './weather.js';
import { initScene, updateScene } from './scene.js';
import { chevronRightIcon, starIcon } from './icons.js';
import {
  errorView,
  escapeHtml,
  favoritesView,
  weatherView,
} from './view.js';

const DEFAULT_PLACE = Object.freeze({
  name: 'Paris',
  admin1: 'Île-de-France',
  country: 'France',
  latitude: 48.8566,
  longitude: 2.3522,
});

const content = document.getElementById('content');
const searchEl = document.getElementById('search');
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const searchPanel = document.getElementById('search-panel');
const searchResults = document.getElementById('search-results');
const searchStatus = document.getElementById('search-status');
const searchClear = document.getElementById('search-clear');
const locateButton = document.getElementById('locate-button');
const offlineBanner = document.getElementById('offline-banner');
const footerUpdated = document.getElementById('footer-updated');
const appStatus = document.getElementById('app-status');
const toast = document.getElementById('toast');

const SKELETON = content.innerHTML;

const state = {
  units: readUnits(),
  place: null,
  weather: null,
  favorites: [],
  favoriteTemps: new Map(),
  favoriteTempsRequest: 0,
  favoritesLoading: true,
  favoritesError: false,
  favoritesRevision: 0,
  favoriteBusy: false,
  removingIds: new Set(),
  loading: true,
  error: null,
  lastAttempt: null,
  hasLoadedOnce: false,
  loadToken: 0,
  userNavToken: 0,
};

const searchState = {
  query: '',
  results: [],
  loading: false,
  error: null,
  open: false,
  activeIndex: -1,
  requestId: 0,
};

let searchTimer = 0;
let searchAbort = null;
let toastTimer = 0;
let enterTimer = 0;
let announceTimer = 0;

init();

function init() {
  syncUnitButtons();
  initScene();
  bindEvents();
  updateNetworkStatus();
  loadFavorites();

  const saved = readSavedPlace();
  if (saved) {
    loadPlace(saved, { initial: true });
  } else {
    loadPlace(DEFAULT_PLACE, { initial: true });
    window.setTimeout(() => {
      requestFirstLaunchGeolocation();
    }, 500);
  }
}

function bindEvents() {
  document.querySelectorAll('[data-units]').forEach((button) => {
    button.addEventListener('click', () => applyUnits(button.dataset.units));
  });

  searchInput.addEventListener('input', handleSearchInput);
  searchInput.addEventListener('focus', handleSearchFocus);
  searchInput.addEventListener('keydown', handleSearchKeydown);
  searchForm.addEventListener('submit', handleSearchSubmit);
  searchClear.addEventListener('click', clearSearch);
  locateButton.addEventListener('click', locateUser);

  document.addEventListener('click', handleDocumentClick);
  window.addEventListener('offline', updateNetworkStatus);
  window.addEventListener('online', handleOnline);
}

function handleDocumentClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;

  const actionElement = target.closest('[data-action]');
  if (actionElement) handleAction(actionElement);

  if (!searchEl.contains(target) && searchState.open) {
    closeSearch({ clear: false });
  }
}

function handleAction(element) {
  const action = element.dataset.action;
  switch (action) {
    case 'pick-city': {
      const index = Number(element.dataset.index);
      if (Number.isInteger(index)) selectSearchResult(index);
      break;
    }
    case 'toggle-favorite':
      toggleFavorite();
      break;
    case 'open-favorite': {
      const id = Number(element.dataset.id);
      if (Number.isSafeInteger(id)) openFavorite(id);
      break;
    }
    case 'remove-favorite': {
      const id = Number(element.dataset.id);
      if (Number.isSafeInteger(id)) {
        const favorite = state.favorites.find((item) => item.id === id);
        if (favorite) deleteFavorite(favorite);
      }
      break;
    }
    case 'retry':
      retryCurrent();
      break;
    case 'retry-favorites':
      loadFavorites({ quiet: false });
      break;
    case 'retry-search':
      if (searchInput.value.trim().length >= 2) executeSearch(searchInput.value.trim());
      break;
    case 'focus-search':
      searchInput.focus({ preventScroll: true });
      scrollToTop(true);
      break;
    default:
      break;
  }
}

function applyUnits(units) {
  if (units !== 'metric' && units !== 'imperial') return;
  if (state.units === units) return;
  state.units = units;
  writeUnits(units);
  syncUnitButtons();
  if (state.weather) render({ animate: false });
}

function syncUnitButtons() {
  document.querySelectorAll('[data-units]').forEach((button) => {
    const active = button.dataset.units === state.units;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

async function loadPlace(place, { initial = false, silent = false, userInitiated = false } = {}) {
  const normalized = normalizePlace(place);
  if (!normalized) {
    showToast('Ce lieu est invalide.', 'error');
    return;
  }

  if (userInitiated) state.userNavToken += 1;

  const token = ++state.loadToken;
  state.lastAttempt = normalized;
  state.error = null;
  state.loading = true;

  if (!silent) {
    showSkeleton();
  } else {
    content.setAttribute('aria-busy', 'true');
  }

  try {
    const data = await api.getWeather(normalized.latitude, normalized.longitude);
    if (token !== state.loadToken) return;
    if (!isWeatherPayloadValid(data)) {
      throw new api.ApiError('Les données météo reçues sont incomplètes.', 502);
    }

    const changedPlace = !state.place || !samePlace(state.place, normalized);
    state.weather = data;
    state.place = normalized;
    state.loading = false;
    state.hasLoadedOnce = true;
    savePlace(normalized);

    const temp = Number(data.current?.temperature_2m);
    if (Number.isFinite(temp)) {
      state.favoriteTemps.set(
        coordinateKey(normalized.latitude, normalized.longitude),
        temp,
      );
    }

    render({ animate: initial || changedPlace });
    updateScene(data);
    content.setAttribute('aria-busy', 'false');
    announce(`${normalized.name}, ${formatTempAria(temp, state.units)}, ${getWeather(data.current?.weather_code).label}.`);
  } catch (error) {
    if (token !== state.loadToken) return;
    if (error?.name === 'AbortError') return;
    state.loading = false;
    state.error = error;

    if (silent && state.weather) {
      content.setAttribute('aria-busy', 'false');
      showToast('La météo n’a pas pu être actualisée.', 'error');
      announce('La météo n’a pas pu être actualisée.');
      return;
    }

    renderError(error);
  } finally {
    if (token === state.loadToken) content.setAttribute('aria-busy', 'false');
  }
}

function render({ animate = false } = {}) {
  const previousScroll = content.querySelector('.hourly-scroll')?.scrollLeft ?? 0;
  content.innerHTML = weatherView(state);
  content.setAttribute('aria-busy', 'false');
  content.classList.remove('is-entering');

  if (animate) {
    void content.offsetWidth;
    content.classList.add('is-entering');
    window.clearTimeout(enterTimer);
    enterTimer = window.setTimeout(() => content.classList.remove('is-entering'), 1_250);
  }

  const current = state.weather?.current;
  footerUpdated.textContent = current?.time
    ? `Actualisé à ${formatClock(current.time)} · heure locale`
    : '';
  document.title = state.weather
    ? `${formatTemp(current?.temperature_2m, state.units)} · ${state.place.name} — Bellamy Météo`
    : 'Bellamy Météo';

  updateFavoriteButtonState();

  requestAnimationFrame(() => {
    const scroller = content.querySelector('.hourly-scroll');
    if (scroller && previousScroll > 0) scroller.scrollLeft = previousScroll;
  });
}

function showSkeleton() {
  content.innerHTML = SKELETON;
  content.setAttribute('aria-busy', 'true');
  content.classList.remove('is-entering');
  footerUpdated.textContent = '';
  document.title = 'Chargement — Bellamy Météo';
}

function renderError(error) {
  content.innerHTML = errorView({
    message: errorMessage(error),
    placeName: state.lastAttempt?.name,
  });
  content.setAttribute('aria-busy', 'false');
  content.classList.remove('is-entering');
  footerUpdated.textContent = '';
  document.title = 'Météo indisponible — Bellamy Météo';
  announce(errorMessage(error));
}

function errorMessage(error) {
  if (navigator.onLine === false) {
    return 'Vous êtes hors ligne. Vérifiez votre connexion puis réessayez.';
  }
  if (error?.status === 429) {
    return 'Trop de demandes en peu de temps. Patientez un instant avant de réessayer.';
  }
  if (error?.status === 502 || error?.status === 503) {
    return 'Le service météo est momentanément indisponible. Réessayez dans quelques instants.';
  }
  if (error?.status >= 500) {
    return 'Le serveur rencontre un problème. Réessayez dans quelques instants.';
  }
  return error?.message || 'Une erreur inattendue est survenue.';
}

function retryCurrent() {
  if (state.loading) return;
  loadPlace(state.lastAttempt || DEFAULT_PLACE, { userInitiated: true });
}

function normalizePlace(value) {
  if (!value || typeof value !== 'object') return null;
  if (typeof value.name !== 'string') return null;
  const name = value.name.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) return null;
  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  return {
    name,
    admin1: cleanShortString(value.admin1),
    country: cleanShortString(value.country),
    latitude: Math.round(latitude * 1e4) / 1e4,
    longitude: Math.round(longitude * 1e4) / 1e4,
  };
}

function cleanShortString(value) {
  if (typeof value !== 'string') return null;
  const clean = value.trim().replace(/\s+/g, ' ');
  return clean ? clean.slice(0, 100) : null;
}

function normalizeFavorite(value) {
  if (!value || typeof value !== 'object') return null;
  const id = Number(value.id);
  if (!Number.isSafeInteger(id) || id < 1) return null;
  const place = normalizePlace(value);
  if (!place) return null;
  return { id, ...place };
}

function isWeatherPayloadValid(data) {
  if (!data || typeof data !== 'object') return false;
  if (!data.current || !Number.isFinite(Number(data.current.temperature_2m))) return false;
  if (!Array.isArray(data.hourly?.time) || data.hourly.time.length === 0) return false;
  if (!Array.isArray(data.daily?.time) || data.daily.time.length === 0) return false;
  return true;
}

function savePlace(place) {
  try {
    localStorage.setItem('bm:place', JSON.stringify(place));
  } catch {
    // Le stockage local peut être indisponible en navigation privée.
  }
}

function readSavedPlace() {
  try {
    const raw = localStorage.getItem('bm:place');
    if (!raw) return null;
    return normalizePlace(JSON.parse(raw));
  } catch {
    return null;
  }
}

function readUnits() {
  try {
    return localStorage.getItem('bm:units') === 'imperial' ? 'imperial' : 'metric';
  } catch {
    return 'metric';
  }
}

function writeUnits(units) {
  try {
    localStorage.setItem('bm:units', units);
  } catch {
    // Sans stockage, les unités restent valables pour la session.
  }
}

function requestFirstLaunchGeolocation() {
  if (!navigator.geolocation) return;
  if (!navigator.onLine) return;

  const startIntent = state.userNavToken;
  const request = async () => {
    try {
      const permission = await navigator.permissions?.query({ name: 'geolocation' });
      if (permission?.state === 'denied') return;
    } catch {
      // L'API Permissions n'est pas disponible : la demande native fera le tri.
    }

    try {
      const position = await getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 9_000,
        maximumAge: 600_000,
      });
      if (state.userNavToken !== startIntent) return;
      const place = normalizePlace({
        name: 'Ma position',
        country: null,
        admin1: null,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      if (!place) return;
      await loadPlace(place, { silent: state.hasLoadedOnce });
      announce('Météo de votre position chargée.');
    } catch {
      // Refus ou indisponibilité : Paris reste affiché.
    }
  };

  request();
}

function getCurrentPosition(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

async function locateUser() {
  if (!navigator.geolocation) {
    showToast('La géolocalisation n’est pas disponible dans ce navigateur.', 'error');
    return;
  }
  if (locateButton.disabled) return;

  const startIntent = state.userNavToken;
  locateButton.disabled = true;
  locateButton.classList.add('is-busy');
  locateButton.setAttribute('aria-busy', 'true');

  try {
    const position = await getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 10_000,
      maximumAge: 300_000,
    });
    if (state.userNavToken !== startIntent) return;
    const place = normalizePlace({
      name: 'Ma position',
      country: null,
      admin1: null,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
    if (!place) throw new Error('Position invalide.');
    await loadPlace(place, { silent: state.hasLoadedOnce, userInitiated: true });
    showToast('Position mise à jour.');
  } catch (error) {
    if (state.userNavToken !== startIntent) return;
    if (error?.code === 1) {
      showToast('L’accès à votre position a été refusé.', 'error');
    } else if (error?.code === 3) {
      showToast('La localisation prend trop de temps. Réessayez.', 'error');
    } else {
      showToast('Votre position n’a pas pu être déterminée.', 'error');
    }
  } finally {
    locateButton.disabled = false;
    locateButton.classList.remove('is-busy');
    locateButton.removeAttribute('aria-busy');
  }
}

function updateNetworkStatus() {
  const offline = navigator.onLine === false;
  offlineBanner.hidden = !offline;
  document.body.classList.toggle('is-offline', offline);
}

function handleOnline() {
  updateNetworkStatus();
  showToast('Connexion rétablie.');
  if (state.loading) return;
  if (state.error) {
    loadPlace(state.lastAttempt || DEFAULT_PLACE, { userInitiated: true });
  } else if (state.place) {
    loadPlace(state.place, { silent: true });
  }
}

/* ————— Favoris ————— */

async function loadFavorites({ quiet = true } = {}) {
  if (state.favoritesLoading && state.favorites.length > 0) return;
  const revision = state.favoritesRevision;
  state.favoritesLoading = true;
  refreshFavoritesUI();

  try {
    const list = await api.listCities();
    if (revision !== state.favoritesRevision) return;
    if (!Array.isArray(list)) throw new Error('Liste de favoris invalide.');
    state.favorites = list.map(normalizeFavorite).filter(Boolean);
    state.favoritesLoading = false;
    state.favoritesError = false;
    refreshFavoritesUI();
    fetchFavoriteTemps();
  } catch (error) {
    if (revision !== state.favoritesRevision) return;
    state.favoritesLoading = false;
    state.favoritesError = true;
    refreshFavoritesUI();
    if (!quiet) showToast(error?.message || 'Impossible de charger les favoris.', 'error');
  }
}

function fetchFavoriteTemps() {
  const request = ++state.favoriteTempsRequest;
  const favorites = [...state.favorites];

  for (const favorite of favorites) {
    const key = coordinateKey(favorite.latitude, favorite.longitude);
    if (Number.isFinite(state.favoriteTemps.get(key))) continue;
    state.favoriteTemps.delete(key);

    api.getWeather(favorite.latitude, favorite.longitude)
      .then((data) => {
        if (request !== state.favoriteTempsRequest) return;
        const temp = Number(data?.current?.temperature_2m);
        state.favoriteTemps.set(key, Number.isFinite(temp) ? temp : null);
        refreshFavoriteTempsUI();
      })
      .catch(() => {
        if (request !== state.favoriteTempsRequest) return;
        state.favoriteTemps.set(key, null);
        refreshFavoriteTempsUI();
      });
  }
}

function refreshFavoritesUI() {
  const section = document.getElementById('favorites');
  if (!section) return;
  const holder = document.createElement('div');
  holder.innerHTML = favoritesView(state);
  const next = holder.firstElementChild;
  if (next) section.replaceWith(next);
  updateFavoriteButtonState();
}

function refreshFavoriteTempsUI() {
  content.querySelectorAll('[data-fav-temp]').forEach((element) => {
    const key = element.dataset.favTemp;
    const temp = state.favoriteTemps.get(key);
    if (Number.isFinite(temp)) {
      element.textContent = formatTemp(temp, state.units);
    } else if (state.favoriteTemps.has(key)) {
      element.textContent = '—';
    } else {
      element.innerHTML = '<span class="mini-sk" aria-hidden="true"></span>';
    }
  });
}

async function toggleFavorite() {
  if (!state.place || !state.weather || state.favoriteBusy) return;

  const existing = state.favorites.find((favorite) => samePlace(favorite, state.place));
  if (existing) {
    await deleteFavorite(existing, { source: 'star' });
    return;
  }

  state.favoriteBusy = true;
  const button = content.querySelector('[data-action="toggle-favorite"]');
  button?.classList.add('is-busy');
  button?.setAttribute('aria-busy', 'true');
  const place = { ...state.place };

  try {
    const row = await api.addCity(place);
    const favorite = normalizeFavorite(row);
    if (!favorite) throw new Error('Réponse inattendue du serveur.');

    state.favoritesRevision += 1;
    if (!state.favorites.some((item) => item.id === favorite.id)) {
      state.favorites = [...state.favorites, favorite];
    }
    state.favoritesLoading = false;
    state.favoritesError = false;
    const temp = Number(state.weather?.current?.temperature_2m);
    if (Number.isFinite(temp)) {
      state.favoriteTemps.set(coordinateKey(place.latitude, place.longitude), temp);
    }
    refreshFavoritesUI();
    showToast(`${place.name} ajouté aux favoris.`);
  } catch (error) {
    showToast(error?.message || 'Impossible d’ajouter ce favori.', 'error');
  } finally {
    state.favoriteBusy = false;
    button?.classList.remove('is-busy');
    button?.removeAttribute('aria-busy');
  }
}

async function deleteFavorite(favorite, { source = 'chip' } = {}) {
  if (state.removingIds.has(favorite.id)) return;
  state.removingIds.add(favorite.id);

  const chip = content.querySelector(`.fav-chip[data-favorite-id="${favorite.id}"]`);
  const star = content.querySelector('[data-action="toggle-favorite"]');
  chip?.classList.add('is-removing');
  if (source === 'star') {
    star?.classList.add('is-busy');
    star?.setAttribute('aria-busy', 'true');
  }

  try {
    await api.removeCity(favorite.id);
    state.favoritesRevision += 1;
    state.favorites = state.favorites.filter((item) => item.id !== favorite.id);
    state.favoritesLoading = false;
    state.favoritesError = false;
    refreshFavoritesUI();
    showToast(`${favorite.name} retiré des favoris.`);
  } catch (error) {
    chip?.classList.remove('is-removing');
    if (source === 'star') {
      star?.classList.remove('is-busy');
      star?.removeAttribute('aria-busy');
    }
    showToast(error?.message || 'Impossible de retirer ce favori.', 'error');
  } finally {
    state.removingIds.delete(favorite.id);
  }
}

function updateFavoriteButtonState() {
  if (!state.place) return;
  const button = content.querySelector('[data-action="toggle-favorite"]');
  if (!button) return;
  const favorite = state.favorites.find((item) => samePlace(item, state.place));
  const label = favorite
    ? `Retirer ${state.place.name} des favoris`
    : `Ajouter ${state.place.name} aux favoris`;
  button.classList.toggle('is-saved', Boolean(favorite));
  button.setAttribute('aria-pressed', String(Boolean(favorite)));
  button.setAttribute('aria-label', label);
  button.setAttribute('title', label);
  button.innerHTML = starIcon(favorite !== null);
}

function openFavorite(id) {
  const favorite = state.favorites.find((item) => item.id === id);
  if (!favorite) return;
  if (state.place && samePlace(favorite, state.place)) {
    scrollToTop(true);
    return;
  }
  loadPlace(favorite, { userInitiated: true });
  scrollToTop(true);
}

/* ————— Recherche ————— */

function handleSearchInput() {
  const query = searchInput.value.trim();
  searchClear.hidden = searchInput.value.length === 0;
  searchState.query = query;
  searchState.activeIndex = -1;
  cancelSearchRequest();

  if (query.length < 2) {
    searchState.open = false;
    searchState.loading = false;
    searchState.results = [];
    searchState.error = null;
    renderSearchPanel();
    return;
  }

  searchState.open = true;
  searchState.loading = true;
  searchState.results = [];
  searchState.error = null;
  renderSearchPanel();
  searchTimer = window.setTimeout(() => executeSearch(query), 300);
}

function handleSearchFocus() {
  const query = searchInput.value.trim();
  if (query.length < 2 || searchState.query !== query) return;
  if (!searchState.results.length && !searchState.error && !searchState.loading) return;
  searchState.open = true;
  renderSearchPanel();
}

function handleSearchKeydown(event) {
  if (event.isComposing) return;

  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    if (!searchState.open || searchState.results.length === 0) return;
    event.preventDefault();
    const count = searchState.results.length;
    const current = searchState.activeIndex;
    const next = event.key === 'ArrowDown'
      ? (current + 1) % count
      : (current - 1 + count) % count;
    setActiveSuggestion(next);
    return;
  }

  if (event.key === 'Enter') {
    if (searchState.open && searchState.results.length > 0) {
      event.preventDefault();
      selectSearchResult(searchState.activeIndex >= 0 ? searchState.activeIndex : 0);
    } else if (searchState.loading) {
      event.preventDefault();
    }
    return;
  }

  if (event.key === 'Escape' && searchState.open) {
    event.preventDefault();
    closeSearch({ clear: false });
  }
}

function handleSearchSubmit(event) {
  event.preventDefault();
  const query = searchInput.value.trim();
  if (query.length < 2) return;

  if (searchState.open && searchState.results.length > 0) {
    selectSearchResult(searchState.activeIndex >= 0 ? searchState.activeIndex : 0);
  } else if (!searchState.loading) {
    executeSearch(query);
  }
}

async function executeSearch(query) {
  if (searchInput.value.trim() !== query) return;
  cancelSearchRequest();

  if (navigator.onLine === false) {
    searchState.open = true;
    searchState.loading = false;
    searchState.error = 'Vous êtes hors ligne. Vérifiez votre connexion.';
    searchState.results = [];
    renderSearchPanel();
    return;
  }

  const controller = new AbortController();
  searchAbort = controller;
  const request = ++searchState.requestId;
  searchState.open = true;
  searchState.loading = true;
  searchState.error = null;
  renderSearchPanel();

  try {
    const data = await api.searchCities(query, controller.signal);
    if (request !== searchState.requestId) return;
    if (searchInput.value.trim() !== query) return;
    if (!Array.isArray(data)) throw new Error('Réponse de recherche invalide.');
    searchState.results = normalizeSearchResults(data);
    searchState.loading = false;
    renderSearchPanel();
  } catch (error) {
    if (error?.name === 'AbortError') return;
    if (request !== searchState.requestId) return;
    searchState.loading = false;
    searchState.results = [];
    searchState.error = error?.message || 'La recherche est momentanément indisponible.';
    renderSearchPanel();
  } finally {
    if (searchAbort === controller) searchAbort = null;
  }
}

function cancelSearchRequest() {
  window.clearTimeout(searchTimer);
  if (searchAbort) {
    searchAbort.abort();
    searchAbort = null;
  }
  searchState.requestId += 1;
}

function normalizeSearchResults(results) {
  return results
    .slice(0, 5)
    .map((item) => normalizePlace(item))
    .filter(Boolean);
}

function renderSearchPanel() {
  if (searchState.activeIndex >= searchState.results.length) {
    searchState.activeIndex = -1;
  }

  const open = searchState.open;
  searchPanel.hidden = !open;
  searchInput.setAttribute('aria-expanded', String(open));
  if (!open) {
    searchStatus.textContent = '';
    return;
  }

  if (searchState.loading) {
    searchResults.innerHTML = Array.from({ length: 3 }, () => `<div class="suggestion suggestion--skeleton" aria-hidden="true">
      <span class="suggestion__initial sk"></span>
      <span class="suggestion__body"><span class="sk sk--suggestion-name"></span><span class="sk sk--suggestion-sub"></span></span>
    </div>`).join('');
    searchStatus.textContent = 'Recherche en cours…';
    searchInput.removeAttribute('aria-activedescendant');
    return;
  }

  if (searchState.error) {
    searchResults.innerHTML = `<div class="search-message search-message--error">
      <p class="search-message__title">Recherche indisponible</p>
      <p class="search-message__text">${escapeHtml(searchState.error)}</p>
      <button class="button button--small button--ghost" type="button" data-action="retry-search">Réessayer</button>
    </div>`;
    searchStatus.textContent = 'La recherche est indisponible.';
    searchInput.removeAttribute('aria-activedescendant');
    return;
  }

  if (searchState.results.length === 0) {
    searchResults.innerHTML = `<div class="search-message search-message--empty">
      <p class="search-message__title">Aucune ville trouvée</p>
      <p class="search-message__text">Aucun résultat pour « ${escapeHtml(searchState.query)} ».</p>
    </div>`;
    searchStatus.textContent = 'Aucune ville trouvée.';
    searchInput.removeAttribute('aria-activedescendant');
    return;
  }

  searchResults.innerHTML = searchState.results.map((result, index) => {
    const details = [result.admin1, result.country].filter(Boolean).join(' · ');
    const initial = result.name.charAt(0).toUpperCase();
    const active = index === searchState.activeIndex;
    return `<button
      class="suggestion${active ? ' is-active' : ''}"
      type="button"
      role="option"
      id="search-option-${index}"
      aria-selected="${active}"
      data-action="pick-city"
      data-index="${index}"
    >
      <span class="suggestion__initial" aria-hidden="true">${escapeHtml(initial)}</span>
      <span class="suggestion__body">
        <span class="suggestion__name">${escapeHtml(result.name)}</span>
        ${details ? `<span class="suggestion__sub">${escapeHtml(details)}</span>` : ''}
      </span>
      <span class="suggestion__arrow" aria-hidden="true">${chevronRightIcon()}</span>
    </button>`;
  }).join('');

  searchStatus.textContent = `${searchState.results.length} ville${searchState.results.length > 1 ? 's' : ''} trouvée${searchState.results.length > 1 ? 's' : ''}.`;
  setActiveSuggestion(searchState.activeIndex);
}

function setActiveSuggestion(index) {
  searchState.activeIndex = index;
  const options = [...searchResults.querySelectorAll('[role="option"]')];
  options.forEach((option, optionIndex) => {
    const active = optionIndex === index;
    option.classList.toggle('is-active', active);
    option.setAttribute('aria-selected', String(active));
  });

  if (index >= 0 && options[index]) {
    searchInput.setAttribute('aria-activedescendant', options[index].id);
    options[index].scrollIntoView({ block: 'nearest' });
  } else {
    searchInput.removeAttribute('aria-activedescendant');
  }
}

function selectSearchResult(index) {
  const result = searchState.results[index];
  if (!result) return;
  closeSearch({ clear: true });
  searchInput.blur();
  loadPlace(result, { userInitiated: true });
  scrollToTop(true);
}

function closeSearch({ clear }) {
  searchState.open = false;
  searchState.activeIndex = -1;
  searchResults.innerHTML = '';
  searchStatus.textContent = '';
  searchInput.removeAttribute('aria-activedescendant');

  if (clear) {
    cancelSearchRequest();
    searchInput.value = '';
    searchClear.hidden = true;
    searchState.query = '';
    searchState.results = [];
    searchState.error = null;
    searchState.loading = false;
  }

  renderSearchPanel();
}

function clearSearch() {
  closeSearch({ clear: true });
  searchInput.focus();
}

function scrollToTop(smooth) {
  if (window.scrollY < 80) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: smooth && !reduce ? 'smooth' : 'auto' });
}

/* ————— Utilitaires ————— */

function showToast(message, tone = 'info') {
  toast.textContent = message;
  toast.dataset.tone = tone;
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 3_600);
}

function announce(message) {
  window.clearTimeout(announceTimer);
  appStatus.textContent = '';
  announceTimer = window.setTimeout(() => {
    appStatus.textContent = message;
  }, 60);
}
