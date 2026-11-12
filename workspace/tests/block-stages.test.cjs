'use strict';
// Run with: node tests/block-stages.test.cjs (no dependencies).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
vm.runInThisContext(fs.readFileSync(path.join(__dirname, '../assets/block-stages.js'), 'utf8'));
const stages = globalThis.LifeGameStages;
const copy = value => JSON.parse(JSON.stringify(value));
const data = {
  blocks: [
    { id: 'health', name: 'Здоровье', meaning: 'Хочу чувствовать себя лучше', archivedAt: null },
    { id: 'money', name: 'Ресурсы', meaning: '', archivedAt: null }
  ],
  goals: [{ id: 'menu', name: 'Наладить меню', blockId: 'health' }],
  tasks: [
    { id: 'walk', block: 'health', goalId: 'menu' },
    { id: 'inbox', block: 'lifegame:inbox', goalId: null }
  ],
  completions: [{ id: 'old-coins', taskId: 'walk', reward: 15 }],
  diamondRecords: [], purchases: []
};
const originalReceipts = copy([data.completions, data.diamondRecords, data.purchases]);
stages.validate(data);
const migrated = copy(data);
assert.equal(stages.current(data, 'health').meaning, 'Хочу чувствовать себя лучше');
assert.equal(data.goals[0].stageId, data.tasks[0].stageId);
assert.equal(data.tasks[1].stageId, null);
stages.validate(data);
assert.deepEqual(data, migrated, 'Reload must not create another initial stage');

function add(id, blockId, required = null) {
  data.blockStages.items.push({
    id, blockId, name: id, meaning: '', reached: false,
    lock: { mode: required ? 'stage' : 'open', stageId: required }
  });
}
add('reserve', 'money');
add('checkups', 'health', 'reserve');
stages.validate(data);
assert.equal(stages.unlocked(data, stages.get(data, 'checkups')), false);
assert.throws(() => stages.switchTo(data, 'checkups'));
stages.switchTo(data, 'reserve');
assert.equal(stages.unlocked(data, stages.get(data, 'checkups')), true);
stages.switchTo(data, 'checkups');
stages.switchTo(data, migrated.blockStages.current.money);
assert.equal(stages.unlocked(data, stages.get(data, 'checkups')), true,
  'Returning to a previous stage must not erase the fact of reaching its successor');
assert.equal(stages.active(data, data.tasks[0]), false);
assert.equal(stages.active(data, data.tasks[1]), true);
assert.deepEqual([data.completions, data.diamondRecords, data.purchases], originalReceipts,
  'Stage transitions must not award, remove, or replace economic receipts');
stages.validate(data);

const corruptions = [
  d => { d.blockStages.current.health = 'missing'; },
  d => { d.tasks[0].stageId = 'reserve'; },
  d => { d.goals[0].stageId = 'reserve'; },
  d => { d.blockStages.items.push(copy(d.blockStages.items[0])); },
  d => { stages.get(d, 'checkups').lock = { mode: 'manual', stageId: null }; },
  d => { stages.get(d, 'reserve').lock = { mode: 'stage', stageId: 'checkups' }; },
  d => { d.blockStages.items[0].lock = { mode: 'stage', stageId: 'missing' }; },
  d => { d.blockStages.items[0].reached = 'yes'; },
  d => { d.blockStages.items[0].lock = { mode: 'open', stageId: 'reserve' }; }
];
for (const corrupt of corruptions) {
  const invalid = copy(data);
  corrupt(invalid);
  assert.throws(() => stages.validate(invalid));
}
const archived = copy(data);
archived.blocks.find(b => b.id === 'money').archivedAt = '2026-11-07T12:00:00.000Z';
assert.throws(() => stages.switchTo(archived, 'reserve'));
assert.equal(stages.unlocked(archived, stages.get(archived, 'checkups')), true,
  'Archiving a source block does not undo an already reached stage');

const many = copy(migrated);
for (let i = 0; i < 1200; i++) {
  many.blockStages.items.push({
    id: 'future-' + i, blockId: i % 2 ? 'health' : 'money', name: 'Будущий этап ' + i,
    meaning: '', reached: false,
    lock: { mode: i ? 'stage' : 'open', stageId: i ? 'future-' + (i - 1) : null }
  });
}
stages.validate(many);
assert.equal(many.blockStages.items.length, migrated.blockStages.items.length + 1200, 'There is no arbitrary stage-count limit');

const unusualIds = { blocks: [{ id: '__proto__', name: 'Блок', meaning: '' }], goals: [], tasks: [] };
stages.validate(unusualIds);
assert.equal(Object.hasOwn(unusualIds.blockStages.current, '__proto__'), true);
assert.equal(stages.current(unusualIds, '__proto__').blockId, '__proto__');
console.log('PASS block stages: migration, eligibility, conditions, history, receipts, validation, archive, 1200 stages, unusual IDs');

// Optional preparation flag survives validation without affecting progression or receipts.
const prepared = copy(migrated);
prepared.blockStages.items[0].prepared = true;
stages.validate(prepared);
assert.equal(prepared.blockStages.items[0].prepared, true);
assert.equal(stages.current(prepared, 'health').id, stages.current(migrated, 'health').id);
assert.deepEqual([prepared.completions, prepared.diamondRecords, prepared.purchases], originalReceipts);
prepared.blockStages.items[0].prepared = 'yes';
assert.throws(() => stages.validate(prepared), /подготовка/);
