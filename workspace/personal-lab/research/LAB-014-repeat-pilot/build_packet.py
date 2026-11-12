#!/usr/bin/env python3
"""Build a standalone, source-pinned pilot kit; never changes application files."""
import argparse
import hashlib
import importlib.metadata
import json
import subprocess
import tempfile
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
BASELINE = '27919b94a7e7bb5f038dbb5235b79ea89b29c916'
APP = 'personal-lab/experiments/flexible-complexity'
DRIVER = 'personal-lab/research/LAB-002-digital-month/driver.py'
APP_ROOT = {'index.html', 'app.js', 'planning.js', 'persistence.js', 'style.css', 'sw.js', 'pwa.js',
            'flex-model.js', 'flex-ui.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def git_file(name):
    return subprocess.check_output(['git', 'show', BASELINE + ':' + name], cwd=REPO)


def build(output):
    if output.exists():
        raise ValueError('output exists; choose a new ZIP path')
    with tempfile.TemporaryDirectory(prefix='lab014-build-') as tmp:
        root = Path(tmp)
        def put(name, data):
            target = root / name; target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(data)
        app_files = {}
        paths = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', BASELINE, APP], cwd=REPO, text=True).splitlines()
        for name in paths:
            relative = name.removeprefix(APP + '/')
            if relative in APP_ROOT or relative.startswith('fonts/') and relative.endswith('.woff2'):
                data = git_file(name); put('public/personal-lab/' + relative, data)
                app_files[name] = {'sha256': sha(data), 'bytes': len(data), 'kit_path': 'public/personal-lab/' + relative}
        assert APP_ROOT <= {Path(x).name for x in app_files}
        native = git_file(DRIVER); put('transport/driver_native.py', native)
        for name in ['START_HERE.md', 'METHOD.md', 'PROMPT-RUNNER.md', 'PROMPT-ANALYST.md', 'REPORT-TEMPLATE.md',
                     'MANUAL-ACCEPTANCE.md', 'world.pilot.json', 'execution-provenance.template.json']:
            put(name, (HERE / name).read_bytes())
        for path in sorted((HERE / 'participants').glob('*.md')):
            put('participants/' + path.name, path.read_bytes())
        for name in ['pilot_driver.py', 'bundle.py', 'analyze.py', 'smoke.py']:
            put('transport/' + name, (HERE / 'transport' / name).read_bytes())
        version = importlib.metadata.version('playwright')
        put('requirements.txt', ('playwright==' + version + '\n').encode())
        source = {'task': 'LAB-014', 'status': 'prepared_kit_not_executed_ai_pilot', 'source_commit': BASELINE,
                  'source_repository': 'game89042348765-hash/life-game', 'application_variant': 'LAB-009 flexible-complexity with LAB-013',
                  'original_app_directory': APP, 'served_copy': 'public/personal-lab', 'runtime_files_byte_identical': True,
                  'app_files': app_files, 'native_transport': {'source': DRIVER, 'sha256': sha(native), 'byte_identical': True},
                  'new_files': 'LAB-014 adapter, package utilities, contexts and instructions are hashed in MANIFEST.json',
                  'architecture': 'local browser application; isolated persistent profiles stand in for accounts; no backend/cron/cloud sync',
                  'live_data_included': False, 'previous_findings_included': False, 'human_acceptance': 'pending'}
        put('SOURCE.json', (json.dumps(source, ensure_ascii=False, indent=2) + '\n').encode())
        manifest = {p.relative_to(root).as_posix(): {'sha256': sha(p.read_bytes()), 'bytes': p.stat().st_size}
                    for p in sorted(root.rglob('*')) if p.is_file()}
        put('MANIFEST.json', (json.dumps({'format': 1, 'files': manifest}, ensure_ascii=False, indent=2) + '\n').encode())
        output.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(output, 'x', zipfile.ZIP_DEFLATED) as archive:
            for p in sorted(root.rglob('*')):
                if p.is_file():
                    info = zipfile.ZipInfo('LifeGame-LAB-014-Pilot/' + p.relative_to(root).as_posix(), (2026, 11, 12, 0, 0, 0))
                    info.compress_type = zipfile.ZIP_DEFLATED; info.external_attr = 0o644 << 16
                    archive.writestr(info, p.read_bytes())
    return {'file': str(output), 'sha256': sha(output.read_bytes()), 'bytes': output.stat().st_size,
            'manifest_entries': len(manifest), 'runtime_files': len(app_files), 'source_commit': BASELINE}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args(); print(json.dumps(build(args.output.resolve()), ensure_ascii=False, indent=2))
