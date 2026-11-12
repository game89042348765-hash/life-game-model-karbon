#!/usr/bin/env python3
"""Portable kit verification and collection; no application mutations."""
import argparse
import hashlib
import importlib.metadata
import json
import shutil
import sys
import urllib.request
import zipfile
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_bundle():
    manifest = json.loads((ROOT / 'MANIFEST.json').read_text())
    for name, entry in manifest['files'].items():
        path = ROOT / name
        if not path.is_file() or sha(path) != entry['sha256'] or path.stat().st_size != entry['bytes']:
            raise ValueError('bundle mismatch: ' + name)
    return manifest


def probe_http(url):
    parsed = urlsplit(url)
    if parsed.scheme != 'http' or parsed.hostname != '127.0.0.1' or parsed.path != '/personal-lab/' or parsed.query or parsed.fragment:
        raise ValueError('only http://127.0.0.1:PORT/personal-lab/ is allowed')
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    for name, entry in verify_bundle()['files'].items():
        if not name.startswith('public/personal-lab/'):
            continue
        relative = name.removeprefix('public/personal-lab/')
        with opener.open(url + relative, timeout=10) as response:
            data = response.read()
        if hashlib.sha256(data).hexdigest() != entry['sha256']:
            raise ValueError('HTTP serves another application: ' + relative)


def preflight(chromium):
    verify_bundle()
    result = {'python': sys.version.split()[0], 'platform': sys.platform,
              'playwright': importlib.metadata.version('playwright'), 'chromium': str(Path(chromium).resolve()),
              'node': shutil.which('node'), 'independent_model_contexts': 'must be checked by runner',
              'paid_api_requests': 0}
    if sys.platform != 'linux':
        raise ValueError('kit was verified on Linux; use a Linux runtime')
    if not Path(chromium).is_file() or not result['node']:
        raise ValueError('Chromium executable and Node are required')
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=chromium, headless=True, args=['--no-sandbox'])
        page = browser.new_page()
        page.set_content('<title>LAB-014 preflight</title>')
        assert page.title() == 'LAB-014 preflight'
        browser.close()
    result['browser_launch'] = 'passed'
    return result


def collect(run, output):
    run, output = run.resolve(), output.resolve()
    if output.exists() or not (run / 'run.json').is_file():
        raise ValueError('choose an existing run-dir and a new output ZIP')
    if run == output.parent or run in output.parents:
        raise ValueError('return ZIP must be outside the run-dir')
    files = []
    for p in sorted(run.rglob('*')):
        relative = p.relative_to(run)
        if p.is_symlink() or 'profiles' in relative.parts or any(x.startswith('.') for x in relative.parts):
            continue
        if p.is_file():
            files.append((p, relative))
    entries = {str(r): {'sha256': sha(p), 'bytes': p.stat().st_size} for p, r in files}
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, 'x', zipfile.ZIP_DEFLATED) as archive:
        for p, relative in files:
            archive.write(p, 'results/' + relative.as_posix())
        archive.writestr('RETURN-MANIFEST.json', json.dumps({'files': entries, 'profiles_included': False,
                         'note': 'Evidence package, not a portable Chromium session.'}, ensure_ascii=False, indent=2))
    return {'zip': str(output), 'files': len(entries), 'bytes': output.stat().st_size, 'sha256': sha(output)}


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('verify')
    pre = sub.add_parser('preflight'); pre.add_argument('--chromium', default='/usr/bin/chromium')
    probe = sub.add_parser('probe-http'); probe.add_argument('--url', default='http://127.0.0.1:8041/personal-lab/')
    ret = sub.add_parser('collect'); ret.add_argument('--run-dir', type=Path, required=True); ret.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.command == 'verify':
        result = {'verified_files': len(verify_bundle()['files'])}
    elif args.command == 'preflight':
        result = preflight(args.chromium)
    elif args.command == 'probe-http':
        probe_http(args.url); result = {'http_version': 'matched'}
    else:
        result = collect(args.run_dir, args.output)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
