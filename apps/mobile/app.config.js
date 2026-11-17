/** Builds the Android OAuth redirect intent filter only for a registered Google
 * Android client. The public client ID is configured in GitHub Actions Variables
 * as ASCEND_GOOGLE_ANDROID_CLIENT_ID; no client secret belongs in this app.
 */
const {expo}=require('./app.json');
module.exports=()=>{
  const clientId=(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID||'').trim();
  const config=JSON.parse(JSON.stringify(expo));
  config.extra={...(config.extra||{}),googleAndroidClientId:clientId};
  if(clientId){
    if(!/^[\w.-]{15,170}\.apps\.googleusercontent\.com$/.test(clientId))
      throw new Error('Invalid ASCEND Google Android OAuth client ID');
    const scheme='com.googleusercontent.apps.'+clientId.replace(/\.apps\.googleusercontent\.com$/,'');
    config.android.intentFilters=[
      ...(config.android.intentFilters||[]),
      {action:'VIEW',category:['BROWSABLE','DEFAULT'],
        data:[{scheme,path:'/oauth2redirect'}]}
    ];
  }
  return {expo:config};
};
