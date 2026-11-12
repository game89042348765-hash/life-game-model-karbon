#!/usr/bin/env python3
"""Deterministic technical transport checks on fresh data, never an AI-user study."""
import argparse
import json
import threading
import zipfile
from datetime import datetime, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from bundle import ROOT, collect, sha, verify_bundle
from pilot_driver import FlexDriver, PRIMARY
from analyze import analyze


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def smoke(output, chromium):
    output.mkdir(parents=True, exist_ok=False)
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT / 'public')))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    world = json.loads((ROOT / 'world.pilot.json').read_text())
    world['app_url'] = f'http://127.0.0.1:{server.server_port}/personal-lab/'
    world['experiment'] = 'LAB-014 deterministic technical smoke; not independent AI participants'
    world_path = output / 'world.smoke.json'; world_path.write_text(json.dumps(world, ensure_ascii=False, indent=2))
    run = output / 'run'; driver = None; checks = []
    def passed(name):
        checks.append({'name': name, 'passed': True}); print('PASS ' + name, flush=True)
    try:
        manifest = verify_bundle(); passed('standalone manifest matches all packaged files')
        driver = FlexDriver(world_path, run, executable_path=chromium)
        obs = driver.session('P01', 1)['observation']
        def action(predicate, kind='click', value=None):
            nonlocal obs
            for attempt in range(7):
                found = next((e for e in obs['elements'] if predicate(e)), None)
                if found:
                    command = {'op':'act','actor':'P01','observation_id':obs['observation_id'],
                               'element':found['element'],'action':kind,'intent':'deterministic LAB-014 smoke fixture'}
                    if value is not None: command['value'] = value
                    result = driver.action(command); assert result.get('success'), result
                    obs = result['observation']; return
                result = driver.action({'op':'scroll','actor':'P01','observation_id':obs['observation_id'],
                                        'dy':500,'intent':'technical fixture: reach visible form control'})
                assert result.get('success'), result; obs = result['observation']
            raise AssertionError('control absent from visible observations: ' + json.dumps(obs, ensure_ascii=False))
        action(lambda e: e['label'].startswith('Базовый'))
        action(lambda e: e['type'] == 'submit')
        action(lambda e: e['label'] == 'Добавить в ритм')
        action(lambda e: e['type'] == 'text', 'fill', 'LAB-014 чтение')
        action(lambda e: e['type'] == 'select', 'select', 'Ежедневная привычка')
        action(lambda e: e['type'] == 'submit')
        action(lambda e: e['label'] == 'Записать время')
        action(lambda e: e['type'] == 'number', 'fill', '5')
        action(lambda e: e['type'] == 'submit')
        driver.end('P01', 'technical fixture: recorded five minutes', 'SMOKE own memory')
        first = json.loads((run / 'P01/day-01/observer-state.json').read_text())[PRIMARY]
        assert len(first['habits']) == 1 and len(first['timeLog']) == 1 and first['timeLog'][0]['minutes'] == 5
        assert not first['facts'] and not first['ledger']
        passed('actual Basic UI creates habit and five minutes without completion/reward; native trace saved')
        driver.suspend_on_shutdown(); driver = None
        driver = FlexDriver(world_path, run, resume=True, executable_path=chromium)
        assert driver.brief('P01', 2)['memory'] == 'SMOKE own memory'
        view = driver.session('P01', 2)['observation']; assert 'LAB-014 чтение' in view['visible_text']
        driver.end('P01', 'technical fixture: original habit visible next day', 'SMOKE own memory')
        second = json.loads((run / 'P01/day-02/observer-state.json').read_text())[PRIMARY]
        assert second['habits'][0]['id'] == first['habits'][0]['id'] and second['timeLog'] == first['timeLog']
        passed('restart/resume retains own memory, original item ID and time across virtual dates')
        assert driver.skip('P01', 3, 'technical fixture: unavailable day')['reason'] == 'unavailable'
        assert driver.actors['P01']['context'] is None
        passed('unavailable day closes without opening the browser')
        for actor in ('P02', 'P03'):
            observation = driver.session(actor, 1)['observation']
            entry = next(e for e in observation['elements'] if e['label'].startswith('Полный'))
            result = driver.action({'op':'act','actor':actor,'observation_id':observation['observation_id'],
                                    'element':entry['element'],'action':'click','intent':'technical fixture: initialise separate empty profile'})
            assert result['success']
            driver.end(actor, 'technical fixture: separate profile', 'SMOKE independent empty profile')
            values = json.loads((run / actor / 'day-01/observer-state.json').read_text())
            assert all(k.startswith('lifegame-flex-lab-') for k in values)
            assert not values[PRIMARY]['habits'] and not values[PRIMARY]['timeLog']
        passed('all three persistent profiles are separate; P01 habit/minutes do not leak to P02/P03')
        driver.finish(); driver.suspend_on_shutdown(); driver = None
        hashes = {str(p.relative_to(run)):sha(p) for p in run.rglob('*') if p.is_file() and 'profiles' not in p.relative_to(run).parts}
        reader = FlexDriver(world_path, run, resume=True, read_only=True, executable_path=chromium)
        assert reader.status()['finished']; reader.suspend_on_shutdown()
        assert all(sha(run / p) == h for p,h in hashes.items())
        passed('finished run can be read without rewriting evidence')
        model = ROOT / 'public/personal-lab/flex-model.js'; original = model.read_bytes()
        try:
            model.write_bytes(original + b'\n')
            try:
                FlexDriver(world_path, run, resume=True, executable_path=chromium)
            except ValueError as error:
                assert 'bundle mismatch' in str(error)
            else:
                raise AssertionError('modified flex policy was accepted')
        finally:
            model.write_bytes(original)
        passed('modified Flex policy is rejected before resume or evidence mutation')
        report = analyze(run)
        assert report['planned_persona_days'] == 21 and report['closed_days'] == 5
        assert report['counts']['unrun'] == 16 and not report['all_planned_days_closed']
        assert report['all_captured_states_valid'] and not report['missing_session_evidence']
        assert all(s['namespace_isolated'] for s in report['state_snapshots'])
        (run / 'FACTS.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
        passed('real Flex saved states validate; analyzer preserves 16 unrun dates instead of inventing completion')
        result = collect(run, output / 'technical-return.zip')
        with zipfile.ZipFile(output / 'technical-return.zip') as archive:
            assert archive.testzip() is None
            assert all('profiles' not in Path(name).parts for name in archive.namelist())
            assert 'results/events.jsonl' in archive.namelist() and 'results/P01/day-01/observer-state.json' in archive.namelist()
        passed('return ZIP contains actual artifacts and excludes browser profiles')
        final = {'status':'technical_smoke_passed_not_ai_pilot', 'checks':checks,'passed':len(checks),
                 'manifest_entries':len(manifest['files']),'artifacts':str(output),'return_zip':result,
                 'independent_ai_user_pilot_executed':False}
        (output / 'SMOKE-RESULTS.json').write_text(json.dumps(final, ensure_ascii=False, indent=2) + '\n')
        return final
    finally:
        if driver is not None: driver.suspend_on_shutdown()
        server.shutdown(); server.server_close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--output-dir', type=Path)
    parser.add_argument('--chromium', default='/usr/bin/chromium'); args = parser.parse_args()
    output = args.output_dir or ROOT / 'runs' / ('smoke-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    result = smoke(output.resolve(), args.chromium)
    print(json.dumps({'passed':result['passed'],'artifacts':result['artifacts']},ensure_ascii=False))
