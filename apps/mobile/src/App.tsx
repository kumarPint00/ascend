import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Animated, AppState, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StatusBar,
  StyleSheet, TextInput, View, Image, ActivityIndicator, AccessibilityInfo,
} from 'react-native';
import {
  ATTRIBUTES, type Attribute, type Difficulty, type RepeatRule, type Goal,
  type Quest, type Completion, derivePlayer, localDayKey, isCompleted,
  completedGoalCount, XP_BY_DIFFICULTY, levelFromXP, isMilestoneQuest, MILESTONE_PREFIX, parseQuestPack,
} from '@ascend/game-engine';
import {Action, Chip, Meter, Panel, Section, T} from './components/Elements';
import {LinearGradient} from 'expo-linear-gradient';
import {House, Swords, Flag, ChartColumn, Settings2, Sparkles, Shield, ChevronRight, Search as SearchIcon, UserRound} from 'lucide-react-native';
import {C, LABELS} from './theme';
import * as Application from 'expo-application';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useAppUpdates } from './updates/useAppUpdates';
import {
  type Snapshot, type QuestInput, initialize, loadSnapshot, saveQuest, archiveQuest,
  saveGoal, archiveGoal, completeQuest, exportJSON, restoreJSON, wipeAllData, importQuestPack,
} from './data/repository';

type Tab = 'Home' | 'Quests' | 'Goals' | 'Hunter' | 'Progress' | 'More';
const TABS = [
  {tab:'Home' as const, Icon:House},
  {tab:'Quests' as const, Icon:Swords},
  {tab:'Goals' as const, Icon:Flag},
  {tab:'Progress' as const, Icon:ChartColumn},
  {tab:'More' as const, Icon:Settings2},
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
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
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
  const [expandedGoals,setExpandedGoals] = useState<Record<string,boolean>>({});
  const [questFilter,setQuestFilter] = useState<'Today'|'Weekly'|'Milestones'|'Pending'|'Done'|'All'>('Today');
  const [questSearch,setQuestSearch] = useState('');
  const [questLimit,setQuestLimit] = useState(20);
  const [goalLimit,setGoalLimit] = useState(8);
  const [goalSearch,setGoalSearch] = useState('');
  const [reduceMotion,setReduceMotion] = useState(false);
  const [reward,setReward] = useState<{xp:number;levelUp:boolean}|null>(null);
  const rewardPulse = useRef(new Animated.Value(0)).current;
  useEffect(()=>{let live=true;AccessibilityInfo.isReduceMotionEnabled().then(v=>{if(live)setReduceMotion(v);}).catch(()=>{});const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduceMotion);return ()=>{live=false;sub.remove();};},[]);

  const refresh = useCallback(async () => {
    setData(await loadSnapshot());
    setClock(new Date());
  },[]);
  useEffect(()=>{
    let live = true;
    (async () => {
      try { await initialize(); if (live) await refresh(); }
      catch(e) { Alert.alert('Cannot load ASCEND',String(e)); }
      finally { if (live) setLoading(false); }
    })();
    return () => {live=false;};
  },[refresh]);
  useEffect(()=>{
    const sub=AppState.addEventListener('change',state=>{
      if(state==='active') setClock(new Date());
    });
    return ()=>sub.remove();
  },[]);

  const selectQuestPackFile=async()=>{
    try{
      const selection=await DocumentPicker.getDocumentAsync({type:'*/*',copyToCacheDirectory:true});
      if(selection.canceled)return;
      const file=selection.assets[0];
      if(!file)return;
      if(file.size!==undefined&&file.size>100_000)throw new Error('Quest pack file is too large (100 KB limit)');
      const contents=await FileSystem.readAsStringAsync(file.uri);
      parseQuestPack(contents);
      setQuestPackText(contents);
    }catch(e){Alert.alert('Cannot open quest pack',e instanceof Error?e.message:String(e));}
  };

  const run = async (work:()=>Promise<void>) => {
    if(busy)return;
    setBusy(true);
    try {await work(); await refresh();}
    catch(e){Alert.alert('Action failed',e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  };
  const player = useMemo(()=>derivePlayer(data.xpEvents),[data.xpEvents]);
  const quests = data.quests.filter(q=>!q.archived);
  const goals = data.goals.filter(g=>!g.archived);
  const day = localDayKey(clock);
  const completedToday = data.completions.filter(c=>localDayKey(new Date(c.completedAt))===day);
  const todayXP = data.xpEvents.filter(e=>e.dayKey===day).reduce((a,e)=>a+e.amount,0);
  const completed = (q:Quest)=>isCompleted(q,data.completions,clock);
  const activeQuests = quests.filter(q=>q.repeatRule!=='once'||!completed(q));
  const pending = activeQuests.filter(q=>!completed(q));
  const todayBoard = pending.filter(q=>q.repeatRule==='daily');
  const filteredQuests = quests.filter(q=>{
    const match = (q.title+' '+q.description).toLowerCase().includes(questSearch.trim().toLowerCase());
    if(!match)return false;
    const done=completed(q);
    if(questFilter==='Today') return q.repeatRule==='daily'&&!done;
    if(questFilter==='Weekly') return q.repeatRule==='weekly'&&!done;
    if(questFilter==='Milestones')return isMilestoneQuest(q)&&!done;
    if(questFilter==='Pending')return !done;
    if(questFilter==='Done')return done;
    return true;
  });
  const filteredGoals=goals.filter(g=>g.title.toLowerCase().includes(goalSearch.trim().toLowerCase()));

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
  const finish=(q:Quest)=>run(async()=>{
    const reward=await completeQuest(q,new Date());
    if(reward.applied) {
      const levelUp=levelFromXP(player.totalXP+reward.xp)>player.level;
      setReward({xp:reward.xp,levelUp});
      rewardPulse.stopAnimation(); rewardPulse.setValue(0);
      Animated.sequence([
        Animated.timing(rewardPulse,{toValue:1,duration:reduceMotion?0:180,useNativeDriver:true}),
        Animated.delay(reduceMotion?700:850),
        Animated.timing(rewardPulse,{toValue:0,duration:reduceMotion?0:300,useNativeDriver:true}),
      ]).start(()=>setReward(null));
    }
  });

  const QuestCard=({quest,editable=false}:{quest:Quest;editable?:boolean})=>{
    const done=completed(quest);
    return <Panel style={{padding:13,opacity:done ? 0.8 : 1}}>
      <View style={s.between}>
        <View style={{flex:1,marginRight:10}}>
          <T size={15} bold color={done?C.sub:C.ink}>{isMilestoneQuest(quest)?quest.title.slice(MILESTONE_PREFIX.length):quest.title}</T>
          {!!quest.description && <T size={12} color={C.sub} style={{marginTop:4}}>{quest.description}</T>}
        </View>
        <View style={[s.reward,{borderColor:done?C.green:C.energy}]}>
          <T color={done?C.green:C.energy} bold size={12}>{done?'✓':`+${XP_BY_DIFFICULTY[quest.difficulty]}`}</T>
          <T color={C.dim} size={9}>{done?'Done':'XP'}</T>
        </View>
      </View>
      <View style={[s.between,{marginTop:12}]}>
        <T color={LABELS[quest.attribute].tint} size={11}>
          {isMilestoneQuest(quest)?'◆ Milestone · ':''}{LABELS[quest.attribute].glyph} {LABELS[quest.attribute].label} · {quest.difficulty} · {quest.repeatRule}
        </T>
        <View style={{flexDirection:'row',gap:9,alignItems:'center'}}>
          {editable&& <Pressable accessibilityRole="button" onPress={()=>openQuest(quest)}><T color={C.sub} size={12}>Edit</T></Pressable>}
          {editable&& <Pressable accessibilityRole="button" onPress={()=>Alert.alert('Archive quest?', 'Your XP history stays intact.',[
            {text:'Cancel',style:'cancel'}, {text:'Archive',style:'destructive',onPress:()=>run(()=>archiveQuest(quest.id))},
          ])}><T color={C.danger} size={12}>Archive</T></Pressable>}
          {!done&&<Pressable accessibilityRole="button" disabled={busy} style={s.finish} onPress={()=>finish(quest)}>
            <T color={C.bg} bold size={12}>COMPLETE</T>
          </Pressable>}
        </View>
      </View>
    </Panel>;
  };

  const Home=()=> <>
    <LinearGradient colors={['#183456','#102541','#0A172B']} start={{x:0,y:0}} end={{x:1,y:1}} style={s.hero}>
      <Pressable accessibilityRole="button" accessibilityLabel="Open your hunter profile" onPress={()=>setTab('Hunter')}>
        <View style={[s.between,{alignItems:'flex-start'}]}>
          <View style={{flex:1}}>
            <View style={{flexDirection:'row',alignItems:'center',gap:7,marginBottom:7}}>
              <Sparkles color={C.energy} size={14}/>
              <T color={C.energy} size={10} bold style={{letterSpacing:1.7}}>YOUR ASCENSION</T>
            </View>
            <T size={34} bold style={{letterSpacing:-.9}}>LEVEL {player.level}</T>
            <T color={C.sub} size={13}>The Architect · {player.rank}-Rank</T>
          </View>
          <Image source={require('../assets/icon.png')} style={{height:90,width:90,borderRadius:20,marginLeft:8}} accessible accessibilityLabel="ASCEND crystalline sigil"/>
        </View>
        <View style={[s.between,{marginTop:22,marginBottom:9}]}>
          <T color={C.sub} size={11} bold style={{letterSpacing:.8}}>NEXT LEVEL</T>
          <T color={C.energy} size={12} bold>{player.currentLevelXP} / {player.xpForNextLevel} XP</T>
        </View>
        <Meter value={player.progress} height={9}/>
        <View style={[s.between,{marginTop:13}]}>
          <T color={C.sub} size={11}>{player.totalXP.toLocaleString()} lifetime XP</T>
          <T color={C.green} size={11}>+{todayXP} today</T>
        </View>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'flex-end',marginTop:13,gap:4}}>
          <T color={C.energy} size={11} bold>VIEW CHARACTER</T><ChevronRight color={C.energy} size={14}/>
        </View>
      </Pressable>
    </LinearGradient>
    <View style={s.statRow}>
      <Panel style={[s.miniPanel,{marginRight:5}]}><T color={C.sub} size={11}>TODAY'S QUESTS</T><T bold size={25}>{completedToday.length}<T size={15} color={C.dim}> completed</T></T></Panel>
      <Panel style={[s.miniPanel,{marginLeft:5}]}><T color={C.sub} size={11}>PENDING</T><T color={C.energy} bold size={25}>{todayBoard.length}</T></Panel>
    </View>
    <Section title="Today's Missions" right={<Pressable accessibilityRole="button" onPress={()=>{setQuestFilter('Today');setTab('Quests');}}><T color={C.energy} size={12}>VIEW BOARD →</T></Pressable>}/>
    {todayBoard.length===0?<Panel><T color={C.green} bold>All daily quests cleared ✦</T><T color={C.sub} size={13}>Enjoy your progress. More quests can wait until tomorrow.</T></Panel>:
      todayBoard.slice(0,4).map(q=><QuestCard key={q.id} quest={q}/>)}
    <T color={C.dim} size={11} style={{marginBottom:13}}>Small, repeatable actions win. You can review weekly and milestone quests separately.</T>
    <Action onPress={()=>openQuest()} secondary style={{marginBottom:10}}>+ CREATE NEW QUEST</Action>
    <Section title="Main Questlines" right={<Pressable onPress={()=>setTab('Goals')}><T color={C.energy} size={12}>All goals →</T></Pressable>}/>
    {goals.length===0 ? <Panel><T color={C.sub}>Create a long-term goal and link quests to it.</T>
      <View style={{marginTop:12}}><Action onPress={()=>openGoal()} secondary>ADD YOUR FIRST GOAL</Action></View></Panel>:
      goals.slice(0,2).map(g=><GoalCard key={g.id} goal={g}/>)}
  </>;

  const Quests=()=> <>
    <Section title="Quest Board" right={<Action onPress={()=>openQuest()} style={{paddingHorizontal:13}}>+ QUEST</Action>}/>
    <T color={C.sub} size={13} style={{marginBottom:12}}>Choose your next move. No pressure to clear every mission at once.</T>
    <View style={s.searchRow}>
      <SearchIcon color={C.sub} size={17}/>
      <TextInput accessibilityLabel="Search quests" placeholder="Find a quest, skill, or project" placeholderTextColor={C.dim}
        value={questSearch} onChangeText={x=>{setQuestSearch(x);setQuestLimit(20);}}
        autoCorrect={false} style={s.searchInput}/>
    </View>
    <View style={s.chips}>{(['Today','Weekly','Milestones','Pending','Done','All'] as const).map(f=>
      <Chip key={f} active={questFilter===f} onPress={()=>{setQuestFilter(f);setQuestLimit(20);}}>{f}</Chip>)}</View>
    <View style={[s.between,{marginTop:3,marginBottom:12}]}>
      <T color={C.sub} size={12}>{filteredQuests.length} {filteredQuests.length===1?'mission':'missions'}</T>
      <T color={C.dim} size={11}>{questFilter==='Today'?'Daily focus':questFilter==='Milestones'?'One-time objectives':'Your board'}</T>
    </View>
    {filteredQuests.slice(0,questLimit).map(q=><QuestCard key={q.id} quest={q} editable/>)}
    {filteredQuests.length>questLimit&&<Action secondary onPress={()=>setQuestLimit(x=>x+20)} style={{marginBottom:15}}>
      SHOW MORE ({filteredQuests.length-questLimit} LEFT)
    </Action>}
    {filteredQuests.length===0&&<Panel>
      <T color={C.green} size={16} bold>{questFilter==='Today'?'Daily quests cleared':'No matching missions'}</T>
      <T color={C.sub} size={13} style={{marginTop:5}}>Try another filter or create a quest that matters today.</T>
      <View style={{marginTop:12}}><Action secondary onPress={()=>openQuest()}>CREATE QUEST</Action></View>
    </Panel>}
    <T color={C.dim} size={11}>One-off milestones are available under Goals. Archived quests remain in your history.</T>
  </>;

  const GoalCard=({goal}:{goal:Goal})=>{
    const count=completedGoalCount(goal.id,data.quests,data.completions);
    const milestones=quests.filter(q=>q.goalId===goal.id&&isMilestoneQuest(q));
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
        {!!expandedGoals[goal.id]&&milestones.map(m=><View key={m.id} style={[s.between,{paddingTop:12,alignItems:'flex-start'}]}>
          <View style={{flex:1,marginRight:8}}>
            <T size={13} color={completed(m)?C.green:C.ink}>{completed(m)?'✓ ':'○ '}{m.title.slice(MILESTONE_PREFIX.length)}</T>
            {!!m.description&&<T size={11} color={C.dim} style={{marginTop:3}}>{m.description}</T>}
          </View>
          {!completed(m)&&<Pressable disabled={busy} accessibilityRole="button" onPress={()=>finish(m)} style={s.finish}><T size={11} color={C.bg} bold>Done</T></Pressable>}
        </View>)}
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
    <Section title="Questlines" right={<Action onPress={()=>openGoal()} style={{paddingHorizontal:12}}>+ GOAL</Action>}/>
    <T color={C.sub} size={13} style={{marginBottom:12}}>Your long-term stories. Open each goal to review and complete its milestones.</T>
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
    <Panel style={{alignItems:'center',paddingVertical:28}}>
      <View style={s.avatar}><T size={48} color={C.energy}>♜</T></View>
      <T color={C.energy} size={11} bold style={{marginTop:15}}>THE ARCHITECT</T>
      <T size={29} bold style={{marginTop:4}}>Rank {player.rank} Hunter</T>
      <T color={C.sub} size={13}>Level {player.level} · {player.totalXP} lifetime XP</T>
    </Panel>
    <Section title="Character Attributes"/>
    {ATTRIBUTES.map(a=><Panel key={a}>
      <View style={s.between}>
        <T bold size={15}>{LABELS[a].glyph}  {LABELS[a].label}</T>
        <T color={LABELS[a].tint} bold>{player.attributes[a]} XP</T>
      </View>
      <View style={{marginTop:11}}><Meter tint={LABELS[a].tint} value={(player.attributes[a] % 300)/300}/></View>
      <T color={C.dim} size={10} style={{marginTop:8}}>Attribute XP tracks activity, not innate ability.</T>
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
      <Section title="Progress Report"/>
      <View style={s.statRow}>
        <Panel style={[s.miniPanel,{marginRight:5}]}><T size={11} color={C.sub}>LIFETIME XP</T><T bold size={25}>{player.totalXP}</T></Panel>
        <Panel style={[s.miniPanel,{marginLeft:5}]}><T size={11} color={C.sub}>TOTAL COMPLETIONS</T><T bold size={25}>{data.completions.length}</T></Panel>
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
    <Section title="System Settings"/>
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
      <T bold>Personal quest pack</T>
      <T color={C.sub} size={13} style={{marginTop:8}}>Add private goals, recurring quests and milestones. Import is additive, safe to retry, and never awards XP automatically. Keep personal JSON outside public repositories.</T>
      <View style={{marginTop:13}}><Action secondary onPress={()=>{void selectQuestPackFile();}}>CHOOSE QUEST PACK FILE</Action></View>
      <View style={{marginTop:9}}><Action secondary onPress={()=>setQuestPackText('')}>PASTE QUEST PACK JSON</Action></View>
    </Panel>
    <Panel>
      <T bold>Export your data</T>
      <T color={C.sub} size={13} style={{marginTop:8}}>Generate a text backup. Copy it to a safe location outside this device. Cloud restore is not yet implemented.</T>
      <View style={{marginTop:13}}><Action secondary onPress={()=>run(async()=>setBackup(await exportJSON()))}>VIEW BACKUP JSON</Action></View>
      <View style={{marginTop:10}}><Action secondary onPress={()=>setRestoreText('')}>RESTORE SAVED JSON</Action></View>
    </Panel>
    <Panel>
      <T bold color={C.danger}>Reset all local data</T>
      <T color={C.sub} size={13} style={{marginTop:8}}>Irreversibly deletes quests, goals, completions and XP from this device.</T>
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
    <View style={s.top}>
      <View style={{flexDirection:'row',alignItems:'center',gap:11}}>
        <Image source={require('../assets/icon.png')} style={{width:40,height:40,borderRadius:11}}/>
        <View><T color={C.frost} size={17} bold style={{letterSpacing:2}}>ASCEND</T>
          <T color={C.sub} size={11}>{fmt(clock)}</T></View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={updates.available?'Update available, open settings':'Open hunter profile'}
        onPress={()=>setTab(updates.available?'More':tab==='Hunter'?'Home':'Hunter')} style={s.levelPill}>
        <Shield color={C.gold} size={15}/>
        <T color={updates.available?C.green:C.gold} bold size={11}>
          {updates.available?'UPDATE':'LV '+player.level}
        </T>
      </Pressable>
    </View>
    <ScrollView style={{flex:1}} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      {tab==='Home'?<Home/>:tab==='Quests'?<Quests/>:tab==='Goals'?<Goals/>:tab==='Hunter'?<Hunter/>:tab==='Progress'?<Progress/>:<More/>}
    </ScrollView>
    {reward&&<Animated.View pointerEvents="none" style={[s.rewardToast,{opacity:rewardPulse,transform:[{scale:rewardPulse.interpolate({inputRange:[0,1],outputRange:[0.85,1]})}]}]}>
      <T color={C.energy} bold size={12}>{reward.levelUp?'✦ LEVEL UP ✦':'QUEST CLEARED'}</T>
      <T color={C.gold} bold size={23}>{reward.xp>0?`+${reward.xp} XP`:'XP CAP REACHED'}</T>
    </Animated.View>}
    <View style={s.nav}>
      {TABS.map(t=>{const NavIcon=t.Icon;const active=tab===t.tab;return <Pressable accessibilityRole="tab"
        accessibilityLabel={t.tab} accessibilityState={{selected:active}} key={t.tab}
        style={[s.navTab,active&&{backgroundColor:'#1B3653',borderColor:'#345F83'}]} onPress={()=>setTab(t.tab)}>
        <NavIcon size={21} color={active?C.energy:C.sub} strokeWidth={active?2.35:1.7}/>
        <T size={10} bold={active} color={active?C.frost:C.sub}>{t.tab}</T>
      </Pressable>;})}
    </View>

    <Modal visible={questModal} animationType="slide" transparent onRequestClose={()=>setQuestModal(false)}>
      <KeyboardAvoidingView style={s.modalBackdrop} behavior={Platform.OS==='ios'?'padding':undefined}>
        <ScrollView style={s.modalSheet} keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:30}}>
          <View style={s.between}><T size={20} bold>{editingQuest?'Edit Quest':'New Quest'}</T><Pressable onPress={()=>setQuestModal(false)}><T color={C.sub}>Close ✕</T></Pressable></View>
          <T color={C.sub} style={{marginTop:18,marginBottom:7}}>Quest title</T>
          <TextInput maxLength={100} placeholder="e.g. Practice system design" placeholderTextColor={C.dim} value={questForm.title}
            onChangeText={title=>setQuestForm(f=>({...f,title}))} style={s.input}/>
          <T color={C.sub} style={{marginTop:14,marginBottom:7}}>Description (optional)</T>
          <TextInput maxLength={500} placeholder="What does success look like?" placeholderTextColor={C.dim}
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
          <View style={s.chips}>{(['once','daily','weekly'] as RepeatRule[]).map(r=><Chip key={r}
            active={questForm.repeatRule===r} onPress={()=>setQuestForm(f=>({...f,repeatRule:r}))}>{r}</Chip>)}</View>
          {goals.length>0&&<><T color={C.sub} style={s.formLabel}>Link to goal</T>
            <View style={s.chips}><Chip active={!questForm.goalId} onPress={()=>setQuestForm(f=>({...f,goalId:null}))}>None</Chip>
            {goals.map(g=><Chip key={g.id} active={questForm.goalId===g.id}
              onPress={()=>setQuestForm(f=>({...f,goalId:g.id}))}>{g.title}</Chip>)}</View></>}
          <Action disabled={busy} style={{marginTop:15}} onPress={()=>run(async()=>{
            await saveQuest(questForm,editingQuest?.id);setQuestModal(false);
          })}>SAVE QUEST</Action>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
    <Modal visible={goalModal} animationType="slide" transparent onRequestClose={()=>setGoalModal(false)}>
      <KeyboardAvoidingView style={s.modalBackdrop} behavior={Platform.OS==='ios'?'padding':undefined}>
        <ScrollView style={s.modalSheet} keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:30}}>
          <View style={s.between}><T size={20} bold>{editingGoal?'Edit Goal':'New Questline'}</T><Pressable onPress={()=>setGoalModal(false)}><T color={C.sub}>Close ✕</T></Pressable></View>
          <T color={C.sub} style={s.formLabel}>Goal title</T>
          <TextInput value={goalTitle} onChangeText={setGoalTitle} maxLength={100}
            placeholder="e.g. Develop consistent strength training" placeholderTextColor={C.dim} style={s.input}/>
          <T color={C.sub} style={s.formLabel}>Attribute</T>
          <View style={s.chips}>{ATTRIBUTES.map(a=><Chip key={a} active={goalAttribute===a}
            onPress={()=>setGoalAttribute(a)}>{LABELS[a].label}</Chip>)}</View>
          <T color={C.sub} style={s.formLabel}>Target linked quest completions</T>
          <TextInput keyboardType="number-pad" value={goalTarget} onChangeText={setGoalTarget} style={s.input}/>
          <T color={C.dim} size={11} style={{marginTop:8}}>This is a practice target. Outcome-based goal metrics come in a later version.</T>
          <Action disabled={busy} style={{marginTop:20}} onPress={()=>run(async()=>{
            await saveGoal({title:goalTitle,attribute:goalAttribute,targetCount:Number(goalTarget)},editingGoal?.id);
            setGoalModal(false);
          })}>SAVE QUESTLINE</Action>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
    <Modal visible={questPackText!==null} animationType="slide" transparent onRequestClose={()=>setQuestPackText(null)}>
      <View style={s.modalBackdrop}><View style={[s.modalSheet,{maxHeight:'85%'}]}>
        <View style={s.between}><T size={19} bold>Import private quest pack</T><Pressable onPress={()=>setQuestPackText(null)}><T color={C.sub}>Close ✕</T></Pressable></View>
        <T color={C.sub} size={12} style={{marginVertical:12}}>Review the selected ASCEND quest-pack JSON. You can also paste JSON here. Check dates and statuses before importing.</T>
        <TextInput multiline value={questPackText??''} onChangeText={setQuestPackText} placeholder="Paste quest-pack JSON here" placeholderTextColor={C.dim} style={[s.input,{height:250,fontSize:11,textAlignVertical:'top'}]} />
        <View style={{marginTop:13}}><Action disabled={busy||!questPackText?.trim()} onPress={()=>{
          try{
            const pack=parseQuestPack(questPackText!);
            const count=pack.quests.filter(q=>q.kind==='milestone').length;
            Alert.alert('Import '+pack.title+'?',`${pack.goals.length} goals, ${count} milestones and ${pack.quests.length-count} quests. This import is additive and safe to repeat.`,[
              {text:'Cancel',style:'cancel'},
              {text:'Import',onPress:()=>run(async()=>{
                const result=await importQuestPack(questPackText!);
                setQuestPackText(null);
                Alert.alert('Quest pack imported',`${result.goalsAdded} goals, ${result.milestonesAdded} milestones and ${result.questsAdded} quests added. Existing progress preserved.`);
              })},
            ]);
          }catch(e){Alert.alert('Invalid quest pack',e instanceof Error?e.message:String(e));}
        }}>PREVIEW & IMPORT</Action></View>
      </View></View>
    </Modal>
    <Modal visible={restoreText!==null} animationType="slide" transparent onRequestClose={()=>setRestoreText(null)}>
      <View style={s.modalBackdrop}><View style={[s.modalSheet,{maxHeight:'85%'}]}>
        <View style={s.between}><T size={19} bold>Restore your saved progress</T>
          <Pressable onPress={()=>setRestoreText(null)}><T color={C.sub}>Close ✕</T></Pressable></View>
        <T color={C.sub} size={12} style={{marginVertical:12}}>
          Paste ASCEND backup JSON. Restoring REPLACES all existing quests and XP on this phone.
        </T>
        <TextInput multiline value={restoreText??''} onChangeText={setRestoreText}
          placeholder="Paste ASCEND backup JSON here" placeholderTextColor={C.dim}
          style={[s.input,{height:250,fontSize:11,textAlignVertical:'top'}]}/>
        <View style={{marginTop:13}}><Action danger disabled={busy||!restoreText?.trim()}
          onPress={()=>Alert.alert('Replace all local progress?',
            'Save a copy of current data first. This operation cannot be undone.',[
              {text:'Cancel',style:'cancel'},
              {text:'Restore',style:'destructive',onPress:()=>run(async()=>{
                await restoreJSON(restoreText!);
                setRestoreText(null);
              })},
            ])}>RESTORE BACKUP</Action></View>
      </View></View>
    </Modal>
    <Modal visible={backup!==null} animationType="fade" transparent onRequestClose={()=>setBackup(null)}>
      <View style={s.modalBackdrop}><View style={[s.modalSheet,{maxHeight:'83%'}]}>
        <View style={s.between}><T size={19} bold>Copy your backup</T><Pressable onPress={()=>setBackup(null)}><T color={C.sub}>Close ✕</T></Pressable></View>
        <T color={C.sub} size={12} style={{marginVertical:12}}>Select all text, copy, and save it somewhere safe. This is NOT an automatic backup.</T>
        <TextInput multiline selectTextOnFocus value={backup??''} style={[s.input,{height:310,fontSize:11,textAlignVertical:'top'}]} />
        <View style={{marginTop:13}}><Action secondary onPress={()=>setBackup(null)}>DONE</Action></View>
      </View></View>
    </Modal>
  </View>;
}

const s=StyleSheet.create({
  root:{flex:1,backgroundColor:C.bg},
  top:{paddingTop:Platform.OS==='android'?(StatusBar.currentHeight??26)+12:52,paddingHorizontal:17,paddingBottom:13,
    flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderColor:C.border},
  levelPill:{paddingHorizontal:12,paddingVertical:10,borderColor:'#907443',borderWidth:1,borderRadius:14,backgroundColor:'#292738',flexDirection:'row',alignItems:'center',gap:6,minHeight:44},
  content:{padding:16,paddingBottom:42},
  hero:{borderRadius:23,borderWidth:1,borderColor:'#416D98',padding:19,marginBottom:15,overflow:'hidden'},
  searchRow:{flexDirection:'row',gap:10,alignItems:'center',backgroundColor:C.elevated,borderColor:C.border,borderWidth:1,borderRadius:13,paddingHorizontal:13,marginBottom:13,minHeight:48},
  searchInput:{flex:1,color:C.ink,fontSize:14,minHeight:47,paddingVertical:10},
  between:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  statRow:{flexDirection:'row',justifyContent:'space-between'},
  miniPanel:{flex:1,minHeight:85,justifyContent:'space-between'},
  reward:{borderWidth:1,borderRadius:11,paddingHorizontal:9,paddingVertical:5,alignItems:'center',minWidth:48},
  finish:{backgroundColor:C.energy,borderRadius:9,paddingHorizontal:12,paddingVertical:9},
  rankEmblem:{height:85,width:80,borderColor:'#927547',borderWidth:1,borderRadius:20,justifyContent:'center',alignItems:'center',backgroundColor:'#252B3E'},
  chips:{flexDirection:'row',flexWrap:'wrap',marginBottom:7},
  avatar:{height:105,width:105,borderRadius:52,borderWidth:1,borderColor:C.energy,backgroundColor:C.elevated,alignItems:'center',justifyContent:'center'},
  chart:{marginTop:14,height:162,flexDirection:'row',alignItems:'flex-end'},
  barCell:{flex:1,height:150,alignItems:'center',justifyContent:'flex-end',gap:6},
  bar:{width:'62%',borderRadius:5,minHeight:3},
  rewardToast:{position:'absolute',zIndex:10,top:125,alignSelf:'center',alignItems:'center',backgroundColor:'#1C2948',borderWidth:1,borderColor:C.energy,borderRadius:17,paddingHorizontal:25,paddingVertical:16,shadowColor:C.energy,shadowRadius:14,shadowOpacity:.5,elevation:12},
  nav:{flexDirection:'row',borderTopWidth:1,borderColor:C.border,backgroundColor:'#0D182A',
    paddingBottom:Platform.OS==='ios'?20:12,paddingTop:8,paddingHorizontal:5},
  navTab:{flex:1,alignItems:'center',justifyContent:'center',gap:4,paddingVertical:5,borderWidth:1,borderColor:'transparent',borderRadius:13,minHeight:53},
  modalBackdrop:{flex:1,backgroundColor:'#030914D9',justifyContent:'flex-end'},
  modalSheet:{backgroundColor:C.surface,borderTopLeftRadius:24,borderTopRightRadius:24,padding:20,maxHeight:'92%'},
  input:{borderWidth:1,borderColor:C.border,borderRadius:12,backgroundColor:C.elevated,color:C.ink,
    paddingVertical:12,paddingHorizontal:13,fontSize:15,minHeight:47},
  formLabel:{marginTop:19,marginBottom:9},
});
