import {
  coordinateKey,
  dailyLabel,
  formatClock,
  formatHeroDate,
  formatHour,
  formatPercent,
  formatPressure,
  formatTemp,
  formatTempAria,
  formatUV,
  formatWind,
  getWeather,
  minutesOfDay,
  samePlace,
  uvLevel,
  visibilityQuality,
  visibilityValue,
  windDirection,
  windUnit,
} from './weather.js';
import {
  cloudOffIcon,
  dropIcon,
  statIcon,
  starIcon,
  weatherIcon,
  windArrowIcon,
} from './icons.js';

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

function numberOrDash(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : '—';
}

function windPhrase(label) {
  if (!label || label === '—') return 'Direction inconnue';
  const lower = label.toLowerCase();
  if (lower === 'est' || lower === 'ouest') return `De l’${lower}`;
  return `Du ${lower}`;
}

function findFavorite(state) {
  return state.favorites.find((favorite) => samePlace(favorite, state.place)) ?? null;
}

function favoriteTemperature(state, favorite) {
  const key = coordinateKey(favorite.latitude, favorite.longitude);
  const temp = state.favoriteTemps.get(key);
  if (Number.isFinite(temp)) return formatTemp(temp, state.units);
  if (state.favoriteTemps.has(key)) return '—';
  return '<span class="mini-sk" aria-hidden="true"></span>';
}

export function favoritesView(state) {
  const caption = '<span class="favorites__caption">Favoris</span>';

  if (state.favoritesLoading && state.favorites.length === 0) {
    return `<div class="favorites" id="favorites" aria-busy="true">
      ${caption}
      <div class="favorites__list" aria-hidden="true">
        <span class="fav-chip fav-chip--skeleton"><span class="mini-sk"></span></span>
        <span class="fav-chip fav-chip--skeleton"><span class="mini-sk mini-sk--wide"></span></span>
        <span class="fav-chip fav-chip--skeleton"><span class="mini-sk"></span></span>
      </div>
    </div>`;
  }

  if (state.favoritesError && state.favorites.length === 0) {
    return `<div class="favorites" id="favorites">
      ${caption}
      <p class="favorites__empty">Favoris indisponibles.
        <button class="link-button" type="button" data-action="retry-favorites">Réessayer</button>
      </p>
    </div>`;
  }

  if (state.favorites.length === 0) {
    return `<div class="favorites" id="favorites">
      ${caption}
      <p class="favorites__empty">${starIcon(false)}<span>Ajoutez une ville avec l’étoile.</span></p>
    </div>`;
  }

  const chips = state.favorites.map((favorite) => {
    const active = samePlace(favorite, state.place);
    const title = favorite.country ? `${favorite.name}, ${favorite.country}` : favorite.name;
    return `<span class="fav-chip${active ? ' is-active' : ''}" data-favorite-id="${favorite.id}">
      <button
        class="fav-chip__main"
        type="button"
        data-action="open-favorite"
        data-id="${favorite.id}"
        aria-label="Afficher la météo de ${escapeHtml(title)}"
        ${active ? 'aria-current="true"' : ''}
      >
        <span class="fav-chip__name">${escapeHtml(favorite.name)}</span>
        <span class="fav-chip__temp" data-fav-temp="${coordinateKey(favorite.latitude, favorite.longitude)}">
          ${favoriteTemperature(state, favorite)}
        </span>
      </button>
      <button
        class="fav-chip__remove"
        type="button"
        data-action="remove-favorite"
        data-id="${favorite.id}"
        aria-label="Retirer ${escapeHtml(favorite.name)} des favoris"
        title="Retirer des favoris"
      >${closeGlyph()}</button>
    </span>`;
  }).join('');

  return `<div class="favorites" id="favorites">
    ${caption}
    <div class="favorites__list">${chips}</div>
  </div>`;
}

function closeGlyph() {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path d="m8 8 8 8M16 8l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`;
}

function statCard({ label, icon, main, sub, footer = '', modifier = '' }) {
  return `<article class="stat-card ${modifier}">
    <div class="stat-card__head">
      <span>${label}</span>
      ${statIcon(icon)}
    </div>
    <div class="stat-card__main">${main}</div>
    <p class="stat-card__sub">${sub}</p>
    ${footer}
  </article>`;
}

function valueWithUnit(value, unit) {
  return `<span class="stat-card__value">${value}<span class="stat-card__unit">${unit}</span></span>`;
}

function meters(value, maximum = 100) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '';
  const width = Math.max(0, Math.min(100, (amount / maximum) * 100));
  return `<div class="stat-meter" aria-hidden="true"><span style="width:${width.toFixed(1)}%"></span></div>`;
}

function sunProgress(currentTime, sunrise, sunset) {
  const now = minutesOfDay(currentTime);
  const rise = minutesOfDay(sunrise);
  const set = minutesOfDay(sunset);
  if (now === null || rise === null || set === null || set <= rise) return 0;
  return Math.max(0, Math.min(100, ((now - rise) / (set - rise)) * 100));
}

function statsView(weather, units) {
  const current = weather.current ?? {};
  const daily = weather.daily ?? {};
  const direction = windDirection(current.wind_direction_10m);
  const humidity = Number(current.relative_humidity_2m);
  const uv = Number(daily.uv_index_max?.[0]);
  const visibility = visibilityValue(current.visibility, units);
  const sun = daily.sunrise?.[0];
  const sunset = daily.sunset?.[0];
  const dayProgress = sunProgress(current.time, sun, sunset);

  const windMain = `<span class="wind-main">
    ${valueWithUnit(formatWind(current.wind_speed_10m, units), windUnit(units))}
    <span class="wind-badge">
      <span class="wind-badge__arrow" style="transform:rotate(${direction.rotation}deg)">${windArrowIcon()}</span>
      <span class="wind-badge__label">${direction.short}</span>
    </span>
  </span>`;

  return `<section class="stats" aria-label="Conditions actuelles">
    ${statCard({
      label: 'Vent',
      icon: 'wind',
      main: windMain,
      sub: Number.isFinite(current.wind_direction_10m)
        ? `${windPhrase(direction.label)} · ${direction.degrees}`
        : 'Direction inconnue',
    })}
    ${statCard({
      label: 'Humidité',
      icon: 'humidity',
      main: valueWithUnit(numberOrDash(current.relative_humidity_2m), '%'),
      sub: 'Humidité relative',
      footer: meters(humidity),
    })}
    ${statCard({
      label: 'Pression',
      icon: 'pressure',
      main: valueWithUnit(formatPressure(current.pressure_msl), 'hPa'),
      sub: 'Au niveau de la mer',
    })}
    ${statCard({
      label: 'Indice UV',
      icon: 'uv',
      main: `<span class="stat-card__value">${formatUV(uv)}</span>`,
      sub: Number.isFinite(uv) ? `${uvLevel(uv)} · maximum du jour` : 'Maximum du jour',
      footer: meters(uv, 11),
    })}
    ${statCard({
      label: 'Visibilité',
      icon: 'visibility',
      main: valueWithUnit(visibility.value, visibility.unit),
      sub: `${visibilityQuality(current.visibility)} · visibilité`,
    })}
    <article class="stat-card stat-card--sun">
      <div class="stat-card__head">
        <span>Soleil</span>
        ${statIcon('sun')}
      </div>
      <div class="sun-pair">
        <div class="sun-pair__item">
          <span class="sun-pair__time">${formatClock(sun)}</span>
          <span class="sun-pair__label">Lever</span>
        </div>
        <div class="sun-pair__item">
          <span class="sun-pair__time">${formatClock(sunset)}</span>
          <span class="sun-pair__label">Coucher</span>
        </div>
      </div>
      <div class="sun-track" aria-hidden="true">
        <span class="sun-track__line"></span>
        <span class="sun-track__dot" style="left:${dayProgress.toFixed(1)}%"></span>
      </div>
    </article>
  </section>`;
}

function hourlyView(weather, units) {
  const hourly = weather.hourly ?? {};
  const times = Array.isArray(hourly.time) ? hourly.time : [];
  if (!times.length) return '<p class="panel__empty">Prévisions horaires indisponibles.</p>';

  const currentTime = String(weather.current?.time ?? '');
  const prefix = currentTime.slice(0, 13);
  let start = times.findIndex((time) => String(time).slice(0, 13) === prefix);
  if (start < 0) start = times.findIndex((time) => String(time) >= currentTime);
  if (start < 0) start = 0;

  const items = times.slice(start, start + 24).map((time, offset) => {
    const index = start + offset;
    const info = getWeather(hourly.weather_code?.[index]);
    const isDay = hourly.is_day?.[index] === undefined
      ? Number(weather.current?.is_day) !== 0
      : Number(hourly.is_day[index]) !== 0;
    const temp = hourly.temperature_2m?.[index];
    const probability = Number(hourly.precipitation_probability?.[index]);
    const label = offset === 0 ? 'Maint.' : formatHour(time);
    const precipClass = probability === 0 ? ' is-zero' : '';
    const precip = Number.isFinite(probability)
      ? `${dropIcon()}<span>${formatPercent(probability)}</span>`
      : '<span>—</span>';

    return `<article class="hour-card${offset === 0 ? ' is-now' : ''}">
      <span class="hour-card__time">${label}</span>
      <span class="hour-card__icon">${weatherIcon(info.icon, isDay)}</span>
      <span class="hour-card__temp">${formatTemp(temp, units)}</span>
      <span class="hour-card__precip${precipClass}">${precip}</span>
    </article>`;
  }).join('');

  return `<div class="hourly-scroll" tabindex="0" role="region" aria-label="Prévisions des 24 prochaines heures">${items}</div>`;
}

function dailyView(weather, units) {
  const daily = weather.daily ?? {};
  const times = Array.isArray(daily.time) ? daily.time : [];
  if (!times.length) return '<p class="panel__empty">Prévisions quotidiennes indisponibles.</p>';

  const lows = times.map((_, index) => Number(daily.temperature_2m_min?.[index]));
  const highs = times.map((_, index) => Number(daily.temperature_2m_max?.[index]));
  const all = [...lows, ...highs].filter(Number.isFinite);
  const globalMin = all.length ? Math.min(...all) : 0;
  const globalMax = all.length ? Math.max(...all) : 1;
  const span = Math.max(globalMax - globalMin, 1);
  const currentTemp = Number(weather.current?.temperature_2m);

  const rows = times.slice(0, 7).map((time, index) => {
    const label = dailyLabel(time, index);
    const info = getWeather(daily.weather_code?.[index]);
    const low = lows[index];
    const high = highs[index];
    const probability = Number(daily.precipitation_probability_max?.[index]);
    const hasRange = Number.isFinite(low) && Number.isFinite(high);

    let fill = '';
    let marker = '';
    if (hasRange) {
      const width = Math.max(((high - low) / span) * 100, 7);
      const left = Math.max(0, Math.min(100 - width, ((low - globalMin) / span) * 100));
      fill = `<span class="day-bar__fill" style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%"></span>`;
      if (index === 0 && Number.isFinite(currentTemp)) {
        const mark = Math.max(0, Math.min(100, ((currentTemp - globalMin) / span) * 100));
        marker = `<span class="day-bar__now" style="left:${mark.toFixed(2)}%"></span>`;
      }
    }

    const precip = Number.isFinite(probability)
      ? `${dropIcon()}<span>${formatPercent(probability)}</span>`
      : '<span>—</span>';

    return `<div class="day-row${index === 0 ? ' is-today' : ''}" role="listitem">
      <div class="day-label">
        <span class="day-label__full">${label.name}</span>
        <span class="day-label__short">${label.short}</span>
        <span class="day-label__date">${label.date}</span>
      </div>
      <span class="day-icon">${weatherIcon(info.icon, true)}<span class="visually-hidden">${info.label}</span></span>
      <span class="day-precip${probability === 0 ? ' is-zero' : ''}">${precip}</span>
      <div class="day-temps">
        <span class="day-temp day-temp--low">${formatTemp(low, units)}</span>
        <span class="day-bar" aria-hidden="true">${fill}${marker}</span>
        <span class="day-temp day-temp--high">${formatTemp(high, units)}</span>
      </div>
    </div>`;
  }).join('');

  return `<div class="daily-list" role="list" aria-label="Prévisions sur sept jours">${rows}</div>`;
}

export function weatherView(state) {
  const units = state.units;
  const weather = state.weather;
  const current = weather.current ?? {};
  const daily = weather.daily ?? {};
  const place = state.place;
  const info = getWeather(current.weather_code);
  const saved = Boolean(findFavorite(state));
  const region = place.admin1 && place.admin1 !== place.name
    ? place.admin1
    : (place.country || '');
  const regionMarkup = region
    ? `<span class="hero__dot" aria-hidden="true"></span><span>${escapeHtml(region)}</span>`
    : '';
  const favoriteLabel = saved
    ? `Retirer ${place.name} des favoris`
    : `Ajouter ${place.name} aux favoris`;

  return `<section class="hero">
    <p class="hero__eyebrow">
      <time datetime="${escapeHtml(current.time ?? '')}">${formatHeroDate(current.time)}</time>
      ${regionMarkup}
    </p>
    <div class="hero__place">
      <h1 class="hero__city">${escapeHtml(place.name)}</h1>
      <button
        class="save-button${saved ? ' is-saved' : ''}"
        type="button"
        data-action="toggle-favorite"
        aria-label="${escapeHtml(favoriteLabel)}"
        aria-pressed="${saved}"
        title="${escapeHtml(favoriteLabel)}"
      >${starIcon(saved)}</button>
    </div>
    <p class="hero__condition">${info.label}</p>
    <div class="hero__temperature" role="img" aria-label="${formatTempAria(current.temperature_2m, units)}">
      <span class="hero__temp-value">${formatTemp(current.temperature_2m, units, { degree: false })}</span>
      <span class="hero__temp-degree" aria-hidden="true">°</span>
    </div>
    <p class="hero__meta">
      <span>Ressenti <strong>${formatTemp(current.apparent_temperature, units)}</strong></span>
      <span class="hero__dot" aria-hidden="true"></span>
      <span>Max <strong>${formatTemp(daily.temperature_2m_max?.[0], units)}</strong></span>
      <span class="hero__dot" aria-hidden="true"></span>
      <span>Min <strong>${formatTemp(daily.temperature_2m_min?.[0], units)}</strong></span>
    </p>
    ${favoritesView(state)}
  </section>

  ${statsView(weather, units)}

  <section class="panel panel--hourly" aria-labelledby="hourly-title">
    <div class="panel__head">
      <h2 id="hourly-title">24 prochaines heures</h2>
      <span class="panel__hint">Heure locale</span>
    </div>
    ${hourlyView(weather, units)}
  </section>

  <section class="panel panel--daily" aria-labelledby="daily-title">
    <div class="panel__head">
      <h2 id="daily-title">Prévisions sur 7 jours</h2>
      <span class="panel__hint">Min / Max</span>
    </div>
    ${dailyView(weather, units)}
  </section>`;
}

export function errorView({ message, placeName }) {
  const place = placeName ? `<p class="error-view__place">${escapeHtml(placeName)}</p>` : '';
  return `<section class="error-view" aria-labelledby="error-title">
    <div class="error-view__art">${cloudOffIcon()}</div>
    ${place}
    <h1 class="error-view__title" id="error-title">La météo est indisponible.</h1>
    <p class="error-view__message">${escapeHtml(message)}</p>
    <div class="error-view__actions">
      <button class="button button--primary" type="button" data-action="retry">Réessayer</button>
      <button class="button button--ghost" type="button" data-action="focus-search">Chercher une ville</button>
    </div>
  </section>`;
}
