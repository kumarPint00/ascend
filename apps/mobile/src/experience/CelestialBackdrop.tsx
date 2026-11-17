import React,{useEffect,useMemo,useRef} from 'react';
import {Animated,StyleSheet,useWindowDimensions,View} from 'react-native';
import Svg,{Circle,Defs,RadialGradient,Stop,Path} from 'react-native-svg';
import {LinearGradient} from 'expo-linear-gradient';

/** Low-cost atmospheric native animation for non-GL screens. */
export function CelestialBackdrop({reduceMotion=false}:{reduceMotion?:boolean}){
  const {width,height}=useWindowDimensions();
  const drift=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    drift.stopAnimation();
    if(reduceMotion){drift.setValue(0);return;}
    const motion=Animated.loop(Animated.sequence([
      Animated.timing(drift,{toValue:1,duration:9000,useNativeDriver:true}),
      Animated.timing(drift,{toValue:0,duration:9000,useNativeDriver:true}),
    ]));
    motion.start();return ()=>motion.stop();
  },[drift,reduceMotion]);
  const stars=useMemo(()=>{
    let seed=48271;
    const rand=()=>{seed=seed*16807%2147483647;return seed/2147483647;};
    return Array.from({length:68},(_,i)=>({
      x:rand()*width,y:rand()*Math.max(500,height),
      r:rand()*1.1+.35,opacity:rand()*.5+.14,id:i,
    }));
  },[width,height]);
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <LinearGradient colors={['#090D25','#060A18','#050A15']}
      style={StyleSheet.absoluteFill}/>
    <Animated.View style={[StyleSheet.absoluteFill,{
      opacity:drift.interpolate({inputRange:[0,1],outputRange:[.45,.9]}),
      transform:[{translateY:drift.interpolate({inputRange:[0,1],outputRange:[0,-20]})}],
    }]}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="nebula" cx="35%" cy="14%" rx="85%" ry="62%">
            <Stop offset="0%" stopColor="#214C88" stopOpacity=".55"/>
            <Stop offset="54%" stopColor="#201D53" stopOpacity=".16"/>
            <Stop offset="100%" stopColor="#070D1D" stopOpacity="0"/>
          </RadialGradient>
          <RadialGradient id="aurora" cx="83%" cy="37%" rx="65%" ry="48%">
            <Stop offset="0%" stopColor="#6C3D87" stopOpacity=".24"/>
            <Stop offset="100%" stopColor="#070D1D" stopOpacity="0"/>
          </RadialGradient>
        </Defs>
        <Circle cx={width*.45} cy={height*.21} r={Math.max(width,height)*.66} fill="url(#nebula)"/>
        <Circle cx={width*.87} cy={height*.47} r={width*.83} fill="url(#aurora)"/>
        {stars.map(star=><Circle key={star.id} cx={star.x} cy={star.y} r={star.r}
          fill="#CEE9FF" opacity={star.opacity}/>)}
        <Path d={`M0 ${height*.58} Q${width*.35} ${height*.55} ${width} ${height*.67}`}
          stroke="#4569B4" strokeWidth=".6" strokeOpacity=".23" fill="none"/>
      </Svg>
    </Animated.View>
  </View>;
}
