// Exercises the exact v1 and v2 DDL extracted from the app source using Node's SQLite.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const code=fs.readFileSync('apps/mobile/src/data/repository.ts','utf8');
const v1=code.match(/await db\.execAsync\(`([\s\S]*?PRAGMA user_version = 1;[\s\S]*?)`\);/);
const v2=code.match(/\/\/ Additive v1→v2 migration;[\s\S]*?await tx\.execAsync\(`([\s\S]*?)`\);[\s\S]*?await tx\.execAsync\(`([\s\S]*?)`\);/);
assert.ok(v1,'Cannot find v1 database schema');
assert.ok(v2,'Cannot find v2 migration scripts');
const v3=code.match(/\/\/ Additive v2→v3 migration:[\s\S]*?await tx\.execAsync\(`([\s\S]*?)`\);/);
assert.ok(v3,'Cannot find v3 goal/backup migration');
const v4=code.match(/\/\/ Additive v3→v4:[\s\S]*?await tx\.execAsync\(`([\s\S]*?)`\);/);
assert.ok(v4,'Cannot find v4 direction and history migration');
const db=new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON;');
db.exec(v1[1]);
db.prepare('INSERT INTO goals(id,title,attribute,target_count,created_at,archived) VALUES(?,?,?,?,?,0)')
  .run('g1','Existing goal','discipline',10,'2026-01-01T00:00:00Z');
db.prepare(`INSERT INTO quests(id,title,description,attribute,difficulty,repeat_rule,goal_id,created_at,archived)
  VALUES(?,?,?,?,?,?,?,?,0)`).run('q1','Existing quest','','discipline','easy','daily','g1','2026-01-01T00:00:00Z');
db.prepare(`INSERT INTO quests(id,title,description,attribute,difficulty,repeat_rule,goal_id,created_at,archived)
  VALUES(?,?,?,?,?,?,?,?,0)`).run('q2','Imported milestone',
    'Target date: 2026-12-05. Review before completion.','discipline','hard','once','g1','2026-01-01T00:00:00Z');
db.prepare('INSERT INTO completions(id,quest_id,period_key,completed_at) VALUES(?,?,?,?)')
  .run('c1','q1','2026-11-16','2026-11-16T12:00:00Z');
db.prepare('INSERT INTO xp_events(id,completion_id,day_key,amount,attribute,created_at) VALUES(?,?,?,?,?,?)')
  .run('e1','c1','2026-11-16',10,'discipline','2026-11-16T12:00:00Z');
db.exec('BEGIN EXCLUSIVE');
db.exec(v2[1]);db.exec(v2[2]);db.exec('COMMIT');
assert.equal(db.prepare('PRAGMA user_version').get().user_version,2);
assert.equal(db.prepare('SELECT amount FROM xp_events WHERE id=?').get('e1').amount,10);
assert.equal(db.prepare('SELECT status FROM quest_state WHERE quest_id=?').get('q1').status,'active');
assert.equal(db.prepare('SELECT status FROM quest_state WHERE quest_id=?').get('q2').status,'backlog');
assert.equal(db.prepare('SELECT due_on FROM quest_state WHERE quest_id=?').get('q2').due_on,'2026-12-05');
for(const name of ['quest_state','quest_dependencies','goal_outcomes','boss_battles',
  'focus_sessions','weekly_reviews','preferences','skill_unlocks']){
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name),name);
}
assert.throws(()=>db.prepare('INSERT INTO quest_state(quest_id,status,due_on) VALUES(?,?,?)')
  .run('q-missing','backlog',null)); // invalid FK must fail

db.exec('BEGIN EXCLUSIVE');
db.exec(v2[1]);db.exec(v2[2]);db.exec('COMMIT');
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM xp_events').get().n,1);
db.exec('BEGIN EXCLUSIVE');db.exec(v3[1]);db.exec('COMMIT');
assert.equal(db.prepare('PRAGMA user_version').get().user_version,3);
assert.equal(db.prepare('SELECT amount FROM xp_events WHERE id=?').get('e1').amount,10);
for(const name of ['goal_measurements','backup_settings'])
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name),name);
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM goal_measurements").get().n,0);
db.prepare('INSERT INTO goal_outcomes(goal_id,target,value,unit,deadline) VALUES(?,?,?,?,?)')
  .run('g1',10,3,'sessions',null);
db.prepare('INSERT INTO goal_measurements(id,goal_id,value,unit,recorded_at) VALUES(?,?,?,?,?)')
  .run('m1','g1',3,'sessions','2026-11-16T10:00:00Z');
assert.equal(db.prepare("SELECT value FROM goal_measurements WHERE id='m1'").get().value,3);
assert.throws(()=>db.prepare('INSERT INTO goal_measurements(id,goal_id,value,unit,recorded_at) VALUES(?,?,?,?,?)')
  .run('bad','missing',2,'sessions','2026-11-16T10:00:00Z'));
db.exec('BEGIN EXCLUSIVE');db.exec(v3[1]);db.exec('COMMIT');
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM goal_measurements").get().n,1);
db.prepare("UPDATE goal_outcomes SET target=2,value=3 WHERE goal_id='g1'").run();
// Mimic the generated placeholder recorded by old v0.9.1; it is not a real observation.
db.prepare('INSERT INTO goal_measurements(id,goal_id,value,unit,recorded_at) VALUES(?,?,?,?,?)')
  .run('baseline:g1','g1',3,'sessions','2026-01-01T00:00:00Z');
db.exec('BEGIN EXCLUSIVE');db.exec(v4[1]);db.exec('COMMIT');
assert.equal(db.prepare('PRAGMA user_version').get().user_version,4);
assert.equal(db.prepare("SELECT direction FROM goal_outcomes WHERE goal_id='g1'").get().direction,'increase');
assert.equal(db.prepare("SELECT direction_reviewed FROM goal_outcomes WHERE goal_id='g1'").get().direction_reviewed,0);
db.prepare("UPDATE goal_outcomes SET direction='decrease',direction_reviewed=1 WHERE goal_id='g1'").run();
assert.equal(db.prepare("SELECT direction_reviewed FROM goal_outcomes WHERE goal_id='g1'").get().direction_reviewed,1);
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM goal_measurements WHERE id='baseline:g1'").get().n,0);
assert.equal(db.prepare("SELECT value FROM goal_measurements WHERE id='m1'").get().value,3);
assert.equal(db.prepare("SELECT amount FROM xp_events WHERE id='e1'").get().amount,10);
assert.throws(()=>db.prepare("UPDATE goal_outcomes SET direction='sideways' WHERE goal_id='g1'").run());
assert.throws(()=>db.prepare("UPDATE goal_outcomes SET direction_reviewed=2 WHERE goal_id='g1'").run());
console.log('Phase 2 migrations v1→v2→v3→v4: XP preserved, fake history removed, direction constrained');
