/* Regression: AI-generated Hunter portrait must use complete animation frames. */
const fs=require('node:fs');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const art=fs.readFileSync(path.join(root,'apps/mobile/src/experience/hunter-illustrated-frames.ts'),'utf8');
const hunter=fs.readFileSync(path.join(root,'apps/mobile/src/experience/HunterWorld.tsx'),'utf8');
const home=fs.readFileSync(path.join(root,'apps/mobile/src/App.tsx'),'utf8');
const encoded=[...art.matchAll(/data:image\/jpeg;base64,([A-Za-z0-9+/=]+)/g)].map(m=>m[1]);
assert.equal(encoded.length,4,'Hunter must contain four original full-frame images');

function jpegDimensions(b) {
  assert.equal(b.readUInt16BE(0),0xffd8,'Invalid JPEG image');
  let o=2;
  while(o+9<b.length) {
    if(b[o++]!==0xff) continue;
    while(b[o]===0xff)o++;
    const marker=b[o++];
    if(marker===0xd9||marker===0xda)break;
    if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
    const length=b.readUInt16BE(o);
    assert.ok(length>2&&o+length<=b.length,'Corrupt JPEG segment');
    if([0xc0,0xc1,0xc2,0xc3].includes(marker))
      return {height:b.readUInt16BE(o+3),width:b.readUInt16BE(o+5)};
    o+=length;
  }
  throw Error('JPEG size marker missing');
}
for(const [index,base64] of encoded.entries()){
  const file=Buffer.from(base64,'base64');
  assert.ok(file.length>7000,'Hunter frame '+index+' may be an incorrect tiny crop');
  assert.deepEqual(jpegDimensions(file),{height:328,width:300},
    'Hunter frame '+index+' must depict a complete full-size portrait');
}
assert.match(hunter,/resizeMode="contain"/,'Portrait should fit rather than cover-crop');
assert.match(hunter,/\{inspect&&<View pointerEvents="none" style=\{styles\.footer\}/,
  'Do not render the Hunter metadata footer under the Home XP overlay');
assert.doesNotMatch(home,/worldCaption:\{position:'absolute'/,'Level card must not overlay the art');
assert.doesNotMatch(home,/worldFooter:\{position:'absolute'/,'XP progress card must not overlay the art');
console.log('Hunter full-image frames, mobile layout spacing and XP-card isolation verified');
