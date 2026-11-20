import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ActivityIndicator,Alert,Animated,AccessibilityInfo,KeyboardAvoidingView,Modal,Platform,Pressable,ScrollView,
  StyleSheet,TextInput,View} from 'react-native';
import {Flag,Swords,CalendarDays,Medal,BarChart3,Settings2,Clock3,
  ChevronRight,ShieldCheck,Lock,CheckCircle2,Trophy,Sparkles,Flame} from 'lucide-react-native';
import {LinearGradient} from 'expo-linear-gradient';
import type {Quest,Goal,QuestControl,GoalOutcome,SchedulePreferences,AdaptiveProposal} from '@ascend/game-engine';
import {ATTRIBUTES,SKILL_NODES,activeMissionList,occurrencesForDays,defaultQuestControl,
  questDueOn,blockedByDependencies,isCompleted,localDayKey,isoWeekKey,
  derivedSkills,derivedAchievements,canUnlockSkill,outcomeProgress,xpTrend,focusMinutesForWeek,
  forecastGoalCompletion,attributeWeekBreakdown,activeDaysInWindow,
  adaptiveMissionRecommendations,metricForecast,milestoneHistoryStatus,measuredGoalProgress,
  DEFAULT_ADAPTIVE_SETTINGS,liteMinutes,liteQuestIsAllowed
} from '@ascend/game-engine';
import {Action,Chip,Meter,Panel,Section,T} from '../components/Elements';
import {C,LABELS} from '../theme';
import type {Snapshot} from '../data/repository';
import {completeQuest,undoRecentCompletion} from '../data/repository';
import {EMPTY_PHASE_TWO,loadPhaseTwoSnapshot,updateQuestControl,addQuestDependency,
  removeQuestDependency,saveGoalOutcome,createBoss,winBoss,logFocusSession,saveWeeklyReview,
  savePreferences,unlockSkill,type PhaseTwoSnapshot} from '../data/phase2';
import {shareBackupFile,chooseBackupFile,restoreFullBackup,verifyLocalDatabase} from '../data/backup';
import {askReminderPermission,syncLocalReminders} from './reminders';
import {readBackupSettings,selectExternalBackupFolder,configureAutoBackup,
  runAutomaticBackup,type AutomaticBackupSettings} from '../data/autoBackup';
import {syncMaintenanceRegistration} from './maintenance';
import {loadAdaptiveState,saveAdaptiveSettings,decideAdaptiveProposal,
  proposeFromPersonalHistory,type AdaptiveState} from '../data/adaptive';

type Area='Today'|'Adapt'|'Calendar'|'Library'|'Goals'|'Skills'|'Insights'|'Settings';
const AREAS:Area[]=['Today','Adapt','Calendar','Library','Goals','Skills','Insights','Settings'];
const DAYS=['Su','Mo','Tu','We','Th','Fr','Sa'];
const nextDate=(offset:number)=>{
  const date=new Date();date.setDate(date.getDate()+offset);return localDayKey(date);
};
export function Planner({base,onRefresh,initialQuestId,onTargetConsumed}:{base:Snapshot;onRefresh:()=>Promise<void>;initialQuestId?:string|null;onTargetConsumed?:()=>void}){
  const [phase,setPhase]=useState<PhaseTwoSnapshot>(EMPTY_PHASE_TWO);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [area,setArea]=useState<Area>('Today');
  const [selectedQuest,setSelectedQuest]=useState<Quest|null>(null);
  const [editControl,setEditControl]=useState<QuestControl|null>(null);
  const [selectedGoal,setSelectedGoal]=useState<Goal|null>(null);
  const [goalMetric,setGoalMetric]=useState({value:'0',target:'10',unit:'sessions',deadline:''});
  const [libraryStatus,setLibraryStatus]=useState<'All'|'active'|'backlog'|'paused'>('All');
  const [search,setSearch]=useState(''),[showCount,setShowCount]=useState(18);
  const [chosenDay,setChosenDay]=useState(localDayKey(new Date()));
  const [focusMinutes,setFocusMinutes]=useState('25');
  const [focusQuestId,setFocusQuestId]=useState<string|null>(null);
  const [review,setReview]=useState({wins:'',blockers:'',nextFocus:''});
  const [prefs,setPrefs]=useState<SchedulePreferences>(EMPTY_PHASE_TWO.preferences);
  const [backupText,setBackupText]=useState<string|null>(null);
  const [notificationsCount,setNotificationsCount]=useState<number|null>(null);
  const [calendarDays,setCalendarDays]=useState<14|30|90>(30);
  const [backupSettings,setBackupSettings]=useState<AutomaticBackupSettings|null>(null);
  const [backupRetention,setBackupRetention]=useState(7);
  const [backupInterval,setBackupInterval]=useState<12|24|72>(24);
  const [backupEnabled,setBackupEnabled]=useState(false);
  const [victoryMessage,setVictoryMessage]=useState<string|null>(null);
  const [adaptive,setAdaptive]=useState<AdaptiveState>({
    settings:DEFAULT_ADAPTIVE_SETTINGS,decisions:[],completionModes:[],
  });
  const [editingAdaptive,setEditingAdaptive]=useState<AdaptiveProposal|null>(null);
  const [adaptiveTitle,setAdaptiveTitle]=useState('');
  const [adaptiveMinutes,setAdaptiveMinutes]=useState('15');
  const [adaptiveGoalCount,setAdaptiveGoalCount]=useState('4');
  const victoryPulse=useRef(new Animated.Value(0)).current;
  const [reduceMotion,setReduceMotion]=useState(false);
  const entrance=useRef(new Animated.Value(1)).current;
  useEffect(()=>{
    let live=true;
    AccessibilityInfo.isReduceMotionEnabled().then(enabled=>{if(live)setReduceMotion(enabled);}).catch(()=>{});
    const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduceMotion);
    return ()=>{live=false;sub.remove();};
  },[]);
  useEffect(()=>{
    entrance.stopAnimation();
    entrance.setValue(0);
    Animated.timing(entrance,{toValue:1,duration:reduceMotion?0:210,useNativeDriver:true}).start();
  },[area,reduceMotion,entrance]);
  useEffect(()=>{
    if(!victoryMessage)return;
    victoryPulse.stopAnimation();
    victoryPulse.setValue(reduceMotion?1:0);
    Animated.spring(victoryPulse,{toValue:1,tension:40,friction:7,
      useNativeDriver:true}).start();
  },[victoryMessage,reduceMotion,victoryPulse]);

  const refresh=useCallback(async()=>{
    const [p,learned]=await Promise.all([loadPhaseTwoSnapshot(),loadAdaptiveState()]);
    setAdaptive(learned);setPhase(p);setPrefs({...p.preferences});
    const thisWeek=p.weeklyReviews.find(x=>x.weekKey===isoWeekKey(new Date()));
    setReview({wins:thisWeek?.wins??'',blockers:thisWeek?.blockers??'',
      nextFocus:thisWeek?.nextFocus??''});
    await onRefresh();
    const backup=await readBackupSettings();
    setBackupSettings(backup);setBackupRetention(backup.retention);
    setBackupInterval(backup.intervalHours);setBackupEnabled(backup.enabled);
  },[onRefresh]);
  useEffect(()=>{
    let live=true;
    void readBackupSettings().then(backup=>{
      if(!live)return;
      setBackupSettings(backup);setBackupRetention(backup.retention);
      setBackupInterval(backup.intervalHours);setBackupEnabled(backup.enabled);
    }).catch(()=>{});
    void loadAdaptiveState().then(a=>{if(live)setAdaptive(a);}).catch(()=>{});
    loadPhaseTwoSnapshot().then(p=>{
      if(!live)return;
      setPhase(p);setPrefs({...p.preferences});
      const r=p.weeklyReviews.find(x=>x.weekKey===isoWeekKey(new Date()));
      setReview({wins:r?.wins??'',blockers:r?.blockers??'',nextFocus:r?.nextFocus??''});
      if(p.preferences.remindersEnabled)void syncLocalReminders({
        quests:base.quests,completions:base.completions,controls:p.controls,
        dependencies:p.dependencies,preferences:p.preferences,
      }).catch(()=>{});
    }).catch(e=>Alert.alert('Planner unavailable',String(e)))
      .finally(()=>{if(live)setLoading(false);});
    return ()=>{live=false;};
  },[]);
  useEffect(()=>{
    if(loading||!initialQuestId)return;
    const q=base.quests.find(item=>item.id===initialQuestId);
    if(q){
      const control=phase.controls[q.id]??defaultQuestControl(q);
      setSelectedQuest(q);
      setEditControl({...control,weekdays:[...control.weekdays]});
      setArea('Library');
    }
    onTargetConsumed?.();
  },[loading,initialQuestId]);
  const run=async(work:()=>Promise<void>,success?:string)=>{
    if(busy)return;
    setBusy(true);
    try{
      await work();await refresh();
      if(success)Alert.alert('ASCEND',success);
    }catch(e){Alert.alert('Could not save',e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  };
  const controlFor=(q:Quest)=>phase.controls[q.id]??defaultQuestControl(q);
  const allQuests=useMemo(()=>base.quests.filter(q=>!q.archived),[base.quests]);
  const allGoals=useMemo(()=>base.goals.filter(g=>!g.archived),[base.goals]);
  // Recalculate daily planning when fresh data arrives, not on every keystroke
  // in an unrelated settings or search field.
  const today=useMemo(()=>new Date(),[base,phase]);
  const recommendations=useMemo(()=>adaptiveMissionRecommendations(
    allQuests,phase.controls,base.completions,phase.dependencies,today,
    Math.min(phase.preferences.availableMinutes,adaptive.settings.dailyBudgetMinutes),
    Math.min(phase.preferences.dailyMissionLimit,adaptive.settings.maxDailyMissions)),
    [allQuests,phase.controls,base.completions,phase.dependencies,today,
      phase.preferences.availableMinutes,phase.preferences.dailyMissionLimit,
      adaptive.settings.dailyBudgetMinutes,adaptive.settings.maxDailyMissions]);
  const due=useMemo(()=>recommendations.map(r=>r.quest),[recommendations]);
  const adaptiveProposals=useMemo(()=>proposeFromPersonalHistory({
    quests:base.quests,goals:base.goals,controls:phase.controls,
    completions:base.completions,focusSessions:phase.focusSessions,
    state:adaptive,now:today,
  }),[base.quests,base.goals,base.completions,phase.controls,
    phase.focusSessions,adaptive,today]);
  const active=useMemo(()=>allQuests.filter(q=>(phase.controls[q.id]??defaultQuestControl(q)).status==='active'),
    [allQuests,phase.controls]);
  const backlog=useMemo(()=>allQuests.filter(q=>(phase.controls[q.id]??defaultQuestControl(q)).status==='backlog'),
    [allQuests,phase.controls]);
  const paused=useMemo(()=>allQuests.filter(q=>(phase.controls[q.id]??defaultQuestControl(q)).status==='paused'),
    [allQuests,phase.controls]);
  const calendar=useMemo(()=>occurrencesForDays(
    allQuests,phase.controls,base.completions,phase.dependencies,today,calendarDays),
    [allQuests,phase.controls,base.completions,phase.dependencies,today,calendarDays]);
  const shown=useMemo(()=>allQuests.filter(q=>libraryStatus==='All'||
    (phase.controls[q.id]??defaultQuestControl(q)).status===libraryStatus)
    .filter(q=>(q.title+' '+q.description).toLowerCase().includes(search.toLowerCase())),
    [allQuests,libraryStatus,phase.controls,search]);
  const skills=useMemo(()=>derivedSkills(base.xpEvents),[base.xpEvents]);
  const achievements=useMemo(()=>derivedAchievements(base.quests,base.completions,
    base.xpEvents,phase.bosses),[base.quests,base.completions,base.xpEvents,phase.bosses]);
  const trend=useMemo(()=>xpTrend(base.xpEvents,today,7),[base.xpEvents,today]);
  const trendMax=Math.max(25,...trend.map(x=>x.xp));
  const totalWeekFocus=useMemo(()=>focusMinutesForWeek(phase.focusSessions,today),
    [phase.focusSessions,today]);
  const weekAttributes=useMemo(()=>attributeWeekBreakdown(base.xpEvents,today),
    [base.xpEvents,today]);
  const activeDays=useMemo(()=>activeDaysInWindow(base.completions,today,7),
    [base.completions,today]);
  const completedThisWeek=useMemo(()=>base.completions.filter(c=>
    isoWeekKey(new Date(c.completedAt))===isoWeekKey(today)).length,[base.completions,today]);

  const openPlan=(q:Quest)=>{
    setSelectedQuest(q);
    setEditControl({...controlFor(q),weekdays:[...controlFor(q).weekdays]});
  };
  const savePlan=()=>{if(!selectedQuest||!editControl)return;
    void run(async()=>{
      await updateQuestControl(selectedQuest,editControl);
      setSelectedQuest(null);setEditControl(null);
      const p=await loadPhaseTwoSnapshot();
      if(p.preferences.remindersEnabled)
        await syncLocalReminders({quests:base.quests,completions:base.completions,
          controls:p.controls,dependencies:p.dependencies,preferences:p.preferences});
    },'Quest plan saved');
  };
  const complete=(q:Quest,mode:'standard'|'lite'='standard')=>void run(async()=>{
    const result=await completeQuest(q,new Date(),mode);
    if(!result.applied)throw Error('Already completed in this period');
  },mode==='lite'?'Lite mission cleared · easy-level XP recorded':
    'Quest cleared. XP recorded without duplicates.');
  const updateAdaptivePrefs=(patch:Partial<AdaptiveState['settings']>)=>
    void run(()=>saveAdaptiveSettings({...adaptive.settings,...patch}),'Adaptive safeguards updated');
  const reviewAdaptive=(proposal:AdaptiveProposal)=>{
    setEditingAdaptive(proposal);setAdaptiveTitle(proposal.title);
    setAdaptiveMinutes(String(proposal.estimateMinutes));setAdaptiveGoalCount('4');
  };
  const acceptAdaptive=()=>{if(!editingAdaptive)return;
    void run(async()=>{
      await decideAdaptiveProposal(editingAdaptive,'accepted',{
        title:adaptiveTitle,minutes:Number(adaptiveMinutes),goalTargetCount:Number(adaptiveGoalCount)
      });
      setEditingAdaptive(null);
    },'Suggestion approved and saved. New quests begin in Backlog.');
  };
  const openMetric=(g:Goal)=>{
    setSelectedGoal(g);
    const m=phase.outcomes[g.id];
    setGoalMetric({value:String(m?.value??0),target:String(m?.target??g.targetCount),
      unit:m?.unit??'units',deadline:m?.deadline??''});
  };
  const saveMetric=()=>{if(!selectedGoal)return;
    void run(async()=>{
      await saveGoalOutcome(selectedGoal.id,{value:Number(goalMetric.value),target:Number(goalMetric.target),
        unit:goalMetric.unit,deadline:goalMetric.deadline.trim()||null});
      setSelectedGoal(null);
    },'Outcome saved. XP remains separate from this metric.');
  };
  const saveSettings=()=>void run(async()=>{
    let permitted=prefs.remindersEnabled;
    if(permitted)permitted=await askReminderPermission();
    const next={...prefs,remindersEnabled:permitted};
    await savePreferences(next);
    await syncMaintenanceRegistration();
    const count=await syncLocalReminders({quests:base.quests,completions:base.completions,
      controls:phase.controls,dependencies:phase.dependencies,preferences:next});
    setNotificationsCount(count);
    if(prefs.remindersEnabled&&!permitted)Alert.alert('Permission denied',
      'Android notifications are off. ASCEND will continue without reminders.');
  },'Settings saved');
  const fromFile=async()=>{
    try{
      const text=await chooseBackupFile();if(!text)return;
      setBackupText(text);
    }catch(e){Alert.alert('Backup file invalid',e instanceof Error?e.message:String(e));}
  };

  const heading=(label:string,detail:string)=><View style={{marginBottom:14}}>
    <T bold size={24}>{label}</T>
    <T color={C.sub} size={13} style={{marginTop:5}}>{detail}</T>
  </View>;
  const QuestRow=({quest,compact=false}:{quest:Quest;compact?:boolean})=>{
    const c=controlFor(quest);
    const dueToday=questDueOn(quest,c,today);
    const done=isCompleted(quest,base.completions,today);
    const blocked=blockedByDependencies(quest,phase.dependencies,base.completions);
    return <Panel style={{padding:14}}>
      <View style={ss.between}>
        <View style={{flex:1,marginRight:10}}>
          <T color={C.ink} size={14} bold>{quest.title.replace(/^◆ /,'')}</T>
          {!compact&&!!quest.description&&
            <T color={C.sub} size={11} style={{marginTop:4}}>{quest.description.slice(0,135)}</T>}
          <T color={LABELS[quest.attribute].tint} size={11} style={{marginTop:6}}>
            {LABELS[quest.attribute].label} · {quest.repeatRule} · Priority {c.priority}
            {blocked?' · LOCKED':''}
          </T>
        </View>
        <View style={{alignItems:'flex-end',gap:6}}>
          <T color={done?C.green:c.status==='active'?C.energy:C.dim} bold size={11}>
            {done?'CLEARED':c.status==='active'&&!dueToday?'SCHEDULED':c.status.toUpperCase()}
          </T>
          <Pressable onPress={()=>openPlan(quest)} accessibilityRole="button"
            accessibilityLabel={'Plan '+quest.title} style={ss.smallButton}>
            <T color={C.frost} size={11} bold>PLAN</T>
          </Pressable>
        </View>
      </View>
      {dueToday&&!done&&!blocked&&
        <View style={{marginTop:9,gap:8}}>
          <Action secondary disabled={busy} onPress={()=>complete(quest)}>COMPLETE MISSION</Action>
          {liteQuestIsAllowed(quest)&&c.estimateMinutes>5&&
            !phase.bosses.some(b=>b.questId===quest.id&&!b.wonAt)&&
            <Action secondary disabled={busy} onPress={()=>Alert.alert(
              'Clear a Lite alternative?',
              'Do a smaller, genuine version of this mission. It earns up to 10 XP, and cannot be counted again in this quest period.',[
                {text:'Not now',style:'cancel'},
                {text:'I did the Lite version',onPress:()=>complete(quest,'lite')}
              ])}>
              LITE TODAY · ~{liteMinutes(c.estimateMinutes)} MIN · UP TO 10 XP
            </Action>}
        </View>}
      {done&&base.completions.some(c=>c.questId===quest.id&&
        Date.now()-Date.parse(c.completedAt)>=0&&Date.now()-Date.parse(c.completedAt)<600_000)&&
        <View style={{marginTop:9}}>
          <Action secondary disabled={busy} onPress={()=>Alert.alert('Undo this completion?',
            'This removes the completion and its XP from your local history.',[
              {text:'Cancel',style:'cancel'},
              {text:'Undo',style:'destructive',onPress:()=>void run(
                async()=>{await undoRecentCompletion(quest.id);},'Completion and XP reversed')},
            ])}>UNDO LAST COMPLETION</Action>
        </View>}
      {blocked&&<T size={11} color={C.gold} style={{marginTop:8}}>Finish the prerequisite quest to unlock this mission.</T>}
      {!done&&c.status==='active'&&!dueToday&&<T size={11} color={C.dim} style={{marginTop:8}}>This mission is not due today. Change its plan to reschedule.</T>}
    </Panel>;
  };

  if(loading)return <View style={{padding:30}}><ActivityIndicator color={C.energy}/>
    <T color={C.sub} style={{marginTop:12}}>Loading your System...</T></View>;

  return <View>
    <View style={{marginBottom:8}}>
      <T color={C.energy} size={10} bold style={{letterSpacing:2}}>ASCEND · COMMAND CENTER</T>
      <T size={26} bold style={{marginTop:4}}>The System</T>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={{paddingBottom:6}} style={{marginBottom:12}}>
      {AREAS.map(a=><Chip key={a} active={area===a} onPress={()=>setArea(a)}>{a}</Chip>)}
    </ScrollView>
    <Animated.View style={{opacity:entrance,transform:[{translateY:entrance.interpolate({inputRange:[0,1],outputRange:[reduceMotion?0:8,0]})}]}}>

    {area==='Today'&&<>
      {heading('Today’s focused missions','Prioritized from deadlines, effort, your real history and available time. No cloud AI.')}
      <View style={ss.metrics}>
        <View style={ss.metric}><T color={C.sub} size={10}>TODAY</T><T size={24} bold color={C.energy}>{due.length}</T></View>
        <View style={ss.metric}><T color={C.sub} size={10}>ACTIVE</T><T size={24} bold>{active.length}</T></View>
        <View style={ss.metric}><T color={C.sub} size={10}>BACKLOG</T><T size={24} bold>{backlog.length}</T></View>
      </View>
      <Panel style={{backgroundColor:C.elevated,borderColor:C.borderActive}}>
        <View style={ss.between}>
          <View><T color={C.energy} size={10} bold style={{letterSpacing:1.5}}>ADAPTIVE FOCUS</T>
            <T bold size={18}>{phase.preferences.availableMinutes} minutes available</T></View>
          <Sparkles size={23} color={C.energy}/>
        </View>
        <T color={C.sub} size={12} style={{marginTop:7}}>
          Recommendations are explainable rules, not paid AI. Change your time budget in Settings.
        </T>
      </Panel>
      {due.length?due.map(q=><View key={q.id}>
        <T color={C.gold} size={11} style={{marginLeft:6,marginBottom:4}}>
          ✦ {recommendations.find(item=>item.quest.id===q.id)?.reason??'Planned'} ·
          {recommendations.find(item=>item.quest.id===q.id)?.minutes??25} min estimated
        </T>
        <QuestRow quest={q} compact/>
      </View>):
        <Panel><T color={C.green} bold>No missions demanding attention.</T>
          <T size={12} color={C.sub} style={{marginTop:6}}>Activate a task from Library when you're ready.</T></Panel>}
      <Action secondary onPress={()=>setArea('Library')}>MANAGE QUEST LIBRARY</Action>
      <Section title="Up next"/>
      {calendar.slice(1,4).map(day=><Panel key={day.date} style={{padding:12}}>
        <T color={C.sub} size={12}>{day.date}</T>
        <T size={13} bold style={{marginTop:3}}>{day.quests.length} planned quests</T>
      </Panel>)}
    </>}

    {area==='Adapt'&&<>
      {heading('Adaptive Intelligence',
        'Offline habit learning. It suggests, you decide; no automatic goals, no paid AI and no guilt for missed logs.')}
      <LinearGradient colors={['#243C4C','#172538','#0C1528']}
        style={{borderRadius:22,padding:18,borderWidth:1,borderColor:C.borderActive,marginBottom:15}}>
        <View style={ss.between}>
          <View style={{flex:1}}>
            <T color={C.energy} size={11} bold style={{letterSpacing:1.7}}>PERSONAL LEARNING MODE</T>
            <T size={18} bold style={{marginTop:6}}>You control your challenges</T>
          </View>
          <Sparkles size={30} color={C.energy}/>
        </View>
        <T color={C.sub} size={12} style={{marginTop:9}}>
          Your completion history guides realistic proposals. No generated quest can activate itself or award XP.
          Low energy and overloaded days never trigger harder quests.
        </T>
      </LinearGradient>
      <Panel>
        <T size={15} bold>Current energy</T>
        <T color={C.sub} size={12} style={{marginTop:5}}>
          Self-reported, not inferred from medical or private data. 1 = rest and recovery, 5 = ready for a challenge.
        </T>
        <View style={ss.chips}>{([1,2,3,4,5] as const).map(n=>
          <Chip key={n} active={adaptive.settings.energy===n}
            onPress={()=>updateAdaptivePrefs({energy:n})}>{n}</Chip>)}</View>
        <T color={C.sub} size={12}>Maximum daily mission load</T>
        <View style={ss.chips}>{[2,3,4,5].map(n=>
          <Chip key={n} active={adaptive.settings.maxDailyMissions===n}
            onPress={()=>updateAdaptivePrefs({maxDailyMissions:n})}>{n} missions</Chip>)}</View>
        <T color={C.sub} size={12}>Maximum available focus time</T>
        <View style={ss.chips}>{[30,60,90,120].map(n=>
          <Chip key={n} active={adaptive.settings.dailyBudgetMinutes===n}
            onPress={()=>updateAdaptivePrefs({dailyBudgetMinutes:n})}>{n} min</Chip>)}</View>
        <T color={C.sub} size={12}>Maximum new quests per week</T>
        <View style={ss.chips}>{[0,1,2,3].map(n=>
          <Chip key={n} active={adaptive.settings.maxNewQuestsPerWeek===n}
            onPress={()=>updateAdaptivePrefs({maxNewQuestsPerWeek:n})}>{n}</Chip>)}</View>
        <T color={C.sub} size={12}>Maximum new goals per 30 days</T>
        <View style={ss.chips}>{[0,1,2].map(n=>
          <Chip key={n} active={adaptive.settings.maxNewGoalsPerMonth===n}
            onPress={()=>updateAdaptivePrefs({maxNewGoalsPerMonth:n})}>{n}</Chip>)}</View>
        <T color={C.sub} size={12}>Suggestions per day</T>
        <View style={ss.chips}>{[1,2,3].map(n=>
          <Chip key={n} active={adaptive.settings.suggestionsPerDay===n}
            onPress={()=>updateAdaptivePrefs({suggestionsPerDay:n})}>{n}</Chip>)}</View>
        <Action secondary onPress={()=>updateAdaptivePrefs({
          enabled:!adaptive.settings.enabled,pauseUntil:null
        })}>{adaptive.settings.enabled?'PAUSE ADAPTIVE SUGGESTIONS':'RESUME ADAPTIVE SUGGESTIONS'}</Action>
        {adaptive.settings.enabled&&<View style={{height:9}}/>}
        {adaptive.settings.enabled&&<Action secondary
          onPress={()=>updateAdaptivePrefs({pauseUntil:nextDate(7)})}>
          SNOOZE SUGGESTIONS FOR 7 DAYS
        </Action>}
        {!!adaptive.settings.pauseUntil&&<Action secondary onPress={()=>updateAdaptivePrefs({pauseUntil:null})}>
          RESUME EARLY (SNOOZED TO {adaptive.settings.pauseUntil})
        </Action>}
      </Panel>
      <Section title="Suggested next steps"/>
      {adaptiveProposals.length?adaptiveProposals.map(proposal=>
        <LinearGradient key={proposal.id} colors={['#253748','#17293D','#0D192A']}
          style={{borderRadius:18,borderWidth:1,borderColor:C.borderActive,padding:16,marginBottom:13}}>
          <View style={ss.between}>
            <T color={C.energy} size={10} bold style={{letterSpacing:1.2}}>
              {proposal.kind==='ease'?'EASIER ALTERNATIVE':
                proposal.kind==='stretch'?'OPTIONAL STRETCH':
                proposal.kind==='goal'?'NEW GOAL DRAFT':
                proposal.kind==='milestone'?'MILESTONE DRAFT':'QUEST DRAFT'}
            </T>
            <Sparkles size={16} color={C.gold}/>
          </View>
          <T size={16} bold style={{marginTop:10}}>{proposal.title}</T>
          <T color={C.sub} size={12} style={{marginTop:7}}>{proposal.description}</T>
          <T color={C.gold} size={11} style={{marginTop:10}}>WHY: {proposal.reason}</T>
          <T color={C.dim} size={11} style={{marginTop:8}}>
            {proposal.evidence.completed}/{proposal.evidence.opportunities} recorded opportunities
            across {proposal.evidence.periodDays} days · {proposal.estimateMinutes} min estimated
          </T>
          <View style={{height:12}}/>
          <Action disabled={busy} onPress={()=>reviewAdaptive(proposal)}>REVIEW, EDIT & APPROVE</Action>
          <View style={{height:8}}/>
          <Action secondary disabled={busy} onPress={()=>void run(
            ()=>decideAdaptiveProposal(proposal,'dismissed'),
            'Dismissed. Similar suggestions are suppressed for 21 days.'
          )}>NOT USEFUL · DISMISS</Action>
        </LinearGradient>
      ):<Panel>
        <T color={C.green} bold>No new suggestions right now.</T>
        <T color={C.sub} size={12} style={{marginTop:7}}>
          Suggestions require enough genuine activity records (usually 5+ scheduled opportunities).
          You can always use a Lite alternative directly from Today.
          Rest and a quiet calendar are acceptable outcomes.
        </T>
      </Panel>}
      <Panel>
        <T size={13} bold>Privacy and trust</T>
        <T color={C.sub} size={12} style={{marginTop:7}}>
          All patterns are calculated on-device. ASCEND doesn't infer illness, personality or motivation
          from incomplete logs. New quests, milestones and goals remain drafts until you accept them;
          accepted new quests start in Backlog. Dismissal is remembered locally.
        </T>
      </Panel>
    </>}

    {area==='Calendar'&&<>
      {heading('Mission calendar','Rolling 14/30/90-day offline plan, with recurring reminders beyond the calendar window.')}
      <View style={ss.chips}>{([14,30,90] as const).map(days=>
        <Chip key={days} active={calendarDays===days}
          onPress={()=>{setCalendarDays(days);setChosenDay(localDayKey(new Date()));}}>{days} days</Chip>)}</View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:15}}>
        {calendar.map(day=><Pressable key={day.date}
          accessibilityRole="button" accessibilityState={{selected:chosenDay===day.date}}
          onPress={()=>setChosenDay(day.date)}
          style={[ss.day,chosenDay===day.date&&{borderColor:C.energy,backgroundColor:C.glow}]}>
          <T color={chosenDay===day.date?C.frost:C.sub} size={10}>
            {new Date(day.date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short'})}</T>
          <T bold size={17}>{day.date.slice(-2)}</T>
          <T size={10} color={C.energy}>{day.quests.length}</T>
        </Pressable>)}
      </ScrollView>
      <T size={14} bold style={{marginBottom:12}}>{chosenDay}</T>
      {(calendar.find(x=>x.date===chosenDay)?.quests??[]).length?
        (calendar.find(x=>x.date===chosenDay)?.quests??[]).slice(0,14).map(q=>
          <QuestRow key={q.id} quest={q} compact/>):
        <Panel><T color={C.sub}>Nothing planned for this date.</T></Panel>}
      <T size={11} color={C.dim}>Custom weekdays, due dates, snoozes and times can be changed inside each quest's PLAN screen.</T>
    </>}

    {area==='Library'&&<>
      {heading('Quest library','Activate, pause and schedule tasks without losing XP history.')}
      <View style={ss.metrics}>
        <View style={ss.metric}><T color={C.sub} size={10}>ACTIVE</T><T size={20} bold>{active.length}</T></View>
        <View style={ss.metric}><T color={C.sub} size={10}>BACKLOG</T><T size={20} bold>{backlog.length}</T></View>
        <View style={ss.metric}><T color={C.sub} size={10}>PAUSED</T><T size={20} bold>{paused.length}</T></View>
      </View>
      <TextInput accessibilityLabel="Search quest library" value={search} onChangeText={x=>{setSearch(x);setShowCount(18);}}
        placeholder="Search title or description" placeholderTextColor={C.dim} style={ss.input}/>
      <View style={ss.chips}>{(['All','active','backlog','paused'] as const).map(x=>
        <Chip key={x} active={libraryStatus===x} onPress={()=>{setLibraryStatus(x);setShowCount(18);}}>{x}</Chip>)}</View>
      <T size={12} color={C.sub} style={{marginBottom:12}}>{shown.length} matching quests</T>
      {shown.slice(0,showCount).map(q=><QuestRow key={q.id} quest={q}/>)}
      {shown.length>showCount&&<Action secondary onPress={()=>setShowCount(n=>n+18)}>LOAD MORE ({shown.length-showCount})</Action>}
      {!shown.length&&<Panel><T color={C.sub}>No matching quests. Try a different filter.</T></Panel>}
    </>}

    {area==='Goals'&&<>
      {heading('Epic questlines','Measure real results separately from XP and task counts.')}
      {allGoals.slice(0,30).map(g=>{
        const m=phase.outcomes[g.id];
        const history=milestoneHistoryStatus(phase.goalMeasurements,g.id);
        const measuredTrend=m?metricForecast(history,m.target,today):null;
        const recorded=m?measuredGoalProgress(history,m.value,m.target):Math.min(1,base.completions.filter(c=>
          base.quests.some(q=>q.id===c.questId&&q.goalId===g.id)).length/g.targetCount);
        const milestoneCount=allQuests.filter(q=>q.goalId===g.id&&q.title.startsWith('◆ ')).length;
        return <Panel key={g.id}>
          <T size={15} bold>{g.title}</T>
          <T size={11} color={C.sub} style={{marginVertical:7}}>
            {m?`${m.value} / ${m.target} ${m.unit}`:'Quest completions used until a real metric is configured'}
          </T>
          <Meter value={recorded} tint={LABELS[g.attribute].tint}/>
          <T size={11} color={C.dim} style={{marginTop:7}}>
            {milestoneCount} milestones · {Math.round(recorded*100)}% of {m?'measured result':'activity target'}
          </T>
          {m&&<View style={{marginTop:10}}>
            <View style={ss.between}>
              <T color={C.energy} size={12} bold>MEASUREMENT HISTORY</T>
              <T color={C.dim} size={11}>{history.length} samples</T>
            </View>
            {history.slice(0,4).map(point=><View key={point.id}
              style={[ss.between,{marginTop:7,borderBottomColor:C.border,borderBottomWidth:1,paddingBottom:5}]}>
              <T color={C.sub} size={11}>{point.id.startsWith('baseline:')?'Imported baseline · date unknown':point.recordedAt.slice(0,10)}</T>
              <T size={12} color={C.frost} bold>{point.value} {point.unit}</T>
            </View>)}
            {measuredTrend?<T color={C.gold} size={11} style={{marginTop:9}}>
              Estimated trend: {Math.abs(measuredTrend.changePerWeek).toFixed(2)} {m.unit}/week {measuredTrend.direction}.
              Target may be reached around {measuredTrend.estimatedDate}. Not guaranteed.
            </T>:<T color={C.dim} size={11} style={{marginTop:7}}>
              No reliable trend yet. Record 3+ measurements across at least 7 days, with progress toward the target.
            </T>}
          </View>}
          {!m&&(()=>{const f=forecastGoalCompletion(g,base.quests,base.completions,today);
            return f?<T color={C.sub} size={11} style={{marginTop:5}}>
              Activity-only estimate: {f.projectedDate} at {f.weeklyRate.toFixed(1)} quest completions/week
            </T>:<T color={C.dim} size={11} style={{marginTop:5}}>Activity estimate: not enough recent evidence</T>;
          })()}
          <View style={[ss.between,{marginTop:12}]}>
            <Pressable accessibilityRole="button" onPress={()=>openMetric(g)} style={ss.smallButton}>
              <T color={C.energy} size={11} bold>SET METRIC</T>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={()=>void run(async()=>{
              if(phase.bosses.some(b=>b.goalId===g.id&&!b.wonAt))throw Error('Active boss already exists for this goal');
              await createBoss({title:'Boss: '+g.title,description:'Reach the goal target with evidence',
                goalId:g.id,questId:null});
            },'Boss battle created for this goal')} style={ss.smallButton}>
              <T size={11} color={C.gold} bold>+ BOSS BATTLE</T>
            </Pressable>
          </View>
        </Panel>;
      })}
      {!allGoals.length&&<Panel><T color={C.sub}>Create or import your first goal in the Goals tab.</T></Panel>}
    </>}

    {area==='Skills'&&<>
      {heading('Hunter skill tree','Unlock skills using XP earned from actual quest completions.')}
      {ATTRIBUTES.map(a=>{
        const skill=skills[a],nodes=SKILL_NODES.filter(n=>n.attribute===a);
        return <Panel key={a}>
          <View style={ss.between}><T size={15} bold>{LABELS[a].label}</T>
            <T color={LABELS[a].tint} size={13} bold>LV {skill.level}</T></View>
          <T color={C.sub} size={11} style={{marginTop:4}}>{skill.xp} attribute XP</T>
          <View style={{marginTop:10}}><Meter tint={LABELS[a].tint}
            value={(skill.xp-75*(skill.level-1)**2)/
              Math.max(1,75*skill.level**2-75*(skill.level-1)**2)}/></View>
          <T color={C.dim} size={10} style={{marginTop:5}}>Build your skill through recorded quest completions.</T>
          {nodes.map(n=>{
            const unlocked=phase.skillUnlocks.includes(n.id),available=canUnlockSkill(n,base.xpEvents,phase.skillUnlocks);
            return <View key={n.id} style={[ss.between,{paddingVertical:12,borderBottomWidth:1,borderColor:C.border}]}>
              <View style={{flex:1}}>
                <T size={13} color={unlocked?C.green:C.ink} bold>{unlocked?'✦ ':''}{n.title}</T>
                <T size={11} color={C.sub}>Unlock at skill level {n.requiredLevel}</T>
              </View>
              {unlocked?<CheckCircle2 size={19} color={C.green}/>:
                available?<Pressable style={ss.smallButton} onPress={()=>void run(()=>unlockSkill(n.id),'Skill unlocked!')}>
                  <T color={C.energy} size={11} bold>UNLOCK</T>
                </Pressable>:<Lock size={18} color={C.dim}/>}
            </View>;
          })}
        </Panel>;
      })}
      <Section title="Achievements"/>
      {achievements.map(a=><Panel key={a.id} style={{padding:12,opacity:a.unlocked?1:.56}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
          {a.unlocked?<Medal color={C.gold} size={24}/>:<Lock color={C.dim} size={22}/>}
          <View style={{flex:1}}><T size={14} bold>{a.title}</T>
            <T size={11} color={C.sub}>{a.description}</T></View>
        </View>
      </Panel>)}
      <Section title="Boss battles"/>
      {phase.bosses.length?phase.bosses.map(b=><LinearGradient
        key={b.id} colors={b.wonAt?['#183B35','#102724']:['#3E284A','#181B3A','#0C1529']}
        style={{padding:17,borderRadius:22,borderWidth:1,borderColor:b.wonAt?C.green:C.gold,marginBottom:13}}>
        <View style={[ss.between,{marginBottom:10}]}>
          <View style={{backgroundColor:'#131F37',borderWidth:1,borderColor:C.borderActive,
            width:54,height:54,borderRadius:17,justifyContent:'center',alignItems:'center'}}>
            {b.wonAt?<Trophy size={27} color={C.gold}/>:<Swords size={27} color={C.gold}/>}
          </View>
          <View style={{alignItems:'flex-end'}}>
            <T color={C.gold} size={10} bold style={{letterSpacing:2}}>EPIC CHALLENGE</T>
            <T color={b.wonAt?C.green:C.frost} bold size={12}>{b.wonAt?'GATE CLEARED':'GATE ACTIVE'}</T>
          </View>
        </View>
        <T size={20} bold>{b.title}</T>
        <T color={C.sub} size={12} style={{marginVertical:10}}>{b.description}</T>
        {!b.wonAt&&<Action disabled={busy} onPress={()=>void run(async()=>{
          await winBoss(b.id);setVictoryMessage(b.title);
        })}>VERIFY BOSS VICTORY</Action>}
        {b.wonAt&&<T color={C.green} size={11}>Victory verified · {b.wonAt.slice(0,10)}</T>}
      </LinearGradient>):<Panel><T color={C.sub}>Create a boss battle from a goal to track a major outcome.</T></Panel>}
    </>}

    {area==='Insights'&&<>
      {heading('Weekly intelligence','Your actual activity, not a personality score or health assessment.')}
      <View style={ss.metrics}>
        <View style={ss.metric}><T color={C.sub} size={10}>QUESTS THIS WEEK</T>
          <T size={24} bold>{completedThisWeek}</T></View>
        <View style={ss.metric}><T color={C.sub} size={10}>FOCUS MINUTES</T>
          <T size={24} bold color={C.energy}>{totalWeekFocus}</T></View>
      </View>
      <Panel>
        <View style={ss.between}><T bold size={14}>Consistency · last 7 days</T>
          <T color={C.energy} bold size={17}>{activeDays} / 7</T></View>
        <Meter value={activeDays/7} tint={C.green}/>
        <T color={C.sub} size={11} style={{marginTop:6}}>Distinct days with recorded quest completions. Rest days are allowed.</T>
      </Panel>
      <Panel>
        <T bold>Contribution by life area</T>
        {ATTRIBUTES.map(a=><View key={a} style={{marginTop:11}}>
          <View style={ss.between}><T color={C.sub} size={12}>{LABELS[a].label}</T>
            <T color={LABELS[a].tint} size={12}>{weekAttributes[a]} XP</T></View>
          <View style={{marginTop:6}}><Meter value={weekAttributes[a]/Math.max(1,...Object.values(weekAttributes))} tint={LABELS[a].tint}/></View>
        </View>)}
      </Panel>
      <Panel>
        <T bold>XP · last seven days</T>
        <View style={ss.chart}>{trend.map(d=><View key={d.day} style={ss.barCell}>
          <T color={C.dim} size={10}>{d.xp}</T>
          <View style={{height:Math.max(3,Math.round(d.xp/trendMax*105)),
            width:'58%',backgroundColor:d.day===localDayKey(today)?C.energy:C.violet,
            borderRadius:5}}/>
          <T size={10} color={C.sub}>{d.day.slice(-2)}</T>
        </View>)}</View>
      </Panel>
      <Panel>
        <T bold>Log a focused work session</T>
        <T size={12} color={C.sub} style={{marginTop:6}}>Record real minutes you spent, rather than inventing productive time.</T>
        <T color={C.sub} size={12} style={{marginTop:12}}>Link this session to a current mission (optional)</T>
        <View style={ss.chips}><Chip active={focusQuestId===null} onPress={()=>setFocusQuestId(null)}>General</Chip>
          {due.slice(0,5).map(q=><Chip key={q.id} active={focusQuestId===q.id}
            onPress={()=>setFocusQuestId(q.id)}>{q.title.slice(0,19)}</Chip>)}</View>
        <TextInput style={[ss.input,{marginTop:10}]} accessibilityLabel="Focus minutes" keyboardType="number-pad"
          value={focusMinutes} onChangeText={setFocusMinutes} placeholder="Minutes" placeholderTextColor={C.dim}/>
        <Action secondary disabled={busy} onPress={()=>void run(()=>logFocusSession(focusQuestId,Number(focusMinutes)),'Focus time recorded')}>LOG FOCUS</Action>
      </Panel>
      <Section title={'Weekly review · '+isoWeekKey(today)}/>
      <Panel>
        <T color={C.sub} size={12}>What worked this week?</T>
        <TextInput accessibilityLabel="Weekly wins" style={[ss.input,ss.notes]} multiline value={review.wins}
          onChangeText={wins=>setReview(v=>({...v,wins}))} maxLength={1200}
          placeholder="Wins and evidence" placeholderTextColor={C.dim}/>
        <T color={C.sub} size={12}>What got in the way?</T>
        <TextInput accessibilityLabel="Weekly blockers" style={[ss.input,ss.notes]} multiline value={review.blockers}
          onChangeText={blockers=>setReview(v=>({...v,blockers}))} maxLength={1200}
          placeholder="Blockers without self-blame" placeholderTextColor={C.dim}/>
        <T color={C.sub} size={12}>What will you prioritize next week?</T>
        <TextInput accessibilityLabel="Next week's focus" style={[ss.input,ss.notes]} multiline value={review.nextFocus}
          onChangeText={nextFocus=>setReview(v=>({...v,nextFocus}))} maxLength={1200}
          placeholder="A realistic next step" placeholderTextColor={C.dim}/>
        <Action disabled={busy} onPress={()=>void run(()=>saveWeeklyReview(review),'Weekly review saved offline')}>SAVE REVIEW</Action>
      </Panel>
      <T color={C.dim} size={11}>XP does not prove skill, fitness or work quality. Use measured goals and review notes for actual outcomes.</T>
    </>}

    {area==='Settings'&&<>
      {heading('Planner settings','All scheduling stays on this device. Notifications are optional.')}
      <Panel>
        <T bold size={16}>Daily focus limit</T>
        <T color={C.sub} size={12} style={{marginTop:6}}>Limit suggested daily quests without deleting the backlog.</T>
        <View style={[ss.chips,{marginTop:12}]}>{[3,4,5,6,8].map(n=>
          <Chip key={n} active={prefs.dailyMissionLimit===n} onPress={()=>setPrefs(p=>({...p,dailyMissionLimit:n}))}>{n} missions</Chip>)}</View>
      </Panel>
      <Panel>
        <T bold size={16}>Daily available time</T>
        <T color={C.sub} size={12} style={{marginTop:6}}>
          Suggestions prioritize tasks that fit your schedule rather than demanding every quest at once.
        </T>
        <View style={[ss.chips,{marginTop:12}]}>{[30,60,90,120,180].map(n=>
          <Chip key={n} active={prefs.availableMinutes===n}
            onPress={()=>setPrefs(p=>({...p,availableMinutes:n}))}>{n} min</Chip>)}</View>
      </Panel>
      <Panel>
        <T bold size={16}>Local reminders</T>
        <T color={C.sub} size={12} style={{marginVertical:9}}>Only selected quests with an active reminder time will notify you. No cloud push service.</T>
        <View style={ss.chips}>
          <Chip active={prefs.remindersEnabled} onPress={()=>setPrefs(p=>({...p,remindersEnabled:true}))}>Enabled</Chip>
          <Chip active={!prefs.remindersEnabled} onPress={()=>setPrefs(p=>({...p,remindersEnabled:false}))}>Disabled</Chip>
        </View>
        <T color={C.sub} size={12}>Quiet hours start (HH:mm)</T>
        <TextInput accessibilityLabel="Quiet hours start time" style={ss.input} value={prefs.quietStart}
          onChangeText={quietStart=>setPrefs(p=>({...p,quietStart}))} placeholder="22:00" placeholderTextColor={C.dim}/>
        <T color={C.sub} size={12}>Quiet hours end (HH:mm)</T>
        <TextInput accessibilityLabel="Quiet hours end time" style={ss.input} value={prefs.quietEnd}
          onChangeText={quietEnd=>setPrefs(p=>({...p,quietEnd}))} placeholder="07:00" placeholderTextColor={C.dim}/>
        <Action disabled={busy} onPress={saveSettings}>SAVE & SYNC REMINDERS</Action>
        {notificationsCount!==null&&<T color={C.green} size={11} style={{marginTop:10}}>{notificationsCount} local reminder schedules active (some repeat indefinitely).</T>}
      </Panel>
      <Panel style={{borderColor:C.borderActive}}>
        <View style={ss.between}><T bold size={17}>Automatic verified backups</T>
          <ShieldCheck size={22} color={C.energy}/></View>
        <T color={C.sub} size={12} style={{marginVertical:9}}>
          Choose a private folder outside ASCEND. Backups are unencrypted JSON,
          so don't select a shared folder. Android's background maintenance is best-effort;
          backups also run when you reopen the app.
        </T>
        <T color={backupSettings?.directoryUri?C.green:C.gold} size={12}>
          {backupSettings?.directoryUri?'External folder selected':'No external folder selected'}
        </T>
        <View style={{marginTop:10,marginBottom:12}}>
          <Action secondary disabled={busy} onPress={()=>void run(async()=>{
            await selectExternalBackupFolder();
            await syncMaintenanceRegistration();
            const result=await runAutomaticBackup(true);
            Alert.alert('Backup verified',result.message);
          })}>SELECT / CHANGE BACKUP FOLDER</Action>
        </View>
        <T color={C.sub} size={12}>Automatic backup</T>
        <View style={ss.chips}>
          <Chip active={backupEnabled} onPress={()=>setBackupEnabled(true)}>Enabled</Chip>
          <Chip active={!backupEnabled} onPress={()=>setBackupEnabled(false)}>Disabled</Chip>
        </View>
        <T color={C.sub} size={12}>Minimum interval</T>
        <View style={ss.chips}>{([12,24,72] as const).map(n=>
          <Chip key={n} active={backupInterval===n} onPress={()=>setBackupInterval(n)}>{n} hours</Chip>)}</View>
        <T color={C.sub} size={12}>Keep latest copies</T>
        <View style={ss.chips}>{[3,7,14,30].map(n=>
          <Chip key={n} active={backupRetention===n} onPress={()=>setBackupRetention(n)}>{n}</Chip>)}</View>
        <Action disabled={busy} onPress={()=>void run(async()=>{
          await configureAutoBackup({enabled:backupEnabled,intervalHours:backupInterval,retention:backupRetention});
          await syncMaintenanceRegistration();
          if(backupEnabled)await runAutomaticBackup(true);
        },'Backup settings saved and enabled copies verified')}>SAVE AUTOMATIC BACKUP SETTINGS</Action>
        <View style={{height:10}}/>
        <Action secondary disabled={busy} onPress={()=>void run(async()=>{
          const result=await runAutomaticBackup(true);
          Alert.alert('Backup result',result.message);
        })}>BACK UP NOW & VERIFY</Action>
        <T color={C.sub} size={11} style={{marginTop:10}}>
          Last verified: {backupSettings?.lastVerifiedAt?.slice(0,19)??'Never'}
        </T>
        {!!backupSettings?.lastError&&<T color={C.danger} size={11} style={{marginTop:7}}>
          Last error: {backupSettings.lastError}
        </T>}
      </Panel>
      <Panel>
        <T bold size={16}>Verified file backups</T>
        <T color={C.sub} size={12} style={{marginVertical:10}}>
          Export quests, XP, goals, planner states, skills, bosses, reviews and focus sessions to an actual JSON file. Save it outside this app.
        </T>
        <Action secondary disabled={busy} onPress={()=>void run(shareBackupFile)}>EXPORT & SHARE BACKUP</Action>
        <View style={{height:10}}/>
        <Action secondary disabled={busy} onPress={()=>{void fromFile();}}>CHOOSE BACKUP TO RESTORE</Action>
        <View style={{height:10}}/>
        <Action secondary disabled={busy} onPress={()=>void run(async()=>{
          const check=await verifyLocalDatabase();
          Alert.alert('Local data integrity',check.integrity==='ok'&&check.foreignKeyErrors===0
            ?'Database OK. '+check.tables+' tables verified, no broken references.'
            :'Database needs review: '+check.integrity+', foreign key errors: '+check.foreignKeyErrors);
        })}>VERIFY LOCAL DATABASE</Action>
        <T color={C.dim} size={11} style={{marginTop:10}}>Restore replaces current data. Choose an external file; don't rely on an internal app folder for disaster recovery.</T>
      </Panel>
    </>}

    </Animated.View>
    <Modal visible={!!editControl&&!!selectedQuest} animationType="slide" transparent
      onRequestClose={()=>{setSelectedQuest(null);setEditControl(null);}}>
      <KeyboardAvoidingView style={ss.overlay} behavior={Platform.OS==='ios'?'padding':'height'}>
        <ScrollView style={ss.sheet} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
            contentContainerStyle={{padding:19,paddingBottom:44}}>
          <View style={ss.between}><T bold size={20}>Plan mission</T>
            <Pressable onPress={()=>{setSelectedQuest(null);setEditControl(null);}}><T color={C.sub}>CLOSE ✕</T></Pressable></View>
          <T color={C.sub} size={13} style={{marginVertical:12}}>{selectedQuest?.title}</T>
          {editControl&&<>
            <T size={12} color={C.sub}>Lifecycle</T>
            <View style={ss.chips}>{(['active','backlog','paused'] as const).map(x=>
              <Chip key={x} active={editControl.status===x} onPress={()=>setEditControl(v=>v&&({...v,status:x}))}>{x}</Chip>)}</View>
            <T size={12} color={C.sub}>Priority (1 is highest)</T>
            <View style={ss.chips}>{([1,2,3] as const).map(x=>
              <Chip key={x} active={editControl.priority===x} onPress={()=>setEditControl(v=>v&&({...v,priority:x}))}>{x}</Chip>)}</View>
            <T size={12} color={C.sub}>Weekdays (none means the usual recurrence)</T>
            <View style={ss.chips}>{DAYS.map((d,i)=><Chip key={d} active={editControl.weekdays.includes(i)}
              onPress={()=>setEditControl(v=>v&&({...v,weekdays:v.weekdays.includes(i)?
                v.weekdays.filter(x=>x!==i):[...v.weekdays,i]}))}>{d}</Chip>)}</View>
            <T size={12} color={C.sub}>Target date (YYYY-MM-DD, optional)</T>
            <TextInput accessibilityLabel="Quest target date" style={ss.input} value={editControl.dueOn??''} placeholder="YYYY-MM-DD"
              placeholderTextColor={C.dim} onChangeText={dueOn=>setEditControl(v=>v&&({...v,dueOn:dueOn||null}))}/>
            <T size={12} color={C.sub}>Snooze until (optional)</T>
            <TextInput accessibilityLabel="Quest snooze until date" style={ss.input} value={editControl.snoozedUntil??''} placeholder="YYYY-MM-DD"
              placeholderTextColor={C.dim} onChangeText={snoozedUntil=>setEditControl(v=>v&&({...v,snoozedUntil:snoozedUntil||null}))}/>
            <View style={ss.chips}><Chip active={false} onPress={()=>setEditControl(v=>v&&({...v,snoozedUntil:nextDate(1)}))}>Tomorrow</Chip>
              <Chip active={false} onPress={()=>setEditControl(v=>v&&({...v,snoozedUntil:nextDate(7)}))}>Next week</Chip>
              <Chip active={false} onPress={()=>setEditControl(v=>v&&({...v,snoozedUntil:null}))}>Clear</Chip></View>
            <T size={12} color={C.sub}>Reminder time (HH:mm, optional)</T>
            <TextInput accessibilityLabel="Reminder time" style={ss.input} value={editControl.timeOfDay??''} placeholder="09:00"
              placeholderTextColor={C.dim} onChangeText={timeOfDay=>setEditControl(v=>v&&({...v,timeOfDay:timeOfDay||null}))}/>
            <T size={12} color={C.sub}>Estimated minutes</T>
            <TextInput accessibilityLabel="Estimated quest minutes" style={ss.input} keyboardType="number-pad" value={String(editControl.estimateMinutes)}
              onChangeText={estimateMinutes=>setEditControl(v=>v&&({...v,estimateMinutes:Number(estimateMinutes)||0}))}/>
            <View style={ss.chips}>
              <Chip active={editControl.reminder} onPress={()=>setEditControl(v=>v&&({...v,reminder:true}))}>Reminder on</Chip>
              <Chip active={!editControl.reminder} onPress={()=>setEditControl(v=>v&&({...v,reminder:false}))}>Reminder off</Chip>
            </View>
            <Action disabled={busy} onPress={savePlan}>SAVE PLAN</Action>
          </>}
          {!!selectedQuest&&selectedQuest.repeatRule==='once'&&<View style={{marginTop:22}}>
            <T size={17} bold>Prerequisite milestones</T>
            <T size={12} color={C.sub} style={{marginBottom:12}}>A locked mission cannot be completed until its prerequisites are cleared.</T>
            {phase.dependencies.filter(d=>d.questId===selectedQuest.id).map(d=><View key={d.requiresQuestId} style={[ss.between,{marginBottom:9}]}>
              <T style={{flex:1}} size={12}>{base.quests.find(q=>q.id===d.requiresQuestId)?.title??d.requiresQuestId}</T>
              <Pressable onPress={()=>void run(()=>removeQuestDependency(selectedQuest.id,d.requiresQuestId))}>
                <T color={C.danger} size={11}>REMOVE</T>
              </Pressable>
            </View>)}
            {allQuests.filter(q=>q.goalId===selectedQuest.goalId&&q.id!==selectedQuest.id&&
              q.repeatRule==='once'&&!phase.dependencies.some(d=>d.questId===selectedQuest.id&&d.requiresQuestId===q.id)).slice(0,15)
              .map(q=><Pressable key={q.id} onPress={()=>void run(()=>addQuestDependency(selectedQuest.id,q.id),'Prerequisite added')}
                style={ss.prereq}><T size={12} color={C.energy}>+ {q.title.replace(/^◆ /,'')}</T></Pressable>)}
          </View>}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>

    <Modal visible={!!selectedGoal} animationType="slide" transparent onRequestClose={()=>setSelectedGoal(null)}>
      <KeyboardAvoidingView style={ss.overlay} behavior={Platform.OS==='ios'?'padding':'height'}>
        <View style={[ss.sheet,{padding:19}]}>
          <View style={ss.between}><T size={19} bold>Measure progress</T>
            <Pressable onPress={()=>setSelectedGoal(null)}><T color={C.sub}>CLOSE ✕</T></Pressable></View>
          <T color={C.sub} size={13} style={{marginVertical:11}}>{selectedGoal?.title}</T>
          <T size={12} color={C.sub}>Current value</T>
          <TextInput accessibilityLabel="Current goal measurement" keyboardType="decimal-pad" style={ss.input} value={goalMetric.value}
            onChangeText={value=>setGoalMetric(m=>({...m,value}))}/>
          <T size={12} color={C.sub}>Target</T>
          <TextInput accessibilityLabel="Goal measurement target" keyboardType="decimal-pad" style={ss.input} value={goalMetric.target}
            onChangeText={target=>setGoalMetric(m=>({...m,target}))}/>
          <T size={12} color={C.sub}>Unit</T>
          <TextInput accessibilityLabel="Measurement unit" style={ss.input} value={goalMetric.unit} maxLength={24}
            onChangeText={unit=>setGoalMetric(m=>({...m,unit}))}/>
          <T size={12} color={C.sub}>Deadline (optional, YYYY-MM-DD)</T>
          <TextInput accessibilityLabel="Goal target deadline" style={ss.input} value={goalMetric.deadline} placeholder="YYYY-MM-DD"
            placeholderTextColor={C.dim} onChangeText={deadline=>setGoalMetric(m=>({...m,deadline}))}/>
          <Action disabled={busy} onPress={saveMetric}>SAVE MEASURABLE OUTCOME</Action>
        </View>
      </KeyboardAvoidingView>
    </Modal>

    <Modal visible={editingAdaptive!==null} animationType="slide" transparent
      onRequestClose={()=>setEditingAdaptive(null)}>
      <KeyboardAvoidingView style={ss.overlay} behavior={Platform.OS==='ios'?'padding':'height'}>
        <View style={[ss.sheet,{padding:19}]}>
          <View style={ss.between}>
            <T size={19} bold>Review AI-style suggestion</T>
            <Pressable accessibilityRole="button" accessibilityLabel="Close suggestion"
              onPress={()=>setEditingAdaptive(null)}>
              <T color={C.sub}>CLOSE ✕</T>
            </Pressable>
          </View>
          <T color={C.sub} size={12} style={{marginTop:10}}>
            Nothing is saved until you approve. This suggestion comes from local rules, not an external model.
          </T>
          {editingAdaptive?.kind!=='ease'&&editingAdaptive?.kind!=='stretch'&&
            <View style={{marginTop:12}}>
              <T color={C.sub} size={12}>Title</T>
              <TextInput accessibilityLabel="Suggested quest or goal title"
                value={adaptiveTitle} onChangeText={setAdaptiveTitle}
                maxLength={100} style={ss.input}/>
            </View>}
          {editingAdaptive?.kind==='goal'&&<>
            <T color={C.sub} size={12} style={{marginTop:12}}>Quest-completion target for this goal</T>
            <TextInput accessibilityLabel="New goal activity target" keyboardType="number-pad"
              value={adaptiveGoalCount} onChangeText={setAdaptiveGoalCount} style={ss.input}/>
          </>}
          {editingAdaptive?.kind!=='goal'&&<>
            <T color={C.sub} size={12} style={{marginTop:12}}>Estimated minutes</T>
            <TextInput accessibilityLabel="Suggested effort in minutes"
              value={adaptiveMinutes} onChangeText={setAdaptiveMinutes}
              keyboardType="number-pad" style={ss.input}/>
          </>}
          <T color={C.gold} size={11} style={{marginVertical:12}}>
            {editingAdaptive?.kind==='ease'?'Reduces the planned effort; does not inflate XP.':
              editingAdaptive?.kind==='stretch'?'A gradual increase that you can decline at any time.':
              'New content is created only after approval. Quests begin in Backlog.'}
          </T>
          <Action disabled={busy} onPress={acceptAdaptive}>APPROVE THIS CHANGE</Action>
          <View style={{height:10}}/><Action secondary onPress={()=>setEditingAdaptive(null)}>
            CANCEL
          </Action>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    <Modal visible={victoryMessage!==null} transparent animationType="fade"
      onRequestClose={()=>setVictoryMessage(null)}>
      <View style={[ss.overlay,{justifyContent:'center',padding:22}]}>
        <Animated.View style={{opacity:victoryPulse,transform:[{
          scale:victoryPulse.interpolate({inputRange:[0,1],outputRange:[reduceMotion?1:.83,1]})
        }]}}>
          <LinearGradient colors={['#463A52','#182C43','#0A172B']} style={{
            borderRadius:27,borderWidth:2,borderColor:C.gold,padding:25,alignItems:'center'}}>
            <Sparkles color={C.gold} size={34}/>
            <T color={C.gold} size={11} bold style={{letterSpacing:3,marginTop:12}}>BOSS BATTLE CLEARED</T>
            <T size={23} bold style={{textAlign:'center',marginTop:11}}>{victoryMessage??''}</T>
            <T color={C.sub} size={12} style={{textAlign:'center',marginTop:14,marginBottom:20}}>
              Victory verified against a real completed quest or measurable goal.
              No extra XP is invented.
            </T>
            <Action onPress={()=>setVictoryMessage(null)}>RETURN TO THE SYSTEM</Action>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
    <Modal visible={backupText!==null} animationType="fade" transparent onRequestClose={()=>setBackupText(null)}>
      <View style={ss.overlay}><View style={[ss.sheet,{padding:19}]}>
        <T bold size={19}>Restore from backup?</T>
        <T color={C.sub} size={13} style={{marginVertical:14}}>
          This replaces ALL quests, XP, goals, planner settings, skills, bosses and reviews on this phone. Make a backup of current data before proceeding.
        </T>
        <Action danger disabled={busy} onPress={()=>Alert.alert('Final confirmation',
          'Are you sure? Existing local data will be replaced.',[
          {text:'Cancel',style:'cancel'},
          {text:'Restore',style:'destructive',onPress:()=>void run(async()=>{
            await restoreFullBackup(backupText!);setBackupText(null);
          },'Backup restored successfully')},
        ])}>REPLACE DATA FROM FILE</Action>
        <View style={{height:11}}/><Action secondary onPress={()=>setBackupText(null)}>CANCEL</Action>
      </View></View>
    </Modal>
  </View>;
}

const ss=StyleSheet.create({
  between:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  metrics:{flexDirection:'row',gap:8,marginBottom:14},
  metric:{flex:1,backgroundColor:C.surface,borderColor:C.border,borderWidth:1,
    borderRadius:16,padding:12,minHeight:81,justifyContent:'space-between'},
  smallButton:{borderRadius:10,borderColor:C.borderActive,borderWidth:1,paddingHorizontal:12,
    paddingVertical:10,minHeight:44,justifyContent:'center'},
  chips:{flexDirection:'row',flexWrap:'wrap',marginVertical:11},
  day:{alignItems:'center',justifyContent:'center',backgroundColor:C.surface,
    borderColor:C.border,borderWidth:1,borderRadius:13,width:62,minHeight:86,marginRight:8,gap:4},
  input:{width:'100%',alignSelf:'stretch',minWidth:0,
    backgroundColor:'#102139',borderColor:'#537197',borderWidth:1,color:C.ink,
    borderRadius:12,minHeight:52,paddingHorizontal:14,paddingVertical:11,
    marginVertical:8,fontSize:16},
  notes:{minHeight:88,textAlignVertical:'top'},
  chart:{height:160,flexDirection:'row',alignItems:'flex-end',marginTop:12},
  barCell:{flex:1,height:140,justifyContent:'flex-end',alignItems:'center',gap:5},
  overlay:{flex:1,backgroundColor:'#030914D9',justifyContent:'flex-end'},
  sheet:{width:'100%',backgroundColor:C.surface,
    borderTopLeftRadius:24,borderTopRightRadius:24,maxHeight:'88%'},
  prereq:{backgroundColor:C.elevated,borderRadius:9,padding:12,marginBottom:8},
});
