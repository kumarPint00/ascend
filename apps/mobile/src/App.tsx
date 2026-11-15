import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Animated, AppState, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StatusBar,
  StyleSheet, TextInput, View, ActivityIndicator,
} from 'react-native';
import {
  ATTRIBUTES, type Attribute, type Difficulty, type RepeatRule, type Goal,
  type Quest, type Completion, derivePlayer, localDayKey, isCompleted,
  completedGoalCount, XP_BY_DIFFICULTY, levelFromXP,
} from '@ascend/game-engine';
import {Action, Chip, Meter, Panel, Section, T} from './components/Elements';
import {C, LABELS} from './theme';
import {
  type Snapshot, type QuestInput, initialize, loadSnapshot, saveQuest, archiveQuest,
  saveGoal, archiveGoal, completeQuest, exportJSON, wipeAllData,
} from './data/repository';

type Tab = 'Home' | 'Quests' | 'Goals' | 'Hunter' | 'Progress' | 'More';
const TABS: {tab:Tab;glyph:string}[] = [
  {tab:'Home',glyph:'⌂'}, {tab:'Quests',glyph:'⚔'}, {tab:'Goals',glyph:'◇'},
  {tab:'Hunter',glyph:'♜'}, {tab:'Progress',glyph:'▥'}, {tab:'More',glyph:'⚙'},
];
const INITIAL_QUEST: QuestInput = {
  title: '', description: '', attribute: 'discipline', difficulty: 'medium',
  repeatRule: 'daily', goalId: null,
};
const EMPTY: Snapshot = {quests:[],goals:[],completions:[],xpEvents:[]};
const fmt = (d:Date) => d.toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'});

export default function App() {
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
  const [questFilter,setQuestFilter] = useState<'All'|'Pending'|'Done'>('Pending');
  const [reward,setReward] = useState<{xp:number;levelUp:boolean}|null>(null);
  const rewardPulse = useRef(new Animated.Value(0)).current;

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
        Animated.timing(rewardPulse,{toValue:1,duration:250,useNativeDriver:true}),
        Animated.delay(1000),
        Animated.timing(rewardPulse,{toValue:0,duration:320,useNativeDriver:true}),
      ]).start(()=>setReward(null));
    }
  });

  const QuestCard=({quest,editable=false}:{quest:Quest;editable?:boolean})=>{
    const done=completed(quest);
    return <Panel style={{padding:13,opacity:done ? 0.8 : 1}}>
      <View style={s.between}>
        <View style={{flex:1,marginRight:10}}>
          <T size={15} bold color={done?C.sub:C.ink}>{quest.title}</T>
          {!!quest.description && <T size={12} color={C.sub} style={{marginTop:4}}>{quest.description}</T>}
        </View>
        <View style={[s.reward,{borderColor:done?C.green:C.energy}]}>
          <T color={done?C.green:C.energy} bold size={12}>{done?'✓':`+${XP_BY_DIFFICULTY[quest.difficulty]}`}</T>
          <T color={C.dim} size={9}>{done?'Done':'XP'}</T>
        </View>
      </View>
      <View style={[s.between,{marginTop:12}]}>
        <T color={LABELS[quest.attribute].tint} size={11}>
          {LABELS[quest.attribute].glyph} {LABELS[quest.attribute].label} · {quest.difficulty} · {quest.repeatRule}
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
    <Panel style={{backgroundColor:'#13233C',borderColor:'#4264A0',padding:20}}>
      <View style={s.between}>
        <View>
          <T color={C.energy} bold size={10}>AWAKENED HUNTER</T>
          <T size={29} bold style={{marginTop:5}}>LVL {String(player.level).padStart(2,'0')}</T>
          <T color={C.sub} size={13}>Rank {player.rank} · The Architect</T>
        </View>
        <View style={s.rankEmblem}><T size={39} color={C.gold} bold>{player.rank}</T><T size={9} color={C.gold}>RANK</T></View>
      </View>
      <View style={[s.between,{marginTop:22,marginBottom:9}]}>
        <T color={C.sub} size={12}>LEVEL PROGRESS</T>
        <T color={C.energy} size={12} bold>{player.currentLevelXP} / {player.xpForNextLevel} XP</T>
      </View>
      <Meter value={player.progress} height={10}/>
      <View style={[s.between,{marginTop:13}]}>
        <T color={C.sub} size={11}>Total XP {player.totalXP}</T>
        <T color={C.green} size={11}>+{todayXP} XP today</T>
      </View>
    </Panel>
    <View style={s.statRow}>
      <Panel style={[s.miniPanel,{marginRight:5}]}><T color={C.sub} size={11}>TODAY'S QUESTS</T><T bold size={25}>{completedToday.length}<T size={15} color={C.dim}> completed</T></T></Panel>
      <Panel style={[s.miniPanel,{marginLeft:5}]}><T color={C.sub} size={11}>PENDING</T><T color={C.energy} bold size={25}>{pending.length}</T></Panel>
    </View>
    <Section title="Daily Quest Board" right={<Pressable onPress={()=>setTab('Quests')}><T color={C.energy} size={12}>View all →</T></Pressable>}/>
    {pending.length===0?<Panel><T color={C.green} bold>All current quests cleared ✦</T><T color={C.sub} size={13}>Enjoy your progress. More quests can wait until tomorrow.</T></Panel>:
      pending.slice(0,4).map(q=><QuestCard key={q.id} quest={q}/>)}
    <Action onPress={()=>openQuest()} secondary style={{marginBottom:10}}>+ CREATE NEW QUEST</Action>
    <Section title="Main Questlines" right={<Pressable onPress={()=>setTab('Goals')}><T color={C.energy} size={12}>All goals →</T></Pressable>}/>
    {goals.length===0 ? <Panel><T color={C.sub}>Create a long-term goal and link quests to it.</T>
      <View style={{marginTop:12}}><Action onPress={()=>openGoal()} secondary>ADD YOUR FIRST GOAL</Action></View></Panel>:
      goals.slice(0,2).map(g=><GoalCard key={g.id} goal={g}/>)}
  </>;

  const Quests=()=> <>
    <Section title="Quest Board" right={<Action onPress={()=>openQuest()} style={{paddingHorizontal:12}}>+ New</Action>}/>
    <View style={s.chips}>{(['Pending','Done','All'] as const).map(f=><Chip key={f} active={questFilter===f} onPress={()=>setQuestFilter(f)}>{f}</Chip>)}</View>
    {quests.filter(q=>questFilter==='All'||(questFilter==='Done'?completed(q):!completed(q)))
      .map(q=><QuestCard key={q.id} quest={q} editable/>)}
    {quests.filter(q=>questFilter==='All'||(questFilter==='Done'?completed(q):!completed(q))).length===0 &&
      <Panel><T color={C.sub}>No quests in this view. Create a mission or switch filters.</T></Panel>}
    <T color={C.dim} size={11}>Archived quests disappear from the board but remain in completion history.</T>
  </>;

  const GoalCard=({goal}:{goal:Goal})=>{
    const count=completedGoalCount(goal.id,data.quests,data.completions);
    return <Panel>
      <View style={s.between}>
        <View style={{flex:1}}><T bold size={15}>{goal.title}</T>
          <T color={LABELS[goal.attribute].tint} size={12} style={{marginTop:5}}>{LABELS[goal.attribute].glyph} {LABELS[goal.attribute].label}</T>
        </View>
        <T color={C.energy} bold size={14}>{count} / {goal.targetCount}</T>
      </View>
      <View style={{marginTop:12}}><Meter value={count/goal.targetCount} tint={C.violet}/></View>
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
    <Section title="Main Questlines" right={<Action onPress={()=>openGoal()} style={{paddingHorizontal:12}}>+ New</Action>}/>
    <T color={C.sub} size={13} style={{marginBottom:14}}>Define a real-life objective. Every linked quest completion moves it forward.</T>
    {goals.length===0?<Panel><T color={C.sub}>No goals yet. Start with a milestone you can measure.</T></Panel>:goals.map(g=><GoalCard key={g.id} goal={g}/>)}
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
      <T bold>Export your data</T>
      <T color={C.sub} size={13} style={{marginTop:8}}>Generate a text backup. Copy it to a safe location outside this device. Cloud restore is not yet implemented.</T>
      <View style={{marginTop:13}}><Action secondary onPress={()=>run(async()=>setBackup(await exportJSON()))}>VIEW BACKUP JSON</Action></View>
    </Panel>
    <Panel>
      <T bold color={C.danger}>Reset all local data</T>
      <T color={C.sub} size={13} style={{marginTop:8}}>Irreversibly deletes quests, goals, completions and XP from this device.</T>
      <View style={{marginTop:13}}><Action danger onPress={()=>Alert.alert('Delete your progress?', 'This action cannot be undone. Export a backup first.',[
        {text:'Cancel',style:'cancel'}, {text:'Delete everything',style:'destructive',onPress:()=>run(wipeAllData)},
      ])}>RESET PROFILE</Action></View>
    </Panel>
    <T color={C.dim} size={11}>ASCEND v0.1 · Local-first · No advertisements or paid APIs</T>
  </>;

  if(loading) return <View style={[s.root,{justifyContent:'center',alignItems:'center'}]}><ActivityIndicator color={C.energy} size="large"/><T color={C.sub} style={{marginTop:16}}>Initializing the System…</T></View>;
  return <View style={s.root}>
    <StatusBar backgroundColor={C.bg} barStyle="light-content"/>
    <View style={s.top}>
      <View><T color={C.energy} size={10} bold>▰ ASCEND / SYSTEM ONLINE</T><T color={C.sub} size={12} style={{marginTop:5}}>{fmt(clock)}</T></View>
      <View style={s.levelPill}><T color={C.gold} bold size={12}>RANK {player.rank}  •  LV {player.level}</T></View>
    </View>
    <ScrollView style={{flex:1}} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      {tab==='Home'?<Home/>:tab==='Quests'?<Quests/>:tab==='Goals'?<Goals/>:tab==='Hunter'?<Hunter/>:tab==='Progress'?<Progress/>:<More/>}
    </ScrollView>
    {reward&&<Animated.View pointerEvents="none" style={[s.rewardToast,{opacity:rewardPulse,transform:[{scale:rewardPulse.interpolate({inputRange:[0,1],outputRange:[0.85,1]})}]}]}>
      <T color={C.energy} bold size={12}>{reward.levelUp?'✦ LEVEL UP ✦':'QUEST CLEARED'}</T>
      <T color={C.gold} bold size={23}>{reward.xp>0?`+${reward.xp} XP`:'XP CAP REACHED'}</T>
    </Animated.View>}
    <View style={s.nav}>
      {TABS.map(t=><Pressable accessibilityRole="tab" accessibilityState={{selected:tab===t.tab}} key={t.tab}
        style={[s.navTab,tab===t.tab&&{backgroundColor:C.elevated}]} onPress={()=>setTab(t.tab)}>
        <T size={22} color={tab===t.tab?C.energy:C.dim}>{t.glyph}</T>
        <T size={10} color={tab===t.tab?C.ink:C.sub}>{t.tab}</T>
      </Pressable>)}
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
  top:{paddingTop:Platform.OS==='android'?(StatusBar.currentHeight??26)+15:52,paddingHorizontal:18,paddingBottom:17,
    flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderColor:C.border},
  levelPill:{paddingHorizontal:10,paddingVertical:9,borderColor:'#7F6541',borderWidth:1,borderRadius:14,backgroundColor:'#2B2730'},
  content:{padding:16,paddingBottom:40},
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
  nav:{flexDirection:'row',borderTopWidth:1,borderColor:C.border,backgroundColor:C.surface,
    paddingBottom:Platform.OS==='ios'?20:12,paddingTop:8,paddingHorizontal:5},
  navTab:{flex:1,alignItems:'center',gap:3,paddingVertical:5,borderRadius:11,minHeight:49},
  modalBackdrop:{flex:1,backgroundColor:'#030914D9',justifyContent:'flex-end'},
  modalSheet:{backgroundColor:C.surface,borderTopLeftRadius:24,borderTopRightRadius:24,padding:20,maxHeight:'92%'},
  input:{borderWidth:1,borderColor:C.border,borderRadius:12,backgroundColor:C.elevated,color:C.ink,
    paddingVertical:12,paddingHorizontal:13,fontSize:15,minHeight:47},
  formLabel:{marginTop:19,marginBottom:9},
});
