#!/usr/bin/env python3
"""LAB-014 adapter; the LAB-005 native transport stays byte-identical."""
import json
from pathlib import Path

import driver_native as native
from bundle import ROOT, verify_bundle, probe_http

PREFIX = 'lifegame-flex-lab-'
PRIMARY = PREFIX + 'my-v1'
native.CORE_APP_FILES += ('flex-model.js', 'flex-ui.js')


class FlexDriver(native.Driver):
    def __init__(self, *args, **kwargs):
        verify_bundle()
        kwargs.setdefault('app_dir', ROOT / 'public/personal-lab')
        if kwargs['app_dir'] is None:
            kwargs['app_dir'] = ROOT / 'public/personal-lab'
        if Path(kwargs['app_dir']).resolve() != (ROOT / 'public/personal-lab').resolve():
            raise ValueError('use the frozen application directory in this kit')
        if not kwargs.get('read_only'):
            world_path = kwargs.get('world_path', args[0] if args else None)
            probe_http(json.loads(Path(world_path).read_text())['app_url'])
        super().__init__(*args, **kwargs)

    def _init_fresh_run(self):
        super()._init_fresh_run()
        path = self.directory / 'run.json'
        meta = json.loads(path.read_text())
        meta['lab014_adapter_sha256'] = native.file_sha256(Path(__file__))
        meta['application_variant'] = 'LAB-009 flexible-complexity + LAB-013'
        native.dump(path, meta)

    def _verify_world_and_app_version(self, run_meta, checkpoint_meta):
        super()._verify_world_and_app_version(run_meta, checkpoint_meta)
        if run_meta.get('lab014_adapter_sha256') != native.file_sha256(Path(__file__)):
            raise ValueError('LAB-014 adapter mismatch; refusing to resume')

    def snapshot_state(self, actor):
        a = self.actors[actor]
        raw = a['page'].evaluate('() => Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)]))')
        parsed = {}
        for key, value in raw.items():
            try:
                parsed[key] = json.loads(value)
            except (TypeError, ValueError):
                parsed[key] = value
        path = self.directory / actor / f"day-{a['day']:02d}" / 'observer-state.json'
        native.dump(path, parsed)
        primary = parsed.get(PRIMARY)
        summary = {'keys': list(parsed), 'path': str(path), 'primary_valid_json': isinstance(primary, dict),
                   'namespace_isolated': all(k.startswith(PREFIX) for k in parsed)}
        if isinstance(primary, dict):
            ledger = primary.get('ledger', [])
            summary.update(lastProcessed=primary.get('lastProcessed'), revision=primary.get('revision'),
                           counts={k: len(primary.get(k, [])) for k in ('tasks', 'habits', 'quests', 'cal', 'facts', 'ledger', 'misses', 'timeLog')},
                           coins=sum(x.get('coins', 0) for x in ledger), xp=sum(x.get('xp', 0) for x in ledger))
        a['latest_state'] = summary
        return summary


native.Driver = FlexDriver

if __name__ == '__main__':
    native.main()
