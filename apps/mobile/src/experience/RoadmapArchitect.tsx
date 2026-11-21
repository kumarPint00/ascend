import React,{useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,KeyboardAvoidingView,Platform,Pressable,ScrollView,
  StyleSheet,TextInput,View} from 'react-native';
import {CalendarClock,CheckCircle2,ChevronDown,ChevronLeft,ChevronUp,
  Circle,LockKeyhole,Sparkles} from 'lucide-react-native';
import {compileRoadmapPack,localDayKey,roadmapDate,type RoadmapPlan,
  type RoadmapDuration} from '@ascend/game-engine';
import {Action,Chip,T} from '../components/Elements';
import {C} from '../theme';
import {generateGroqRoadmap,type StartingLevel,type RoadmapProgress} from '../ai/roadmap-generator';
import {hasGroqKey,saveGroqKey} from '../ai/groq';

/** Dedicated roadmap flow. Model text is untrusted until the pure engine
 * validates each dated achievement. The entire selection is reviewable and
 * explicitly approved before one atomic, idempotent import.
 */
export function RoadmapArchitect({initialIntent,onBack,onApprove}:{
  initialIntent:string;onBack:()=>void;onApprove:(packJson:string)=>Promise<void>;
}){
  const [intent,setIntent]=useState(initialIntent);
  const [duration,setDuration]=useState<RoadmapDuration>(30);
  const [level,setLevel]=useState<StartingLevel>('beginner');
  const [minutes,setMinutes]=useState(45);
  const [startDate,setStartDate]=useState(localDayKey(new Date()));
  const [hasKey,setHasKey]=useState(false);
  const [keyOpen,setKeyOpen]=useState(false);
  const [key,setKey]=useState('');
  const [approvedCloud,setApprovedCloud]=useState(false);
  const [plan,setPlan]=useState<RoadmapPlan|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [progress,setProgress]=useState<RoadmapProgress|null>(null);
  const [days,setDays]=useState<number[]>([]);
  const [weeks,setWeeks]=useState<number[]>([]);
  const [months,setMonths]=useState<number[]>([]);
  const [openWeeks,setOpenWeeks]=useState<number[]>([1]);
  const [editingDay,setEditingDay]=useState<number|null>(null);
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>{void hasGroqKey().then(setHasKey).catch(()=>setHasKey(false));},[]);
  useEffect(()=>()=>{controller.current?.abort();},[]);
  const abandonPlan=()=>{setPlan(null);setProgress(null);setMessage('');};
  const saveKey=async()=>{
    try{
      await saveGroqKey(key);
      setKey('');setKeyOpen(false);setHasKey(true);
      setMessage('Personal Groq key saved on this device.');
    }catch(e){Alert.alert('Key could not be saved',e instanceof Error?e.message:String(e));}
  };
  const generate=async()=>{
    if(busy)return;
    if(!hasKey){Alert.alert('Groq key required','Configure your personal Groq key to generate detailed roadmaps.');return;}
    if(!approvedCloud){Alert.alert('Cloud permission required','Approve sending your goal to Groq for this roadmap.');return;}
    if(intent.trim().length<4){Alert.alert('Describe a goal','Enter a clear skill or habit you want to develop.');return;}
    // A date is validated by the game engine, not by the AI.
    try{roadmapDate(startDate,duration);}catch(e){
      Alert.alert('Invalid start date','Enter a real YYYY-MM-DD date.');return;
    }
    abandonPlan();
    const task=new AbortController();controller.current=task;
    setBusy(true);
    try{
      const p=await generateGroqRoadmap({intent,duration,startingLevel:level,
        startDate,dailyMinutes:minutes},setProgress,task.signal);
      if(task.signal.aborted)return;
      setPlan(p);
      setDays(p.weeks.flatMap(w=>w.days.map(d=>d.day)));
      setWeeks(p.weeks.map(w=>w.week));
      setMonths(p.monthlyAchievements.map(m=>m.month));
      setOpenWeeks([1]);
      setMessage('Detailed learning plan ready. Review every task before importing.');
    }catch(e){
      if(!task.signal.aborted)setMessage(e instanceof Error?e.message:'Could not generate roadmap');
    }finally{
      if(controller.current===task){controller.current=null;setBusy(false);}
    }
  };
  const changeDay=(day:number,field:'title'|'deliverable',value:string)=>{
    setPlan(old=>old?{...old,weeks:old.weeks.map(w=>({
      ...w,days:w.days.map(d=>d.day===day?{...d,[field]:value}:d)
    }))}:old);
  };
  const changeWeek=(week:number,value:string)=>{
    setPlan(old=>old?{...old,weeks:old.weeks.map(w=>
      w.week===week?{...w,achievement:value}:w)}:old);
  };
  const changeMonth=(month:number,value:string)=>{
    setPlan(old=>old?{...old,monthlyAchievements:old.monthlyAchievements.map(m=>
      m.month===month?{...m,proof:value}:m)}:old);
  };
  const toggle=(values:number[],change:(n:number[])=>void,id:number)=>
    change(values.includes(id)?values.filter(x=>x!==id):[...values,id]);
  const chosen=days.length+weeks.length+months.length;
  const importPlan=async()=>{
    if(!plan||busy)return;
    try{
      const pack=compileRoadmapPack(plan,{days,weeks,months});
      if(pack.quests.some(q=>q.description.trim().length<10||q.title.trim().length<4))
        throw Error('Review incomplete day descriptions before importing');
      setBusy(true);
      await onApprove(JSON.stringify(pack));
    }catch(e){
      Alert.alert('Roadmap was not imported',e instanceof Error?e.message:String(e));
    }finally{setBusy(false);}
  };
  const Selected=({checked}:{checked:boolean})=>checked?
    <CheckCircle2 size={20} color={C.green}/>:<Circle size={20} color={C.sub}/>;
  return <KeyboardAvoidingView style={ss.screen}
    behavior={Platform.OS==='ios'?'padding':'height'}>
    <View style={ss.top}>
      <Pressable accessibilityRole="button" accessibilityLabel="Return to single quest architect"
        onPress={onBack} style={ss.back}><ChevronLeft size={20} color={C.energy}/></Pressable>
      <View style={{flex:1}}>
        <T size={10} color={C.energy} bold>ASCEND · AI LEARNING ARCHITECT</T>
        <T size={23} bold>Detailed Roadmap</T>
      </View>
      <CalendarClock size={23} color={C.gold}/>
    </View>
    <ScrollView style={{flex:1}} contentContainerStyle={ss.content}
      keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
      <View style={ss.intro}>
        <Sparkles size={24} color={C.gold}/>
        <View style={{flex:1}}>
          <T bold size={15}>Turn a goal into daily achievements</T>
          <T color={C.sub} size={12} style={{marginTop:6}}>
            A structured curriculum, daily proof of work, weekly assessments and
            monthly milestones. You decide what enters your quests.
          </T>
        </View>
      </View>
      {!plan&&<>
        <T size={12} color={C.sub} bold>WHAT DO YOU WANT TO MASTER?</T>
        <TextInput accessibilityLabel="Roadmap learning objective" multiline value={intent}
          onChangeText={setIntent} maxLength={420} style={ss.input}
          placeholder="e.g. Build real LLM apps with Python, RAG, evaluations and agents"
          placeholderTextColor={C.dim}/>
        <T size={12} color={C.sub} bold>MY CURRENT LEVEL</T>
        <View style={ss.chips}>
          {(['beginner','intermediate','advanced'] as StartingLevel[]).map(value=>
            <Chip key={value} active={value===level} onPress={()=>setLevel(value)}>
              {value.toUpperCase()}
            </Chip>)}
        </View>
        <T size={12} color={C.sub} bold>ROADMAP DURATION</T>
        <View style={ss.chips}>
          {([30,60,90] as RoadmapDuration[]).map(value=>
            <Chip key={value} active={value===duration} onPress={()=>setDuration(value)}>
              {value} DAYS
            </Chip>)}
        </View>
        <T size={12} color={C.sub} bold>TIME AVAILABLE DAILY</T>
        <View style={ss.chips}>
          {[20,30,45,60,90].map(value=>
            <Chip key={value} active={value===minutes} onPress={()=>setMinutes(value)}>
              {value} MIN
            </Chip>)}
        </View>
        <T size={12} color={C.sub} bold>START DATE</T>
        <TextInput accessibilityLabel="Roadmap start date YYYY-MM-DD" value={startDate}
          onChangeText={setStartDate} style={ss.date} maxLength={10}
          placeholder="YYYY-MM-DD" placeholderTextColor={C.dim}/>
        <View style={ss.private}>
          <LockKeyhole size={18} color={C.energy}/>
          <View style={{flex:1}}>
            <T color={C.frost} bold size={13}>Groq Cloud · Personal key</T>
            <T color={C.sub} size={11} style={{marginTop:4}}>
              {hasKey?'Key configured on device.':'No personal Groq key saved yet.'}
              {' '}Roadmap generation uses cloud requests, not Gemini Nano.
            </T>
          </View>
        </View>
        {!hasKey&&<Action secondary onPress={()=>setKeyOpen(true)}>
          CONFIGURE GROQ KEY
        </Action>}
        {keyOpen&&<View>
          <TextInput value={key} onChangeText={setKey} style={ss.date} secureTextEntry
            accessibilityLabel="Personal Groq API key" autoCapitalize="none"
            autoCorrect={false} placeholder="gsk_…" placeholderTextColor={C.dim}/>
          <Action disabled={!key.trim()} onPress={()=>void saveKey()}>SAVE KEY SECURELY</Action>
        </View>}
        <Pressable accessibilityRole="checkbox"
          accessibilityState={{checked:approvedCloud}} onPress={()=>setApprovedCloud(x=>!x)}
          style={ss.consent}>
          <Selected checked={approvedCloud}/>
          <T color={C.sub} size={12} style={{flex:1}}>
            I allow my goal and settings to be sent to Groq. Don't include confidential
            personal records. This approval is only for this roadmap session.
          </T>
        </Pressable>
        <T color={C.dim} size={11} style={{marginBottom:11}}>
          Generates one curriculum request plus one request per week. Free Groq quotas
          may interrupt large roadmaps; incomplete plans are never imported.
        </T>
        <Action disabled={busy||!hasKey||!approvedCloud||intent.trim().length<4}
          onPress={()=>void generate()}>
          {busy?'GENERATING ROADMAP…':'GENERATE FULL ROADMAP'}
        </Action>
      </>}
      {busy&&<View style={ss.progress}>
        <ActivityIndicator color={C.energy}/>
        <T size={12} color={C.frost} style={{marginTop:8}}>
          {progress?.message??'Saving your reviewed plan…'}
        </T>
        {!!progress&&<T size={11} color={C.sub}>
          {progress.complete} of {progress.total} stages generated
        </T>}
        {controller.current&&<Action secondary onPress={()=>controller.current?.abort()}>
          CANCEL GENERATION
        </Action>}
      </View>}
      {!!message&&<T color={C.gold} size={12} style={{marginVertical:12}}>{message}</T>}
      {plan&&<>
        <View style={ss.summary}>
          <T color={C.gold} size={11} bold>YOUR {plan.durationDays}-DAY LEARNING JOURNEY</T>
          <TextInput accessibilityLabel="Edit roadmap goal title" value={plan.title} maxLength={90}
            onChangeText={title=>setPlan(p=>p?{...p,title}:p)}
            style={[ss.date,{fontWeight:'700',fontSize:17}]}/>
          <T color={C.sub} size={12}>{plan.objective}</T>
          <T color={C.energy} size={11} bold style={{marginTop:11}}>
            {plan.weeks.length} WEEKS · {plan.monthlyAchievements.length} MONTHLY CHECKPOINTS ·
            {' '}{plan.durationDays} DAILY TASKS
          </T>
          <T color={C.sub} size={11} style={{marginTop:6}}>
            Starts {plan.startDate}. Daily tasks are dated one-off achievements,
            not repeating daily habits.
          </T>
        </View>
        <View style={ss.metrics}>
          <T color={C.frost} size={14} bold>{chosen} achievements selected</T>
          <Pressable accessibilityRole="button" onPress={()=>{
            setDays(plan.weeks.flatMap(w=>w.days.map(d=>d.day)));
            setWeeks(plan.weeks.map(w=>w.week));
            setMonths(plan.monthlyAchievements.map(m=>m.month));
          }}><T color={C.energy} bold size={12}>SELECT ALL</T></Pressable>
        </View>
        {plan.monthlyAchievements.map(m=><View key={'m'+m.month} style={ss.milestone}>
          <Pressable accessibilityRole="checkbox" accessibilityState={{checked:months.includes(m.month)}}
            onPress={()=>toggle(months,setMonths,m.month)} style={ss.line}>
            <Selected checked={months.includes(m.month)}/>
            <View style={{flex:1}}>
              <T color={C.gold} bold size={13}>MONTH {m.month} · {m.title}</T>
              <T color={C.sub} size={10}>Due {roadmapDate(plan.startDate,Math.min(plan.durationDays,m.month*30))}</T>
            </View>
          </Pressable>
          <TextInput accessibilityLabel={'Month '+m.month+' evidence'} multiline maxLength={210}
            value={m.proof} onChangeText={v=>changeMonth(m.month,v)} style={ss.evidence}/>
        </View>)}
        <T color={C.energy} size={12} bold style={{marginTop:15,marginBottom:8}}>
          YOUR WEEK-BY-WEEK DAILY PLAN
        </T>
        {plan.weeks.map(w=>{
          const open=openWeeks.includes(w.week);
          const included=w.days.filter(d=>days.includes(d.day)).length;
          return <View key={'w'+w.week} style={ss.week}>
            <Pressable accessibilityRole="button" accessibilityLabel={'Expand week '+w.week}
              onPress={()=>toggle(openWeeks,setOpenWeeks,w.week)} style={ss.line}>
              <View style={{flex:1}}>
                <T size={15} color={C.frost} bold>Week {w.week} · {w.theme}</T>
                <T size={11} color={C.sub} style={{marginTop:3}}>
                  {included}/{w.days.length} days selected
                </T>
              </View>
              {open?<ChevronUp color={C.energy}/>:<ChevronDown color={C.energy}/>}
            </Pressable>
            {open&&<>
              <Pressable accessibilityRole="checkbox"
                accessibilityState={{checked:weeks.includes(w.week)}}
                onPress={()=>toggle(weeks,setWeeks,w.week)}
                style={[ss.line,{marginTop:10,backgroundColor:'#1E2C46'}]}>
                <Selected checked={weeks.includes(w.week)}/>
                <View style={{flex:1}}>
                  <T color={C.gold} size={12} bold>Weekly achievement</T>
                  <T color={C.sub} size={11}>Due day {Math.min(plan.durationDays,w.week*7)}</T>
                </View>
              </Pressable>
              <TextInput multiline maxLength={210} style={ss.evidence}
                accessibilityLabel={'Week '+w.week+' achievement evidence'}
                value={w.achievement} onChangeText={v=>changeWeek(w.week,v)}/>
              {w.days.map(d=><View key={d.day} style={ss.day}>
                <Pressable accessibilityRole="checkbox"
                  accessibilityState={{checked:days.includes(d.day)}}
                  onPress={()=>toggle(days,setDays,d.day)} style={ss.line}>
                  <Selected checked={days.includes(d.day)}/>
                  <View style={{flex:1}}>
                    <T size={12} bold color={C.frost}>DAY {d.day} · {d.title}</T>
                    <T size={10} color={C.sub} style={{marginTop:4}}>
                      {roadmapDate(plan.startDate,d.day)} · {d.minutes} minutes
                    </T>
                    {editingDay!==d.day&&<T size={11} color={C.sub} style={{marginTop:5}}>
                      Proof: {d.deliverable}
                    </T>}
                  </View>
                </Pressable>
                <Pressable accessibilityRole="button"
                  onPress={()=>setEditingDay(editingDay===d.day?null:d.day)}
                  style={{alignSelf:'flex-end',paddingVertical:8}}>
                  <T color={C.energy} size={11} bold>
                    {editingDay===d.day?'DONE EDITING':'EDIT TASK'}
                  </T>
                </Pressable>
                {editingDay===d.day&&<>
                  <TextInput maxLength={85} value={d.title} style={ss.evidence}
                    accessibilityLabel={'Day '+d.day+' title'}
                    onChangeText={v=>changeDay(d.day,'title',v)}/>
                  <TextInput maxLength={260} value={d.deliverable} multiline style={ss.evidence}
                    accessibilityLabel={'Day '+d.day+' proof'}
                    onChangeText={v=>changeDay(d.day,'deliverable',v)}/>
                </>}
              </View>)}
            </>}
          </View>;
        })}
        <T color={C.sub} size={11} style={{marginTop:12,marginBottom:10}}>
          Import creates one goal with scheduled daily tasks and weekly/monthly
          milestones. No XP is granted until you actually complete them.
          Existing progress is never overwritten.
        </T>
        <Action disabled={busy||chosen===0} onPress={()=>void importPlan()}>
          IMPORT {chosen} APPROVED ACHIEVEMENTS
        </Action>
        <View style={{marginTop:10}}>
          <Action secondary disabled={busy} onPress={abandonPlan}>DISCARD AND REGENERATE</Action>
        </View>
      </>}
      <View style={{height:42}}/>
    </ScrollView>
  </KeyboardAvoidingView>;
}
const ss=StyleSheet.create({
  screen:{flex:1,backgroundColor:C.bg},
  top:{paddingTop:Platform.OS==='android'?48:61,paddingHorizontal:17,paddingBottom:14,
    flexDirection:'row',alignItems:'center',gap:11,borderBottomWidth:1,borderColor:'#324A6B'},
  back:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'},
  content:{paddingHorizontal:18,paddingTop:18,paddingBottom:70},
  intro:{flexDirection:'row',gap:12,backgroundColor:'#172741',
    borderWidth:1,borderColor:'#426A8F',padding:15,borderRadius:18,marginBottom:19},
  input:{minHeight:90,backgroundColor:'#13253E',borderWidth:1,borderColor:'#54749A',
    color:C.ink,borderRadius:13,padding:13,marginTop:8,marginBottom:18,fontSize:16,textAlignVertical:'top'},
  date:{backgroundColor:'#13253E',borderWidth:1,borderColor:'#54749A',color:C.ink,
    borderRadius:12,padding:12,minHeight:48,marginTop:7,marginBottom:12,fontSize:16},
  chips:{flexDirection:'row',flexWrap:'wrap',marginBottom:14,marginTop:7},
  private:{flexDirection:'row',alignItems:'center',gap:11,padding:12,
    backgroundColor:'#102D3E',borderRadius:13,marginTop:6,marginBottom:8},
  consent:{flexDirection:'row',gap:9,alignItems:'center',paddingVertical:17,minHeight:55},
  progress:{alignItems:'center',gap:9,padding:19,marginVertical:12,
    borderRadius:13,backgroundColor:'#1D2C45'},
  summary:{backgroundColor:'#1B2D4A',padding:16,borderRadius:18,borderWidth:1,borderColor:'#4B759B'},
  metrics:{marginTop:18,marginBottom:9,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  milestone:{padding:13,backgroundColor:'#2C2B45',borderRadius:15,marginBottom:9},
  week:{padding:13,backgroundColor:'#16273F',borderRadius:16,marginBottom:11,
    borderWidth:1,borderColor:'#304E73'},
  line:{flexDirection:'row',alignItems:'center',gap:9,minHeight:46,paddingVertical:7},
  evidence:{color:C.ink,fontSize:13,backgroundColor:'#122039',borderRadius:10,
    borderWidth:1,borderColor:'#4C688D',padding:10,minHeight:54,marginTop:7},
  day:{borderTopWidth:1,borderColor:'#34455E',paddingVertical:10,marginTop:7}
});
