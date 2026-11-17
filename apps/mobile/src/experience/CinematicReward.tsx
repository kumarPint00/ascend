import React from 'react';
import {Animated,StyleSheet,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {C} from '../theme';
import {T} from '../components/Elements';

export interface RewardEvent{
  xp:number;levelUp:boolean;rankUp:boolean;newLevel:number;newRank:string;
}
const particles=Array.from({length:20},(_,i)=>{
  const a=Math.PI*2*i/20;
  return {x:Math.cos(a)*(118+(i%4)*9),y:Math.sin(a)*(146+(i%3)*7),
    symbol:i%5===0?'✦':i%2===0?'✧':'·'};
});
/**
 * Distinct rank/level portal ceremony. Animated on the native driver,
 * automatically simplified for users with reduced motion enabled.
 * The overlay never intercepts navigation or gestures.
 */
export function CinematicReward({reward,pulse,reduceMotion}:{
  reward:RewardEvent;pulse:Animated.Value;reduceMotion:boolean;
}){
  const important=reward.levelUp||reward.rankUp;
  const opacity=pulse.interpolate({inputRange:[0,.25,.8,1],outputRange:[0,.65,.92,1]});
  if(!important)return <Animated.View pointerEvents="none" style={[st.toast,{
    opacity:pulse,transform:[{scale:pulse.interpolate({inputRange:[0,1],outputRange:[.85,1]})}]
  }]}>
    <LinearGradient colors={['#324C71','#142A49','#0C1930']} style={st.toastInner}>
      <T color={C.gold} size={12} bold style={{letterSpacing:2}}>✦ QUEST CLEARED ✦</T>
      <T color={C.frost} size={26} bold style={{marginTop:4}}>+{reward.xp} XP</T>
    </LinearGradient>
  </Animated.View>;
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <Animated.View style={[StyleSheet.absoluteFill,{opacity:pulse.interpolate({
      inputRange:[0,1],outputRange:[0,.85]
    }),backgroundColor:'#040918'}]}/>
    <View style={st.center}>
      <Animated.View style={[st.outer,{
        opacity,transform:[{rotate:pulse.interpolate({
          inputRange:[0,1],outputRange:['-65deg',reduceMotion?'0deg':'120deg']
        })},{scale:pulse.interpolate({inputRange:[0,1],outputRange:[.55,1]})}]
      }]}>
        <View style={st.innerRing}/>
        <View style={st.starLine}/>
      </Animated.View>
      {particles.map((p,i)=><Animated.Text key={i} style={[st.particle,{
        color:i%4===0?C.gold:i%3===0?C.violet:C.energy,
        opacity:pulse,
        transform:[{translateX:pulse.interpolate({inputRange:[0,1],
          outputRange:[0,reduceMotion?p.x*.5:p.x]})},
          {translateY:pulse.interpolate({inputRange:[0,1],
            outputRange:[0,reduceMotion?p.y*.5:p.y]})}]
      }]}>{p.symbol}</Animated.Text>)}
      <Animated.View style={{alignItems:'center',opacity,padding:20,
        transform:[{scale:pulse.interpolate({inputRange:[0,1],outputRange:[.82,1]})}]}}>
        <T color={C.gold} size={13} bold style={{letterSpacing:4}}>
          {reward.rankUp?'RANK ASCENSION':'THE NEXT LEVEL'}
        </T>
        <T color={C.frost} size={44} bold style={{letterSpacing:-2,marginTop:14}}>
          {reward.rankUp?reward.newRank+'-RANK':'LEVEL '+reward.newLevel}
        </T>
        <View style={st.separator}/>
        <T color={C.energy} size={22} bold>+{reward.xp} XP</T>
        <T color={C.sub} size={12} style={{marginTop:12,textAlign:'center'}}>
          {reward.rankUp?'A new chapter of your journey begins.':
            'One meaningful action brought you here.'}
        </T>
      </Animated.View>
    </View>
  </View>;
}
const st=StyleSheet.create({
  center:{flex:1,alignItems:'center',justifyContent:'center'},
  outer:{position:'absolute',width:270,height:270,borderRadius:135,borderWidth:2,
    borderColor:'#7491E6',backgroundColor:'#26345936',
    shadowColor:'#83DFFE',shadowOpacity:.65,shadowRadius:30,elevation:13,
    alignItems:'center',justifyContent:'center'},
  innerRing:{width:224,height:224,borderRadius:112,borderWidth:1,
    borderColor:'#FFD8A0'},
  starLine:{position:'absolute',height:2,width:260,backgroundColor:'#78C5FB'},
  particle:{position:'absolute',fontSize:19,fontWeight:'700'},
  separator:{width:72,height:2,backgroundColor:C.gold,borderRadius:2,marginVertical:18},
  toast:{position:'absolute',zIndex:15,top:122,alignSelf:'center',
    borderWidth:1,borderColor:C.energy,borderRadius:20,overflow:'hidden',elevation:12},
  toastInner:{minWidth:210,paddingVertical:14,paddingHorizontal:22,alignItems:'center'},
});
