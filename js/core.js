'use strict';
/* Dead Mobile – Hilfsfunktionen, Konstanten, Stellschrauben (CFG) */
const TEST = location.hash === '#test';
const KEY = 'dead-mobile-v1';
const REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const $ = s => document.querySelector(s);
const cv = $('#c'); let ctx = cv.getContext('2d');
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const hyp = Math.hypot;
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const turn = (a, b, m) => a + clamp(angDiff(b, a), -m, m);
function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ================= Stellschrauben ================= */
const CFG = {
  sRun: 4.0, sWalk: 1.85, sR: 0.3, kR: 0.32,
  kPatrol: 3.0, kInvest: 3.7, kChase: 4.4,
  sBurst: 6.8, burstT: 1.8, wipe: 2.2,
  viewR: 11, viewA: 1.08,
  lungeAt: 1.85, lungeT: 0.46, lungeV: 7.2, lungeWind: 0.12, lungeTurn: 1.1, hitR: 0.72, recover: 1.15,
  kVault: 1.55, kBreak: 2.3, stun: 2.2, track: 1.25, loseAfter: 5.5,
  sVaultFast: 0.42, sVaultSlow: 0.85, sVaultPal: 0.55,
  costWin: 6, costPal: 9, palletLoop: 20,
  markLife: 6, markStep: 0.38,
  genTime: 14, valveTime: 6,
};
