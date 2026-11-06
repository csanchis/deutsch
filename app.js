/* Deutsch jeden Abend — app de alemán A1→A2 (estática; datos en data/, progreso en localStorage + Supabase) */
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pct = x => Math.round(x * 100) + '%';
const now = () => Date.now();
const DAY = 864e5, CUT = 4 * 3600e3;               // el día cambia a las 4:00 (sesiones nocturnas cuentan para el día anterior)
const today = () => { const d = new Date(now() - CUT); return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY); };
const fmtDay = (n, o = {day: 'numeric', month: 'short'}) => new Date(n * DAY).toLocaleDateString('es-ES', {...o, timeZone: 'UTC'});
const INT = [0, 1, 2, 4, 7, 12, 21, 40, 80];       // días hasta el siguiente repaso según la caja
const TOTAL_H = 180;                                // horas de estudio de referencia para llegar a A2 desde cero (clases + autoestudio)
const VOCAB_TARGET = 1200;                          // palabras activas aproximadas de un A2
const A1_MARK = 0.53;                               // posición de «A1» en la barra (todas las unidades A1 + ~600 palabras)

/* ───────── Estado ───────── */
const EPOCH = 2;                                    // subir para descartar todo el progreso anterior (local y remoto)
const blank = () => ({v: 2, epoch: EPOCH, cards: {}, log: {}, custom: {}, units: {}, pron: {}, sp: {}, games: {}, uq: [],
  set: {newPerDay: 8, focus: 'mix', autoSpeak: true, theme: 'auto', classH: 0, rate: 0.8, voice: '', gpool: 'mine', mig: 1, t: 0}});
let S = (() => { try { const s = JSON.parse(localStorage.getItem('de_state')); if (s && s.v && (s.epoch || 1) >= EPOCH) return {...blank(), ...s, set: {...blank().set, ...s.set}}; } catch {} return blank(); })();
// ajustes v2: voz más lenta por defecto y más palabras nuevas al día
if (!S.set.mig) { if (S.set.rate >= 0.95) S.set.rate = 0.8; if (S.set.newPerDay <= 5) S.set.newPerDay = 8; S.set.mig = 1; S.set.t = Date.now(); }
const persist = () => { try { localStorage.setItem('de_state', JSON.stringify(S)); } catch {} };
function save(delay = 2500) { persist(); schedulePush(delay); }
function logT() { const t = today(); return S.log[t] ||= {r: 0, n: 0, g: 0, sec: 0, ex: 0, t: now()}; }
function touch(o) { o.t = now(); return o; }

/* ───────── Sincronización (Supabase, tabla docs) ───────── */
const CFG = window.DE_CONFIG || {};
const PATH = 'deutsch/state';
const syncOn = () => !!(CFG.supabaseUrl && CFG.anonKey);
let syncStatus = syncOn() ? 'pendiente' : 'solo este dispositivo';
const H = () => ({apikey: CFG.anonKey, Authorization: 'Bearer ' + CFG.anonKey, 'Content-Type': 'application/json'});
const REST = () => CFG.supabaseUrl.replace(/\/$/, '') + '/rest/v1/docs';
function merge(a, b) {
  const m = blank();
  m.cards = {...a.cards};
  for (const [id, v] of Object.entries(b.cards || {})) if (!m.cards[id] || v[2] > m.cards[id][2]) m.cards[id] = v;
  for (const k of ['custom', 'units', 'pron', 'sp', 'games']) {
    m[k] = {...a[k]};
    for (const [id, v] of Object.entries(b[k] || {})) if (!m[k][id] || (v.t || 0) > (m[k][id].t || 0)) m[k][id] = v;
  }
  m.log = {...a.log};
  for (const [d, v] of Object.entries(b.log || {})) {
    const x = m.log[d]; if (!x) { m.log[d] = v; continue; }
    const y = {...x}; for (const f of ['r', 'n', 'g', 'sec', 'ex', 'xp', 'p', 't']) y[f] = Math.max(x[f] || 0, v[f] || 0);
    y.done = !!(x.done || v.done); m.log[d] = y;
  }
  m.epoch = Math.max(a.epoch || 1, b.epoch || 1);
  m.uq = [...new Set([...(a.uq || []), ...(b.uq || [])])];
  m.set = (b.set?.t || 0) > (a.set?.t || 0) ? {...blank().set, ...b.set} : a.set;
  return m;
}
let pushTimer, syncing = false;
let pushDue = 0;
function schedulePush(delay) { if (!syncOn()) return; const due = now() + delay; if (pushTimer && pushDue <= due) return; clearTimeout(pushTimer); pushDue = due; pushTimer = setTimeout(() => { pushTimer = null; sync(); }, delay); }
async function sync(final = false) {
  if (!syncOn() || syncing) return; syncing = true;
  try {
    if (!final) {
      const r = await fetch(REST() + '?select=data&path=eq.' + encodeURIComponent(PATH), {headers: H()});
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      if (j[0]?.data?.v && (j[0].data.epoch || 1) >= EPOCH) { const before = JSON.stringify(S); S = merge(S, j[0].data); persist(); if (JSON.stringify(S) !== before && !R) route(); }
    }
    const body = JSON.stringify({path: PATH, col: 'deutsch', data: S, updated_at: new Date().toISOString()});
    const r2 = await fetch(REST(), {method: 'POST', headers: {...H(), Prefer: 'resolution=merge-duplicates,return=minimal'}, body, keepalive: final && body.length < 60000});
    if (!r2.ok) throw new Error(r2.status);
    syncStatus = 'sincronizado ' + new Date().toLocaleTimeString('es-ES', {hour: '2-digit', minute: '2-digit'});
  } catch (e) { syncStatus = 'sin conexión (se guarda en este dispositivo)'; }
  syncing = false; const el = $('#syncst'); if (el) el.textContent = syncStatus;
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { persist(); sync(true); } else sync(); });

/* ───────── Datos ───────── */
let WORDS = {}, BASE = [], UNITS = [], UNIT = {}, UNIT_VOCAB = {}, G = null, SOUNDS = [], SOUND = {};
const slug = s => s.normalize('NFKD').replace(/ß/g, 'ss').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
function rebuildWords() {
  WORDS = {};
  for (const w of BASE) WORDS[w.id] = w;
  for (const u of UNITS) (u.vocab || []).forEach(v => { const id = 'u-' + u.id + '-' + slug((v.art || '') + ' ' + v.de); WORDS[id] = {...v, id, cat: 'unidad', unit: u.id}; });
  for (const [id, c] of Object.entries(S.custom)) if (!c.del) WORDS[id] = {...c, id, cat: 'clase'};
}
async function loadData() {
  const get = p => fetch(p).then(r => { if (!r.ok) throw new Error(p); return r.json(); });
  const [words, grammar, sounds, course] = await Promise.all([get('data/words.json'), get('data/grammar.json'), get('data/aussprache.json'), get('data/course.json')]);
  BASE = words; G = grammar; SOUNDS = sounds; UNITS = course.units;
  SOUNDS.forEach(s => SOUND[s.id] = s);
  UNITS.forEach(u => { UNIT[u.id] = u; UNIT_VOCAB[u.id] = (u.vocab || []).map(v => 'u-' + u.id + '-' + slug((v.art || '') + ' ' + v.de)); });
  rebuildWords();
  BOX = await fetch('data/boxen.json').then(r => r.ok ? r.json() : []).catch(() => []);
}

/* ───────── Voz: escuchar (TTS), reconocer y grabar ───────── */
let deVoice = null;
// las voces «Natural»/«Online» (Edge, Windows), Google y las mejoradas de Apple suenan mucho menos robóticas
const voiceScore = v => (/de-DE/i.test(v.lang) ? 10 : 0) + (/natural|neural|online/i.test(v.name) ? 8 : 0) + (/premium|enhanced|mejorad|erweitert/i.test(v.name) ? 6 : 0) + (/google/i.test(v.name) ? 5 : 0) + (/anna|petra|helena|katja|amala|seraphina|vicki|conrad|markus/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
const deVoices = () => ('speechSynthesis' in window ? speechSynthesis.getVoices() : []).filter(v => /^de(-|_|$)/i.test(v.lang)).sort((a, b) => voiceScore(b) - voiceScore(a));
function pickVoice() { const vs = deVoices(); deVoice = vs.find(v => v.name === S.set.voice) || vs[0] || null; }
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function utter(text, slow) {
  const u = new SpeechSynthesisUtterance(String(text).replace(/…/g, ''));
  u.lang = 'de-DE'; if (deVoice) u.voice = deVoice; u.rate = slow ? Math.max(0.5, S.set.rate * 0.72) : S.set.rate;
  return u;
}
function speak(text, slow = false) {
  if (!('speechSynthesis' in window) || !text) return;
  speechSynthesis.cancel(); speechSynthesis.speak(utter(text, slow));
}
/* lee varias frases seguidas con una pausa entre ellas; onLine(i) se llama al empezar cada una */
function speakSeq(lines, onLine = () => {}, from = 0) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel(); const tok = speakSeq.tok = {};
  const next = i => { if (tok !== speakSeq.tok || i >= lines.length) return onLine(-1); onLine(i); const u = utter(lines[i]); u.onend = () => setTimeout(() => next(i + 1), 450); speechSynthesis.speak(u); };
  next(from);
}
function stopSpeak() { speakSeq.tok = null; if ('speechSynthesis' in window) speechSynthesis.cancel(); }
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const normT = s => String(s).toLowerCase().replace(/[.,!?¿¡;:"«»„“”()…–—-]/g, ' ').replace(/\s+/g, ' ').trim();
function lev(a, b) { const m = a.length, n = b.length; if (!m) return n; if (!n) return m; let p = Array.from({length: n + 1}, (_, j) => j); for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[n]; }
function speechScore(target, heard) {
  const t = normT(target).split(' ').filter(Boolean), h = normT(heard).split(' ').filter(Boolean);
  const used = new Set(); const hits = t.map(w => { const k = h.findIndex((x, i) => !used.has(i) && (x === w || (w.length > 4 && lev(x, w) <= 1))); if (k >= 0) { used.add(k); return true; } return false; });
  return {score: t.length ? hits.filter(Boolean).length / t.length : 0, words: t, hits};
}
function recognize(target, onResult) {
  if (!SR) { onResult({error: 'Este navegador no reconoce voz. Usa Chrome (Android/ordenador) o Safari (iPhone). Puedes grabarte y compararte igualmente.'}); return null; }
  const r = new SR(); r.lang = 'de-DE'; r.interimResults = false; r.maxAlternatives = 5;
  r.onresult = e => { const alts = [...e.results[0]].map(a => a.transcript); let best = null; for (const a of alts) { const s = speechScore(target, a); if (!best || s.score > best.score) best = {...s, heard: a}; } onResult(best); };
  r.onerror = e => onResult({error: e.error === 'not-allowed' ? 'Permite el micrófono para practicar.' : e.error === 'no-speech' ? 'No te he oído. Pulsa y habla.' : 'No se pudo reconocer (' + e.error + ').'});
  r.start(); return r;
}
let rec = null, recChunks = [], recStream = null;
async function recordToggle(btn, onDone) {
  if (rec && rec.state === 'recording') { rec.stop(); return; }
  try {
    recStream = await navigator.mediaDevices.getUserMedia({audio: true});
    rec = new MediaRecorder(recStream); recChunks = [];
    rec.ondataavailable = e => recChunks.push(e.data);
    rec.onstop = () => { recStream.getTracks().forEach(t => t.stop()); btn.classList.remove('on'); btn.innerHTML = '⏺ Grabarme'; const url = URL.createObjectURL(new Blob(recChunks, {type: rec.mimeType})); onDone(url); };
    rec.start(); btn.classList.add('on'); btn.innerHTML = '⏹ Parar';
    setTimeout(() => { if (rec && rec.state === 'recording') rec.stop(); }, 8000);
  } catch { toast('No hay acceso al micrófono.'); }
}
/* fila de práctica oral reutilizable: data-say="texto" data-key="clave de progreso" */
function sayRow(text, key, extra = '') {
  return `<div class="say" data-say="${esc(text)}" data-key="${esc(key)}"><div class="row between"><div class="txt grow">${esc(text)}</div></div>${extra}
  <div class="row" style="margin-top:8px"><button class="btn sm" data-a="play">🔊</button><button class="btn sm" data-a="slow">🐢 Lento</button><button class="btn sm" data-a="mic">🎤 Decirlo</button><button class="btn sm" data-a="rec">⏺ Grabarme</button><button class="btn sm" data-a="mine" hidden>▶ Mi voz</button></div><div class="res"></div></div>`;
}
document.addEventListener('click', e => {
  const de = e.target.closest('span.de, [data-speak]'); if (de && !e.target.closest('button[data-a]')) { speak(de.dataset.speak || de.textContent); }
  const b = e.target.closest('.say button[data-a]'); if (!b) return;
  const row = b.closest('.say'), text = row.dataset.say, key = row.dataset.key, res = $('.res', row), a = b.dataset.a;
  if (a === 'play') speak(text); else if (a === 'slow') speak(text, true);
  else if (a === 'mine') { new Audio(row._url).play(); }
  else if (a === 'rec') recordToggle(b, url => { row._url = url; $('[data-a=mine]', row).hidden = false; new Audio(url).play(); markSpeak(key, false); });
  else if (a === 'mic') {
    b.disabled = true; res.innerHTML = '<span class="muted">Escuchando… habla ahora</span>';
    recognize(text, r => {
      b.disabled = false;
      if (r.error) { res.innerHTML = `<span class="muted">${esc(r.error)}</span>`; return; }
      const ok = r.score >= 0.8;
      res.innerHTML = `${r.words.map((w, i) => `<span class="${r.hits[i] ? 'hit' : 'miss'}">${esc(w)}</span>`).join(' ')} · <b>${pct(r.score)}</b> ${ok ? '— ¡se te entiende!' : '— repite las palabras en rojo'}<div class="muted tiny">He oído: «${esc(r.heard)}»</div>`;
      markSpeak(key, ok);
    });
  }
});
function markSpeak(key, ok) {
  if (!key) return;
  const [kind, id] = key.split(':'); const store = kind === 'pron' ? S.pron : S.sp; const k = kind === 'pron' ? id : key.slice(3);
  const o = store[k] ||= {n: 0, ok: 0}; o.n++; if (ok) o.ok++; touch(o); save();
}

/* ───────── Progreso y estimación ───────── */
function unitScore(id) { const u = S.units[id]; if (!u) return 0; return 0.15 * (u.r ? 1 : 0) + 0.45 * (u.ex || 0) + 0.40 * (u.pass ? 1 : 0.5 * (u.test || 0)); }
function knownCount() { return Object.values(S.cards).filter(c => c[0] >= 3).length; }
function soundDone(id) { const p = S.pron[id]; return !!p && (p.ok >= 1 || p.n >= 3); }
function totalSpeak() { return UNITS.reduce((a, u) => a + (u.speak || []).length, 0) || 1; }
function speakOkCount() { return Object.values(S.sp).filter(x => x.ok > 0 || x.n >= 3).length; }
function progress() {
  const course = UNITS.length ? UNITS.reduce((a, u) => a + unitScore(u.id), 0) / UNITS.length : 0;
  const vocab = Math.min(1, knownCount() / VOCAB_TARGET);
  const pron = 0.5 * (SOUNDS.filter(s => soundDone(s.id)).length / (SOUNDS.length || 1)) + 0.5 * Math.min(1, speakOkCount() / totalSpeak());
  return {course, vocab, pron, total: 0.6 * course + 0.25 * vocab + 0.15 * pron};
}
function pace() {
  const t = today(), days = Object.keys(S.log).map(Number).filter(d => d > t - 14);
  const first = days.length ? Math.min(...days) : t;
  const span = Math.max(1, t - first + 1);
  let sec = 0; for (let d = t - 13; d <= t; d++) sec += S.log[d]?.sec || 0;
  const real = span >= 3 && sec > 300;
  return {minPerDay: real ? sec / 60 / span : 15, real, span};
}
function eta(p = progress().total, minPerDay = pace().minPerDay) {
  const weeklyH = minPerDay * 7 / 60 + (+S.set.classH || 0);
  const remH = (1 - p) * TOTAL_H;
  const days = weeklyH > 0 ? Math.ceil(remH / weeklyH * 7) : Infinity;
  return {remH, weeklyH, days, date: isFinite(days) ? today() + days : null};
}
const fmtEta = e => e.date == null ? '—' : e.days <= 0 ? '¡ya!' : fmtDay(e.date, {month: 'long', year: 'numeric'});
function streak() { const t = today(); const ok = d => S.log[d] && (S.log[d].done || (S.log[d].sec || 0) >= 600); let d = ok(t) ? t : t - 1, s = 0; while (ok(d)) { s++; d--; } return {n: s, todayDone: ok(t)}; }
function nextUnit() { return UNITS.find(u => !S.units[u.id]?.pass) || null; }
function unitStep(u) { const s = S.units[u.id] || {}; if (!s.r) return {label: 'Empezar la clase', hash: `#leccion/${u.id}`}; if ((s.ex || 0) < 0.7) return {label: 'Hacer los ejercicios', hash: `#ej/${u.id}`}; return {label: 'Hacer el test', hash: `#test/${u.id}`}; }

/* tiempo activo: cuenta 15 s si la página está visible y hubo actividad en los últimos 90 s */
let lastAct = now();
['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(ev => addEventListener(ev, () => lastAct = now(), {passive: true}));
setInterval(() => { if (document.visibilityState === 'visible' && now() - lastAct < 90e3 && G) { const L = logT(); L.sec = (L.sec || 0) + 15; L.p = progress().total; touch(L); save(30000); } }, 15e3);

/* ───────── Palabras: repetición espaciada ───────── */
function newOrder() {
  const fresh = id => !S.cards[id] && WORDS[id];
  const custom = Object.entries(S.custom).filter(([, c]) => !c.del).sort((a, b) => a[1].c - b[1].c).map(x => x[0]);
  const unitV = S.uq.flatMap(u => UNIT_VOCAB[u] || []);
  const clase = BASE.filter(w => w.cat === 'clase').map(w => w.id);
  const rr = cats => { const ls = cats.map(c => BASE.filter(w => w.cat === c).map(w => w.id)); const out = []; for (let i = 0; ls.some(l => i < l.length); i++) for (const l of ls) if (i < l.length) out.push(l[i]); return out; };
  const B = rr(['pronombres', 'verbos', 'sustantivos', 'adjetivos', 'otras', 'adverbios', 'preposiciones']), T = rr(['boxeo', 'ejercicio', 'compras']);
  let mix = [];
  if (S.set.focus === 'basic') mix = [...B, ...T];
  else if (S.set.focus === 'temas') mix = [...T, ...B];
  else { let i = 0, j = 0; while (i < B.length || j < T.length) { for (let k = 0; k < 3 && i < B.length; k++) mix.push(B[i++]); for (let k = 0; k < 2 && j < T.length; k++) mix.push(T[j++]); } }
  return [...new Set([...custom, ...unitV, ...clase, ...mix])].filter(fresh);
}
function dueCards() { const t = today(); return Object.entries(S.cards).filter(([id, c]) => c[1] <= t && WORDS[id]).sort((a, b) => a[1][1] - b[1][1]).map(x => x[0]); }
function wordPlan() { const L = logT(); const due = dueCards(); return {rev: Math.min(due.length, 30), nw: Math.min(Math.max(0, S.set.newPerDay - (L.n || 0)), newOrder().length), gr: Math.max(0, 5 - (L.g || 0))}; }
function buildWordSession(extra = false) {
  const L = logT(), due = dueCards();
  const rev = shuffle(due).slice(0, extra ? 15 : 30);
  const news = newOrder().slice(0, extra ? 5 : Math.max(0, S.set.newPerDay - (L.n || 0)));
  const q = rev.map(id => ({t: 'card', id}));
  news.forEach((id, i) => { const at = Math.min(q.length, Math.round((i + 1) * q.length / (news.length + 1)) + i * 2); q.splice(at, 0, {t: 'intro', id}); });
  // tras cada presentación, la pregunta llega 3 tarjetas después
  for (const id of news) { const at = q.findIndex(x => x.t === 'intro' && x.id === id); q.splice(Math.min(q.length, at + 4), 0, {t: 'card', id}); }
  const gN = extra ? 3 : Math.max(0, 5 - (L.g || 0));
  for (let i = 0; i < gN; i++) q.push({...genGram(), gram: true});
  return q;
}
/* Ronda de repaso: 20 palabras ya vistas (pendientes primero, luego las más flojas) o el vocabulario de una unidad */
function buildRound(scope) {
  const t = today();
  if (scope && UNIT_VOCAB[scope]) return shuffle(UNIT_VOCAB[scope].filter(id => WORDS[id])).map(id => ({t: 'card', id, soft: true}));
  const seen = Object.entries(S.cards).filter(([id]) => WORDS[id]);
  const due = seen.filter(([, c]) => c[1] <= t).map(x => x[0]);
  const weak = shuffle(seen.filter(([id, c]) => c[1] > t)).sort((a, b) => (a[1][0] - a[1][4]) - (b[1][0] - b[1][4])).map(x => x[0]);
  const ids = scope === 'dificiles' ? seen.filter(([, c]) => c[4] > 0 || c[0] <= 1).sort((a, b) => b[1][4] - a[1][4]).map(x => x[0]).slice(0, 20)
    : [...new Set([...shuffle(due).slice(0, 12), ...weak])].slice(0, 20);
  const q = shuffle(ids).map(id => ({t: 'card', id, soft: true}));
  if (q.length < 12) newOrder().slice(0, 5).forEach((id, i) => { q.splice(i * 3, 0, {t: 'intro', id}); q.push({t: 'card', id}); });
  return q;
}
function grade(id, ok, soft = false) {
  const t = today(); let [b, d, , n, l] = S.cards[id] || [0, t, 0, 0, 0]; n++;
  if (ok && soft && S.cards[id] && d > t) { /* ronda extra: acertar algo que no tocaba no adelanta el repaso */ }
  else if (ok) { b = Math.min(b + 1, 8); d = t + INT[b]; } else { if (b > 0) l++; b = soft ? Math.max(0, Math.min(b, 2) - 1) : 0; d = t; }
  S.cards[id] = [b, d, now(), n, l]; const L = logT(); L.r++; touch(L); save();
}
function genGram() {
  const r = Math.random();
  if (r < 0.4) {
    const v = pick(G.verbs), i = rnd(6), pron = ['ich', 'du', pick(['er', 'sie', 'es']), 'wir', 'ihr', pick(['sie (ellos)', 'Sie'])][i], a = v.f[i];
    const o = shuffle([a, ...shuffle([...new Set(v.f)].filter(x => x !== a)).slice(0, 2)]);
    return {t: 'mc', q: `${pron} ___ (${v.inf})`, o, a: o.indexOf(a), exp: `${v.inf} (${v.es}): ` + G.pronouns.map((p, k) => `${p} ${v.f[k]}`).join(' · '), say: `${pron.replace(' (ellos)', '')} ${a}`};
  }
  if (r < 0.7) {
    const pool = Object.values(WORDS).filter(w => w && ['der', 'die', 'das'].includes(w.art) && S.cards[w.id]);
    const w = pick(pool.length >= 5 ? pool : Object.values(WORDS).filter(w => w && ['der', 'die', 'das'].includes(w.art) && w.cat === 'sustantivos'));
    const o = ['der', 'die', 'das'];
    return {t: 'mc', q: `___ ${w.de}`, o, a: o.indexOf(w.art), exp: `${w.art} ${w.de} = ${w.es}`, say: `${w.art} ${w.de}`};
  }
  const f = pick(G.frases), o = shuffle(f.o);
  return {t: 'mc', q: f.q, o, a: o.indexOf(f.a), exp: f.es};
}
function addCustom(text) {
  let n = 0;
  for (const line of text.split('\n')) {
    const m = line.split(/\s*(?:=|→|->|\t|:)\s*/); if (m.length < 2 || !m[0].trim() || !m[1].trim()) continue;
    let de = m[0].trim(), art = ''; const am = de.match(/^(der|die|das)\s+(.+)$/i); if (am) { art = am[1].toLowerCase(); de = am[2]; }
    const id = 'usr-' + slug(art + ' ' + de); if (S.custom[id] && !S.custom[id].del) continue;
    S.custom[id] = touch({de, art, es: m.slice(1).join(' = ').trim(), c: now()}); n++;
  }
  rebuildWords(); save(); return n;
}

/* ───────── Comprobación de respuestas escritas ───────── */
const strip = s => normT(s).replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
const normC = s => String(s).replace(/[.,!?¿¡;:"«»„“”()…–—-]/g, ' ').replace(/\s+/g, ' ').trim();
function checkText(input, accepted, strictCase = false) {
  const a = normT(input); if (!a) return {ok: false};
  for (const x of accepted) if (normC(x) === normC(input)) return {ok: true};
  for (const x of accepted) if (normT(x) === a) return strictCase
    ? {ok: false, note: 'Solo falla la mayúscula: en alemán cambia el significado o es obligatoria (sustantivos, Sie/Ihnen).'}
    : {ok: true, almost: true, note: 'Ojo con las mayúsculas: «' + x + '».'};
  for (const x of accepted) if (strip(x) === strip(input)) return {ok: true, note: 'Correcto, pero ojo con la escritura: «' + x + '» (ä, ö, ü, ß).'};
  for (const x of accepted) { const d = lev(strip(x), strip(input)); if (strip(x).length > 8 && d <= 1) return {ok: true, almost: true, note: 'Casi: se escribe «' + x + '».'}; }
  return {ok: false};
}

/* ───────── Ejecutor de ejercicios ───────── */
let R = null;
function sentenceOf(it) {
  if (it.say) return it.say;
  if (it.t === 'card') return WORDS[it.id] ? speakForm(WORDS[it.id]) : null;
  if (it.t === 'gap') return it.q.replace('___', it.a[0]);
  if (it.t === 'order') return it.a;
  if (it.t === 'listen') return it.de;
  if (it.t === 'tr') return it.a[0];
  if (it.t === 'mc' && it.q.includes('___')) return it.q.replace('___', it.o[it.a]);
  return null;
}
function answerOf(it) {
  if (it.t === 'card') { const w = WORDS[it.id]; return w ? `${speakForm(w)} = ${w.es}` : ''; }
  if (it.t === 'mc' || it.t === 'read') return it.o[it.a];
  if (it.t === 'gap') return it.q.replace('___', '<b>' + esc(it.a[0]) + '</b>');
  if (it.t === 'order') return it.a; if (it.t === 'listen') return it.de; if (it.t === 'tr') return it.a[0];
  return '';
}
function shuffleOpts(it) {   // baraja las opciones de elección múltiple manteniendo la respuesta correcta
  if ((it.t !== 'mc' && it.t !== 'read') || !Array.isArray(it.o)) return {...it};
  const idx = shuffle(it.o.map((_, i) => i));
  return {...it, o: idx.map(i => it.o[i]), a: idx.indexOf(it.a)};
}
function startRun(items, opt) {
  R = {items: items.map(shuffleOpts), i: 0, ok: 0, scored: 0, wrong: [], ...opt};
  if (!R.items.length) { R = null; toast('Aún no hay preguntas aquí.'); return route(); }
  document.body.classList.add('running'); window.scrollTo(0, 0); renderRun();
}
function quitRun() { R = null; document.body.classList.remove('running'); route(); }
function renderRun() {
  const app = $('#app');
  if (R.i >= R.items.length) return finishRun();
  const it = R.items[R.i]; R.answered = false;
  const total = R.items.length;
  app.innerHTML = `<div class="runner"><div class="rtop"><button class="btn icon ghost" id="rq" aria-label="Salir">✕</button><div class="bar"><i style="width:${R.i / total * 100}%"></i></div><span class="small muted">${R.i + 1}/${total}</span></div>
    <div class="tiny muted" style="text-transform:uppercase;letter-spacing:.06em">${esc(R.title)}${it.gram ? ' · gramática' : ''}${it.noScore ? ' · ¿qué crees?' : it.chk ? ' · comprueba' : ''}</div><div id="rb"></div><div class="fb" id="fb"></div></div>`;
  $('#rq').onclick = () => { if (R.mode !== 'test' || confirm('¿Salir del test? No se guardará la nota.')) quitRun(); };
  const rb = $('#rb'); (RENDER[it.t] || RENDER.mc)(it, rb);
}
function blankQ(q) { return esc(q).replace('___', '<span class="blank">&nbsp;?&nbsp;</span>'); }
function resolve(it, ok, extra = {}) {
  if (R.answered) return; R.answered = true;
  if (it.t === 'card') { grade(it.id, ok, it.soft || R.extra); if (!ok) R.wrong.push(it.id); }
  if (!it.retry && !it.noScore) { R.scored++; if (ok) R.ok++; }
  if (!ok && R.mode !== 'test' && !it.retry && !it.noScore) { if (it.t === 'card') R.items.splice(Math.min(R.items.length, R.i + 4), 0, {...it, retry: true}); else R.items.push({...it, retry: true}); }
  if (it.gram) { const L = logT(); L.g++; touch(L); save(); }
  if (R.mode !== 'words') { const L = logT(); L.ex++; touch(L); }
  const s = sentenceOf(it);
  const cls = ok ? (extra.almost ? 'almost' : 'ok') : 'bad';
  const title = it.noScore ? (ok ? '¡Bien visto!' : 'Buena intuición, pero no…') : ok ? (extra.almost ? 'Casi perfecto' : pick(['Richtig!', 'Genau!', 'Sehr gut!', 'Super!'])) : 'No es correcto';
  const w = it.t === 'card' ? WORDS[it.id] : null;
  $('#fb').innerHTML = `<div class="card ${cls}"><div class="title">${title}</div>
    ${!ok && it.t !== 'match' ? `<div>Respuesta: <span class="de">${it.t === 'gap' ? answerOf(it) : esc(answerOf(it))}</span></div>` : ''}
    ${extra.note ? `<div class="small">${esc(extra.note)}</div>` : ''}
    ${it.exp ? `<div class="${it.noScore ? '' : 'small '}ink2" style="margin-top:4px">${esc(it.exp)}</div>` : ''}
    ${it.es && it.t !== 'tr' ? `<div class="small muted" style="margin-top:4px">${esc(it.es)}</div>` : ''}
    ${w && ok ? `<div><span class="de">${esc(speakForm(w))}</span> = ${esc(w.es)}</div>` : ''}${w?.ex ? `<div class="small ink2" style="margin-top:4px;font-style:italic">${esc(w.ex)}</div>` : ''}
    <div class="row" style="margin-top:12px">${s ? `<button class="btn sm" data-speak="${esc(s)}">🔊 Escuchar</button>` : ''}<button class="btn primary grow" id="next" style="justify-content:center">Continuar</button></div></div>`;
  if (s && S.set.autoSpeak && R.mode !== 'test') speak(s);
  $('#next').onclick = () => { R.i++; renderRun(); };
  $('#next').focus({preventScroll: true});
}
const RENDER = {
  mc(it, el) {
    el.innerHTML = `<div class="prompt">${blankQ(it.q)}</div><div class="opts">${it.o.map((o, i) => `<button class="opt" data-i="${i}">${esc(o)}</button>`).join('')}</div>`;
    $$('.opt', el).forEach(b => b.onclick = () => { const i = +b.dataset.i, ok = i === it.a; $$('.opt', el).forEach(x => { x.disabled = true; if (+x.dataset.i === it.a) x.classList.add('ok'); }); if (!ok) b.classList.add('bad'); resolve(it, ok); });
  },
  read(it, el) {
    el.innerHTML = `<div class="reading"><span class="de" data-speak="${esc(it.text)}" style="border:none;font-weight:400">${esc(it.text)}</span></div><div class="prompt" style="font-size:18px">${esc(it.q)}</div><div class="opts">${it.o.map((o, i) => `<button class="opt" data-i="${i}">${esc(o)}</button>`).join('')}</div>`;
    $$('.opt', el).forEach(b => b.onclick = () => { const i = +b.dataset.i, ok = i === it.a; $$('.opt', el).forEach(x => { x.disabled = true; if (+x.dataset.i === it.a) x.classList.add('ok'); }); if (!ok) b.classList.add('bad'); resolve(it, ok); });
  },
  gap(it, el) {
    el.innerHTML = `<div class="prompt">${blankQ(it.q)}</div>${it.hint ? `<div class="small muted" style="margin:-8px 0 12px">Pista: ${esc(it.hint)}</div>` : ''}
      <input type="text" id="ans" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Escribe la palabra"><div class="row" style="margin-top:10px">${umlautKeys()}<button class="btn primary" id="chk" style="margin-left:auto">Comprobar</button></div>`;
    textInput(el, () => { const r = checkText($('#ans').value, it.a, true); resolve(it, r.ok, r); });
  },
  tr(it, el) {
    el.innerHTML = `<div class="small muted">Tradúcelo al alemán</div><div class="prompt">${esc(it.es)}</div>
      <input type="text" id="ans" autocomplete="off" autocapitalize="sentences" spellcheck="false" placeholder="Auf Deutsch…"><div class="row" style="margin-top:10px">${umlautKeys()}<button class="btn primary" id="chk" style="margin-left:auto">Comprobar</button></div>`;
    textInput(el, () => { const r = checkText($('#ans').value, it.a); resolve(it, r.ok, r); });
  },
  listen(it, el) {
    el.innerHTML = `<div class="small muted">Escucha y escribe lo que oyes</div><div class="row" style="margin:14px 0 18px"><button class="btn" data-speak="${esc(it.de)}">🔊 Escuchar</button><button class="btn" id="slow">🐢 Más lento</button></div>
      <input type="text" id="ans" autocomplete="off" autocapitalize="sentences" spellcheck="false" placeholder="Escribe en alemán"><div class="row" style="margin-top:10px">${umlautKeys()}<button class="btn primary" id="chk" style="margin-left:auto">Comprobar</button></div>`;
    $('#slow', el).onclick = () => speak(it.de, true); setTimeout(() => speak(it.de), 300);
    textInput(el, () => { const r = checkText($('#ans').value, [it.de]); resolve(it, r.ok, r); });
  },
  order(it, el) {
    const words = shuffle(it.w.map((w, i) => ({w, i})));
    el.innerHTML = `<div class="small muted">Ordena la frase${it.es ? ': ' + esc(it.es) : ''}</div><div class="chips answerline" id="line" style="margin-top:12px"></div><div class="chips" id="pool">${words.map(x => `<button class="chip" data-i="${x.i}">${esc(x.w)}</button>`).join('')}</div>
      <div class="row" style="margin-top:16px"><button class="btn sm ghost" id="clr">Borrar</button><button class="btn primary" id="chk" style="margin-left:auto" disabled>Comprobar</button></div>`;
    const line = [], upd = () => { $('#line', el).innerHTML = line.map(i => `<button class="chip" data-i="${i}">${esc(it.w[i])}</button>`).join(''); $$('#pool .chip', el).forEach(c => c.classList.toggle('used', line.includes(+c.dataset.i))); $('#chk', el).disabled = line.length !== it.w.length; };
    el.onclick = e => { const c = e.target.closest('.chip'); if (!c || R.answered) return; const i = +c.dataset.i; if (c.closest('#pool')) { if (!line.includes(i)) line.push(i); } else line.splice(line.indexOf(i), 1); upd(); };
    $('#clr', el).onclick = () => { line.length = 0; upd(); };
    $('#chk', el).onclick = () => { const s = line.map(i => it.w[i]).join(' '); resolve(it, [it.a, ...(it.alt || [])].some(x => normT(s) === normT(x))); };
  },
  match(it, el) {
    const L = shuffle(it.p.map((p, i) => ({t: p[0], i}))), Rr = shuffle(it.p.map((p, i) => ({t: p[1], i})));
    el.innerHTML = `<div class="small muted">Empareja cada palabra con su traducción</div><div class="match" style="margin-top:14px"><div class="stack" id="ml">${L.map(x => `<button class="chip" data-i="${x.i}">${esc(x.t)}</button>`).join('')}</div><div class="stack" id="mr">${Rr.map(x => `<button class="chip" data-i="${x.i}">${esc(x.t)}</button>`).join('')}</div></div>`;
    let sel = null, errors = 0, done = 0;
    el.onclick = e => {
      const c = e.target.closest('.chip'); if (!c || c.classList.contains('ok') || R.answered) return;
      if (c.closest('#ml')) { $$('#ml .chip', el).forEach(x => x.classList.remove('sel')); c.classList.add('sel'); sel = c; speak(c.textContent); return; }
      if (!sel) return;
      if (sel.dataset.i === c.dataset.i) { sel.classList.replace('sel', 'ok'); c.classList.add('ok'); sel.disabled = c.disabled = true; sel = null; if (++done === it.p.length) resolve(it, errors <= 1, errors === 1 ? {note: 'Un fallo por el camino.'} : {}); }
      else { errors++; c.classList.add('bad'); setTimeout(() => c.classList.remove('bad'), 500); }
    };
  },
  intro(it, el) {
    const w = WORDS[it.id];
    el.innerHTML = `<div class="small muted">Palabra nueva</div><div class="flash" style="margin-top:12px;cursor:default">${wordHead(w)}<div class="es">${esc(w.es)}</div>${w.ex ? `<div class="ex">${esc(w.ex)}</div>` : ''}${w.ph ? `<div class="tiny muted">[${esc(w.ph)}]</div>` : ''}
      <div class="row" style="justify-content:center;margin-top:10px"><button class="btn sm" data-speak="${esc(speakForm(w))}">🔊 Palabra</button>${w.ex ? `<button class="btn sm" data-speak="${esc(w.ex)}">🔊 Ejemplo</button>` : ''}</div></div>
      <button class="btn primary" id="next" style="width:100%;justify-content:center;margin-top:16px">Entendido</button>`;
    if (S.set.autoSpeak) setTimeout(() => speak(speakForm(w)), 250);
    if (!S.cards[it.id]) { S.cards[it.id] = [0, today(), now(), 0, 0]; const L = logT(); L.n++; touch(L); save(); }
    $('#next').onclick = () => { R.i++; renderRun(); }; $('#next').focus();
  },
  card(it, el) {   // repaso activo: el formato sube de dificultad según lo bien que te sabes la palabra
    const w = WORDS[it.id]; if (!w) { R.i++; return renderRun(); }
    const b = (S.cards[it.id] || [0])[0];
    const mode = it.retry ? pick(['de', 'es']) : b === 0 ? 'de' : b === 1 ? pick(['de', 'ear']) : b === 2 ? pick(['es', 'ear', 'es']) : Math.random() < 0.6 ? 'type' : pick(['es', 'ear']);
    if (mode === 'type') return RENDER.typeWord(it, el, w);
    const toEs = mode === 'de' || mode === 'ear';
    const shown = x => toEs ? x.es : speakForm(x);
    const pool = Object.values(WORDS).filter(x => x && x.id !== w.id && !!x.art === !!w.art && x.es !== w.es && x.de !== w.de);
    const seenPool = pool.filter(x => S.cards[x.id]);
    const ds = []; for (const x of shuffle(seenPool.length >= 8 ? seenPool : pool)) { if (ds.length === 3) break; if (!ds.some(d => shown(d) === shown(x))) ds.push(x); }
    const opts = shuffle([w, ...ds]);
    it.o = opts.map(shown); it.a = opts.indexOf(w);
    const head = mode === 'ear' ? `<div class="small muted">Escucha: ¿qué significa?</div><div class="row" style="justify-content:center;margin:18px 0"><button class="btn" data-speak="${esc(speakForm(w))}">🔊 Otra vez</button><button class="btn" id="slow">🐢 Lento</button></div>`
      : mode === 'de' ? `<div class="small muted">¿Qué significa?</div><div class="flash" style="min-height:0;padding:22px 16px;margin:10px 0 16px;cursor:default">${wordHead(w)}</div>`
      : `<div class="small muted">¿Cómo se dice en alemán?</div><div class="prompt" style="margin-top:8px">${esc(w.es)}</div>`;
    el.innerHTML = `${head}<div class="opts">${it.o.map((o, i) => `<button class="opt" data-i="${i}">${esc(o)}</button>`).join('')}</div>`;
    if (toEs && (S.set.autoSpeak || mode === 'ear')) setTimeout(() => speak(speakForm(w)), 250);
    if ($('#slow', el)) $('#slow', el).onclick = () => speak(speakForm(w), true);
    $$('.opt', el).forEach(bt => bt.onclick = () => { const i = +bt.dataset.i, ok = i === it.a; $$('.opt', el).forEach(x => { x.disabled = true; if (+x.dataset.i === it.a) x.classList.add('ok'); }); if (!ok) bt.classList.add('bad'); resolve(it, ok); });
  },
  typeWord(it, el, w) {
    el.innerHTML = `<div class="small muted">Escríbelo en alemán${w.art ? ' (con el artículo)' : ''}</div><div class="prompt" style="margin-top:8px">${esc(w.es)}</div>
      <input type="text" id="ans" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${w.art ? 'der / die / das …' : 'Auf Deutsch…'}"><div class="row" style="margin-top:10px">${umlautKeys()}<button class="btn sm ghost" id="idk" type="button">No lo sé</button><button class="btn primary" id="chk" style="margin-left:auto">Comprobar</button></div>`;
    const target = speakForm(w).replace(/…/g, '').trim();
    $('#idk', el).onclick = () => { $('#ans', el).disabled = true; resolve(it, false); };
    textInput(el, () => {
      const v = $('#ans', el).value.trim();
      let r = checkText(v, [target]);
      if (!r.ok && w.art) {
        const m = v.match(/^(der|die|das)\s+(.+)$/i), body = m ? m[2] : v;
        if (checkText(body, [w.de]).ok) r = m ? {ok: false, note: `La palabra está bien, pero el artículo es «${w.art}».`} : {ok: true, almost: true, note: `Bien, pero apréndela con su artículo: «${w.art} ${w.de}».`};
      }
      resolve(it, r.ok, r);
    });
  },
};
const speakForm = w => (w.art ? w.art + ' ' : '') + w.de;
const wordHead = w => `${w.art ? `<div class="art-${w.art}" style="font-size:17px;font-weight:600">${w.art}</div>` : ''}<div class="word">${esc(w.de)}</div>${w.pl ? `<div class="tiny muted">plural: ${esc(w.pl)}</div>` : ''}`;
const umlautKeys = () => ['ä', 'ö', 'ü', 'ß'].map(c => `<button class="btn sm" data-k="${c}" type="button">${c}</button>`).join('');
function textInput(el, check) {
  const inp = $('#ans', el); setTimeout(() => inp.focus(), 50);
  $$('[data-k]', el).forEach(b => b.onclick = () => { const s = inp.selectionStart ?? inp.value.length; inp.value = inp.value.slice(0, s) + b.dataset.k + inp.value.slice(inp.selectionEnd ?? s); inp.focus(); inp.setSelectionRange(s + 1, s + 1); });
  const go = () => { if (R.answered || !inp.value.trim()) return; inp.disabled = true; inp.blur(); check(); };
  $('#chk', el).onclick = go; inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
}
document.addEventListener('keydown', e => {
  if (!R || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (R.answered && e.key === 'Enter') { const n = $('#next'); if (n && document.activeElement !== n) { e.preventDefault(); n.click(); } return; }
  const n = +e.key; if (n >= 1 && n <= 4) { const o = $$('.opt')[n - 1]; if (o && !o.disabled) o.click(); }
});
function finishRun() {
  const score = R.scored ? R.ok / R.scored : 1, r = R; R = null;
  let msg = '', extra = '';
  if (r.mode === 'ex' || r.mode === 'test') {
    const u = S.units[r.unit] ||= {};
    if (r.mode === 'ex') u.ex = Math.max(u.ex || 0, score);
    else { u.test = Math.max(u.test || 0, score); if (score >= 0.8 && !u.pass) { u.pass = now(); extra = '<p style="margin-top:8px">Unidad completada ✓</p>'; } }
    touch(u); save(1000);
    msg = r.mode === 'test' ? (score >= 0.8 ? '¡Test aprobado!' : 'Necesitas un 80 % para aprobar. Repasa la explicación y vuelve a intentarlo.') : (score >= 0.7 ? 'Buen trabajo. Cuando quieras, haz el test.' : 'Los fallos los has repetido al final. Prueba otra vez mañana.');
  } else if (r.mode === 'lesson') {
    const u = S.units[r.unit] ||= {}; u.r = u.r || now(); u.lq = Math.max(u.lq || 0, score); touch(u); save(1000);
    msg = 'Clase terminada. Ahora fíjalo con los ejercicios.';
  } else if (r.mode === 'story') {
    const st = S.units[r.story] ||= {}; st.st = now(); touch(st); save(1000);
    msg = score >= 0.67 ? 'Lo has entendido. Bis zum nächsten Mal!' : 'Vuelve a leerlo tocando las frases para ver la traducción.';
  } else if (r.mode === 'words') {
    const L = logT(); if (!r.extra) L.done = true; touch(L); save(1000);
    if (r.wrong.length) extra = `<div class="card plain" style="text-align:left;margin-top:18px"><div class="small muted" style="margin-bottom:6px">Las que fallaste (vuelven pronto en tu repaso):</div>${[...new Set(r.wrong)].map(id => WORDS[id]).filter(Boolean).slice(0, 15).map(w => `<div class="w" data-speak="${esc(speakForm(w))}" style="cursor:pointer"><span class="de">${w.art ? `<span class="art-${w.art}">${w.art}</span> ` : ''}${esc(w.de)}</span> <span class="ink2">— ${esc(w.es)}</span></div>`).join('')}</div>`;
    msg = new Date().getHours() >= 20 || new Date().getHours() < 4 ? 'Gute Nacht! Dormir después de estudiar ayuda a fijar lo aprendido.' : 'Bis morgen!';
  } else { save(1000); }
  const st = streak();
  document.body.classList.remove('running');
  history.replaceState(null, '', '#fin');   // así «Hecho» / «Volver a la unidad» siempre navegan
  $('#app').innerHTML = `<div class="wrap"><div class="result"><div class="big">${pct(score)}</div><p class="muted" style="margin-top:6px">${r.ok} de ${r.scored} a la primera</p>
    <p style="margin-top:16px;font-size:18px">${esc(msg)}</p>${extra}<p class="small muted" style="margin-top:10px">Racha: ${st.n} ${st.n === 1 ? 'día' : 'días'}</p>
    <div class="row" style="justify-content:center;margin-top:24px">${r.mode === 'words' ? `<a class="btn" href="#ronda">Otra ronda</a>` : ''}${r.mode === 'lesson' ? `<a class="btn primary" href="#ej/${r.unit}">Ir a los ejercicios</a>` : ''}${r.unit ? `<a class="btn" href="#unidad/${r.unit}">Volver a la unidad</a>` : ''}${r.story ? `<a class="btn" href="${UNIT[r.story] ? '#historia/' : '#boxen/'}${r.story}">Volver al texto</a>` : ''}<a class="btn ${r.mode === 'lesson' ? '' : 'primary'}" href="#hoy">Hecho</a></div></div></div>`;
}

/* ───────── Clase guiada: la explicación por trocitos, con preguntas antes y después ───────── */
function splitLesson(html) {
  const doc = new DOMParser().parseFromString(`<div>${sanitize(html)}</div>`, 'text/html');
  const out = []; let cur = '', len = 0, hasTable = false;
  for (const n of doc.body.firstChild.childNodes) {
    const h = n.nodeType === 1 ? n.outerHTML : esc(n.textContent); if (!h.trim()) continue;
    const isT = n.nodeName === 'TABLE', l = (n.textContent || '').length;
    if (cur && ((isT && hasTable) || len + l > (isT ? 260 : 420))) { out.push(cur); cur = ''; len = 0; hasTable = false; }
    cur += h; len += isT ? 150 : l; hasTable ||= isT;
  }
  if (cur) out.push(cur);
  return out;
}
function buildLesson(u) {
  const q = [], L = u.lessons || [];
  L.forEach((l, j) => {
    if (l.pre) q.push({...l.pre, noScore: true});
    const chunks = splitLesson(l.html), checks = (l.check || []).map(c => ({...c, chk: true}));
    const n = chunks.length, m = checks.length;
    const at = checks.map((_, i) => i === m - 1 ? n : Math.max(1, Math.round((i + 1) * n / (m + 0.5))));
    chunks.forEach((html, k) => { q.push({t: 'slide', h: l.h, html, part: `${j + 1}/${L.length}`}); checks.forEach((c, i) => { if (at[i] === k + 1) q.push(c); }); });
  });
  return q;
}
RENDER.slide = (it, el) => {
  el.innerHTML = `<div class="card plain lesson slide"><div class="tiny muted">Bloque ${it.part}</div><h3>${esc(it.h)}</h3>${it.html}</div>
    <div class="tiny muted" style="margin-top:8px">Toca el alemán subrayado para oírlo.</div>
    <button class="btn primary" id="next" style="width:100%;justify-content:center;margin-top:14px">Siguiente</button>`;
  $$('.slide span.de', el).forEach(x => x.setAttribute('role', 'button'));
  $('#next').onclick = () => { R.i++; renderRun(); }; $('#next').focus({preventScroll: true});
};

/* ───────── Historias (episodios por unidad) y «Boxen auf Deutsch» ───────── */
let BOX = [];
const storyOf = id => UNIT[id]?.story || BOX.find(b => b.id === id) || null;
function storyOpen(u) { const i = UNITS.indexOf(u), nu = nextUnit(); return !nu || i <= UNITS.indexOf(nu) || !!S.units[u.id]; }
function viewHistoria(id) {
  const st = storyOf(id), u = UNIT[id], box = !u; if (!st) return go(box ? '#boxen' : '#curso');
  const lines = st.lines, ytq = st.yt ? `https://www.youtube.com/results?search_query=${encodeURIComponent(st.yt)}` : '';
  const ep = u ? UNITS.filter(x => x.story).indexOf(u) + 1 : 0;
  page(box ? 'jugar' : 'curso', `<a href="${box ? '#boxen' : '#historias'}" class="small muted" style="text-decoration:none">← ${box ? 'Boxen auf Deutsch' : 'Die leuchtende Hefe'}</a>
    <div class="row" style="margin-top:10px">${u ? `<span class="tag orange">Episodio ${ep}</span><span class="tag">tras la unidad ${u.n}</span>` : `<span class="tag orange">${esc(st.kind || '')}</span><span class="tag">desde la unidad ${UNIT[st.unit]?.n || ''}</span>`}${S.units[id]?.st ? '<span class="tag teal">Leído ✓</span>' : ''}</div>
    <h1 style="margin-top:8px" class="de" data-speak="${esc(st.title)}">${esc(st.title)}</h1><div class="ink2">${esc(st.title_es || '')}</div>
    ${st.gloss?.length ? `<details class="card plain" style="margin-top:14px"><summary>Palabras útiles (${st.gloss.length})</summary><div class="vocab" style="margin-top:8px">${st.gloss.map(([d, e]) => `<div data-speak="${esc(d)}"><span class="de">${esc(d)}</span><div class="small muted">${esc(e)}</div></div>`).join('')}</div></details>` : ''}
    <div class="row" style="margin:16px 0 4px"><button class="btn sm" id="all">▶ Escuchar todo</button><button class="btn sm" id="showall">Mostrar todo el texto</button>${ytq ? `<a class="btn sm" href="${ytq}" target="_blank" rel="noopener">▶ Vídeos en YouTube</a>` : ''}</div>
    <div class="tiny muted">Toca una frase para ver la traducción; 🔊 la lee.</div>
    <div class="story" id="story">${lines.map((l, i) => `<div class="sl" data-i="${i}" hidden>${l.who ? `<div class="who">${esc(l.who)}</div>` : ''}<div class="row" style="flex-wrap:nowrap;align-items:flex-start"><div class="grow sde">${esc(l.de)}</div><button class="btn icon ghost sm" data-speak="${esc(l.de)}" aria-label="Escuchar">🔊</button></div><div class="ses" hidden>${esc(l.es)}</div></div>`).join('')}</div>
    <button class="btn primary" id="more" style="width:100%;justify-content:center;margin-top:14px">Siguiente frase</button>
    <div id="endq" hidden style="margin-top:18px"><div class="card row between"><div><div>${(st.q || []).length} preguntas de comprensión</div><div class="small muted">¿Lo has entendido todo?</div></div><a class="btn primary" href="#preguntas/${id}">Responder</a></div>
    ${u ? (() => { const i = UNITS.indexOf(u), nx = UNITS.slice(i + 1).find(x => x.story); return nx ? `<p class="small muted" style="margin-top:14px">Siguiente episodio: tras la unidad ${nx.n}${storyOpen(nx) ? ` · <a href="#historia/${nx.id}">${esc(nx.story.title)} →</a>` : ''}</p>` : ''; })() : ''}</div>`);
  const els = $$('.sl'), seen = S.units[id]?.st; let shown = 0;
  const reveal = (k, say = true) => { for (; shown <= k && shown < els.length; shown++) els[shown].hidden = false; if (say) speak(lines[k].de); els[k].scrollIntoView({block: 'nearest', behavior: 'smooth'}); if (shown >= els.length) { $('#more').hidden = true; $('#endq').hidden = false; } };
  if (seen) reveal(els.length - 1, false); else reveal(0, S.set.autoSpeak);
  $('#more').onclick = () => reveal(shown);
  $('#showall').onclick = () => reveal(els.length - 1, false);
  $('#story').onclick = e => { const l = e.target.closest('.sl'); if (!l || e.target.closest('button')) return; $('.ses', l).hidden = !$('.ses', l).hidden; };
  $('#all').onclick = () => { if ($('#all').dataset.on) { stopSpeak(); return; } $('#all').dataset.on = 1; $('#all').textContent = '⏹ Parar';
    speakSeq(lines.map(l => l.de), i => { els.forEach(x => x.classList.remove('now')); if (i < 0) { const b = $('#all'); if (b) { delete b.dataset.on; b.textContent = '▶ Escuchar todo'; } return; } reveal(i, false); els[i].classList.add('now'); }); };
}
function viewHistorias() {
  const eps = UNITS.filter(u => u.story);
  page('curso', `<a href="#curso" class="small muted" style="text-decoration:none">← Curso</a><h1 style="margin-top:8px">Die leuchtende Hefe</h1>
    <p class="ink2" style="margin-top:6px">Una historia de misterio por entregas: Lucía, bióloga de Valencia, empieza el doctorado en Heidelberg… y alguien se interesa demasiado por su levadura que brilla. Un episodio por unidad, escrito con la gramática que acabas de aprender.</p>
    <div style="margin-top:16px">${eps.map((u, i) => { const ok = storyOpen(u), rd = S.units[u.id]?.st;
      return ok ? `<a class="unit ${rd ? 'pass' : ''}" href="#historia/${u.id}"><div class="num">${rd ? '✓' : i + 1}</div><div class="grow"><div class="de">${esc(u.story.title)}</div><div class="small muted">${esc(u.story.title_es || '')} · tras la unidad ${u.n}</div></div></a>`
        : `<div class="unit" style="opacity:.5"><div class="num">🔒</div><div class="grow"><div>Episodio ${i + 1}</div><div class="small muted">Se desbloquea al llegar a la unidad ${u.n}</div></div></div>`; }).join('')}</div>`);
}
function viewBoxen() {
  const nu = nextUnit(), cur = nu ? UNITS.indexOf(nu) : UNITS.length;
  const kinds = [...new Set(BOX.map(b => b.kind))];
  page('jugar', `<a href="#jugar" class="small muted" style="text-decoration:none">← Jugar</a><h1 style="margin-top:8px">Boxen auf Deutsch</h1>
    <p class="ink2" style="margin-top:6px">Técnica, entreno e historia del boxeo y la lucha, en alemán de tu nivel. Cada texto trae audio, traducción frase a frase, preguntas y una búsqueda de vídeos en YouTube para verlo en acción.</p>
    ${kinds.map(k => `<h2 style="text-transform:capitalize">${esc(k)}</h2>${BOX.filter(b => b.kind === k).map(b => { const lv = UNITS.findIndex(u => u.id === b.unit), easy = lv <= cur, rd = S.units[b.id]?.st;
      return `<a class="unit ${rd ? 'pass' : ''}" href="#boxen/${b.id}" style="${easy ? '' : 'opacity:.6'}"><div class="num">${rd ? '✓' : '🥊'}</div><div class="grow"><div class="de">${esc(b.title)}</div><div class="small muted">${esc(b.title_es)} · ${easy ? 'a tu nivel' : 'más fácil tras la unidad ' + (UNIT[b.unit]?.n || '?')}</div></div></a>`; }).join('')}`).join('') || '<p class="muted">Cargando…</p>'}`);
}

/* ───────── Vistas ───────── */
const ICON = {
  hoy: '<svg viewBox="0 0 24 24"><path d="M12 3a6 6 0 1 0 9 9 9 9 0 1 1-9-9z"/></svg>',
  curso: '<svg viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/></svg>',
  palabras: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="13" height="15" rx="2"/><path d="M8 2h11a2 2 0 0 1 2 2v13"/></svg>',
  hablar: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  progreso: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  jugar: '<svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3M15.5 12h.01M18 14h.01"/></svg>',
};
function nav(cur) { return `<nav class="tabs">${[['hoy', 'Hoy'], ['curso', 'Curso'], ['jugar', 'Jugar'], ['palabras', 'Palabras'], ['hablar', 'Hablar'], ['progreso', 'Progreso']].map(([k, l]) => `<a href="#${k}" class="${cur === k ? 'on' : ''}">${ICON[k]}${l}</a>`).join('')}</nav>`; }
function page(cur, html) { $('#app').innerHTML = `<div class="wrap">${html}</div>${nav(cur)}`; }
function bigBar(p) {
  return `<div class="bigbar"><div class="bar"><i style="width:${(p * 100).toFixed(1)}%"></i></div><div class="mark" style="left:${A1_MARK * 100}%"><span>A1</span></div><div class="mark" style="left:calc(100% - 2px)"><span style="left:auto;right:0;transform:none">A2</span></div></div>`;
}
function daysStrip(n = 14, cls = '') {
  const t = today(); let h = '';
  for (let d = t - n + 1; d <= t; d++) { const s = (S.log[d]?.sec || 0) / 60; const l = S.log[d]?.done || s >= 20 ? 3 : s >= 8 ? 2 : s > 0 ? 1 : 0; h += `<i class="l${l} ${d === t ? 'today' : ''}" title="${fmtDay(d)} · ${Math.round(s)} min"></i>`; }
  return `<div class="days ${cls}">${h}</div>`;
}
function viewHoy() {
  const P = progress(), e = eta(P.total), st = streak(), wp = wordPlan(), L = logT(), nu = nextUnit();
  const h = new Date().getHours(), hi = h < 4 || h >= 20 ? 'Guten Abend' : h < 12 ? 'Guten Morgen' : 'Guten Tag';
  const mins = Math.max(3, Math.round((wp.rev * 8 + wp.nw * 25 + wp.gr * 12) / 60));
  const sod = SOUNDS.find(s => !soundDone(s.id)) || SOUNDS[today() % SOUNDS.length];
  const wordsDone = !!L.done;
  page('hoy', `<div class="row between"><div><div class="muted small">${fmtDay(today(), {weekday: 'long', day: 'numeric', month: 'long'})}</div><h1>${hi}, Claudia</h1></div>
    <div class="streak" title="Días seguidos"><b>${st.n}</b><span class="muted small">${st.n === 1 ? 'día' : 'días'}<br>seguidos</span></div></div>
    ${daysStrip()}
    <a href="#progreso" style="text-decoration:none;display:block;margin-top:22px"><div class="row between small"><span><b>${pct(P.total)}</b> del camino a A2</span><span class="muted">A2 ≈ ${fmtEta(e)}</span></div>${bigBar(P.total)}</a>
    <h2>Hoy</h2>
    <div class="stack">
      <div class="card task ${wordsDone ? 'done' : ''}"><div class="n">${wordsDone ? '✓' : 1}</div><div class="grow"><h3>Palabras</h3>
        <div class="small ink2">${wordsDone ? 'Repaso de hoy hecho.' : `${wp.rev} repasos · ${wp.nw} nuevas · ${wp.gr} de gramática · ≈ ${mins} min`}</div>
        <div class="row" style="margin-top:10px">${wordsDone ? `<a class="btn sm" href="#ronda">Ronda de repaso (20)</a>` : `<a class="btn primary" href="#sesion">Empezar</a>`}</div></div></div>
      ${nu ? (() => { const s = unitStep(nu); return `<div class="card task"><div class="n">2</div><div class="grow"><h3>Curso · Unidad ${nu.n}</h3><div class="small ink2">${esc(nu.title)} — ${esc(nu.title_es)}</div><div class="bar thin" style="margin:8px 0"><i style="width:${unitScore(nu.id) * 100}%"></i></div><div class="row"><a class="btn sm ${s.hash.startsWith('#leccion') ? 'primary' : ''}" href="${s.hash}">${s.label}</a>${(() => { const ep = UNITS.slice(0, UNITS.indexOf(nu) + 1).reverse().find(x => x.story && !S.units[x.id]?.st && (x === nu ? (S.units[x.id]?.ex || 0) > 0 || S.units[x.id]?.r : true)); return ep ? `<a class="btn sm" href="#historia/${ep.id}">📖 Episodio: ${esc(ep.story.title)}</a>` : ''; })()}</div></div></div>`; })() : `<div class="card task done"><div class="n">✓</div><div><h3>Curso completado</h3><div class="small ink2">Has aprobado las 22 unidades.</div></div></div>`}
      ${sod ? `<div class="card task ${soundDone(sod.id) ? 'done' : ''}"><div class="n">${soundDone(sod.id) ? '✓' : 3}</div><div class="grow"><h3>Pronunciación · ${esc(sod.t)}</h3><div class="small ink2">Escucha, repite y comprueba si se te entiende.</div><div class="row" style="margin-top:10px"><a class="btn sm" href="#sonido/${sod.id}">Practicar</a></div></div></div>` : ''}
    </div>
    <a class="unit" href="#jugar" style="margin-top:14px"><div class="tag orange" style="width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:700;flex:none">▶</div><div class="grow"><div style="font-weight:600">¿Sin ganas de estudiar? Juega</div><div class="small muted">Contrarreloj, der/die/das, parejas… también cuenta para tu racha${L.xp ? ` · hoy ${L.xp} puntos` : ''}</div></div></a>
    <details class="card plain" style="margin-top:22px"><summary>＋ Apuntar palabras de clase</summary>
      <textarea id="addtxt" placeholder="Una por línea:\njetzt = ahora\ndie Schweiz = Suiza\ntanzen = bailar"></textarea>
      <div class="row" style="margin-top:8px"><span class="tiny muted grow">Entran primero en tu repaso diario.</span><button class="btn sm primary" id="addbtn">Guardar</button></div></details>`);
  $('#addbtn').onclick = () => { const n = addCustom($('#addtxt').value); toast(n ? `${n} ${n === 1 ? 'palabra añadida' : 'palabras añadidas'}` : 'Escribe «alemán = español», una por línea'); if (n) route(); };
}
function viewCurso() {
  const nu = nextUnit();
  const list = lvl => UNITS.filter(u => u.level === lvl).map(u => { const s = S.units[u.id] || {}; const sc = unitScore(u.id);
    return `<a class="unit ${s.pass ? 'pass' : ''} ${nu && nu.id === u.id ? 'next' : ''}" href="#unidad/${u.id}"><div class="num">${s.pass ? '✓' : u.n}</div><div class="grow"><div class="de">${esc(u.title)}</div><div class="small muted">${esc(u.title_es)}</div><div class="bar thin" style="margin-top:6px"><i style="width:${sc * 100}%"></i></div></div></a>`; }).join('');
  const passed = lvl => UNITS.filter(u => u.level === lvl && S.units[u.id]?.pass).length, tot = lvl => UNITS.filter(u => u.level === lvl).length;
  page('curso', `<h1>Curso</h1><p class="ink2" style="margin-top:6px">Cada unidad tiene una clase guiada, vocabulario, ejercicios, un episodio de la historia, práctica oral y un test final (aprobado con 80 %). Si ya dominas una unidad, puedes ir directamente al test.</p>
    ${UNITS.some(u => u.story) ? `<a class="unit" href="#historias" style="margin-top:14px"><div class="tag orange" style="width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:700;flex:none">📖</div><div class="grow"><div style="font-weight:600" class="de">Die leuchtende Hefe</div><div class="small muted">La historia por entregas: ${UNITS.filter(u => u.story && S.units[u.id]?.st).length} de ${UNITS.filter(u => u.story).length} episodios leídos</div></div></a>` : ''}
    <h2>A1 <span class="muted small" style="font-weight:400">· ${passed('A1')}/${tot('A1')} aprobadas</span></h2>${list('A1')}
    <h2>A2 <span class="muted small" style="font-weight:400">· ${passed('A2')}/${tot('A2')} aprobadas</span></h2>${list('A2')}`);
}
const ALLOWED = new Set(['P', 'B', 'I', 'EM', 'STRONG', 'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'BR', 'SPAN']);
function sanitize(html) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html'), root = doc.body.firstChild;
  (function walk(n) { for (const c of [...n.childNodes]) { if (c.nodeType === 1) { if (!ALLOWED.has(c.tagName)) { c.replaceWith(...[...c.childNodes]); continue; } for (const a of [...c.attributes]) if (!(a.name === 'class' && c.tagName === 'SPAN' && a.value === 'de')) c.removeAttribute(a.name); walk(c); } else if (c.nodeType !== 3) c.remove(); } })(root);
  return root.innerHTML;
}
function viewUnidad(id) {
  const u = UNIT[id]; if (!u) return go('#curso');
  if (!S.uq.includes(id)) { S.uq.push(id); save(); }
  const s = S.units[id] || {};
  const nT = (u.test || []).length, nE = (u.exercises || []).length;
  page('curso', `<a href="#curso" class="small muted" style="text-decoration:none">← Curso</a>
    <div class="row" style="margin-top:10px"><span class="tag">${u.level} · Unidad ${u.n}</span>${s.pass ? '<span class="tag teal">Aprobada</span>' : ''}</div>
    <h1 style="margin-top:8px" class="de" data-speak="${esc(u.title)}">${esc(u.title)}</h1><div class="ink2">${esc(u.title_es)}</div>
    <div class="bar thin" style="margin:12px 0"><i style="width:${unitScore(id) * 100}%"></i></div>
    ${u.goals?.length ? `<ul class="small ink2" style="padding-left:18px">${u.goals.map(g => `<li>${esc(g)}</li>`).join('')}</ul>` : ''}
    <div class="subnav"><a href="#u-exp">Clase</a><a href="#u-voc">Vocabulario</a><a href="#u-ej">Ejercicios</a>${u.story ? '<a href="#u-his">Historia</a>' : ''}<a href="#u-hab">Hablar</a><a href="#u-test">Test</a></div>
    <h2 id="u-exp">Clase</h2>
    <div class="card row between"><div><div>Clase guiada · ${(u.lessons || []).length} bloques</div><div class="small muted">Explicación a trocitos con preguntas por el camino${s.lq != null ? ' · ' + pct(s.lq) + ' a la primera' : ''}</div></div><a class="btn ${s.r ? '' : 'primary'}" href="#leccion/${id}">${s.r ? 'Repetir' : 'Empezar'}</a></div>
    <details class="card plain" style="margin-top:10px"><summary>Apuntes: toda la explicación de un vistazo</summary>
      <div class="stack" style="margin-top:10px">${(u.lessons || []).map(l => `<div class="lesson"><h3>${esc(l.h)}</h3>${sanitize(l.html)}</div>`).join('')}</div>
      <div class="row" style="margin-top:12px">${s.r ? '' : `<button class="btn sm" id="read">Ya me lo sé: marcar como vista</button>`}<span class="tiny muted">Toca el alemán subrayado para oírlo.</span></div></details>
    <h2 id="u-voc">Vocabulario <span class="muted small" style="font-weight:400">· ${(u.vocab || []).length} palabras, ya en tu repaso diario</span></h2>
    <div class="row" style="margin-bottom:10px"><a class="btn sm" href="#ronda/${id}">Repasar estas ${(u.vocab || []).length} palabras</a></div>
    <div class="vocab">${(u.vocab || []).map(v => `<div data-speak="${esc(speakForm(v))}"><span class="de">${v.art ? `<span class="art-${v.art}">${v.art}</span> ` : ''}${esc(v.de)}</span>${v.pl ? ` <span class="tiny muted">(${esc(v.pl)})</span>` : ''}<div class="small muted">${esc(v.es)}</div></div>`).join('')}</div>
    <h2 id="u-ej">Ejercicios</h2>
    <div class="card row between"><div><div>${nE} ejercicios</div><div class="small muted">${s.ex != null ? 'Mejor resultado: ' + pct(s.ex) : 'Sin hacer'}</div></div><a class="btn primary" href="#ej/${id}">${s.ex != null ? 'Repetir' : 'Empezar'}</a></div>
    ${u.story ? `<h2 id="u-his">Historia</h2><a class="unit ${s.st ? 'pass' : ''}" href="#historia/${id}"><div class="num">${s.st ? '✓' : '📖'}</div><div class="grow"><div class="de">${esc(u.story.title)}</div><div class="small muted">Die leuchtende Hefe · episodio ${UNITS.filter(x => x.story).indexOf(u) + 1} · ${esc(u.story.title_es || '')}</div></div></a>` : ''}
    <h2 id="u-hab">Hablar</h2>
    <p class="small ink2">Escucha, repite en voz alta y pulsa 🎤 para comprobar si se te entiende. Con ⏺ te grabas y te comparas con el modelo.</p>
    ${(u.speak || []).map((p, i) => sayRow(p.de, `sp:${id}#${i}`, `<div class="small muted">${esc(p.es)}${p.tip ? ` · <span class="ink2">${esc(p.tip)}</span>` : ''}</div>`)).join('')}
    <h2 id="u-test">Test de la unidad</h2>
    <div class="card row between"><div><div>${nT} preguntas · aprobado con 80 %</div><div class="small muted">${s.test != null ? 'Mejor nota: ' + pct(s.test) : 'Sin hacer'}</div></div><a class="btn ${s.pass ? '' : 'primary'}" href="#test/${id}">Hacer el test</a></div>
    ${(() => { const i = UNITS.indexOf(u), nx = UNITS[i + 1]; return nx ? `<p style="margin-top:28px"><a href="#unidad/${nx.id}" class="small">Siguiente: ${esc(nx.title)} →</a></p>` : ''; })()}`);
  const rb = $('#read'); if (rb) rb.onclick = () => { (S.units[id] ||= {}).r = now(); touch(S.units[id]); save(); route(); };
  $$('.subnav a').forEach(a => a.onclick = e => { e.preventDefault(); $(a.getAttribute('href')).scrollIntoView({behavior: 'smooth'}); });
}
let listState = {q: '', f: 'all', lim: 150};
const CATS = {clase: 'De clase', unidad: 'Del curso', pronombres: 'Pronombres', verbos: 'Verbos', sustantivos: 'Sustantivos', adjetivos: 'Adjetivos', adverbios: 'Adverbios', preposiciones: 'Preposiciones', otras: 'Otras', boxeo: 'Boxeo', ejercicio: 'Ejercicio', compras: 'Compras'};
function viewPalabras() {
  const all = Object.values(WORDS).filter(Boolean);
  const known = knownCount(), learning = Object.values(S.cards).filter(c => c[0] < 3).length;
  page('palabras', `<h1>Palabras</h1>
    <div class="kpis" style="margin-top:14px"><div class="kpi"><b>${known}</b><span>sabidas</span></div><div class="kpi"><b>${learning}</b><span>aprendiendo</span></div><div class="kpi"><b>${all.length - known - learning}</b><span>por descubrir</span></div></div>
    <div class="card" style="margin-top:14px"><h3>Rondas de repaso</h3><div class="small ink2">20 palabras que ya has visto: eliges el significado, la reconoces de oído o la escribes. Cuanto mejor te la sabes, más difícil la pregunta.</div>
      <div class="row" style="margin-top:10px"><a class="btn primary" href="#ronda">Ronda de 20</a><a class="btn" href="#ronda/dificiles">Las que más fallo</a></div></div>
    <details class="card plain" style="margin-top:14px"><summary>＋ Apuntar palabras de clase</summary><textarea id="addtxt" placeholder="Una por línea:\njetzt = ahora\ndie Schweiz = Suiza"></textarea><div class="row" style="margin-top:8px"><span class="tiny muted grow">También vale «alemán: español» o con tabulador.</span><button class="btn sm primary" id="addbtn">Guardar</button></div></details>
    <div class="row" style="margin:16px 0 6px"><input type="search" id="q" placeholder="Buscar en alemán o español" value="${esc(listState.q)}" class="grow" style="flex:2;min-width:160px">
    <select id="f" style="flex:1;min-width:140px"><option value="all">Todas</option><option value="st:k">Sabidas</option><option value="st:l">Aprendiendo</option><option value="st:n">Por descubrir</option>${Object.entries(CATS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
    <div class="wl" id="wl"></div><div id="more"></div>`);
  $('#f').value = listState.f;
  const draw = () => {
    const q = normT(listState.q), f = listState.f;
    const st = id => { const c = S.cards[id]; return !c ? 'n' : c[0] >= 3 ? 'k' : 'l'; };
    const rows = all.filter(w => (!q || normT(w.de).includes(q) || normT(w.es).includes(q)) && (f === 'all' || (f.startsWith('st:') ? st(w.id) === f[3] : w.cat === f)));
    $('#wl').innerHTML = rows.slice(0, listState.lim).map(w => `<div class="w"><span class="dot ${st(w.id)}"></span><div class="grow" data-speak="${esc(speakForm(w))}" style="cursor:pointer"><span class="de">${w.art ? `<span class="art-${w.art}">${w.art}</span> ` : ''}${esc(w.de)}</span> <span class="ink2">— ${esc(w.es)}</span></div>${w.id.startsWith('usr-') ? `<button class="btn icon ghost sm" data-del="${w.id}" title="Borrar">✕</button>` : ''}</div>`).join('') || '<p class="muted">Nada por aquí.</p>';
    $('#more').innerHTML = rows.length > listState.lim ? `<button class="btn sm" style="margin-top:12px" id="mb">Mostrar más (${rows.length - listState.lim})</button>` : `<p class="tiny muted" style="margin-top:12px">${rows.length} palabras</p>`;
    const mb = $('#mb'); if (mb) mb.onclick = () => { listState.lim += 300; draw(); };
    $$('[data-del]').forEach(b => b.onclick = () => { const c = S.custom[b.dataset.del]; if (c) { c.del = 1; touch(c); } delete S.cards[b.dataset.del]; rebuildWords(); save(); viewPalabras(); });
  };
  $('#q').oninput = e => { listState.q = e.target.value; listState.lim = 150; draw(); };
  $('#f').onchange = e => { listState.f = e.target.value; listState.lim = 150; draw(); };
  $('#addbtn').onclick = () => { const n = addCustom($('#addtxt').value); toast(n ? `${n} ${n === 1 ? 'palabra añadida' : 'palabras añadidas'}` : 'Escribe «alemán = español», una por línea'); if (n) viewPalabras(); };
  draw();
}
function viewHablar() {
  const done = SOUNDS.filter(s => soundDone(s.id)).length;
  page('hablar', `<h1>Hablar</h1><p class="ink2" style="margin-top:6px">Los sonidos del alemán que más cuestan a un hispanohablante. En cada uno: escucha el modelo, repítelo, grábate y comprueba con el micrófono si se te entiende.</p>
    ${SR ? '' : '<div class="card small" style="margin-top:12px">Este navegador no tiene reconocimiento de voz: abre la web en Chrome (Android u ordenador) o en Safari (iPhone) para la comprobación 🎤. Grabarte y escucharte funciona igual.</div>'}
    <div class="row between small" style="margin-top:16px"><span>${done} de ${SOUNDS.length} sonidos practicados</span></div><div class="bar thin purple" style="margin:6px 0 16px"><i style="width:${done / SOUNDS.length * 100}%"></i></div>
    ${SOUNDS.map((s, i) => `<a class="unit ${soundDone(s.id) ? 'pass' : ''}" href="#sonido/${s.id}"><div class="num">${soundDone(s.id) ? '✓' : i + 1}</div><div class="grow"><div class="de">${esc(s.t)}</div><div class="small muted">${esc(s.ipa)} · ${esc(s.w.slice(0, 4).join(', '))}</div></div></a>`).join('')}
    <h2>Frases del curso</h2><p class="small ink2">Cada unidad tiene su sección «Hablar» con frases útiles. Llevas ${speakOkCount()} de ${totalSpeak()} practicadas.</p>`);
}
function viewSonido(id) {
  const s = SOUND[id]; if (!s) return go('#hablar');
  const i = SOUNDS.indexOf(s), nx = SOUNDS[i + 1];
  page('hablar', `<a href="#hablar" class="small muted" style="text-decoration:none">← Hablar</a>
    <div class="row" style="margin-top:10px"><span class="tag purple">${esc(s.ipa)}</span>${soundDone(id) ? '<span class="tag teal">Practicado</span>' : ''}</div>
    <h1 style="margin-top:8px">${esc(s.t)}</h1>
    <div class="card plain lesson" style="margin-top:14px">${sanitize(s.tip)}</div>
    <h2>Palabras</h2><p class="small muted">Toca para escuchar; luego practica las de abajo.</p>
    <div class="wordgrid">${s.w.map(w => `<button class="chip" data-speak="${esc(w)}">${esc(w)}</button>`).join('')}</div>
    <h2>Practica</h2>
    ${[...s.w.slice(0, 4), ...s.s].map(t => sayRow(t, 'pron:' + id)).join('')}
    ${nx ? `<p style="margin-top:28px"><a href="#sonido/${nx.id}" class="small">Siguiente sonido: ${esc(nx.t)} →</a></p>` : ''}`);
}
function viewProgreso() {
  const P = progress(), pc = pace(), e = eta(P.total, pc.minPerDay);
  const passed = UNITS.filter(u => S.units[u.id]?.pass).length;
  const a1left = Math.max(0, A1_MARK - P.total);
  const a1days = a1left > 0 && e.weeklyH > 0 ? Math.ceil(a1left * TOTAL_H / e.weeklyH * 7) : 0;
  const scen = [10, 20, 30, 45].map(m => ({m, e: eta(P.total, m)}));
  const t = today(); const recent = Object.entries(S.log).filter(([d]) => +d > t - 30 && S.log[d].p).sort((a, b) => a[0] - b[0]);
  let realRate = '';
  if (recent.length >= 7) { const [d0, l0] = recent[0], [d1, l1] = recent[recent.length - 1]; const rate = (l1.p - l0.p) / Math.max(1, d1 - d0); if (rate > 0) { const dd = Math.ceil((1 - P.total) / rate); realRate = `<p class="small ink2" style="margin-top:8px">A tu ritmo real de avance de los últimos ${d1 - d0} días (+${(rate * 700).toFixed(1)} puntos/semana): A2 hacia <b>${fmtDay(t + dd, {month: 'long', year: 'numeric'})}</b>.</p>`; } }
  page('progreso', `<h1>Progreso</h1>
    <div class="row between" style="margin-top:16px"><span><b style="font-size:28px">${pct(P.total)}</b> <span class="muted">hacia A2</span></span><span class="small muted">${passed}/${UNITS.length} unidades</span></div>
    ${bigBar(P.total)}
    <div class="stack" style="margin-top:6px">
      <div><div class="row between small"><span>Curso (gramática, ejercicios y tests) · 60 %</span><b>${pct(P.course)}</b></div><div class="bar thin" style="margin-top:4px"><i style="width:${P.course * 100}%"></i></div></div>
      <div><div class="row between small"><span>Vocabulario (${knownCount()} de ~${VOCAB_TARGET} palabras sabidas) · 25 %</span><b>${pct(P.vocab)}</b></div><div class="bar thin teal" style="margin-top:4px"><i style="width:${P.vocab * 100}%"></i></div></div>
      <div><div class="row between small"><span>Pronunciación y habla · 15 %</span><b>${pct(P.pron)}</b></div><div class="bar thin purple" style="margin-top:4px"><i style="width:${P.pron * 100}%"></i></div></div>
    </div>
    <h2>¿Cuándo tendré A2?</h2>
    <div class="card"><div style="font-size:20px">A2 hacia <b>${fmtEta(e)}</b></div>
      <div class="small ink2" style="margin-top:4px">${a1days ? `A1 hacia ${fmtDay(t + a1days, {month: 'long', year: 'numeric'})}. ` : ''}Te quedan ≈ ${Math.round(e.remH)} h de estudio. Ritmo: ${Math.round(pc.minPerDay)} min/día con la app${pc.real ? '' : ' (supuesto: aún no hay datos suficientes)'}${S.set.classH ? ` + ${S.set.classH} h/semana de clase` : ''}.</div>${realRate}
      <div class="small muted" style="margin-top:10px">Referencia: llegar a A2 desde cero lleva unas ${TOTAL_H} h de estudio en total (el Goethe-Institut estima 150–260 sesiones de 45 min, clases incluidas). La estimación se ajusta sola a tu ritmo real; añade tus horas de clase abajo para afinarla.</div>
      <table class="small" style="margin-top:12px;width:100%;border-collapse:collapse">${scen.map(x => `<tr><td style="padding:4px 0;border-bottom:1px solid var(--grid)">${x.m} min/día${S.set.classH ? ' + clase' : ''}</td><td style="text-align:right;border-bottom:1px solid var(--grid)"><b>${fmtEta(x.e)}</b></td></tr>`).join('')}</table></div>
    <h2>Últimas 4 semanas</h2>${daysStrip(28, 'cal')}<p class="tiny muted" style="margin-top:6px">Cada cuadro es un día: más oscuro = más minutos. La racha cuenta si terminas el repaso de palabras o estudias 10 min.</p>
    <h2>Ajustes</h2>
    <div class="stack card plain">
      <label class="row between">Palabras nuevas al día <select id="s-new" style="width:auto">${[3, 5, 8, 10, 15].map(n => `<option ${S.set.newPerDay == n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="row between">Orden de palabras nuevas <select id="s-focus" style="width:auto"><option value="mix">Mezcla básico + mis temas</option><option value="basic">Primero lo básico</option><option value="temas">Primero boxeo, ejercicio, compras</option></select></label>
      <label class="row between">Horas de clase a la semana <input type="number" id="s-class" min="0" max="20" step="0.5" value="${S.set.classH}" style="width:90px"></label>
      <label class="row between">Leer en voz alta automáticamente <input type="checkbox" id="s-auto" ${S.set.autoSpeak ? 'checked' : ''} style="width:20px;height:20px"></label>
      <label class="row between">Velocidad de la voz <select id="s-rate" style="width:auto"><option value="0.6">Muy lenta</option><option value="0.7">Lenta</option><option value="0.8">Pausada (recomendada)</option><option value="0.9">Normal</option><option value="1">Rápida</option></select></label>
      ${deVoices().length > 1 ? `<label class="row between">Voz <select id="s-voice" style="width:auto;max-width:60%">${deVoices().map(v => `<option value="${esc(v.name)}">${esc(v.name.replace(/^Microsoft |^Google /, ''))}</option>`).join('')}</select></label>` : ''}
      <label class="row between">Tema <select id="s-theme" style="width:auto"><option value="auto">Automático</option><option value="light">Claro</option><option value="dark">Oscuro</option></select></label>
      <div class="row between"><span class="sync" id="syncst">${esc(syncStatus)}</span><span class="row"><button class="btn sm" id="exp">Exportar</button><label class="btn sm">Importar<input type="file" id="imp" accept="application/json" hidden></label></span></div>
      <div class="tiny muted">Voz: ${deVoice ? esc(deVoice.name) : 'alemana del sistema'}. Si suena robótica: en Android instala «Google: servicios de voz» y la voz alemana de alta calidad; en iPhone, Ajustes › Accesibilidad › Contenido leído › Voces › Alemán › «Anna (mejorada)»; en ordenador, Edge trae voces «Natural» muy buenas. Luego elígela aquí.</div>
    </div>`);
  $('#s-focus').value = S.set.focus; $('#s-rate').value = String(S.set.rate); if ($('#s-voice') && deVoice) $('#s-voice').value = deVoice.name;
  if ($('#s-voice')) $('#s-voice').onchange = e => { setv('voice', e.target.value); pickVoice(); speak('Hallo, ich bin deine Stimme.'); }; $('#s-theme').value = S.set.theme;
  const setv = (k, v) => { S.set[k] = v; touch(S.set); save(); applyTheme(); };
  $('#s-new').onchange = e => setv('newPerDay', +e.target.value);
  $('#s-focus').onchange = e => setv('focus', e.target.value);
  $('#s-class').onchange = e => { setv('classH', Math.max(0, +e.target.value || 0)); viewProgreso(); };
  $('#s-auto').onchange = e => setv('autoSpeak', e.target.checked);
  $('#s-rate').onchange = e => { setv('rate', +e.target.value); speak('Hallo, ich bin deine Stimme.'); };
  $('#s-theme').onchange = e => setv('theme', e.target.value);
  $('#exp').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], {type: 'application/json'})); a.download = `deutsch-progreso-${new Date().toISOString().slice(0, 10)}.json`; a.click(); };
  $('#imp').onchange = async e => { try { const d = JSON.parse(await e.target.files[0].text()); if (!d.v) throw 0; if ((d.epoch || 1) < EPOCH) d.epoch = EPOCH; S = merge(S, d); rebuildWords(); save(500); toast('Progreso importado'); route(); } catch { toast('Ese archivo no es una copia válida'); } };
}
function applyTheme() { const t = S.set.theme; if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = t; }
function toast(m) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = m; document.body.appendChild(d); setTimeout(() => d.remove(), 2600); }
function go(h) { location.hash = h; }

/* ───────── Rutas ───────── */
function route() {
  if (!G) return;
  const [v, arg] = (location.hash.slice(1) || 'hoy').split('/');
  if (R && !['sesion', 'mas', 'ej', 'test', 'ronda', 'leccion', 'preguntas'].includes(v)) { R = null; document.body.classList.remove('running'); }
  if (v !== 'historia' && v !== 'boxen') stopSpeak();
  if (typeof GM !== 'undefined' && GM && v !== 'juego') stopGame();
  if (v === 'juego') return startGame(arg);
  if (v === 'sesion') { history.replaceState(null, '', '#hoy'); const q = buildWordSession(); if (!q.length) { toast('No hay nada pendiente. ¡Bien!'); return viewHoy(); } return startRun(q, {mode: 'words', title: 'Palabras de hoy'}); }
  if (v === 'mas' || v === 'ronda') {
    history.replaceState(null, '', arg && UNIT[arg] ? '#unidad/' + arg : '#palabras'); const q = buildRound(arg);
    if (!q.length) { toast('Aún no has visto palabras: empieza por «Palabras de hoy».'); return viewPalabras(); }
    return startRun(q, {mode: 'words', extra: true, unit: UNIT[arg] ? arg : null, title: UNIT[arg] ? 'Vocabulario · ' + UNIT[arg].title : arg === 'dificiles' ? 'Las difíciles' : 'Ronda de repaso'});
  }
  if (v === 'leccion' && UNIT[arg]) { history.replaceState(null, '', '#unidad/' + arg); return startRun(buildLesson(UNIT[arg]), {mode: 'lesson', unit: arg, title: 'Clase · ' + UNIT[arg].title}); }
  if (v === 'preguntas') { const st = storyOf(arg); if (st) { history.replaceState(null, '', (UNIT[arg] ? '#historia/' : '#boxen/') + arg); return startRun(st.q || [], {mode: 'story', story: arg, unit: null, title: st.title}); } }
  if ((v === 'ej' || v === 'test') && UNIT[arg]) { history.replaceState(null, '', '#unidad/' + arg); const u = UNIT[arg]; const items = v === 'ej' ? shuffle(u.exercises || []) : shuffle(u.test || []); return startRun(items, {mode: v === 'ej' ? 'ex' : 'test', unit: arg, title: `${v === 'ej' ? 'Ejercicios' : 'Test'} · ${u.title}`}); }
  window.scrollTo(0, 0);
  ({hoy: viewHoy, curso: viewCurso, unidad: () => viewUnidad(arg), historia: () => viewHistoria(arg), historias: viewHistorias, boxen: () => arg ? viewHistoria(arg) : viewBoxen(), palabras: viewPalabras, hablar: viewHablar, sonido: () => viewSonido(arg), progreso: viewProgreso, jugar: viewJugar}[v] || viewHoy)();
}
addEventListener('hashchange', route);
applyTheme();
addEventListener('DOMContentLoaded', () => loadData().then(() => { route(); sync(); }).catch(err => { $('#app').innerHTML = `<div class="wrap"><h1>No se pudieron cargar los datos</h1><p class="muted">${esc(err.message)}</p></div>`; }));
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
