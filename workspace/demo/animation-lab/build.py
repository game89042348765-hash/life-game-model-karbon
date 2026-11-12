"""Produce one offline HTML containing all eleven design/motion studies."""
from pathlib import Path
root=Path(__file__).resolve().parents[2]
s=(root/'downloads/stage-animation-template.html').read_text()
css=(Path(__file__).parent/'lab.css').read_text()
js=(Path(__file__).parent/'lab.js').read_text()
s=s.replace('<title>LifeGame — шаблон анимаций этапов</title>','<title>LifeGame — 11 языков движения к цели</title>')
s=s.replace('</style>', '\n'+css+'\n</style>',1)
# Capture the full document after both scripts are parsed, including the gallery.
s=s.replace("const standaloneSource='<!doctype html>\\n'+document.documentElement.outerHTML;", "let standaloneSource='';window.addEventListener('DOMContentLoaded',()=>{standaloneSource='<!doctype html>\\n'+document.documentElement.outerHTML;},{once:true});")
s=s.replace('stage-animation-template.html','strategy-animation-lab.html')
s=s.replace('</body>', '<script>\n'+js+'\n</script>\n</body>')
(root/'downloads/strategy-animation-lab.html').write_text(s)
print('Built downloads/strategy-animation-lab.html:',len(s.encode()),'bytes')
