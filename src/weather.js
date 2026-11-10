const WEATHER_CODES = {
  0: { label: 'Ciel dégagé', group: 'clear', icon: 'clear' },
  1: { label: 'Plutôt dégagé', group: 'partly', icon: 'partly' },
  2: { label: 'Partiellement nuageux', group: 'partly', icon: 'partly' },
  3: { label: 'Couvert', group: 'cloudy', icon: 'cloudy' },
  45: { label: 'Brouillard', group: 'fog', icon: 'fog' },
  48: { label: 'Brouillard givrant', group: 'fog', icon: 'fog' },
  51: { label: 'Bruine légère', group: 'drizzle', icon: 'drizzle' },
  53: { label: 'Bruine', group: 'drizzle', icon: 'drizzle' },
  55: { label: 'Bruine dense', group: 'drizzle', icon: 'drizzle' },
  56: { label: 'Bruine verglaçante', group: 'drizzle', icon: 'sleet' },
  57: { label: 'Bruine verglaçante forte', group: 'drizzle', icon: 'sleet' },
  61: { label: 'Pluie faible', group: 'rain', icon: 'rain' },
  63: { label: 'Pluie', group: 'rain', icon: 'rain' },
  65: { label: 'Pluie forte', group: 'rain', icon: 'rain' },
  66: { label: 'Pluie verglaçante', group: 'rain', icon: 'sleet' },
  67: { label: 'Pluie verglaçante forte', group: 'rain', icon: 'sleet' },
  71: { label: 'Neige faible', group: 'snow', icon: 'snow' },
  73: { label: 'Neige', group: 'snow', icon: 'snow' },
  75: { label: 'Neige forte', group: 'snow', icon: 'snow' },
  77: { label: 'Grains de neige', group: 'snow', icon: 'snow' },
  80: { label: 'Averses faibles', group: 'rain', icon: 'rain' },
  81: { label: 'Averses', group: 'rain', icon: 'rain' },
  82: { label: 'Averses fortes', group: 'rain', icon: 'rain' },
  85: { label: 'Averses de neige', group: 'snow', icon: 'snow' },
  86: { label: 'Averses de neige fortes', group: 'snow', icon: 'snow' },
  95: { label: 'Orage', group: 'thunder', icon: 'thunder' },
  96: { label: 'Orage avec grêle', group: 'thunder', icon: 'thunder' },
  99: { label: 'Orage avec grêle forte', group: 'thunder', icon: 'thunder' },
};

const UNKNOWN_WEATHER = { label: 'Conditions variables', group: 'cloudy', icon: 'cloudy' };

const INTENSITY = {
  51: 'light',
  53: 'normal',
  55: 'heavy',
  56: 'light',
  57: 'normal',
  61: 'light',
  63: 'normal',
  65: 'heavy',
  66: 'normal',
  67: 'heavy',
  71: 'light',
  73: 'normal',
  75: 'heavy',
  77: 'light',
  80: 'light',
  81: 'normal',
  82: 'heavy',
  85: 'normal',
  86: 'heavy',
  95: 'normal',
  96: 'heavy',
  99: 'heavy',
};

const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTH_NAMES = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

const number0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const number1 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });

export const DIRECTION_LABELS = [
  'Nord', 'Nord-est', 'Est', 'Sud-est', 'Sud', 'Sud-ouest', 'Ouest', 'Nord-ouest',
];
export const DIRECTION_SHORT = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

export function getWeather(code) {
  return WEATHER_CODES[Number(code)] ?? UNKNOWN_WEATHER;
}

export function getIntensity(code) {
  return INTENSITY[Number(code)] ?? 'normal';
}

export function isImperial(units) {
  return units === 'imperial';
}

export function convertTemp(value, units) {
  return isImperial(units) ? (value * 9) / 5 + 32 : value;
}

export function tempUnit(units) {
  return isImperial(units) ? '°F' : '°C';
}

export function windUnit(units) {
  return isImperial(units) ? 'mph' : 'km/h';
}

export function convertWind(value, units) {
  return isImperial(units) ? value * 0.621371 : value;
}

export function formatTemp(value, units, { degree = true } = {}) {
  if (!Number.isFinite(value)) return '—';
  const rounded = Math.round(convertTemp(value, units));
  const safe = Object.is(rounded, -0) ? 0 : rounded;
  return `${number0.format(safe)}${degree ? '°' : ''}`;
}

export function formatTempAria(value, units) {
  if (!Number.isFinite(value)) return 'Température indisponible';
  return `${number0.format(Math.round(convertTemp(value, units)))} degrés ${isImperial(units) ? 'Fahrenheit' : 'Celsius'}`;
}

export function formatWind(value, units) {
  if (!Number.isFinite(value)) return '—';
  return number0.format(Math.round(convertWind(value, units)));
}

export function formatPercent(value) {
  if (!Number.isFinite(value)) return '—';
  return `${number0.format(Math.round(value))}\u202f%`;
}

export function formatPressure(value) {
  if (!Number.isFinite(value)) return '—';
  return number0.format(Math.round(value));
}

export function formatUV(value) {
  if (!Number.isFinite(value)) return '—';
  return number1.format(value);
}

export function uvLevel(value) {
  if (!Number.isFinite(value)) return 'Indisponible';
  if (value < 3) return 'Faible';
  if (value < 6) return 'Modéré';
  if (value < 8) return 'Élevé';
  if (value < 11) return 'Très élevé';
  return 'Extrême';
}

export function visibilityValue(meters, units) {
  if (!Number.isFinite(meters)) return { value: '—', unit: isImperial(units) ? 'mi' : 'km' };
  const converted = isImperial(units) ? meters / 1609.344 : meters / 1000;
  const value = converted >= 10 ? number0.format(Math.round(converted)) : number1.format(converted);
  return { value, unit: isImperial(units) ? 'mi' : 'km' };
}

export function visibilityQuality(meters) {
  if (!Number.isFinite(meters)) return 'Indisponible';
  const km = meters / 1000;
  if (km >= 10) return 'Excellente';
  if (km >= 5) return 'Bonne';
  if (km >= 2) return 'Moyenne';
  return 'Faible';
}

export function windDirection(degrees) {
  if (!Number.isFinite(degrees)) {
    return { index: 0, label: '—', short: '—', degrees: '—', rotation: 0 };
  }
  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % 8;
  return {
    index,
    label: DIRECTION_LABELS[index],
    short: DIRECTION_SHORT[index],
    degrees: `${number0.format(Math.round(normalized))}°`,
    // La flèche indique la direction vers laquelle le vent souffle.
    rotation: Math.round((normalized + 180) % 360),
  };
}

export function timeParts(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(String(iso ?? ''));
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] ?? 0),
    minute: Number(match[5] ?? 0),
  };
}

export function minutesOfDay(iso) {
  const parts = timeParts(iso);
  return parts ? parts.hour * 60 + parts.minute : null;
}

export function formatClock(iso) {
  const parts = timeParts(iso);
  if (!parts) return '—';
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

export function formatHour(iso, isFirst = false) {
  if (isFirst) return 'Maint.';
  const parts = timeParts(iso);
  if (!parts) return '—';
  return `${String(parts.hour).padStart(2, '0')} h`;
}

function capitalized(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatHeroDate(iso) {
  const parts = timeParts(iso);
  if (!parts) return '';
  const weekday = DAY_NAMES[new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()];
  return `${capitalized(weekday)} ${parts.day} ${MONTH_NAMES[parts.month - 1]}`;
}

export function formatUpdated(iso) {
  const parts = timeParts(iso);
  if (!parts) return '';
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

export function dailyLabel(iso, index) {
  const parts = timeParts(iso);
  if (!parts) return { name: '—', short: '—', date: '' };
  if (index === 0) return { name: 'Aujourd’hui', short: 'Auj.', date: '' };
  if (index === 1) return { name: 'Demain', short: 'Dem.', date: '' };
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const weekday = DAY_NAMES[date.getUTCDay()];
  const short = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', timeZone: 'UTC' })
    .format(date)
    .replace('.', '');
  return {
    name: capitalized(weekday),
    short: capitalized(short),
    date: `${parts.day} ${MONTH_NAMES[parts.month - 1].slice(0, 4)}.`,
  };
}

export function coordinateKey(latitude, longitude) {
  return `${Number(latitude).toFixed(4)},${Number(longitude).toFixed(4)}`;
}

export function samePlace(a, b) {
  if (!a || !b) return false;
  return (
    Math.abs(Number(a.latitude) - Number(b.latitude)) < 0.0015 &&
    Math.abs(Number(a.longitude) - Number(b.longitude)) < 0.0015
  );
}

export function capitalize(value) {
  return capitalized(String(value ?? ''));
}
