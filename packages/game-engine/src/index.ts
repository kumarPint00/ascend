/** Deterministic, platform-independent rules. No React, network or DB dependencies. */
export const ATTRIBUTES = [
  'strength', 'intelligence', 'discipline', 'finance', 'relationships', 'recovery',
] as const;
export type Attribute = (typeof ATTRIBUTES)[number];
export type Difficulty = 'easy' | 'medium' | 'hard';
export type RepeatRule = 'once' | 'daily' | 'weekly';

export interface Quest {
  id: string;
  title: string;
  description: string;
  attribute: Attribute;
  difficulty: Difficulty;
  repeatRule: RepeatRule;
  goalId: string | null;
  createdAt: string;
  archived: boolean;
}
export interface Goal {
  id: string;
  title: string;
  attribute: Attribute;
  targetCount: number;
  createdAt: string;
  archived: boolean;
}
export interface Completion {
  id: string;
  questId: string;
  periodKey: string;
  completedAt: string;
}
export interface XPEvent {
  id: string;
  completionId: string;
  dayKey: string;
  amount: number;
  attribute: Attribute;
  createdAt: string;
}

export const XP_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 10, medium: 25, hard: 50,
};
export const DAILY_XP_CAP = 250;

/** Local calendar date, not UTC: daily quests reset at the player's midnight. */
export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** ISO week, Monday-first, computed from local calendar date. */
export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - weekday);
  const year = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function periodKey(rule: RepeatRule, date: Date): string {
  return rule === 'daily' ? localDayKey(date)
    : rule === 'weekly' ? isoWeekKey(date) : 'once';
}

export function isCompleted(quest: Quest, completions: readonly Completion[], date: Date): boolean {
  const period = periodKey(quest.repeatRule, date);
  return completions.some(c => c.questId === quest.id && c.periodKey === period);
}

/** Lifetime XP needed at the START of level. Level 1 starts at zero. */
export function xpToReachLevel(level: number): number {
  if (!Number.isInteger(level) || level < 1) throw new Error('Invalid level');
  return 50 * level * (level - 1);
}

export function levelFromXP(xp: number): number {
  if (!Number.isFinite(xp) || xp < 0) throw new Error('Invalid XP');
  // Solves 50 L (L-1) <= xp, subject to floating point adjustment.
  let level = Math.floor((1 + Math.sqrt(1 + 4 * xp / 50)) / 2);
  level = Math.max(1, level);
  while (xpToReachLevel(level + 1) <= xp) level++;
  while (level > 1 && xpToReachLevel(level) > xp) level--;
  return level;
}

export type Rank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
export function rankFromLevel(level: number): Rank {
  if (level >= 50) return 'S';
  if (level >= 40) return 'A';
  if (level >= 30) return 'B';
  if (level >= 20) return 'C';
  if (level >= 10) return 'D';
  return 'E';
}

export function derivePlayer(events: readonly XPEvent[]) {
  const totalXP = events.reduce((sum, e) => sum + e.amount, 0);
  const level = levelFromXP(totalXP);
  const currentThreshold = xpToReachLevel(level);
  const nextThreshold = xpToReachLevel(level + 1);
  const attributes = Object.fromEntries(ATTRIBUTES.map(a => [a, 0])) as Record<Attribute, number>;
  for (const event of events) attributes[event.attribute] += event.amount;
  return {
    totalXP, level, rank: rankFromLevel(level),
    currentLevelXP: totalXP - currentThreshold,
    xpForNextLevel: nextThreshold - currentThreshold,
    progress: (totalXP - currentThreshold) / (nextThreshold - currentThreshold),
    attributes,
  };
}

export function awardForCompletion(
  difficulty: Difficulty, existingDayXP: number,
): number {
  if (!Number.isFinite(existingDayXP) || existingDayXP < 0) throw new Error('Invalid daily XP');
  return Math.max(0, Math.min(XP_BY_DIFFICULTY[difficulty], DAILY_XP_CAP - existingDayXP));
}

export function completedGoalCount(
  goalId: string, quests: readonly Quest[], completions: readonly Completion[],
): number {
  const ids = new Set(quests.filter(q => q.goalId === goalId).map(q => q.id));
  return completions.filter(c => ids.has(c.questId)).length;
}

export function dailyXP(events: readonly XPEvent[], date: Date): number {
  const key = localDayKey(date);
  return events.reduce((sum, e) => sum + (e.dayKey === key ? e.amount : 0), 0);
}

export function cleanQuestInput(input: {
  title: string; description?: string; attribute: Attribute;
  difficulty: Difficulty; repeatRule: RepeatRule; goalId?: string | null;
}) {
  const title = input.title.trim();
  if (!title || title.length > 100) throw new Error('Quest title must have 1–100 characters');
  return {
    title, description: (input.description || '').trim().slice(0, 500),
    attribute: input.attribute, difficulty: input.difficulty,
    repeatRule: input.repeatRule, goalId: input.goalId || null,
  };
}

export { parseQuestPack, importGoalId, importQuestId, isMilestoneQuest, importedQuestTitle, importedQuestDescription, MILESTONE_PREFIX } from './quest-pack';
export type { QuestPack, PackGoal, PackQuest } from './quest-pack';

export {DEFAULT_PREFERENCES,defaultQuestControl,validateControl,validCalendarDay,validTime,isQuietTime,questDueOn,blockedByDependencies,introducesCycle,activeMissionList,occurrencesForDays,skillLevel,derivedSkills,derivedAchievements,outcomeProgress,hasReachedOutcome,xpTrend,focusMinutesForWeek} from './phase2';
export type {QuestLifecycle,QuestControl,GoalOutcome,OutcomeDirection,QuestDependency,WeeklyReview,FocusSession,BossBattle,SchedulePreferences} from './phase2';

export {SKILL_NODES,canUnlockSkill} from './phase2';
export type {SkillNode} from './phase2';

export {forecastGoalCompletion,attributeWeekBreakdown,activeDaysInWindow} from './phase2';

export {metricForecast,milestoneHistoryStatus,adaptiveMissionRecommendations,autoBackupFilename,autoBackupPruneCandidates,AUTOMATIC_BACKUP_PREFIX} from './phase2-depth';
export type {MeasurementPoint,MeasurementForecast,SuggestedMission} from './phase2-depth';

export {measuredGoalProgress} from './phase2-depth';
