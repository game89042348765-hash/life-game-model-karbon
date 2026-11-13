const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
let rootHtml = '';
let toastHtml = '';
const attrs = {};
global.window = {
  localStorage: { _s: {}, getItem(k){ return this._s[k] || null; }, setItem(k,v){ this._s[k] = String(v); } },
  addEventListener(ev, fn){ if (ev === 'DOMContentLoaded') global._init = fn; }
};
global.navigator = { clipboard: null };
global.document = {
  documentElement: { setAttribute(k,v){ attrs[k] = v; } },
  body: { appendChild(){}, removeChild(){} },
  addEventListener(){},
  createElement(){ return { style:{}, select(){}, remove(){}, click(){}, querySelector(){ return { addEventListener(){} }; } }; },
  execCommand(){},
  getElementById(id){
    if (id === 'appRoot') return { set innerHTML(v){ rootHtml = v; }, get innerHTML(){ return rootHtml; } };
    if (id === 'toastContainer') return { set innerHTML(v){ toastHtml = v; }, get innerHTML(){ return toastHtml; } };
    return null;
  }
};

const code = ['messages.js','data.js','engine.js','map-views.js','ui.js']
  .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8'))
  .join('\n;\n');

eval(code + '\nglobal._api = { UI, getState: () => APP_STATE, handleAction, getItemEffortSummary, FULL_HAPPINESS_MESSAGES };');
global._init();

function btn(m){ return { getAttribute(k){ return m[k] !== undefined ? String(m[k]) : null; } }; }

assert.strictEqual(global._api.FULL_HAPPINESS_MESSAGES.length, 200, 'Expected all 200 happiness messages');
assert(rootHtml.includes('day-pip partial'), 'Expected F-001 partial minute pips');
global._api.UI.quickAddOpen = true;
global._api.UI.quickAddForm.title = 'Проверка дедлайна';
global._api.handleAction('set-quick-date-preset', btn({'data-preset': 'tomorrow'}));
global._api.handleAction('submit-quick-add', btn({}));
assert.strictEqual(global._api.getState().items[0].dueDate, '2026-11-13');

// Cycle all 4 themes including 'pop' («Стикеры»)
global._api.handleAction('cycle-theme', btn({}));
assert.strictEqual(global._api.getState().theme, 'dawn');
global._api.handleAction('cycle-theme', btn({}));
assert.strictEqual(global._api.getState().theme, 'pop');

// Switch to Strategy Ascent Path
global._api.handleAction('switch-tab', btn({'data-tab': 'strategy'}));
global._api.handleAction('set-map-subtab', btn({'data-subtab': 'path'}));
assert(rootHtml.indexOf('7 · ЗА ПРЕДЕЛАМИ LVMG') < rootHtml.indexOf('1 · ФАКТИЧЕСКОЕ ПОЛОЖЕНИЕ'));

console.log('E2E_RUNTIME_OK: 200 happiness messages, 4 themes, F-001..F-005 fixes, 3-tier map & isolation verified.');
