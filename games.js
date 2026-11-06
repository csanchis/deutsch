/* Juegos: repasar jugando. Usa los globales de app.js (S, WORDS, UNITS, speak, shuffle, pick, esc, $, $$, save, logT, touch…) */
'use strict';
let GM = null;
const GAME_LIST = [
  {id: 'reloj', mark: '60s', color: 'teal', t: 'Contrarreloj', d: '60 segundos para traducir todo lo que puedas. Los aciertos seguidos dan combo y tiempo extra.'},
  {id: 'articulo', mark: 'der', color: 'purple', t: 'Der, die, das', d: 'Elige el artículo antes de que se acabe el tiempo. 3 vidas y cada vez más rápido.'},
  {id: 'oido', mark: '♪', color: 'orange', t: '¿Qué has oído?', d: 'Escucha una palabra y elige cuál era. Entrena el oído.'},
  {id: 'ahorcado', mark: 'A_', color: 'teal', t: 'Adivina la palabra', d: 'Letra a letra, con la pista en español. 5 palabras por partida.'},
  {id: 'parejas', mark: '▢▢', color: 'purple', t: 'Parejas', d: 'Memoria: da la vuelta a las cartas y une alemán con español.'},
  {id: 'relampago', mark: '⚡', color: 'orange', t: 'Test relámpago', d: '10 preguntas del curso y de gramática. Puntos por rapidez y por combo.'},
];

/* ── palabras para jugar ── */
const allWordsList = () => Object.values(WORDS).filter(Boolean);
function gamePool(filter = () => true) {
  const seen = Object.keys(S.cards).map(id => WORDS[id]).filter(Boolean);
  let pool;
  if (S.set.gpool === 'all') pool = allWordsList();
  else pool = seen.length >= 15 ? seen : [...seen, ...newOrder().slice(0, 200).map(id => WORDS[id])];
  pool = pool.filter(w => w && filter(w));
  return [...new Map(pool.map(w => [w.id, w])).values()];
}
const isPhrase = w => /[ .?!…]/.test(w.de.trim());
function distract(w, n = 3, key = 'es', filter = () => true) {
  const all = allWordsList().filter(x => x.id !== w.id && x[key] && normT(x[key]) !== normT(w[key]) && filter(x));
  const same = all.filter(x => x.cat === w.cat && isPhrase(x) === isPhrase(w));
  const out = [];
  for (const x of [...shuffle(same), ...shuffle(all)]) { if (!out.some(o => normT(o[key]) === normT(x[key]))) out.push(x); if (out.length === n) break; }
  return out;
}
function flagWord(id) { const c = S.cards[id]; if (c && c[1] > today()) { c[1] = today(); c[2] = now(); } }
function genderHint(w) {
  const d = w.de.toLowerCase();
  if (/(ung|heit|keit|schaft|ion|tät|ik|ei|ur)$/.test(d)) return 'Pista: las terminadas en -ung, -heit, -keit, -schaft, -ion, -tät, -ik suelen ser die.';
  if (/(chen|lein|ment|um)$/.test(d)) return 'Pista: -chen, -lein, -ment y -um suelen ser das.';
  if (/(ismus|ling|or|ig)$/.test(d)) return 'Pista: -ismus, -ling, -or, -ig suelen ser der.';
  if (/e$/.test(d) && w.art === 'die') return 'Pista: muchas palabras en -e son die.';
  if (['montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag', 'frühling', 'sommer', 'herbst', 'winter'].includes(d)) return 'Pista: días, meses y estaciones son der.';
  return '';
}

/* ── armazón común ── */
function stopGame() { if (GM) { clearInterval(GM.timer); clearTimeout(GM.to); GM = null; } document.body.classList.remove('running'); }
function gshell(g) {
  document.body.classList.add('running'); window.scrollTo(0, 0);
  $('#app').innerHTML = `<div class="runner"><div class="rtop"><button class="btn icon ghost" id="gq" aria-label="Salir">✕</button><div class="grow small muted">${esc(g.t)}</div><div id="gstats" class="row small"></div></div><div class="bar thin" id="gtime" hidden><i style="width:100%"></i></div><div id="gb" style="margin-top:18px"></div><div class="fb" id="fb"></div></div>`;
  $('#gq').onclick = () => { stopGame(); go('#jugar'); };
}
const hearts = n => '<span style="letter-spacing:2px;color:var(--red)">' + '●'.repeat(Math.max(0, n)) + '<span style="color:var(--grid)">' + '●'.repeat(Math.max(0, 3 - n)) + '</span></span>';
function setStats(html) { const el = $('#gstats'); if (el) el.innerHTML = html; }
function setTime(frac) { const t = $('#gtime'); if (!t) return; t.hidden = false; const i = $('i', t); i.style.width = Math.max(0, Math.min(1, frac)) * 100 + '%'; i.style.background = frac < 0.25 ? 'var(--red)' : ''; }
function gameOver(id, score, lines = '') {
  const g = GAME_LIST.find(x => x.id === id); stopGame();
  S.games ||= {}; const st = S.games[id] ||= {best: 0, plays: 0};
  const record = score > st.best; st.best = Math.max(st.best, score); st.plays++; touch(st);
  const L = logT(); L.xp = (L.xp || 0) + score; touch(L); save(1000);
  $('#app').innerHTML = `<div class="wrap"><div class="result"><div class="muted small">${esc(g.t)}</div><div class="big" style="margin-top:8px">${score}</div><p class="muted" style="margin-top:6px">${record ? '¡Nuevo récord!' : 'Récord: ' + st.best}</p>${lines}
    <div class="row" style="justify-content:center;margin-top:24px"><button class="btn primary" id="again">Otra vez</button><a class="btn" href="#jugar">Otros juegos</a></div></div></div>${nav('jugar')}`;
  $('#again').onclick = () => startGame(id);
}
function missedList(ws) { if (!ws.length) return ''; return `<div class="card plain" style="text-align:left;margin-top:18px"><div class="small muted" style="margin-bottom:6px">Para repasar (vuelven antes en tu repaso):</div>${[...new Map(ws.map(w => [w.id, w])).values()].slice(0, 12).map(w => `<div class="w" data-speak="${esc(speakForm(w))}" style="cursor:pointer"><span class="de">${w.art ? `<span class="art-${w.art}">${w.art}</span> ` : ''}${esc(w.de)}</span><span class="ink2">— ${esc(w.es)}</span></div>`).join('')}</div>`; }
document.addEventListener('keydown', e => { if (!GM || !GM.keys || e.target.tagName === 'INPUT') return; GM.keys(e); });
function optButtons(opts, cls = '') { return `<div class="opts ${cls}">${opts.map((o, i) => `<button class="opt" data-i="${i}">${esc(o)}</button>`).join('')}</div>`; }

function startGame(id) { stopGame(); GM = {id}; gshell(GAME_LIST.find(g => g.id === id)); ({reloj: gReloj, articulo: gArticulo, oido: gOido, ahorcado: gAhorcado, parejas: gParejas, relampago: gRelampago}[id] || (() => go('#jugar')))(); }

/* 1 · Contrarreloj */
function gReloj() {
  const pool = gamePool(w => w.es && w.de.length < 40);
  Object.assign(GM, {time: 60, max: 60, score: 0, combo: 0, missed: [], n: 0});
  GM.timer = setInterval(() => { GM.time -= 0.1; setTime(GM.time / GM.max); if (GM.time <= 0) gameOver('reloj', GM.score, `<p class="small ink2">${GM.n} palabras · combo máximo ${GM.best || 0}</p>` + missedList(GM.missed)); }, 100);
  const round = () => {
    if (!GM) return;
    const w = pick(pool), deToEs = Math.random() < 0.6;
    const ds = distract(w, 3, deToEs ? 'es' : 'de');
    const opts = shuffle([w, ...ds]); const ok = opts.indexOf(w);
    setStats(`<b>${GM.score}</b> pts${GM.combo >= 3 ? ` · <span style="color:var(--orange)">combo ×${1 + Math.floor(GM.combo / 3)}</span>` : ''}`);
    $('#gb').innerHTML = `<div class="small muted">${deToEs ? '¿Qué significa?' : '¿Cómo se dice en alemán?'}</div><div class="prompt" style="font-size:30px;font-weight:600">${deToEs ? `${w.art ? `<span class="art-${w.art}" style="font-size:20px">${w.art}</span> ` : ''}${esc(w.de)}` : esc(w.es)}</div>${optButtons(opts.map(o => deToEs ? o.es : (o.art ? o.art + ' ' : '') + o.de))}`;
    if (deToEs && S.set.autoSpeak) speak(speakForm(w));
    $$('#gb .opt').forEach(b => b.onclick = () => {
      if (GM.lock) return; GM.lock = true; GM.n++;
      const right = +b.dataset.i === ok; $$('#gb .opt')[ok].classList.add('ok');
      if (right) { GM.combo++; GM.best = Math.max(GM.best || 0, GM.combo); GM.score += 1 + Math.floor(GM.combo / 3); GM.time = Math.min(GM.max, GM.time + 1); }
      else { b.classList.add('bad'); GM.combo = 0; GM.time -= 3; GM.missed.push(w); flagWord(w.id); if (!deToEs) speak(speakForm(w)); }
      GM.to = setTimeout(() => { if (GM) { GM.lock = false; round(); } }, right ? 350 : 1100);
    });
    GM.keys = e => { const n = +e.key; if (n >= 1 && n <= 4) $$('#gb .opt')[n - 1]?.click(); };
  };
  round();
}

/* 2 · Der, die, das */
function gArticulo() {
  const pool = gamePool(w => ['der', 'die', 'das'].includes(w.art) && !isPhrase(w));
  const fallback = allWordsList().filter(w => ['der', 'die', 'das'].includes(w.art) && !isPhrase(w));
  const P = pool.length >= 10 ? pool : fallback;
  Object.assign(GM, {lives: 3, score: 0, missed: []});
  const round = () => {
    if (!GM) return;
    const w = pick(P), limit = Math.max(2.2, 6 - GM.score * 0.15); let left = limit;
    setStats(`${hearts(GM.lives)} <b style="margin-left:8px">${GM.score}</b>`);
    $('#gb').innerHTML = `<div class="prompt" style="text-align:center;font-size:36px;font-weight:600;margin:30px 0 4px">${esc(w.de)}</div><div class="muted" style="text-align:center;margin-bottom:28px">${esc(w.es)}</div>
      <div class="grade" style="grid-template-columns:1fr 1fr 1fr">${['der', 'die', 'das'].map((a, i) => `<button class="btn art-${a}" data-a="${a}" style="justify-content:center;padding:18px;font-size:20px;font-weight:600;border-color:currentColor">${a}</button>`).join('')}</div><div id="hint" class="small ink2" style="text-align:center;margin-top:16px"></div>`;
    clearInterval(GM.timer);
    GM.timer = setInterval(() => { left -= 0.1; setTime(left / limit); if (left <= 0) answer(null); }, 100);
    const answer = a => {
      if (GM.lock) return; GM.lock = true; clearInterval(GM.timer);
      const right = a === w.art; $$('#gb [data-a]').forEach(b => { if (b.dataset.a === w.art) { b.style.background = 'currentColor'; b.innerHTML = `<span style="color:var(--bg)">${w.art}</span>`; } });
      if (right) GM.score++; else { GM.lives--; GM.missed.push(w); flagWord(w.id); $('#hint').textContent = (a ? '' : '¡Tiempo! ') + `${w.art} ${w.de}. ` + genderHint(w); }
      speak(speakForm(w));
      GM.to = setTimeout(() => { if (!GM) return; GM.lock = false; if (GM.lives <= 0) gameOver('articulo', GM.score, missedList(GM.missed)); else round(); }, right ? 450 : 1900);
    };
    $$('#gb [data-a]').forEach(b => b.onclick = () => answer(b.dataset.a));
    GM.keys = e => { const k = {'1': 'der', '2': 'die', '3': 'das'}[e.key]; if (k) answer(k); };
  };
  round();
}

/* 3 · ¿Qué has oído? */
function gOido() {
  const pool = gamePool(w => w.de.length < 30);
  Object.assign(GM, {lives: 3, score: 0, missed: []});
  const round = () => {
    if (!GM) return;
    const w = pick(pool), ds = distract(w, 3, 'de'), opts = shuffle([w, ...ds]), ok = opts.indexOf(w);
    setStats(`${hearts(GM.lives)} <b style="margin-left:8px">${GM.score}</b>`);
    $('#gb').innerHTML = `<div style="text-align:center;margin:20px 0 26px"><button class="btn primary" id="play" style="padding:18px 28px;font-size:18px">🔊 Escuchar</button><div class="row" style="justify-content:center;margin-top:10px"><button class="btn sm ghost" id="slow">🐢 más lento</button></div></div>${optButtons(opts.map(o => (o.art ? o.art + ' ' : '') + o.de))}<div id="hint" class="small ink2" style="margin-top:14px"></div>`;
    const say = (slow) => speak(speakForm(w), slow);
    $('#play').onclick = () => say(false); $('#slow').onclick = () => say(true); setTimeout(() => say(false), 250);
    $$('#gb .opt').forEach(b => b.onclick = () => {
      if (GM.lock) return; GM.lock = true; const right = +b.dataset.i === ok;
      $$('#gb .opt')[ok].classList.add('ok'); $('#hint').innerHTML = `<b>${esc(speakForm(w))}</b> = ${esc(w.es)}`;
      if (right) GM.score++; else { b.classList.add('bad'); GM.lives--; GM.missed.push(w); flagWord(w.id); say(true); }
      GM.to = setTimeout(() => { if (!GM) return; GM.lock = false; if (GM.lives <= 0) gameOver('oido', GM.score, missedList(GM.missed)); else round(); }, right ? 900 : 2200);
    });
    GM.keys = e => { const n = +e.key; if (n >= 1 && n <= 4) $$('#gb .opt')[n - 1]?.click(); if (e.key === ' ') { e.preventDefault(); say(false); } };
  };
  round();
}

/* 4 · Adivina la palabra */
function gAhorcado() {
  const ok = w => !isPhrase(w) && /^[a-zäöüß]+$/i.test(w.de) && w.de.length >= 3 && w.de.length <= 13;
  let pool = gamePool(ok); if (pool.length < 10) pool = allWordsList().filter(ok);
  const words = shuffle(pool).slice(0, 5);
  Object.assign(GM, {k: 0, score: 0, solved: 0, missed: []});
  const KEYS = 'qwertzuiopüasdfghjklöäyxcvbnmß'.split('');
  const round = () => {
    if (!GM) return;
    if (GM.k >= words.length) return gameOver('ahorcado', GM.score, `<p class="small ink2">${GM.solved} de ${words.length} palabras adivinadas</p>` + missedList(GM.missed));
    const w = words[GM.k], target = w.de.toLowerCase(), got = new Set(), bad = new Set(); let lives = 6, done = false;
    const draw = () => {
      setStats(`palabra ${GM.k + 1}/${words.length} · <b>${GM.score}</b>`);
      const shown = [...w.de].map(c => got.has(c.toLowerCase()) || done ? esc(c.toUpperCase()) : '&nbsp;').map(c => `<span style="display:inline-block;width:1.15em;border-bottom:2px solid var(--ink);margin:0 2px;text-align:center">${c}</span>`).join('');
      $('#gb').innerHTML = `<div class="small muted">Pista</div><div style="font-size:20px;font-weight:500;margin-bottom:4px">${esc(w.es)}</div>${w.art ? `<div class="small art-${w.art}" style="font-weight:600">${w.art} …</div>` : ''}
        <div style="font-size:26px;font-weight:600;text-align:center;margin:26px 0 8px;letter-spacing:1px;white-space:nowrap;overflow-x:auto">${shown}</div>
        <div style="text-align:center;margin-bottom:16px">${'<span style="color:var(--red)">●</span>'.repeat(lives)}${'<span style="color:var(--grid)">●</span>'.repeat(6 - lives)}</div>
        <div style="display:grid;grid-template-columns:repeat(10,1fr);gap:5px">${KEYS.map(k => `<button class="chip" data-k="${k}" style="padding:10px 0;text-align:center;font-size:16px;${got.has(k) ? 'background:var(--teal-l);color:var(--teal);border-color:var(--teal)' : bad.has(k) ? 'opacity:.3' : ''}" ${got.has(k) || bad.has(k) || done ? 'disabled' : ''}>${k}</button>`).join('')}</div>
        <div class="row" style="margin-top:14px"><button class="btn sm" id="pista" ${done || lives <= 1 ? 'disabled' : ''}>Revelar una letra (−1 vida)</button>${done ? `<button class="btn primary" id="sig" style="margin-left:auto">Siguiente</button>` : ''}</div>
        ${done ? `<div class="card ${[...target].every(c => got.has(c)) ? 'ok' : 'bad'}" style="margin-top:14px;border-left:4px solid var(--line)"><span class="de" data-speak="${esc(speakForm(w))}">${esc(speakForm(w))}</span> = ${esc(w.es)}${w.ex ? `<div class="small ink2">${esc(w.ex)}</div>` : ''}</div>` : ''}`;
      $$('#gb [data-k]').forEach(b => b.onclick = () => guess(b.dataset.k));
      const p = $('#pista'); if (p) p.onclick = () => { const miss = [...target].filter(c => !got.has(c)); if (miss.length) { lives--; guess(pick(miss), true); } };
      const s = $('#sig'); if (s) { s.onclick = () => { GM.k++; round(); }; s.focus(); }
    };
    const guess = (k, free) => {
      if (done || got.has(k) || bad.has(k)) return;
      if (target.includes(k)) got.add(k); else { bad.add(k); lives--; }
      const win = [...target].every(c => got.has(c));
      if (win || lives <= 0) {
        done = true; speak(speakForm(w));
        if (win) { GM.solved++; GM.score += 10 + lives * 2; } else { GM.missed.push(w); flagWord(w.id); }
      }
      draw();
    };
    GM.keys = e => { const k = e.key.toLowerCase(); if (done && e.key === 'Enter') { GM.k++; round(); } else if (KEYS.includes(k)) guess(k); };
    draw();
  };
  round();
}

/* 5 · Parejas */
function gParejas() {
  let pool = gamePool(w => w.de.length <= 18 && w.es.length <= 22); if (pool.length < 6) pool = allWordsList().filter(w => w.de.length <= 18);
  const picked = []; for (const w of shuffle(pool)) { if (!picked.some(p => normT(p.es) === normT(w.es) || p.de === w.de)) picked.push(w); if (picked.length === 6) break; }
  const cards = shuffle(picked.flatMap((w, i) => [{i, side: 'de', txt: (w.art ? w.art + ' ' : '') + w.de}, {i, side: 'es', txt: w.es}]));
  Object.assign(GM, {moves: 0, found: 0, open: [], t0: now()});
  $('#gb').innerHTML = `<div class="small muted" style="margin-bottom:12px">Encuentra las 6 parejas</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${cards.map((c, k) => `<button class="chip" data-k="${k}" style="min-height:78px;font-size:15px;line-height:1.25;background:var(--surface);color:transparent;text-shadow:none" aria-label="carta">${esc(c.txt)}</button>`).join('')}</div>`;
  const show = (b, on) => { b.style.color = on ? '' : 'transparent'; b.style.background = on ? 'var(--surface2)' : 'var(--surface)'; };
  const stat = () => setStats(`${GM.moves} intentos · ${GM.found}/6`); stat();
  $$('#gb [data-k]').forEach(b => b.onclick = () => {
    if (GM.lock || GM.open.includes(b) || b.disabled) return;
    const c = cards[+b.dataset.k]; show(b, true); if (c.side === 'de') speak(c.txt);
    GM.open.push(b); if (GM.open.length < 2) return;
    GM.moves++; const [a, z] = GM.open, ca = cards[+a.dataset.k], cz = cards[+z.dataset.k];
    if (ca.i === cz.i && ca.side !== cz.side) {
      [a, z].forEach(x => { x.disabled = true; x.classList.add('ok'); x.style.background = 'var(--teal-l)'; x.style.color = 'var(--teal)'; }); GM.open = []; GM.found++; stat();
      if (GM.found === 6) { const secs = Math.round((now() - GM.t0) / 1000); GM.to = setTimeout(() => gameOver('parejas', Math.max(5, 100 - (GM.moves - 6) * 5 - Math.floor(secs / 3)), `<p class="small ink2">${GM.moves} intentos · ${secs} s</p>` + missedList(picked)), 600); }
    } else { GM.lock = true; stat(); GM.to = setTimeout(() => { show(a, false); show(z, false); GM.open = []; GM.lock = false; }, 1000); }
  });
}

/* 6 · Test relámpago */
function gRelampago() {
  const opened = UNITS.filter(u => S.uq.includes(u.id) || S.units[u.id]);
  const units = opened.length ? opened : UNITS.slice(0, 2);
  const fromCourse = units.flatMap(u => [...(u.exercises || []), ...(u.test || [])].filter(e => e.t === 'mc' || e.t === 'read').map(e => ({...e, src: u.title})));
  const qs = shuffle([...shuffle(fromCourse).slice(0, 7), ...Array.from({length: 3}, genGram)]).slice(0, 10).map(shuffleOpts);
  Object.assign(GM, {k: 0, score: 0, combo: 0, right: 0});
  const round = () => {
    if (!GM) return;
    if (GM.k >= qs.length) return gameOver('relampago', GM.score, `<p class="small ink2">${GM.right} de ${qs.length} correctas</p>`);
    const it = qs[GM.k], limit = it.t === 'read' ? 35 : 15; let left = limit;
    const mult = GM.combo >= 4 ? 2 : GM.combo >= 2 ? 1.5 : 1;
    setStats(`${GM.k + 1}/${qs.length} · <b>${GM.score}</b>${mult > 1 ? ` · <span style="color:var(--orange)">×${mult}</span>` : ''}`);
    $('#fb').innerHTML = '';
    $('#gb').innerHTML = `${it.t === 'read' ? `<div class="reading">${esc(it.text)}</div><div class="prompt" style="font-size:18px">${esc(it.q)}</div>` : `<div class="prompt">${blankQ(it.q)}</div>`}${optButtons(it.o)}`;
    clearInterval(GM.timer); GM.timer = setInterval(() => { left -= 0.1; setTime(left / limit); if (left <= 0) answer(-1); }, 100);
    const answer = i => {
      if (GM.lock) return; GM.lock = true; clearInterval(GM.timer);
      const right = i === it.a; $$('#gb .opt').forEach(b => { b.disabled = true; if (+b.dataset.i === it.a) b.classList.add('ok'); }); if (i >= 0 && !right) $$('#gb .opt')[i].classList.add('bad');
      const next = () => { if (!GM) return; GM.lock = false; GM.k++; round(); };
      if (right) { GM.right++; GM.combo++; GM.score += Math.round((10 + Math.ceil(left)) * mult); const s = sentenceOf(it); if (s && S.set.autoSpeak) speak(s); GM.to = setTimeout(next, 800); }
      else { GM.combo = 0; $('#fb').innerHTML = `<div class="card bad"><div class="title">${i < 0 ? '¡Tiempo!' : 'No es correcto'}</div><div>Respuesta: <span class="de">${esc(it.o[it.a])}</span></div>${it.exp ? `<div class="small ink2" style="margin-top:4px">${esc(it.exp)}</div>` : ''}<button class="btn primary" id="next" style="width:100%;justify-content:center;margin-top:12px">Seguir</button></div>`; $('#next').onclick = next; $('#next').focus({preventScroll: true}); }
    };
    $$('#gb .opt').forEach(b => b.onclick = () => answer(+b.dataset.i));
    GM.keys = e => { const n = +e.key; if (n >= 1 && n <= 4 && !GM.lock) answer(n - 1); if (e.key === 'Enter' && $('#next')) $('#next').click(); };
  };
  round();
}

/* ── pantalla Jugar ── */
function viewJugar() {
  const seen = Object.keys(S.cards).length, L = logT();
  page('jugar', `<h1>Jugar</h1><p class="ink2" style="margin-top:6px">Repasa sin darte cuenta. Las palabras que falles vuelven antes en tu repaso diario, y el tiempo que juegues cuenta para tu racha.</p>
    <div class="row between" style="margin-top:14px"><label class="row small">Palabras: <select id="gpool" style="width:auto"><option value="mine">Las que ya he visto${seen < 15 ? ' + próximas' : ''}</option><option value="all">Todas (${allWordsList().length})</option></select></label><span class="small muted">Hoy: <b>${L.xp || 0}</b> puntos</span></div>
    <a class="unit" href="#boxen" style="margin-top:16px"><div class="tag orange" style="width:46px;height:46px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;flex:none">🥊</div><div class="grow"><div style="font-weight:600">Boxen auf Deutsch</div><div class="small muted">Técnica, entreno e historia del boxeo y la lucha, con audio, traducción y vídeos.</div></div></a>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px;margin-top:16px">
    ${GAME_LIST.map(g => { const st = S.games?.[g.id]; return `<a class="unit" href="#juego/${g.id}" style="align-items:flex-start"><div class="tag ${g.color}" style="width:46px;height:46px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;flex:none">${g.mark}</div><div class="grow"><div style="font-weight:600">${esc(g.t)}</div><div class="small muted">${esc(g.d)}</div>${st ? `<div class="tiny ink2" style="margin-top:4px">Récord ${st.best} · ${st.plays} ${st.plays === 1 ? 'partida' : 'partidas'}</div>` : ''}</div></a>`; }).join('')}
    </div>`);
  $('#gpool').value = S.set.gpool === 'all' ? 'all' : 'mine';
  $('#gpool').onchange = e => { S.set.gpool = e.target.value; touch(S.set); save(); };
}
