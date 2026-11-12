"""Seven fictional days through the real UI. No fixtures are shipped as app data."""
from pathlib import Path
from datetime import datetime,timezone
import json,os
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[2]
BASE=os.environ.get('LIFEGAME_TEST_URL','http://127.0.0.1:8027')
REPORT=ROOT/'next'/'verification'
REPORT.mkdir(exist_ok=True)
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':390,'height':844},locale='ru-RU',timezone_id='UTC',accept_downloads=True)
 context.route('**/*',lambda r:r.continue_() if r.request.url.startswith(BASE+'/') else r.abort())
 page=context.new_page();page.set_default_timeout(10000);errors=[];results=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.clock.install(time=datetime(2026,11,2,9,tzinfo=timezone.utc))
 page.goto(BASE+'/next/',wait_until='networkidle')
 def state():return page.evaluate('JSON.parse(localStorage.getItem("lifegame-next-v1"))')
 def wait_state(expr):page.wait_for_function('(s)=>'+expr,'') if False else page.wait_for_function('(()=>{const s=JSON.parse(localStorage.getItem("lifegame-next-v1"));return '+expr+'})()')
 def go(route):
  page.evaluate('(r)=>location.hash=r',route)
  page.wait_for_function('(r)=>(location.hash||"#day")==="#"+r',arg=route)
  page.wait_for_timeout(45)
 def a(action,id=None,root=None):
  selector=f'[data-action="{action}"]'+(f'[data-id="{id}"]' if id else '')+':not(:disabled)'
  loc=(root or page).locator(selector).filter(visible=True)
  loc.first.click()
 def fill(key,value):page.locator(f'#entity-form [name="{key}"]').fill(str(value))
 def choose(key,value):page.locator(f'#entity-form [name="{key}"]').select_option(str(value))
 def flag(key,on=True):page.locator(f'#entity-form [name="{key}"]').set_checked(on)
 def save():
  rev=state()['revision'];page.locator('#entity-form button[type="submit"]').click()
  wait_state(f's.revision>{rev}');page.wait_for_function('!location.hash.startsWith("#form/")')
 def form(kind,title,stage=None):
  a('new-'+kind,stage);page.wait_for_selector('#entity-form');fill('name',title)
 def confirm():page.locator('dialog [data-action="confirm-yes"]').click();page.wait_for_timeout(80)
 def click_complete(id):
  before=len(state()['events']);a('complete',id);wait_state(f's.events.length>{before}')
 def newday(n):
  page.clock.set_system_time(datetime(2026,11,n,9,tzinfo=timezone.utc));page.reload(wait_until='networkidle');wait_state(f's.lastDay==="2026-11-{n:02d}"')
 def note(name):
  a('capture');page.locator('#capture-form [name="name"]').fill(name);page.locator('#capture-form button[type=submit]').click();page.wait_for_function('!document.querySelector("dialog[open]")')
 def record(day,checks):
  results.append({'day':day,'checks':checks,'events':len(state()['events']),'missed':len(state()['missed']),'coins':sum(x['coins'] for x in state()['ledger']),'xp':sum(x['xp'] for x in state()['ledger'])})
  print('PASS day',day,':',', '.join(checks),flush=True)
 def byname(kind,name):return next(x for x in state()[kind] if x['name']==name)

 # Day one: blank installation, personal strategy, all types of actions.
 assert len(state()['blocks'])==8 and not state()['items'] and not state()['ledger']
 page.screenshot(path=str(REPORT/'empty-day.png'),full_page=True)
 go('blocks');a('new-block');fill('name','Музыка — проверка');save()
 block=byname('blocks','Музыка — проверка');sid=block['currentStageId'];planned=next(x['id'] for x in state()['stages'] if x['blockId']==block['id'] and x['role']=='step' and x['id']!=sid)
 go('stage/'+sid);a('edit-stage',sid);fill('name','Основы');fill('meaning','Заниматься музыкой в удовольствие');fill('cause','Нужен понятный маршрут');save()
 a('new-goal',sid);fill('name','Уверенные переходы');fill('criterion','Три аккорда без остановок');save();goal=byname('goals','Уверенные переходы')
 a('add-action',sid);form('task','Аккорды — задача',sid);choose('scheduleMode','daily');flag('leads');choose('goalId',goal['id']);flag('key');flag('inDay',False);flag('inDay',True);page.get_by_text('Дополнительные настройки',exact=True).click();fill('estimate',15);save();task=byname('items','Аккорды — задача')
 a('add-action',sid);form('habit','Практика — привычка',sid);choose('scheduleMode','daily');flag('inDay');fill('target',3);fill('milestoneReward',100);save();habit=byname('items','Практика — привычка')
 a('add-action',sid);form('quest','Тренировки — квест',sid);choose('scheduleMode','daily');fill('target',3);fill('step',1);fill('reward',0);fill('finalReward',50);flag('inDay');save();quest=byname('items','Тренировки — квест')
 a('add-action',sid);form('quest','Подготовка инструмента',sid);choose('questType','checklist');page.locator('[name=stepName]').fill('Настроить');a('step-add');page.locator('[name=stepName]').nth(1).fill('Проверить струны');fill('finalReward',20);save();checklist=byname('items','Подготовка инструмента')
 go('bonuses');form('bonus','Приятный перерыв');fill('price',30);save();bonus=byname('bonuses','Приятный перерыв')
 go('quests');a('edit',quest['id']);a('pick-bonuses','final');page.locator(f'dialog input[value="{bonus["id"]}"]').check();page.locator('#bonus-pick-form button[type=submit]').click();save()
 assert any(x['bonusId']==bonus['id'] for x in state()['rewardLinks'])
 go('decisions');form('decision','Сохранять выбранный маршрут');choose('stageId',sid);fill('priceCoins',500);fill('priceXP',1500);fill('deadline','2026-11-04T20:00');save();decision=byname('decisions','Сохранять выбранный маршрут')
 go('treats');form('treat','Прогулка без телефона');fill('category','Отдых');save()
 go('calendar');form('calendar','Урок — календарь');choose('stageId',sid);fill('scheduleDate','2026-11-03');fill('time','20:00');save();calendar=byname('items','Урок — календарь')
 go('inbox');note('Спросить о преподавателе');assert len([x for x in state()['notes'] if not x['archivedAt']])==1
 go('day');click_complete(task['id'])
 go('tools');a('first-step');page.locator('#first-step-form select[name=itemId]').select_option(habit['id']);page.locator('#first-step-form button[type=submit]').click();wait_state('s.timer?.status==="running"')
 page.clock.fast_forward(121000);wait_state('s.timer.status==="finished"');page.locator('#timer-record-form [name=minutes]').fill('2');page.locator('#timer-record-form button[type=submit]').click();wait_state('s.timeSessions.length===1');assert not any(e['entityId']==habit['id'] for e in state()['events'])
 go('day');click_complete(habit['id']);click_complete(quest['id'])
 go('quests');page.locator(f'[data-item="{checklist["id"]}"] details summary').click();a('quest-step',checklist['id']);wait_state(f's.events.some(e=>e.entityId==="{checklist["id"]}"&&e.kind==="quest-step")')
 go('day');a('close-day');page.locator('#close-day-form [name=note]').fill('Есть понятный первый шаг');page.locator('#close-day-form button[type=submit]').click();wait_state('!!s.days["2026-11-02"].closedAt')
 form('task','После завершения дня');fill('reward',0);save();late=byname('items','После завершения дня');click_complete(late['id'])
 assert not errors,errors
 record(1,['пустая установка','свой блок и цель','четыре типа действий','резерв бонуса','таймер отдельно от выполнения','ритуал не закрывает день'])

 # Day two: calendar, partial progress, an intentional unfinished plan.
 newday(3);assert not state()['missed']
 go('day');click_complete(habit['id']);click_complete(quest['id']);click_complete(calendar['id'])
 go('quests');page.locator(f'[data-item="{checklist["id"]}"] details summary').click();a('quest-step',checklist['id']);wait_state(f's.events.some(e=>e.entityId==="{checklist["id"]}"&&e.kind==="quest-final")')
 go('day');form('task','Незавершённое разовое');save();once=byname('items','Незавершённое разовое')
 go('inbox');n=byname('notes','Спросить о преподавателе');a('note-menu',n['id']);a('convert-note',n['id']);save();assert byname('notes','Спросить о преподавателе')['archivedAt']
 record(2,['повторения на новую дату','календарное выполнение','автоматический финал чек-листа','превращение мысли в задание'])

 # Day three: rest excuses this date, prior misses remain.
 newday(4);assert len(state()['missed'])==2
 go('day');a('tempo','rest');wait_state('s.days["2026-11-04"].tempo==="rest"')
 form('task','Маленькое дело на отдыхе');choose('load','small');fill('reward',0);save();small=byname('items','Маленькое дело на отдыхе');click_complete(small['id'])
 go('calendar');form('calendar','Звонок — календарь');fill('scheduleDate','2026-11-05');save();call=byname('items','Звонок — календарь')
 assert byname('decisions','Сохранять выбранный маршрут')['status']=='active'
 go('missed');mid=state()['missed'][0]['id'];a('archive',mid);wait_state(f'!!s.missed.find(x=>x.id==="{mid}").archivedAt')
 record(3,['два отдельных пропуска','отдых снимает ожидание','прошлый пропуск архивируется отдельно','просроченное решение не штрафуется'])

 # Day four: global pause, calendar stays a real obligation.
 newday(5);assert len(state()['missed'])==2
 go('more');a('pause-dialog');page.locator('#pause-form button[type=submit]').click();wait_state('s.pauses.some(p=>!p.end)')
 record(4,['пауза без потери расписаний','календарь остаётся обязательством'])

 # Day five: return, milestone, earned bonus, move between life stages.
 newday(6);assert any(m['itemId']==call['id'] for m in state()['missed']);assert len(state()['missed'])==3
 go('day');a('pause-off');wait_state('!s.pauses.some(p=>!p.end)');click_complete(habit['id']);click_complete(task['id']);click_complete(quest['id'])
 assert any(e['kind']=='habit-milestone' and e['active'] for e in state()['events'])
 assert any(i['eventId'] for i in state()['instances'])
 go('stage/'+sid);a('goal-achieve',goal['id']);wait_state(f's.goals.find(g=>g.id==="{goal["id"]}").status==="achieved"')
 a('stage-complete',sid)
 for control in page.locator('#close-stage-form select[name^="choice-"]').all():control.select_option(planned)
 page.locator('#close-stage-form [name=nextStageId]').select_option(planned);page.locator('#close-stage-form button[type=submit]').click();wait_state(f's.blocks.find(b=>b.id==="{block["id"]}").currentStageId==="{planned}"')
 assert byname('items','Практика — привычка')['stageId']==planned
 a('stage-reopen',sid);confirm();wait_state(f'!s.stages.find(a=>a.id==="{sid}").completedAt')
 assert byname('items','Практика — привычка')['stageId']==planned
 assert byname('blocks','Музыка — проверка')['currentStageId']==planned
 go('bonuses');a('buy',bonus['id']);confirm();wait_state('s.instances.length===2')
 a('shop-tab','mine');earned=next(x for x in state()['instances'] if not x['paid']);a('bonus-use',earned['id']);confirm();wait_state(f's.instances.find(i=>i.id==="{earned["id"]}").uses.length===1')
 go('quests');before=len(state()['ledger']);a('undo',quest['id']);confirm();page.wait_for_timeout(100);assert len(state()['ledger'])==before;assert 'использована' in page.locator('#toast').inner_text()
 go('bonuses');a('shop-tab','mine');paid=next(x for x in state()['instances'] if x['paid']);a('bonus-refund',paid['id']);confirm();wait_state(f'!!s.instances.find(i=>i.id==="{paid["id"]}").refundedAt')
 record(5,['возврат после паузы','цель привычки','финал счётчика и выдача бонуса','закрытие и переоткрытие этапа','перенос сохраняет ID','использованный бонус блокирует отмену','возврат покупки'])

 # Day six: price of word, exact undo, no automatic penalty, persistent inbox.
 newday(7);go('decisions');a('decision-failed',decision['id']);confirm();wait_state(f's.decisions.find(d=>d.id==="{decision["id"]}").status==="failed"')
 assert sum(x['coins'] for x in state()['ledger'])<0 and sum(x['xp'] for x in state()['ledger'])<0
 page.locator('[data-fold=decision-history]>summary').click()
 a('decision-menu',decision['id']);a('decision-undo',decision['id']);confirm();wait_state(f's.decisions.find(d=>d.id==="{decision["id"]}").status==="active"')
 a('decision-menu',decision['id']);a('decision-cancelled',decision['id']);confirm();wait_state(f's.decisions.find(d=>d.id==="{decision["id"]}").status==="cancelled"')
 go('inbox');note('Неразобранная мысль');page.clock.fast_forward(16*60*1000);page.reload(wait_until='networkidle');assert any(n['name']=='Неразобранная мысль' and not n['archivedAt'] for n in state()['notes'])
 assert len(state()['items'])>=8
 record(6,['Цена слова допускает долг','ошибочный штраф возвращается точно','отмена решения без штрафа','неразобранная мысль переживает 15 минут'])

 # Day seven: bulk archive, review, independent copy, complete portable snapshot.
 newday(8);go('missed');assert len([x for x in state()['missed'] if not x['archivedAt']])>=3
 page.locator('[data-select-all=missed]').check();a('bulk-archive');confirm();wait_state('s.missed.every(m=>!!m.archivedAt)');assert byname('items','Практика — привычка')['archivedAt'] is None
 go('archive');page.locator('#archive-kind').select_option('missed');page.locator('[data-select-all=archive]').check();a('bulk-restore');confirm();wait_state('s.missed.every(m=>!m.archivedAt)')
 go('tasks');a('item-menu',task['id']);a('copy-item',task['id']);page.locator('#copy-item-form button[type=submit]').click();wait_state('s.items.some(i=>i.name.includes("копия"))');copy=next(i for i in state()['items'] if 'копия' in i['name']);assert not any(e['entityId']==copy['id'] for e in state()['events'])
 go('reviews');a('review','weekly');page.locator('#review-form [name=answer0]').fill('Начал и продолжил после паузы');page.locator('#review-form [name=answer2]').fill('Оставить короткую практику');page.locator('#review-form button[type=submit]').click();wait_state('s.reviews.length===1')
 go('settings')
 with page.expect_download() as dl:a('export')
 download=dl.value;backup=REPORT/'week-backup.json';download.save_as(str(backup));exported=json.loads(backup.read_text());assert exported['data']['items'] and exported['data']['missed']
 old_items=len(state()['items']);a('import');page.locator('#import-file').set_input_files(str(backup));confirm();wait_state(f's.items.length==={old_items}')
 assert state()['lastDay']=='2026-11-08'
 go('summary');page.screenshot(path=str(REPORT/'week-summary.png'),full_page=True)
 record(7,['массовый архив и восстановление пропусков','источники действий сохранены','независимая копия','недельный пересмотр','экспорт и импорт всей жизни'])

 # Responsive coverage including dense editors; no real user profile or outside requests.
 for width,height in [(320,568),(375,667),(390,844),(768,900),(1100,800)]:
  page.set_viewport_size({'width':width,'height':height})
  for r in ['day','blocks','tasks','habits','quests','calendar','bonuses','decisions','treats','inbox','summary','tools','archive','history','settings','reviews']:
   go(r);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,r)
 page.set_viewport_size({'width':390,'height':844})
 go('block/'+block['id']);a('block-mode','all');page.screenshot(path=str(REPORT/'week-strategy.png'),full_page=True)
 go('stage/'+planned);page.screenshot(path=str(REPORT/'week-stage.png'),full_page=True)
 assert not errors,errors
 (REPORT/'week-results.json').write_text(json.dumps({'days':results,'jsErrors':errors,'responsiveWidths':[320,375,390,768,1100]},ensure_ascii=False,indent=2))
 print('PASS seven real UI days, export/import, responsive pages, no JS errors',flush=True)
 browser.close()
