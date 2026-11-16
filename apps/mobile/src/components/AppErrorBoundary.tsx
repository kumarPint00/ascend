import React from 'react';
import {Alert,Pressable,SafeAreaView,StyleSheet,Text,View} from 'react-native';
import {shareBackupFile} from '../data/backup';
import {C} from '../theme';

/**
 * A JavaScript render-error boundary, not a replacement for native crash logs.
 * Personal quest titles and backup contents are never uploaded or logged.
 */
export class AppErrorBoundary extends React.Component<
  {children:React.ReactNode},{error:Error|null;attempt:number}
>{
  state:{error:Error|null;attempt:number}={error:null,attempt:0};
  static getDerivedStateFromError(error:Error){return {error};}
  componentDidCatch(){ /* Intentionally no personal data in logs. */ }
  render(){
    if(!this.state.error)
      return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
    return <SafeAreaView style={styles.root}>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>ASCEND needs to restart</Text>
        <Text style={styles.body}>
          The screen could not be displayed. Your quests and XP remain in the
          phone's local database. Do not uninstall ASCEND or clear app storage.
        </Text>
        <Pressable accessibilityRole="button" style={styles.primary}
          onPress={()=>this.setState(s=>({error:null,attempt:s.attempt+1}))}>
          <Text style={styles.primaryText}>RETRY SAFELY</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.secondary}
          onPress={()=>void shareBackupFile().catch(()=>{
            Alert.alert('Backup unavailable',
              'The local database could not be exported from this screen. Do not clear app storage.');
          })}>
          <Text style={styles.secondaryText}>SAVE A BACKUP</Text>
        </Pressable>
        <Text style={styles.note}>
          If the problem persists, report the app version and Android crash
          message, but never post private quest or backup data publicly.
        </Text>
      </View>
    </SafeAreaView>;
  }
}
const styles=StyleSheet.create({
  root:{flex:1,justifyContent:'center',backgroundColor:C.bg,padding:24},
  card:{backgroundColor:C.surface,borderColor:C.borderActive,borderWidth:1,
    borderRadius:22,padding:20},
  title:{fontSize:23,fontWeight:'700',color:C.ink,marginBottom:14},
  body:{fontSize:15,lineHeight:24,color:C.sub,marginBottom:20},
  primary:{backgroundColor:C.energy,borderRadius:12,minHeight:48,justifyContent:'center',alignItems:'center'},
  primaryText:{color:C.dark,fontWeight:'700',fontSize:14},
  secondary:{borderColor:C.borderActive,borderWidth:1,marginTop:12,borderRadius:12,
    minHeight:48,justifyContent:'center',alignItems:'center'},
  secondaryText:{color:C.frost,fontWeight:'700',fontSize:14},
  note:{fontSize:12,lineHeight:19,color:C.dim,marginTop:18},
});
