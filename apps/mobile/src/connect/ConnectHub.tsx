import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,Alert,AppState,Modal,Pressable,ScrollView,
  StyleSheet,TextInput,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {BookOpen,CalendarDays,CheckCircle2,ChevronLeft,DatabaseBackup,FilePlus2,
  GitBranch,HeartPulse,Inbox,KeyRound,Mail,RefreshCw,ShieldCheck,Trash2,
  LockKeyhole} from 'lucide-react-native';
import {type ContextCandidate,type ContextSource,
  type ChatGPTConversation,parseChatGPTConversations,extractChatGPTSelection,
  fromSharedText,validateContextCandidate} from '@ascend/game-engine';
import {C} from '../theme';
import {T,Panel,Action,Chip,Section} from '../components/Elements';
import {listConnectedSources,setContextSourceEnabled,importContextItems,
  listContextItems,deleteContextItem,disconnectContextSource,
  recordContextDecision,setContextRetention,exportProtectedContext,restoreProtectedContext,
  purgeExpiredContext,type ContextItem,type SourceState} from '../data/context';
import {connectGoogle,syncCalendar,syncGmail,syncDrive,
  connectGitHubToken,syncGitHub,syncHealth,healthStatus,requestHealthPermissions,revokeGoogle} from './providers';
import {decideAdaptiveProposal} from '../data/adaptive';

const names:Record<ContextSource,string>={
  share:'Share to ASCEND',chatgpt:'ChatGPT',health:'Health Connect',
  calendar:'Google Calendar',gmail:'Gmail',github:'GitHub',drive:'Google Drive',file:'Files'
};
const descriptions:Record<ContextSource,string>={
  share:'WhatsApp, web pages and selected shared text',
  chatgpt:'Select conversations from your exported conversations.json',
  health:'Read-only steps, sleep, exercise and heart-rate summaries',
  calendar:'Read-only primary calendar and upcoming appointments',
  gmail:'Read-only recent email subject and preview',
  github:'Assigned issues via your read-only fine-grained token',
  drive:'Read-only file names and descriptions, not document bodies',
  file:'Select local text or document metadata via Android picker'
};
const icons:Record<ContextSource,typeof Inbox>={
  share:Inbox,chatgpt:BookOpen,health:HeartPulse,calendar:CalendarDays,
  gmail:Mail,github:GitBranch,drive:FilePlus2,file:FilePlus2
};
const sources:ContextSource[]=['share','chatgpt','health','calendar','gmail','github','drive','file'];
const nonce=()=>Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9);
const warn=(title:string,error:unknown)=>Alert.alert(title,error instanceof Error?error.message:String(error));
export function ConnectHub({onBack,initialShare,onShareConsumed,onAnalyzeWithAI}:{
  onBack:()=>void;initialShare?:string|null;onShareConsumed?:()=>void;
  onAnalyzeWithAI?:(text:string)=>void;
}){
  const [statuses,setStatuses]=useState<SourceState[]>([]);
  const [items,setItems]=useState<ContextItem[]>([]);
  const [busy,setBusy]=useState(false);
  const [search,setSearch]=useState('');
  const [sourceFilter,setSourceFilter]=useState<ContextSource|null>(null);
  const [connection,setConnection]=useState<ContextSource|null>(null);
  const [clientInput,setClientInput]=useState('');
  const [shareText,setShareText]=useState<string|null>(null);
  const [exportMode,setExportMode]=useState<'export'|'restore'|null>(null);
  const [passphrase,setPassphrase]=useState('');
  const [restoreBlob,setRestoreBlob]=useState<string|null>(null);
  const [chatFile,setChatFile]=useState('');
  const [chatPreview,setChatPreview]=useState<ChatGPTConversation[]>([]);
  const [selectedChat,setSelectedChat]=useState<string[]>([]);
  const [showChatImport,setShowChatImport]=useState(false);
  const [healthDays,setHealthDays]=useState<7|14|30>(7);
  const [healthAccess,setHealthAccess]=useState<{available:boolean;granted:string[]}>({
    available:false,granted:[]
  });
  const refresh=useCallback(async()=>{
    const [s,list,h]=await Promise.all([
      listConnectedSources(),listContextItems(undefined,100),healthStatus()
    ]);
    setStatuses(s);setItems(list);setHealthAccess(h);
  },[]);
  useEffect(()=>{
    void purgeExpiredContext().then(refresh).catch(e=>warn('Cannot open Connections',e));
    const sub=AppState.addEventListener('change',state=>{
      if(state==='active')void refresh().catch(()=>{});
    });
    return ()=>sub.remove();
  },[refresh]);
  useEffect(()=>{
    if(initialShare?.trim()){setShareText(initialShare);onShareConsumed?.();}
  },[initialShare,onShareConsumed]);
  const run=async(work:()=>Promise<void>)=>{
    if(busy)return;setBusy(true);
    try{await work();await refresh();}
    catch(e){warn('ASCEND Connect',e);}
    finally{setBusy(false);}
  };
  const enabled=(source:ContextSource)=>statuses.find(s=>s.source===source)?.enabled??false;
  const activate=(source:ContextSource)=>void run(async()=>{
    await setContextSourceEnabled(source,!enabled(source));
  });
  const sync=(source:ContextSource)=>void run(async()=>{
    let result:{added:number;skipped:number};
    if(source==='calendar')result=await syncCalendar();
    else if(source==='gmail')result=await syncGmail();
    else if(source==='drive')result=await syncDrive();
    else if(source==='github')result=await syncGitHub();
    else if(source==='health')result=await syncHealth(healthDays);
    else throw Error('Use import or Share Sheet to capture this source');
    Alert.alert('Sync completed',result.added+' new · '+result.skipped+' already imported');
  });
  const connect=()=>void run(async()=>{
    if(!connection)return;
    if(connection==='github')await connectGitHubToken(clientInput);
    else if(connection==='calendar'||connection==='gmail'||connection==='drive')
      await connectGoogle(connection,clientInput);
    else throw Error('This source does not need an account sign-in');
    setConnection(null);setClientInput('');
  });
  const chooseChatGPT=()=>void run(async()=>{
    if(!enabled('chatgpt'))throw Error('Enable ChatGPT imports first');
    const r=await DocumentPicker.getDocumentAsync({
      type:['application/json','text/plain','*/*'],copyToCacheDirectory:true
    });
    if(r.canceled||!r.assets.length)return;
    if((r.assets[0].size??0)>25_000_000)throw Error('Choose an extracted conversations.json under 25MB');
    const text=await FileSystem.readAsStringAsync(r.assets[0].uri);
    const conversations=parseChatGPTConversations(text);
    setChatFile(text);setChatPreview(conversations);
    setSelectedChat([]);setShowChatImport(true);
  });
  const importChosenChat=()=>void run(async()=>{
    if(selectedChat.length<1)throw Error('Select at least one conversation');
    const candidates=extractChatGPTSelection(chatFile,selectedChat);
    const result=await importContextItems('chatgpt',candidates);
    setChatFile('');setChatPreview([]);setSelectedChat([]);setShowChatImport(false);
    Alert.alert('Knowledge imported',result.added+' private conversations added. No quests were created.');
  });
  const saveShare=()=>void run(async()=>{
    if(!shareText)throw Error('Nothing selected');
    if(!enabled('share'))throw Error('Enable Share to ASCEND first');
    const candidate=fromSharedText(shareText,'shared:'+nonce());
    await importContextItems('share',[candidate]);
    setShareText(null);
  });
  const chooseFiles=()=>void run(async()=>{
    if(!enabled('file'))throw Error('Enable file imports first');
    const result=await DocumentPicker.getDocumentAsync({
      type:'*/*',multiple:true,copyToCacheDirectory:true
    });
    if(result.canceled)return;
    const candidates:ContextCandidate[]=[];
    for(const x of result.assets.slice(0,15)){
      const isText=/text\/|application\/json/.test(x.mimeType??'');
      const excerpt=isText&&(x.size??0)<=15000?
        (await FileSystem.readAsStringAsync(x.uri)).slice(0,3000):
        'File metadata only. PDF and image contents were not analyzed.';
      const candidate=validateContextCandidate({
        source:'file',externalId:'file:'+nonce(),kind:'document',
        title:x.name.slice(0,140)||'Imported file',
        excerpt:excerpt.replace(/[\x00-\x1F]/g,' ').slice(0,3500),
        occurredAt:null,sensitivity:'private',originUrl:null
      });
      candidates.push(candidate);
    }
    const imported=await importContextItems('file',candidates);
    Alert.alert('Files saved',imported.added+' encrypted file references added. Original attachments remain in their source apps.');
  });
  const acceptDraft=(item:ContextItem)=>void run(async()=>{
    if(!item.draft)throw Error('No high-confidence action suggestion');
    const draft=item.draft;
    const hash=(item.source+':'+item.externalId).split('').reduce(
      (n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,2166136261);
    await decideAdaptiveProposal({
      id:'context:'+hash.toString(36),kind:'quest',sourceId:'context:'+hash.toString(36),
      title:draft.title.slice(0,100),description:draft.description,
      reason:draft.reason,attribute:'discipline',goalId:null,difficulty:'easy',
      repeatRule:'once',estimateMinutes:draft.estimatedMinutes,status:'backlog',
      evidence:{basis:'user-preference',periodDays:0,opportunities:0,completed:0,ratio:0}
    },'accepted',{title:draft.title.slice(0,100),minutes:draft.estimatedMinutes});
    await recordContextDecision(item.source,item.externalId,'accepted');
    Alert.alert('Draft created','Quest added to Backlog. No XP awarded.');
  });
  const dismiss=(item:ContextItem)=>void run(async()=>{
    await recordContextDecision(item.source,item.externalId,'dismissed');
  });
  const doExport=()=>void run(async()=>{
    if(passphrase.length<12)throw Error('Use an export passphrase of 12+ characters');
    if(exportMode==='export'){
      const encrypted=await exportProtectedContext(passphrase);
      if(!FileSystem.documentDirectory)throw Error('Device file storage unavailable');
      const uri=FileSystem.documentDirectory+'ASCEND-private-context-'+
        new Date().toISOString().slice(0,10)+'.ascend';
      await FileSystem.writeAsStringAsync(uri,encrypted,{encoding:FileSystem.EncodingType.UTF8});
      if(!await Sharing.isAvailableAsync())throw Error('Android share not available');
      await Sharing.shareAsync(uri,{mimeType:'text/plain',dialogTitle:'Save encrypted ASCEND Context'});
    }else{
      if(!restoreBlob)throw Error('Choose an encrypted backup file');
      const count=await restoreProtectedContext(restoreBlob,passphrase);
      Alert.alert('Context restored',count+' records restored with all sources paused until re-authorized.');
    }
    setPassphrase('');setRestoreBlob(null);setExportMode(null);
  });
  const chooseProtected=()=>void run(async()=>{
    const selected=await DocumentPicker.getDocumentAsync({type:'*/*',copyToCacheDirectory:true});
    if(selected.canceled)return;
    const file=selected.assets[0];
    if((file.size??0)>9_000_000)throw Error('Encrypted backup exceeds the limit');
    const data=await FileSystem.readAsStringAsync(file.uri);
    if(!data.trim().startsWith('ascend-private-v1:'))throw Error('Not a protected ASCEND context file');
    setRestoreBlob(data);
  });
  const disconnect=(source:ContextSource)=>Alert.alert('Disconnect '+names[source]+'?',
    'Delete all locally imported records, source settings, and pending decisions? Original data in the provider is not deleted.',[
      {text:'Cancel',style:'cancel'},
      {text:'Delete local context',style:'destructive',onPress:()=>void run(async()=>{
        if(source==='calendar'||source==='gmail'||source==='drive')await revokeGoogle(source);
        await disconnectContextSource(source);
      })}
    ]);
  const filtered=useMemo(()=>items.filter(i=>(!sourceFilter||i.source===sourceFilter)&&
    (i.title+' '+i.excerpt).toLowerCase().includes(search.trim().toLowerCase())),
    [items,sourceFilter,search]);
  return <View style={{gap:12}}>
    <Pressable accessibilityRole="button" onPress={onBack} style={st.back}>
      <ChevronLeft size={18} color={C.energy}/><T color={C.energy} bold size={12}>BACK TO ASCEND</T>
    </Pressable>
    <LinearGradient colors={['#233B5D','#12284B','#111532']} style={st.hero}>
      <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
        <View style={st.emblem}><ShieldCheck size={28} color={C.energy}/></View>
        <View style={{flex:1}}>
          <T color={C.energy} size={10} bold style={{letterSpacing:2}}>MY UNIVERSE / CONTEXT</T>
          <T size={24} bold>ASCEND Connect</T>
        </View>
      </View>
      <T color={C.sub} size={12} style={{marginTop:12}}>
        Import only what you approve. Sensitive text is encrypted with Android Keystore.
        External actions and new quests require confirmation.
      </T>
      <T color={C.gold} size={11} style={{marginTop:9}}>
        Local context is excluded from ordinary plaintext progress backups.
        Export it separately with a passphrase.
      </T>
    </LinearGradient>
    <Section title="Connected Sources"/>
    {sources.map(source=>{
      const Icon=icons[source],state=statuses.find(s=>s.source===source);
      return <Panel key={source} style={{marginBottom:8}}>
        <View style={st.between}>
          <View style={{flex:1,flexDirection:'row',alignItems:'center',gap:10}}>
            <Icon size={23} color={source==='health'?C.green:C.energy}/>
            <View style={{flex:1}}>
              <T bold size={14}>{names[source]}</T>
              <T color={C.sub} size={11}>{descriptions[source]}</T>
            </View>
          </View>
          <Chip active={!!state?.enabled} onPress={()=>activate(source)}>
            {state?.enabled?'ON':'OFF'}
          </Chip>
        </View>
        {state?.enabled&&<>
          <T color={C.dim} size={10} style={{marginTop:8}}>
            {state.count} local items · Last sync: {state.lastSyncedAt?new Date(state.lastSyncedAt).toLocaleDateString():'never'}
          </T>
          <View style={{flexDirection:'row',flexWrap:'wrap',alignItems:'center',marginTop:7}}>
            <T color={C.dim} size={10}>Retention: </T>
            {([7,14,30,90,180] as const).map(days=><Chip key={days}
              active={state.retentionDays===days} onPress={()=>void run(
                ()=>setContextRetention(source,days))}>{days}d</Chip>)}
          </View>
          <View style={st.actions}>
            {(['calendar','gmail','drive','github'] as ContextSource[]).includes(source)&&
              <Action secondary onPress={()=>{setConnection(source);setClientInput('');}}>
                CONNECT ACCOUNT
              </Action>}
            {(['calendar','gmail','drive','github','health'] as ContextSource[]).includes(source)&&
              <Action secondary disabled={busy} onPress={()=>sync(source)}>SYNC READ-ONLY</Action>}
            {source==='health'&&<View style={{flexDirection:'row',flexWrap:'wrap'}}>
              {([7,14,30] as const).map(days=><Chip key={days}
                active={healthDays===days} onPress={()=>setHealthDays(days)}>{days} days</Chip>)}
            </View>}
            {source==='health'&&<Action secondary disabled={busy}
              onPress={()=>void run(async()=>{await requestHealthPermissions();
                Alert.alert('Health permissions','Approve the selected data types in Android Health Connect and return to ASCEND.');
              })}>GRANT HEALTH ACCESS</Action>}
            {source==='chatgpt'&&<Action secondary onPress={()=>void chooseChatGPT()}>
              IMPORT CHATGPT JSON</Action>}
            {source==='share'&&<Action secondary onPress={()=>setShareText('')}>
              PASTE SHARED MESSAGE</Action>}
            {source==='file'&&<Action secondary onPress={()=>void chooseFiles()}>
              PICK DOCUMENTS</Action>}
            <Action danger onPress={()=>disconnect(source)}>DISCONNECT & DELETE</Action>
          </View>
          {source==='health'&&<T color={C.dim} size={10}>
            Health Connect available: {healthAccess.available?'yes':'no'} ·
            Granted data types: {healthAccess.granted.length}. No automatic exercise goals.
          </T>}
        </>}
      </Panel>;
    })}
    <Section title="Context Inbox"/>
    <TextInput accessibilityLabel="Search imported context" value={search}
      onChangeText={setSearch} placeholder="Search approved local context"
      placeholderTextColor={C.dim} style={st.input}/>
    <View style={st.filters}>
      <Chip active={!sourceFilter} onPress={()=>setSourceFilter(null)}>All</Chip>
      {sources.filter(s=>items.some(i=>i.source===s)).map(s=><Chip
        key={s} active={sourceFilter===s} onPress={()=>setSourceFilter(s)}>{names[s]}</Chip>)}
    </View>
    {!filtered.length&&<Panel>
      <T color={C.sub}>No imported items yet. Enable a source and select what to import.</T>
    </Panel>}
    {filtered.map(item=><Panel key={item.id} style={{marginBottom:8}}>
      <View style={st.between}>
        <T color={C.energy} bold size={10}>{names[item.source].toUpperCase()} · {item.kind}</T>
        <Pressable accessibilityRole="button" accessibilityLabel="Delete imported item"
          onPress={()=>Alert.alert('Delete this item?','Remove only the local imported copy.',[
            {text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',
              onPress:()=>void run(()=>deleteContextItem(item.id))}
          ])}><Trash2 size={18} color={C.danger}/></Pressable>
      </View>
      <T bold size={14} style={{marginTop:6}}>{item.title}</T>
      <T size={11} color={C.sub} style={{marginTop:6}}>{item.excerpt.slice(0,550)}</T>
      {onAnalyzeWithAI&&item.sensitivity!=='health'&&
        <View style={{marginTop:10}}>
          <Action secondary onPress={()=>onAnalyzeWithAI(
            (item.title+' · '+item.excerpt).slice(0,420))}>
            REVIEW WITH ON-DEVICE AI
          </Action>
          <T color={C.dim} size={10} style={{marginTop:4}}>
            Sends only this selected excerpt to Gemini Nano after its own consent screen.
          </T>
        </View>}
      {!!item.draft&&!item.decision&&<View style={{marginTop:12,gap:7}}>
        <T color={C.gold} size={11}>{item.draft.reason}</T>
        <Action onPress={()=>Alert.alert('Create draft quest?',item.draft?.description??'',[
          {text:'Cancel',style:'cancel'},
          {text:'Approve to Backlog',onPress:()=>acceptDraft(item)}
        ])}>REVIEW & ADD TO BACKLOG</Action>
        <Action secondary onPress={()=>dismiss(item)}>NOT RELEVANT</Action>
      </View>}
      {item.decision&&<T color={C.dim} size={11} style={{marginTop:7}}>
        Suggestion {item.decision}. Imported source retained.
      </T>}
    </Panel>)}
    <Section title="Private Recovery & Privacy"/>
    <Panel>
      <View style={{gap:10}}>
        <Action secondary onPress={()=>{setExportMode('export');setPassphrase('');}}>
          EXPORT ENCRYPTED CONTEXT
        </Action>
        <Action secondary onPress={()=>{setExportMode('restore');setPassphrase('');}}>
          RESTORE ENCRYPTED CONTEXT
        </Action>
        <Action secondary onPress={()=>void run(async()=>{
          const count=await purgeExpiredContext();
          Alert.alert('Retention complete',count+' expired context records deleted');
        })}>DELETE EXPIRED CONTEXT</Action>
      </View>
      <T color={C.dim} size={11} style={{marginTop:12}}>
        Disconnecting a source deletes its local data and credentials, not the original provider data.
        Health access may also be revoked in Android Health Connect settings.
      </T>
    </Panel>
    <Modal visible={connection!==null} transparent animationType="slide" onRequestClose={()=>setConnection(null)}>
      <View style={st.overlay}><View style={st.sheet}>
        <View style={st.between}><T bold size={19}>
          Connect {connection?names[connection]:''}</T>
          <Pressable accessibilityRole="button" onPress={()=>setConnection(null)}>
            <T color={C.sub}>CLOSE ✕</T>
          </Pressable></View>
        <T color={C.sub} size={12} style={{marginTop:10}}>
          {connection==='github'?'Use a fine-grained GitHub token with read-only Issues and metadata permissions.':
            'Enter the Google OAuth installed-app client ID registered for com.ascendrpg.personal. Authorization uses a browser and read-only scopes. Some Google scopes may require app verification.'}
        </T>
        <TextInput accessibilityLabel="Connector client ID or read-only token"
          secureTextEntry={connection==='github'} value={clientInput} onChangeText={setClientInput}
          autoCapitalize="none" placeholder={connection==='github'?'github_pat_...':'xxxx.apps.googleusercontent.com'}
          placeholderTextColor={C.dim} style={[st.input,{marginVertical:15}]}/>
        <Action disabled={busy||!clientInput.trim()} onPress={connect}>CONNECT WITH CONSENT</Action>
      </View></View>
    </Modal>
    <Modal visible={shareText!==null} transparent animationType="slide" onRequestClose={()=>setShareText(null)}>
      <View style={st.overlay}><View style={st.sheet}>
        <View style={st.between}>
          <T bold size={18}>Capture selected message</T>
          <Pressable accessibilityRole="button" onPress={()=>setShareText(null)}>
            <T color={C.sub}>CLOSE ✕</T>
          </Pressable>
        </View>
        <T color={C.sub} size={12} style={{marginVertical:12}}>Review content before encrypting it locally. No WhatsApp chat access is granted.</T>
        <TextInput accessibilityLabel="Selected shared text" multiline
          style={[st.input,{height:155,textAlignVertical:'top'}]} value={shareText??''}
          onChangeText={setShareText} maxLength={3500}/>
        <View style={{marginTop:12}}><Action disabled={busy||!shareText?.trim()}
          onPress={saveShare}>SAVE PRIVATE COPY</Action></View>
      </View></View>
    </Modal>
    <Modal visible={showChatImport} transparent animationType="slide"
      onRequestClose={()=>setShowChatImport(false)}>
      <View style={st.overlay}><View style={[st.sheet,{maxHeight:'85%'}]}>
        <View style={st.between}>
          <T bold size={18}>Select ChatGPT conversations</T>
          <Pressable accessibilityRole="button" onPress={()=>setShowChatImport(false)}>
            <T color={C.sub}>CLOSE ✕</T>
          </Pressable>
        </View>
        <T color={C.sub} size={11} style={{marginVertical:12}}>
          Only selected conversation titles and recent user-authored text are stored.
          Assistant claims are not treated as verified personal facts.
        </T>
        <ScrollView style={{maxHeight:340}}>
          {chatPreview.slice(0,400).map(x=><Pressable accessibilityRole="checkbox"
            accessibilityState={{checked:selectedChat.includes(x.id)}}
            onPress={()=>setSelectedChat(v=>v.includes(x.id)?
              v.filter(a=>a!==x.id):v.length>=100?v:[...v,x.id])}
            style={st.pick} key={x.id}>
            <CheckCircle2 size={19} color={selectedChat.includes(x.id)?C.green:C.dim}/>
            <View style={{flex:1}}>
              <T size={13} bold>{x.title}</T>
              <T size={10} color={C.sub}>{x.messages} user messages · {x.preview.slice(0,140)}</T>
            </View>
          </Pressable>)}
        </ScrollView>
        <T color={C.sub} size={11} style={{marginVertical:11}}>
          Selected {selectedChat.length} / 100 · Total found {chatPreview.length}
        </T>
        <Action disabled={busy||selectedChat.length===0} onPress={importChosenChat}>
          IMPORT SELECTED CONVERSATIONS</Action>
      </View></View>
    </Modal>
    <Modal visible={exportMode!==null} transparent animationType="slide"
      onRequestClose={()=>setExportMode(null)}>
      <View style={st.overlay}><View style={st.sheet}>
        <View style={st.between}>
          <T size={18} bold>{exportMode==='export'?'Protected context export':'Restore protected context'}</T>
          <Pressable accessibilityRole="button" onPress={()=>setExportMode(null)}>
            <T color={C.sub}>CLOSE ✕</T>
          </Pressable>
        </View>
        <T color={C.sub} size={12} style={{marginTop:10}}>
          AES-GCM encryption with a passphrase-derived key. Your passphrase is not stored.
          If lost, the export cannot be recovered.
        </T>
        {exportMode==='restore'&&<View style={{marginTop:12}}>
          <Action secondary onPress={()=>void chooseProtected()}>CHOOSE ENCRYPTED FILE</Action>
          {restoreBlob&&<T color={C.green} size={11}>Encrypted file selected</T>}
        </View>}
        <TextInput secureTextEntry accessibilityLabel="Private context backup passphrase"
          autoCapitalize="none" placeholder="Passphrase (minimum 12 characters)"
          placeholderTextColor={C.dim} value={passphrase} onChangeText={setPassphrase}
          style={[st.input,{marginVertical:13}]}/>
        <Action disabled={busy||passphrase.length<12||(exportMode==='restore'&&!restoreBlob)}
          onPress={doExport}>{exportMode==='export'?'SAVE ENCRYPTED BACKUP':'RESTORE PROTECTED DATA'}</Action>
      </View></View>
    </Modal>
    {busy&&<View style={{alignItems:'center',marginBottom:12}}>
      <ActivityIndicator color={C.energy}/><T size={11} color={C.sub}>Processing locally…</T>
    </View>}
  </View>;
}
const st=StyleSheet.create({
  back:{flexDirection:'row',alignItems:'center',gap:7,paddingVertical:8},
  hero:{borderRadius:22,borderWidth:1,borderColor:'#5672A3',padding:18,marginBottom:5},
  emblem:{height:51,width:51,borderRadius:16,borderWidth:1,borderColor:'#739DBB',
    justifyContent:'center',alignItems:'center',backgroundColor:'#1E446A'},
  between:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
  actions:{gap:9,marginTop:14},
  input:{borderWidth:1,borderColor:'#42597A',borderRadius:13,paddingHorizontal:12,
    paddingVertical:12,backgroundColor:'#101D33',color:C.ink,fontSize:14,minHeight:49},
  filters:{flexDirection:'row',flexWrap:'wrap',gap:0,marginTop:7,marginBottom:6},
  overlay:{flex:1,backgroundColor:'#020613D9',justifyContent:'center',padding:17},
  sheet:{backgroundColor:'#14223A',borderWidth:1,borderColor:'#5775A0',
    borderRadius:22,padding:17},
  pick:{flexDirection:'row',alignItems:'center',gap:10,padding:12,borderBottomWidth:1,
    borderColor:'#293853',minHeight:60},
});
