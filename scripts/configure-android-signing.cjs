const fs = require('node:fs');
const file = process.argv[2] || 'apps/mobile/android/app/build.gradle';
let gradle = fs.readFileSync(file, 'utf8');
if (!gradle.includes('signingConfigs {')) throw new Error('Expo signingConfigs block not found');
if (!/buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?signingConfig signingConfigs\.debug/.test(gradle)) {
  throw new Error('Expo release build signing configuration changed; inspect generated Gradle');
}
if (gradle.includes('ascendRelease')) throw new Error('Release signing already configured');
gradle = gradle.replace('signingConfigs {', `signingConfigs {
        ascendRelease {
            storeFile file(System.getenv('ASCEND_KEYSTORE_FILE'))
            storePassword System.getenv('ASCEND_KEYSTORE_PASSWORD')
            keyAlias System.getenv('ASCEND_KEY_ALIAS')
            keyPassword System.getenv('ASCEND_KEY_PASSWORD')
        }`);
gradle = gradle.replace(/(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
  '$1signingConfig signingConfigs.ascendRelease');
fs.writeFileSync(file, gradle);
console.log('Configured persistent Android release signing');
