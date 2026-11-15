import * as SQLite from 'expo-sqlite';
import {
  type Attribute, type Quest, type Goal, type Completion, type XPEvent,
  type Difficulty, type RepeatRule, cleanQuestInput, periodKey,
  localDayKey, awardForCompletion,
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

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!handle) handle = await SQLite.openDatabaseAsync('ascend.db');
  return handle;
}

/** Schema version 1: append-only XP event accounting, recurring period uniqueness. */
export async function initialize(): Promise<void> {
  const db = await getDb();
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((version?.user_version ?? 0) > 1) throw new Error('Database created by a newer version of ASCEND');
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

export async function completeQuest(quest: Quest, now = new Date()): Promise<{ applied: boolean; xp: number }> {
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
    const actualKey = periodKey(current.repeat_rule, now);
    const existing = await tx.getFirstAsync<{ id: string }>(
      'SELECT id FROM completions WHERE quest_id=? AND period_key=?', quest.id, actualKey
    );
    if (existing) return;
    const result = await tx.getFirstAsync<{ xp: number }>(
      'SELECT COALESCE(SUM(amount),0) AS xp FROM xp_events WHERE day_key=?', today
    );
    const xp = awardForCompletion(current.difficulty, result?.xp ?? 0);
    const completionId = newId();
    await tx.runAsync(
      'INSERT INTO completions (id,quest_id,period_key,completed_at) VALUES (?,?,?,?)',
      completionId, quest.id, actualKey, timestamp
    );
    await tx.runAsync(
      'INSERT INTO xp_events (id,completion_id,day_key,amount,attribute,created_at) VALUES (?,?,?,?,?,?)',
      newId(), completionId, today, xp, current.attribute, timestamp
    );
    resultForCaller = { applied: true, xp };
  });
  return resultForCaller;
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
    await tx.runAsync('DELETE FROM xp_events');
    await tx.runAsync('DELETE FROM completions');
    await tx.runAsync('DELETE FROM quests');
    await tx.runAsync('DELETE FROM goals');
    await tx.runAsync("INSERT OR REPLACE INTO app_state (key,value) VALUES ('starter_seeded','1')");
  });
}
