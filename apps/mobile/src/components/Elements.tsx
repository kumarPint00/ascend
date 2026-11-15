import React from 'react';
import { Text, View, Pressable, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { C } from '../theme';

export function T({children, size=15, color=C.ink, bold=false, style}: {
  children: React.ReactNode; size?: number; color?: string; bold?: boolean; style?: TextStyle;
}) {
  return <Text style={[{fontSize:size,color,fontWeight:bold?'700':'400'},style]}>{children}</Text>;
}
export function Panel({children,style}: {children:React.ReactNode;style?:ViewStyle}) {
  return <View style={[st.panel,style]}>{children}</View>;
}
export function Action({children,onPress,secondary=false,disabled=false,danger=false,style}: {
  children: React.ReactNode; onPress:()=>void; secondary?:boolean; disabled?:boolean;
  danger?:boolean; style?:ViewStyle;
}) {
  return <Pressable
    accessibilityRole="button" accessibilityState={{disabled}}
    disabled={disabled} onPress={onPress}
    style={({pressed})=>[st.action,{backgroundColor:danger?C.danger:secondary?C.elevated:C.energy,opacity:disabled ? 0.45 : pressed ? 0.78 : 1},style]}
  ><T bold size={14} color={danger?C.bg:secondary?C.ink:C.bg}>{children}</T></Pressable>;
}
export function Chip({children,active,onPress}: {
  children:React.ReactNode;active:boolean;onPress:()=>void;
}) {
  return <Pressable onPress={onPress} accessibilityRole="button"
    style={[st.chip, {backgroundColor:active?C.energy:C.elevated,borderColor:active?C.energy:C.border}]}>
    <T size={12} bold={active} color={active?C.bg:C.sub}>{children}</T>
  </Pressable>;
}
export function Meter({value,tint=C.energy,height=9}: {value:number;tint?:string;height?:number}) {
  return <View style={{backgroundColor:C.muted,height,borderRadius:20,overflow:'hidden'}}>
    <View style={{backgroundColor:tint,width:`${Math.round(Math.max(0,Math.min(1,value))*100)}%`,height:'100%',borderRadius:20}} />
  </View>;
}
export function Section({title,right}: {title:string;right?:React.ReactNode}) {
  return <View style={st.section}><T bold size={17}>{title}</T>{right}</View>;
}
const st=StyleSheet.create({
  panel:{backgroundColor:C.surface,borderRadius:18,borderWidth:1,borderColor:C.border,padding:16,marginBottom:12},
  action:{paddingHorizontal:18,paddingVertical:12,borderRadius:13,alignItems:'center',justifyContent:'center',minHeight:44},
  chip:{paddingHorizontal:12,paddingVertical:9,borderRadius:12,borderWidth:1,marginRight:7,marginBottom:7},
  section:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:18,marginBottom:12},
});
