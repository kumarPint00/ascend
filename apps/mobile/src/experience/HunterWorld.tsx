import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Animated,AppState,Image,Pressable,StyleSheet,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {Expand,Minimize2,Shield,Star} from 'lucide-react-native';
import {C} from '../theme';
import {T} from '../components/Elements';
import {HUNTER_ILLUSTRATED_FRAMES} from './hunter-illustrated-frames';

/**
 * ASCEND Hunter is original AI-illustrated portrait art, NOT a procedural
 * 3D mesh, a downloaded model, or a borrowed copyrighted character.
 *
 * Four offline portrait frames capture a gentle cloak shift and eye blink.
 * Motion stops when offscreen, when Android backgrounds the app, or when
 * reduced motion / battery quality is selected. Static frame is fully usable.
 */
export type RenderQuality='immersive'|'balanced'|'battery';
export type ArmorTheme='azure'|'royal'|'ember';
type Props={active?:boolean;reduceMotion?:boolean;quality?:RenderQuality;
  height?:number;rank?:string;level?:number;inspect?:boolean;armor?:ArmorTheme};

const accents:Record<ArmorTheme,[string,string,string]>={
  azure:['#102A4B00','#0D547B4D','#10324FBC'],
  royal:['#2B175400','#5D359A50','#1A1749BD'],
  ember:['#321B1A00','#B2642850','#4C2415BD'],
};
const beats=[0,1,3,0,1,3,0,2,2,3,1,0] as const;

export function HunterWorld({active=true,reduceMotion=false,quality='balanced',
  height=350,rank='E',level=1,inspect=false,armor='azure'}:Props){
  const [frame,setFrame]=useState(0);
  const [zoom,setZoom]=useState(false);
  const [foreground,setForeground]=useState(AppState.currentState==='active');
  const [artFailed,setArtFailed]=useState(false);
  const drift=useRef(new Animated.Value(0)).current;
  const playable=active&&foreground&&!reduceMotion&&quality!=='battery'&&!artFailed;
  useEffect(()=>{
    const subscription=AppState.addEventListener('change',
      state=>setForeground(state==='active'));
    return ()=>subscription.remove();
  },[]);
  useEffect(()=>{
    if(!playable){setFrame(0);return;}
    let beat=0;
    const interval=setInterval(()=>{
      beat=(beat+1)%beats.length;
      setFrame(beats[beat]);
    },quality==='immersive'?190:300);
    return ()=>clearInterval(interval);
  },[playable,quality]);
  useEffect(()=>{
    drift.stopAnimation();
    if(!playable){drift.setValue(0);return;}
    const sequence=Animated.loop(Animated.sequence([
      Animated.timing(drift,{toValue:1,duration:2400,useNativeDriver:true}),
      Animated.timing(drift,{toValue:0,duration:2400,useNativeDriver:true}),
    ]));
    sequence.start();
    return ()=>sequence.stop();
  },[playable,drift]);
  const sceneScale=useMemo(()=>drift.interpolate({
    inputRange:[0,1],outputRange:[zoom?1.16:1.025,zoom?1.2:1.055],
  }),[drift,zoom]);
  const imageSource=useMemo(()=>({uri:HUNTER_ILLUSTRATED_FRAMES[frame]}),[frame]);
  return <View style={[styles.shell,{height}]} accessible
    accessibilityLabel={'Original animated illustrated fantasy Hunter. Rank '+rank+', level '+level}>
    <LinearGradient colors={['#17234D','#13112C','#080D1F']} style={StyleSheet.absoluteFill}/>
    {!artFailed?
      <Animated.View style={[styles.art,{transform:[{scale:reduceMotion?1:sceneScale}]}]}
        pointerEvents="none">
        <Image source={imageSource} resizeMode="cover" style={styles.portrait}
          fadeDuration={0} onError={()=>setArtFailed(true)}/>
      </Animated.View>:
      <View style={styles.fallback}>
        <Shield size={84} color={C.energy}/>
        <T color={C.frost} bold size={16}>Hunter illustration unavailable</T>
        <T color={C.sub} size={12}>Your quests and XP are unaffected.</T>
      </View>}
    <LinearGradient colors={accents[armor]} pointerEvents="none"
      style={StyleSheet.absoluteFill}/>
    <LinearGradient colors={['#070D1B99','#070D1B00','#070D1B00','#070D1BF0']}
      pointerEvents="none" style={StyleSheet.absoluteFill}/>
    <View pointerEvents="none" style={styles.label}>
      <Star size={13} color={C.gold}/>
      <T size={10} color={C.frost} bold style={{letterSpacing:1.2}}>
        THE HUNTER SANCTUARY
      </T>
    </View>
    {inspect&&<Pressable accessibilityRole="button"
      accessibilityLabel={zoom?'Show full Hunter portrait':'Inspect Hunter portrait closer'}
      onPress={()=>setZoom(value=>!value)} style={styles.inspect}>
      {zoom?<Minimize2 size={18} color={C.frost}/>:<Expand size={18} color={C.frost}/>}
    </Pressable>}
    <View pointerEvents="none" style={styles.footer}>
      <View style={{flex:1,minWidth:0}}>
        <T color={C.gold} bold size={11}>RANK {rank} · LEVEL {level}</T>
        <T color="#C8D3F2" size={10} numberOfLines={1}>
          ORIGINAL HUNTER ART · {quality==='battery'?'STILL':reduceMotion?'REDUCED MOTION':'ANIMATED'}
        </T>
      </View>
      <View style={[styles.aura,{backgroundColor:armor==='ember'?'#FD9D73':armor==='royal'?'#C5A8FF':'#8ADFFF'}]}/>
    </View>
  </View>;
}
const styles=StyleSheet.create({
  shell:{overflow:'hidden',borderRadius:24,borderWidth:1,
    borderColor:'#5477AD',backgroundColor:C.bg},
  art:{...StyleSheet.absoluteFill},
  portrait:{height:'100%',width:'100%',backgroundColor:'#101E3C'},
  label:{position:'absolute',top:14,left:14,right:66,flexDirection:'row',
    gap:7,alignItems:'center',alignSelf:'flex-start'},
  inspect:{position:'absolute',right:12,top:12,width:46,height:46,
    alignItems:'center',justifyContent:'center',borderRadius:14,
    borderWidth:1,borderColor:'#6F90B8',backgroundColor:'#102347E9'},
  footer:{position:'absolute',bottom:12,left:12,right:12,flexDirection:'row',
    alignItems:'center',gap:11,backgroundColor:'#101B31DF',
    paddingHorizontal:13,paddingVertical:11,borderRadius:14,
    borderWidth:1,borderColor:'#4B6294',minHeight:58},
  aura:{height:9,width:9,borderRadius:6},
  fallback:{...StyleSheet.absoluteFill,alignItems:'center',
    justifyContent:'center',gap:10,padding:24},
});
