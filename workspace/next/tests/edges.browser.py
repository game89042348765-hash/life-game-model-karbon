"""Targeted UI/data recovery checks, isolated from the seven-day scenario."""
from pathlib import Path
from datetime import datetime,timezone
import os,json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[2]
BASE=os.environ.get('LIFEGAME_TEST_URL','http://127.0.0.1:8027')
OUT=ROOT/'next'/'verification';OUT.mkdir(exist_ok=True)
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 c=b.new_context(viewport={'width':390,'height':844},locale='ru-RU',timezone_id='Europe/Moscow')
 c.route('**/*',lambda r:r.continue_() if r.request.url.startswith(BASE+'/') else r.abort())
 errors=[];checks=[]
 def fresh_page():
  p=c.new_page();p.set_default_timeout(10000);p.on('pageerror',lambda e:errors.append(str(e)));p.clock.install(time=datetime(2026,11,9,8,tzinfo=timezone.utc));return p
 p=fresh_page();p.goto(BASE+'/next/',wait_until='networkidle')
 p.evaluate('localStorage.setItem("lifegame-prototype-v1","old-app-sentinel")')
 def s():return p.evaluate('JSON.parse(localStorage.getItem("lifegame-next-v1"))')
 def wait(expr):p.wait_for_function('(()=>{const s=JSON.parse(localStorage.getItem("lifegame-next-v1"));return '+expr+'})()')
 def go(route):p.evaluate('(r)=>location.hash=r',route);p.wait_for_function('(r)=>location.hash==="#"+r',arg=route);p.wait_for_timeout(40)
 def a(action,id=None):p.locator(f'[data-action="{action}"]'+(f'[data-id="{id}"]' if id else '')+':not(:disabled)').filter(visible=True).first.click()
 def fill(name,value):p.locator(f'#entity-form [name="{name}"]').fill(str(value))
 def choose(name,value):p.locator(f'#entity-form [name="{name}"]').select_option(str(value))
 def flag(name,on=True):p.locator(f'#entity-form [name="{name}"]').set_checked(on)
 def save():
  rev=s()['revision'];p.locator('#entity-form button[type=submit]').click();wait(f's.revision>{rev}');p.wait_for_function('!location.hash.startsWith("#form/")')
 def yes():a('confirm-yes');p.wait_for_timeout(80)
 def check(name):checks.append(name);print('PASS',name,flush=True)
 go('blocks');a('new-block');fill('name','Проверка границ');save();block=next(x for x in s()['blocks'] if x['name']=='Проверка границ');sid=block['currentStageId'];nextid=next(x['id'] for x in s()['stages'] if x['blockId']==block['id'] and x['role']=='step' and x['id']!=sid)
 go('day');a('new-task');fill('name','Проверка точной награды');choose('stageId',sid);flag('leads');p.get_by_text('Создать новую цель в этом этапе',exact=True).click();fill('newGoalName','Цель из задания');fill('reward',1234);save();item=s()['items'][0];goal=s()['goals'][0]
 assert item['goalId']==goal['id'];a('complete',item['id']);wait('s.ledger.length===1');p.locator('[data-fold=day-done]>summary').click();a('edit',item['id']);fill('reward',500);save();assert '1\u00a0234' in p.locator(f'[data-item="{item["id"]}"] .item-reward').inner_text()
 assert sum(l['coins'] for l in s()['ledger'])==1234
 check('атомарная цель из редактора; точная историческая награда на карточке')
 go('stage/'+sid);a('goal-menu',goal['id']);a('edit',goal['id']);choose('stageId',nextid);save();assert s()['items'][0]['stageId']==nextid
 go('stage/'+nextid);a('stage-complete',nextid);p.locator('#close-stage-form [name=nextStageId]').select_option('');p.locator('#close-stage-form button[type=submit]').click();wait(f'!!s.stages.find(x=>x.id==="{nextid}").completedAt')
 go('tasks');a('edit',item['id']);fill('description','Правка в завершённом этапе');save();assert s()['items'][0]['description']=='Правка в завершённом этапе'
 check('перенос цели вместе с заданием; редактирование завершённого этапа без переписывания денег')
 go('habits');a('new-habit');fill('name','Возобновляемая практика');flag('inDay');save();habit=next(i for i in s()['items'] if i['kind']=='habit');assert habit['schedule']['mode']=='daily'
 a('item-menu',habit['id']);a('item-close',habit['id']);yes();wait(f'!!s.items.find(i=>i.id==="{habit["id"]}").closedAt');a('item-menu',habit['id']);a('item-reopen',habit['id']);yes();wait(f'!s.items.find(i=>i.id==="{habit["id"]}").closedAt')
 check('обычное создание, завершение и возобновление привычки')
 go('block/'+block['id']);a('edit',block['id']);a('archive-block',block['id']);yes();wait(f'!!s.blocks.find(i=>i.id==="{block["id"]}").archivedAt')
 go('archive');p.locator('#archive-kind').select_option('blocks');a('restore',block['id']);wait(f'!s.blocks.find(i=>i.id==="{block["id"]}").archivedAt')
 check('блок архивируется и восстанавливается через интерфейс')
 go('day');a('focus-dialog')
 for checkbox in p.locator('#focus-form input[name=blocks]').all():checkbox.uncheck()
 p.locator(f'#focus-form input[value="{block["id"]}"]').check();p.locator('#focus-form button[type=submit]').click();wait('s.settings.focusBlocks?.length===1')
 go('blocks');assert p.locator('.block-card').count()==1;a('show-all-blocks');assert p.locator('.block-card').count()==9
 go('day');a('focus-dialog');a('focus-off');wait('s.settings.focusBlocks===null')
 check('фокус скрывает остальные направления; все направления доступны явно')
 go('tools');a('tools-tab','catalog')
 for key in ['budget','dayGraph','happy','goalStep','reward']:
  a('tool-own',key);wait(f's.settings.myTools.includes("{key}")')
  p.locator(f'[data-tool="{key}"]').check();wait(f's.settings.tools.includes("{key}")')
 a('budget-edit');p.locator('#budget-form [name=minutes]').fill('35');p.locator('#budget-form button[type=submit]').click();wait('s.days["2026-11-09"].budget===35')
 a('graph');p.locator('#graph-form [name=hour10]').select_option(block['id']);p.locator('#graph-form button[type=submit]').click();wait(f's.settings.graph.weekday[10]==="{block["id"]}"')
 a('moment');p.locator('#moment-form [name=name]').fill('Заметил хороший момент');p.locator('#moment-form button[type=submit]').click();wait('s.moments.length===1')
 check('каталог инструментов, бюджет, график и коллекция хорошего сохраняются')
 a('tool-own','happy');wait('!s.settings.myTools.includes("happy")');assert len(s()['moments'])==1
 a('tool-own','happy');wait('s.settings.myTools.includes("happy")');p.get_by_text('Заметил хороший момент',exact=True).wait_for()
 go('day');assert p.locator('[data-action=review][data-id=daily]').count()==1;a('review-dismiss','daily');wait('s.settings.reviewDismissals.daily==="2026-11-09"');assert p.locator('[data-action=review][data-id=daily]').count()==0
 go('reviews');a('review','daily');p.locator('#review-form [name=answer0]').fill('Осмысленный пересмотр');p.locator('#review-form button[type=submit]').click();wait('s.reviews.length===1')
 go('history');assert p.locator('h1').inner_text()=='История'
 go('bonuses');a('bonus-history');assert p.locator('dialog').is_visible();a('modal-close')
 check('инструменты сохраняют данные без размещения; приглашения и запись пересмотра; история бонусов')
 go('tasks');a('edit',item['id']);p.get_by_text('Дополнительные настройки',exact=True).click();fill('category','Музыка');fill('tags','аккорды');fill('ifTrigger','устал');fill('ifAction','две минуты');save();assert 'Если устал, то две минуты' in p.locator('#content').inner_text()
 a('new-task');fill('name','Бытовое дело');p.get_by_text('Дополнительные настройки',exact=True).click();fill('category','Быт');save();p.locator('#list-category').select_option('Музыка');assert p.locator('.item-card').count()==1
 p.locator('#list-search').fill('аккорды');assert p.locator('.item-card').count()==1
 check('категория и поиск тега фильтруют реальные общие записи')
 # The actual second tab modifies storage while the first contains an unsaved edit.
 go('tasks');a('edit',item['id']);fill('name','Несохранённый черновик')
 p2=fresh_page();p2.goto(BASE+'/next/',wait_until='networkidle');p2.locator('[data-action=capture]').first.click();p2.locator('#capture-form [name=name]').fill('Другая вкладка');p2.locator('#capture-form button[type=submit]').click()
 wait('s.notes.some(n=>n.name==="Другая вкладка")');assert p.locator('#entity-form [name=name]').input_value()=='Несохранённый черновик'
 p.locator('#entity-form button[type=submit]').click();p.wait_for_timeout(100);assert s()['items'][0]['name']=='Проверка точной награды';assert 'устарел' in p.locator('#form-error').inner_text();a('form-cancel');p2.close()
 check('реальные две вкладки: черновик сохранён, устаревшая правка отклонена')
 # Invalid imports and failed writes must not change the authoritative life.
 go('settings');broken=OUT/'invalid-import.json';broken.write_text('{"app":"LifeGame Next","version":1,"data":{}}');before=json.dumps(s(),sort_keys=True)
 a('import');p.locator('#import-file').set_input_files(str(broken));yes();p.wait_for_timeout(100);assert json.dumps(s(),sort_keys=True)==before
 go('day');a('new-task');fill('name','Проверка отказа записи');save();pending=next(i for i in s()['items'] if i['name']=='Проверка отказа записи');before_events=len(s()['events'])
 p.evaluate('()=>{window.restoreWrite=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==="lifegame-next-v1")throw Error("quota simulation");return window.restoreWrite.call(this,k,v)}}')
 a('complete',pending['id']);p.wait_for_timeout(100);assert len(s()['events'])==before_events;assert 'не сохранено' in p.locator('#toast').inner_text()
 p.evaluate('Storage.prototype.setItem=window.restoreWrite;delete window.restoreWrite');a('complete',pending['id']);wait(f's.events.length>{before_events}')
 assert p.evaluate('localStorage.getItem("lifegame-prototype-v1")')=='old-app-sentinel'
 check('неверный импорт и отказ записи не меняют прогресс; старое хранилище нетронуто')
 # Literal text rendering, and dense full-page editors at narrow mobile sizes.
 go('inbox');a('capture');payload='<img src=x onerror=alert(1)> текст';p.locator('#capture-form [name=name]').fill(payload);p.locator('#capture-form button[type=submit]').click();wait('s.notes.some(n=>n.name.includes("onerror"))');assert p.locator('#content img').count()==0
 for width,height in [(320,568),(375,667),(900,700)]:
  p.set_viewport_size({'width':width,'height':height})
  for kind,route in [('block','blocks'),('task','tasks'),('habit','habits'),('quest','quests'),('calendar','calendar'),('bonus','bonuses'),('decision','decisions'),('treat','treats')]:
   go(route);a('new-'+kind);assert p.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,kind)
   p.locator('#entity-form button[type=submit]').scroll_into_view_if_needed();assert p.locator('[data-action=form-cancel]').is_visible();a('form-cancel')
 check('буквальный пользовательский текст и восемь редакторов на320/375/900 без горизонтального переполнения')
 p.set_viewport_size({'width':390,'height':844});go('calendar');a('new-calendar');fill('name','Однократный визит');save();visit=next(i for i in s()['items'] if i['name']=='Однократный визит');a('complete',visit['id']);wait(f's.events.some(e=>e.entityId==="{visit["id"]}")')
 p.clock.set_system_time(datetime(2026,11,10,8,tzinfo=timezone.utc));p.reload(wait_until='networkidle');wait('s.lastDay==="2026-11-10"')
 go('calendar');assert p.locator(f'[data-item="{visit["id"]}"] [data-action=complete]').count()==0
 go('reviews');p.locator('[data-action=review][data-key="2026-11-09"]').click();assert p.locator('#review-form [name=answer0]').input_value()=='Осмысленный пересмотр';p.locator('#review-form [name=answer0]').fill('Правка прежнего дня');p.locator('#review-form button[type=submit]').click();wait('s.reviews[0].answers[0]==="Правка прежнего дня"');assert s()['reviews'][0]['key']=='2026-11-09'
 go('day');assert p.locator('[data-action=review][data-id=daily]').count()==1
 p.screenshot(path=str(OUT/'edge-day.png'),full_page=True)
 go('tasks');a('new-task');p.screenshot(path=str(OUT/'edge-form.png'),full_page=True);a('form-cancel')
 check('разовый календарь остаётся выполненным завтра; правка старого обзора сохраняет его дату; новое приглашение на новый день')
 # A completely blocked localStorage getter must yield a recoverable screen.
 blocked=b.new_context(viewport={'width':390,'height':844});blocked.route('**/*',lambda r:r.continue_() if r.request.url.startswith(BASE+'/') else r.abort())
 blocked.add_init_script('Object.defineProperty(window,"localStorage",{get(){throw Error("Storage blocked")}})')
 q=blocked.new_page();q.on('pageerror',lambda e:errors.append(str(e)));q.goto(BASE+'/next/',wait_until='networkidle');assert q.locator('h1').inner_text()=='Сегодня';assert 'Не удалось прочитать' in q.locator('#content').inner_text();blocked.close()
 assert not errors,errors
 check('запрещённое хранилище показывает ошибку вместо пустого неработающего экрана')
 (OUT/'edge-results.json').write_text(json.dumps({'checks':checks,'jsErrors':errors},ensure_ascii=False,indent=2))
 b.close()
