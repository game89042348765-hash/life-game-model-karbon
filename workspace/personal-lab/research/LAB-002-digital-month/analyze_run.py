#!/usr/bin/env python3
"""Facts only: inspect actual artifacts; does not infer human UX or invent findings."""
import argparse
import hashlib
import json
import subprocess
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


def analyze(directory):
    summary = json.loads((directory / 'summary.json').read_text())
    world = json.loads((directory / 'world.json').read_text())
    events = [json.loads(line) for line in (directory / 'events.jsonl').read_text().splitlines() if line]
    state_paths = sorted(directory.glob('P*/day-*/observer-state.json'))
    schema_input, state_rows = [], []
    for path in state_paths:
        values = json.loads(path.read_text())
        state = values.get('lifegame-personal-lab-my-v1')
        actor, day = path.parts[-3], int(path.parts[-2].split('-')[1])
        row = {'actor': actor, 'day': day, 'path': str(path),
               'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
               'keys_lab_only': all(key.startswith('lifegame-personal-lab-') for key in values),
               'has_personal_state': isinstance(state, dict)}
        if isinstance(state, dict):
            schema_input.append({'id': str(path), 'state': state})
            row.update({'revision': state.get('revision'), 'lastProcessed': state.get('lastProcessed'),
                        'counts': {name: len(state.get(name, [])) for name in
                                   ['tasks', 'habits', 'quests', 'goals', 'cal', 'facts', 'ledger', 'misses']},
                        'task_titles': [item.get('title') for item in state.get('tasks', [])],
                        'habit_titles': [item.get('title') for item in state.get('habits', [])],
                        'calendar_titles': [item.get('title') for item in state.get('cal', [])],
                        'coins': sum(item.get('coins', 0) for item in state.get('ledger', [])),
                        'xp': sum(item.get('xp', 0) for item in state.get('ledger', []))})
        state_rows.append(row)
    module = directory / 'application-snapshot' / 'personal-lab' / 'persistence.js'
    if not module.exists():
        module = Path(__file__).resolve().parents[2] / 'persistence.js'
    script = r'''const fs=require('fs');global.window=global;
for(const file of process.argv.slice(1))require('vm').runInThisContext(fs.readFileSync(file,'utf8'));
const inputs=JSON.parse(fs.readFileSync(0,'utf8'));
console.log(JSON.stringify(inputs.map(x=>{try{window.LifeGamePersistence.validate(x.state);return {id:x.id,valid:true}}catch(e){return {id:x.id,valid:false,error:e.message}}})));'''
    validated = subprocess.run(['node', '-e', script, str(module.parent / 'planning.js'), str(module)], input=json.dumps(schema_input),
                               text=True, capture_output=True, check=True)
    schema_rows = json.loads(validated.stdout)
    files = list(directory.rglob('*'))
    opened = sum(actor['opened'] for actor in summary['actors'].values())
    completed = sum(actor['completed'] for actor in summary['actors'].values())
    no_use = sum(actor['no_use'] for actor in summary['actors'].values())
    planned = sum(len(rows) for rows in world['sessions'].values())
    actors = {}
    for name, actor in summary['actors'].items():
        actors[name] = {key: actor.get(key) for key in
                        ['planned', 'opened', 'completed', 'no_use', 'actions', 'last_day', 'active']}
        actors[name]['days'] = [{key: session.get(key) for key in
                                ['day', 'status', 'reason', 'outcome', 'actions', 'frictions', 'trace']}
                               for session in actor['sessions']]
    errors = [event for event in events if event['kind'] in
              ['pageerror', 'request_error'] or event.get('error') or
              (event['kind'] == 'console' and event.get('level') == 'error')]
    traces = sorted(directory.glob('P*/day-*/trace.zip'))
    replayable = []
    for path in traces:
        import zipfile
        with zipfile.ZipFile(path) as archive:
            replayable.append({'path': str(path), 'bytes': path.stat().st_size,
                               'zip_valid': archive.testzip() is None,
                               'has_trace': any(name.endswith('.trace') for name in archive.namelist())})
    manifest = json.loads((directory / 'source-manifest.json').read_text())
    changed_runtime = []
    for name, item in manifest['files'].items():
        path = Path(name)
        if path.suffix in ['.md', '.json'] or path.name == '.gitignore':
            continue
        if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest() != item['sha256']:
            changed_runtime.append(name)
    return {
        'run_directory': str(directory), 'finished': summary.get('finished'),
        'analyzed_at_utc': datetime.now(timezone.utc).isoformat(),
        'summary_updated_at': summary.get('updated_at'),
        'planned_persona_days': planned, 'opened_sessions': opened, 'completed_sessions': completed,
        'no_use_days': no_use, 'unrun_persona_days': planned - completed - no_use,
        'actions': sum(actor['actions'] for actor in summary['actors'].values()),
        'event_kinds': dict(Counter(event['kind'] for event in events)),
        'actors': actors, 'state_snapshots': state_rows, 'schema_validation': schema_rows,
        'all_captured_personal_states_schema_valid': bool(schema_rows) and all(row['valid'] for row in schema_rows),
        'all_captured_namespaces_lab_only': bool(state_rows) and all(row['keys_lab_only'] for row in state_rows),
        'profile_directories_distinct': len({actor['profile'] for actor in summary['actors'].values()}) == len(actors),
        'runtime_files_changed_during_run': changed_runtime,
        'errors': errors, 'traces': replayable,
        'screenshots': len(list(directory.glob('P*/day-*/*.png'))),
        'pilot_observations': sum(event['kind'] == 'observation' for event in events),
        'artifact_bytes': sum(path.stat().st_size for path in files if path.is_file()),
        'note': 'completed means session closed, not goal accomplished. Schema validation is not proof of semantic correctness or human usability. Inspect traces and outcomes separately.',
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('run_directory', type=Path)
    args = parser.parse_args()
    result = analyze(args.run_directory)
    output = args.run_directory / 'facts-report.json'
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({key: result[key] for key in
                     ['planned_persona_days', 'opened_sessions', 'completed_sessions', 'no_use_days',
                      'unrun_persona_days', 'actions', 'screenshots', 'all_captured_personal_states_schema_valid']},
                     ensure_ascii=False))
    print('Detailed facts:', output)
