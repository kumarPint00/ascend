import {Platform} from 'react-native';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import {initialize,loadSnapshot} from '../data/repository';
import {loadPhaseTwoSnapshot} from '../data/phase2';
import {readBackupSettings,runAutomaticBackup} from '../data/autoBackup';
import {syncLocalReminders} from './reminders';

/**
 * A single WorkManager task for maintenance, not a clock-like alarm.
 * Android decides when it runs; backups additionally run on app foreground
 * if the selected backup interval has elapsed.
 */
export const MAINTENANCE_TASK='ascend-offline-maintenance-v1';
TaskManager.defineTask(MAINTENANCE_TASK,async()=>{
  try{
    await initialize();
    await maintainAppData();
    return BackgroundTask.BackgroundTaskResult.Success;
  }catch{
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});
export async function maintainAppData():Promise<void>{
  const setting=await readBackupSettings();
  if(setting.enabled)await runAutomaticBackup(false);
  const phase=await loadPhaseTwoSnapshot();
  if(phase.preferences.remindersEnabled){
    const base=await loadSnapshot();
    await syncLocalReminders({
      quests:base.quests,completions:base.completions,controls:phase.controls,
      dependencies:phase.dependencies,preferences:phase.preferences,
    });
  }
}
export async function syncMaintenanceRegistration():Promise<boolean>{
  if(Platform.OS!=='android')return false;
  const [backup,phase]=await Promise.all([readBackupSettings(),loadPhaseTwoSnapshot()]);
  const enabled=backup.enabled||phase.preferences.remindersEnabled;
  const registered=await TaskManager.isTaskRegisteredAsync(MAINTENANCE_TASK);
  if(enabled&&!registered){
    const status=await BackgroundTask.getStatusAsync();
    if(status!==BackgroundTask.BackgroundTaskStatus.Available)return false;
    await BackgroundTask.registerTaskAsync(MAINTENANCE_TASK,{minimumInterval:720});
  }else if(!enabled&&registered){
    await BackgroundTask.unregisterTaskAsync(MAINTENANCE_TASK);
  }
  return enabled;
}
