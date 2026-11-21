import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Alert,Pressable,StyleSheet,TextInput,View} from 'react-native';
import {CheckCircle2,LockKeyhole,ShieldCheck} from 'lucide-react-native';
import {T,Action,Chip} from '../components/Elements';
import {C} from '../theme';
import {
  configuredProviders,deleteProviderKey,storeProviderKey,
  readProviderUsage,PROVIDER_MODELS,selectedModel,saveSelectedModel,
  selectedProvider,saveSelectedProvider,
  LIMIT_REQUESTS_PER_DAY,type CloudProvider,type ProviderChoice,
  type ProviderKeyState,type ProviderUsage,
} from '../ai/provider-manager';

const PROVIDERS:CloudProvider[]=['gemini','groq','openrouter','openai','claude'];
export interface ProviderSettingsProps {
  disabled?:boolean;onChange?:(choice:ProviderChoice,keys:ProviderKeyState)=>void;
}
/** Shared persistent BYOK/model manager for Single Quest and Full Roadmap.
 * No key is ever echoed to the UI, logged or kept in the local quest database.
 */
export function ProviderSettings({disabled=false,onChange}:ProviderSettingsProps){
  const notify=useRef(onChange);
  notify.current=onChange;
  const [keys,setKeys]=useState<ProviderKeyState>({gemini:false,groq:false,openrouter:false,openai:false,claude:false});
  const [choice,setChoice]=useState<ProviderChoice>('auto');
  const [models,setModels]=useState<Record<CloudProvider,string>>({
    gemini:'gemini-2.5-flash',groq:'openai/gpt-oss-20b',
    openrouter:'openrouter/free',openai:'gpt-4.1-mini',claude:'claude-haiku-4-5',
  });
  const [usage,setUsage]=useState<ProviderUsage[]>([]);
  const [editing,setEditing]=useState<CloudProvider|null>(null);
  const [value,setValue]=useState('');
  const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState('');
  const refresh=useCallback(async()=>{
    const [keyState,preferred,gemini,groq,openrouter,openai,claude,stats]=await Promise.all([
      configuredProviders(),selectedProvider(),
      selectedModel('gemini'),selectedModel('groq'),selectedModel('openrouter'),
      selectedModel('openai'),selectedModel('claude'),
      readProviderUsage(),
    ]);
    setKeys(keyState);setChoice(preferred);
    setModels({gemini,groq,openrouter,openai,claude});setUsage(stats);
    notify.current?.(preferred,keyState);
  },[]);
  useEffect(()=>{void refresh().catch(()=>setNotice('Could not read saved AI settings'));},[refresh]);
  const updateChoice=async(next:ProviderChoice)=>{
    if(disabled)return;
    try{
      await saveSelectedProvider(next);setChoice(next);
      onChange?.(next,keys);
    }catch(e){Alert.alert('Could not save provider',String(e));}
  };
  const updateModel=async(provider:CloudProvider,model:string)=>{
    if(disabled)return;
    try{
      await saveSelectedModel(provider,model);
      setModels(previous=>({...previous,[provider]:model}));
      setNotice('Model choice saved. It will persist until changed.');
    }catch(e){Alert.alert('Model unavailable',e instanceof Error?e.message:String(e));}
  };
  const saveKey=async()=>{
    if(!editing||disabled||saving)return;
    setSaving(true);
    try{
      await storeProviderKey(editing,value);
      setValue('');setEditing(null);
      setNotice(editing.toUpperCase()+' key saved securely until replaced or removed.');
      await refresh();
    }catch(e){Alert.alert('Key not saved',e instanceof Error?e.message:String(e));}
    finally{setSaving(false);}
  };
  const removeKey=(provider:CloudProvider)=>{
    if(disabled)return;
    Alert.alert('Remove '+provider.toUpperCase()+' API key?',
      'Other saved keys, models, goals, quests and XP will stay intact.',[
      {text:'Cancel',style:'cancel'},
      {text:'Remove key',style:'destructive',onPress:()=>{
        void deleteProviderKey(provider).then(async()=>{
          setValue('');if(editing===provider)setEditing(null);
          setNotice(provider.toUpperCase()+' key removed from this device.');
          await refresh();
        }).catch(e=>Alert.alert('Unable to remove key',String(e)));
      }},
    ]);
  };
  return <View style={styles.panel}>
    <View style={styles.heading}>
      <LockKeyhole color={C.energy} size={19}/>
      <View style={{flex:1}}>
        <T color={C.frost} bold size={15}>AI Provider Manager</T>
        <T color={C.sub} size={11} style={{marginTop:3}}>
          Your keys and model choices are shared across both Oracle modes.
        </T>
      </View>
    </View>
    <T color={C.sub} bold size={11} style={styles.section}>DEFAULT CLOUD PROVIDER</T>
    <View style={styles.choices}>
      {(['auto',...PROVIDERS] as ProviderChoice[]).map(p=>
        <Chip key={p} active={choice===p} onPress={()=>void updateChoice(p)}>
          {p==='auto'?'AUTO':p.toUpperCase()}
        </Chip>)}
    </View>
    <T color={C.dim} size={11} style={{marginTop:2,marginBottom:11}}>
      AUTO tries configured providers in order. A selected provider is tried first,
      then only other FREE providers if it fails. Paid OpenAI and Claude are never automatic fallbacks.
    </T>
    {PROVIDERS.map(provider=>{
      const day=new Date().toISOString().slice(0,10);
      const stat=usage.find(x=>x.provider===provider&&x.day===day);
      return <View key={provider} style={styles.provider}>
        <View style={styles.nameRow}>
          <View style={{flex:1,minWidth:0}}>
            <T color={C.frost} size={13} bold>{provider.toUpperCase()}</T>
            {(provider==='openai'||provider==='claude')&&
              <T color={C.gold} size={10} bold>PAID API · EXPLICIT PER-REQUEST APPROVAL</T>}
            <View style={styles.status}>
              {keys[provider]&&<CheckCircle2 color={C.green} size={13}/>}
              <T color={keys[provider]?C.green:C.sub} size={11}>
                {keys[provider]?'Key saved':'Key not configured'}
              </T>
            </View>
          </View>
          <Pressable disabled={disabled||saving} accessibilityRole="button"
            accessibilityLabel={(keys[provider]?'Replace ':'Add ')+provider+' key'}
            style={styles.action}
            onPress={()=>{setEditing(editing===provider?null:provider);setValue('');}}>
            <T color={C.energy} bold size={11}>{keys[provider]?'REPLACE':'ADD KEY'}</T>
          </Pressable>
          {keys[provider]&&<Pressable disabled={disabled||saving} accessibilityRole="button"
            accessibilityLabel={'Remove '+provider+' key'} style={styles.action}
            onPress={()=>removeKey(provider)}>
            <T color={C.danger} size={11}>REMOVE</T>
          </Pressable>}
        </View>
        {editing===provider&&<View style={styles.edit}>
          <TextInput accessibilityLabel={'Secure '+provider+' API key'} value={value}
            onChangeText={setValue} secureTextEntry autoCorrect={false}
            autoCapitalize="none" placeholder={'Paste your '+provider+' key'}
            placeholderTextColor={C.dim} style={styles.field}/>
          <Action disabled={disabled||saving||!value.trim()} onPress={()=>void saveKey()}>
            {saving?'SAVING…':'SAVE KEY SECURELY'}
          </Action>
          <T color={C.dim} size={10}>The existing saved key remains until Save succeeds.</T>
        </View>}
        <T color={C.sub} size={11} style={{marginTop:11,marginBottom:5}}>ACTIVE LLM</T>
        <View style={styles.models}>
          {PROVIDER_MODELS[provider].map(model=>
            <Pressable key={model.id} disabled={disabled||saving} accessibilityRole="radio"
              accessibilityState={{checked:models[provider]===model.id}}
              onPress={()=>void updateModel(provider,model.id)}
              style={[styles.model,models[provider]===model.id&&styles.modelActive]}>
              <T color={models[provider]===model.id?C.energy:C.frost}
                size={11} bold>{model.label}</T>
              {models[provider]===model.id&&<CheckCircle2 color={C.energy} size={15}/>}
            </Pressable>)}
        </View>
        <T color={C.dim} size={10} style={{marginTop:8}}>
          {stat?.requests??0}/{LIMIT_REQUESTS_PER_DAY[provider]} local requests today
          {' · '}{(stat?.inputTokens??0)+(stat?.outputTokens??0)} recorded tokens
        </T>
      </View>;
    })}
    <View style={styles.notice}>
      <ShieldCheck color={C.energy} size={16}/>
      <T color={C.sub} size={11} style={{flex:1}}>
        Stored in Android SecureStore across app restarts and signed upgrades.
        Uninstalling the app, clearing app data or device security changes can erase keys.
        No keys are included in exports or backups.
      </T>
    </View>
    <T color={C.dim} size={10} style={{marginTop:9}}>
      Free-tier access depends on your account. OpenAI and Claude are PAID API
      providers: they are excluded from AUTO and require separate confirmation
      for each roadmap generation. A saved key never authorizes paid calls.
    </T>
    {!!notice&&<T color={C.gold} size={11} style={{marginTop:8}}>{notice}</T>}
  </View>;
}
const styles=StyleSheet.create({
  panel:{backgroundColor:'#172541',borderColor:'#476184',borderWidth:1,
    borderRadius:20,padding:15,marginTop:14,marginBottom:16},
  heading:{flexDirection:'row',alignItems:'center',gap:10},
  section:{marginTop:18,marginBottom:8},
  choices:{flexDirection:'row',flexWrap:'wrap',gap:7},
  provider:{borderTopWidth:1,borderTopColor:'#354A67',paddingVertical:15},
  nameRow:{flexDirection:'row',alignItems:'center',gap:7},
  status:{flexDirection:'row',alignItems:'center',gap:5,marginTop:5},
  action:{minHeight:44,paddingHorizontal:9,borderRadius:11,
    justifyContent:'center',alignItems:'center',backgroundColor:'#253753',
    borderWidth:1,borderColor:'#435777'},
  edit:{marginTop:11,gap:9},
  field:{minHeight:48,borderRadius:11,borderWidth:1,borderColor:'#637995',
    backgroundColor:'#12223A',color:C.ink,padding:12,fontSize:14},
  models:{flexDirection:'row',flexWrap:'wrap',gap:7},
  model:{minHeight:44,borderRadius:11,flexDirection:'row',alignItems:'center',
    justifyContent:'center',gap:7,paddingHorizontal:11,paddingVertical:8,
    backgroundColor:'#10213B',borderWidth:1,borderColor:'#38536E',maxWidth:'100%'},
  modelActive:{borderColor:C.energy,backgroundColor:'#224166'},
  notice:{flexDirection:'row',gap:9,alignItems:'flex-start',paddingTop:12,
    borderTopWidth:1,borderTopColor:'#354A67'},
});
