#!/usr/bin/env python3
"""Check the original handoff files before editing; no dependencies or network."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'MANIFEST.json').read_text())
errors = []
for name, item in manifest['files'].items():
    path = root / name
    if not path.is_file():
        errors.append({'file': name, 'problem': 'missing'})
    elif path.stat().st_size != item['bytes'] or hashlib.sha256(path.read_bytes()).hexdigest() != item['sha256']:
        errors.append({'file': name, 'problem': 'changed from supplied snapshot'})
print(json.dumps({'status': 'passed' if not errors else 'mismatch', 'checked_files': len(manifest['files']),
                  'source_commit': manifest['source_commit'], 'errors': errors}, ensure_ascii=False, indent=2))
raise SystemExit(1 if errors else 0)
