import {Platform} from 'react-native';
import * as Notifications from 'expo-notifications';
import type {Quest,Completion,QuestDependency,QuestControl,SchedulePreferences} from '@ascend/game-engine';
import {defaultQuestControl,blockedByDependencies,isCompleted,isQuietTime,validCalendarDay,occurrencesForDays,localDayKey} from '@ascend/game-engine';

/**
 * Offline reminder policy.
 * - Indefinite daily/weekly triggers for stable recurring schedules.
 * - Explicit date triggers for one-offs and snoozed/limited recurrences.
 * - Best-effort delivery: Android's Doze/battery policy can delay notifications.
 * - A single pending generation at a time prevents concurrent reschedules.
 */
Notifications.setNotificationHandler({
  handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,
    shouldPlaySound:false,shouldSetBadge:false}),
});
const CHANNEL='ascend-quests';
const MAX_REMINDERS=80;
const HORIZON_DAYS=90;
export async function askReminderPermission():Promise<boolean>{
  if(Platform.OS!=='android')return false;
  await Notifications.setNotificationChannelAsync(CHANNEL,{
    name:'Quest reminders',importance:Notifications.AndroidImportance.DEFAULT,
  });
  let current=await Notifications.getPermissionsAsync();
  if(!current.granted)current=await Notifications.requestPermissionsAsync();
  return current.granted;
}
type ReminderInput={
  quests:Quest[];completions:Completion[];controls:Record<string,QuestControl>;
  dependencies:QuestDependency[];preferences:SchedulePreferences;
};
let queue:Promise<unknown>=Promise.resolve();
export function syncLocalReminders(input:ReminderInput,now=new Date()):Promise<number>{
  const next=queue.then(()=>scheduleReminders(input,now));
  queue=next.catch(()=>{});
  return next;
}
async function scheduleReminders(input:ReminderInput,now:Date):Promise<number>{
  const pending=await Notifications.getAllScheduledNotificationsAsync();
  for(const scheduled of pending){
    if(scheduled.content.data?.ascendQuest===true)
      await Notifications.cancelScheduledNotificationAsync(scheduled.identifier);
  }
  if(!input.preferences.remindersEnabled)return 0;
  const permission=await Notifications.getPermissionsAsync();
  if(!permission.granted)return 0;
  let count=0;
  const schedule=async(quest:Quest,trigger:Notifications.NotificationTriggerInput)=>{
    if(count>=MAX_REMINDERS)return;
    await Notifications.scheduleNotificationAsync({
      content:{title:'ASCEND · Mission reminder',body:quest.title.replace(/^◆ /,''),
        data:{ascendQuest:true,questId:quest.id}},
      trigger,
    });
    count++;
  };
  // Stable recurring quests use native repeating wall-clock triggers.
  // These remain registered when ASCEND isn't opened for weeks.
  const selected=input.quests.filter(q=>{
    const c=input.controls[q.id]??defaultQuestControl(q);
    return !q.archived&&c.status==='active'&&c.reminder&&!!c.timeOfDay&&
      !isQuietTime(c.timeOfDay,input.preferences.quietStart,input.preferences.quietEnd)&&
      !blockedByDependencies(q,input.dependencies,input.completions);
  });
  for(const quest of selected){
    if(count>=MAX_REMINDERS)break;
    const c=input.controls[quest.id]??defaultQuestControl(quest);
    if(!c.timeOfDay)continue;
    const [hour,minute]=c.timeOfDay.split(':').map(Number);
    if(!Number.isInteger(hour)||!Number.isInteger(minute))continue;
    if(quest.repeatRule==='once'){
      if(!c.dueOn||!validCalendarDay(c.dueOn)||isCompleted(quest,input.completions,now))continue;
      const [y,m,d]=c.dueOn.split('-').map(Number);
      const date=new Date(y,m-1,d,hour,minute);
      if(date.getTime()>now.getTime()+60_000)
        await schedule(quest,{type:Notifications.SchedulableTriggerInputTypes.DATE,date,channelId:CHANNEL});
      continue;
    }
    const delayed=!!(c.snoozedUntil&&c.snoozedUntil>localDayKey(now))||
      !!(c.dueOn&&c.dueOn>localDayKey(now));
    if(!delayed){
      // For weekly tasks without selected weekdays, Monday is the default.
      // Multiple selected weekdays produce multiple native weekly triggers.
      const weekdays=c.weekdays.length?c.weekdays:(quest.repeatRule==='weekly'?[1]:[]);
      if(!weekdays.length){
        await schedule(quest,{type:Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,minute,channelId:CHANNEL});
      }else for(const weekday of weekdays){
        await schedule(quest,{type:Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday:weekday+1,hour,minute,channelId:CHANNEL});
      }
      continue;
    }
    // Future start / snoozed quests cannot use unconditional repeating triggers.
    // Pre-schedule occurrences for the next 90 days; the OS may defer background refresh.
    const dates=occurrencesForDays([quest],input.controls,input.completions,
      input.dependencies,now,HORIZON_DAYS);
    for(const day of dates){
      if(count>=MAX_REMINDERS)break;
      if(!day.quests.length)continue;
      const [y,m,d]=day.date.split('-').map(Number);
      const date=new Date(y,m-1,d,hour,minute);
      if(date.getTime()<=now.getTime()+60_000)continue;
      await schedule(quest,{type:Notifications.SchedulableTriggerInputTypes.DATE,date,channelId:CHANNEL});
    }
  }
  return count;
}
