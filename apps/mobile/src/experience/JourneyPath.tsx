import React from 'react';
import {Pressable,StyleSheet,View} from 'react-native';
import {Check,ChevronRight,LockKeyhole,Route} from 'lucide-react-native';
import {C} from '../theme';
import {T} from '../components/Elements';

export type JourneyStep={id:string;title:string;description:string;
  done:boolean;blocked:boolean;ready:boolean};
type Props={steps:JourneyStep[];onActivate:(id:string)=>void;onPlan:(id:string)=>void};
/** A source-faithful milestone track. Decorative connectors indicate journey
 * order only: locked icons, not line order, represent real dependency status.
 */
export function JourneyPath({steps,onActivate,onPlan}:Props){
  if(!steps.length)return <View style={styles.empty}>
    <Route size={17} color={C.sub}/>
    <T size={12} color={C.sub}>No milestones yet. Link your first quest to grow this journey.</T>
  </View>;
  return <View style={styles.track}>
    <View style={styles.heading}>
      <Route size={17} color={C.energy}/>
      <T size={11} color={C.energy} bold>JOURNEY PATH · {steps.filter(x=>x.done).length}/{steps.length}</T>
    </View>
    {steps.map((step,index)=><View key={step.id} style={styles.row}>
      <View style={styles.rail}>
        <View style={[styles.node,step.done&&styles.cleared,step.blocked&&styles.locked]}>
          {step.done?<Check size={15} color={C.dark}/>:step.blocked?
            <LockKeyhole size={13} color={C.gold}/>:
            <T size={11} color={C.frost} bold>{index+1}</T>}
        </View>
        {index<steps.length-1&&<View style={[styles.path,
          step.done&&steps[index+1]?.done&&styles.clearedPath]}/>}
      </View>
      <View style={[styles.plate,step.done&&styles.plateDone]}>
        <View style={{flex:1,gap:3}}>
          <T color={step.done?C.green:C.frost} bold size={13}>{step.title}</T>
          {!!step.description&&<T color={C.sub} size={11}>{step.description.slice(0,140)}</T>}
          <T size={10} color={step.done?C.green:step.blocked?C.gold:C.sub}>
            {step.done?'CLEARED':step.blocked?'LOCKED BY PREREQUISITE':step.ready?'READY TO COMPLETE':'NOT SCHEDULED'}
          </T>
        </View>
        {!step.done&&<Pressable accessibilityRole="button"
          accessibilityLabel={(step.ready?'Complete ':'Plan ')+step.title}
          style={styles.action} onPress={()=>step.ready?onActivate(step.id):onPlan(step.id)}>
          <T size={10} color={C.energy} bold>{step.ready?'DONE':'PLAN'}</T>
          <ChevronRight size={13} color={C.energy}/>
        </Pressable>}
      </View>
    </View>)}
  </View>;
}
const styles=StyleSheet.create({
  heading:{flexDirection:'row',alignItems:'center',gap:8,paddingBottom:13},
  track:{marginTop:12,paddingVertical:8},
  row:{flexDirection:'row',gap:10,alignItems:'stretch',minHeight:70},
  rail:{width:28,alignItems:'center'},
  node:{width:27,height:27,borderRadius:14,alignItems:'center',justifyContent:'center',
    backgroundColor:'#203A59',borderWidth:1,borderColor:'#72BCD9',zIndex:1},
  cleared:{backgroundColor:C.green,borderColor:C.green},
  locked:{backgroundColor:'#40362E',borderColor:C.gold},
  path:{width:2,flex:1,backgroundColor:'#345674',minHeight:23},
  clearedPath:{backgroundColor:C.green},
  plate:{flexDirection:'row',alignItems:'center',gap:7,flex:1,marginBottom:10,
    padding:11,borderRadius:14,backgroundColor:'#14223C',borderWidth:1,borderColor:'#283C60'},
  plateDone:{backgroundColor:'#122D32',borderColor:'#396B61'},
  action:{minHeight:42,minWidth:64,borderRadius:10,alignItems:'center',
    justifyContent:'center',flexDirection:'row',borderWidth:1,borderColor:'#456D92'},
  empty:{flexDirection:'row',gap:8,alignItems:'center',padding:10}
});
