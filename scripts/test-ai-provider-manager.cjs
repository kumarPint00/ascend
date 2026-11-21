// Integration tests for hybrid provider fallbacks with mocked HTTP responses,
// mocked Android secure storage and the same shape as our SQLite usage ledger.
// No personal API key, network request or real billing is involved.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const ts=require('typescript');
const sourcePath=path.join(__dirname,'../apps/mobile/src/ai/provider-manager.ts');
const source=fs.readFileSync(sourcePath,'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021,
  esModuleInterop:true,
}}).outputText;
const vault=new Map(),usage=new Map();
const storage={
  getItemAsync:async key=>vault.get(key)??null,
  setItemAsync:async(key,value)=>{vault.set(key,value);},
  deleteItemAsync:async key=>{vault.delete(key);},
};
const db={
  getFirstAsync:async(sql,provider,day)=>{
    const row=usage.get(provider+'|'+day);
    if(!row)return null;
    if(sql.includes('AS used'))return {used:row.input_tokens+row.output_tokens};
    return row;
  },
  getAllAsync:async()=>Array.from(usage.values()).slice(0,70),
  runAsync:async(sql,provider,day,requests,input,output,hits,until)=>{
    if(!sql.includes('ai_provider_usage'))throw Error('Unexpected SQL');
    const key=provider+'|'+day;
    const row=usage.get(key)??{provider,day,requests:0,input_tokens:0,
      output_tokens:0,rate_limit_hits:0,blocked_until:null};
    row.requests+=requests;row.input_tokens+=input;row.output_tokens+=output;
    row.rate_limit_hits+=hits;row.blocked_until=until;
    usage.set(key,row);
  },
};
const loaded=new Module(sourcePath);
loaded.filename=sourcePath;
const realRequire=loaded.require.bind(loaded);
loaded.require=name=>{
  if(name==='expo-secure-store')return storage;
  if(name==='../data/repository')return {getDb:async()=>db};
  if(name==='../../modules/ascend-nano')return {
    nanoStatus:async()=> 'unsupported',
    nanoGenerate:async()=>{throw Error('Nano unavailable');},
  };
  return realRequire(name);
};
loaded._compile(compiled,sourcePath);
const api=loaded.exports;
const settingsUI=fs.readFileSync(path.join(__dirname,
  '../apps/mobile/src/experience/ProviderSettings.tsx'),'utf8');
const singleQuestUI=fs.readFileSync(path.join(__dirname,
  '../apps/mobile/src/experience/NanoCoach.tsx'),'utf8');
const roadmapUI=fs.readFileSync(path.join(__dirname,
  '../apps/mobile/src/experience/RoadmapArchitect.tsx'),'utf8');
assert.ok(singleQuestUI.includes('<ProviderSettings'));
assert.ok(roadmapUI.includes('<ProviderSettings'));
assert.ok(settingsUI.includes('PROVIDER_MODELS[provider]'));
assert.ok(settingsUI.includes('storeProviderKey(editing,value)'));
assert.ok(settingsUI.includes('deleteProviderKey(provider)'));
assert.ok(settingsUI.includes('saveSelectedProvider(next)'));
assert.ok(settingsUI.includes('saveSelectedModel(provider,model)'));
assert.ok(!settingsUI.includes('gsk_…')); // no Groq-only configuration panel
async function test(){
  // Legacy Groq key is migrated without modification and never exported.
  const legacy='gsk_'+('x'.repeat(40));
  vault.set('ascend.groq.personal-key.v1',legacy);
  const keys=await api.configuredProviders();
  assert.equal(keys.groq,true);
  assert.equal(vault.get('ascend.ai.provider.key.groq'),legacy);
  await api.storeProviderKey('openrouter','sk-or-v1-'+('z'.repeat(40)));
  assert.throws(()=>api.validateProviderKey('groq','invalid'));
  // Explicit user-selected models and provider choice persist in secure storage.
  assert.equal(await api.selectedModel('groq'),'openai/gpt-oss-20b');
  await api.saveSelectedModel('groq','openai/gpt-oss-120b');
  assert.equal(await api.selectedModel('groq'),'openai/gpt-oss-120b');
  assert.equal(vault.get('ascend.ai.provider.model.v1.groq'),'openai/gpt-oss-120b');
  await api.saveSelectedProvider('groq');
  assert.equal(await api.selectedProvider(),'groq');
  await api.saveSelectedProvider('auto');
  assert.equal(await api.selectedProvider(),'auto');
  await assert.rejects(api.saveSelectedModel('groq','openai/paid-model'),/allowlist/);
  await api.saveSelectedModel('gemini','gemini-2.5-flash-lite');
  assert.equal(await api.selectedModel('gemini'),'gemini-2.5-flash-lite');
  const prompt='Return exactly one safe JSON quest draft';
  let requests=[];
  global.fetch=async(url)=>{
    requests.push(url);
    if(url.includes('groq.com'))return new Response('{}',{
      status:429,headers:{'retry-after':'61'}
    });
    return new Response(JSON.stringify({choices:[{message:{content:'{"title":"Read a chapter"}'}}],
      usage:{prompt_tokens:20,completion_tokens:10}}),{status:200,
      headers:{'content-type':'application/json'}});
  };
  const result=await api.generateWithProviders(prompt,'quest','auto',undefined,raw=>{
    assert.equal(JSON.parse(raw).title,'Read a chapter');
  });
  assert.equal(result.provider,'openrouter');
  assert.equal(requests.length,2);
  const ledger=await api.readProviderUsage();
  assert.equal(ledger.find(r=>r.provider==='groq').rateLimitHits,1);
  assert.equal(ledger.find(r=>r.provider==='openrouter').inputTokens,20);
  // Cooldown blocks Groq on immediate retries.
  requests=[];
  const again=await api.generateWithProviders(prompt,'quest');
  assert.equal(again.provider,'openrouter');assert.equal(requests.length,1);
  // Bad model output should fall through, not write a quest.
  usage.clear();requests=[];
  global.fetch=async url=>{
    requests.push(url);
    const content=url.includes('groq.com')?'not-json':'{"title":"Valid"}';
    return new Response(JSON.stringify({choices:[{message:{content}}]}),{status:200});
  };
  const validated=await api.generateWithProviders(prompt,'quest','auto',undefined,raw=>{
    const value=JSON.parse(raw);assert.ok(value.title);
  });
  assert.equal(validated.provider,'openrouter');
  assert.equal(requests.length,2);
  // Verify selected model appears in actual outbound request, not just UI state.
  usage.clear();requests=[];
  await api.storeProviderKey('gemini','AI'+('k'.repeat(38)));
  global.fetch=async (url,init)=>{
    requests.push({url,body:JSON.parse(init.body)});
    return new Response(JSON.stringify({candidates:[{
      content:{parts:[{text:'{"title":"Test Gemini model"}'}]}
    }]}),{status:200});
  };
  const gemini=await api.generateWithProviders(prompt,'quest','gemini',undefined,
    raw=>assert.equal(JSON.parse(raw).title,'Test Gemini model'));
  assert.equal(gemini.provider,'gemini');
  assert.match(requests[0].url,/gemini-2\.5-flash-lite:generateContent/);
  // Secure-store persistence does not depend on successful inference.
  assert.equal(await api.selectedModel('groq'),'openai/gpt-oss-120b');
  assert.equal((await api.configuredProviders()).gemini,true);
  // Deleting Groq must remove its legacy AND current secure storage slots.
  await api.deleteProviderKey('groq');
  assert.equal(vault.has('ascend.ai.provider.key.groq'),false);
  assert.equal(vault.has('ascend.groq.personal-key.v1'),false);
  // Paid providers never participate in AUTO, even if their keys are saved.
  await api.storeProviderKey('openai','sk-'+('o'.repeat(40)));
  await api.storeProviderKey('claude','sk-ant-'+('a'.repeat(40)));
  assert.equal((await api.configuredProviders()).openai,true);
  await assert.rejects(api.generateWithProviders(prompt,'quest','openai'),
    /paid API approval/i);
  await assert.rejects(api.generateWithProviders(prompt,'quest','claude'),
    /paid API approval/i);
  usage.clear();requests=[];
  global.fetch=async(url,init)=>{
    requests.push({url,headers:init.headers,body:JSON.parse(init.body)});
    return new Response(JSON.stringify({choices:[{message:{content:'{"title":"Test GPT"}'}}],
      usage:{prompt_tokens:14,completion_tokens:6}}),{status:200});
  };
  const gpt=await api.generateWithProviders(prompt,'quest','openai',undefined,
    raw=>assert.equal(JSON.parse(raw).title,'Test GPT'),true);
  assert.equal(gpt.provider,'openai');
  assert.deepEqual(gpt.attempted,['openai']);
  assert.equal(requests[0].body.model,'gpt-4.1-mini');
  assert.match(requests[0].headers.Authorization,/Bearer sk-/);
  usage.clear();requests=[];
  global.fetch=async(url,init)=>{
    requests.push({url,headers:init.headers,body:JSON.parse(init.body)});
    return new Response(JSON.stringify({content:[{type:'text',text:'{"title":"Test Claude"}'}],
      usage:{input_tokens:30,output_tokens:8}}),{status:200});
  };
  const claude=await api.generateWithProviders(prompt,'quest','claude',undefined,
    raw=>assert.equal(JSON.parse(raw).title,'Test Claude'),true);
  assert.equal(claude.provider,'claude');
  assert.equal(requests[0].body.model,'claude-haiku-4-5');
  assert.equal(requests[0].headers['anthropic-version'],'2023-06-01');
  assert.equal((await api.readProviderUsage()).find(x=>x.provider==='claude').outputTokens,8);
  // No hidden cost: both paid credentials coexist while AUTO only selects free.
  usage.clear();requests=[];
  await api.deleteProviderKey('groq');await api.deleteProviderKey('gemini');
  await api.deleteProviderKey('openrouter');
  await assert.rejects(api.generateWithProviders(prompt,'quest','auto'),/Configure a different free provider/i);
  assert.equal(requests.length,0);
  console.log('PASS: persistent model/provider preferences, selected model requests, failover, quotas and key lifecycle');
}
test().catch(e=>{console.error(e);process.exitCode=1;});
