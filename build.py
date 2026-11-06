#!/usr/bin/env python3
"""Une data/units/*.json (en el orden de data/temario.json) y data/stories/*.json en data/course.json y valida los ejercicios."""
import json, re, sys, pathlib
D = pathlib.Path(__file__).parent / 'data'
tem = json.load(open(D / 'temario.json'))
units, problems = [], []
def words(s): return sorted(re.sub(r'[.,!?;:]+$', '', w) for w in s.split())   # como la app: la puntuación no cuenta
def check(e, tag):
    tp = e.get('t'); tag = f"{tag} {tp}"
    if tp in ('mc', 'read') and not (isinstance(e.get('a'), int) and 0 <= e['a'] < len(e.get('o', []))): problems.append(tag + ': índice a')
    elif tp == 'gap' and (e.get('q', '').count('___') != 1 or not e.get('a')): problems.append(tag + ': hueco')
    elif tp == 'order' and words(' '.join(e.get('w', []))) != words(e.get('a', '')): problems.append(tag + ': order no cuadra')
    elif tp == 'tr' and not e.get('a'): problems.append(tag + ': sin respuesta')
    elif tp == 'listen' and not e.get('de'): problems.append(tag + ': sin texto')
    elif tp == 'match' and len(e.get('p', [])) < 3: problems.append(tag + ': pocos pares')
    elif tp not in ('mc', 'read', 'gap', 'order', 'tr', 'listen', 'match'): problems.append(tag + ': tipo desconocido')
for i, t in enumerate(tem, 1):
    f = D / 'units' / f"{t['id']}.json"
    if not f.exists(): problems.append(f"{t['id']}: falta"); continue
    u = json.load(open(f)); u['n'] = i
    for k in ('id', 'level', 'title', 'title_es'): u[k] = t[k]
    for sec in ('exercises', 'test'):
        for j, e in enumerate(u.get(sec, [])): check(e, f"{u['id']} {sec}[{j}]")
    for j, l in enumerate(u.get('lessons', [])):
        if l.get('pre'): check(l['pre'], f"{u['id']} lessons[{j}].pre")
        for k, e in enumerate(l.get('check', [])): check(e, f"{u['id']} lessons[{j}].check[{k}]")
    sf = D / 'stories' / f"{t['id']}.json"
    if sf.exists():
        st = json.load(open(sf))
        if not st.get('lines') or not all(x.get('de') and x.get('es') for x in st['lines']): problems.append(f"{u['id']} story: líneas")
        for k, e in enumerate(st.get('q', [])): check(e, f"{u['id']} story.q[{k}]")
        u['story'] = st
    units.append(u)
json.dump({'units': units}, open(D / 'course.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(f"{len(units)} unidades → data/course.json ({(D / 'course.json').stat().st_size // 1024} KB), {sum(1 for u in units if 'story' in u)} episodios")
for p in problems: print('  !', p)
sys.exit(1 if any('falta' not in p for p in problems) else 0)
