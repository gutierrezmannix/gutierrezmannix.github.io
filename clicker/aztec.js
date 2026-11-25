// Countdown dial in a Mexica sun-stone spirit (an original geometric design):
// 16 sun rays that burn out as time passes, a turning ring of stepped pyramids,
// a gold band that drains, 20 turquoise tiles (one per day sign) that go dark,
// and the seconds in an obsidian center. Gets orange at 10 s, red and pulsing at 5 s.

const RAYS = 16, SIGNS = 20, R_ARC = 57, C = 2 * Math.PI * R_ARC;

const f = n => Math.round(n * 100) / 100;
function polar(r, deg) {
  const a = (deg - 90) * Math.PI / 180;
  return [f(r * Math.cos(a)), f(r * Math.sin(a))];
}

let cache = null;
function art() {
  if (cache) return cache;
  // Sun rays: triangles from the outer band to the rim.
  let rays = "";
  for (let i = 0; i < RAYS; i++) {
    const c = i * 360 / RAYS, w = 360 / RAYS * 0.34;
    const [x1, y1] = polar(79, c - w), [x2, y2] = polar(99, c), [x3, y3] = polar(79, c + w);
    rays += `<polygon class="az-ray" data-i="${i}" points="${x1},${y1} ${x2},${y2} ${x3},${y3}"/>`;
    // small secondary ray between the main ones
    const d = c + 180 / RAYS, w2 = 360 / RAYS * 0.16;
    const [a1, b1] = polar(79, d - w2), [a2, b2] = polar(89, d), [a3, b3] = polar(79, d + w2);
    rays += `<polygon class="az-ray2" points="${a1},${b1} ${a2},${b2} ${a3},${b3}"/>`;
  }
  // Stepped pyramids around the band (one unit, rotated 24 times).
  const unit = "M -8.6,-66 V -68.6 H -5.8 V -71.2 H -2.9 V -73.8 H 2.9 V -71.2 H 5.8 V -68.6 H 8.6 V -66 Z";
  let fret = "";
  for (let i = 0; i < 24; i++) fret += `<path d="${unit}" transform="rotate(${i * 15})"/>`;
  // Day-sign tiles.
  let signs = "";
  for (let i = 0; i < SIGNS; i++) {
    const [x, y] = polar(46.5, i * 360 / SIGNS);
    signs += `<rect class="az-sign" data-i="${i}" x="${f(x - 3.1)}" y="${f(y - 3.1)}" width="6.2" height="6.2" rx="1" transform="rotate(${i * 360 / SIGNS} ${x} ${y})"/>`;
  }
  // Cardinal diamonds on the band.
  let card = "";
  for (let i = 0; i < 4; i++) {
    const [x, y] = polar(78, i * 90 + 45);
    card += `<rect x="${f(x - 3.6)}" y="${f(y - 3.6)}" width="7.2" height="7.2" transform="rotate(45 ${x} ${y})"/>`;
  }
  cache = { rays, fret, signs, card };
  return cache;
}

// Markup for one dial. `field` is the live-state key it follows ("timer").
export function dialHtml(field, cls) {
  const a = art();
  return `<div class="az ${cls || ""}" data-dial="${field}" role="timer" aria-label="Time left">
    <svg viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">
      <g class="az-rays">${a.rays}</g>
      <circle class="az-band" r="78"/>
      <g class="az-card">${a.card}</g>
      <g class="az-fret">${a.fret}</g>
      <circle class="az-track" r="${R_ARC}"/>
      <circle class="az-arc" r="${R_ARC}" stroke-dasharray="${f(C)}" stroke-dashoffset="0" transform="rotate(-90)"/>
      <g class="az-signs">${a.signs}</g>
      <circle class="az-core" r="40"/>
      <circle class="az-core-ring" r="35"/>
      <text class="az-num" x="0" y="2" text-anchor="middle" dominant-baseline="central">--</text>
      <text class="az-sub" x="0" y="24" text-anchor="middle">PAUSED</text>
    </svg>
  </div>`;
}

// Bring one dial up to date. leftMs: time left; totalMs: full time.
export function updateDial(el, leftMs, totalMs, paused) {
  if (!el) return;
  const total = Math.max(1, totalMs), left = Math.max(0, Math.min(total, leftMs));
  const frac = left / total;
  const secs = Math.ceil(left / 1000);
  const num = secs >= 60 ? Math.floor(secs / 60) + ":" + String(secs % 60).padStart(2, "0") : String(secs);
  const t = el.querySelector(".az-num");
  if (t && t.textContent !== num) {
    t.textContent = num;
    t.classList.toggle("long", num.length > 2);
    el.setAttribute("aria-label", secs + " seconds left");
  }
  const arc = el.querySelector(".az-arc");
  if (arc) arc.setAttribute("stroke-dashoffset", f(C * (1 - frac)));
  const raysLit = Math.ceil(frac * RAYS), signsLit = Math.ceil(frac * SIGNS);
  el.querySelectorAll(".az-ray").forEach(r => r.classList.toggle("out", Number(r.dataset.i) >= raysLit));
  el.querySelectorAll(".az-sign").forEach(r => r.classList.toggle("out", Number(r.dataset.i) >= signsLit));
  el.classList.toggle("az-paused", !!paused);
  el.classList.toggle("az-low", !paused && left > 0 && secs <= 10 && total > 10000);
  el.classList.toggle("az-crit", !paused && left > 0 && secs <= 5);
  el.classList.toggle("az-done", left <= 0);
}

// Update every dial inside `root` from the live state.
export function updateDials(root, live, now, timeLeft) {
  root.querySelectorAll("[data-dial]").forEach(el => {
    const t = live && live[el.dataset.dial];
    if (!t) return;
    updateDial(el, timeLeft(t, now), (Number(t.seconds) || 0) * 1000, t.paused);
  });
}
