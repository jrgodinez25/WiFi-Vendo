const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
test('package scripts and name are configured',()=>{const p=require('../package.json');assert.equal(p.name,'wifi-vendo');assert.ok(p.scripts.test)});
test('feature checklist preserves all requested hardware modes',()=>{const s=fs.readFileSync(path.join(__dirname,'../docs/FEATURE-MATRIX.md'),'utf8').toLowerCase();for(const x of ['esp8266','esp32','w5500','standalone','mikrotik','qr','multi-vendo','pause','resume','ota'])assert.ok(s.includes(x),x)});
test('LCD remains disabled in selected profile',()=>{const s=fs.readFileSync(path.join(__dirname,'../docs/HARDWARE-CONFIG.md'),'utf8');assert.match(s,/LCD: disabled/i)});
