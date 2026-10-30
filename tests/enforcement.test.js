const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const testSource=fs.readFileSync(require.resolve('../web/enforcement'),'utf8');
const serverSource=fs.readFileSync(require.resolve('../web/server'),'utf8');
test('standalone firewall scripts use real newlines',()=>{assert.doesNotMatch(testSource,/\\\\n/);assert.match(testSource,/add table inet wifi_vendo\\n/);});
test('standalone firewall is initialized before the HTTP listener starts',()=>{assert.match(serverSource,/await enforcement\.setup\(\)[\s\S]*?server\.listen/);});
