const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ascend-update-test-'));
try {
  execFileSync('tsc',['--target','ES2020','--module','commonjs','--strict','--outDir',dir,
    path.join(__dirname,'../apps/mobile/src/updates/release.ts')],{stdio:'pipe'});
  const {parseRelease}=require(path.join(dir,'release.js'));
  const good={
    draft:false,prerelease:false,tag_name:'v0.2.0',
    body:'Update\n<!-- ASCEND_ANDROID_RELEASE {"packageName":"com.ascendrpg.personal","versionCode":2} -->',
    html_url:'https://github.com/kumarPint00/ascend/releases/tag/v0.2.0',
    assets:[{name:'ascend-android.apk',size:30000000,
      browser_download_url:'https://github.com/kumarPint00/ascend/releases/download/v0.2.0/ascend-android.apk'}],
  };
  const copy=()=>JSON.parse(JSON.stringify(good));
  assert.equal(parseRelease(good,1,'com.ascendrpg.personal')?.versionCode,2);
  assert.equal(parseRelease(good,2,'com.ascendrpg.personal'),null);
  assert.equal(parseRelease(good,3,'com.ascendrpg.personal'),null);
  assert.equal(parseRelease(good,1,'com.other'),null);
  const badUrl=copy();badUrl.assets[0].browser_download_url='https://evil.example/a.apk';
  assert.equal(parseRelease(badUrl,1,'com.ascendrpg.personal'),null);
  const badCode=copy();badCode.body=badCode.body.replace('versionCode":2','versionCode":1');
  assert.equal(parseRelease(badCode,1,'com.ascendrpg.personal'),null);
  const missing=copy();missing.assets=[];
  assert.equal(parseRelease(missing,1,'com.ascendrpg.personal'),null);
  const preview=copy();preview.prerelease=true;
  assert.equal(parseRelease(preview,1,'com.ascendrpg.personal'),null);
  const malformed=copy();malformed.body='<!-- ASCEND_ANDROID_RELEASE {} -->';
  assert.equal(parseRelease(malformed,1,'com.ascendrpg.personal'),null);
  const invalidTag=copy();invalidTag.tag_name='dev';
  assert.equal(parseRelease(invalidTag,1,'com.ascendrpg.personal'),null);
  console.log('10 Android update policy tests passed');
} finally {fs.rmSync(dir,{recursive:true,force:true});}
