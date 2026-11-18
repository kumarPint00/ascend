import React from 'react';
import {Text,View,Pressable,StyleSheet,type ViewStyle,type TextStyle,type StyleProp} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {C} from '../theme';

export function T({children,size=15,color=C.ink,bold=false,style}:{
  children:React.ReactNode;size?:number;color?:string;bold?:boolean;style?:StyleProp<TextStyle>;
}){
  return <Text allowFontScaling maxFontSizeMultiplier={2} style={[
    {fontSize:size,color,fontWeight:bold?'700':'400',lineHeight:Math.ceil(size*1.48)},style,
  ]}>{children}</Text>;
}
export function Panel({children,style}:{children:React.ReactNode;style?:StyleProp<ViewStyle>}){
  return <LinearGradient colors={['#172E4F','#0F1D36','#0A1327']}
    start={{x:0,y:0}} end={{x:1,y:1}}
    style={[st.panel,style]}><View pointerEvents="none" style={st.topLight}/>{children}</LinearGradient>;
}
export function Action({children,onPress,secondary=false,disabled=false,danger=false,style}:{
  children:React.ReactNode;onPress:()=>void;secondary?:boolean;disabled?:boolean;
  danger?:boolean;style?:StyleProp<ViewStyle>;
}){
  const palette=danger?['#FCA0B3','#D9738C'] as const:
    secondary?['#1E3554','#13253F'] as const:
    ['#D5F8FF','#7DDDF5','#9AC1FB'] as const;
  return <Pressable accessibilityRole="button" accessibilityState={{disabled}}
    android_ripple={{color:'#4674A8'}} disabled={disabled} onPress={onPress}
    style={({pressed})=>[{borderRadius:15,opacity:disabled?.46:pressed?.84:1,
      transform:[{scale:pressed&&!disabled?.98:1}]},style]}>
    <LinearGradient colors={palette} start={{x:0,y:0}} end={{x:1,y:1}}
      style={[st.action,{borderColor:secondary?'#53698D':'#B6E4FF'}]}>
      <T bold size={12} color={secondary?C.frost:C.dark}
        style={{letterSpacing:1.15,textAlign:'center'}}>{children}</T>
    </LinearGradient>
  </Pressable>;
}
export function Chip({children,active,onPress}:{
  children:React.ReactNode;active:boolean;onPress:()=>void;
}){
  return <Pressable onPress={onPress} accessibilityRole="button"
    accessibilityState={{selected:active}}
    style={({pressed})=>[st.chip,{backgroundColor:active?'#22365B':'#11213A',
      borderColor:active?'#82DDF0':'#324967',opacity:pressed?.77:1}]}>
    <T size={11} bold={active} color={active?C.frost:C.sub}>{children}</T>
  </Pressable>;
}
export function Meter({value,tint=C.energy,height=8}:{value:number;tint?:string;height?:number}){
  const pct=Math.round(Math.max(0,Math.min(1,Number.isFinite(value)?value:0))*100);
  return <View accessible accessibilityRole="progressbar"
    accessibilityValue={{min:0,max:100,now:pct}}
    style={{backgroundColor:'#23324C',height,borderRadius:20,overflow:'hidden',
      borderWidth:height>=8?1:0,borderColor:'#3A466C'}}>
    <LinearGradient colors={[tint,'#B5A4FF']} start={{x:0,y:0}} end={{x:1,y:0}}
      style={{width:`${pct}%`,height:'100%',borderRadius:20}}/>
  </View>;
}
export function Section({title,right}:{title:string;right?:React.ReactNode}){
  return <View style={st.section}>
    <View style={{flexDirection:'row',alignItems:'center',gap:9,flexShrink:1}}>
      <View style={st.glyph}/>
      <T bold size={17} color={C.frost} style={{letterSpacing:.2}}>{title}</T>
    </View>{right}
  </View>;
}
const st=StyleSheet.create({
  panel:{borderRadius:19,borderWidth:1,borderColor:'#355577',
    padding:16,marginBottom:12,overflow:'hidden'},
  topLight:{position:'absolute',top:0,left:18,right:18,height:1,
    backgroundColor:'#6E9EC959'},
  action:{paddingHorizontal:16,paddingVertical:13,borderWidth:1,borderRadius:15,
    alignItems:'center',justifyContent:'center',minHeight:49},
  chip:{paddingHorizontal:13,paddingVertical:10,borderRadius:12,
    borderWidth:1,marginRight:7,marginBottom:8,minHeight:45,justifyContent:'center'},
  section:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',
    alignItems:'center',marginTop:20,marginBottom:13,gap:8},
  glyph:{width:5,height:21,borderRadius:5,backgroundColor:C.energy},
});
