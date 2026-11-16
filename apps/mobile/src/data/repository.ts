import * as SQLite from 'expo-sqlite';
import {
  type Attribute, type Quest, type Goal, type Completion, type XPEvent,
  type Difficulty, type RepeatRule, ATTRIBUTES, cleanQuestInput, periodKey,
  localDayKey, awardForCompletion, parseQuestPack, importGoalId, importQuestId,
   liteQuestIsAllowed,DEFAULT_ADAPTIVE_SETTINGS,
  importedQuestTitle, importedQuestDescription,
} from '@ascend/game-engine';

export interface Snapshot {
  quests: Quest[]; goals: Goal[]; completions: Completion[]; xpEvents: XPEvent[];
}

type QuestRow = {
  id: string; title: string; description: string; attribute: Attribute;
  difficulty: Difficulty; repeat_rule: RepeatRule; goal_id: string | null;
  created_at: string; archived: number;
};
type GoalRow = {
  id: string; title: string; attribute: Attribute; target_count: number;
  created_at: string; archived: number;
};
type CompletionRow = {
  id: string; quest_id: string; period_key: string; completed_at: string;
};
type XPRow = {
  id: string; completion_id: string; day_key: string; amount: number;
  attribute: Attribute; created_at: string;
};

let handle: SQLite.SQLiteDatabase | null = null;
const newId = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!handle) handle = await SQLite.openDatabaseAsync('ascend.db');
  return handle;
}

/** Schema version 1: append-only XP event accounting, recurring period uniqueness. */
export async function initialize(): Promise<void> {
  const db = await getDb();
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((version?.user_version ?? 0) > 5) throw new Error('Database created by a newer version of ASCEND');
  if ((version?.user_version ?? 0) < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, attribute TEXT NOT NULL,
        target_count INTEGER NOT NULL CHECK(target_count >= 1),
        created_at TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS quests (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
        attribute TEXT NOT NULL, difficulty TEXT NOT NULL, repeat_rule TEXT NOT NULL,
        goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS completions (
        id TEXT PRIMARY KEY, quest_id TEXT NOT NULL REFERENCES quests(id),
        period_key TEXT NOT NULL, completed_at TEXT NOT NULL,
        UNIQUE(quest_id, period_key)
      );
      CREATE TABLE IF NOT EXISTS xp_events (
        id TEXT PRIMARY KEY,
        completion_id TEXT NOT NULL UNIQUE REFERENCES completions(id),
        day_key TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount >= 0),
        attribute TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_xp_events_day ON xp_events(day_key);
      CREATE INDEX IF NOT EXISTS idx_completions_quest ON completions(quest_id);
      PRAGMA user_version = 1;
    `);
  }
  if ((version?.user_version ?? 0) < 2) {
    // Additive v1→v2 migration; never rewrite the original quests, XP or completions.
    await db.withExclusiveTransactionAsync(async tx=>{
      await tx.execAsync(`
        CREATE TABLE IF NOT EXISTS quest_state (
          quest_id TEXT PRIMARY KEY REFERENCES quests(id) ON DELETE CASCADE,
          status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','backlog','paused')),
          priority INTEGER NOT NULL DEFAULT 2 CHECK(priority BETWEEN 1 AND 3),
          weekdays TEXT NOT NULL DEFAULT '[]', due_on TEXT, time_of_day TEXT,
          snoozed_until TEXT, estimate_minutes INTEGER NOT NULL DEFAULT 25,
          reminder INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS quest_dependencies (
          quest_id TEXT NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
          requires_quest_id TEXT NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
          PRIMARY KEY(quest_id, requires_quest_id),
          CHECK(quest_id <> requires_quest_id)
        );
        CREATE TABLE IF NOT EXISTS goal_outcomes (
          goal_id TEXT PRIMARY KEY REFERENCES goals(id) ON DELETE CASCADE,
          target REAL NOT NULL CHECK(target>0), value REAL NOT NULL DEFAULT 0 CHECK(value>=0),
          unit TEXT NOT NULL DEFAULT 'units', deadline TEXT
        );
        CREATE TABLE IF NOT EXISTS boss_battles (
          id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
          goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
          quest_id TEXT REFERENCES quests(id) ON DELETE SET NULL,
          won_at TEXT, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS focus_sessions (
          id TEXT PRIMARY KEY,
          quest_id TEXT REFERENCES quests(id) ON DELETE SET NULL,
          minutes INTEGER NOT NULL CHECK(minutes BETWEEN 1 AND 480),
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS weekly_reviews (
          week_key TEXT PRIMARY KEY, wins TEXT NOT NULL DEFAULT '',
          blockers TEXT NOT NULL DEFAULT '', next_focus TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS preferences (
          key TEXT PRIMARY KEY, value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS skill_unlocks (
          node_id TEXT PRIMARY KEY, unlocked_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_quest_state_status ON quest_state(status);
        CREATE INDEX IF NOT EXISTS idx_focus_sessions_created ON focus_sessions(created_at);
      `);
      await tx.execAsync(`INSERT OR IGNORE INTO quest_state(quest_id,status)
          SELECT id, CASE WHEN repeat_rule='once' THEN 'backlog' ELSE 'active' END FROM quests;
        UPDATE quest_state SET due_on = (
          SELECT substr(description,14,10) FROM quests
          WHERE id=quest_state.quest_id)
        WHERE due_on IS NULL AND EXISTS (
          SELECT 1 FROM quests
          WHERE id=quest_state.quest_id
            AND description LIKE 'Target date: ____-__-__.%');
        PRAGMA user_version = 2;`);
    });
  }
  if ((version?.user_version ?? 0) < 3) {
    // Additive v2→v3 migration: preserve all existing quest and XP records.
    await db.withExclusiveTransactionAsync(async tx=>{
      await tx.execAsync(`
        CREATE TABLE IF NOT EXISTS goal_measurements (
          id TEXT PRIMARY KEY, goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
          value REAL NOT NULL CHECK(value >= 0), unit TEXT NOT NULL,
          recorded_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_goal_measurements_goal_date
          ON goal_measurements(goal_id,recorded_at);
        CREATE TABLE IF NOT EXISTS backup_settings (
          id INTEGER PRIMARY KEY CHECK(id=1),
          directory_uri TEXT NOT NULL DEFAULT '', enabled INTEGER NOT NULL DEFAULT 0,
          interval_hours INTEGER NOT NULL DEFAULT 24,
          retention INTEGER NOT NULL DEFAULT 7,
          last_backup_at TEXT, last_verified_at TEXT, last_error TEXT
        );
        INSERT OR IGNORE INTO backup_settings(id) VALUES(1);
        INSERT OR IGNORE INTO goal_measurements(id,goal_id,value,unit,recorded_at)
          SELECT 'baseline:'||outcome.goal_id,outcome.goal_id,outcome.value,outcome.unit,
            strftime('%Y-%m-%dT%H:%M:%fZ','now')
          FROM goal_outcomes AS outcome
          WHERE NOT EXISTS (SELECT 1 FROM goal_measurements m
            WHERE m.goal_id=outcome.goal_id);
        PRAGMA user_version = 3;
      `);
    });
  }
  if ((version?.user_version ?? 0) < 4) {
    // v3 included synthetic baseline IDs with a goal-creation timestamp.
    // That timestamp was NOT an actual measurement. Repair affected rows
    // without erasing the recorded value or any legitimate observations.
    await db.withExclusiveTransactionAsync(async tx=>{
      await tx.execAsync(`
        ALTER TABLE backup_settings
        ADD COLUMN managed_files TEXT NOT NULL DEFAULT '[]';
        UPDATE goal_measurements
        SET recorded_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
        WHERE substr(id,1,9)='baseline:';
        PRAGMA user_version = 4;
      `);
    });
  }
  if ((version?.user_version ?? 0) < 5) {
    // Additive v4→v5: private adaptive feedback and completion variants.
    await db.withExclusiveTransactionAsync(async tx=>{
      await tx.execAsync(`
        CREATE TABLE IF NOT EXISTS adaptive_settings (
          id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS adaptive_decisions (
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL CHECK(kind IN ('ease','stretch','quest','milestone','goal')),
          source_id TEXT NOT NULL,
          decision TEXT NOT NULL CHECK(decision IN ('accepted','dismissed')),
          decided_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_adaptive_decisions_date ON adaptive_decisions(decided_at);
        CREATE TABLE IF NOT EXISTS completion_modes (
          completion_id TEXT PRIMARY KEY REFERENCES completions(id) ON DELETE CASCADE,
          mode TEXT NOT NULL CHECK(mode IN ('standard','lite'))
        );
        PRAGMA user_version = 5;
      `);
      await tx.runAsync('INSERT OR IGNORE INTO adaptive_settings(id,payload) VALUES(1,?)',
        JSON.stringify(DEFAULT_ADAPTIVE_SETTINGS));
    });
  }
  const seedFlag = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_state WHERE key = 'starter_seeded'"
  );
  if (!seedFlag) {
    const now = new Date().toISOString();
    const starters: Array<[string, string, Attribute, Difficulty, RepeatRule]> = [
      ['Move for 20 minutes', 'Walk, stretch or exercise at a comfortable intensity.', 'strength', 'medium', 'daily'],
      ['Practice a skill for 30 minutes', 'Focused learning or hands-on practice.', 'intelligence', 'medium', 'daily'],
      ['Review tomorrow’s priorities', 'Pick up to three practical priorities.', 'discipline', 'easy', 'daily'],
      ['Take a planned recovery break', 'Make space for rest without distractions.', 'recovery', 'easy', 'daily'],
    ];
    await db.withExclusiveTransactionAsync(async tx => {
      for (const [title, description, attribute, difficulty, rule] of starters) {
        await tx.runAsync(
          `INSERT OR IGNORE INTO quests
           (id,title,description,attribute,difficulty,repeat_rule,goal_id,created_at,archived)
           VALUES(?,?,?,?,?,?,NULL,?,0)`,
          newId(), title, description, attribute, difficulty, rule, now
        );
      }
      await tx.runAsync("INSERT OR IGNORE INTO app_state (key,value) VALUES ('starter_seeded','1')");
    });
  }
}

export async function loadSnapshot(): Promise<Snapshot> {
  const db = await getDb();
  const [quests, goals, completions, xpEvents] = await Promise.all([
    db.getAllAsync<QuestRow>('SELECT * FROM quests ORDER BY created_at DESC'),
    db.getAllAsync<GoalRow>('SELECT * FROM goals ORDER BY created_at DESC'),
    db.getAllAsync<CompletionRow>('SELECT * FROM completions ORDER BY completed_at DESC'),
    db.getAllAsync<XPRow>('SELECT * FROM xp_events ORDER BY created_at DESC'),
  ]);
  return {
    quests: quests.map(q => ({
      id: q.id, title: q.title, description: q.description,
      attribute: q.attribute, difficulty: q.difficulty, repeatRule: q.repeat_rule,
      goalId: q.goal_id, createdAt: q.created_at, archived: q.archived !== 0,
    })),
    goals: goals.map(g => ({
      id: g.id, title: g.title, attribute: g.attribute,
      targetCount: g.target_count, createdAt: g.created_at, archived: g.archived !== 0,
    })),
    completions: completions.map(c => ({
      id: c.id, questId: c.quest_id, periodKey: c.period_key, completedAt: c.completed_at,
    })),
    xpEvents: xpEvents.map(e => ({
      id: e.id, completionId: e.completion_id, dayKey: e.day_key,
      amount: e.amount, attribute: e.attribute, createdAt: e.created_at,
    })),
  };
}

export type QuestInput = ReturnType<typeof cleanQuestInput>;
export async function saveQuest(input: QuestInput, id?: string): Promise<void> {
  const db = await getDb();
  const valid = cleanQuestInput(input);
  if (id) {
    await db.runAsync(
      `UPDATE quests SET title=?,description=?,attribute=?,difficulty=?,repeat_rule=?,goal_id=?
       WHERE id=? AND archived=0`,
      valid.title, valid.description, valid.attribute, valid.difficulty,
      valid.repeatRule, valid.goalId, id
    );
  } else {
    await db.runAsync(
      `INSERT INTO quests (id,title,description,attribute,difficulty,repeat_rule,goal_id,created_at,archived)
       VALUES (?,?,?,?,?,?,?,?,0)`,
      newId(), valid.title, valid.description, valid.attribute, valid.difficulty,
      valid.repeatRule, valid.goalId, new Date().toISOString()
    );
  }
}

/** Import a private goal/quest/milestone pack without replacing or duplicating progress. */
export async function importQuestPack(source: string): Promise<{goalsAdded:number;questsAdded:number;milestonesAdded:number}> {
  const pack=parseQuestPack(source);
  const db=await getDb();
  const now=new Date().toISOString();
  let goalsAdded=0,questsAdded=0,milestonesAdded=0;
  await db.withExclusiveTransactionAsync(async tx=>{
    for(const goal of pack.goals){
      const r=await tx.runAsync(
        'INSERT OR IGNORE INTO goals (id,title,attribute,target_count,created_at,archived) VALUES (?,?,?,?,?,0)',
        importGoalId(pack.packId,goal.key),goal.title,goal.attribute,goal.targetCount,now);
      goalsAdded+=r.changes;
    }
    for(const quest of pack.quests){
      const r=await tx.runAsync(
        'INSERT OR IGNORE INTO quests (id,title,description,attribute,difficulty,repeat_rule,goal_id,created_at,archived) VALUES (?,?,?,?,?,?,?,?,0)',
        importQuestId(pack.packId,quest.key),importedQuestTitle(quest),importedQuestDescription(quest),
        quest.attribute,quest.difficulty,quest.repeatRule,importGoalId(pack.packId,quest.goalKey),now);
      if(quest.kind==='milestone')milestonesAdded+=r.changes;
      else questsAdded+=r.changes;
      // Preserve imported target dates without activating the entire backlog.
      // Existing user edits/state always win on repeat import.
      await tx.runAsync(
        'INSERT OR IGNORE INTO quest_state(quest_id,status,due_on) VALUES(?,?,?)',
        importQuestId(pack.packId,quest.key),
        quest.repeatRule==='once'?'backlog':'active',quest.dueOn??null);
    }
  });
  return {goalsAdded,questsAdded,milestonesAdded};
}

export async function archiveQuest(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE quests SET archived=1 WHERE id=?', id);
}

export async function saveGoal(
  input: { title: string; attribute: Attribute; targetCount: number }, id?: string,
): Promise<void> {
  const title = input.title.trim();
  if (!title || title.length > 100) throw new Error('Goal title must have 1–100 characters');
  if (!Number.isInteger(input.targetCount) || input.targetCount < 1 || input.targetCount > 10000)
    throw new Error('Target must be between 1 and 10,000 quest completions');
  const db = await getDb();
  if (id) {
    await db.runAsync('UPDATE goals SET title=?,attribute=?,target_count=? WHERE id=? AND archived=0',
      title, input.attribute, input.targetCount, id);
  } else {
    await db.runAsync(
      'INSERT INTO goals (id,title,attribute,target_count,created_at,archived) VALUES (?,?,?,?,?,0)',
      newId(), title, input.attribute, input.targetCount, new Date().toISOString()
    );
  }
}
export async function archiveGoal(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE goals SET archived=1 WHERE id=?', id);
}

export async function completeQuest(quest: Quest, now = new Date(),
  mode:'standard'|'lite'='standard'): Promise<{ applied: boolean; xp: number }> {
  if(!['standard','lite'].includes(mode))throw Error('Unknown completion mode');
  if(mode==='lite'&&!liteQuestIsAllowed(quest))
    throw Error('Lite completion is only available for recurring quests');
  if (quest.archived) throw new Error('Cannot complete an archived quest');
  const db = await getDb();
  const today = localDayKey(now);
  const timestamp = now.toISOString();
  let resultForCaller: { applied: boolean; xp: number } = { applied: false, xp: 0 };
  await db.withExclusiveTransactionAsync(async tx => {
    // Check the persisted quest, not only a potentially stale UI object.
    const current = await tx.getFirstAsync<{ archived: number; repeat_rule: RepeatRule; difficulty: Difficulty; attribute: Attribute }>(
      'SELECT archived,repeat_rule,difficulty,attribute FROM quests WHERE id=?', quest.id
    );
    if (!current || current.archived) throw new Error('Quest no longer exists');
    if(mode==='lite'&&current.repeat_rule==='once')
      throw Error('One-time milestones require their normal evidence');
    if(mode==='lite'){
      const proof=await tx.getFirstAsync<{id:string}>(
        'SELECT id FROM boss_battles WHERE quest_id=? AND won_at IS NULL LIMIT 1',quest.id);
      if(proof)throw Error('This quest is an active boss proof and cannot use Lite mode');
    }
    const control=await tx.getFirstAsync<{
      status:string;weekdays:string;due_on:string|null;snoozed_until:string|null
    }>('SELECT status,weekdays,due_on,snoozed_until FROM quest_state WHERE quest_id=?',quest.id);
    if(control?.status==='paused'||control?.status==='backlog'||
       (!control&&current.repeat_rule==='once'))
      throw Error('Activate this quest from the Planner before completing it');
    // Enforce scheduling in the same transaction as XP to prevent stale UI
    // or a background refresh from completing an off-schedule quest.
    if(control?.snoozed_until&&today<control.snoozed_until)
      throw Error('This quest is snoozed. Change its plan before completing it');
    if(control?.due_on&&today<control.due_on)
      throw Error('This quest is scheduled for a future date');
    if(current.repeat_rule!=='once'&&control?.weekdays){
      let scheduled:unknown;
      try{scheduled=JSON.parse(control.weekdays);}catch{throw Error('Invalid saved quest weekdays');}
      if(!Array.isArray(scheduled)||!scheduled.every(d=>Number.isInteger(d)&&d>=0&&d<=6))
        throw Error('Invalid saved quest weekdays');
      if(scheduled.length>0&&!scheduled.includes(now.getDay()))
        throw Error('This quest is not scheduled for today');
    }
    const dependency=await tx.getFirstAsync<{requires_quest_id:string}>(`
      SELECT d.requires_quest_id FROM quest_dependencies d
      WHERE d.quest_id=? AND NOT EXISTS (
        SELECT 1 FROM completions c WHERE c.quest_id=d.requires_quest_id)
      LIMIT 1`,quest.id);
    if(dependency)throw Error('Complete prerequisite milestone before this quest');
    const actualKey = periodKey(current.repeat_rule, now);
    const existing = await tx.getFirstAsync<{ id: string }>(
      'SELECT id FROM completions WHERE quest_id=? AND period_key=?', quest.id, actualKey
    );
    if (existing) return;
    const result = await tx.getFirstAsync<{ xp: number }>(
      'SELECT COALESCE(SUM(amount),0) AS xp FROM xp_events WHERE day_key=?', today
    );
    const xp = awardForCompletion(mode==='lite'?'easy':current.difficulty, result?.xp ?? 0);
    const completionId = newId();
    await tx.runAsync(
      'INSERT INTO completions (id,quest_id,period_key,completed_at) VALUES (?,?,?,?)',
      completionId, quest.id, actualKey, timestamp
    );
    await tx.runAsync(
      'INSERT INTO xp_events (id,completion_id,day_key,amount,attribute,created_at) VALUES (?,?,?,?,?,?)',
      newId(), completionId, today, xp, current.attribute, timestamp
    );
    await tx.runAsync('INSERT INTO completion_modes(completion_id,mode) VALUES(?,?)',completionId,mode);
    resultForCaller = { applied: true, xp };
  });
  return resultForCaller;
}

/**
 * Undo only a recent completion, in the same SQLite transaction as its XP.
 * The undo is rejected when a dependent quest has already been completed;
 * undoing evidence otherwise creates inconsistent milestone states.
 */
export async function undoRecentCompletion(
  questId:string,now=new Date(),windowMinutes=10
):Promise<{xpRemoved:number;completionId:string}>{
  if(!questId||!Number.isFinite(now.getTime())||windowMinutes<1||windowMinutes>60)
    throw Error('Invalid undo request');
  const db=await getDb();
  let removed:{xpRemoved:number;completionId:string}|null=null;
  await db.withExclusiveTransactionAsync(async tx=>{
    const c=await tx.getFirstAsync<{id:string;completed_at:string}>(
      'SELECT id,completed_at FROM completions WHERE quest_id=? ORDER BY completed_at DESC LIMIT 1',
      questId);
    if(!c)throw Error('There is no completion to undo');
    const elapsed=now.getTime()-Date.parse(c.completed_at);
    if(!Number.isFinite(elapsed)||elapsed<0||elapsed>windowMinutes*60_000)
      throw Error('Undo is available for 10 minutes after completion');
    const dependent=await tx.getFirstAsync<{quest_id:string}>(`
      SELECT d.quest_id FROM quest_dependencies d
      WHERE d.requires_quest_id=? AND EXISTS
      (SELECT 1 FROM completions completed WHERE completed.quest_id=d.quest_id)
      LIMIT 1`,questId);
    if(dependent)throw Error('Cannot undo: a dependent milestone has already been completed');
    const xp=await tx.getFirstAsync<{amount:number}>(
      'SELECT amount FROM xp_events WHERE completion_id=?',c.id);
    await tx.runAsync('DELETE FROM xp_events WHERE completion_id=?',c.id);
    await tx.runAsync('DELETE FROM completions WHERE id=?',c.id);
    // A claimed boss victory based solely on this quest is no longer valid.
    await tx.runAsync(`UPDATE boss_battles SET won_at=NULL WHERE quest_id=?
      AND NOT EXISTS (SELECT 1 FROM completions WHERE quest_id=?)`,questId,questId);
    removed={xpRemoved:xp?.amount??0,completionId:c.id};
  });
  if(!removed)throw Error('Unable to undo completion');
  return removed;
}

/** Human-controlled, copyable data snapshot. Not a cloud backup. */
export async function exportJSON(): Promise<string> {
  const snapshot = await loadSnapshot();
  return JSON.stringify({ format: 'ascend-backup', schemaVersion: 1,
    exportedAt: new Date().toISOString(), ...snapshot }, null, 2);
}

export async function wipeAllData(): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async tx => {
    await tx.runAsync('DELETE FROM adaptive_decisions');
    await tx.runAsync('DELETE FROM completion_modes');
    await tx.runAsync('UPDATE adaptive_settings SET payload=? WHERE id=1',JSON.stringify(DEFAULT_ADAPTIVE_SETTINGS));
    await tx.runAsync('DELETE FROM xp_events');
    await tx.runAsync('DELETE FROM completions');
    await tx.runAsync('DELETE FROM quest_dependencies');
    await tx.runAsync('DELETE FROM quest_state');
    await tx.runAsync('DELETE FROM focus_sessions');
    await tx.runAsync('DELETE FROM boss_battles');
    await tx.runAsync('DELETE FROM goal_outcomes');
    await tx.runAsync('DELETE FROM weekly_reviews');
    await tx.runAsync('DELETE FROM skill_unlocks');
    await tx.runAsync('DELETE FROM goal_measurements');
    await tx.runAsync('DELETE FROM preferences');
    await tx.runAsync('DELETE FROM quests');
    await tx.runAsync('DELETE FROM goals');
    await tx.runAsync("INSERT OR REPLACE INTO app_state (key,value) VALUES ('starter_seeded','1')");
  });
}

/**
 * Import a user-controlled V0.1 backup after a one-time signing-key migration.
 * Validate completely before deleting anything; replacement is atomic.
 */
export async function restoreJSON(source: string): Promise<void> {
  if (source.length > 8_000_000) throw new Error('Backup exceeds 8 MB');
  const value: unknown = JSON.parse(source);
  const obj = value as Record<string, unknown>;
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) ||
      obj.format !== 'ascend-backup' || obj.schemaVersion !== 1) {
    throw new Error('Not an ASCEND schema v1 backup');
  }
  const names: (keyof Snapshot)[] = ['goals','quests','completions','xpEvents'];
  for (const name of names) {
    if (!Array.isArray(obj[name]) || (obj[name] as unknown[]).length > 50000) {
      throw new Error('Invalid ' + name + ' in backup');
    }
  }
  const goals=obj.goals as Goal[], quests=obj.quests as Quest[];
  const completions=obj.completions as Completion[], xpEvents=obj.xpEvents as XPEvent[];
  const isObject=(x: unknown): x is Record<string,unknown> =>
    !!x && typeof x === 'object' && !Array.isArray(x);
  const isId=(x:unknown): x is string => typeof x === 'string' && x.length > 0 && x.length <= 128;
  const isDate=(x:unknown): x is string => typeof x === 'string' && x.length <= 40 && Number.isFinite(Date.parse(x));
  const isAttr=(x:unknown)=>ATTRIBUTES.includes(x as Attribute);
  const unique=(rows:{id:string}[])=>new Set(rows.map(x=>x.id)).size === rows.length;
  if (!goals.every(g=>isObject(g) && isId(g.id) && typeof g.title==='string' &&
    g.title.length>0 && g.title.length<=100 && isAttr(g.attribute) &&
    Number.isInteger(g.targetCount) && g.targetCount>=1 && g.targetCount<=10000 &&
    isDate(g.createdAt) && typeof g.archived==='boolean')) throw new Error('Invalid goal records');
  const goalIds=new Set(goals.map(g=>g.id));
  if (!quests.every(q=>isObject(q) && isId(q.id) && typeof q.title==='string' &&
    q.title.length>0 && q.title.length<=100 && typeof q.description==='string' &&
    q.description.length<=500 && isAttr(q.attribute) &&
    ['easy','medium','hard'].includes(q.difficulty) &&
    ['daily','weekly','once'].includes(q.repeatRule) &&
    (q.goalId===null || goalIds.has(q.goalId)) && isDate(q.createdAt) &&
    typeof q.archived==='boolean')) throw new Error('Invalid quest records');
  const questIds=new Set(quests.map(q=>q.id));
  if (!completions.every(c=>isObject(c) && isId(c.id) && questIds.has(c.questId) &&
    typeof c.periodKey==='string' && c.periodKey.length>0 && c.periodKey.length<=40 &&
    isDate(c.completedAt))) throw new Error('Invalid completion records');
  const completionIds=new Set(completions.map(c=>c.id));
  if (!xpEvents.every(e=>isObject(e) && isId(e.id) && completionIds.has(e.completionId) &&
    typeof e.dayKey==='string' && /^\d{4}-\d{2}-\d{2}$/.test(e.dayKey) &&
    Number.isInteger(e.amount) && e.amount>=0 && e.amount<=50 &&
    isAttr(e.attribute) && isDate(e.createdAt))) throw new Error('Invalid XP records');
  if (!unique(goals)||!unique(quests)||!unique(completions)||!unique(xpEvents)||
    new Set(completions.map(c=>c.questId+'|'+c.periodKey)).size!==completions.length ||
    new Set(xpEvents.map(e=>e.completionId)).size!==xpEvents.length) {
    throw new Error('Backup contains duplicate records');
  }
  const db=await getDb();
  await db.withExclusiveTransactionAsync(async tx=>{
    await tx.runAsync('DELETE FROM adaptive_decisions');
    await tx.runAsync('DELETE FROM completion_modes');
    await tx.runAsync('UPDATE adaptive_settings SET payload=? WHERE id=1',JSON.stringify(DEFAULT_ADAPTIVE_SETTINGS));
    await tx.runAsync('DELETE FROM xp_events');
    await tx.runAsync('DELETE FROM completions');
    await tx.runAsync('DELETE FROM quest_dependencies');
    await tx.runAsync('DELETE FROM quest_state');
    await tx.runAsync('DELETE FROM focus_sessions');
    await tx.runAsync('DELETE FROM boss_battles');
    await tx.runAsync('DELETE FROM goal_outcomes');
    await tx.runAsync('DELETE FROM weekly_reviews');
    await tx.runAsync('DELETE FROM skill_unlocks');
    await tx.runAsync('DELETE FROM goal_measurements');
    await tx.runAsync('DELETE FROM quests');
    await tx.runAsync('DELETE FROM goals');
    for(const g of goals) await tx.runAsync(
      'INSERT INTO goals (id,title,attribute,target_count,created_at,archived) VALUES (?,?,?,?,?,?)',
      g.id,g.title,g.attribute,g.targetCount,g.createdAt,g.archived?1:0);
    for(const q of quests) await tx.runAsync(
      'INSERT INTO quests (id,title,description,attribute,difficulty,repeat_rule,goal_id,created_at,archived) VALUES (?,?,?,?,?,?,?,?,?)',
      q.id,q.title,q.description,q.attribute,q.difficulty,q.repeatRule,q.goalId,q.createdAt,q.archived?1:0);
    for(const c of completions) await tx.runAsync(
      'INSERT INTO completions (id,quest_id,period_key,completed_at) VALUES (?,?,?,?)',
      c.id,c.questId,c.periodKey,c.completedAt);
    for(const e of xpEvents) await tx.runAsync(
      'INSERT INTO xp_events (id,completion_id,day_key,amount,attribute,created_at) VALUES (?,?,?,?,?,?)',
      e.id,e.completionId,e.dayKey,e.amount,e.attribute,e.createdAt);
    await tx.runAsync("INSERT OR REPLACE INTO app_state (key,value) VALUES ('starter_seeded','1')");
  });
}
