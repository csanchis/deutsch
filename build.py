#!/usr/bin/env python3
"""Une data/units/*.json (en el orden de data/temario.json) en data/course.json y valida los ejercicios."""
import json, re, sys, pathlib
D = pathlib.Path(__file__).parent / 'data'
tem = json.load(open(D / 'temario.json'))
units, problems = [], []
def words(s): return sorted(re.sub(r'[.!?]$', '', s.strip()).split())
for i, t in enumerate(tem, 1):
    f = D / 'units' / f"{t['id']}.json"
    if not f.exists(): problems.append(f"{t['id']}: falta"); continue
    u = json.load(open(f)); u['n'] = i
    for k in ('id', 'level', 'title', 'title_es'): u[k] = t[k]
    for sec in ('exercises', 'test'):
        for j, e in enumerate(u.get(sec, [])):
            tag = f"{u['id']} {sec}[{j}] {e.get('t')}"
            tp = e.get('t')
            if tp in ('mc', 'read') and not (isinstance(e.get('a'), int) and 0 <= e['a'] < len(e.get('o', []))): problems.append(tag + ': índice a')
            elif tp == 'gap' and (e.get('q', '').count('___') != 1 or not e.get('a')): problems.append(tag + ': hueco')
            elif tp == 'order' and words(' '.join(e.get('w', []))) != words(e.get('a', '')): problems.append(tag + ': order no cuadra')
            elif tp == 'tr' and not e.get('a'): problems.append(tag + ': sin respuesta')
            elif tp == 'listen' and not e.get('de'): problems.append(tag + ': sin texto')
            elif tp == 'match' and len(e.get('p', [])) < 3: problems.append(tag + ': pocos pares')
            elif tp not in ('mc', 'read', 'gap', 'order', 'tr', 'listen', 'match'): problems.append(tag + ': tipo desconocido')
    units.append(u)
json.dump({'units': units}, open(D / 'course.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(f"{len(units)} unidades → data/course.json ({(D / 'course.json').stat().st_size // 1024} KB)")
for p in problems: print('  !', p)
sys.exit(1 if any('falta' not in p for p in problems) else 0)
