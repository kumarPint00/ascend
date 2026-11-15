import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,Animated,AccessibilityInfo,KeyboardAvoidingView,Modal,Platform,Pressable,ScrollView,
  StyleSheet,TextInput,View} from 'react-native';
import {Flag,Swords,CalendarDays,Medal,BarChart3,Settings2,Clock3,
  ChevronRight,ShieldCheck,Lock,CheckCircle2} from 'lucide-react-native';
import type {Quest,Goal,QuestControl,GoalOutcome,SchedulePreferences} from '@ascend/game-engine';
import {ATTRIBUTES,SKILL_NODES,activeMissionList,occurrencesForDays,defaultQuestControl,
  questDueOn,blockedByDependencies,isCompleted,localDayKey,isoWeekKey,
  derivedSkills,derivedAchievements,canUnlockSkill,outcomeProgress,xpTrend,focusMinutesForWeek,
  forecastGoalCompletion,attributeWeekBreakdown,activeDaysInWindow
} from '@ascend/game-engine';
import {Action,Chip,Meter,Panel,Section,T} from '../components/Elements';
import {C,LABELS} from '../theme';
import type {Snapshot} from '../data/repository';
import {completeQuest} from '../data/repository';
import {EMPTY_PHASE_TWO,loadPhaseTwoSnapshot,updateQuestControl,addQuestDependency,
  removeQuestDependency,saveGoalOutcome,createBoss,winBoss,logFocusSession,saveWeeklyReview,
  savePreferences,unlockSkill,type PhaseTwoSnapshot} from '../data/phase2';
import {shareBackupFile,chooseBackupFile,restoreFullBackup} from '../data/backup';
import {askReminderPermission,syncLocalReminders} from './reminders';

type Area='Today'|'Calendar'|'Library'|'Goals'|'Skills'|'Insights'|'Settings';
const AREAS:Area[]=['Today','Calendar','Library','Goals','Skills','Insights','Settings'];
const DAYS=['Su','Mo','Tu','We','Th','Fr','Sa'];
const nextDate=(offset:number)=>{
  const date=new Date();date.setDate(date.getDate()+offset);return localDayKey(date);
};
export function Planner({base,onRefresh}:{base:Snapshot;onRefresh:()=>Promise<void>}){
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
  const [review,setReview]=useState({wins:'',blockers:'',nextFocus:''});
  const [prefs,setPrefs]=useState<SchedulePreferences>(EMPTY_PHASE_TWO.preferences);
  const [backupText,setBackupText]=useState<string|null>(null);
  const [notificationsCount,setNotificationsCount]=useState<number|null>(null);
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

  const refresh=useCallback(async()=>{
    const p=await loadPhaseTwoSnapshot();
    setPhase(p);setPrefs({...p.preferences});
    const thisWeek=p.weeklyReviews.find(x=>x.weekKey===isoWeekKey(new Date()));
    setReview({wins:thisWeek?.wins??'',blockers:thisWeek?.blockers??'',
      nextFocus:thisWeek?.nextFocus??''});
    await onRefresh();
  },[onRefresh]);
  useEffect(()=>{
    let live=true;
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
  const allQuests=base.quests.filter(q=>!q.archived);
  const allGoals=base.goals.filter(g=>!g.archived);
  const today=new Date();
  const due=activeMissionList(allQuests,phase.controls,base.completions,
    phase.dependencies,today,phase.preferences.dailyMissionLimit);
  const active=allQuests.filter(q=>controlFor(q).status==='active');
  const backlog=allQuests.filter(q=>controlFor(q).status==='backlog');
  const paused=allQuests.filter(q=>controlFor(q).status==='paused');
  const calendar=occurrencesForDays(allQuests,phase.controls,base.completions,phase.dependencies,today,14);
  const shown=allQuests.filter(q=>libraryStatus==='All'||controlFor(q).status===libraryStatus)
    .filter(q=>(q.title+' '+q.description).toLowerCase().includes(search.toLowerCase()));
  const skills=derivedSkills(base.xpEvents),achievements=derivedAchievements(
    base.quests,base.completions,base.xpEvents,phase.bosses);
  const trend=xpTrend(base.xpEvents,today,7);
  const trendMax=Math.max(25,...trend.map(x=>x.xp));
  const totalWeekFocus=focusMinutesForWeek(phase.focusSessions,today);
  const weekAttributes=attributeWeekBreakdown(base.xpEvents,today);
  const activeDays=activeDaysInWindow(base.completions,today,7);
  const completedThisWeek=base.completions.filter(c=>isoWeekKey(new Date(c.completedAt))===isoWeekKey(today)).length;

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
  const complete=(q:Quest)=>void run(async()=>{
    const result=await completeQuest(q);
    if(!result.applied)throw Error('Already completed in this period');
  },'Quest cleared. XP recorded without duplicates.');
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
            {done?'CLEARED':c.status.toUpperCase()}
          </T>
          <Pressable onPress={()=>openPlan(quest)} accessibilityRole="button"
            accessibilityLabel={'Plan '+quest.title} style={ss.smallButton}>
            <T color={C.frost} size={11} bold>PLAN</T>
          </Pressable>
        </View>
      </View>
      {c.status==='active'&&!done&&!blocked&&
        <View style={{marginTop:9}}>
          <Action secondary disabled={busy} onPress={()=>complete(quest)}>COMPLETE MISSION</Action>
        </View>}
      {blocked&&<T size={11} color={C.gold} style={{marginTop:8}}>Finish the prerequisite quest to unlock this mission.</T>}
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
      {heading('Today’s focused missions','Only the highest-priority, currently active tasks appear here.')}
      <View style={ss.metrics}>
        <View style={ss.metric}><T color={C.sub} size={10}>TODAY</T><T size={24} bold color={C.energy}>{due.length}</T></View>
        <View style={ss.metric}><T color={C.sub} size={10}>ACTIVE</T><T size={24} bold>{active.length}</T></View>
        <View style={ss.metric}><T color={C.sub} size={10}>BACKLOG</T><T size={24} bold>{backlog.length}</T></View>
      </View>
      {due.length?due.map(q=><QuestRow key={q.id} quest={q} compact/>):
        <Panel><T color={C.green} bold>No missions demanding attention.</T>
          <T size={12} color={C.sub} style={{marginTop:6}}>Activate a task from Library when you're ready.</T></Panel>}
      <Action secondary onPress={()=>setArea('Library')}>MANAGE QUEST LIBRARY</Action>
      <Section title="Up next"/>
      {calendar.slice(1,4).map(day=><Panel key={day.date} style={{padding:12}}>
        <T color={C.sub} size={12}>{day.date}</T>
        <T size={13} bold style={{marginTop:3}}>{day.quests.length} planned quests</T>
      </Panel>)}
    </>}

    {area==='Calendar'&&<>
      {heading('Mission calendar','A rolling 14-day offline plan. Dates are local to your phone.')}
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
      <TextInput value={search} onChangeText={x=>{setSearch(x);setShowCount(18);}}
        placeholder="Search title or description" placeholderTextColor={C.dim}
        accessibilityLabel="Search quest library" style={ss.input}/>
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
        const recorded=m?outcomeProgress(m):Math.min(1,base.completions.filter(c=>
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
          {!m&&(()=>{const f=forecastGoalCompletion(g,base.quests,base.completions,today);
            return f?<T color={C.sub} size={11} style={{marginTop:5}}>
              Trend estimate: {f.projectedDate} at {f.weeklyRate.toFixed(1)} recorded completions/week
            </T>:<T color={C.dim} size={11} style={{marginTop:5}}>Forecast: not enough recent evidence</T>;
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
      {phase.bosses.length?phase.bosses.map(b=><Panel key={b.id}>
        <View style={ss.between}><T size={14} bold style={{flex:1}}>{b.title}</T>
          <T color={b.wonAt?C.green:C.gold} size={11} bold>{b.wonAt?'DEFEATED':'ACTIVE'}</T></View>
        <T color={C.sub} size={12} style={{marginVertical:8}}>{b.description}</T>
        {!b.wonAt&&<Action secondary disabled={busy} onPress={()=>void run(()=>winBoss(b.id),'Boss defeated, victory verified against your goal or quest evidence.')}>
          VERIFY VICTORY
        </Action>}
      </Panel>):<Panel><T color={C.sub}>Create a boss battle from a goal to track a major outcome.</T></Panel>}
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
        <TextInput style={[ss.input,{marginTop:10}]} accessibilityLabel="Focus minutes" keyboardType="number-pad"
          value={focusMinutes} onChangeText={setFocusMinutes} placeholder="Minutes" placeholderTextColor={C.dim}/>
        <Action secondary disabled={busy} onPress={()=>void run(()=>logFocusSession(null,Number(focusMinutes)),'Focus time recorded')}>LOG FOCUS</Action>
      </Panel>
      <Section title={'Weekly review · '+isoWeekKey(today)}/>
      <Panel>
        <T color={C.sub} size={12}>What worked this week?</T>
        <TextInput style={[ss.input,ss.notes]} multiline value={review.wins}
          onChangeText={wins=>setReview(v=>({...v,wins}))} maxLength={1200}
          placeholder="Wins and evidence" placeholderTextColor={C.dim}/>
        <T color={C.sub} size={12}>What got in the way?</T>
        <TextInput style={[ss.input,ss.notes]} multiline value={review.blockers}
          onChangeText={blockers=>setReview(v=>({...v,blockers}))} maxLength={1200}
          placeholder="Blockers without self-blame" placeholderTextColor={C.dim}/>
        <T color={C.sub} size={12}>What will you prioritize next week?</T>
        <TextInput style={[ss.input,ss.notes]} multiline value={review.nextFocus}
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
        <T bold size={16}>Local reminders</T>
        <T color={C.sub} size={12} style={{marginVertical:9}}>Only selected quests with an active reminder time will notify you. No cloud push service.</T>
        <View style={ss.chips}>
          <Chip active={prefs.remindersEnabled} onPress={()=>setPrefs(p=>({...p,remindersEnabled:true}))}>Enabled</Chip>
          <Chip active={!prefs.remindersEnabled} onPress={()=>setPrefs(p=>({...p,remindersEnabled:false}))}>Disabled</Chip>
        </View>
        <T color={C.sub} size={12}>Quiet hours start (HH:mm)</T>
        <TextInput style={ss.input} value={prefs.quietStart}
          onChangeText={quietStart=>setPrefs(p=>({...p,quietStart}))} placeholder="22:00" placeholderTextColor={C.dim}/>
        <T color={C.sub} size={12}>Quiet hours end (HH:mm)</T>
        <TextInput style={ss.input} value={prefs.quietEnd}
          onChangeText={quietEnd=>setPrefs(p=>({...p,quietEnd}))} placeholder="07:00" placeholderTextColor={C.dim}/>
        <Action disabled={busy} onPress={saveSettings}>SAVE & SYNC REMINDERS</Action>
        {notificationsCount!==null&&<T color={C.green} size={11} style={{marginTop:10}}>{notificationsCount} local reminders scheduled for the next 14 days.</T>}
      </Panel>
      <Panel>
        <T bold size={16}>Verified file backups</T>
        <T color={C.sub} size={12} style={{marginVertical:10}}>
          Export quests, XP, goals, planner states, skills, bosses, reviews and focus sessions to an actual JSON file. Save it outside this app.
        </T>
        <Action secondary disabled={busy} onPress={()=>void run(shareBackupFile)}>EXPORT & SHARE BACKUP</Action>
        <View style={{height:10}}/>
        <Action secondary disabled={busy} onPress={()=>{void fromFile();}}>CHOOSE BACKUP TO RESTORE</Action>
        <T color={C.dim} size={11} style={{marginTop:10}}>Restore replaces current data. Choose an external file; don't rely on an internal app folder for disaster recovery.</T>
      </Panel>
    </>}

    </Animated.View>
    <Modal visible={!!editControl&&!!selectedQuest} animationType="slide" transparent
      onRequestClose={()=>{setSelectedQuest(null);setEditControl(null);}}>
      <KeyboardAvoidingView style={ss.overlay} behavior={Platform.OS==='ios'?'padding':undefined}>
        <ScrollView style={ss.sheet} keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:32}}>
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
            <TextInput style={ss.input} value={editControl.dueOn??''} placeholder="YYYY-MM-DD"
              placeholderTextColor={C.dim} onChangeText={dueOn=>setEditControl(v=>v&&({...v,dueOn:dueOn||null}))}/>
            <T size={12} color={C.sub}>Snooze until (optional)</T>
            <TextInput style={ss.input} value={editControl.snoozedUntil??''} placeholder="YYYY-MM-DD"
              placeholderTextColor={C.dim} onChangeText={snoozedUntil=>setEditControl(v=>v&&({...v,snoozedUntil:snoozedUntil||null}))}/>
            <View style={ss.chips}><Chip active={false} onPress={()=>setEditControl(v=>v&&({...v,snoozedUntil:nextDate(1)}))}>Tomorrow</Chip>
              <Chip active={false} onPress={()=>setEditControl(v=>v&&({...v,snoozedUntil:nextDate(7)}))}>Next week</Chip>
              <Chip active={false} onPress={()=>setEditControl(v=>v&&({...v,snoozedUntil:null}))}>Clear</Chip></View>
            <T size={12} color={C.sub}>Reminder time (HH:mm, optional)</T>
            <TextInput style={ss.input} value={editControl.timeOfDay??''} placeholder="09:00"
              placeholderTextColor={C.dim} onChangeText={timeOfDay=>setEditControl(v=>v&&({...v,timeOfDay:timeOfDay||null}))}/>
            <T size={12} color={C.sub}>Estimated minutes</T>
            <TextInput style={ss.input} keyboardType="number-pad" value={String(editControl.estimateMinutes)}
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
      <KeyboardAvoidingView style={ss.overlay} behavior={Platform.OS==='ios'?'padding':undefined}>
        <View style={ss.sheet}>
          <View style={ss.between}><T size={19} bold>Measure progress</T>
            <Pressable onPress={()=>setSelectedGoal(null)}><T color={C.sub}>CLOSE ✕</T></Pressable></View>
          <T color={C.sub} size={13} style={{marginVertical:11}}>{selectedGoal?.title}</T>
          <T size={12} color={C.sub}>Current value</T>
          <TextInput keyboardType="decimal-pad" style={ss.input} value={goalMetric.value}
            onChangeText={value=>setGoalMetric(m=>({...m,value}))}/>
          <T size={12} color={C.sub}>Target</T>
          <TextInput keyboardType="decimal-pad" style={ss.input} value={goalMetric.target}
            onChangeText={target=>setGoalMetric(m=>({...m,target}))}/>
          <T size={12} color={C.sub}>Unit</T>
          <TextInput style={ss.input} value={goalMetric.unit} maxLength={24}
            onChangeText={unit=>setGoalMetric(m=>({...m,unit}))}/>
          <T size={12} color={C.sub}>Deadline (optional, YYYY-MM-DD)</T>
          <TextInput style={ss.input} value={goalMetric.deadline} placeholder="YYYY-MM-DD"
            placeholderTextColor={C.dim} onChangeText={deadline=>setGoalMetric(m=>({...m,deadline}))}/>
          <Action disabled={busy} onPress={saveMetric}>SAVE MEASURABLE OUTCOME</Action>
        </View>
      </KeyboardAvoidingView>
    </Modal>

    <Modal visible={backupText!==null} animationType="fade" transparent onRequestClose={()=>setBackupText(null)}>
      <View style={ss.overlay}><View style={ss.sheet}>
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
    paddingVertical:8,minHeight:38,justifyContent:'center'},
  chips:{flexDirection:'row',flexWrap:'wrap',marginVertical:11},
  day:{alignItems:'center',justifyContent:'center',backgroundColor:C.surface,
    borderColor:C.border,borderWidth:1,borderRadius:13,width:62,minHeight:86,marginRight:8,gap:4},
  input:{backgroundColor:C.elevated,borderColor:C.border,borderWidth:1,color:C.ink,
    borderRadius:11,minHeight:46,paddingHorizontal:13,paddingVertical:10,marginVertical:8,fontSize:14},
  notes:{height:82,textAlignVertical:'top'},
  chart:{height:160,flexDirection:'row',alignItems:'flex-end',marginTop:12},
  barCell:{flex:1,height:140,justifyContent:'flex-end',alignItems:'center',gap:5},
  overlay:{flex:1,backgroundColor:'#030914D9',justifyContent:'flex-end'},
  sheet:{backgroundColor:C.surface,padding:19,borderTopLeftRadius:24,borderTopRightRadius:24,maxHeight:'91%'},
  prereq:{backgroundColor:C.elevated,borderRadius:9,padding:12,marginBottom:8},
});
