const CLOUD_PATH =
  'M18 41h27a8 8 0 0 0 1-16 14 14 0 0 0-26.8-4.6A9.5 9.5 0 0 0 18 41Z';

const SMALL_CLOUD_PATH =
  'M24 48h21a7 7 0 0 0 .8-14 11 11 0 0 0-21-3.6A8 8 0 0 0 24 48Z';

let maskUid = 0;

function weatherSvg(body) {
  return `<svg class="wx-icon" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${body}</svg>`;
}

function sun(cx, cy, radius, rayInner, rayOuter, className = '') {
  const rays = [
    [0, -1], [0, 1], [-1, 0], [1, 0],
    [-0.71, -0.71], [0.71, -0.71], [-0.71, 0.71], [0.71, 0.71],
  ]
    .map(([x, y]) => {
      const x1 = cx + x * rayInner;
      const y1 = cy + y * rayInner;
      const x2 = cx + x * rayOuter;
      const y2 = cy + y * rayOuter;
      return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}"/>`;
    })
    .join('');
  return `<g class="wx-sun ${className}">
    <circle cx="${cx}" cy="${cy}" r="${radius}" fill="var(--w-sun)" stroke="none"/>
    <g stroke="var(--w-sun)" stroke-width="3" stroke-linecap="round">${rays}</g>
  </g>`;
}

function moon(cx, cy, scale = 1, showStars = true) {
  const id = `moon-cut-${++maskUid}`;
  const stars = showStars
    ? `<circle cx="${cx + 17 * scale}" cy="${cy - 12 * scale}" r="1.9" fill="var(--w-moon)"/>
       <circle cx="${cx + 22 * scale}" cy="${cy + 3 * scale}" r="1.1" fill="var(--w-moon)" opacity=".7"/>`
    : '';
  return `<g transform="translate(${cx} ${cy}) scale(${scale})">
    <defs>
      <mask id="${id}" maskUnits="userSpaceOnUse" x="-24" y="-24" width="48" height="48">
        <rect x="-24" y="-24" width="48" height="48" fill="#fff"/>
        <circle cx="8" cy="-6.5" r="12.5" fill="#000"/>
      </mask>
    </defs>
    <circle cx="0" cy="0" r="14" fill="var(--w-moon)" mask="url(#${id})"/>
  </g>${stars}`;
}

function cloud({ x = 0, y = 0, scale = 1, opacity = 1, path = CLOUD_PATH } = {}) {
  return `<g transform="translate(${x} ${y}) scale(${scale})" opacity="${opacity}">
    <path d="${path}" fill="var(--w-cloud-fill)" stroke="var(--w-cloud-line)" stroke-width="${3 / scale}" stroke-linejoin="round"/>
  </g>`;
}

function drops() {
  return `<g stroke="var(--w-rain)" stroke-width="3.2" stroke-linecap="round">
    <path d="M22 47l-2 7"/><path d="M33 47l-2 7"/><path d="M44 47l-2 7"/>
  </g>`;
}

function drizzle() {
  return `<g stroke="var(--w-rain)" stroke-width="2.8" stroke-linecap="round" opacity=".9">
    <path d="M23 47v3"/><path d="M33 50v3"/><path d="M43 47v3"/>
  </g>`;
}

function snowflakes() {
  return `<g stroke="var(--w-snow)" stroke-width="2" stroke-linecap="round">
    <g transform="translate(22 51)"><path d="M0-4v8M-3.5-2l7 4M3.5-2l-7 4"/></g>
    <g transform="translate(33 54)"><path d="M0-4v8M-3.5-2l7 4M3.5-2l-7 4"/></g>
    <g transform="translate(44 51)"><path d="M0-4v8M-3.5-2l7 4M3.5-2l-7 4"/></g>
  </g>`;
}

function fogLines() {
  return `<g stroke="var(--w-cloud-line)" stroke-width="2.6" stroke-linecap="round" opacity=".8">
    <path d="M14 48h26"/><path d="M25 54h25"/><path d="M18 60h20"/>
  </g>`;
}

function bolt() {
  return `<path d="M35 40L26 52h6l-2.5 9L40 47h-6.5L37 40h-2Z" fill="var(--w-bolt)" stroke="var(--w-bolt)" stroke-width="1.5" stroke-linejoin="round"/>`;
}

export function weatherIcon(kind, isDay = true) {
  switch (kind) {
    case 'clear':
      return weatherSvg(isDay
        ? sun(32, 32, 10, 17, 23.5)
        : `${moon(32, 32, 0.9)}`);
    case 'partly':
      return weatherSvg(isDay
        ? `${sun(23, 23, 6.5, 12, 17)}${cloud({ x: 3, y: 3, scale: 0.92 })}`
        : `${moon(25, 22, 0.62)}${cloud({ x: 3, y: 3, scale: 0.92 })}`);
    case 'cloudy':
      return weatherSvg(
        `${cloud({ x: 9, y: -2, scale: 0.72, opacity: 0.48 })}
         ${cloud({ x: -2, y: 5, scale: 1 })}`
      );
    case 'fog':
      return weatherSvg(`${cloud({ x: -3, y: -6, scale: 0.95 })}${fogLines()}`);
    case 'drizzle':
      return weatherSvg(`${cloud({ x: -6, y: -7, scale: 0.92, path: SMALL_CLOUD_PATH })}${drizzle()}`);
    case 'rain':
      return weatherSvg(`${cloud({ x: -7, y: -8, scale: 0.94, path: SMALL_CLOUD_PATH })}${drops()}`);
    case 'sleet':
      return weatherSvg(
        `${cloud({ x: -7, y: -8, scale: 0.94, path: SMALL_CLOUD_PATH })}
         <path d="M24 48l-2 6" stroke="var(--w-rain)" stroke-width="3" stroke-linecap="round"/>
         <g transform="translate(40 52)" stroke="var(--w-snow)" stroke-width="2" stroke-linecap="round">
           <path d="M0-4v8M-3.5-2l7 4M3.5-2l-7 4"/>
         </g>`
      );
    case 'snow':
      return weatherSvg(`${cloud({ x: -7, y: -9, scale: 0.94, path: SMALL_CLOUD_PATH })}${snowflakes()}`);
    case 'thunder':
      return weatherSvg(`${cloud({ x: -7, y: -8, scale: 0.94, path: SMALL_CLOUD_PATH })}${bolt()}`);
    default:
      return weatherSvg(`${cloud({ x: -2, y: 5, scale: 1 })}`);
  }
}

function uiSvg(body, viewBox = '0 0 24 24') {
  return `<svg class="ui-icon" viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${body}</svg>`;
}

const stroke = 'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';

export function statIcon(name) {
  switch (name) {
    case 'wind':
      return uiSvg(`<g ${stroke}>
        <path d="M3 8h9.5a2.5 2.5 0 1 0-2.4-3.2"/>
        <path d="M3 12h13.5a2.5 2.5 0 1 1-2.4 3.2"/>
        <path d="M3 16h7"/>
      </g>`);
    case 'humidity':
      return uiSvg(`<path d="M12 3.2c3 3.9 5.5 6.8 5.5 10a5.5 5.5 0 1 1-11 0c0-3.2 2.5-6.1 5.5-10Z" ${stroke}/>`);
    case 'pressure':
      return uiSvg(`<g ${stroke}>
        <path d="M3.8 17.5a8.2 8.2 0 1 1 16.4 0"/>
        <path d="M12 17.5l4.2-5.3"/>
        <circle cx="12" cy="17.5" r="1.2" fill="currentColor" stroke="none"/>
        <path d="M6.5 13.5l1-.7M17.5 13.5l-1-.7M12 10.3v1.2"/>
      </g>`);
    case 'uv':
      return uiSvg(`<g ${stroke}>
        <circle cx="12" cy="12" r="4"/>
        <path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M18.5 5.5l-1.4 1.4M6.9 17.1l-1.4 1.4"/>
      </g>`);
    case 'visibility':
      return uiSvg(`<g ${stroke}>
        <path d="M2.8 12s3.4-5.5 9.2-5.5S21.2 12 21.2 12s-3.4 5.5-9.2 5.5S2.8 12 2.8 12Z"/>
        <circle cx="12" cy="12" r="2.6"/>
      </g>`);
    case 'sun':
      return uiSvg(`<g ${stroke}>
        <path d="M3 18.5h18"/>
        <path d="M7 18.5a5 5 0 0 1 10 0"/>
        <path d="M12 3.5v3.2M5.2 7.2l2.2 2.2M18.8 7.2l-2.2 2.2"/>
      </g>`);
    default:
      return uiSvg(`<circle cx="12" cy="12" r="8" ${stroke}/>`);
  }
}

export function windArrowIcon() {
  return uiSvg(`<path d="M12 20V4M5.5 10.5 12 4l6.5 6.5" ${stroke}/>`);
}

export function searchIcon() {
  return uiSvg(`<g ${stroke}><circle cx="10.8" cy="10.8" r="6.6"/><path d="m16 16 4 4"/></g>`);
}

export function locateIcon() {
  return uiSvg(`<g ${stroke}>
    <circle cx="12" cy="12" r="6.2"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>
    <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>
  </g>`);
}

export function closeIcon() {
  return uiSvg(`<path d="m7 7 10 10M17 7 7 17" ${stroke}/>`);
}

export function refreshIcon() {
  return uiSvg(`<g ${stroke}>
    <path d="M19.5 8.5A8 8 0 1 0 20 15"/>
    <path d="M19.7 3.8v4.9h-4.9"/>
  </g>`);
}

export function starIcon(filled = false) {
  const path = 'M12 2.9l2.75 5.58 6.16.9-4.46 4.34 1.05 6.13L12 16.96l-5.5 2.89 1.05-6.13-4.46-4.34 6.16-.9L12 2.9Z';
  return uiSvg(`<path d="${path}" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>`);
}

export function chevronRightIcon() {
  return uiSvg(`<path d="m9 5 7 7-7 7" ${stroke}/>`);
}

export function dropIcon() {
  return `<svg class="drop-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <path d="M8 1.8c2.1 2.8 3.8 4.8 3.8 7a3.8 3.8 0 1 1-7.6 0c0-2.2 1.7-4.2 3.8-7Z" fill="currentColor"/>
  </svg>`;
}

export function cloudOffIcon() {
  return `<svg class="error-icon" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <path d="${CLOUD_PATH}" fill="var(--w-cloud-fill)" stroke="var(--w-cloud-line)" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M14 50 50 14" stroke="var(--w-cloud-line)" stroke-width="3" stroke-linecap="round"/>
    <path d="M20 50h26" stroke="var(--w-cloud-line)" stroke-width="2" stroke-linecap="round" opacity=".35"/>
  </svg>`;
}
