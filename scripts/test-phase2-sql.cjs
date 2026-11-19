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
const v4=code.match(/\/\/ v3 included synthetic baseline IDs[\s\S]*?await tx\.execAsync\(`([\s\S]*?)`\);/);
assert.ok(v4,'Cannot find v4 baseline repair/backup ownership migration');
const v5=code.match(/\/\/ Additive v4→v5:[\s\S]*?await tx\.execAsync\(`([\s\S]*?)`\);/);
assert.ok(v5,'Cannot find v5 adaptive and Lite migration');
const v6=code.match(/\/\/ Additive v5→v6:[\s\S]*?await tx\.execAsync\(`([\s\S]*?)`\);/);
assert.ok(v6,'Cannot find SQLite v6 private context migration');
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
db.prepare('INSERT INTO goal_measurements(id,goal_id,value,unit,recorded_at) VALUES(?,?,?,?,?)')
  .run('baseline:g1','g1',2,'sessions','2026-01-01T00:00:00Z');
db.exec('BEGIN EXCLUSIVE');db.exec(v4[1]);db.exec('COMMIT');
assert.equal(db.prepare('PRAGMA user_version').get().user_version,4);
const columns=db.prepare('PRAGMA table_info(backup_settings)').all().map(x=>x.name);
assert.ok(columns.includes('managed_files'),'Backup retention must track owned file URIs');
assert.equal(db.prepare('SELECT amount FROM xp_events WHERE id=?').get('e1').amount,10);
assert.equal(db.prepare("SELECT recorded_at FROM goal_measurements WHERE id='m1'").get().recorded_at,'2026-11-16T10:00:00Z');
assert.notEqual(db.prepare("SELECT recorded_at FROM goal_measurements WHERE id='baseline:g1'").get().recorded_at,'2026-01-01T00:00:00Z');
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM goal_measurements').get().n,2);
db.prepare('UPDATE backup_settings SET managed_files=? WHERE id=1')
  .run(JSON.stringify(['content://provider/document/ASCEND-AUTO-1.json']));
assert.equal(JSON.parse(db.prepare('SELECT managed_files FROM backup_settings WHERE id=1').get().managed_files).length,1);
db.exec('BEGIN EXCLUSIVE');db.exec(v5[1]);db.exec('COMMIT');
assert.equal(db.prepare('PRAGMA user_version').get().user_version,5);
for(const name of ['adaptive_settings','adaptive_decisions','completion_modes'])
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name),name);
db.prepare('INSERT INTO adaptive_settings(id,payload) VALUES(1,?)').run(JSON.stringify({enabled:true}));
db.prepare('INSERT INTO completion_modes(completion_id,mode) VALUES(?,?)').run('c1','lite');
assert.equal(db.prepare('SELECT amount FROM xp_events WHERE id=?').get('e1').amount,10);
assert.equal(db.prepare('SELECT mode FROM completion_modes WHERE completion_id=?').get('c1').mode,'lite');
assert.throws(()=>db.prepare('INSERT INTO completion_modes(completion_id,mode) VALUES(?,?)').run('bad','lite'));
assert.throws(()=>db.prepare('INSERT INTO completion_modes(completion_id,mode) VALUES(?,?)').run('c1','fraud'));
db.prepare('INSERT INTO adaptive_decisions(id,kind,source_id,decision,decided_at) VALUES(?,?,?,?,?)')
  .run('s1','ease','q1','accepted','2026-11-16T10:00:00Z');
assert.equal(db.prepare("SELECT decision FROM adaptive_decisions WHERE id='s1'").get().decision,'accepted');
db.exec('BEGIN EXCLUSIVE');db.exec(v6[1]);db.exec('COMMIT');
assert.equal(db.prepare('PRAGMA user_version').get().user_version,6);
for(const name of ['connected_sources','context_items','context_decisions','context_audit'])
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name),name);
db.prepare('INSERT INTO connected_sources(source,enabled,granted_at,retention_days) VALUES(?,?,?,?)')
  .run('chatgpt',1,'2026-11-18T00:00:00Z',90);
db.prepare(`INSERT INTO context_items
  (id,source,external_id,kind,title_cipher,excerpt_cipher,occurred_at,origin_cipher,sensitivity,imported_at)
  VALUES(?,?,?,?,?,?,?,?,?,?)`).run('ctx1','chatgpt','conversation123','conversation',
  'ascend-local-v1:test','ascend-local-v1:encrypted',null,null,'private','2026-11-18T00:00:00Z');
assert.throws(()=>db.prepare(`INSERT INTO context_items
  (id,source,external_id,kind,title_cipher,excerpt_cipher,sensitivity,imported_at)
  VALUES(?,?,?,?,?,?,?,?)`).run('ctx2','chatgpt','conversation123','conversation','cipher','cipher','private','2026-11-18T00:00:00Z'));
assert.throws(()=>db.prepare(`INSERT INTO context_items
  (id,source,external_id,kind,title_cipher,excerpt_cipher,sensitivity,imported_at)
  VALUES(?,?,?,?,?,?,?,?)`).run('bad','not-a-provider','missing','note','x','y','general','2026-11-18T00:00:00Z'));
assert.equal(db.prepare('SELECT amount FROM xp_events WHERE id=?').get('e1').amount,10);
db.prepare('DELETE FROM connected_sources WHERE source=?').run('chatgpt');
assert.equal(db.prepare('SELECT COUNT(*) n FROM context_items').get().n,0);
console.log('ASCEND v1→v6: XP preserved, encrypted context schema, FK/deletion and dedupe verified');


// Staged partial import SQL contract: same migrated SQLite schema as the app.
const partial=require('../packages/game-engine/dist/index.js');
function simulatePartialImport(source,selection={goals:true,quests:true,milestones:true}){
  const pack=partial.filterImportItems(partial.parseImportableQuestPack(source),selection);
  if(!pack.goals.length&&!pack.quests.length)throw Error('Empty selection');
  db.exec('BEGIN IMMEDIATE');
  let added=0;
  try{
    for(const g of pack.goals)
      added+=Number(db.prepare(
        'INSERT OR IGNORE INTO goals(id,title,attribute,target_count,created_at,archived) VALUES(?,?,?,?,?,0)')
        .run(partial.importGoalId(pack.packId,g.key),g.title,g.attribute,g.targetCount,'2026-11-19T00:00:00Z').changes);
    for(const q of pack.quests){
      let goalId=null;
      if(q.goalKey){
        goalId=partial.importGoalId(pack.packId,q.goalKey);
        const found=db.prepare('SELECT id,archived FROM goals WHERE id=?').get(goalId);
        if(!found||found.archived)throw Error('Missing goalKey');
      }else if(q.goalTitle){
        const found=db.prepare(
          'SELECT id FROM goals WHERE archived=0 AND lower(trim(title))=lower(trim(?)) LIMIT 2')
          .all(q.goalTitle);
        if(found.length!==1)throw Error('Missing or ambiguous goalTitle');
        goalId=found[0].id;
      }
      const id=partial.importQuestId(pack.packId,q.key);
      added+=Number(db.prepare(
        'INSERT OR IGNORE INTO quests(id,title,description,attribute,difficulty,repeat_rule,goal_id,created_at,archived) VALUES(?,?,?,?,?,?,?,?,0)')
        .run(id,partial.importedQuestTitle(q),partial.importedQuestDescription(q),
          q.attribute,q.difficulty,q.repeatRule,goalId,'2026-11-19T00:00:00Z').changes);
      db.prepare('INSERT OR IGNORE INTO quest_state(quest_id,status,due_on) VALUES(?,?,?)')
        .run(id,q.repeatRule==='once'?'backlog':'active',q.dueOn??null);
    }
    db.exec('COMMIT');return added;
  }catch(e){db.exec('ROLLBACK');throw e;}
}
const pid='staged-test';
const goalsOnly=JSON.stringify({packId:pid,goals:[{key:'career',title:'Architecture skills'}]});
const questsOnly=JSON.stringify({packId:pid,quests:[{key:'design',title:'Design system',goalKey:'career',repeatRule:'weekly'}]});
const milestonesOnly=JSON.stringify({packId:pid,milestones:[{key:'ship',title:'Ship a project',goalKey:'career',dueOn:'2026-12-31'}]});
assert.equal(simulatePartialImport(goalsOnly),1);
assert.equal(simulatePartialImport(goalsOnly),0);
assert.equal(simulatePartialImport(questsOnly),1);
assert.equal(simulatePartialImport(milestonesOnly),1);
assert.equal(db.prepare('SELECT goal_id FROM quests WHERE id=?').get(partial.importQuestId(pid,'design')).goal_id,partial.importGoalId(pid,'career'));
assert.equal(db.prepare('SELECT status FROM quest_state WHERE quest_id=?').get(partial.importQuestId(pid,'ship')).status,'backlog');
assert.equal(db.prepare('SELECT due_on FROM quest_state WHERE quest_id=?').get(partial.importQuestId(pid,'ship')).due_on,'2026-12-31');
assert.equal(simulatePartialImport(JSON.stringify({packId:'manual',milestones:[{key:'proof',title:'Manual checkpoint',goalTitle:'Existing goal'}]})),1);
assert.equal(db.prepare('SELECT goal_id FROM quests WHERE id=?').get(partial.importQuestId('manual','proof')).goal_id,'g1');
assert.throws(()=>simulatePartialImport(JSON.stringify({packId:'bad',goals:[{key:'new',title:'Rollback'}],
  quests:[{key:'orphan',title:'No matching goal',goalKey:'missing'}]})),/Missing goalKey/);
assert.equal(db.prepare('SELECT id FROM goals WHERE id=?').get(partial.importGoalId('bad','new')),undefined);
assert.equal(db.prepare('SELECT amount FROM xp_events WHERE id=?').get('e1').amount,10);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM completions').get().n,1);
console.log('ASCEND partial JSON: staged linking, idempotency, rollback and XP integrity verified');
