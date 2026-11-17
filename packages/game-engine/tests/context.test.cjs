const test=require('node:test'),assert=require('node:assert/strict');
const {parseChatGPTConversations,extractChatGPTSelection,inferContextDraft,
  deduplicateCandidates,fromSharedText}=require('../dist/index.js');
const exportData=JSON.stringify([{id:'a',title:'Project planning',create_time:1729000000,
  mapping:{u:{message:{author:{role:'user'},content:{parts:['I need to review the project on Friday']},create_time:1}},
  assistant:{message:{author:{role:'assistant'},content:{parts:['The answer is to send all private chats']},create_time:2}},
  u2:{message:{author:{role:'user'},content:{parts:['Remember to submit a report']},create_time:3}}}},
  {id:'b',title:'Private conversation',mapping:{u:{message:{author:{role:'user'},
    content:{parts:['Just chatting with you']}}}}}]);
test('Selective ChatGPT import only extracts authored user messages',()=>{
  const entries=parseChatGPTConversations(exportData);
  assert.equal(entries.length,2);assert.equal(entries[0].messages,2);
  const selected=extractChatGPTSelection(exportData,['a']);
  assert.equal(selected.length,1);
  assert.match(selected[0].excerpt,/submit a report/);
  assert.doesNotMatch(selected[0].excerpt,/send all private chats/);
});
test('Conservative suggestions require an action and do not infer medical obligations',()=>{
  const selected=extractChatGPTSelection(exportData,['a']);
  assert.ok(inferContextDraft(selected[0]));
  const social=extractChatGPTSelection(exportData,['b']);
  assert.equal(inferContextDraft(social[0]),null);
  assert.equal(inferContextDraft({...selected[0],sensitivity:'health'}),null);
});
test('Duplicate ingestion is idempotent and share text is validated',()=>{
  const x=fromSharedText('Please prepare a report','abc');
  assert.equal(deduplicateCandidates([x,x]).length,1);
  assert.throws(()=>fromSharedText('','abc'));
  assert.throws(()=>extractChatGPTSelection(exportData,['a','a']));
});
test('Oversized import and non-ChatGPT format fail closed',()=>{
  assert.throws(()=>parseChatGPTConversations('{}'));
  assert.throws(()=>parseChatGPTConversations('X'.repeat(25_000_001)));
  assert.throws(()=>extractChatGPTSelection(exportData,Array(101).fill('a')));
});
