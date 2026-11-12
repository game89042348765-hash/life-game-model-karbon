"""Build isolated demo from current runtime without modifying index.html or assets."""
from pathlib import Path
import re,hashlib,json,shutil
root=Path(__file__).resolve().parents[1]
s=(root/'index.html').read_text()
base=hashlib.sha256(s.encode()).hexdigest()
s=s.replace('lifegame-', 'lifegame-conveyor-demo-')
s=re.sub(r'([\"\'])assets/',r'\1../assets/',s)
s=re.sub(r'<script src="[^\"]*splash-(?:sunrise|scene)\.js[^\"]*"[^>]*></script>','',s)
s=s.replace('<title>LifeGame</title>','<title>LifeGame · конвейер стратегии · отдельное демо</title>')
s=s.replace('</head>', '<link rel="stylesheet" href="conveyor-demo.css?v=1">\n<script src="conveyor-engine.js?v=1"></script>\n<script>try{const d=JSON.parse(localStorage.getItem("lifegame-conveyor-demo-prototype-v1"));const day=d?.conveyor?.date;if(typeof day==="string"&&/^\\d{4}-\\d{2}-\\d{2}$/.test(day)&&Number.isFinite(Date.parse(day+"T12:00:00Z")))LifeGameConveyor.clock=day;}catch{}</script>\n</head>')
s=s.replace('  function today() { return dateKey(); }','  function today() { return LifeGameConveyor.clock || dateKey(); }')
s=s.replace('task.weekdays.includes(new Date().getDay() || 7)','task.weekdays.includes(new Date(today()+"T12:00:00").getDay() || 7)')
s=s.replace('taskId, date: dateKey(now), completedAt:', 'taskId, date: today(), completedAt:')
s=s.replace('    LifeGameCalendarLinks.normalize(data);\n    return data;','    LifeGameCalendarLinks.normalize(data);\n    LifeGameConveyor.reconcile(data,today());\n    return data;')
s=s.replace("const initialSelected=task.type==='daily'?task.inDayBuilder:!!state.dayPlans[date]?.includes(id);", "const initialSelected=task.conveyorStep?!!state.dayPlans[date]?.includes(id):task.type==='daily'?task.inDayBuilder:!!state.dayPlans[date]?.includes(id);")
s=s.replace("(task.type==='daily'?task.inDayBuilder&&!(state.daySkips[today()]||[]).includes(task.id):view.planIds.has(task.id))", "(task.conveyorStep?view.planIds.has(task.id):task.type==='daily'?task.inDayBuilder&&!(state.daySkips[today()]||[]).includes(task.id):view.planIds.has(task.id))")
s=s.replace('        state = loaded;', '        state = loaded; LifeGameConveyor.clock=loaded.conveyor?.date||null;')
s=s.replace('      state = checked;', '      state = checked; LifeGameConveyor.clock=checked.conveyor?.date||null;')
s=s.replace('      soundEnabled: true,','      soundEnabled: false,',1)
# Validation creates generated tasks after base validation; revalidation is on every subsequent transaction.
# Core scheduling drops daily tasks that aren't permanent habits. Reconciliation restores only today's generated commitments.
hooks=(root/'demo/conveyor-hooks.js').read_text()
s=s.replace('  // Инициализация только после объявления всех переменных.',hooks+'\n  // Инициализация только после объявления всех переменных.')
s=s.replace('    seedDemoTreatsOnce();','    cvSyncRealDay(); // Actual days advance too; simulation keeps its offset.')
s=s.replace('  render();\n})();\n</script>', '  render();\n})();\n</script>')
s='<!-- Isolated strategy demo. Runtime source SHA256: '+base+'. Do not use main app storage. -->\n'+s
# Freeze runtime dependencies so future main-app edits cannot silently redesign this demo.
refs=sorted(set(re.findall(r'(?:src|href)=["\']\.\./assets/([^"\'?]+)',s)))
assets=root/'demo/conveyor-assets';assets.mkdir(exist_ok=True)
manifest={'runtime_sha256':base,'assets':{}}
for name in refs:
    src=root/'assets'/name;shutil.copyfile(src,assets/name)
    manifest['assets'][name]=hashlib.sha256(src.read_bytes()).hexdigest()
s=s.replace('../assets/','conveyor-assets/')
(root/'demo/conveyor-source.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(root/'demo/strategy-conveyor.html').write_text(s)
print('Built demo/strategy-conveyor.html; runtime unchanged:',hashlib.sha256((root/'index.html').read_bytes()).hexdigest()==base)
