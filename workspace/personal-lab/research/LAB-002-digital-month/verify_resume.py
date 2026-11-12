#!/usr/bin/env python3
"""Native Playwright and process-crash acceptance checks; no AI or paid API calls."""
import argparse
import copy
from datetime import datetime, timezone
import fcntl
from functools import partial
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import importlib.util
import json
import multiprocessing
import os
from pathlib import Path
import select
import shutil
import signal
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
spec = importlib.util.spec_from_file_location('resume_under_test', HERE / 'driver.py')
driver = importlib.util.module_from_spec(spec)
spec.loader.exec_module(driver)


def request(port, payload):
    req = urllib.request.Request(f'http://127.0.0.1:{port}/',
                                 json.dumps(payload, ensure_ascii=False).encode(),
                                 {'Content-Type': 'application/json'})
    client = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with client.open(req, timeout=20) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, json.load(error)


def start(world, folder, *, resume=False, readonly=False, fault=None, app=None):
    command = [sys.executable, str(HERE / 'driver.py'), 'serve', '--world', str(world),
               '--run-dir', str(folder), '--port', '0']
    if resume: command.append('--resume')
    if readonly: command.append('--read-only')
    if fault is not None: command += ['--fail-after-ui-commit-step', str(fault)]
    if app is not None: command += ['--app-dir', str(app)]
    process = subprocess.Popen(command, cwd=ROOT, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, text=True)
    ready, _, _ = select.select([process.stdout], [], [], 15)
    if not ready:
        process.kill(); _, error = process.communicate()
        raise AssertionError('daemon startup timeout: ' + error)
    line = process.stdout.readline()
    if not line:
        _, error = process.communicate(timeout=5)
        raise AssertionError('daemon failed: ' + error)
    info = json.loads(line)
    return process, info['port']


def stop(process):
    if process.poll() is None: process.send_signal(signal.SIGTERM)
    _, error = process.communicate(timeout=15)
    assert process.returncode == 0, error


def core_hashes(folder):
    return {p.name: hashlib.sha256(p.read_bytes()).hexdigest()
            for p in folder.iterdir() if p.is_file() and not p.name.startswith('.')}


def refused(world, folder, reason, *, app=None):
    before = core_hashes(folder)
    cmd = [sys.executable, str(HERE / 'driver.py'), 'serve', '--world', str(world),
           '--run-dir', str(folder), '--resume', '--port', '0']
    if app is not None: cmd += ['--app-dir', str(app)]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
    assert result.returncode != 0 and reason in result.stderr, result.stderr
    assert core_hashes(folder) == before, 'rejection modified evidence'


def call(port, op, **fields):
    code, data = request(port, {'op': op, **fields})
    assert code == 200, data
    return data


def operate(port, actor, obs, action, *, label=None, value=None):
    if label is not None:
        matches = [e for e in obs['elements'] if e['label'] == label]
        if not matches: matches = [e for e in obs['elements'] if label in e['label']]
    else:
        matches = [e for e in obs['elements'] if e['type'] in ('text', 'input', 'textarea')]
    assert matches, (label, [e['label'] for e in obs['elements']])
    data = call(port, 'act', actor=actor, observation_id=obs['observation_id'],
                element=matches[0]['element'], action=action, value=value,
                intent='technical verification: ' + (label or 'input'))
    assert data['success'], data
    return data['observation']


def create_task(port, title, *, final_crashes=False):
    obs = call(port, 'session', actor='P01', day=1)['observation']
    obs = operate(port, 'P01', obs, 'click', label='Начать свою жизнь')
    obs = operate(port, 'P01', obs, 'click', label='Начать')
    obs = operate(port, 'P01', obs, 'click', label='Быстрое добавление')
    obs = operate(port, 'P01', obs, 'fill', value=title)
    obs = operate(port, 'P01', obs, 'click', label='Задание')
    if final_crashes:
        try:
            operate(port, 'P01', obs, 'click', label='Сохранить')
        except (OSError, ConnectionError):
            return
        raise AssertionError('fault did not stop the daemon')
    operate(port, 'P01', obs, 'click', label='Сохранить')


def actor_state(folder, actor, day):
    raw = json.loads((folder / actor / f'day-{day:02d}' / 'observer-state.json').read_text())
    return raw['lifegame-personal-lab-my-v1']


def lock_waiter(lock_path, inherited_fd, connection):
    os.close(inherited_fd)
    handle = Path(lock_path).open('a+')
    connection.send(os.fstat(handle.fileno()).st_ino)
    connection.recv()
    fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    connection.send('holding')
    connection.recv()
    handle.close()


def check_lock(folder):
    path = folder / 'stable.lock'
    first = driver._ExclusiveFileLock(path, {'owner': 'A'}).acquire('test lock')
    context = multiprocessing.get_context('fork')
    parent, child = context.Pipe()
    process = context.Process(target=lock_waiter, args=(path, first.handle.fileno(), child))
    process.start(); child.close()
    assert parent.poll(5); inode = parent.recv()
    first.release()
    assert path.exists() and path.stat().st_ino == inode
    parent.send('acquire'); assert parent.poll(5); assert parent.recv() == 'holding'
    blocked = False
    try:
        driver._ExclusiveFileLock(path, {'owner': 'C'}).acquire('test lock')
    except ValueError:
        blocked = True
    finally:
        parent.send('stop'); process.join(5); parent.close()
    assert blocked and process.exitcode == 0


def child_skip(world, folder):
    instance = driver.Driver(world, folder)
    instance.save_checkpoint = lambda: os._exit(86)
    instance.skip('P01', 1, outcome='no time', memory='DURABLE_SKIP_MEMORY')


def main(output):
    output.mkdir(parents=True, exist_ok=False)
    results = []
    def record(name):
        results.append({'name': name, 'pass': True})
        print('PASS', name, flush=True)
    check_lock(output); record('R1: stable inode blocks competing process after owner releases')

    class Handler(SimpleHTTPRequestHandler):
        def log_message(self, *unused): pass
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    world = json.loads((HERE / 'world.pilot.json').read_text())
    world['personas'] = world['personas'][:2]
    world['sessions'] = {actor: {str(day): copy.deepcopy(world['sessions'][actor][str(day)])
                                for day in range(1, 4)} for actor in ['P01', 'P02']}
    world['sessions']['P01']['3']['budget'] = 2
    world['app_url'] = f'http://127.0.0.1:{server.server_port}/personal-lab/'
    worldpath = output / 'world.json'; worldpath.write_text(json.dumps(world))
    try:
        skip = output / 'skip-crash'
        child = subprocess.run([sys.executable, __file__, '--child-skip', str(worldpath), str(skip)], timeout=15)
        assert child.returncode == 86
        for iteration in range(2):
            process, port = start(worldpath, skip, resume=True)
            try:
                state = call(port, 'audit')['actors']['P01']
                assert state['last_day'] == 1 and state['no_use'] == 1 and len(state['sessions']) == 1
                assert call(port, 'brief', actor='P01', day=2)['memory'] == 'DURABLE_SKIP_MEMORY'
            finally: stop(process)
        record('R2: real process cut after no_use recovers record and memory idempotently')

        run = output / 'normal'
        process, port = start(worldpath, run)
        try:
            create_task(port, 'LAB005-PERSISTENT-TASK')
            end = call(port, 'end', actor='P01', memory='OWN_P01_MEMORY', outcome='task created')
            assert end['context_released']
            identity = actor_state(run, 'P01', 1)['tasks'][0]['id']
        finally: stop(process)
        assert not json.loads((run/'checkpoint.json').read_text())['finished']
        process, port = start(worldpath, run, resume=True)
        try:
            assert call(port, 'brief', actor='P01', day=2)['memory'] == 'OWN_P01_MEMORY'
            call(port, 'session', actor='P01', day=2)
            call(port, 'end', actor='P01', memory='OWN_P01_MEMORY', outcome='day two')
            assert actor_state(run, 'P01', 2)['tasks'][0]['id'] == identity
            obs = call(port, 'session', actor='P02', day=1)['observation']
            obs = operate(port, 'P02', obs, 'click', label='Начать свою жизнь')
            operate(port, 'P02', obs, 'click', label='Начать')
            call(port, 'end', actor='P02', memory='OWN_P02_MEMORY', outcome='separate profile')
            assert actor_state(run, 'P02', 1)['tasks'] == []
            obs = call(port, 'session', actor='P01', day=3)['observation']
            obs = call(port, 'scroll', actor='P01', observation_id=obs['observation_id'], dy=100)['observation']
            old_id = obs['observation_id']
        finally: stop(process)
        checkpoint = json.loads((run/'checkpoint.json').read_text())
        assert checkpoint['actors']['P01']['active'] and not checkpoint['finished']
        record('native UI: task persists across dates and another actor stays isolated')

        process, port = start(worldpath, run, resume=True)
        try:
            brief = call(port, 'brief', actor='P01', day=3)
            assert brief['actions_used'] == 1 and brief['budget_remaining'] == 1
            obs = call(port, 'observe', actor='P01')
            assert obs['observation_id'] != old_id and '2026-11-18' in obs['virtual_time_observed']
            code, _ = request(port, {'op':'scroll','actor':'P01','observation_id':old_id,'dy':10})
            assert code == 400
            obs = call(port, 'scroll', actor='P01', observation_id=obs['observation_id'], dy=10)['observation']
            exhausted = call(port, 'scroll', actor='P01', observation_id=obs['observation_id'], dy=10)
            assert exhausted['error'] == 'action_budget_exhausted'
            call(port, 'end', actor='P01', memory='OWN_P01_MEMORY', outcome='resumed within budget')
            call(port, 'skip', actor='P02', day=2, memory='OWN_P02_MEMORY')
            call(port, 'skip', actor='P02', day=3, memory='OWN_P02_MEMORY')
            call(port, 'finish')
        finally: stop(process)
        record('active interruption retains date, budget and fresh-observation requirement')

        refused(worldpath, run, 'run has finished')
        before = core_hashes(run)
        process, port = start(worldpath, run, resume=True, readonly=True)
        try:
            summary = call(port, 'audit')
            assert summary['actors']['P01']['completed'] == 3 and summary['actors']['P02']['no_use'] == 2
            code, _ = request(port, {'op':'skip','actor':'P01','day':4})
            assert code == 400
        finally: stop(process)
        assert core_hashes(run) == before
        record('finished run rejects mutations; readonly leaves evidence byte-for-byte unchanged')

        altered = copy.deepcopy(world); altered['seed'] = 'DIFFERENT'
        changed = output/'changed-world.json';changed.write_text(json.dumps(altered))
        refused(changed, skip, 'world mismatch')
        app = output/'changed-app'; app.mkdir()
        manifest = json.loads((run/'source-manifest.json').read_text())
        for name in manifest['files']:
            relative = Path(name).relative_to('personal-lab');target=app/relative
            target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,target)
        with (app/'style.css').open('a') as file: file.write('\n/* deliberate mismatch in test copy */')
        refused(worldpath, skip, 'application version mismatch', app=app)
        corrupt = output/'corrupt';corrupt.mkdir()
        for path in skip.iterdir():
            if path.is_file() and not path.name.startswith('.'):shutil.copyfile(path,corrupt/path.name)
        with (corrupt/'events.jsonl').open('a') as file:file.write('{broken-tail')
        refused(worldpath, corrupt, 'invalid event journal')
        record('world/app mismatch and corrupt journal fail safely without rewriting evidence')

        cut = output/'ui-commit-cut'
        process, port = start(worldpath, cut, fault=6)
        create_task(port, 'LAB005-ONCE-ONLY', final_crashes=True)
        _, stderr = process.communicate(timeout=15)
        assert process.returncode == 99, stderr
        process, port = start(worldpath, cut, resume=True)
        try:
            obs = call(port, 'observe', actor='P01')
            assert obs['reconcile_required'] and obs['actions_used'] == 6
            code, _ = request(port, {'op':'scroll','actor':'P01','observation_id':obs['observation_id'],'dy':10})
            assert code == 400
            obs = call(port, 'observe', actor='P01')
            assert obs['reconcile_required'], 'observing must not silently confirm an ambiguous action'
            call(port, 'reconcile', actor='P01', observation_id=obs['observation_id'], note='Observed saved task; continue without repeating submit')
            call(port, 'end', actor='P01', memory='Submission not repeated', outcome='technical recovery')
            state = actor_state(cut, 'P01', 1)
            assert len(state['tasks']) == 1 and state['tasks'][0]['title'] == 'LAB005-ONCE-ONLY'
            assert state['ledger'] == []
            record_data = call(port, 'audit')['actors']['P01']['sessions'][0]
            assert record_data['trace_interrupted'] and not record_data['drafts_restored']
            assert record_data['reconciled_actions'][0]['outcome'] == 'unknown_not_retried'
            assert Path(record_data['trace']).name.startswith('trace-resume-')
            call(port, 'finish')
        finally: stop(process)
        record('real UI cut before confirmation: ambiguity explicit, no replay or duplicate task')

        # A screenshot/observation failure after UI commit must be just as conservative
        # as a process crash. Use the public transport API with one injected failure.
        capture = output/'capture-error'
        instance = driver.Driver(worldpath, capture)
        try:
            obs = instance.dispatch({'op':'session','actor':'P01','day':1})['observation']
            def direct(action, label=None, value=None):
                nonlocal obs
                matches = [e for e in obs['elements'] if e['label'] == label] if label else []
                if label and not matches: matches = [e for e in obs['elements'] if label in e['label']]
                if not label: matches = [e for e in obs['elements'] if e['type'] in ('text','input','textarea')]
                result = instance.dispatch({'op':'act','actor':'P01','observation_id':obs['observation_id'],
                                            'element':matches[0]['element'],'action':action,'value':value,
                                            'intent':'observation failure acceptance'})
                assert result['success'], result
                obs = result['observation']
            direct('click','Начать свою жизнь');direct('click','Начать')
            direct('click','Быстрое добавление');direct('fill',value='CAPTURE-ONCE')
            direct('click','Задание')
            original_observe = instance.observe
            def fail_capture(*args, **kwargs):
                raise RuntimeError('intentional capture failure after real UI operation')
            instance.observe = fail_capture
            try:
                direct('click','Сохранить')
                raise AssertionError('capture failure did not trigger')
            except RuntimeError as error:
                assert 'intentional capture failure' in str(error)
            finally:
                instance.observe = original_observe
            try:
                instance.dispatch({'op':'scroll','actor':'P01','observation_id':obs['observation_id'],'dy':10})
                raise AssertionError('unconfirmed action was silently discarded')
            except ValueError as error:
                assert 'pending ambiguity' in str(error)
            obs = instance.observe('P01')
            assert obs['reconcile_required']
            instance.reconcile('P01',obs['observation_id'],'Task visible; no repeated submit')
            instance.end('P01',memory='Capture failure handled without retry')
            state = actor_state(capture,'P01',1)
            assert len(state['tasks']) == 1 and state['tasks'][0]['title'] == 'CAPTURE-ONCE'
        finally:
            instance.suspend_on_shutdown()
        record('capture failure after UI commit also blocks retry until explicit reconciliation')

        traces = list(output.glob('*/P*/day-*/*.zip'))
        assert traces
        for path in traces:
            with zipfile.ZipFile(path) as archive:
                assert archive.testzip() is None and any(n.endswith('.trace') for n in archive.namelist())
        record('native Playwright traces and interrupted continuations exist and validate')
    finally:
        server.shutdown();server.server_close()
        (output/'verification-report.json').write_text(json.dumps({'checks':results,'passed':len(results),
            'scope':'Technical acceptance, not AI-user or month experiment',
            'driver_sha256':hashlib.sha256((HERE/'driver.py').read_bytes()).hexdigest()},ensure_ascii=False,indent=2)+'\n')
    print(f'{len(results)}/9 acceptance groups passed. Evidence: {output}')


if __name__ == '__main__':
    if len(sys.argv)>1 and sys.argv[1]=='--child-skip':
        child_skip(Path(sys.argv[2]),Path(sys.argv[3]))
    else:
        parser=argparse.ArgumentParser()
        parser.add_argument('--output',type=Path,default=ROOT/'personal-lab/verification'/('LAB-005-acceptance-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')))
        main(parser.parse_args().output)
