import React,{useEffect,useRef} from 'react';
import {Animated,StyleSheet,View} from 'react-native';
import Svg,{Circle,Defs,Ellipse,LinearGradient as SvgGradient,Path,Polygon,RadialGradient,Stop} from 'react-native-svg';

/**
 * GPU-independent animated isometric crystal and orbital glyph.
 * This visual fallback stays perceptible when an emulator cannot produce
 * working WebGL shader output. No remote assets or native subscriptions.
 */
export function CrystalFallback({active=true,reduceMotion=false,opacity=.92}:{
  active?:boolean;reduceMotion?:boolean;opacity?:number;
}){
  const spin=useRef(new Animated.Value(0)).current;
  const bob=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    spin.stopAnimation();bob.stopAnimation();
    if(!active||reduceMotion){spin.setValue(0);bob.setValue(0);return;}
    const orbit=Animated.loop(Animated.timing(spin,{
      toValue:1,duration:15000,useNativeDriver:true,
    }));
    const pulse=Animated.loop(Animated.sequence([
      Animated.timing(bob,{toValue:1,duration:3000,useNativeDriver:true}),
      Animated.timing(bob,{toValue:0,duration:3000,useNativeDriver:true}),
    ]));
    orbit.start();pulse.start();
    return ()=>{orbit.stop();pulse.stop();};
  },[active,reduceMotion,spin,bob]);
  const rotation=spin.interpolate({inputRange:[0,1],outputRange:['0deg','360deg']});
  const reverse=spin.interpolate({inputRange:[0,1],outputRange:['0deg','-360deg']});
  const floatY=bob.interpolate({inputRange:[0,1],outputRange:[0,-7]});
  const scale=bob.interpolate({inputRange:[0,1],outputRange:[1,1.055]});
  return <View pointerEvents="none" style={[styles.stage,{opacity}]}
    accessible accessibilityLabel="Luminous animated ascension crystal">
    <Svg width="295" height="250" viewBox="0 0 295 250" style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#54CAFF" stopOpacity=".4"/>
          <Stop offset=".48" stopColor="#4C64F0" stopOpacity=".15"/>
          <Stop offset="1" stopColor="#1A1739" stopOpacity="0"/>
        </RadialGradient>
      </Defs>
      <Circle cx="147.5" cy="121" r="117" fill="url(#glow)"/>
      <Ellipse cx="147.5" cy="122" rx="113" ry="39" stroke="#7AB6FF"
        strokeWidth=".9" opacity=".21" fill="none"/>
      <Ellipse cx="147.5" cy="122" rx="94" ry="23" stroke="#D7C08E"
        strokeWidth=".6" opacity=".3" fill="none"/>
      {Array.from({length:22},(_,i)=>{
        const x=(i*79+37)%285,y=(i*47+19)%245;
        return <Circle key={i} cx={x} cy={y} r={i%5===0?1.3:.65}
          opacity={i%3===0?.72:.35} fill={i%5===0?'#FFE5AD':'#8DDFFF'}/>;
      })}
    </Svg>
    <Animated.View style={[styles.orbit,{transform:[{rotate:rotation}]}]}>
      <Svg width="295" height="250" viewBox="0 0 295 250">
        <Ellipse cx="147.5" cy="123" rx="117" ry="37"
          stroke="#82DFF8" strokeWidth="2" strokeOpacity=".72" fill="none"
          transform="rotate(-32 147.5 123)"/>
        <Circle cx="48" cy="185" r="4" fill="#F6D599"/>
        <Circle cx="247" cy="60" r="3" fill="#9FE2FF"/>
      </Svg>
    </Animated.View>
    <Animated.View style={[styles.orbit,{transform:[{rotate:reverse}]}]}>
      <Svg width="295" height="250" viewBox="0 0 295 250">
        <Ellipse cx="147.5" cy="123" rx="109" ry="41"
          stroke="#AD8EFF" strokeOpacity=".58" strokeWidth="1.7"
          fill="none" transform="rotate(37 147.5 123)"/>
        <Circle cx="67" cy="173" r="3.5" fill="#BDA6FF"/>
      </Svg>
    </Animated.View>
    <Animated.View style={[styles.orbit,{transform:[{translateY:floatY},{scale}]}]}>
      <Svg width="295" height="250" viewBox="0 0 295 250">
        <Defs>
          <SvgGradient id="faceL" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#A9EDFF"/>
            <Stop offset=".52" stopColor="#3C96D8"/>
            <Stop offset="1" stopColor="#153765"/>
          </SvgGradient>
          <SvgGradient id="faceR" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#94AAFF"/>
            <Stop offset=".55" stopColor="#3458BB"/>
            <Stop offset="1" stopColor="#172961"/>
          </SvgGradient>
          <SvgGradient id="faceBottom" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#437BD9"/>
            <Stop offset="1" stopColor="#0B193C"/>
          </SvgGradient>
        </Defs>
        <Path d="M147 18 L83 78 L91 161 L147 223 L202 161 L211 78 Z"
          stroke="#8DE9FF" strokeWidth="1.4" fill="#15325D" opacity=".92"/>
        <Polygon points="147,18 83,78 147,73" fill="#A5EEFF" opacity=".9"/>
        <Polygon points="147,18 147,73 211,78" fill="#8C9DFE" opacity=".78"/>
        <Polygon points="83,78 147,73 147,152 91,161" fill="url(#faceL)"/>
        <Polygon points="147,73 211,78 202,161 147,152" fill="url(#faceR)"/>
        <Polygon points="91,161 147,152 147,223" fill="#2679B8"/>
        <Polygon points="147,152 202,161 147,223" fill="url(#faceBottom)"/>
        <Path d="M147 18 L147 223 M83 78 L147 152 L211 78 M91 161 L147 152 L202 161"
          stroke="#D2F7FF" strokeOpacity=".58" strokeWidth="1.2" fill="none"/>
        <Path d="M106 89 L126 76 L124 143 L103 151"
          fill="#D9FAFF" opacity=".16"/>
        <Path d="M160 74 L190 82 L183 145 L161 147"
          fill="#CAAEFF" opacity=".17"/>
        <Path d="M144 29 L147 70" stroke="#F8F5FF" strokeWidth="2.5"
          opacity=".95"/>
        <Circle cx="147" cy="123" r="14" fill="#80EAFF" opacity=".13"/>
        <Circle cx="147" cy="123" r="3" fill="#E5FAFF" opacity=".72"/>
      </Svg>
    </Animated.View>
  </View>;
}
const styles=StyleSheet.create({
  stage:{position:'absolute',width:295,height:250,top:'50%',left:'50%',
    marginTop:-125,marginLeft:-147.5},
  orbit:{position:'absolute',width:295,height:250,top:0,left:0},
});
