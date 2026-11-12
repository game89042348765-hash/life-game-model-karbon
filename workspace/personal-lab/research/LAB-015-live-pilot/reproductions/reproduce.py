"""Independent LAB-015 UI reproductions. No original profiles or application writes.

Only ordinary Playwright UI actions mutate application state. evaluate calls read
DOM geometry or localStorage for the observer. External requests are blocked.
"""
import datetime as dt
import argparse
import json
import pathlib
import re
import traceback
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

PARSER = argparse.ArgumentParser(description=__doc__)
PARSER.add_argument('cases', nargs='*', choices=['R1', 'R2', 'R3'])
PARSER.add_argument('--url', default='http://127.0.0.1:42367/personal-lab/', help='URL of your own frozen source-kit server; pilot endpoint is only a local default')
PARSER.add_argument('--output-dir', type=pathlib.Path, help='New output directory; default is a timestamped subdirectory beside this script')
ARGS = PARSER.parse_args()
ROOT = ARGS.output_dir.resolve() if ARGS.output_dir else pathlib.Path(__file__).resolve().parent / ('rerun-' + dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
ROOT.mkdir(parents=True, exist_ok=True)
URL = ARGS.url
ALLOWED_ENDPOINT = (urlsplit(URL).scheme, urlsplit(URL).netloc)
PRIMARY = 'lifegame-flex-lab-my-v1'
SELECTED = set(ARGS.cases or ['R1', 'R2', 'R3'])
RESULTS = [x for x in json.loads((ROOT / 'results.json').read_text()) if x['case_id'] not in SELECTED] if (ROOT / 'results.json').exists() else []


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def at(day):
    return dt.datetime(2026, 11, day, 18, tzinfo=dt.timezone.utc)


class Case:
    def __init__(self, browser, name, width):
        self.name = name
        self.root = ROOT / name
        self.root.mkdir(exist_ok=True)
        if any(self.root.iterdir()):
            raise RuntimeError('Refusing to overwrite existing evidence: ' + str(self.root))
        self.blocked = []
        self.actions = []
        self.observations = []
        self.context = browser.new_context(viewport={'width': width, 'height': 844}, locale='ru-RU', timezone_id='Europe/Moscow', service_workers='block')
        def route(req):
            if (urlsplit(req.request.url).scheme, urlsplit(req.request.url).netloc) == ALLOWED_ENDPOINT:
                req.continue_()
            else:
                self.blocked.append(req.request.url)
                req.abort()
        self.context.route('**/*', route)
        self.context.tracing.start(screenshots=True, snapshots=True, sources=False, title=name)
        self.page = self.context.new_page()
        self.page.set_default_timeout(7000)
        self.page.on('dialog', lambda d: (self.actions.append({'transport_dialog_dismissed': d.type, 'message': d.message}), d.dismiss()))
        self.page.clock.install(time=at(16))
        self.page.goto(URL)

    def action(self, kind, label, fn):
        self.actions.append({'step': len(self.actions) + 1, 'operation': kind, 'target': label})
        return fn()

    def click(self, name):
        return self.action('click', str(name), lambda: self.page.get_by_role('button', name=name, exact=isinstance(name, str)).click())

    def fill(self, label, value):
        if label == 'Сколько минут уже потратили':
            locator = self.page.locator('input[type=number]')
        elif label.startswith('Задания, привычки,'):
            locator = self.page.locator('input[type=search]')
        else:
            locator = self.page.get_by_label(label, exact=True)
        return self.action('fill', label + '=' + str(value), lambda: locator.fill(str(value)))

    def snapshot(self, suffix):
        oid = self.name + '-' + suffix
        png = self.root / (oid + '.png')
        self.page.wait_for_timeout(250)
        self.page.screenshot(path=str(png), full_page=False)
        state = self.page.evaluate("() => Object.fromEntries(Object.entries(localStorage).map(([k,v])=>{try{return [k,JSON.parse(v)]}catch{return [k,v]}}))")
        data = {
            'observation_id': oid,
            'url': self.page.url,
            'virtual_time': self.page.evaluate('() => new Date().toISOString()'),
            'visible_text': self.page.locator('body').inner_text(),
            'controls': self.page.locator('button,input,select,textarea').evaluate_all("es=>es.map(e=>({tag:e.tagName,id:e.id,text:e.innerText,aria:e.getAttribute('aria-label'),type:e.type,value:e.value,rect:JSON.parse(JSON.stringify(e.getBoundingClientRect()))}))"),
            'screenshot': png.name,
            'observer_state': state,
        }
        write(self.root / (oid + '.json'), data)
        self.observations.append({'observation_id': oid, 'png': str(png.relative_to(ROOT.parent)), 'json': str((self.root / (oid + '.json')).relative_to(ROOT.parent))})
        return data

    def basic(self, stats=False, calendar=False):
        self.click(re.compile(r'^Базовый\s'))
        if stats:
            self.action('check', 'Спокойная статистика за неделю', lambda: self.page.get_by_label('Спокойная статистика за неделю', exact=True).check())
        if calendar:
            self.action('check', 'Календарь: только выбранные события', lambda: self.page.get_by_label('Календарь: только выбранные события', exact=True).check())
        self.click('Сохранить ритм')
        self.page.get_by_role('button', name='Сохранить ритм', exact=True).wait_for(state='hidden')

    def add(self, title, kind='Разовое задание', screenshot=None):
        self.click('Добавить в ритм')
        self.fill('Что хотите сделать', title)
        self.action('select', 'Что это=' + kind, lambda: self.page.get_by_label('Что это', exact=True).select_option(label=kind))
        if screenshot:
            self.snapshot(screenshot)
        self.action('click', 'form: Добавить в ритм', lambda: self.page.locator('button[type=submit]').filter(has_text='Добавить в ритм').click())
        self.page.get_by_label('Что хотите сделать', exact=True).wait_for(state='hidden')

    def minutes(self, n):
        self.click('Записать время')
        self.fill('Сколько минут уже потратили', n)
        self.click('Записать минуты')
        self.page.get_by_role('button', name='Записать минуты', exact=True).wait_for(state='hidden')

    def change_day(self, day):
        self.page.clock.set_system_time(at(day))
        self.page.reload()

    def close(self, result):
        write(self.root / 'actions.json', self.actions)
        write(self.root / 'network-blocks.json', self.blocked)
        result.update({'case_id': self.name, 'observations': self.observations, 'actions_file': str((self.root / 'actions.json').relative_to(ROOT.parent)), 'trace': str((self.root / 'trace.zip').relative_to(ROOT.parent)), 'external_requests_blocked': self.blocked, 'fresh_context': True, 'participant_profiles_used': False, 'state_mutation': 'UI only', 'service_workers': 'blocked for isolated reproduction; offline not retested'})
        write(self.root / 'result.json', result)
        self.context.tracing.stop(path=str(self.root / 'trace.zip'))
        self.context.close()
        RESULTS.append(result)


def r1(case):
    title = 'Проверка аналитика: чтение'
    case.basic(stats=True)
    case.add(title, 'Ежедневная привычка')
    case.minutes(5)
    case.snapshot('day1-five-minutes')
    case.change_day(17)
    case.minutes(8)
    d = case.snapshot('day2-thirteen-retained')
    s = d['observer_state'][PRIMARY]
    assert [(x['date'], x['minutes']) for x in s['timeLog']] == [('2026-11-16', 5), ('2026-11-17', 8)]
    assert len(s['facts']) == 0 and len(s['ledger']) == 0
    assert 'Отметок в выбранном ритме: 0' in d['visible_text']
    assert 'записано 8 мин.' in d['visible_text']
    return {'status': 'reproduced', 'claim': 'В Базовом прошлые частичные минуты не представлены недельным счётчиком отметок; сохранение минут исправно.', 'technical_bug': False, 'retained_minutes': 13, 'marks': 0, 'limits': 'Проверен текущий Базовый экран, отсутствие истории во всём продукте не утверждается.'}


def r2(case):
    title = 'Проверка аналитика: отправить макет 20 ноября до 20:00'
    case.basic(calendar=True)
    case.add(title, screenshot='one-off-form')
    case.page.reload()
    d = case.snapshot('deadline-title-only')
    t = d['observer_state'][PRIMARY]['tasks'][0]
    assert t['title'] == title and t['sched'] == {'type': 'once', 'days': [], 'date': None}
    assert not d['observer_state'][PRIMARY]['cal']
    return {'status': 'reproduced', 'claim': 'В простом добавлении разового задания нет поля срока. Дата в названии сохраняется текстом, структурная дата не устанавливается.', 'technical_bug': False, 'saved_schedule': t['sched'], 'limits': 'Форма события календаря и возможности Полного не считаются отсутствующими.'}


def r3(case):
    title = 'Проверка аналитика: скетч'
    case.basic(stats=True)
    case.add(title)
    case.minutes(3)
    case.click('Отметить: ' + title)
    case.page.get_by_role('button', name='Снять отметку: ' + title, exact=True).wait_for(state='visible')
    first = case.snapshot('day1-completion-settled')
    assert first['observer_state'][PRIMARY]['facts'][0]['date'] == '2026-11-16'
    case.change_day(21)
    case.snapshot('completed-not-in-today')
    case.click('Полный')
    case.click('Поиск')
    case.fill('Задания, привычки, квесты, календарь, бонусы, ништяки, решения', title)
    case.click(re.compile(r'^' + re.escape(title)))
    case.snapshot('past-fact-found')
    case.click('Изменить / перенести')
    case.click('Раз в неделю')
    case.click('Сб')
    top = case.snapshot('recurrence-form-top')
    save = [x for x in top['controls'] if x['text'] == 'Сохранить'][0]
    save_below = save['rect']['y'] >= 844
    case.page.mouse.move(190, 620)
    case.action('scroll', 'modal +500', lambda: case.page.mouse.wheel(0, 500))
    case.snapshot('recurrence-form-middle')
    case.action('scroll', 'modal +200', lambda: case.page.mouse.wheel(0, 200))
    case.snapshot('recurrence-form-bottom')
    case.click('Сохранить')
    case.click('Базовый')
    case.minutes(4)
    case.click('Отметить: ' + title)
    case.page.get_by_role('button', name='Снять отметку: ' + title, exact=True).wait_for(state='visible')
    case.page.reload()
    d = case.snapshot('weekly-result-persisted')
    s = d['observer_state'][PRIMARY]
    assert s['tasks'][0]['sched']['type'] == 'weekly' and s['tasks'][0]['sched']['days'] == [6]
    assert [(f['date'], f['cycle']) for f in s['facts']] == [('2026-11-16', 0), ('2026-11-21', 1)]
    assert sum(x['minutes'] for x in s['timeLog']) == 7
    return {'status': 'reproduced', 'claim': 'Повторяемость доступна через Полный и длинную форму; сохранение ниже начального мобильного экрана. История и новое выполнение сохраняются.', 'technical_bug': False, 'save_below_viewport': save_below, 'save_rect_before_scroll': save['rect'], 'retained_minutes': 7, 'completion_cycles': [0, 1]}


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    for name, width, fn in [('R1', 390, r1), ('R2', 1100, r2), ('R3', 375, r3)]:
        if name not in SELECTED:
            continue
        c = Case(browser, name, width)
        try:
            result = fn(c)
        except Exception as exc:
            c.snapshot('error')
            result = {'status': 'not_reproduced', 'script_error': str(exc), 'traceback': traceback.format_exc()}
        c.close(result)
        print(name, result['status'], result.get('claim', result.get('script_error')), flush=True)
    browser.close()
write(ROOT / 'results.json', sorted(RESULTS, key=lambda x:x['case_id']))
