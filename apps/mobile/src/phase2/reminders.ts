import {Platform} from 'react-native';
import * as Notifications from 'expo-notifications';
import type {Quest,Completion,QuestDependency,QuestControl,SchedulePreferences} from '@ascend/game-engine';
import {occurrencesForDays,isQuietTime} from '@ascend/game-engine';

/** Local-only reminders. No FCM token, user account, push server or cloud billing. */
Notifications.setNotificationHandler({
  handleNotification:async()=>({
    shouldShowBanner:true,shouldShowList:true,shouldPlaySound:false,shouldSetBadge:false,
  }),
});
const CHANNEL='ascend-quests';
export async function askReminderPermission():Promise<boolean>{
  if(Platform.OS!=='android')return false;
  await Notifications.setNotificationChannelAsync(CHANNEL,{
    name:'Quest reminders',importance:Notifications.AndroidImportance.DEFAULT,
  });
  let current=await Notifications.getPermissionsAsync();
  if(!current.granted)current=await Notifications.requestPermissionsAsync();
  return current.granted;
}
export async function syncLocalReminders(input:{
  quests:Quest[];completions:Completion[];controls:Record<string,QuestControl>;
  dependencies:QuestDependency[];preferences:SchedulePreferences;
},now=new Date()):Promise<number>{
  const pending=await Notifications.getAllScheduledNotificationsAsync();
  // Never cancel anything except our own scheduled quest notifications.
  for(const scheduled of pending){
    if(scheduled.content.data?.ascendQuest===true)
      await Notifications.cancelScheduledNotificationAsync(scheduled.identifier);
  }
  if(!input.preferences.remindersEnabled)return 0;
  const status=await Notifications.getPermissionsAsync();
  if(!status.granted)return 0;
  const days=occurrencesForDays(input.quests,input.controls,input.completions,input.dependencies,now,14);
  let count=0;
  for(const day of days){
    for(const quest of day.quests){
      const control=input.controls[quest.id];
      if(!control?.reminder||!control.timeOfDay)continue;
      if(isQuietTime(control.timeOfDay,input.preferences.quietStart,input.preferences.quietEnd))continue;
      const [hour,minute]=control.timeOfDay.split(':').map(Number);
      const [year,month,date]=day.date.split('-').map(Number);
      const fire=new Date(year,month-1,date,hour,minute,0,0);
      if(fire.getTime()<=now.getTime()+120_000)continue;
      await Notifications.scheduleNotificationAsync({
        content:{title:'ASCEND · Quest reminder',body:quest.title.replace(/^◆ /,''),
          data:{ascendQuest:true,questId:quest.id}},
        trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date:fire,channelId:CHANNEL},
      });
      count++;
      if(count>=32)return count;
    }
  }
  return count;
}
