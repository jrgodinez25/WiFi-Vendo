const test=require('node:test');const assert=require('node:assert/strict');const {server}=require('../web/server');
let base;
test('API exposes health, dashboard, settings and rates',async t=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;t.after(()=>new Promise(resolve=>server.close(resolve)));
 const health=await fetch(base+'/api/health').then(r=>r.json());assert.equal(health.app,'WiFi Vendo');assert.equal(health.lcd,false);assert.ok(health.targets.includes('esp8266-wifi'));assert.ok(health.targets.includes('esp32-w5500'));
 const dashboard=await fetch(base+'/api/dashboard').then(r=>r.json());assert.equal(typeof dashboard.lifetimeSales,'number');assert.equal(typeof dashboard.activeSessions,'number');
 const settings=await fetch(base+'/api/settings').then(r=>r.json());assert.equal(settings.lcdEnabled,false);assert.equal('routerPassword'in settings,false);
 const rates=await fetch(base+'/api/rates').then(r=>r.json());assert.ok(Array.isArray(rates));assert.ok(rates.length>0);
});
