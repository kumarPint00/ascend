// Builds a standalone browser preview with the same tested game-engine rules.
// The browser UI is a demo, and stores data separately from the Android app.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const template = fs.readFileSync(path.join(root,'web-preview','template.html'),'utf8');
const engine = fs.readFileSync(path.join(root,'packages','game-engine','dist','index.js'),'utf8');
const embedded = `const ENGINE = (()=>{const exports={};\n${engine}\nreturn exports;})();`;
fs.writeFileSync(path.join(root,'web-preview','index.html'),template.replace('/* __ENGINE_BUNDLE__ */', embedded));
console.log('Built web-preview/index.html with tested game rules');
