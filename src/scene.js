import { getIntensity, getWeather, minutesOfDay } from './weather.js';

const THEME_COLORS = {
  'clear-day': '#0b3357',
  'clear-night': '#050b17',
  'partly-day': '#16384f',
  'partly-night': '#081120',
  'cloudy-day': '#263640',
  'cloudy-night': '#0c1218',
  'fog-day': '#343d44',
  'fog-night': '#0f1418',
  'drizzle-day': '#1a323e',
  'drizzle-night': '#09131a',
  'rain-day': '#172e3b',
  'rain-night': '#071119',
  'snow-day': '#273e50',
  'snow-night': '#0b1620',
  'thunder-day': '#101722',
  'thunder-night': '#05070c',
};

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

let base;
let fade;
let starsCanvas;
let precipCanvas;
let starsCtx;
let precipCtx;
let flash;
let bolt;
let themeColorMeta;

let state = {
  theme: 'clear-day',
  group: 'clear',
  phase: 'day',
  intensity: 'normal',
  started: false,
};

let width = window.innerWidth;
let height = window.innerHeight;
let dpr = 1;
let stars = [];
let particles = [];
let particleKind = null;
let particleFadeStart = 0;
let shootingStar = null;
let nextShootingStar = 0;
let raf = 0;
let lastFrame = 0;
let fadeTimer = 0;
let lightningTimer = 0;
let boltCleanup = 0;
let resizeRaf = 0;
let reduceMotion = reducedMotionQuery.matches;

function random(min, max) {
  return min + Math.random() * (max - min);
}

function fitCanvas(canvas, context) {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function createStars() {
  const count = Math.max(55, Math.min(190, Math.round((width * height) / 9000)));
  stars = Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height * 0.86,
    radius: random(0.4, 1.5),
    alpha: random(0.22, 0.92),
    twinkle: random(0.4, 1.6),
    phase: Math.random() * Math.PI * 2,
  }));
}

function resize() {
  cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => {
    fitCanvas(starsCanvas, starsCtx);
    fitCanvas(precipCanvas, precipCtx);
    createStars();
    buildParticles(state.group, state.intensity);
    if (reduceMotion) drawStatic();
    else startLoop();
  });
}

function starStrength() {
  if (state.phase === 'day') return 0;
  if (state.group === 'clear') {
    if (state.phase === 'night') return 1;
    return 0.36;
  }
  if (state.group === 'partly') {
    return state.phase === 'night' ? 0.42 : 0.18;
  }
  return 0;
}

function drawStars(time, dt) {
  const strength = starStrength();
  if (strength <= 0) {
    if (shootingStar) shootingStar = null;
    return;
  }

  for (const star of stars) {
    const twinkle = reduceMotion
      ? 1
      : 0.68 + 0.32 * Math.sin(time * 0.001 * star.twinkle + star.phase);
    starsCtx.globalAlpha = star.alpha * twinkle * strength;
    starsCtx.fillStyle = '#f4f8ff';
    starsCtx.beginPath();
    starsCtx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    starsCtx.fill();
  }
  starsCtx.globalAlpha = 1;

  if (reduceMotion || strength < 0.8) return;

  if (!shootingStar && time > nextShootingStar) {
    shootingStar = {
      x: random(width * 0.15, width * 0.85),
      y: random(height * 0.05, height * 0.35),
      vx: random(430, 700),
      vy: random(130, 240),
      age: 0,
      life: random(0.55, 0.9),
    };
  }

  if (shootingStar) {
    shootingStar.age += dt;
    const progress = shootingStar.age / shootingStar.life;
    if (progress >= 1) {
      shootingStar = null;
      nextShootingStar = time + random(12_000, 26_000);
    } else {
      const alpha = Math.sin(progress * Math.PI) * 0.9;
      const x = shootingStar.x + shootingStar.vx * shootingStar.age;
      const y = shootingStar.y + shootingStar.vy * shootingStar.age;
      const tail = 90;
      const gradient = starsCtx.createLinearGradient(x, y, x - tail, y - tail * 0.45);
      gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      starsCtx.strokeStyle = gradient;
      starsCtx.lineWidth = 1.4;
      starsCtx.beginPath();
      starsCtx.moveTo(x, y);
      starsCtx.lineTo(x - tail, y - tail * 0.45);
      starsCtx.stroke();
    }
  }
}

function particleCount(kind, intensity) {
  const area = Math.max(0.55, Math.min(1.7, (width * height) / (1440 * 900)));
  const baseCount = {
    drizzle: { light: 50, normal: 65, heavy: 85 },
    rain: { light: 90, normal: 145, heavy: 220 },
    thunder: { light: 130, normal: 175, heavy: 240 },
    snow: { light: 70, normal: 105, heavy: 150 },
  }[kind] ?? {};
  return Math.round((baseCount[intensity] ?? baseCount.normal ?? 80) * area);
}

function buildParticles(group, intensity) {
  particleKind = group === 'rain' || group === 'drizzle' || group === 'thunder' || group === 'snow'
    ? group
    : null;
  particles = [];
  particleFadeStart = performance.now();

  if (!particleKind) return;
  const count = particleCount(particleKind, intensity);
  const isSnow = particleKind === 'snow';
  const isDrizzle = particleKind === 'drizzle';

  particles = Array.from({ length: count }, () => {
    if (isSnow) {
      return {
        x: Math.random() * (width + 80) - 40,
        y: Math.random() * height,
        radius: random(0.7, 2.4),
        speed: random(28, 74),
        drift: random(-13, 13),
        phase: Math.random() * Math.PI * 2,
        alpha: random(0.35, 0.9),
      };
    }
    return {
      x: Math.random() * (width + 120) - 60,
      y: Math.random() * height,
      length: isDrizzle ? random(4, 9) : random(11, 26),
      speed: isDrizzle ? random(260, 420) : random(480, 980),
      drift: isDrizzle ? random(-55, -20) : random(-120, -55),
      alpha: random(isDrizzle ? 0.18 : 0.28, isDrizzle ? 0.4 : 0.68),
    };
  });
}

function drawParticles(time, dt) {
  precipCtx.clearRect(0, 0, width, height);
  if (!particles.length || !particleKind) return;

  const fadingIn = reduceMotion ? 1 : Math.min(1, (time - particleFadeStart) / 850);
  const isSnow = particleKind === 'snow';

  if (isSnow) {
    for (const flake of particles) {
      flake.y += flake.speed * dt;
      flake.x += (flake.drift + Math.sin(time * 0.001 + flake.phase) * 10) * dt;
      if (flake.y > height + 8) {
        flake.y = -8;
        flake.x = Math.random() * (width + 80) - 40;
      }
      if (flake.x > width + 20) flake.x = -20;
      if (flake.x < -20) flake.x = width + 20;

      precipCtx.globalAlpha = flake.alpha * fadingIn;
      precipCtx.fillStyle = '#f2f9ff';
      precipCtx.beginPath();
      precipCtx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
      precipCtx.fill();
    }
    precipCtx.globalAlpha = 1;
    return;
  }

  const isDrizzle = particleKind === 'drizzle';
  precipCtx.strokeStyle = isDrizzle ? 'rgba(190,226,255,.7)' : 'rgba(181,220,255,.78)';
  precipCtx.lineWidth = isDrizzle ? 1 : 1.35;
  precipCtx.lineCap = 'round';
  precipCtx.globalAlpha = fadingIn;
  precipCtx.beginPath();

  for (const drop of particles) {
    drop.y += drop.speed * dt;
    drop.x += drop.drift * dt;
    if (drop.y > height + drop.length) {
      drop.y = -drop.length - Math.random() * 60;
      drop.x = Math.random() * (width + 120) - 60;
    }
    if (drop.x < -30) drop.x = width + 30;

    const dx = (drop.length / drop.speed) * drop.drift;
    precipCtx.moveTo(drop.x, drop.y);
    precipCtx.lineTo(drop.x - dx, drop.y - drop.length);
  }

  precipCtx.stroke();
  precipCtx.globalAlpha = 1;
}

function drawStatic() {
  mainlyClear();
  drawStars(0, 0);
  drawParticles(0, 0);
}

function mainlyClear() {
  starsCtx.clearRect(0, 0, width, height);
  precipCtx.clearRect(0, 0, width, height);
}

function frame(time) {
  raf = 0;
  if (!state.started) return;
  const dt = lastFrame ? Math.min(0.05, (time - lastFrame) / 1000) : 0.016;
  lastFrame = time;

  mainlyClear();
  drawStars(time, dt);
  drawParticles(time, dt);

  raf = requestAnimationFrame(frame);
}

function startLoop() {
  if (reduceMotion) {
    drawStatic();
    return;
  }
  if (raf) return;
  lastFrame = 0;
  raf = requestAnimationFrame(frame);
}

function stopLoop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

function parseWindow(now, start, end) {
  if (now === null || start === null || end === null) return false;
  const normalize = (value) => ((Math.round(value) % 1440) + 1440) % 1440;
  start = normalize(start);
  end = normalize(end);
  if (start <= end) return now >= start && now <= end;
  return now >= start || now <= end;
}

function computePhase(currentTime, isDay, sunrise, sunset) {
  const now = minutesOfDay(currentTime);
  const rise = minutesOfDay(sunrise);
  const set = minutesOfDay(sunset);

  if (parseWindow(now, rise === null ? null : rise - 50, rise === null ? null : rise + 40)) {
    return 'dawn';
  }
  if (parseWindow(now, set === null ? null : set - 40, set === null ? null : set + 50)) {
    return 'dusk';
  }
  return isDay ? 'day' : 'night';
}

function settleTheme() {
  if (fadeTimer) {
    clearTimeout(fadeTimer);
    fadeTimer = 0;
    base.dataset.sky = fade.dataset.sky;
  }
}

function applyTheme(theme) {
  if (theme === state.theme) return;

  if (reduceMotion) {
    settleTheme();
    base.dataset.sky = theme;
    fade.dataset.sky = theme;
    fade.style.opacity = '0';
    state.theme = theme;
    updateThemeColor(theme);
    return;
  }

  settleTheme();
  fade.dataset.sky = theme;
  fade.style.transition = 'none';
  fade.style.opacity = '0';
  void fade.offsetWidth;

  requestAnimationFrame(() => {
    fade.style.transition = 'opacity 1.5s cubic-bezier(.4,0,.2,1)';
    fade.style.opacity = '1';
  });

  fadeTimer = window.setTimeout(() => {
    base.dataset.sky = theme;
    fade.style.transition = 'none';
    fade.style.opacity = '0';
    fadeTimer = 0;
  }, 1580);

  state.theme = theme;
  updateThemeColor(theme);
}

function updateThemeColor(theme) {
  const color = THEME_COLORS[theme] ?? '#0b3357';
  if (!themeColorMeta) themeColorMeta = document.querySelector('meta[name="theme-color"]');
  themeColorMeta?.setAttribute('content', color);
}

function clearLightning() {
  if (lightningTimer) clearTimeout(lightningTimer);
  lightningTimer = 0;
}

function scheduleLightning() {
  clearLightning();
  if (reduceMotion || state.group !== 'thunder') return;

  lightningTimer = window.setTimeout(() => {
    strikeLightning();
    scheduleLightning();
  }, random(3_800, 9_000));
}

function strikeLightning() {
  if (!flash || !bolt || state.group !== 'thunder' || reduceMotion) return;
  flash.classList.remove('is-active');
  bolt.classList.remove('is-active');
  void flash.offsetWidth;
  flash.classList.add('is-active');

  bolt.style.left = `${random(12, 78)}%`;
  bolt.style.top = `${random(6, 26)}%`;
  bolt.style.setProperty('--bolt-scale', random(0.72, 1.15).toFixed(2));
  bolt.style.transform = `rotate(${random(-9, 9).toFixed(1)}deg)`;
  bolt.classList.add('is-active');

  window.clearTimeout(boltCleanup);
  boltCleanup = window.setTimeout(() => {
    flash.classList.remove('is-active');
    bolt.classList.remove('is-active');
  }, 900);
}

function onVisibilityChange() {
  if (document.hidden) {
    stopLoop();
    clearLightning();
  } else {
    lastFrame = 0;
    startLoop();
    scheduleLightning();
  }
}

function onMotionPreference() {
  reduceMotion = reducedMotionQuery.matches;
  if (reduceMotion) {
    stopLoop();
    clearLightning();
    drawStatic();
  } else {
    startLoop();
    scheduleLightning();
  }
}

export function initScene() {
  base = document.querySelector('.sky__base');
  fade = document.querySelector('.sky__fade');
  starsCanvas = document.querySelector('.stars-canvas');
  precipCanvas = document.querySelector('.precip-canvas');
  flash = document.querySelector('.lightning-flash');
  bolt = document.querySelector('.lightning-bolt');
  themeColorMeta = document.querySelector('meta[name="theme-color"]');

  starsCtx = starsCanvas.getContext('2d', { alpha: true });
  precipCtx = precipCanvas.getContext('2d', { alpha: true });

  base.dataset.sky = state.theme;
  fade.dataset.sky = state.theme;
  fade.style.opacity = '0';

  fitCanvas(starsCanvas, starsCtx);
  fitCanvas(precipCanvas, precipCtx);
  createStars();
  state.started = true;
  startLoop();

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('orientationchange', resize, { passive: true });
  document.addEventListener('visibilitychange', onVisibilityChange);
  if (typeof reducedMotionQuery.addEventListener === 'function') {
    reducedMotionQuery.addEventListener('change', onMotionPreference);
  } else {
    reducedMotionQuery.addListener(onMotionPreference);
  }
}

export function updateScene(weather) {
  if (!weather?.current) return;

  const isDay = Number(weather.current.is_day) !== 0;
  const info = getWeather(weather.current.weather_code);
  const intensity = getIntensity(weather.current.weather_code);
  const phase = computePhase(
    weather.current.time,
    isDay,
    weather.daily?.sunrise?.[0],
    weather.daily?.sunset?.[0],
  );
  const theme = `${info.group}-${isDay ? 'day' : 'night'}`;

  const groupChanged = state.group !== info.group;
  const intensityChanged = state.intensity !== intensity;

  state.group = info.group;
  state.phase = phase;
  state.intensity = intensity;

  document.body.dataset.scene = info.group;
  document.body.dataset.phase = phase;
  document.body.dataset.intensity = intensity;

  applyTheme(theme);

  if (groupChanged || intensityChanged) {
    buildParticles(info.group, intensity);
  }

  if (info.group === 'thunder') scheduleLightning();
  else clearLightning();

  if (reduceMotion) drawStatic();
}
