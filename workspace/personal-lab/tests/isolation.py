#!/usr/bin/env python3
"""Personal and Lab coexist on one disposable origin; no real profile or data."""
import json
import re
import threading
import traceback
from datetime import datetime, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'verification'
OUT.mkdir(exist_ok=True)
results = []


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


server = ThreadingHTTPServer(
    ('127.0.0.1', 0), partial(Handler, directory=str(ROOT.parent)))
threading.Thread(target=server.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{server.server_port}'


def record(name, fn):
    try:
        fn()
        results.append({'name': name, 'pass': True})
        print('PASS', name, flush=True)
    except Exception as error:
        results.append({'name': name, 'pass': False, 'error': traceback.format_exc()})
        print('FAIL', name, traceback.format_exc(), flush=True)


def action(page, act, extra=''):
    page.locator(f'[data-act="{act}"]{extra}').filter(visible=True).first.click()
    page.wait_for_timeout(100)


def state(page, directory):
    return page.evaluate(
        '(key) => JSON.parse(localStorage.getItem(key))',
        f'lifegame-{directory}-my-v1')


def snapshot(page, directory):
    return page.evaluate('''prefix => Object.fromEntries(
        Object.keys(localStorage).filter(k => k === prefix + 'meta-v1' ||
            k.startsWith(prefix + 'my-v1') || k.startsWith(prefix + 'demo-v1'))
        .sort().map(k => [k, localStorage.getItem(k)]))''',
        f'lifegame-{directory}-')


try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path='/usr/bin/chromium', headless=True,
            args=['--no-sandbox'])
        for order in [('personal', 'personal-lab'), ('personal-lab', 'personal')]:
            label = ' → '.join(order)
            context = browser.new_context(
                viewport={'width': 390, 'height': 844},
                locale='ru-RU', timezone_id='Europe/Moscow')
            context.route('**/*', lambda route: route.continue_()
                          if route.request.url.startswith(BASE + '/') else route.abort())
            pages, before, errors = {}, {}, []

            def setup():
                for directory in order:
                    page = context.new_page()
                    page.on('pageerror', lambda error: errors.append(str(error)))
                    page.clock.install(time=datetime(2026, 11, 11, 9, tzinfo=timezone.utc))
                    page.set_default_timeout(8000)
                    pages[directory] = page
                    page.goto(BASE + '/' + directory + '/', wait_until='networkidle')
                    action(page, 'welcome', '[data-v=my]')
                    action(page, 'sheet-close')
                    page.wait_for_function('!!navigator.serviceWorker.controller')
                    assert page.evaluate('navigator.serviceWorker.controller.scriptURL') == (
                        BASE + '/' + directory + '/sw.js')
                    assert state(page, directory)['tasks'] == [], 'new personal space must be empty'
                    if directory == 'personal-lab':
                        assert 'LifeGame Lab' in page.title(), page.title()
                        assert page.locator('.brand').text_content() == 'LifeGame Lab', page.locator('.brand').text_content()
                    action(page, 'tab', '[data-v=more]')
                    action(page, 'go', '[data-s=tasks]')
                    action(page, 'new', '[data-k=task]')
                    page.locator('[name=title]').fill('Тест ' + directory)
                    page.locator('form[data-form=item] button:not([type=button])').last.click()
                    page.wait_for_function(
                        'key => JSON.parse(localStorage.getItem(key)).tasks.length === 1',
                        arg=f'lifegame-{directory}-my-v1')
                    before[directory] = snapshot(page, directory)

            record(label + ': separate empty state, task and worker scope', setup)

            def storage():
                for directory, page in pages.items():
                    assert snapshot(page, directory) == before[directory]
                    assert [task['title'] for task in state(page, directory)['tasks']] == [
                        'Тест ' + directory]
                    page.reload(wait_until='networkidle')
                    assert len(state(page, directory)['tasks']) == 1
                    assert snapshot(page, directory) == before[directory]

            record(label + ': creating and reloading either app preserves the other storage', storage)

            def caches():
                page = pages[order[-1]]
                names = page.evaluate('caches.keys()')
                expected = [re.search(r"const CACHE='([^']+)'", (
                    ROOT.parent / directory / 'sw.js').read_text()).group(1)
                    for directory in order]
                assert len(set(expected)) == 2, expected
                assert all(name in names for name in expected), names
                scopes = page.evaluate('''async () =>
                    (await navigator.serviceWorker.getRegistrations()).map(r => r.scope).sort()''')
                assert scopes == sorted(BASE + '/' + name + '/' for name in order), scopes

            record(label + ': both offline caches survive worker activation', caches)

            def offline():
                context.set_offline(True)
                for directory, page in pages.items():
                    page.reload(wait_until='networkidle')
                    assert page.locator('.brand').is_visible()
                    assert state(page, directory)['tasks'][0]['title'] == 'Тест ' + directory
                    assert snapshot(page, directory) == before[directory]
                assert not errors, errors

            record(label + ': both apps reload offline with their own data and no JS errors', offline)
            context.close()
        browser.close()
finally:
    server.shutdown()
    server.server_close()
    (OUT / 'isolation-report.json').write_text(
        json.dumps(results, ensure_ascii=False, indent=2) + '\n')

print(f"{sum(result['pass'] for result in results)}/{len(results)} passed")
raise SystemExit(0 if len(results) == 8 and all(result['pass'] for result in results) else 1)
