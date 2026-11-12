#!/usr/bin/env python3
"""Technical regression for F6: text under fixed navigation must not leak to AI."""
import importlib.util
import json
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('synthetic_driver', HERE / 'driver.py')
driver = importlib.util.module_from_spec(spec)
spec.loader.exec_module(driver)
output = HERE.parents[1] / 'verification' / ('observation-check-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
output.mkdir(parents=True, exist_ok=False)
checks = []

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 400})
    page.route('**/*', lambda route: route.abort())
    page.set_content('''<html><head><style>
    body{margin:0;font:16px sans-serif}p{margin:0}
    #blocked{position:absolute;top:350px;left:4px}
    #partial{position:absolute;top:110px;left:4px;width:150px;line-height:24px}
    #cover{position:fixed;left:0;right:0;bottom:0;height:64px;background:white;z-index:9}
    </style></head><body><h1>Видимый заголовок</h1>
    <div id="partial">ВидимоеНачало<br>ВидимаяСтрока<br>ЕщёСтрока<br>Текст<br>Текст<br>Текст<br>Текст<br>Текст<br>Текст<br>Текст<br>СкрытыйХвост</div>
    <p id="blocked">СкрытаяНавигациейСтрока</p>
    <div style="position:absolute;top:220px;left:250px;width:80px;height:20px;overflow:hidden">
      <button style="margin-left:100px">ОбрезаннаяКнопка</button>
    </div>
    <nav id="cover"><button>ВидимаяКнопка</button></nav></body></html>''')
    observed = page.evaluate(driver.SNAPSHOT)
    text = observed['visible_text']
    checks.extend([
        {'name': 'visible heading retained', 'pass': 'Видимый заголовок' in text},
        {'name': 'text hidden by navigation excluded', 'pass': 'СкрытаяНавигациейСтрока' not in text},
        {'name': 'partially visible block retains exposed text', 'pass': 'ВидимоеНачало' in text},
        {'name': 'below-fold tail excluded', 'pass': 'СкрытыйХвост' not in text},
        {'name': 'visible control remains actionable', 'pass': any(e['label'] == 'ВидимаяКнопка' for e in observed['elements'])},
        {'name': 'clipped control excluded', 'pass': all(e['label'] != 'ОбрезаннаяКнопка' for e in observed['elements'])},
    ])
    page.screenshot(path=str(output / 'fixture.png'))
    (output / 'observation.json').write_text(json.dumps(observed, ensure_ascii=False, indent=2))
    browser.close()

(output / 'report.json').write_text(json.dumps(checks, ensure_ascii=False, indent=2))
for check in checks:
    print('PASS' if check['pass'] else 'FAIL', check['name'])
print('Technical fixture only; not additional user sessions:', output)
raise SystemExit(0 if all(check['pass'] for check in checks) else 1)
