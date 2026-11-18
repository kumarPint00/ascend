import React from 'react';
import {Pressable,StyleSheet,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {BookOpen,BrainCircuit,CalendarDays,ChevronLeft,FileCheck2,
  Swords,UserRound,Waypoints} from 'lucide-react-native';
import {C} from '../theme';
import {T} from '../components/Elements';

export type RealmDestination='Hunter'|'Quests'|'Goals'|'Planner'|'Oracle'|'Connect';
const GATES:{id:RealmDestination;name:string;subtitle:string;Icon:typeof Swords;color:string}[]=[
  {id:'Hunter',name:'Hunter Sanctuary',subtitle:'Identity · Equipment',Icon:UserRound,color:'#83DCF2'},
  {id:'Quests',name:'Mission Forge',subtitle:'Daily raids · Quests',Icon:Swords,color:'#E6BE81'},
  {id:'Goals',name:'Journey Archives',subtitle:'Milestones · Stories',Icon:BookOpen,color:'#BBA4EF'},
  {id:'Planner',name:'Tactical Hall',subtitle:'Plan · Recover',Icon:CalendarDays,color:'#85DABF'},
  {id:'Oracle',name:'Oracle Tower',subtitle:'Private AI drafts',Icon:BrainCircuit,color:'#CFB2FA'},
  {id:'Connect',name:'Memory Vault',subtitle:'Selected sources',Icon:FileCheck2,color:'#94BDDD'},
];
/** A navigable sanctuary gateway. Zones deliberately remain available:
 * real-life productivity should never be gated behind gamification.
 */
export function RealmMap({rank,level,onBack,onTravel}:{rank:string;level:number;
  onBack:()=>void;onTravel:(dest:RealmDestination)=>void}){
  return <View style={styles.screen}>
    <Pressable accessibilityRole="button" accessibilityLabel="Return to Realm"
      onPress={onBack} style={styles.back}>
      <ChevronLeft color={C.energy} size={19}/><T color={C.energy} bold size={11}>RETURN TO REALM</T>
    </Pressable>
    <LinearGradient colors={['#1D2B53','#151833','#0B1629']} style={styles.hero}>
      <View style={styles.aura}>
        <View style={styles.orbitOuter}>
          <View style={styles.orbitInner}><Waypoints size={48} color={C.energy}/></View>
        </View>
      </View>
      <T color={C.gold} bold size={10} style={{letterSpacing:2.6}}>ASCEND · THE LIVING WORLD</T>
      <T color={C.frost} bold size={27} style={{marginTop:7}}>Sanctuary Gates</T>
      <T color={C.sub} size={12} style={{marginTop:8,textAlign:'center'}}>
        Rank {rank} · Level {level}. Choose a destination. Every gate is accessible.
      </T>
    </LinearGradient>
    <T color={C.energy} size={12} bold style={{letterSpacing:1.4,marginTop:11,marginBottom:11}}>
      SIX WAYS TO PROGRESS
    </T>
    <View style={styles.grid}>
      {GATES.map((gate,i)=><Pressable key={gate.id} accessibilityRole="button"
        accessibilityLabel={'Open '+gate.name} onPress={()=>onTravel(gate.id)}
        style={({pressed})=>[styles.gate,{borderColor:gate.color+'88',
          opacity:pressed?.78:1,transform:[{scale:pressed?.985:1}]}]}>
        <LinearGradient colors={['#192D4B','#111D34']} style={styles.inside}>
          <View style={[styles.icon,{borderColor:gate.color+'77'}]}>
            <gate.Icon color={gate.color} size={27}/>
          </View>
          <T color={gate.color} bold size={10}>ZONE {String(i+1).padStart(2,'0')}</T>
          <T color={C.frost} bold size={14}>{gate.name}</T>
          <T color={C.sub} size={11}>{gate.subtitle}</T>
        </LinearGradient>
      </Pressable>)}
    </View>
    <View style={styles.note}>
      <T color={C.sub} size={11}>
        The sanctuary is a navigational world layer. Character advancement uses verified
        progress; gateways do not create quests or XP by themselves.
      </T>
    </View>
  </View>;
}
const styles=StyleSheet.create({
  screen:{gap:2},
  back:{flexDirection:'row',alignItems:'center',gap:5,marginBottom:12,minHeight:44},
  hero:{padding:20,minHeight:260,borderRadius:25,borderWidth:1,borderColor:'#596CA0',
    alignItems:'center',justifyContent:'center',overflow:'hidden'},
  aura:{height:121,width:180,alignItems:'center',justifyContent:'center',marginBottom:12},
  orbitOuter:{borderWidth:2,borderColor:'#536E9C',width:115,height:115,borderRadius:58,
    alignItems:'center',justifyContent:'center',transform:[{rotate:'-15deg'}]},
  orbitInner:{backgroundColor:'#192F50',borderWidth:1,borderColor:'#90D3F1',
    width:88,height:88,borderRadius:44,alignItems:'center',justifyContent:'center'},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:10},
  gate:{width:'48%',minHeight:162,borderRadius:19,borderWidth:1,overflow:'hidden',flexGrow:1},
  inside:{flex:1,padding:13,gap:6},
  icon:{width:46,height:46,borderWidth:1,borderRadius:13,
    backgroundColor:'#223756',alignItems:'center',justifyContent:'center'},
  note:{marginTop:14,padding:15,backgroundColor:'#11243B',borderRadius:14,
    borderWidth:1,borderColor:'#345778'}
});
