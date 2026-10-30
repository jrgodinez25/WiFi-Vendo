const test=require('node:test');const assert=require('node:assert/strict');const {server}=require('../web/server');
let base;
test('API exposes health, dashboard, settings and rates',async t=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;t.after(()=>new Promise(resolve=>server.close(resolve)));
 const health=await fetch(base+'/api/health').then(r=>r.json());assert.equal(health.app,'WiFi Vendo');assert.equal(health.lcd,false);assert.ok(health.targets.includes('esp8266-wifi'));assert.ok(health.targets.includes('esp32-w5500'));
 const dashboard=await fetch(base+'/api/dashboard').then(r=>r.json());assert.equal(typeof dashboard.lifetimeSales,'number');assert.equal(typeof dashboard.activeSessions,'number');
 const settings=await fetch(base+'/api/settings').then(r=>r.json());assert.equal(settings.lcdEnabled,false);assert.equal('routerPassword'in settings,false);
 const rates=await fetch(base+'/api/rates').then(r=>r.json());assert.ok(Array.isArray(rates));assert.ok(rates.length>0);
 const clientId='coin-test-'+Date.now(),rateId=rates[0].id;
 const started=await fetch(base+'/api/topup/start',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId,rateId})});
 assert.equal(started.status,201);
 const coin=await started.json();
 const pulse=await fetch(base+'/api/topup/pulse',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sessionId:coin.sessionId,pulses:1,valuePerPulse:999})});
 const pulseResult=await pulse.json();
 assert.equal(pulse.status,200);
 assert.equal(pulseResult.received,1,'client-supplied coin denomination must be ignored');
 const cancelled=await fetch(base+'/api/topup/cancel',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sessionId:coin.sessionId})});
 assert.equal(cancelled.status,200);
 for(let i=0;i<4;i++){
  const next=await fetch(base+'/api/topup/start',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId,rateId})});
  assert.equal(next.status,201);
  const nextCoin=await next.json();
  const stop=await fetch(base+'/api/topup/cancel',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sessionId:nextCoin.sessionId})});
  assert.equal(stop.status,200);
 }
 const locked=await fetch(base+'/api/topup/start',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId,rateId})});
 assert.equal(locked.status,429,'repeated abandoned coin sessions must trigger temporary lockout');

});
