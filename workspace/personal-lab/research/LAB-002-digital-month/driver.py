#!/usr/bin/env python3
"""Local, observable browser transport for synthetic users; no model or app API calls."""
import argparse
import fcntl
import hashlib
import os
import signal
import json
import sys
import time
import traceback
import urllib.request
from datetime import date, datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from zoneinfo import ZoneInfo

from playwright.sync_api import sync_playwright


SNAPSHOT = r"""() => {
  const displayed = el => {
    const r=el.getBoundingClientRect(),s=getComputedStyle(el);
    return r.width>0&&r.height>0&&r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0;
  };
  const overlays=[...document.querySelectorAll('.overlay,dialog[open]')].filter(displayed);
  const root=overlays.at(-1)||document.body;
  const exposed = el => {
    if(!displayed(el))return false;
    const r=el.getBoundingClientRect(),x=(Math.max(0,r.left)+Math.min(innerWidth,r.right))/2,y=(Math.max(0,r.top)+Math.min(innerHeight,r.bottom))/2;
    const hit=document.elementFromPoint(x,y);
    return !!hit&&(hit===el||el.contains(hit));
  };
  const controls=[...root.querySelectorAll('button,input:not([type=hidden]),textarea,select,a[href],[role=button],[role=checkbox]')].filter(exposed);
  const items=controls.map((el,i)=>{
    const prev=el.previousElementSibling;
    const associated=[...(el.labels||[])].map(l=>l.innerText.trim()).join(' ');
    const label=(el.getAttribute('aria-label')||associated||(prev?.tagName==='LABEL'?prev.innerText:'')||el.getAttribute('placeholder')||el.innerText||el.getAttribute('title')||el.tagName).trim().slice(0,240);
    const r=el.getBoundingClientRect(),isSelect=el.tagName==='SELECT';
    const d={element:'e'+(i+1),label,type:el.getAttribute('type')||el.tagName.toLowerCase(),disabled:!!el.disabled,rect:{x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)}};
    if('value'in el)d.value=isSelect?(el.selectedOptions[0]?.textContent||''):el.value;
    if('checked'in el)d.checked=el.checked;
    if(isSelect)d.options=[...el.options].filter(o=>!o.hidden).map(o=>({label:o.textContent.trim(),disabled:o.disabled}));
    return d;
  });
  const texts=[],walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){
    const node=walker.currentNode,p=node.parentElement,t=node.textContent.trim();
    if(!t||!p||['SCRIPT','STYLE','OPTION'].includes(p.tagName)||!displayed(p))continue;
    // Report fully exposed words, not the entire contents of a partly covered node.
    // A viewport intersection alone leaks text under fixed navigation or below fold.
    const range=document.createRange(),words=[];
    for(const match of node.textContent.matchAll(/\S+/gu)){
      range.setStart(node,match.index);range.setEnd(node,match.index+match[0].length);
      const rects=[...range.getClientRects()].filter(r=>r.width&&r.height);
      const visible=rects.length&&rects.every(r=>{
        if(r.left<0||r.top<0||r.right>innerWidth||r.bottom>innerHeight)return false;
        return [.15,.5,.85].every(f=>{
          const hit=document.elementFromPoint(r.left+r.width*f,r.top+r.height/2);
          return !!hit&&(hit===p||p.contains(hit));
        });
      });
      if(visible)words.push(match[0]);
    }
    if(words.length)texts.push(words.join(' '));
  }
  window.__syntheticViewControls=controls;
  return {title:document.title,url:location.href,virtual_time_observed:new Date().toISOString(),modal:!!overlays.length,viewport:{width:innerWidth,height:innerHeight},visible_text:texts.join('\n').slice(0,7500),elements:items};
}"""


CORE_APP_FILES = ('index.html', 'app.js', 'persistence.js', 'planning.js', 'style.css', 'sw.js', 'pwa.js', 'manifest.webmanifest')

def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds')

def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.parent / f'.{path.name}.tmp.{os.getpid()}'
    with temporary.open('w', encoding='utf-8') as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write('\n')
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, path)

def canonical_sha256(value):
    payload = json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    return hashlib.sha256(payload).hexdigest()

def file_sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

class _ExclusiveFileLock:

    def __init__(self, lock_path, metadata):
        self.path = Path(lock_path)
        self.metadata, self.handle = (metadata, None)

    def acquire(self, resource_label, shared=False):
        if not shared:
            self.path.parent.mkdir(parents=True, exist_ok=True)
        handle = self.path.open('r' if shared else 'a+', encoding='utf-8')
        try:
            fcntl.flock(handle.fileno(), (fcntl.LOCK_SH if shared else fcntl.LOCK_EX) | fcntl.LOCK_NB)
        except BlockingIOError as error:
            handle.close()
            raise ValueError(f'{resource_label} is locked by another process') from error
        if not shared:
            handle.seek(0)
            handle.truncate()
            handle.write(json.dumps(self.metadata) + '\n')
            handle.flush()
        self.handle = handle
        return self

    def release(self):
        if self.handle is not None:
            fcntl.flock(self.handle.fileno(), fcntl.LOCK_UN)
            self.handle.close()
            self.handle = None

def _check_chromium_singleton_lock(profile_dir):
    """Detect if a live Chromium process holds SingletonLock on profile_dir."""
    singleton = Path(profile_dir) / 'SingletonLock'
    if not singleton.is_symlink() and (not singleton.exists()):
        return
    try:
        target = os.readlink(singleton)
    except OSError:
        return
    if '-' in target:
        pid_str = target.rsplit('-', 1)[-1]
        if pid_str.isdigit():
            pid = int(pid_str)
            if pid != os.getpid():
                try:
                    os.kill(pid, 0)
                    raise ValueError(f'profile {profile_dir} has an active Chromium SingletonLock (pid={pid}); refusing concurrent access')
                except ProcessLookupError:
                    pass

def _probe_lock_free(lock_path, resource_label):
    """Verify without modifying state that an existing lock file is not held by another process."""
    path = Path(lock_path)
    if not path.exists():
        return
    handle = path.open('a+', encoding='utf-8')
    try:
        try:
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            handle.seek(0)
            holder = handle.read().strip()
            raise ValueError(f"{resource_label} is locked by another active daemon ({holder or 'flock held'}); refusing concurrent access") from exc
        finally:
            try:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
            except Exception:
                pass
    finally:
        handle.close()

def compute_app_manifest(app_dir):
    app_dir = Path(app_dir).resolve()
    missing = [name for name in CORE_APP_FILES if not (app_dir / name).is_file()]
    if missing:
        raise ValueError('missing application files: ' + ', '.join(missing))
    paths = [app_dir / name for name in CORE_APP_FILES]
    paths += [p for p in (app_dir / 'fonts').glob('*') if p.is_file()]
    paths += [app_dir / name for name in ('icon.svg', 'icon-192.png', 'icon-512.png') if (app_dir / name).is_file()]
    files = {'personal-lab/' + p.relative_to(app_dir).as_posix(): {'sha256': file_sha256(p), 'bytes': p.stat().st_size} for p in paths}
    return {'app_dir': str(app_dir), 'files': files, 'core_files_sha256': {name: file_sha256(app_dir / name) for name in CORE_APP_FILES}, 'app_version_sha256': canonical_sha256({k: v['sha256'] for k, v in files.items()})}

class Driver:

    def __init__(self, world_path, run_dir, resume=False, read_only=False, executable_path=None, app_dir=None, profiles_dir=None, release_completed_contexts=True, fail_after_ui_commit_step=None):
        self.world_path = Path(world_path).resolve()
        self.world = json.loads(self.world_path.read_text())
        self.world_sha256 = canonical_sha256(self.world)
        self.directory = Path(run_dir).resolve()
        self.profiles_dir = Path(profiles_dir).resolve() if profiles_dir else self.directory / 'profiles'
        self.executable_path = executable_path or '/usr/bin/chromium'
        self.app_dir = Path(app_dir).resolve() if app_dir else Path(__file__).resolve().parents[2]
        self.app_manifest = compute_app_manifest(self.app_dir)
        self.url = self.world.get('app_url', 'http://127.0.0.1:8041/personal-lab/')
        self.origin = '/'.join(self.url.split('/')[:3])
        self.zone = ZoneInfo(self.world.get('timezone', 'Europe/Moscow'))
        self.personas = {p['id']: p for p in self.world['personas']}
        self.read_only, self.resume_mode = (bool(read_only), bool(resume))
        self.release_completed_contexts = release_completed_contexts
        self.fail_after_ui_commit_step = fail_after_ui_commit_step
        self._run_lock, self._profile_locks = (None, {})
        self._resume_event_path = None
        self.sequence, self.resumed_count = (0, 0)
        self.finished, self.io_failed, self.closed = (False, False, False)
        self.pw = None
        self.actors = {actor: self._default_actor_state() for actor in self.personas}
        if read_only and (not resume):
            raise ValueError('--read-only requires --resume')
        try:
            if resume:
                self._verify_and_resume_existing_run()
            else:
                if any(((self.directory / name).exists() for name in ['run.json', 'checkpoint.json', 'events.jsonl'])):
                    raise ValueError('run already exists; use a new directory or --resume')
                self.directory.mkdir(parents=True, exist_ok=True)
                self._run_lock = _ExclusiveFileLock(self.directory / '.driver.lock', {'pid': os.getpid()}).acquire('run-dir')
                if (self.directory / 'run.json').exists():
                    raise ValueError('run already exists')
                self._check_all_profiles_unlocked()
                self._init_fresh_run()
        except BaseException:
            if self.pw is not None:
                self.pw.stop()
            self.release_locks()
            raise

    def _default_actor_state(self):
        return {'last_day': 0, 'last_completed_date': None, 'memory': '', 'context': None, 'page': None, 'observation': None, 'elements': {}, 'sequence': 0, 'day': None, 'steps': 0, 'budget': 0, 'virtual_time': None, 'sessions': [], 'active': False, 'latest_state': None, 'pending_action': None, 'reconcile_required': False, 'reconciled_actions': [], 'trace_interrupted': False, 'drafts_restored': True, 'needs_fresh_observe': False, 'resume_chunk': 0, 'trace_continuations': [], 'context_released': False}

    def _check_all_profiles_unlocked(self):
        for actor in self.personas:
            prof_dir = self.profiles_dir / actor
            _probe_lock_free(prof_dir / '.profile.lock', f'profile {prof_dir}')
            _check_chromium_singleton_lock(prof_dir)

    def _init_fresh_run(self):
        dump(self.directory / 'world.json', self.world)
        self.driver_sha256 = file_sha256(Path(__file__))
        dump(self.directory / 'source-manifest.json', {'status': 'captured at run start; no hardcoded Git revision', 'driver_sha256': self.driver_sha256, 'files': self.app_manifest['files']})
        dump(self.directory / 'run.json', {'format': 2, 'started_at': utc_now(), 'app_url': self.url, 'browser_backend': 'playwright', 'world_sha256': self.world_sha256, 'app_version_sha256': self.app_manifest['app_version_sha256'], 'driver_sha256': self.driver_sha256})
        self.log('run_started')
        self.save_checkpoint()
        self.save_summary()

    def _verify_world_and_app_version(self, run_meta, checkpoint_meta):
        world_file = self.directory / 'world.json'
        if not world_file.exists():
            raise ValueError('world mismatch: world.json is missing from run-dir; refusing to resume')
        saved_world = json.loads(world_file.read_text())
        saved_world_sha = canonical_sha256(saved_world)
        recorded_world_sha = (checkpoint_meta or {}).get('world_sha256') or run_meta.get('world_sha256') or saved_world_sha
        if saved_world != self.world or saved_world_sha != self.world_sha256 or recorded_world_sha != self.world_sha256:
            raise ValueError(f'world mismatch: supplied world ({self.world_sha256[:12]}) does not match run-dir world.json ({saved_world_sha[:12]}); refusing to resume without overwriting evidence')
        if run_meta.get('app_url') and run_meta.get('app_url') != self.url:
            raise ValueError(f"world/app_url mismatch: supplied {self.url} != recorded {run_meta.get('app_url')}; refusing to resume")
        recorded_core = (checkpoint_meta or {}).get('app_files_sha256') or run_meta.get('app_files_sha256')
        if not recorded_core and (self.directory / 'source-manifest.json').exists():
            sm = json.loads((self.directory / 'source-manifest.json').read_text())
            recorded_core = {}
            for name in CORE_APP_FILES:
                entry = sm.get('files', {}).get(f'personal-lab/{name}')
                if entry and 'sha256' in entry:
                    recorded_core[name] = entry['sha256']
        if recorded_core:
            current_core = self.app_manifest['core_files_sha256']
            mismatches = []
            for name, expected_sha in recorded_core.items():
                actual_sha = current_core.get(name)
                if actual_sha != expected_sha:
                    mismatches.append(f"{name} (expected {expected_sha[:10]}, got {(actual_sha or 'missing')[:10]})")
            if mismatches:
                raise ValueError(f"application version mismatch: {', '.join(mismatches)}; refusing to resume silently on modified application")
        if self.world.get('app_version') is not None:
            recorded_ver = saved_world.get('app_version')
            if self.world.get('app_version') != recorded_ver:
                raise ValueError(f"application version mismatch in world definition: {self.world.get('app_version')} != {recorded_ver}")

    def _verify_and_resume_existing_run(self):
        if not (self.directory / 'run.json').is_file():
            raise ValueError('missing run.json')
        self._run_lock = _ExclusiveFileLock(self.directory / '.driver.lock', {'pid': os.getpid()}).acquire('run-dir', shared=self.read_only)
        meta = json.loads((self.directory / 'run.json').read_text())
        checkpoint = json.loads((self.directory / 'checkpoint.json').read_text())
        if meta.get('format') != 2 or checkpoint.get('schema') != 2:
            raise ValueError('unsupported checkpoint format; preserve legacy evidence and start a new run')
        saved_world = json.loads((self.directory / 'world.json').read_text())
        if canonical_sha256(saved_world) != self.world_sha256 or meta['world_sha256'] != self.world_sha256:
            raise ValueError('world mismatch')
        if meta['app_version_sha256'] != self.app_manifest['app_version_sha256']:
            raise ValueError('application version mismatch')
        self.driver_sha256 = meta['driver_sha256']
        if not self.read_only and self.driver_sha256 != file_sha256(Path(__file__)):
            raise ValueError('driver version mismatch; no silent migration of an existing run')
        events = []
        for number, line in enumerate((self.directory / 'events.jsonl').read_text().splitlines(), 1):
            try:
                event = json.loads(line)
            except json.JSONDecodeError as error:
                raise ValueError(f'invalid event journal at line {number}; evidence left unchanged') from error
            if event.get('sequence') != number:
                raise ValueError(f'event sequence mismatch at line {number}')
            events.append(event)
        cursor = checkpoint.get('sequence')
        if not isinstance(cursor, int) or cursor < 0 or cursor > len(events):
            raise ValueError('checkpoint is ahead of the journal or has invalid sequence')
        self.sequence = cursor
        self.finished = checkpoint['finished']
        self.resumed_count = checkpoint['resumed_count']
        keys = ('last_day', 'last_completed_date', 'memory', 'sequence', 'day', 'steps', 'budget', 'virtual_time', 'sessions', 'active', 'latest_state', 'pending_action', 'reconcile_required', 'reconciled_actions', 'trace_interrupted', 'drafts_restored', 'resume_chunk', 'trace_continuations', 'context_released')
        for actor, saved in checkpoint['actors'].items():
            if actor not in self.actors:
                raise ValueError('checkpoint actor mismatch')
            self.actors[actor].update({key: saved[key] for key in keys if key in saved})
        self._reconcile_from_events(events[cursor:])
        self.sequence = len(events)
        for actor, state in self.actors.items():
            for path in (self.directory / actor).glob('day-*/*-o*.*'):
                state['sequence'] = max(state['sequence'], int(path.stem.rsplit('-o', 1)[1]))
            state['observation'] = None
            state['needs_fresh_observe'] = bool(state['active'])
            if state['active']:
                state['trace_interrupted'], state['drafts_restored'] = (True, False)
                state['resume_chunk'] += 1
                if state['pending_action'] is not None:
                    state['pending_action']['status'] = 'ambiguous_unconfirmed_after_interruption'
                    state['pending_action']['auto_retried'] = False
                    state['reconcile_required'] = True
        if self.read_only:
            return
        if self.finished:
            raise ValueError('run has finished; use --read-only')
        self._check_all_profiles_unlocked()
        self.resumed_count += 1
        self._resume_event_path = self.directory / f'events.resume-{self.resumed_count:03d}.jsonl'
        if self._resume_event_path.exists():
            raise ValueError('continuation log already exists')
        self.log('run_resumed', resumed_count=self.resumed_count)
        self.save_checkpoint()
        self.save_summary()

    def _reconcile_from_events(self, events, corrupted_lines=0):
        for event in events:
            kind, actor = (event['kind'], event.get('actor'))
            if kind == 'run_finished':
                self.finished = True
            if kind == 'run_resumed':
                self.resumed_count = event['resumed_count']
            if actor not in self.actors:
                continue
            state = self.actors[actor]
            if event.get('virtual_time'):
                state['virtual_time'] = event['virtual_time']
            if kind == 'session_opened':
                state.update(day=event['day'], active=True, steps=0, budget=event['budget'], pending_action=None, reconcile_required=False, reconciled_actions=[], trace_continuations=[], resume_chunk=0)
            elif kind == 'action_started':
                state['steps'] = event['step']
                state['pending_action'] = event['pending_action']
                state['reconcile_required'] = True
            elif kind == 'action':
                state['pending_action'], state['reconcile_required'] = (None, False)
            elif kind in ('no_use', 'session_ended'):
                record = event['record']
                previous = next((s for s in state['sessions'] if s['day'] == record['day']), None)
                if previous is not None and previous != record:
                    raise ValueError('conflicting session records in journal')
                if previous is None:
                    state['sessions'].append(record)
                state.update(last_day=record['day'], day=record['day'], last_completed_date=record['date'], active=False, memory=event['memory'], pending_action=None, reconcile_required=False)
            elif kind == 'pending_action_reconciled':
                state['reconciled_actions'].append(event['resolution'])
                state['pending_action'], state['reconcile_required'] = (None, False)
            elif kind == 'session_interrupted':
                if event.get('partial_trace') and event['partial_trace'] not in state['trace_continuations']:
                    state['trace_continuations'].append(event['partial_trace'])
                state['trace_interrupted'], state['drafts_restored'] = True, False
            elif kind == 'observation':
                state['sequence'] = max(state['sequence'], int(event['observation_id'].rsplit('-o', 1)[1]))

    def _serialize_actor_checkpoint(self, actor, a):
        obs_meta = None
        if a.get('observation'):
            obs = a['observation']
            obs_meta = {k: obs.get(k) for k in ('observation_id', 'screenshot', 'virtual_time_observed', 'actions_used', 'action_budget', 'modal', 'viewport', 'title', 'url') if k in obs}
        return {'actor': actor, 'day': a['day'], 'last_day': a['last_day'], 'last_completed_date': a['last_completed_date'], 'memory': a['memory'], 'active': a['active'], 'steps': a['steps'], 'budget': a['budget'], 'budget_remaining': max(0, int(a['budget']) - int(a['steps'])) if a['active'] else 0, 'virtual_time': a['virtual_time'], 'sequence': a['sequence'], 'observation': obs_meta, 'pending_action': a['pending_action'], 'reconcile_required': a['reconcile_required'], 'reconciled_actions': a['reconciled_actions'], 'trace_interrupted': a['trace_interrupted'], 'drafts_restored': a['drafts_restored'], 'needs_fresh_observe': a['needs_fresh_observe'], 'resume_chunk': a['resume_chunk'], 'trace_continuations': a['trace_continuations'], 'context_released': a['context_released'], 'sessions': a['sessions'], 'latest_state': a['latest_state']}

    def save_checkpoint(self):
        if self.read_only:
            return
        if self.io_failed:
            raise ValueError('cannot checkpoint after journal failure')
        dump(self.directory / 'checkpoint.json', {'schema': 2, 'sequence': self.sequence, 'finished': self.finished, 'resumed_count': self.resumed_count, 'actors': {actor: self._serialize_actor_checkpoint(actor, state) for actor, state in self.actors.items()}})

    def log(self, kind, actor=None, **data):
        if self.read_only:
            return
        if self.io_failed:
            raise ValueError('journal I/O previously failed; stop and inspect the run')
        state = self.actors.get(actor, {})
        record = {'sequence': self.sequence + 1, 'real_time_utc': utc_now(), 'kind': kind, 'actor': actor, 'day': state.get('day'), 'virtual_time': state.get('virtual_time'), **data}
        line = json.dumps(record, ensure_ascii=False) + '\n'
        try:
            with (self.directory / 'events.jsonl').open('a', encoding='utf-8') as handle:
                handle.write(line)
                handle.flush()
                os.fsync(handle.fileno())
            self.sequence = record['sequence']
            if self._resume_event_path is not None:
                with self._resume_event_path.open('a', encoding='utf-8') as handle:
                    handle.write(line)
                    handle.flush()
                    os.fsync(handle.fileno())
        except OSError:
            self.io_failed = True
            raise

    def plan(self, actor, day):
        if actor not in self.actors:
            raise ValueError('unknown actor')
        planned = self.world['sessions'].get(actor, {}).get(str(day))
        if planned is None:
            raise ValueError('day absent from predeclared world')
        a = self.actors[actor]
        return (a, planned)

    def brief(self, actor, day):
        a, p = self.plan(actor, day)
        when = date.fromisoformat(self.world['start_date']) + timedelta(days=int(day) - 1)
        result = {'actor': actor, 'day': int(day), 'date': when.isoformat(), 'context': p.get('context', ''), 'available': p.get('available', True), 'budget': p.get('budget', 18), 'memory': a['memory'], 'last_day': a['last_day'], 'last_completed_date': a['last_completed_date'], 'active': a['active'], 'active_day': a['day'] if a['active'] else None, 'actions_used': a['steps'] if a['active'] else 0, 'budget_remaining': max(0, a['budget'] - a['steps']) if a['active'] else int(p.get('budget', 18)), 'virtual_time': a['virtual_time'], 'reconcile_required': a['reconcile_required'], 'ambiguous_pending_action': a['pending_action'], 'past_days': [{'day': s['day'], 'date': s.get('date') or (date.fromisoformat(self.world['start_date']) + timedelta(days=int(s['day']) - 1)).isoformat(), 'status': s['status'], 'outcome': s.get('outcome')} for s in a['sessions']]}
        return result

    def status(self, actor=None):
        if actor is not None:
            if actor not in self.actors:
                raise ValueError('unknown actor')
            a = self.actors[actor]
            return self._serialize_actor_checkpoint(actor, a)
        return {'finished': self.finished, 'read_only': self.read_only, 'resumed_count': self.resumed_count, 'sequence': self.sequence, 'actors': {k: self._serialize_actor_checkpoint(k, v) for k, v in self.actors.items()}}

    def _ensure_writable(self):
        if self.io_failed or self.closed:
            raise ValueError('transport stopped or journal I/O failed')
        if self.read_only:
            raise ValueError('run is opened in read-only mode; mutations are disabled')
        if self.finished:
            raise ValueError('run has finished')

    def check_day(self, actor, day):
        a, p = self.plan(actor, day)
        self._ensure_writable()
        if a['active']:
            raise ValueError('end current session before a new day')
        if int(day) != a['last_day'] + 1:
            raise ValueError(f"next day must be {a['last_day'] + 1}; repeated or out-of-order day rejected")
        return (a, p)

    def skip(self, actor, day, outcome='', memory=None):
        state, plan = self.check_day(actor, day)
        day_date = date.fromisoformat(self.world['start_date']) + timedelta(days=int(day) - 1)
        state['day'] = int(day)
        state['virtual_time'] = (datetime.combine(day_date, datetime.min.time(), self.zone) + timedelta(hours=float(plan.get('hour', 9)))).isoformat()
        record = {'day': int(day), 'date': day_date.isoformat(), 'status': 'no_use', 'reason': 'unavailable' if not plan.get('available', True) else 'actor_choice', 'outcome': outcome, 'actions': 0, 'context': plan.get('context', '')}
        memory = state['memory'] if memory is None else memory
        self.log('no_use', actor, record=record, memory=memory, **{k: v for k, v in record.items() if k != 'day'})
        state['sessions'].append(record)
        state.update(last_day=int(day), last_completed_date=record['date'], memory=memory)
        self.save_checkpoint()
        self.save_summary()
        return {'actor': actor, 'day': int(day), 'no_use': True, 'memory': memory, 'reason': record['reason']}

    def ensure_context(self, actor):
        a = self.actors[actor]
        if a['context'] is None:
            if self.pw is None:
                self.pw = sync_playwright().start()
            profile_path = self.profiles_dir / actor
            _check_chromium_singleton_lock(profile_path)
            if actor not in self._profile_locks or self._profile_locks[actor].handle is None:
                self._profile_locks[actor] = _ExclusiveFileLock(profile_path / '.profile.lock', {'pid': os.getpid(), 'actor': actor, 'run_dir': str(self.directory), 'locked_at': utc_now()}).acquire(f'profile {profile_path}')
            viewport = self.personas[actor].get('viewport', {'width': 390, 'height': 844})
            extra_args = ['--no-sandbox']
            context = self.pw.chromium.launch_persistent_context(str(profile_path), executable_path=self.executable_path, headless=True, args=extra_args, viewport=viewport, locale='ru-RU', timezone_id=self.world.get('timezone', 'Europe/Moscow'), accept_downloads=True)
            allowed_origins = (self.origin + '/',)
            context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(allowed_origins) else route.abort())
            context.tracing.start(screenshots=True, snapshots=True, sources=False)
            for page in list(context.pages):
                try:
                    page.close()
                except Exception:
                    pass
            a['context'] = context
            a['context_released'] = False
        return a['context']

    def release_context(self, actor):
        if actor not in self.actors:
            raise ValueError('unknown actor')
        a = self.actors[actor]
        if a['active']:
            raise ValueError('cannot release browser context while session is active')
        if a['context'] is not None:
            try:
                a['context'].tracing.stop()
            except Exception:
                pass
            try:
                a['context'].close()
            except Exception:
                pass
            a['context'] = None
        if actor in self._profile_locks:
            self._profile_locks[actor].release()
            del self._profile_locks[actor]
        a['context_released'] = True
        self.save_checkpoint()
        return {'actor': actor, 'context_released': True}

    def _open_actor_page(self, actor, moment, chunk_title):
        a = self.actors[actor]
        _, p = self.plan(actor, a['day'])
        context = self.ensure_context(actor)
        context.set_offline(p.get('network', 'online') == 'offline')
        context.tracing.start_chunk(title=chunk_title)
        page = context.new_page()
        a['page'] = page
        page.set_default_timeout(4000)
        page.on('pageerror', lambda error: self.log('pageerror', actor, error=str(error)))
        page.on('console', lambda message: self.log('console', actor, level=message.type, text=message.text) if message.type in ('error', 'warning') else None)
        page.on('dialog', lambda dialog: (self.log('native_dialog_dismissed_by_transport', actor, message=dialog.message), dialog.dismiss()))
        page.on('download', lambda download: self.capture_download(actor, download))
        page.clock.install(time=moment)
        page.goto(self.url, wait_until='networkidle')
        return page

    def _reopen_interrupted_session(self, actor):
        a = self.actors[actor]
        _, p = self.plan(actor, a['day'])
        if a.get('virtual_time'):
            moment = datetime.fromisoformat(a['virtual_time'])
        else:
            day_date = date.fromisoformat(self.world['start_date']) + timedelta(days=int(a['day']) - 1)
            moment = datetime.combine(day_date, datetime.min.time(), self.zone) + timedelta(hours=float(p.get('hour', 9)))
            a['virtual_time'] = moment.isoformat()
        chunk_idx = int(a.get('resume_chunk', 1))
        self._open_actor_page(actor, moment, f"{actor} day {a['day']} resume {chunk_idx}")
        self.log('active_session_reopened', actor, day=a['day'], actions_used=a['steps'], action_budget=a['budget'], reconcile_required=a['reconcile_required'], pending_action=a['pending_action'], trace_interrupted=a['trace_interrupted'], drafts_restored=False)

    def session(self, actor, day):
        self._ensure_writable()
        a, p = self.plan(actor, day)
        d_int = int(day)
        if a['active'] and a['day'] == d_int and (a['page'] is None):
            obs = self.observe(actor)
            return {**self.brief(actor, d_int), 'resumed_active_session': True, 'trace_interrupted': a['trace_interrupted'], 'drafts_restored': False, 'observation': obs}
        a, p = self.check_day(actor, d_int)
        if not p.get('available', True):
            return self.skip(actor, d_int, outcome='Unavailable in predeclared world')
        a['day'] = d_int
        a['steps'] = 0
        a['active'] = True
        a['pending_action'] = None
        a['reconcile_required'] = False
        a['trace_interrupted'] = False
        a['drafts_restored'] = True
        a['needs_fresh_observe'] = False
        a['resume_chunk'] = 0
        a['trace_continuations'] = []
        day_date = date.fromisoformat(self.world['start_date']) + timedelta(days=d_int - 1)
        hour = float(p.get('hour', 9))
        moment = datetime.combine(day_date, datetime.min.time(), self.zone) + timedelta(hours=hour)
        a['virtual_time'] = moment.isoformat()
        a['budget'] = int(p.get('budget', 18))
        self._open_actor_page(actor, moment, f'{actor} day {d_int}')
        self.log('session_opened', actor, context=p.get('context', ''), budget=a['budget'])
        obs = self.observe(actor)
        self.save_checkpoint()
        self.save_summary()
        return {**self.brief(actor, d_int), 'observation': obs}

    def capture_download(self, actor, download):
        path = self.directory / actor / f"day-{self.actors[actor]['day']:02d}" / 'downloads' / Path(download.suggested_filename).name
        path.parent.mkdir(parents=True, exist_ok=True)
        download.save_as(str(path))
        self.log('download', actor, path=str(path))

    def observe(self, actor, _during_action=False):
        self._ensure_writable()
        state = self.actors[actor]
        if not state['active']:
            raise ValueError('no active session')
        if state['page'] is None:
            self._reopen_interrupted_session(actor)
        if state['pending_action'] is not None and not _during_action:
            state['reconcile_required'] = True
        page = state['page']
        page.wait_for_timeout(100)
        data = page.evaluate(SNAPSHOT)
        state['virtual_time'] = data['virtual_time_observed']
        handles = page.evaluate_handle('window.__syntheticViewControls')
        state['elements'] = {item['element']: handles.get_property(str(i)).as_element() for i, item in enumerate(data['elements'])}
        handles.dispose()
        state['sequence'] += 1
        identifier = f"{actor}-d{state['day']:02d}-o{state['sequence']:04d}"
        folder = self.directory / actor / f"day-{state['day']:02d}"
        folder.mkdir(parents=True, exist_ok=True)
        screenshot = folder / f'{identifier}.png'
        if screenshot.exists():
            raise ValueError('refusing to overwrite observation')
        page.screenshot(path=str(screenshot), animations='disabled')
        data.update(observation_id=identifier, screenshot=str(screenshot), actions_used=state['steps'], action_budget=state['budget'])
        if state['trace_interrupted']:
            data.update(resumed_from_interruption=True, trace_interrupted=True, drafts_restored=False)
        if state['reconcile_required']:
            data.update(ambiguous_pending_action=state['pending_action'], reconcile_required=True, recovery_notice='Previous action is unconfirmed and was not retried. Inspect the screen, then explicitly call reconcile before another action.')
        state['observation'], state['needs_fresh_observe'] = (data, False)
        dump(screenshot.with_suffix('.json'), data)
        self.log('observation', actor, observation_id=identifier, screenshot=str(screenshot), snapshot=str(screenshot.with_suffix('.json')))
        self.save_checkpoint()
        return data

    def action(self, command):
        self._ensure_writable()
        actor = command['actor']
        state = self.actors[actor]
        if not state['active']:
            raise ValueError('no active session')
        if state['reconcile_required'] or state['pending_action'] is not None:
            raise ValueError('pending ambiguity: observe and explicitly reconcile; automatic retry forbidden')
        if state['page'] is None or state['observation'] is None or state['needs_fresh_observe']:
            raise ValueError('observe the resumed session first')
        if state['steps'] >= state['budget']:
            return {'error': 'action_budget_exhausted', 'actions_used': state['steps'], 'allowed': ['observe', 'end']}
        if command.get('observation_id') != state['observation']['observation_id']:
            raise ValueError('stale observation_id')
        before = state['observation']['screenshot']
        started = time.monotonic()
        state['steps'] += 1
        pending = {'command': command, 'step': state['steps'], 'status': 'in_flight_unconfirmed', 'auto_retried': False, 'before': before, 'started_at_utc': utc_now()}
        self.log('action_started', actor, step=state['steps'], command=command, pending_action=pending)
        state['pending_action'] = pending
        self.save_checkpoint()
        error = None
        try:
            if command['op'] == 'scroll':
                page = state['page']
                page.mouse.move(page.viewport_size['width'] / 2, page.viewport_size['height'] / 2)
                page.mouse.wheel(0, max(-1000, min(1000, int(command.get('dy', 500)))))
            else:
                element = state['elements'].get(command.get('element'))
                if element is None:
                    raise ValueError('unknown visible element')
                action = command.get('action')
                if action == 'click':
                    element.click()
                elif action == 'fill':
                    element.fill(str(command.get('value', '')))
                elif action == 'select':
                    element.select_option(label=str(command['value']))
                elif action == 'check':
                    element.set_checked(bool(command.get('value', True)))
                else:
                    raise ValueError('unsupported action')
        except Exception as exception:
            error = str(exception)
        if self.fail_after_ui_commit_step == state['steps']:
            state['page'].wait_for_timeout(200)
            state['context'].close()
            os._exit(99)
        duration = round((time.monotonic() - started) * 1000, 1)
        observation = self.observe(actor, _during_action=True)
        self.log('action', actor, command=command, step=state['steps'], success=error is None, error=error, duration_ms=duration, before=before, after=observation['screenshot'], observation_id=observation['observation_id'])
        state['pending_action'], state['reconcile_required'] = (None, False)
        self.save_checkpoint()
        self.save_summary()
        return {'success': error is None, 'error': error, 'duration_ms': duration, 'observation': observation}

    def snapshot_state(self, actor):
        a = self.actors[actor]
        raw = a['page'].evaluate('() => Object.fromEntries(Object.keys(localStorage).sort().map(key => [key,localStorage.getItem(key)]))')
        parsed = {}
        for key, value in raw.items():
            try:
                parsed[key] = json.loads(value)
            except (TypeError, ValueError):
                parsed[key] = value
        path = self.directory / actor / f"day-{a['day']:02d}" / 'observer-state.json'
        dump(path, parsed)
        primary = parsed.get('lifegame-personal-lab-my-v1')
        summary = {'keys': list(parsed), 'path': str(path), 'primary_valid_json': isinstance(primary, dict)}
        if isinstance(primary, dict):
            ledger = primary.get('ledger', [])
            summary.update({'lastProcessed': primary.get('lastProcessed'), 'revision': primary.get('revision'), 'counts': {k: len(primary.get(k, [])) for k in ('tasks', 'habits', 'quests', 'cal', 'goals', 'facts', 'ledger', 'misses')}, 'coins': sum((item.get('coins', 0) for item in ledger)), 'xp': sum((item.get('xp', 0) for item in ledger))})
        a['latest_state'] = summary
        return summary

    def end(self, actor, outcome='', memory='', frictions=None):
        self._ensure_writable()
        state = self.actors[actor]
        if not state['active']:
            raise ValueError('no active session')
        if state['reconcile_required'] or state['pending_action'] is not None:
            raise ValueError('explicitly reconcile pending ambiguity before end')
        if state['page'] is None:
            self._reopen_interrupted_session(actor)
        captured = self.snapshot_state(actor)
        folder = self.directory / actor / f"day-{state['day']:02d}"
        folder.mkdir(parents=True, exist_ok=True)
        path = folder / 'trace.zip'
        if state['trace_interrupted'] or path.exists():
            index = max(1, state['resume_chunk'])
            path = folder / f'trace-resume-{index:02d}.zip'
            while path.exists():
                index += 1
                path = folder / f'trace-resume-{index:02d}.zip'
        state['context'].tracing.stop_chunk(path=str(path))
        if state['trace_interrupted']:
            state['trace_continuations'].append(str(path))
        record = {'day': state['day'], 'date': (date.fromisoformat(self.world['start_date']) + timedelta(days=state['day'] - 1)).isoformat(), 'status': 'completed', 'outcome': outcome, 'actions': state['steps'], 'frictions': frictions or [], 'state': captured, 'trace': str(path), 'trace_interrupted': state['trace_interrupted'], 'drafts_restored': not state['trace_interrupted'], 'trace_continuations': list(state['trace_continuations']), 'reconciled_actions': list(state['reconciled_actions'])}
        self.log('session_ended', actor, record=record, memory=memory, **{k: v for k, v in record.items() if k != 'day'})
        state['sessions'].append(record)
        state.update(last_day=state['day'], last_completed_date=record['date'], memory=memory, active=False, pending_action=None, reconcile_required=False)
        state['page'].close()
        state['page'], state['elements'], state['observation'] = (None, {}, None)
        self.save_checkpoint()
        self.save_summary()
        if self.release_completed_contexts:
            self.release_context(actor)
        return {'actor': actor, 'day': state['day'], 'status': 'completed', 'actions': state['steps'], 'memory': memory, 'outcome': outcome, 'context_released': state['context_released']}

    def suspend_on_shutdown(self):
        if self.closed:
            return
        try:
            if not self.read_only:
                for actor, state in self.actors.items():
                    if state['active'] and state['context'] is not None:
                        folder = self.directory / actor / f"day-{state['day']:02d}"
                        folder.mkdir(parents=True, exist_ok=True)
                        number = 1
                        path = folder / f'trace-interrupted-{number:02d}.zip'
                        while path.exists():
                            number += 1
                            path = folder / f'trace-interrupted-{number:02d}.zip'
                        try:
                            state['context'].tracing.stop_chunk(path=str(path))
                            state['trace_continuations'].append(str(path))
                            saved_path = str(path)
                        except Exception:
                            saved_path = None
                        state['trace_interrupted'], state['drafts_restored'], state['needs_fresh_observe'] = (True, False, True)
                        if not self.io_failed:
                            self.log('session_interrupted', actor, partial_trace=saved_path)
                    if state['context'] is not None:
                        state['context'].close()
                        state['context'] = None
                if not self.finished and (not self.io_failed):
                    self.log('daemon_stopped', finished=False)
                    self.save_checkpoint()
                    self.save_summary()
        finally:
            if self.pw is not None:
                self.pw.stop()
                self.pw = None
            self.release_locks()
            self.closed = True

    def release_locks(self):
        for lock in list(self._profile_locks.values()):
            lock.release()
        self._profile_locks.clear()
        if self._run_lock is not None:
            self._run_lock.release()
            self._run_lock = None

    def save_summary(self):
        summary = {'app_url': self.url, 'finished': self.finished, 'resumed_count': self.resumed_count, 'updated_at': utc_now(), 'actors': {}}
        for actor, a in self.actors.items():
            plans = self.world['sessions'].get(actor, {})
            sessions = a['sessions']
            summary['actors'][actor] = {'planned': len(plans), 'opened': sum((s['status'] == 'completed' for s in sessions)) + int(a['active']), 'completed': sum((s['status'] == 'completed' for s in sessions)), 'no_use': sum((s['status'] == 'no_use' for s in sessions)), 'actions': sum((s.get('actions', 0) for s in sessions)) + (a['steps'] if a['active'] else 0), 'last_day': a['last_day'], 'last_completed_date': a['last_completed_date'], 'active': a['active'], 'active_day': a['day'] if a['active'] else None, 'actions_used_active': a['steps'] if a['active'] else 0, 'action_budget_active': a['budget'] if a['active'] else 0, 'virtual_time': a['virtual_time'], 'memory': a['memory'], 'reconcile_required': a['reconcile_required'], 'pending_action': a['pending_action'], 'context_released': a['context_released'], 'sessions': sessions, 'latest_state': a.get('latest_state'), 'profile': str(self.profiles_dir / actor)}
        for row in summary['actors'].values():
            row['unrun'] = max(0, row['planned'] - row['completed'] - row['no_use'] - int(row['active']))
        if not self.read_only and not self.io_failed:
            dump(self.directory / 'summary.json', summary)
        return summary

    def finish(self):
        self._ensure_writable()
        if any((state['active'] for state in self.actors.values())):
            raise ValueError('end each active session before finish')
        self.log('run_finished')
        self.finished = True
        self.save_checkpoint()
        summary = self.save_summary()
        for actor in self.actors:
            self.release_context(actor)
        return summary

    def dispatch(self, command):
        op = command.get('op')
        if op == 'reconcile':
            return self.reconcile(command['actor'], command['observation_id'], command.get('note', ''))
        if op == 'brief':
            return self.brief(command['actor'], int(command['day']))
        if op == 'status':
            return self.status(command.get('actor'))
        if op == 'session':
            return self.session(command['actor'], int(command['day']))
        if op == 'skip':
            return self.skip(command['actor'], int(command['day']), command.get('outcome', ''), command.get('memory'))
        if op == 'observe':
            return self.observe(command['actor'])
        if op in ('act', 'scroll'):
            return self.action(command)
        if op == 'end':
            return self.end(command['actor'], command.get('outcome', ''), command.get('memory', ''), command.get('frictions'))
        if op == 'release':
            self._ensure_writable()
            return self.release_context(command['actor'])
        if op == 'audit':
            return self.save_summary()
        if op == 'finish':
            return self.finish()
        raise ValueError('unsupported op')

    def reconcile(self, actor, observation_id, note):
        self._ensure_writable()
        state = self.actors[actor]
        if not state['reconcile_required'] or state['pending_action'] is None:
            raise ValueError('no pending ambiguity')
        if state['observation'] is None or state['observation']['observation_id'] != observation_id:
            raise ValueError('inspect the current observation first')
        if not isinstance(note, str) or not note.strip():
            raise ValueError('explicit reconciliation note is required')
        resolution = {'pending_action': state['pending_action'], 'observation_id': observation_id, 'note': note, 'outcome': 'unknown_not_retried', 'at': utc_now()}
        self.log('pending_action_reconciled', actor, resolution=resolution)
        state['reconciled_actions'].append(resolution)
        state['pending_action'], state['reconcile_required'] = (None, False)
        self.save_checkpoint()
        return {'actor': actor, 'reconciled': True, 'previous_action_outcome': 'unknown_not_retried'}

def serve(args):
    driver = Driver(args.world, args.run_dir, resume=args.resume, read_only=args.read_only, executable_path=args.chromium, app_dir=args.app_dir, profiles_dir=args.profiles_dir, fail_after_ui_commit_step=args.fail_after_ui_commit_step)

    class Handler(BaseHTTPRequestHandler):

        def log_message(self, *unused):
            pass

        def do_POST(self):
            try:
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size < 131072:
                    raise ValueError('invalid request size')
                command = json.loads(self.rfile.read(size))
                result = driver.dispatch(command)
                code = 200
            except Exception as error:
                result = {'transport_error': str(error)}
                try:
                    driver.log('transport_error', error=str(error), traceback=traceback.format_exc())
                except Exception:
                    pass
                code = 400
            payload = json.dumps(result, ensure_ascii=False).encode()
            self.send_response(code)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
    server = HTTPServer(('127.0.0.1', args.port), Handler)

    def _handle_signal(signum, frame):
        raise KeyboardInterrupt(f'signal {signum}')
    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)
    print(json.dumps({'status': 'listening', 'port': server.server_port, 'run_dir': str(driver.directory), 'resume': driver.resume_mode, 'read_only': driver.read_only, 'resumed_count': driver.resumed_count}), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        driver.suspend_on_shutdown()

def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest='mode', required=True)
    server = sub.add_parser('serve')
    server.add_argument('--world', type=Path, required=True)
    server.add_argument('--run-dir', type=Path, required=True)
    server.add_argument('--port', type=int, default=8052)
    server.add_argument('--resume', action='store_true', help='Resume an existing interrupted run-dir')
    server.add_argument('--read-only', action='store_true', help='Open existing run-dir in read-only mode')
    server.add_argument('--chromium', type=str, default=None, help='Path to Chromium executable')
    server.add_argument('--app-dir', type=Path, default=None, help='Path to personal-lab directory for version verification')
    server.add_argument('--profiles-dir', type=Path, default=None, help='Optional custom profiles directory')
    server.add_argument('--fail-after-ui-commit-step', type=int, default=None, help=argparse.SUPPRESS)
    client = sub.add_parser('request')
    client.add_argument('--port', type=int, default=8052)
    client.add_argument('json')
    args = parser.parse_args()
    if args.mode == 'serve':
        serve(args)
    else:
        payload = json.dumps(json.loads(args.json), ensure_ascii=False).encode()
        request = urllib.request.Request(f'http://127.0.0.1:{args.port}/', data=payload, headers={'Content-Type': 'application/json'})
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        try:
            with opener.open(request, timeout=45) as response:
                print(response.read().decode())
        except urllib.error.HTTPError as error:
            print(error.read().decode())
            raise SystemExit(1)

if __name__ == '__main__':
    main()
