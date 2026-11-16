import React from 'react';
import {Text,View,Pressable,StyleSheet,type ViewStyle,type TextStyle,type StyleProp} from 'react-native';
import {C} from '../theme';

export function T({children,size=15,color=C.ink,bold=false,style}:{
  children:React.ReactNode;size?:number;color?:string;bold?:boolean;style?:StyleProp<TextStyle>;
}){
  return <Text allowFontScaling maxFontSizeMultiplier={2} style={[{fontSize:size,color,fontWeight:bold?'700':'400',lineHeight:Math.ceil(size*1.55)},style]}>{children}</Text>;
}
export function Panel({children,style}:{children:React.ReactNode;style?:StyleProp<ViewStyle>}){
  return <View style={[st.panel,style]}>{children}</View>;
}
export function Action({children,onPress,secondary=false,disabled=false,danger=false,style}:{
  children:React.ReactNode;onPress:()=>void;secondary?:boolean;disabled?:boolean;
  danger?:boolean;style?:StyleProp<ViewStyle>;
}){
  return <Pressable accessibilityRole="button" accessibilityState={{disabled}}
    disabled={disabled} onPress={onPress}
    style={({pressed})=>[st.action,{backgroundColor:danger?C.danger:secondary?C.elevated:C.energy,
      borderColor:danger?C.danger:secondary?C.borderActive:C.energy,
      opacity:disabled?.45:pressed?.78:1,transform:[{scale:pressed&&!disabled?.985:1}]},style]}>
      <T bold size={13} color={danger?C.dark:secondary?C.ink:C.dark} style={{letterSpacing:.65}}>{children}</T>
    </Pressable>;
}
export function Chip({children,active,onPress}:{
  children:React.ReactNode;active:boolean;onPress:()=>void;
}){
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{selected:active}}
    style={({pressed})=>[st.chip,{backgroundColor:active?'#20466A':C.elevated,
      borderColor:active?C.energy:C.border,opacity:pressed?.78:1}]}>
    <T size={12} bold={active} color={active?C.frost:C.sub}>{children}</T>
  </Pressable>;
}
export function Meter({value,tint=C.energy,height=8}:{value:number;tint?:string;height?:number}){
  const pct=Math.round(Math.max(0,Math.min(1,Number.isFinite(value)?value:0))*100);
  return <View accessible accessibilityRole="progressbar"
    accessibilityValue={{min:0,max:100,now:pct}} style={{backgroundColor:C.muted,height,borderRadius:20,overflow:'hidden'}}>
    <View style={{backgroundColor:tint,width:`${pct}%`,height:'100%',borderRadius:20}}/>
  </View>;
}
export function Section({title,right}:{title:string;right?:React.ReactNode}){
  return <View style={st.section}><T bold size={18} style={{letterSpacing:.15}}>{title}</T>{right}</View>;
}
const st=StyleSheet.create({
  panel:{backgroundColor:C.surface,borderRadius:20,borderWidth:1,borderColor:C.border,padding:16,marginBottom:12},
  action:{paddingHorizontal:18,paddingVertical:12,borderWidth:1,borderRadius:13,alignItems:'center',justifyContent:'center',minHeight:48},
  chip:{paddingHorizontal:13,paddingVertical:10,borderRadius:13,borderWidth:1,marginRight:8,marginBottom:8,minHeight:48,justifyContent:'center'},
  section:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',alignItems:'center',marginTop:19,marginBottom:12},
});
