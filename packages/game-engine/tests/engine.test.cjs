const test = require('node:test');
const assert = require('node:assert/strict');
const {
  localDayKey, isoWeekKey, periodKey, isCompleted, xpToReachLevel,
  levelFromXP, rankFromLevel, derivePlayer, awardForCompletion,
  completedGoalCount, dailyXP, cleanQuestInput,
} = require('../dist/index.js');

test('XP levels meet boundary conditions', () => {
  assert.equal(xpToReachLevel(1), 0);
  assert.equal(xpToReachLevel(2), 100);
  assert.equal(xpToReachLevel(3), 300);
  assert.equal(levelFromXP(0), 1);
  assert.equal(levelFromXP(99), 1);
  assert.equal(levelFromXP(100), 2);
  assert.equal(levelFromXP(299), 2);
  assert.equal(levelFromXP(300), 3);
  assert.equal(rankFromLevel(50), 'S');
});
test('daily and weekly period keys reset correctly', () => {
  assert.equal(localDayKey(new Date(2026, 10, 15)), '2026-11-15');
  assert.equal(isoWeekKey(new Date(2026, 11, 31)), '2026-W53');
  assert.equal(isoWeekKey(new Date(2027, 0, 1)), '2026-W53');
  assert.equal(periodKey('once', new Date()), 'once');
  assert.equal(periodKey('weekly', new Date(2026, 10, 15)), '2026-W46');
});
test('completions only apply to their configured recurrence period', () => {
  const q = {id:'a', repeatRule:'daily'};
  const c = [{id:'c',questId:'a',periodKey:'2026-11-15',completedAt:'2026-11-15T10:00:00Z'}];
  assert.equal(isCompleted(q,c,new Date(2026,10,15)),true);
  assert.equal(isCompleted(q,c,new Date(2026,10,16)),false);
});
test('daily XP cap clips oversized final reward', () => {
  assert.equal(awardForCompletion('hard', 240), 10);
  assert.equal(awardForCompletion('easy', 250), 0);
  assert.equal(awardForCompletion('easy', 0), 10);
});
test('player XP and attributes aggregate from immutable events', () => {
  const events = [
    {amount:25,attribute:'intelligence',dayKey:'2026-11-15'},
    {amount:50,attribute:'strength',dayKey:'2026-11-15'},
    {amount:25,attribute:'strength',dayKey:'2026-11-14'},
  ];
  assert.deepEqual([derivePlayer(events).level, derivePlayer(events).totalXP], [2,100]);
  assert.equal(derivePlayer(events).attributes.strength,75);
  assert.equal(dailyXP(events,new Date(2026,10,15)),75);
});
test('goal progress counts completed instances across associated quests', () => {
  const quests = [{id:'a',goalId:'g'},{id:'b',goalId:'other'}];
  const completed = [{questId:'a'}, {questId:'a'}, {questId:'b'}];
  assert.equal(completedGoalCount('g',quests,completed),2);
});
test('quest title is validated', () => {
  assert.throws(() => cleanQuestInput({title:'   ',attribute:'strength',difficulty:'easy',repeatRule:'once'}));
  assert.equal(cleanQuestInput({title:'  Run  ',attribute:'strength',difficulty:'easy',repeatRule:'daily'}).title,'Run');
});
