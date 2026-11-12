#!/usr/bin/env python3
"""Factual counts and artifact integrity; UX interpretation belongs to a separate analyst."""
import argparse
import json
import shutil
import subprocess
import zipfile
from collections import Counter
from pathlib import Path

from bundle import ROOT, sha, verify_bundle

PRIMARY = 'lifegame-flex-lab-my-v1'


def analyze(run):
    verify_bundle()
    world = json.loads((run / 'world.json').read_text())
    summary = json.loads((run / 'summary.json').read_text())
    events = [json.loads(x) for x in (run / 'events.jsonl').read_text().splitlines() if x]
    assert [e['sequence'] for e in events] == list(range(1, len(events) + 1)), 'event sequence broken'
    days, states, schema = [], [], []
    for persona in world['personas']:
        actor = persona['id']; state = summary['actors'][actor]
        sessions = state['sessions']; seen = [s['day'] for s in sessions]
        assert len(seen) == len(set(seen)), 'duplicate closed dates: ' + actor
        planned = world['sessions'][actor]
        for n in sorted(planned, key=int):
            matches = [s for s in sessions if s['day'] == int(n)]
            row = matches[0] if matches else None
            status = row['status'] if row else 'active' if state.get('active') and state.get('active_day', state.get('day')) == int(n) else 'unrun'
            folder = run / actor / f'day-{int(n):02d}'
            screenshots = list(folder.glob('*.png')); traces = list(folder.glob('*.zip'))
            days.append({'actor': actor, 'day': int(n), 'status': status, 'reason': row.get('reason') if row else None,
                         'actions': row.get('actions', 0) if row else None, 'screenshots': len(screenshots), 'traces': len(traces)})
            path = folder / 'observer-state.json'
            if path.exists():
                values = json.loads(path.read_text()); app = values.get(PRIMARY)
                item = {'actor': actor, 'day': int(n), 'path': str(path.relative_to(run)), 'sha256': sha(path),
                        'namespace_isolated': all(k.startswith('lifegame-flex-lab-') for k in values), 'primary_present': isinstance(app, dict)}
                if isinstance(app, dict):
                    item['ids'] = {k: [x['id'] for x in app.get(k, [])] for k in ('tasks', 'habits', 'cal', 'facts', 'timeLog')}
                    schema.append({'id': item['path'], 'state': app})
                states.append(item)
            for trace in traces:
                with zipfile.ZipFile(trace) as archive:
                    assert archive.testzip() is None and any(x.endswith('.trace') for x in archive.namelist()), str(trace)
    if not shutil.which('node'):
        raise ValueError('Node required for actual saved-state schema validation')
    scripts = [ROOT / 'public/personal-lab' / n for n in ('planning.js', 'flex-model.js', 'persistence.js')]
    js = "global.window=global;const fs=require('fs'),vm=require('vm');for(const f of process.argv.slice(1))vm.runInThisContext(fs.readFileSync(f,'utf8'));const rows=JSON.parse(fs.readFileSync(0,'utf8'));console.log(JSON.stringify(rows.map(r=>{try{LifeGamePersistence.validate(r.state);return {id:r.id,valid:true}}catch(e){return {id:r.id,valid:false,error:e.message}}})))"
    result = subprocess.run(['node', '-e', js, *map(str, scripts)], input=json.dumps(schema), text=True, capture_output=True, check=True)
    validation = json.loads(result.stdout)
    counts = Counter(d['status'] for d in days)
    missing = [d for d in days if d['status'] == 'completed' and (not d['screenshots'] or not d['traces'] or
               not (run / d['actor'] / f"day-{d['day']:02d}" / 'observer-state.json').exists())]
    return {'status': 'technical_artifact_analysis_not_ux_findings', 'planned_persona_days': len(days), 'days': days,
            'counts': dict(counts), 'closed_days': counts['completed'] + counts['no_use'], 'finished_flag': summary.get('finished'),
            'all_planned_days_closed': counts['completed'] + counts['no_use'] == len(days),
            'actions': sum(e['kind'] == 'action' for e in events), 'event_kinds': dict(Counter(e['kind'] for e in events)),
            'missing_session_evidence': missing, 'state_snapshots': states, 'schema_validation': validation,
            'all_captured_states_valid': bool(validation) and all(x['valid'] for x in validation),
            'errors': [e for e in events if e['kind'] in ('pageerror', 'request_error') or e.get('error')],
            'limitations': ['completed means session closed, not goal achieved', 'actor choices are not human retention estimates',
                           'artifact checks do not verify independence of model contexts or semantic correctness of actions']}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--run-dir', type=Path, required=True)
    args = parser.parse_args(); report = analyze(args.run_dir.resolve())
    path = args.run_dir / 'FACTS.json'
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ('planned_persona_days', 'counts', 'all_planned_days_closed', 'all_captured_states_valid')}, ensure_ascii=False))
