import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Animated, AppState, BackHandler, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StatusBar, Vibration,
  StyleSheet, TextInput, View, Image, ActivityIndicator, AccessibilityInfo, Linking, Keyboard,
} from 'react-native';
import {
  ATTRIBUTES, type Attribute, type Difficulty, type RepeatRule, type Goal,
  type Quest, type Completion, derivePlayer, localDayKey, isCompleted,
  completedGoalCount, XP_BY_DIFFICULTY, levelFromXP, rankFromLevel, isMilestoneQuest, MILESTONE_PREFIX,
  parseImportableQuestPack,filterImportItems,type ImportSelection,type ImportableQuestPack,
  activeMissionList,dueMissionList,defaultQuestControl,blockedByDependencies,questDueOn,matchesQuestCadence,
  liteQuestIsAllowed,liteMinutes,
} from '@ascend/game-engine';
import {Action, Chip, Meter, Panel, Section, T} from './components/Elements';
import {LinearGradient} from 'expo-linear-gradient';
import {House, Swords, Flag, CalendarDays, Settings2, Sparkles, Shield, ChevronRight, Search as SearchIcon, UserRound} from 'lucide-react-native';
import {Planner} from './phase2/Planner';
import {HunterWorld,type RenderQuality,type ArmorTheme} from './experience/HunterWorld';
import {JourneyPath} from './experience/JourneyPath';
import {RealmMap,type RealmDestination} from './experience/RealmMap';
import * as SecureStore from 'expo-secure-store';
import {CelestialBackdrop} from './experience/CelestialBackdrop';
import {NanoCoach,type NanoDraft} from './experience/NanoCoach';
import {decideAdaptiveProposal} from './data/adaptive';
import {ConnectHub} from './connect/ConnectHub';
import {pollIncomingShare,listenToIncomingShares,publishHomeWidgets} from '../modules/ascend-context';
import {buildWidgetProjection} from './widgets/snapshot';
import {CinematicReward} from './experience/CinematicReward';
import {exportFullBackup,restoreFullBackup} from './data/backup';
import {syncLocalReminders} from './phase2/reminders';
import {syncMaintenanceRegistration,maintainAppData} from './phase2/maintenance';
import {EMPTY_PHASE_TWO,loadPhaseTwoSnapshot,type PhaseTwoSnapshot} from './data/phase2';
import {C, LABELS} from './theme';
import * as Application from 'expo-application';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useAppUpdates } from './updates/useAppUpdates';
import {
  type Snapshot, type QuestInput, initialize, loadSnapshot, saveQuest, archiveQuest,
  saveGoal, archiveGoal, completeQuest, undoRecentCompletion, wipeAllData, importQuestPack,
} from './data/repository';

type Tab = 'Home' | 'Quests' | 'Goals' | 'Hunter' | 'Progress' | 'Planner' | 'More' | 'Connect' | 'RealmMap';
const TABS = [
  {tab:'Home' as const,label:'REALM',Icon:House},
  {tab:'Quests' as const,label:'MISSIONS',Icon:Swords},
  {tab:'Goals' as const,label:'JOURNEY',Icon:Flag},
  {tab:'Hunter' as const,label:'HUNTER',Icon:UserRound},
  {tab:'More' as const,label:'HUB',Icon:Settings2},
];
const INITIAL_QUEST: QuestInput = {
  title: '', description: '', attribute: 'discipline', difficulty: 'medium',
  repeatRule: 'daily', goalId: null,
};
const EMPTY: Snapshot = {quests:[],goals:[],completions:[],xpEvents:[]};
const fmt = (d:Date) => d.toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'});

export default function App() {
  const updates = useAppUpdates();
  const [data,setData] = useState<Snapshot>(EMPTY);
  const [phaseSummary,setPhaseSummary] = useState<PhaseTwoSnapshot>(EMPTY_PHASE_TWO);
  const [plannerTarget,setPlannerTarget] = useState<string|null>(null);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [keyboardVisible,setKeyboardVisible]=useState(false);
  useEffect(()=>{
    const shown=Keyboard.addListener('keyboardDidShow',()=>setKeyboardVisible(true));
    const hidden=Keyboard.addListener('keyboardDidHide',()=>setKeyboardVisible(false));
    return ()=>{shown.remove();hidden.remove();};
  },[]);
  const [tab,setTab] = useState<Tab>('Home');
  const [clock,setClock] = useState(() => new Date());
  const [questModal,setQuestModal] = useState(false);
  const [editingQuest,setEditingQuest] = useState<Quest|null>(null);
  const [questForm,setQuestForm] = useState<QuestInput>(INITIAL_QUEST);
  const [goalModal,setGoalModal] = useState(false);
  const [editingGoal,setEditingGoal] = useState<Goal|null>(null);
  const [goalTitle,setGoalTitle] = useState('');
  const [goalAttribute,setGoalAttribute] = useState<Attribute>('discipline');
  const [goalTarget,setGoalTarget] = useState('20');
  const [backup,setBackup] = useState<string|null>(null);
  const [restoreText,setRestoreText] = useState<string|null>(null);
  const [questPackText,setQuestPackText] = useState<string|null>(null);
  const [importPreview,setImportPreview] = useState<ImportableQuestPack|null>(null);
  const [importSections,setImportSections] = useState<ImportSelection>({goals:true,quests:true,milestones:true});
  const [expandedGoals,setExpandedGoals] = useState<Record<string,boolean>>({});
  const [roadmapShown,setRoadmapShown] = useState<Record<string,number>>({});
  const [questFilter,setQuestFilter] = useState<'Today'|'Daily'|'Weekly'|'Monthly'|'Milestones'|'Pending'|'Done'|'All'>('Daily');
  const [questSearch,setQuestSearch] = useState('');
  const [questLimit,setQuestLimit] = useState(20);
  const [goalLimit,setGoalLimit] = useState(8);
  const [goalSearch,setGoalSearch] = useState('');
  const [reduceMotion,setReduceMotion] = useState(false);
  const [quality,setQuality] = useState<RenderQuality>('balanced');
  const [armor,setArmor] = useState<ArmorTheme>('azure');
  const [widgetsEnabled,setWidgetsEnabled] = useState(true);
  const [widgetTitles,setWidgetTitles] = useState(false);
  const [widgetPrefsReady,setWidgetPrefsReady] = useState(false);
  useEffect(()=>{
    void Promise.all([
      SecureStore.getItemAsync('ascend.widgets.enabled'),
      SecureStore.getItemAsync('ascend.widgets.titles')
    ]).then(([enabled,titles])=>{
      setWidgetsEnabled(enabled!=='false');
      setWidgetTitles(titles==='true');
    }).catch(()=>{}).finally(()=>setWidgetPrefsReady(true));
  },[]);
  const setWidgetPreference=(name:'enabled'|'titles',value:boolean)=>{
    if(name==='enabled')setWidgetsEnabled(value);else setWidgetTitles(value);
    void SecureStore.setItemAsync('ascend.widgets.'+name,String(value)).catch(()=>{});
  };
  useEffect(()=>{
    const openWidgetLink=(url:string|null|undefined)=>{
      const match=/^ascendrpg:\/\/widget\/(home|quests|hunter|planner|progress)(?:[?#]|$)/i.exec(url??'');
      if(!match)return;
      const route=match[1].toLowerCase();
      const dest:Tab=route==='quests'?'Quests':route==='hunter'?'Hunter':
        route==='planner'?'Planner':route==='progress'?'Progress':'Home';
      setTab(dest);
    };
    void Linking.getInitialURL().then(openWidgetLink).catch(()=>{});
    const sub=Linking.addEventListener('url',event=>openWidgetLink(event.url));
    return ()=>sub.remove();
  },[]);
  useEffect(()=>{void SecureStore.getItemAsync('ascend.reforged.graphics').then(v=>{
    if(v==='immersive'||v==='balanced'||v==='battery')setQuality(v);
  }).catch(()=>{});},[]);
  useEffect(()=>{void SecureStore.getItemAsync('ascend.reforged.armor').then(v=>{
    if(v==='azure'||v==='royal'||v==='ember')setArmor(v);
  }).catch(()=>{});},[]);
  const chooseArmor=(v:ArmorTheme)=>{
    setArmor(v);void SecureStore.setItemAsync('ascend.reforged.armor',v).catch(()=>{});
  };
  const chooseQuality=(v:RenderQuality)=>{
    setQuality(v);void SecureStore.setItemAsync('ascend.reforged.graphics',v).catch(()=>{});
  };
  const [nanoVisible,setNanoVisible] = useState(false);
  const [nanoContextIntent,setNanoContextIntent]=useState<string|null>(null);
  const [incomingShare,setIncomingShare]=useState<string|null>(null);
  const [reward,setReward] = useState<{xp:number;levelUp:boolean;rankUp:boolean;newLevel:number;newRank:string}|null>(null);
  useEffect(()=>{
    const subscription=BackHandler.addEventListener('hardwareBackPress',()=>{
      if(nanoVisible){setNanoVisible(false);return true;}
      if(tab==='Connect'){setTab('More');return true;}
      if(tab!=='Home'){setTab('Home');return true;}
      return false;
    });
    return ()=>subscription.remove();
  },[tab,nanoVisible]);
  const rewardPulse = useRef(new Animated.Value(0)).current;
  const pagePulse = useRef(new Animated.Value(1)).current;
  useEffect(()=>{
    pagePulse.stopAnimation();
    if(reduceMotion||quality==='battery'){pagePulse.setValue(1);return;}
    pagePulse.setValue(0);
    Animated.timing(pagePulse,{toValue:1,duration:245,useNativeDriver:true}).start();
  },[tab,reduceMotion,quality,pagePulse]);
  useEffect(()=>{let live=true;AccessibilityInfo.isReduceMotionEnabled().then(v=>{if(live)setReduceMotion(v);}).catch(()=>{});const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduceMotion);return ()=>{live=false;sub.remove();};},[]);

  const refresh = useCallback(async () => {
    const [snapshot,planner]=await Promise.all([loadSnapshot(),loadPhaseTwoSnapshot()]);
    setData(snapshot);setPhaseSummary(planner);setClock(new Date());
  },[]);
  useEffect(()=>{
    let live = true;
    (async () => {
      try { await initialize(); if (live) await refresh();
        void syncMaintenanceRegistration().catch(()=>{});
        void maintainAppData().catch(()=>{});
      }
      catch(e) { Alert.alert('Cannot load ASCEND',String(e)); }
      finally { if (live) setLoading(false); }
    })();
    return () => {live=false;};
  },[refresh]);
  useEffect(()=>{
    const sub=AppState.addEventListener('change',state=>{
      if(state==='active'){
        void refresh().catch(()=>{});
        void maintainAppData().catch(()=>{});
      }
    });
    return ()=>sub.remove();
  },[refresh]);

  useEffect(()=>{
    let mounted=true;
    const checkShare=async()=>{
      try{
        const shared=await pollIncomingShare();
        if(mounted&&shared.trim()){
          setIncomingShare(shared);setTab('Connect');
        }
      }catch{}
    };
    void checkShare();
    const shareListener=listenToIncomingShares(text=>{
      if(mounted){setIncomingShare(text);setTab('Connect');}
    });
    const sub=AppState.addEventListener('change',state=>{
      if(state==='active')void checkShare();
    });
    return ()=>{mounted=false;sub.remove();shareListener.remove();};
  },[]);
  const selectQuestPackFile=async()=>{
    try{
      const selection=await DocumentPicker.getDocumentAsync({type:'*/*',copyToCacheDirectory:true});
      if(selection.canceled)return;
      const file=selection.assets[0];
      if(!file)return;
      if(file.size!==undefined&&file.size>100_000)throw new Error('Quest pack file is too large (100 KB limit)');
      const contents=await FileSystem.readAsStringAsync(file.uri);
      const parsed=parseImportableQuestPack(contents);
      setQuestPackText(contents);
      setImportPreview(parsed);
      setImportSections({goals:true,quests:true,milestones:true});
    }catch(e){Alert.alert('Cannot open quest pack',e instanceof Error?e.message:String(e));}
  };

  const run = async (work:()=>Promise<void>) => {
    if(busy)return;
    setBusy(true);
    try {await work(); await refresh();}
    catch(e){Alert.alert('Action failed',e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  };
  useEffect(()=>{
    if(loading||!phaseSummary.preferences.remindersEnabled)return;
    // Reconcile only after real data changes; this also removes reminders
    // for quests completed through the Home or Quests tabs.
    void syncLocalReminders({
      quests:data.quests,completions:data.completions,controls:phaseSummary.controls,
      dependencies:phaseSummary.dependencies,preferences:phaseSummary.preferences,
    }).catch(()=>{});
  },[loading,data,phaseSummary]);
  useEffect(()=>{
    if(loading||!widgetPrefsReady)return;
    const projection=buildWidgetProjection(data,phaseSummary,new Date(),widgetsEnabled,widgetTitles);
    void publishHomeWidgets(JSON.stringify(projection)).catch(e=>{
      if(__DEV__)console.warn('[ASCEND/widgets] widget publication unavailable',e);
    });
  },[loading,widgetPrefsReady,widgetsEnabled,widgetTitles,data,phaseSummary]);
  const player = useMemo(()=>derivePlayer(data.xpEvents),[data.xpEvents]);
  const quests=useMemo(()=>data.quests.filter(q=>!q.archived),[data.quests]);
  const goals=useMemo(()=>data.goals.filter(g=>!g.archived),[data.goals]);
  const day=localDayKey(clock);
  const completedToday=useMemo(()=>data.completions.filter(c=>
    localDayKey(new Date(c.completedAt))===day),[data.completions,day]);
  const todayXP=useMemo(()=>data.xpEvents.filter(e=>e.dayKey===day)
    .reduce((a,e)=>a+e.amount,0),[data.xpEvents,day]);
  const completed=(q:Quest)=>isCompleted(q,data.completions,clock);
  const activeQuests=useMemo(()=>quests.filter(q=>
    (phaseSummary.controls[q.id]?.status??defaultQuestControl(q).status)==='active'&&
    (q.repeatRule!=='once'||!isCompleted(q,data.completions,clock))),
    [quests,phaseSummary.controls,data.completions,clock]);
  const pending=useMemo(()=>activeQuests.filter(q=>!isCompleted(q,data.completions,clock)),
    [activeQuests,data.completions,clock]);
  // All eligible quests remain visible in Today. The focused slice stays
  // limited for Home, reminders and low-pressure suggestions.
  const dueToday=useMemo(()=>dueMissionList(quests,phaseSummary.controls,
    data.completions,phaseSummary.dependencies,clock),
    [quests,phaseSummary.controls,data.completions,phaseSummary.dependencies,clock]);
  const todayBoard=useMemo(()=>activeMissionList(quests,phaseSummary.controls,data.completions,
    phaseSummary.dependencies,clock,phaseSummary.preferences.dailyMissionLimit),
    [quests,phaseSummary.controls,data.completions,phaseSummary.dependencies,clock,
      phaseSummary.preferences.dailyMissionLimit]);
  const focusIds=useMemo(()=>new Set(todayBoard.map(q=>q.id)),[todayBoard]);
  const dailyDue=useMemo(()=>dueToday.filter(q=>q.repeatRule==='daily'),[dueToday]);
  const otherDue=useMemo(()=>dueToday.filter(q=>q.repeatRule!=='daily'),[dueToday]);
  const dueTodayIds=useMemo(()=>new Set(dueToday.map(q=>q.id)),[dueToday]);
  const filteredQuests=useMemo(()=>quests.filter(q=>{
    const match=(q.title+' '+q.description).toLowerCase().includes(questSearch.trim().toLowerCase());
    if(!match)return false;
    const done=isCompleted(q,data.completions,clock);
    if(questFilter==='Today')return dueTodayIds.has(q.id);
    if(questFilter==='Daily'||questFilter==='Weekly'||questFilter==='Monthly')
      return matchesQuestCadence(q,questFilter);
    if(questFilter==='Milestones')return isMilestoneQuest(q)&&!done;
    if(questFilter==='Pending')return !done;
    if(questFilter==='Done')return done;
    return true;
  }),[quests,questSearch,questFilter,data.completions,clock,dueTodayIds,phaseSummary.controls]);
  const filteredGoals=useMemo(()=>goals.filter(g=>g.title.toLowerCase()
    .includes(goalSearch.trim().toLowerCase())),[goals,goalSearch]);

  const openQuest = (q?:Quest,goalId?:string) => {
    setEditingQuest(q??null);
    setQuestForm(q?{
      title:q.title, description:q.description, attribute:q.attribute,
      difficulty:q.difficulty, repeatRule:q.repeatRule, goalId:q.goalId,
    }:{...INITIAL_QUEST,goalId:goalId??null});
    setQuestModal(true);
  };
  const openGoal=(g?:Goal)=>{
    setEditingGoal(g??null); setGoalTitle(g?.title??'');
    setGoalAttribute(g?.attribute??'discipline');setGoalTarget(String(g?.targetCount??20));
    setGoalModal(true);
  };
  const finish=(q:Quest,mode:'standard'|'lite'='standard')=>run(async()=>{
    const reward=await completeQuest(q,new Date(),mode);
    if(reward.applied) {
      if(!reduceMotion) Vibration.vibrate(13);
      const newLevel=levelFromXP(player.totalXP+reward.xp);
      const levelUp=newLevel>player.level,newRank=rankFromLevel(newLevel);
      const rankUp=newRank!==player.rank;
      setReward({xp:reward.xp,levelUp,rankUp,newLevel,newRank});
      rewardPulse.stopAnimation(); rewardPulse.setValue(0);
      Animated.sequence([
        Animated.spring(rewardPulse,{toValue:1,
          tension:reduceMotion?1000:85,friction:reduceMotion?1000:8,useNativeDriver:true}),
        Animated.delay(reduceMotion?700:rankUp?2100:levelUp?1650:900),
        Animated.timing(rewardPulse,{toValue:0,duration:reduceMotion?0:250,useNativeDriver:true}),
      ]).start(()=>setReward(null));
    }
  });

  const QuestCard=({quest,editable=false}:{quest:Quest;editable?:boolean})=>{
    const done=completed(quest);
    const status=phaseSummary.controls[quest.id]?.status??defaultQuestControl(quest).status;
    const blocked=blockedByDependencies(quest,phaseSummary.dependencies,data.completions);
    const due=questDueOn(quest,phaseSummary.controls[quest.id]??defaultQuestControl(quest),clock);
    return <Panel style={{padding:13,opacity:done ? 0.8 : 1}}>
      <View style={s.between}>
        <View style={{flex:1,marginRight:10}}>
          <T size={15} bold color={done?C.sub:C.ink}>{isMilestoneQuest(quest)?quest.title.slice(MILESTONE_PREFIX.length):quest.title}</T>
          {!!quest.description && <T size={12} color={C.sub} numberOfLines={2} style={{marginTop:4}}>{quest.description}</T>}
        </View>
        <View style={[s.reward,{borderColor:done?C.green:C.energy}]}>
          <T color={done?C.green:C.energy} bold size={12}>{done?'✓':`+${XP_BY_DIFFICULTY[quest.difficulty]}`}</T>
          <T color={C.dim} size={9}>{done?'Done':'XP'}</T>
        </View>
      </View>
      <View style={[s.between,{marginTop:12,flexWrap:'wrap',gap:9}]}>
        <T color={LABELS[quest.attribute].tint} size={11} style={{flexShrink:1,minWidth:120}}>
          {isMilestoneQuest(quest)?'◆ Milestone · ':''}{LABELS[quest.attribute].glyph} {LABELS[quest.attribute].label} · {quest.difficulty} · {quest.repeatRule.toUpperCase()} · ~{phaseSummary.controls[quest.id]?.estimateMinutes??25}m
        </T>
        <View style={{flexDirection:'row',gap:9,alignItems:'center',flexWrap:'wrap',justifyContent:'flex-end'}}>
          {editable&& <Pressable accessibilityRole="button" onPress={()=>openQuest(quest)}><T color={C.sub} size={12}>Edit</T></Pressable>}
          {editable&& <Pressable accessibilityRole="button" onPress={()=>Alert.alert('Archive quest?', 'Your XP history stays intact.',[
            {text:'Cancel',style:'cancel'}, {text:'Archive',style:'destructive',onPress:()=>run(()=>archiveQuest(quest.id))},
          ])}><T color={C.danger} size={12}>Archive</T></Pressable>}
          {done&&data.completions.some(c=>c.questId===quest.id&&
            Date.now()-Date.parse(c.completedAt)>=0&&Date.now()-Date.parse(c.completedAt)<600_000)&&
            <Pressable accessibilityRole="button" accessibilityLabel={'Undo completion of '+quest.title}
              disabled={busy} style={[s.finish,{backgroundColor:C.elevated}]}
              onPress={()=>Alert.alert('Undo quest completion?',
                'This removes the completion and its awarded XP. This cannot be reversed.',[
                  {text:'Cancel',style:'cancel'},
                  {text:'Undo',style:'destructive',onPress:()=>void run(async()=>{
                    await undoRecentCompletion(quest.id);
                  })},
                ])}>
              <T color={C.frost} bold size={12}>UNDO</T>
            </Pressable>}
          {!done&&due&&!blocked&&<Pressable accessibilityRole="button" disabled={busy} style={s.finish} onPress={()=>finish(quest)}>
            <T color={C.bg} bold size={12}>COMPLETE</T>
          </Pressable>}
          {!done&&(!due||blocked)&&<Pressable accessibilityRole="button" onPress={()=>{setPlannerTarget(quest.id);setTab('Planner');}}>
            <T color={blocked?C.gold:C.sub} size={11}>{blocked?'LOCKED':status==='active'?'SCHEDULED':'PLAN / ACTIVATE'}</T>
          </Pressable>}
        </View>
      </View>
      {!done&&due&&!blocked&&liteQuestIsAllowed(quest)&&
        (phaseSummary.controls[quest.id]?.estimateMinutes??25)>5&&
        !phaseSummary.bosses.some(b=>b.questId===quest.id&&!b.wonAt)&&
        <View style={{marginTop:9}}>
          <Action secondary disabled={busy} onPress={()=>Alert.alert('Lite alternative',
            'A smaller genuine version of this recurring quest awards up to 10 XP and counts only once this period.',[
              {text:'Cancel',style:'cancel'},
              {text:'I completed Lite',onPress:()=>void finish(quest,'lite')},
            ])}>
            LITE TODAY · ~{liteMinutes(phaseSummary.controls[quest.id]?.estimateMinutes??25)} MIN · ≤10 XP
          </Action>
        </View>}
    </Panel>;
  };

  const Home=()=> <>
    <View style={s.worldHero}>
      <HunterWorld key={'home:'+player.rank+':'+armor} active={tab==='Home'} reduceMotion={reduceMotion} quality={quality}
        height={quality==='battery'?300:340} rank={player.rank} level={player.level} armor={armor}/>
      <View pointerEvents="none" style={s.worldCaption}>
        <View style={{flexDirection:'row',alignItems:'center',gap:7}}>
          <View style={s.liveDot}/>
          <T size={10} bold color="#A8E4FF" style={{letterSpacing:2.5}}>YOUR REALM · REFORGED</T>
        </View>
        <T size={29} bold color="#FFFFFF" style={{letterSpacing:-1.2,marginTop:5}}>LEVEL {player.level}</T>
        <T size={12} bold color={C.gold} style={{letterSpacing:1.5}}>
          {player.rank}-RANK · THE ARCHITECT
        </T>
      </View>
      <View style={s.worldFooter}>
        <View style={{flex:1,marginRight:10}}>
          <T size={10} bold color="#A2CAE7" style={{letterSpacing:1.5}}>YOUR NEXT ASCENSION</T>
          <View style={{marginTop:7}}><Meter value={player.progress} height={9}/></View>
          <T size={11} color={C.sub} style={{marginTop:6}}>
            {player.currentLevelXP} / {player.xpForNextLevel} XP · {player.totalXP.toLocaleString()} earned
          </T>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Explore your animated character"
          onPress={()=>setTab('Hunter')} style={s.worldButton}>
          <ChevronRight size={23} color={C.frost}/>
        </Pressable>
      </View>
    </View>
    <View style={s.quickBar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Open today's planner"
        style={s.quickAction} onPress={()=>setTab('Planner')}>
        <CalendarDays size={20} color={C.energy}/>
        <T bold color={C.frost} size={11}>TODAY</T>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Create a new quest"
        style={s.quickAction} onPress={()=>openQuest()}>
        <Swords size={20} color={C.green}/>
        <T bold color={C.frost} size={11}>NEW QUEST</T>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Ask the Oracle"
        style={s.quickAction} onPress={()=>setNanoVisible(true)}>
        <Sparkles size={20} color={C.violet}/>
        <T bold color={C.frost} size={11}>ORACLE</T>
      </Pressable>
    </View>
    <View style={{marginBottom:16}}>
      <Action secondary onPress={()=>setTab('RealmMap')}>EXPLORE SANCTUARY GATES</Action>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Open Gemini Nano Quest Architect"
      onPress={()=>setNanoVisible(true)} style={{marginBottom:18}}>
      <LinearGradient colors={['#352653','#20294A','#14253C']} start={{x:0,y:0}}
        end={{x:1,y:1}} style={s.oracleCard}>
        <View style={s.oracleOrb}><Sparkles size={26} color="#F4D5FF"/></View>
        <View style={{flex:1}}>
          <T color="#E7C8FF" size={10} bold style={{letterSpacing:2}}>THE ORACLE / LEARNING ARCHITECT</T>
          <T size={17} bold style={{marginTop:2}}>Build your learning roadmap</T>
          <T size={11} color={C.sub} style={{marginTop:3}}>
            Generate 30, 60 or 90 days of daily tasks, weekly goals and monthly achievements.
          </T>
        </View>
        <ChevronRight size={20} color="#D7BAFF"/>
      </LinearGradient>
    </Pressable>
    <View style={s.statRow}>
      <Panel style={[s.miniPanel]}>
        <T color={C.sub} size={10} bold style={{letterSpacing:1.4}}>QUESTS CLEARED</T>
        <T bold size={26} color={C.green}>{completedToday.length}</T>
        <T color={C.dim} size={10}>today</T>
      </Panel>
      <Panel style={[s.miniPanel]}>
        <T color={C.sub} size={10} bold style={{letterSpacing:1.4}}>ACTIVE MISSIONS</T>
        <T bold size={26} color={C.energy}>{dueToday.length}</T>
        <T color={C.dim} size={10}>ready for you</T>
      </Panel>
    </View>
    <Section title="Daily Missions"
      right={<Pressable accessibilityRole="button" onPress={()=>{setQuestFilter('Daily');setTab('Quests');}}>
        <T color={C.energy} size={11} bold>OPEN BOARD ›</T>
      </Pressable>}/>
    {dailyDue.length===0?<Panel>
      <T color={C.green} size={17} bold>Daily routine clear ✦</T>
      <T color={C.sub} size={12} style={{marginTop:7}}>No daily missions are due. Weekly and monthly quests remain separate.</T>
    </Panel>:dailyDue.slice(0,4).map(q=><QuestCard key={q.id} quest={q}/>)}
    {dailyDue.length>4&&<View style={{marginTop:5,marginBottom:14}}>
      <Action secondary onPress={()=>{setQuestFilter('Daily');setTab('Quests');}}>
        VIEW ALL {dailyDue.length} DAILY MISSIONS
      </Action>
    </View>}
    {otherDue.length>0&&<>
      <Section title="Other Missions Due Today"
        right={<Pressable accessibilityRole="button" onPress={()=>{setQuestFilter('Today');setTab('Quests');}}>
          <T color={C.energy} size={11} bold>VIEW ALL ›</T>
        </Pressable>}/>
      <T size={11} color={C.sub} style={{marginBottom:10}}>
        Weekly, monthly and one-time tasks due today. They are not daily habits.
      </T>
      {otherDue.slice(0,3).map(q=><QuestCard key={q.id} quest={q}/>)}
    </>}
    <View style={{marginTop:14,marginBottom:14}}>
      <Action onPress={()=>openQuest()} secondary>＋ FORGE A NEW QUEST</Action>
    </View>
    <Section title="Epic Questlines"
      right={<Pressable accessibilityRole="button" onPress={()=>setTab('Goals')}>
        <T color={C.energy} size={11} bold>ALL GOALS ›</T>
      </Pressable>}/>
    {goals.length===0?<Panel>
      <T color={C.sub}>No active questlines. Begin with one meaningful goal.</T>
      <View style={{marginTop:12}}><Action onPress={()=>openGoal()} secondary>CREATE YOUR FIRST GOAL</Action></View>
    </Panel>:goals.slice(0,2).map(g=><GoalCard key={g.id} goal={g}/>)}
  </>;

  const Quests=()=> <>
    <Section title="Mission Board" right={<Action onPress={()=>openQuest()} style={{paddingHorizontal:13}}>+ QUEST</Action>}/>
    <Panel style={{borderColor:'#537CA7'}}>
      <T size={10} bold color={C.energy} style={{letterSpacing:1.8}}>TODAY'S COMPLETIONS · ALL FREQUENCIES</T>
      <View style={[s.between,{marginTop:7,marginBottom:9}]}>
        <T color={C.frost} size={22} bold>{completedToday.length} missions cleared</T>
        <T color={C.gold} size={12} bold>+{todayXP} XP</T>
      </View>
      <Meter value={completedToday.length/Math.max(1,completedToday.length+todayBoard.length)}
        height={9} tint={C.green}/>
      <T size={11} color={C.sub} style={{marginTop:8}}>
        {todayBoard.length} missions on today's board. Recovery and rest remain valid choices.
      </T>
    </Panel>
    <T color={C.sub} size={13} style={{marginBottom:12}}>
      Daily, Weekly and Monthly display the saved recurrence type. Today shows
      all tasks actually due on this date, including weekly or monthly tasks scheduled for today.
      Your focus limit of {phaseSummary.preferences.dailyMissionLimit} only limits suggestions.
    </T>
    <View style={s.searchRow}>
      <SearchIcon color={C.sub} size={17}/>
      <TextInput accessibilityLabel="Search quests" placeholder="Find a quest, skill, or project" placeholderTextColor={C.dim}
        value={questSearch} onChangeText={x=>{setQuestSearch(x);setQuestLimit(20);}}
        autoCorrect={false} style={s.searchInput}/>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={{paddingRight:15,paddingBottom:4}} style={{maxHeight:58}}>
      {(['Today','Daily','Weekly','Monthly','Milestones','Pending','Done','All'] as const).map(f=>
        <Chip key={f} active={questFilter===f} onPress={()=>{setQuestFilter(f);setQuestLimit(20);}}>{f}</Chip>)}
    </ScrollView>
    <View style={[s.between,{marginTop:3,marginBottom:12}]}>
      <T color={C.sub} size={12}>{filteredQuests.length} {filteredQuests.length===1?'mission':'missions'}</T>
      <T color={C.dim} size={11}>{questFilter==='Today'?todayBoard.length+' suggested focus · all due frequencies':
        questFilter==='Daily'?'Daily recurrence only':questFilter==='Weekly'?'Weekly recurrence only':
        questFilter==='Monthly'?'Monthly recurrence only':questFilter==='Milestones'?'One-time objectives':'Your board'}</T>
    </View>
    {filteredQuests.slice(0,questLimit).map(q=><View key={q.id}>
      {questFilter==='Today'&&focusIds.has(q.id)&&<T color={C.energy} size={10} bold style={{marginLeft:8,marginBottom:3}}>FOCUS PICK</T>}
      <QuestCard quest={q} editable/>
    </View>)}
    {filteredQuests.length>questLimit&&<Action secondary onPress={()=>setQuestLimit(x=>x+20)} style={{marginBottom:15}}>
      SHOW MORE ({filteredQuests.length-questLimit} LEFT)
    </Action>}
    {filteredQuests.length===0&&<Panel>
      <T color={C.green} size={16} bold>{questFilter==='Today'?'No due quests right now':'No matching missions'}</T>
      <T color={C.sub} size={13} style={{marginTop:5}}>Try another filter or create a quest that matters today.</T>
      <View style={{marginTop:12}}><Action secondary onPress={()=>openQuest()}>CREATE QUEST</Action></View>
    </Panel>}
    <T color={C.dim} size={11}>One-off milestones are available under Goals. Archived quests remain in your history.</T>
  </>;

  const GoalCard=({goal}:{goal:Goal})=>{
    const count=completedGoalCount(goal.id,data.quests,data.completions);
    const milestones=quests.filter(q=>q.goalId===goal.id&&isMilestoneQuest(q));
    const roadmapDays=quests.filter(q=>q.goalId===goal.id&&
      q.id.startsWith('pack:roadmap-')&&/^Day \d+ · /.test(q.title))
      .sort((a,b)=>{
        const n=(q:Quest)=>Number(q.title.match(/^Day (\d+)/)?.[1]??0);
        return n(a)-n(b);
      });
    const cleared=milestones.filter(completed).length;
    return <Panel>
      <View style={s.between}>
        <View style={{flex:1}}><T bold size={15}>{goal.title}</T>
          <T color={LABELS[goal.attribute].tint} size={12} style={{marginTop:5}}>{LABELS[goal.attribute].glyph} {LABELS[goal.attribute].label}</T>
        </View>
        <T color={C.energy} bold size={14}>{count} / {goal.targetCount}</T>
      </View>
      <View style={{marginTop:12}}><Meter value={count/goal.targetCount} tint={C.violet}/></View>
      {milestones.length>0&&<View style={{marginTop:13}}>
        <Pressable accessibilityRole="button" onPress={()=>setExpandedGoals(v=>({...v,[goal.id]:!v[goal.id]}))}>
          <T color={C.energy} size={12} bold>◆ Milestones {cleared}/{milestones.length} · {expandedGoals[goal.id]?'Hide':'View'}</T>
        </Pressable>
        {!!expandedGoals[goal.id]&&<>
          <JourneyPath
            steps={milestones.map(m=>{
              const blocked=blockedByDependencies(m,phaseSummary.dependencies,data.completions);
              const due=questDueOn(m,phaseSummary.controls[m.id]??defaultQuestControl(m),clock);
              return {id:m.id,title:m.title.slice(MILESTONE_PREFIX.length),
                description:m.description,done:completed(m),blocked,ready:due&&!blocked};
            })}
            onActivate={id=>{const selected=milestones.find(m=>m.id===id);if(selected)void finish(selected);}}
            onPlan={id=>{setPlannerTarget(id);setTab('Planner');}}
          />
          {roadmapDays.length>0&&<View style={{marginTop:18}}>
            <T size={13} color={C.energy} bold>DAILY LEARNING ROADMAP</T>
            <T color={C.sub} size={11} style={{marginTop:6,marginBottom:12}}>
              {roadmapDays.filter(completed).length}/{roadmapDays.length} dated achievements cleared.
              These appear in Today when due, not as repeating daily habits.
            </T>
            {roadmapDays.slice(0,roadmapShown[goal.id]??7).map(q=>
              <QuestCard key={q.id} quest={q}/>)}
            {roadmapDays.length>(roadmapShown[goal.id]??7)&&
              <Action secondary onPress={()=>setRoadmapShown(v=>({
                ...v,[goal.id]:(v[goal.id]??7)+7
              }))}>SHOW NEXT 7 DAYS</Action>}
          </View>}
        </>}
      </View>}
      <View style={[s.between,{marginTop:13}]}>
        <Pressable onPress={()=>openGoal(goal)}><T color={C.sub} size={12}>Edit goal</T></Pressable>
        <Pressable onPress={()=>openQuest(undefined,goal.id)}><T color={C.energy} size={12}>+ Link a quest</T></Pressable>
        <Pressable onPress={()=>Alert.alert('Archive goal?', 'Associated quests are kept, but the goal will be hidden.',[
          {text:'Cancel',style:'cancel'},{text:'Archive',style:'destructive',onPress:()=>run(()=>archiveGoal(goal.id))}
        ])}><T color={C.danger} size={12}>Archive</T></Pressable>
      </View>
    </Panel>;
  };
  const Goals=()=> <>
    <Section title="Journey Map" right={<Action onPress={()=>openGoal()} style={{paddingHorizontal:12}}>+ GOAL</Action>}/>
    <T color={C.sub} size={13} style={{marginBottom:12}}>Every milestone advances your journey. Locked paths require their actual prerequisites, never invented progress.</T>
    <View style={s.searchRow}>
      <SearchIcon color={C.sub} size={17}/>
      <TextInput accessibilityLabel="Search goals" placeholder="Find a goal or project" placeholderTextColor={C.dim}
        value={goalSearch} onChangeText={x=>{setGoalSearch(x);setGoalLimit(8);}}
        autoCorrect={false} style={s.searchInput}/>
    </View>
    <T color={C.dim} size={12} style={{marginBottom:12}}>{filteredGoals.length} active questlines</T>
    {filteredGoals.length===0?<Panel><T color={C.sub}>No goals found. Add a new questline or change the search.</T></Panel>:
      filteredGoals.slice(0,goalLimit).map(g=><GoalCard key={g.id} goal={g}/>)}
    {filteredGoals.length>goalLimit&&<Action secondary onPress={()=>setGoalLimit(x=>x+8)}>
      SHOW MORE ({filteredGoals.length-goalLimit} LEFT)
    </Action>}
  </>;

  const Hunter=()=> <>
    <HunterWorld key={'hunter:'+player.rank+':'+armor} active={tab==='Hunter'} reduceMotion={reduceMotion} quality={quality}
      height={390} rank={player.rank} level={player.level} armor={armor} inspect/>
    <Panel style={{alignItems:'center',paddingVertical:21}}>
      <T color={C.gold} size={10} bold style={{letterSpacing:2.5}}>YOUR HUNTER IDENTITY</T>
      <T size={28} bold style={{marginTop:7}}>Rank {player.rank} · Level {player.level}</T>
      <T size={12} color={C.sub} style={{marginTop:7}}>{player.totalXP.toLocaleString()} lifetime XP</T>
      <View style={{width:'100%',marginTop:14}}>
        <Meter value={player.progress} tint={C.energy} height={10}/>
      </View>
      <T color={C.dim} size={11} style={{marginTop:12,textAlign:'center'}}>
        Your original illustrated Hunter animates when motion is enabled. Aura styles are cosmetic; XP determines rank.
      </T>
    </Panel>
    <Panel>
      <T color={C.energy} bold size={13}>HUNTER EQUIPMENT</T>
      <T size={12} color={C.sub} style={{marginTop:7}}>
        {player.level>=10?'Ascended core awakened · ':'Standard armor · '}
        {player.level>=5?'Energy blade unlocked':'Energy blade unlocks at level 5'}.
        Visual rewards reflect recorded XP, not actual physical strength.
      </T>
    </Panel>
    <Panel>
      <T color={C.energy} bold size={13}>EQUIPMENT STYLE</T>
      <T color={C.sub} size={11} style={{marginVertical:9}}>
        Choose your armor aura. This changes only the visual appearance, not XP or rank.
      </T>
      <View style={{flexDirection:'row',flexWrap:'wrap'}}>
        {(['azure','royal','ember'] as ArmorTheme[]).map(style=>
          <Chip key={style} active={armor===style} onPress={()=>chooseArmor(style)}>
            {style.toUpperCase()}
          </Chip>)}
      </View>
    </Panel>
    <Section title="Character Attributes"/>
    {ATTRIBUTES.map(a=><Panel key={a}>
      <View style={s.between}>
        <T bold size={14}>{LABELS[a].glyph}  {LABELS[a].label}</T>
        <T color={LABELS[a].tint} bold>{player.attributes[a]} XP</T>
      </View>
      <View style={{marginTop:12}}>
        <Meter tint={LABELS[a].tint} value={(player.attributes[a] % 300)/300}/>
      </View>
      <T color={C.dim} size={10} style={{marginTop:8}}>
        Your actual activity, not an estimate of innate ability.
      </T>
    </Panel>)}
  </>;

  const Progress=()=>{
    const days=Array.from({length:7},(_,i)=>{
      const d=new Date(clock.getFullYear(),clock.getMonth(),clock.getDate()-(6-i),12);
      const key=localDayKey(d);
      return {key,label:d.toLocaleDateString(undefined,{weekday:'short'}),
        xp:data.xpEvents.filter(e=>e.dayKey===key).reduce((n,e)=>n+e.amount,0)};
    });
    const max=Math.max(50,...days.map(x=>x.xp));
    return <>
      <Section title="Hunter Intelligence"/>
    <Panel>
      <T color={C.energy} bold size={11} style={{letterSpacing:1.4}}>PROGRESS SNAPSHOT</T>
      <T size={15} bold style={{marginTop:7}}>{completedToday.length} completed today · {todayXP} XP earned</T>
      <T size={11} color={C.sub} style={{marginTop:7}}>
        This shows recorded actions, not a judgment of health, talent or personal value.
      </T>
    </Panel>
      <View style={s.statRow}>
        <Panel style={[s.miniPanel]}><T size={11} color={C.sub}>LIFETIME XP</T><T bold size={25}>{player.totalXP}</T></Panel>
        <Panel style={[s.miniPanel]}><T size={11} color={C.sub}>TOTAL COMPLETIONS</T><T bold size={25}>{data.completions.length}</T></Panel>
      </View>
      <Panel>
        <T bold size={16}>Last 7 days</T>
        <T color={C.sub} size={12} style={{marginTop:5}}>XP earned each day</T>
        <View style={s.chart}>
          {days.map(d=><View key={d.key} style={s.barCell}>
            <T color={C.sub} size={10}>{d.xp}</T>
            <View style={[s.bar,{height:Math.max(3,Math.round(d.xp/max*116)),backgroundColor:d.key===day?C.energy:C.violet}]}/>
            <T color={C.dim} size={10}>{d.label}</T>
          </View>)}
        </View>
      </Panel>
      <Panel>
        <T bold size={16}>What the numbers mean</T>
        <T color={C.sub} size={13} style={{marginTop:7}}>
          XP is a gamified consistency signal. Measure meaningful outcomes separately: completed projects, fitness milestones, learning results and financial habits.
        </T>
      </Panel>
    </>;
  };

  const More=()=> <>
    <Section title="Command Hub"/>
    <Panel>
      <T bold color={C.energy} size={15}>QUICK NAVIGATION</T>
      <View style={{flexDirection:'row',gap:9,marginTop:12,flexWrap:'wrap'}}>
        <Action secondary onPress={()=>setTab('Planner')}>OPEN PLANNER</Action>
        <Action secondary onPress={()=>setTab('Progress')}>VIEW INSIGHTS</Action>
        <Action secondary onPress={()=>setNanoVisible(true)}>ASK ORACLE</Action>
      </View>
    </Panel>
    <Panel>
      <T bold color={C.energy} size={15}>GRAPHICS & MOTION</T>
      <T size={12} color={C.sub} style={{marginVertical:8}}>
        Visual quality is stored on this device. Battery mode freezes the 3D scene.
        Android reduced-motion preference always takes priority.
      </T>
      <View style={{flexDirection:'row',flexWrap:'wrap'}}>
        {(['immersive','balanced','battery'] as RenderQuality[]).map(mode=>
          <Chip key={mode} active={quality===mode} onPress={()=>chooseQuality(mode)}>
            {mode.toUpperCase()}
          </Chip>)}
      </View>
    </Panel>
    <Panel>
      <T bold size={15} color={C.energy}>ANDROID HOME WIDGETS</T>
      <T size={12} color={C.sub} style={{marginTop:7,marginBottom:9}}>
        Four resizable widgets: Daily Quests, Hunter Status, Focus Planner and
        Progress. Long-press an empty area of your Android home screen,
        open Widgets, and select ASCEND.
      </T>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:9}}>
        <Action secondary onPress={()=>setWidgetPreference('enabled',!widgetsEnabled)}>
          {widgetsEnabled?'PAUSE WIDGETS':'ENABLE WIDGETS'}
        </Action>
        <Action secondary onPress={()=>setWidgetPreference('titles',!widgetTitles)}>
          {widgetTitles?'HIDE QUEST TITLES':'SHOW QUEST TITLES'}
        </Action>
      </View>
      <T size={11} color={C.sub}>
        {widgetsEnabled?'Widgets update when ASCEND syncs your local progress.':'Widget data is paused.'}
        {' '}Quest names are {widgetTitles?'visible on your home screen':'hidden by default'}.
        All widget taps open ASCEND for verified actions; widgets never award XP.
      </T>
    </Panel>
    <Section title="System Settings"/>
    <Panel>
      <T size={15} bold color={C.energy}>ASCEND Connect · Personal Context Hub</T>
      <T size={12} color={C.sub} style={{marginTop:8}}>
        Link approved sources, import selected ChatGPT conversations, review shared messages,
        sync Health Connect or read-only Google and GitHub data. Sensitive context stays
        encrypted and separate from your plaintext progress backup.
      </T>
      <View style={{marginTop:12}}>
        <Action onPress={()=>setTab('Connect')}>OPEN MY CONNECTIONS</Action>
      </View>
    </Panel>
    <Panel>
      <T bold>Offline mode is active</T>
      <T color={C.sub} size={13} style={{marginTop:8}}>Your data is stored in the SQLite database on this phone. No account, paid cloud service or internet connection is required.</T>
    </Panel>
    <Panel>
      <T bold>Application updates</T>
      <T color={C.sub} size={13} style={{marginTop:8}}>
        Installed version: {Application.nativeApplicationVersion ?? '?'} ({Application.nativeBuildVersion ?? '?'})
      </T>
      <T color={C.sub} size={13} style={{marginTop:8}}>
        {updates.available
          ? 'Version ' + updates.available.version + ' available (' +
            Math.round(updates.available.sizeBytes/1048576) + ' MB). Install over the existing app to keep local progress.'
          : 'ASCEND checks official GitHub Releases. Compatible updates keep your quests and XP.'}
      </T>
      <View style={{marginTop:12}}>
        <Action secondary disabled={updates.status!=='idle'} onPress={()=>{void updates.check(true);}}>
          {updates.status==='checking'?'CHECKING...':'CHECK FOR UPDATES'}
        </Action>
      </View>
      {updates.available && <View style={{marginTop:10}}>
        <Action disabled={updates.status!=='idle'} onPress={()=>Alert.alert('Update ASCEND?',
          'Download and install v' + updates.available!.version + '? Android will ask you to confirm.',[
          {text:'Cancel',style:'cancel'}, {text:'Download & update',onPress:()=>{void updates.install();}},
        ])}>
          {updates.status==='downloading'?'DOWNLOADING APK...':
            updates.status==='installing'?'OPENING INSTALLER...':'DOWNLOAD & UPDATE'}
        </Action>
      </View>}
      {updates.error && <T color={C.danger} size={11} style={{marginTop:9}}>{updates.error}</T>}
    </Panel>
    <Panel>
      <T bold>Partial JSON import</T>
      <T color={C.sub} size={13} style={{marginTop:8}}>
        Import goals only, quests only, milestones only, or all three.
        Choose sections after preview. Repeating the same packId and keys
        skips existing entries without changing your XP or edits. Your JSON stays on this device.
      </T>
      <View style={{marginTop:13}}><Action secondary onPress={()=>{void selectQuestPackFile();}}>CHOOSE JSON FILE</Action></View>
      <View style={{marginTop:9}}><Action secondary onPress={()=>{setQuestPackText('');setImportPreview(null);setImportSections({goals:true,quests:true,milestones:true});}}>PASTE PARTIAL JSON</Action></View>
    </Panel>
    <Panel>
      <T bold>Export your data</T>
      <T color={C.sub} size={13} style={{marginTop:8}}>Export a full v4 plaintext progress backup including planner, skills and reviews. Private Connect data is NOT included; export it separately using a password in My Connections.</T>
      <View style={{marginTop:13}}><Action secondary onPress={()=>run(async()=>setBackup(await exportFullBackup()))}>VIEW BACKUP JSON</Action></View>
      <View style={{marginTop:10}}><Action secondary onPress={()=>setRestoreText('')}>RESTORE SAVED JSON</Action></View>
    </Panel>
    <Panel>
      <T bold color={C.danger}>Reset all local data</T>
      <T color={C.sub} size={13} style={{marginTop:8}}>Irreversibly deletes quests, goals, XP and all local encrypted Connect data from this device.</T>
      <View style={{marginTop:13}}><Action danger onPress={()=>Alert.alert('Delete your progress?', 'This action cannot be undone. Export a backup first.',[
        {text:'Cancel',style:'cancel'}, {text:'Delete everything',style:'destructive',onPress:()=>run(wipeAllData)},
      ])}>RESET PROFILE</Action></View>
    </Panel>
    <T color={C.dim} size={11}>ASCEND v{Application.nativeApplicationVersion ?? '0.3.0'} · Local-first · No advertisements or paid APIs</T>
  </>;

  if(loading) return <View style={[s.root,{justifyContent:'center',alignItems:'center'}]}>
    <Image source={require('../assets/icon.png')} style={{width:112,height:112,borderRadius:27,marginBottom:20}}/>
    <T size={25} bold style={{letterSpacing:4}}>ASCEND</T>
    <T size={12} color={C.sub} style={{marginTop:7,letterSpacing:1}}>A REAL-LIFE LEVELING SYSTEM</T>
    <ActivityIndicator color={C.energy} size="small" style={{marginTop:26}}/>
  </View>;
  return <View style={s.root}>
    <StatusBar barStyle="light-content"/>
    <CelestialBackdrop reduceMotion={reduceMotion}/>
    <View style={s.top}>
      <View style={{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:10}}>
        <LinearGradient colors={['#344D7C','#172340']} style={s.brand}>
          <Sparkles size={20} color={C.energy}/>
        </LinearGradient>
        <View style={{flex:1,minWidth:0}}>
          <T color={C.frost} size={17} bold numberOfLines={1}
            style={{letterSpacing:2.3}}>ASCEND</T>
          <T color={C.sub} size={10} numberOfLines={1}
            style={{letterSpacing:.2}}>CHRONICLES · {fmt(clock)}</T>
        </View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={updates.available?'Update available, open settings':'Open hunter profile'}
        onPress={()=>setTab(updates.available?'More':tab==='Hunter'?'Home':'Hunter')} style={s.levelPill}>
        <Shield color={C.gold} size={15}/>
        <T color={updates.available?C.green:C.gold} bold size={11}>
          {updates.available?'UPDATE':'LV '+player.level}
        </T>
      </Pressable>
    </View>
    <Animated.ScrollView style={{flex:1,opacity:pagePulse,
      transform:[{translateY:pagePulse.interpolate({inputRange:[0,1],outputRange:[14,0]})}]}}
      contentContainerStyle={s.content} keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag">
      {tab==='RealmMap'?<RealmMap rank={player.rank} level={player.level}
        onBack={()=>setTab('Home')}
        onTravel={(dest:RealmDestination)=>dest==='Oracle'?setNanoVisible(true):setTab(dest)}/>:
        tab==='Home'?<Home/>:tab==='Quests'?<Quests/>:tab==='Goals'?<Goals/>:tab==='Hunter'?<Hunter/>:tab==='Progress'?<Progress/>:tab==='Planner'?<Planner base={data} onRefresh={refresh} initialQuestId={plannerTarget} onTargetConsumed={()=>setPlannerTarget(null)}/>:tab==='Connect'?<ConnectHub onBack={()=>setTab('More')} initialShare={incomingShare} onShareConsumed={()=>setIncomingShare(null)}
         onAnalyzeWithAI={excerpt=>{setNanoContextIntent(excerpt);setNanoVisible(true);}}/>:<More/>}
    </Animated.ScrollView>
    {reward&&<CinematicReward reward={reward} pulse={rewardPulse}
      reduceMotion={reduceMotion}/>}
    {!keyboardVisible&&<View style={s.nav}>
      {TABS.map(t=>{const NavIcon=t.Icon;const active=tab===t.tab;return <Pressable
        accessibilityRole="tab" accessibilityLabel={t.label}
        accessibilityState={{selected:active}} key={t.tab}
        style={[s.navTab,active&&{backgroundColor:'#25466B',borderColor:'#89D7F0'}]}
        onPress={()=>setTab(t.tab)}>
        <NavIcon size={20} color={active?C.energy:C.sub} strokeWidth={active?2.6:1.7}/>
        <T size={9} bold={active} color={active?C.frost:C.sub}
          numberOfLines={1} style={{textAlign:'center'}}>{t.label}</T>
      </Pressable>;})}
    </View>}
    <NanoCoach visible={nanoVisible} initialIntent={nanoContextIntent}
      onClose={()=>{setNanoVisible(false);setNanoContextIntent(null);}}
      recentQuestTitles={data.quests.filter(q=>!q.archived).slice(0,5).map(q=>q.title)}
      onAcceptRoadmap={async(packJson:string)=>{
        const result=await importQuestPack(packJson,
          {goals:true,quests:true,milestones:true},{activateDatedOneOffs:true});
        await refresh();
        setQuestSearch('');
        setQuestLimit(20);
        setGoalLimit(8);
        setTab('Goals');
        Alert.alert('Roadmap created',
          result.goalsAdded+' goal, '+result.questsAdded+' dated daily achievements and '+
          result.milestonesAdded+' weekly/monthly checkpoints added. '+
          result.skipped+' already imported items were safely skipped. '+
          'Open Journey for the full roadmap and Today for tasks due now. No XP was awarded.');
      }}
      onAccept={async(draft:NanoDraft)=>{
        // Generated content always enters the same bounded, transactional
        // approval path as rule-based suggestions; never activates quests.
        const key=(draft.kind+':'+draft.title.toLocaleLowerCase()).split('').reduce(
          (hash,char)=>(Math.imul(hash,31)+char.charCodeAt(0))>>>0,2166136261);
        await decideAdaptiveProposal({
          id:'nano:'+key.toString(36),kind:draft.kind,sourceId:'nano:manual',
          title:draft.title,description:draft.description,
          reason:'User explicitly requested and reviewed a local AI draft.',
          attribute:draft.attribute,goalId:null,difficulty:draft.difficulty,
          repeatRule:draft.repeatRule,estimateMinutes:draft.minutes,
          status:'backlog',evidence:{basis:'user-preference',periodDays:0,
            opportunities:0,completed:0,ratio:0},
        },'accepted',{title:draft.title,minutes:draft.minutes,
          goalTargetCount:draft.targetCount});
        await refresh();
        setQuestSearch('');
        setQuestLimit(20);
        setQuestFilter('All');
        setTab('Quests');
        Alert.alert('Draft saved to Backlog',
          'Your AI-generated quest is saved but not active. Open Planner → Quest library to activate or schedule it.');
      }}/>

    <Modal visible={questModal} animationType="slide" transparent onRequestClose={()=>setQuestModal(false)}>
      <KeyboardAvoidingView style={s.modalBackdrop} behavior={Platform.OS==='ios'?'padding':undefined}>
        <ScrollView style={s.modalSheet} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
            contentContainerStyle={{padding:20,paddingBottom:40}}>
          <View style={s.between}><T size={20} bold>{editingQuest?'Edit Quest':'New Quest'}</T><Pressable accessibilityRole="button" accessibilityLabel="Close dialog" hitSlop={8} onPress={()=>setQuestModal(false)}><T color={C.sub}>Close ✕</T></Pressable></View>
          <T color={C.sub} style={{marginTop:18,marginBottom:7}}>Quest title</T>
          <TextInput accessibilityLabel="Quest title" maxLength={100} placeholder="e.g. Practice system design" placeholderTextColor={C.dim} value={questForm.title}
            onChangeText={title=>setQuestForm(f=>({...f,title}))} style={s.input}/>
          <T color={C.sub} style={{marginTop:14,marginBottom:7}}>Description (optional)</T>
          <TextInput accessibilityLabel="Quest description and success criteria" maxLength={500} placeholder="What does success look like?" placeholderTextColor={C.dim}
            multiline value={questForm.description} onChangeText={description=>setQuestForm(f=>({...f,description}))}
            style={[s.input,{height:72,textAlignVertical:'top'}]}/>
          <T color={C.sub} style={s.formLabel}>Attribute</T>
          <View style={s.chips}>{ATTRIBUTES.map(a=><Chip key={a} active={questForm.attribute===a}
            onPress={()=>setQuestForm(f=>({...f,attribute:a}))}>{LABELS[a].glyph} {LABELS[a].label}</Chip>)}</View>
          <T color={C.sub} style={s.formLabel}>Difficulty</T>
          <View style={s.chips}>{(['easy','medium','hard'] as Difficulty[]).map(d=><Chip key={d}
            active={questForm.difficulty===d} onPress={()=>setQuestForm(f=>({...f,difficulty:d}))}>
              {d.toUpperCase()} · {XP_BY_DIFFICULTY[d]} XP</Chip>)}</View>
          <T color={C.sub} style={s.formLabel}>Repeat</T>
          <View style={s.chips}>{(['once','daily','weekly','monthly'] as RepeatRule[]).map(r=><Chip key={r}
            active={questForm.repeatRule===r} onPress={()=>setQuestForm(f=>({...f,repeatRule:r}))}>{r}</Chip>)}</View>
          {goals.length>0&&<><T color={C.sub} style={s.formLabel}>Link to goal</T>
            <View style={s.chips}><Chip active={!questForm.goalId} onPress={()=>setQuestForm(f=>({...f,goalId:null}))}>None</Chip>
            {goals.map(g=><Chip key={g.id} active={questForm.goalId===g.id}
              onPress={()=>setQuestForm(f=>({...f,goalId:g.id}))}>{g.title}</Chip>)}</View></>}
          <Action disabled={busy} style={{marginTop:15}} onPress={()=>run(async()=>{
            const kind=questForm.repeatRule;
            await saveQuest(questForm,editingQuest?.id);
            setQuestModal(false);
            setQuestSearch('');
            setQuestLimit(20);
            // Always reveal the saved item, even if Today is at its focus cap
            // or the quest has a future schedule, backlog status or dependency.
            setQuestFilter(kind==='daily'?'Daily':kind==='weekly'?'Weekly':kind==='monthly'?'Monthly':'All');
            setTab('Quests');
          })}>SAVE QUEST</Action>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
    <Modal visible={goalModal} animationType="slide" transparent onRequestClose={()=>setGoalModal(false)}>
      <KeyboardAvoidingView style={s.modalBackdrop} behavior={Platform.OS==='ios'?'padding':undefined}>
        <ScrollView style={s.modalSheet} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
            contentContainerStyle={{padding:20,paddingBottom:40}}>
          <View style={s.between}><T size={20} bold>{editingGoal?'Edit Goal':'New Questline'}</T><Pressable accessibilityRole="button" accessibilityLabel="Close dialog" hitSlop={8} onPress={()=>setGoalModal(false)}><T color={C.sub}>Close ✕</T></Pressable></View>
          <T color={C.sub} style={s.formLabel}>Goal title</T>
          <TextInput accessibilityLabel="Goal title" value={goalTitle} onChangeText={setGoalTitle} maxLength={100}
            placeholder="e.g. Develop consistent strength training" placeholderTextColor={C.dim} style={s.input}/>
          <T color={C.sub} style={s.formLabel}>Attribute</T>
          <View style={s.chips}>{ATTRIBUTES.map(a=><Chip key={a} active={goalAttribute===a}
            onPress={()=>setGoalAttribute(a)}>{LABELS[a].label}</Chip>)}</View>
          <T color={C.sub} style={s.formLabel}>Target linked quest completions</T>
          <TextInput accessibilityLabel="Target quest completions" keyboardType="number-pad" value={goalTarget} onChangeText={setGoalTarget} style={s.input}/>
          <T color={C.dim} size={11} style={{marginTop:8}}>This is a practice target. Record real outcome metrics and history in Planner → Goals.</T>
          <Action disabled={busy} style={{marginTop:20}} onPress={()=>run(async()=>{
            await saveGoal({title:goalTitle,attribute:goalAttribute,targetCount:Number(goalTarget)},editingGoal?.id);
            setGoalModal(false);
          })}>SAVE QUESTLINE</Action>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
    <Modal visible={questPackText!==null} animationType="slide" transparent
      onRequestClose={()=>{setQuestPackText(null);setImportPreview(null);}}>
      <KeyboardAvoidingView style={s.modalBackdrop} behavior={Platform.OS==='ios'?'padding':undefined}>
        <ScrollView style={[s.modalSheet,{maxHeight:'88%'}]}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
            contentContainerStyle={{padding:20,paddingBottom:40}}>
          <View style={s.between}>
            <T size={18} bold>Import goals / quests / milestones</T>
            <Pressable accessibilityRole="button" accessibilityLabel="Close import"
              hitSlop={10} onPress={()=>{setQuestPackText(null);setImportPreview(null);}}>
              <T color={C.sub}>Close ✕</T>
            </Pressable>
          </View>
          <T color={C.sub} size={12} style={{marginTop:12,marginBottom:8}}>
            Paste an object containing any of goals, quests, or milestones arrays.
            packId defaults to "personal"; reuse it for staged imports. All imports
            are additive, don't award XP, and won't overwrite existing items.
          </T>
          <TextInput accessibilityLabel="Private partial quest JSON" multiline
            value={questPackText??''}
            onChangeText={value=>{setQuestPackText(value);setImportPreview(null);}}
            placeholder='{"goals":[{"key":"fitness","title":"Build stamina"}]}'
            placeholderTextColor={C.dim}
            style={[s.input,{height:195,fontSize:12,textAlignVertical:'top'}]}/>
          <View style={{marginTop:10,flexDirection:'row',flexWrap:'wrap',gap:8}}>
            <Action secondary onPress={()=>{
              setQuestPackText(JSON.stringify({
                format:'ascend-partial-pack',schemaVersion:1,packId:'my-plan',
                goals:[{key:'learning',title:'Build a learning habit',attribute:'intelligence',targetCount:12}],
                quests:[{key:'daily-practice',title:'Practice for 20 minutes',
                  goalKey:'learning',difficulty:'easy',repeatRule:'daily'}],
                milestones:[{key:'checkpoint',title:'Complete the first learning milestone',
                  goalKey:'learning',dueOn:'2026-12-31'}]
              },null,2));
              setImportPreview(null);
            }}>INSERT EXAMPLE</Action>
            <Action disabled={busy||!questPackText?.trim()}
              onPress={()=>{
                try{
                  const parsed=parseImportableQuestPack(questPackText!);
                  setImportPreview(parsed);
                  setImportSections({goals:true,quests:true,milestones:true});
                }catch(e){
                  setImportPreview(null);
                  Alert.alert('Invalid JSON import',e instanceof Error?e.message:String(e));
                }
              }}>VALIDATE & PREVIEW</Action>
          </View>
          {importPreview&&<>
            <Panel style={{marginTop:13}}>
              <T color={C.energy} bold size={14}>{importPreview.title}</T>
              <T color={C.sub} size={11} style={{marginTop:5}}>
                ID: {importPreview.packId} · Select which sections to add.
              </T>
              <View style={[s.chips,{marginTop:12}]}>
                {([
                  {key:'goals' as const,label:'GOALS',count:importPreview.goals.length},
                  {key:'quests' as const,label:'QUESTS',count:importPreview.quests.filter(q=>q.kind==='quest').length},
                  {key:'milestones' as const,label:'MILESTONES',count:importPreview.quests.filter(q=>q.kind==='milestone').length},
                ]).map(g=><Chip key={g.key}
                  active={importSections[g.key]}
                  onPress={()=>setImportSections(old=>({...old,[g.key]:!old[g.key]}))}>
                  {g.label+' ('+g.count+')'}
                </Chip>)}
              </View>
              <T color={C.frost} size={12} bold>Items in selected sections</T>
              {filterImportItems(importPreview,importSections).goals.slice(0,15).map(goal=>
                <T key={'g:'+goal.key} color={C.sub} size={11} style={{marginTop:6}}>
                  GOAL · {goal.title} · {goal.targetCount} completions
                </T>)}
              {filterImportItems(importPreview,importSections).quests.slice(0,25).map(quest=>
                <T key={'q:'+quest.key} color={C.sub} size={11} style={{marginTop:6}}>
                  {quest.kind==='milestone'?'MILESTONE':'QUEST'} · {quest.title}
                  {quest.goalKey?' → '+quest.goalKey:quest.goalTitle?' → '+quest.goalTitle:''}
                  {quest.dueOn?' · '+quest.dueOn:''}
                </T>)}
              {(filterImportItems(importPreview,importSections).goals.length>15||
                filterImportItems(importPreview,importSections).quests.length>25)&&
                <T color={C.sub} size={11} style={{marginTop:8}}>
                  More validated items will also be imported from the selected sections.
                </T>}
              <T size={11} color={C.gold} style={{marginTop:12}}>
                References to goalKey must exist in this pack or in a previous
                import with the same packId. goalTitle can link to one existing
                unarchived goal. Missing or ambiguous links cancel the entire import.
              </T>
            </Panel>
            <Action disabled={busy||filterImportItems(importPreview,importSections).goals.length+
                  filterImportItems(importPreview,importSections).quests.length===0}
              style={{marginTop:13}} onPress={()=>{
                const filtered=filterImportItems(importPreview,importSections);
                const milestones=filtered.quests.filter(q=>q.kind==='milestone').length;
                const count=filtered.quests.length-milestones;
                const selectedSource=questPackText;
                const selectedSections={...importSections};
                if(!selectedSource)return;
                Alert.alert('Import selected items?',
                  filtered.goals.length+' goals, '+count+' quests, '+milestones+
                  ' milestones. Existing items, completions and XP are preserved.',[
                  {text:'Cancel',style:'cancel'},
                  {text:'Import selected',onPress:()=>run(async()=>{
                    const result=await importQuestPack(selectedSource,selectedSections);
                    setQuestPackText(null);setImportPreview(null);
                    setQuestSearch('');setQuestLimit(20);setQuestFilter('All');
                    setTab('Quests');
                    Alert.alert('Partial import complete',
                      result.goalsAdded+' goals, '+result.questsAdded+' quests, '+
                      result.milestonesAdded+' milestones added. '+result.skipped+
                      ' existing items skipped. Existing XP preserved.');
                  })}
                ]);
              }}>IMPORT SELECTED SECTIONS</Action>
          </>}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
    <Modal visible={restoreText!==null} animationType="slide" transparent onRequestClose={()=>setRestoreText(null)}>
      <KeyboardAvoidingView style={s.modalBackdrop} behavior={Platform.OS==='ios'?'padding':undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
          style={[s.modalSheet,{maxHeight:'83%'}]}
          contentContainerStyle={{padding:20,paddingBottom:45}}>
        <View style={s.between}><T size={19} bold>Restore your saved progress</T>
          <Pressable accessibilityRole="button" accessibilityLabel="Close dialog" hitSlop={8} onPress={()=>setRestoreText(null)}><T color={C.sub}>Close ✕</T></Pressable></View>
        <T color={C.sub} size={12} style={{marginVertical:12}}>
          Paste ASCEND backup JSON. Restoring REPLACES all existing quests and XP on this phone.
        </T>
        <TextInput accessibilityLabel="Restore backup JSON" multiline value={restoreText??''} onChangeText={setRestoreText}
          placeholder="Paste ASCEND backup JSON here" placeholderTextColor={C.dim}
          style={[s.input,{height:250,fontSize:11,textAlignVertical:'top'}]}/>
        <View style={{marginTop:13}}><Action danger disabled={busy||!restoreText?.trim()}
          onPress={()=>Alert.alert('Replace all local progress?',
            'Save a copy of current data first. This operation cannot be undone.',[
              {text:'Cancel',style:'cancel'},
              {text:'Restore',style:'destructive',onPress:()=>run(async()=>{
                await restoreFullBackup(restoreText!);
                setRestoreText(null);
              })},
            ])}>RESTORE BACKUP</Action></View>
      </ScrollView></KeyboardAvoidingView>
    </Modal>
    <Modal visible={backup!==null} animationType="fade" transparent onRequestClose={()=>setBackup(null)}>
      <View style={s.modalBackdrop}><View style={[s.modalSheet,{maxHeight:'83%',padding:20}]}>
        <View style={s.between}><T size={19} bold>Copy your backup</T><Pressable accessibilityRole="button" accessibilityLabel="Close dialog" hitSlop={8} onPress={()=>setBackup(null)}><T color={C.sub}>Close ✕</T></Pressable></View>
        <T color={C.sub} size={12} style={{marginVertical:12}}>Select all text, copy, and save it somewhere safe. This is NOT an automatic backup.</T>
        <TextInput accessibilityLabel="Read-only backup JSON" multiline selectTextOnFocus value={backup??''} style={[s.input,{height:310,fontSize:11,textAlignVertical:'top'}]} />
        <View style={{marginTop:13}}><Action secondary onPress={()=>setBackup(null)}>DONE</Action></View>
      </View></View>
    </Modal>
  </View>;
}

const s=StyleSheet.create({
  root:{flex:1,backgroundColor:C.bg},
  brand:{width:42,height:42,borderRadius:14,borderWidth:1,borderColor:'#587BAC',
    alignItems:'center',justifyContent:'center'},
  worldHero:{marginBottom:14},
  quickBar:{flexDirection:'row',gap:10,marginBottom:17},
  quickAction:{flex:1,minWidth:0,minHeight:72,borderRadius:16,borderWidth:1,
    borderColor:'#4B6D9B',backgroundColor:'#132844',alignItems:'center',
    justifyContent:'center',gap:7},
  worldCaption:{backgroundColor:'#101C34',borderRadius:17,borderWidth:1,
    borderColor:'#355B86',paddingHorizontal:17,paddingVertical:15,marginBottom:10},
  worldFooter:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',
    padding:15,backgroundColor:'#0D1D34',borderRadius:17,
    borderWidth:1,borderColor:'#355B86'},
  worldButton:{width:45,height:45,borderRadius:15,
    borderWidth:1,borderColor:'#70BCDE',backgroundColor:'#18466B',
    alignItems:'center',justifyContent:'center'},
  liveDot:{height:7,width:7,borderRadius:5,backgroundColor:'#79EFDF'},
  oracleCard:{borderRadius:22,borderWidth:1,borderColor:'#8266AF',
    flexDirection:'row',alignItems:'center',gap:12,padding:15},
  oracleOrb:{height:52,width:52,borderRadius:18,
    backgroundColor:'#574482',borderWidth:1,borderColor:'#AC8BCE',
    alignItems:'center',justifyContent:'center'},
  top:{paddingTop:Platform.OS==='android'?(StatusBar.currentHeight??26)+10:50,
    paddingHorizontal:18,paddingBottom:12,
    flexDirection:'row',alignItems:'center',justifyContent:'space-between',
    borderBottomWidth:1,borderColor:'#384567',backgroundColor:'#080F20EC'},
  levelPill:{flexShrink:0,marginLeft:8,paddingHorizontal:11,paddingVertical:10,
    borderColor:'#907443',borderWidth:1,borderRadius:14,backgroundColor:'#292738',
    flexDirection:'row',alignItems:'center',gap:6,minHeight:44},
  content:{paddingHorizontal:16,paddingTop:15,paddingBottom:44},
  hero:{borderRadius:25,borderWidth:1,borderColor:'#5D7EB7',padding:20,marginBottom:15,overflow:'hidden'},
  searchRow:{flexDirection:'row',gap:10,alignItems:'center',backgroundColor:C.elevated,borderColor:C.border,borderWidth:1,borderRadius:13,paddingHorizontal:13,marginBottom:13,minHeight:48},
  searchInput:{flex:1,minWidth:0,color:C.ink,fontSize:16,minHeight:50,paddingVertical:10},
  between:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  statRow:{flexDirection:'row',gap:12,alignItems:'stretch',marginTop:3,marginBottom:8},
  miniPanel:{flex:1,minWidth:0,minHeight:107,justifyContent:'space-between',gap:4},
  reward:{borderWidth:1,borderRadius:11,paddingHorizontal:9,paddingVertical:5,alignItems:'center',minWidth:48},
  finish:{backgroundColor:C.energy,borderRadius:9,paddingHorizontal:12,paddingVertical:9,minHeight:44,justifyContent:'center'},
  rankEmblem:{height:85,width:80,borderColor:'#927547',borderWidth:1,borderRadius:20,justifyContent:'center',alignItems:'center',backgroundColor:'#252B3E'},
  chips:{flexDirection:'row',flexWrap:'wrap',marginBottom:7},
  avatar:{height:105,width:105,borderRadius:52,borderWidth:1,borderColor:C.energy,backgroundColor:C.elevated,alignItems:'center',justifyContent:'center'},
  chart:{marginTop:14,height:162,flexDirection:'row',alignItems:'flex-end'},
  barCell:{flex:1,height:150,alignItems:'center',justifyContent:'flex-end',gap:6},
  bar:{width:'62%',borderRadius:5,minHeight:3},
  rewardToast:{position:'absolute',zIndex:10,top:125,alignSelf:'center',alignItems:'center',backgroundColor:'#1C2948',borderWidth:1,borderColor:C.energy,borderRadius:17,paddingHorizontal:25,paddingVertical:16,shadowColor:C.energy,shadowRadius:14,shadowOpacity:.5,elevation:12},
  nav:{flexDirection:'row',borderTopWidth:1,borderColor:'#476991',
    backgroundColor:'#08172BF5',paddingBottom:Platform.OS==='ios'?20:12,
    paddingTop:10,paddingHorizontal:8,gap:4},
  navTab:{flex:1,alignItems:'center',justifyContent:'center',gap:5,paddingVertical:7,
    borderWidth:1,borderColor:'transparent',borderRadius:17,minHeight:59},
  modalBackdrop:{flex:1,backgroundColor:'#030914D9',justifyContent:'flex-end'},
  modalSheet:{width:'100%',backgroundColor:C.surface,borderTopLeftRadius:24,
    borderTopRightRadius:24,maxHeight:'86%'},
  input:{width:'100%',alignSelf:'stretch',minWidth:0,borderWidth:1,
    borderColor:'#537197',borderRadius:12,backgroundColor:'#102139',color:C.ink,
    paddingVertical:11,paddingHorizontal:14,fontSize:16,minHeight:52},
  formLabel:{marginTop:19,marginBottom:9},
});
