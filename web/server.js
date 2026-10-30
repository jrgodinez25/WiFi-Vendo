'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const enforcement=require('./enforcement');
const PORT=Number(process.env.PORT||3000),PUB=path.join(__dirname,'public'),HOTSPOT=path.join(__dirname,'..','hotspot'),DB=path.join(__dirname,'data.json');
const redeemAttempts=new Map();
const adminLoginAttempts=new Map(),adminSessions=new Map();
const ADMIN_SESSION_MS=8*60*60*1000;
const adminPassword=String(process.env.WIFI_VENDO_ADMIN_PASSWORD||'');
const adminPasswordConfigured=adminPassword.length>=12;
const adminPasswordSalt=crypto.randomBytes(16);
const adminPasswordHash=adminPasswordConfigured?crypto.scryptSync(adminPassword,adminPasswordSalt,64):null;
const state={coinFailures:{},settings:{vendoName:'WiFi Vendo',mode:'standalone',networkMode:'both',ssid:'WiFi-Vendo',routerHost:'',routerPort:8728,routerUser:'',routerPassword:'',coinTimeoutSeconds:60,coinValuePerPulse:1,abuseLimit:5,banMinutes:10,voucherPrefix:'WV',voucherLogin:'username',voucherProfile:'default',validityPolicy:'stack',showPause:true,showExtend:true,memberLogin:false,chargingEnabled:false,dataRatesEnabled:false,internetCheck:true,disableVoucherInput:false,lcdEnabled:false},rates:[{id:'r5',name:'10 Minutes',price:5,minutes:10,validityMinutes:1440,dataMb:0,profile:'default',category:'internet',enabled:true},{id:'r10',name:'30 Minutes',price:10,minutes:30,validityMinutes:1440,dataMb:0,profile:'default',category:'internet',enabled:true}],devices:[{id:'main',name:'Main Vendo',board:'simulator',network:'wifi',online:true,chargingEnabled:false}],vouchers:[],sessions:[],stats:{lifetimeSales:0,currentSales:0,customersServed:0},audit:[]};
try{Object.assign(state,JSON.parse(fs.readFileSync(DB,'utf8')))}catch{}
function save(){const t=DB+'.tmp';fs.writeFileSync(t,JSON.stringify(state,null,2));fs.renameSync(t,DB)}
function send(res,status,data){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'no-referrer','permissions-policy':'camera=(self), microphone=(), geolocation=()','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"});res.end(JSON.stringify(data))}
async function read(req){let s='';for await(const c of req){s+=c;if(s.length>65536)throw Error('Payload too large')}return s?JSON.parse(s):{}}
function newId(p){return p+'-'+crypto.randomBytes(4).toString('hex')}
function log(action,detail){state.audit.unshift({id:newId('evt'),at:new Date().toISOString(),action,detail:detail||{}});state.audit=state.audit.slice(0,200)}
function safeSettings(){const x={...state.settings};delete x.routerPassword;x.routerPasswordConfigured=!!state.settings.routerPassword;return x}
function clientKey(value){return String(value||'guest').trim().slice(0,80)||'guest'}
function coinFailure(clientId){const now=Date.now(),key=clientKey(clientId),entry=state.coinFailures[key]||{count:0,blockedUntil:0};entry.count++;const limit=Math.max(1,Math.min(20,Number(state.settings.abuseLimit)||5));if(entry.count>=limit){entry.blockedUntil=now+Math.max(1,Math.min(1440,Number(state.settings.banMinutes)||10))*60000;entry.count=0}state.coinFailures[key]=entry;return entry}
function coinBlocked(clientId){const entry=state.coinFailures[clientKey(clientId)];return !!entry&&entry.blockedUntil>Date.now()}
function cookieValue(req,name){for(const part of String(req.headers.cookie||'').split(';')){const i=part.indexOf('=');if(i>0&&part.slice(0,i).trim()===name)return decodeURIComponent(part.slice(i+1).trim())}return ''}
function clientAddress(req){return String(req.socket.remoteAddress||'').replace(/^::ffff:/,'')}
function sessionTokenHash(token){return crypto.createHash('sha256').update(token).digest('hex')}
function customerVoucher(req){const token=cookieValue(req,'wv_session');if(!token)return null;const v=state.vouchers.find(x=>x.sessionTokenHash===sessionTokenHash(token));if(!v||!['active','paused'].includes(v.sessionStatus))return null;if(v.clientAddress&&v.clientAddress!==clientAddress(req))return null;return v}
function remainingSeconds(v){let n=Math.max(0,Number(v.remainingSeconds)||0);if(v.sessionStatus==='active'&&v.lastResumedAt)n=Math.max(0,n-Math.floor((Date.now()-v.lastResumedAt)/1000));return n}
function adminSession(req){const token=cookieValue(req,'wv_admin');if(!token)return null;const hash=sessionTokenHash(token),entry=adminSessions.get(hash);if(!entry)return null;if(entry.expiresAt<=Date.now()){adminSessions.delete(hash);return null}if(entry.address!==clientAddress(req))return null;return entry}
function verifyAdminPassword(candidate){if(!adminPasswordConfigured)return false;const actual=crypto.scryptSync(String(candidate||''),adminPasswordSalt,64);return crypto.timingSafeEqual(actual,adminPasswordHash)}
function adminLoginBlocked(req){const e=adminLoginAttempts.get(clientAddress(req));if(!e)return false;if(e.blockedUntil>Date.now())return true;if(e.startedAt+900000<=Date.now()){adminLoginAttempts.delete(clientAddress(req));return false}return e.failures>=5}
function recordAdminLoginFailure(req){const key=clientAddress(req),now=Date.now(),e=adminLoginAttempts.get(key);if(!e||e.startedAt+900000<=now)adminLoginAttempts.set(key,{startedAt:now,failures:1,blockedUntil:0});else{e.failures++;if(e.failures>=5)e.blockedUntil=now+900000}}
function setAdminCookie(res,token,secure){res.setHeader('set-cookie','wv_admin='+encodeURIComponent(token)+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+(ADMIN_SESSION_MS/1000)+(secure?'; Secure':''))}
function clearAdminCookie(res,secure){res.setHeader('set-cookie','wv_admin=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'+(secure?'; Secure':''))}
function setCustomerCookie(res,token,seconds,secure){res.setHeader('set-cookie','wv_session='+encodeURIComponent(token)+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+Math.max(0,Math.floor(seconds))+(secure?'; Secure':''))}
function clearCustomerCookie(res,secure){res.setHeader('set-cookie','wv_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'+(secure?'; Secure':''))}
function sameOriginIfProvided(req){const o=req.headers.origin;if(!o)return true;try{return new URL(o).host===String(req.headers.host||'')}catch{return false}}
function enforceAuthorize(req,seconds){return state.settings.mode==='standalone'?enforcement.authorize(clientAddress(req),seconds):Promise.resolve()}
function enforceDeauthorize(req){return state.settings.mode==='standalone'?enforcement.deauthorize(clientAddress(req)):Promise.resolve()}
function jsonRequest(req){return /^application\/json(?:;|$)/i.test(String(req.headers['content-type']||''))}
function redeemAttemptBlocked(req){const key=clientAddress(req),now=Date.now(),entry=redeemAttempts.get(key);if(!entry||now-entry.startedAt>600000){redeemAttempts.set(key,{startedAt:now,count:0});return false}return entry.count>=10}
function recordRedeemFailure(req){const key=clientAddress(req),now=Date.now(),entry=redeemAttempts.get(key);if(!entry||now-entry.startedAt>600000)redeemAttempts.set(key,{startedAt:now,count:1});else entry.count++}
function adminAllowed(req){const allowed=String(process.env.WIFI_VENDO_ADMIN_IPS||'127.0.0.1,::1').split(',').map(x=>x.trim()).filter(Boolean);return allowed.includes(clientAddress(req))}
function requiresAdmin(req,p){if(p==='/'||p==='/index.html'||p==='/app.js')return true;if(!p.startsWith('/api/'))return false;if(['/api/health','/api/admin/login','/api/admin/session','/api/admin/logout','/api/vouchers/redeem','/api/customer/session','/api/customer/session/action','/api/customer/session/extend'].includes(p))return false;return p!=='/api/rates'||req.method!=='GET'}
function portalRequest(req,p){if(adminAllowed(req))return true;const paths=['/hotspot/customer.html','/hotspot/customer.js','/hotspot/portal.css','/customer.html','/customer.js','/styles.css','/api/health','/api/rates','/api/vouchers/redeem','/api/customer/session','/api/customer/session/action','/api/customer/session/extend'];if(!paths.includes(p))return false;const configured=process.env.WIFI_VENDO_PORTAL_URL;if(configured){try{return new URL(configured).host===String(req.headers.host||'')}catch{return false}}return true}

async function handler(req,res){
 const u=new URL(req.url,'http://localhost'),p=u.pathname;
 if(enforcement.mode==='nftables'&&state.settings.mode==='standalone'&&req.method==='GET'&&!portalRequest(req,p)){res.writeHead(302,{location:process.env.WIFI_VENDO_PORTAL_URL||'/hotspot/customer.html','cache-control':'no-store'});return res.end()}
 if((p==='/admin-login.html'||p==='/admin-login.js')&&!adminAllowed(req))return send(res,403,{error:'Administrator interface is restricted to trusted management IP addresses.'});
 if((p==='/api/admin/login'||p==='/api/admin/session'||p==='/api/admin/logout')&&!adminAllowed(req))return send(res,403,{error:'Administrator interface is restricted to trusted management IP addresses.'});
 if(requiresAdmin(req,p)){
  if(!adminAllowed(req))return send(res,403,{error:'Administrator interface is restricted to trusted management IP addresses.'});
  if(!adminSession(req)){if(req.method==='GET'&&(p==='/'||p==='/index.html')){res.writeHead(302,{location:'/admin-login.html','cache-control':'no-store'});return res.end()}return send(res,401,{error:'Administrator login required.'})}
 }
 if(req.method==='OPTIONS'){res.writeHead(204,{'cache-control':'no-store','x-content-type-options':'nosniff'});return res.end()}
 if(p==='/admin-login.html'&&req.method==='GET'){
  const error=u.searchParams.has('error')?'<p class="error">The password was not accepted. Try again.</p>':u.searchParams.has('locked')?'<p class="error">Too many attempts. Wait 15 minutes before trying again.</p>':'';
  return sendHtml(res,200,`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WiFi Vendo · Administrator Login</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;background:#f2f5fa;color:#172238;font:14px system-ui,sans-serif}.card{width:min(100%,420px);padding:30px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 18px 55px #172b4814}.brand{font-size:20px;font-weight:800;color:#17365f}h1{font-size:25px;margin:28px 0 7px}p{color:#718096;line-height:1.6}.error{color:#a23d4d;font-weight:700}label{display:grid;gap:8px;margin:22px 0;font-weight:700}input{height:48px;padding:0 13px;border:1px solid #d8e1ed;border-radius:9px;font:inherit}button{width:100%;height:47px;border:0;border-radius:9px;background:#245fba;color:#fff;font-weight:800;cursor:pointer}.note{font-size:11px;margin-top:20px}</style></head><body><main class="card"><div class="brand">◉ WiFi Vendo</div><h1>Administrator sign in</h1><p>Sign in from an approved management IP address.</p>${error}<form method="post" action="/api/admin/login"><label>Administrator password<input name="password" type="password" autocomplete="current-password" required autofocus></label><button type="submit">Sign in</button></form><p class="note">Configure WIFI_VENDO_ADMIN_PASSWORD on the server (minimum 12 characters), then restart WiFi Vendo.</p></main><script>document.querySelector('form').addEventListener('submit',async function(e){e.preventDefault();var f=e.currentTarget,p=f.querySelector('input'),b=f.querySelector('button'),m=f.querySelector('.error');b.disabled=true;try{var r=await fetch('/api/admin/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:p.value})}),d=await r.json();if(!r.ok)throw new Error(d.error||'Sign in failed');location.replace('/')}catch(x){if(!m){m=document.createElement('p');m.className='error';f.before(m)}m.textContent=x.message}finally{b.disabled=false}});</script></body></html>`);
 }
 if(p==='/api/admin/login'&&req.method==='POST'){
  if(!sameOriginIfProvided(req))return send(res,403,{error:'Cross-site request rejected'});
  if(!jsonRequest(req))return send(res,415,{error:'JSON request required'});
  if(adminLoginBlocked(req))return send(res,429,{error:'Too many login attempts. Try again in 15 minutes.'});
  if(!adminPasswordConfigured)return send(res,503,{error:'Administrator password is not configured. Set WIFI_VENDO_ADMIN_PASSWORD to at least 12 characters and restart.'});
  const d=await read(req);
  if(!verifyAdminPassword(d.password)){recordAdminLoginFailure(req);log('admin.login.failed',{address:clientAddress(req)});return send(res,401,{error:'Invalid administrator credentials.'})}
  adminLoginAttempts.delete(clientAddress(req));
  const token=crypto.randomBytes(32).toString('base64url'),hash=sessionTokenHash(token),expiresAt=Date.now()+ADMIN_SESSION_MS;
  adminSessions.set(hash,{address:clientAddress(req),expiresAt});
  log('admin.login.succeeded',{address:clientAddress(req)});
  setAdminCookie(res,token,!!req.socket.encrypted);
  return send(res,200,{ok:true,expiresAt:new Date(expiresAt).toISOString()});
 }
 if(p==='/api/admin/session'&&req.method==='GET'){const session=adminSession(req);return send(res,200,{authenticated:!!session,expiresAt:session?new Date(session.expiresAt).toISOString():null})}
 if(p==='/api/admin/logout'&&req.method==='POST'){
  if(!sameOriginIfProvided(req))return send(res,403,{error:'Cross-site request rejected'});
  if(!jsonRequest(req))return send(res,415,{error:'JSON request required'});
  const token=cookieValue(req,'wv_admin');if(token)adminSessions.delete(sessionTokenHash(token));
  clearAdminCookie(res,!!req.socket.encrypted);log('admin.logout',{address:clientAddress(req)});return send(res,200,{ok:true});
 }
 if(p==='/api/health')return send(res,200,{status:'ok',app:'WiFi Vendo',version:'0.3.0',mode:state.settings.mode,routerOS:state.settings.mode==='mikrotik'?'adapter-pending':'not-required',coinAcceptor:'simulator-only',enforcement:enforcement.mode,lcd:false,targets:['esp8266-wifi','esp32-wifi','esp32-w5500']});
 if(p==='/api/dashboard')return send(res,200,{...state.stats,activeSessions:state.sessions.filter(x=>x.status==='accepting').length,devicesOnline:state.devices.filter(x=>x.online).length,devicesTotal:state.devices.length,uptimeSeconds:Math.floor(process.uptime()),mode:state.settings.mode});
 if(p==='/api/settings'&&req.method==='GET')return send(res,200,safeSettings());
 if(p==='/api/settings'&&req.method==='PUT'){const d=await read(req);for(const k of ['vendoName','mode','networkMode','ssid','routerHost','routerPort','routerUser','coinTimeoutSeconds','coinValuePerPulse','abuseLimit','banMinutes','voucherPrefix','voucherLogin','voucherProfile','validityPolicy','showPause','showExtend','memberLogin','chargingEnabled','dataRatesEnabled','internetCheck','disableVoucherInput'])if(k in d)state.settings[k]=d[k];if(d.routerPassword)state.settings.routerPassword=d.routerPassword;log('settings.updated');save();return send(res,200,safeSettings())}
 if(p==='/api/rates'&&req.method==='GET')return send(res,200,state.rates);
 if(p==='/api/rates'&&req.method==='POST'){const d=await read(req);if(!d.name||!(+d.price>0)||!(+d.minutes>0))return send(res,400,{error:'Rate name, positive price and duration are required'});const r={id:newId('rate'),name:String(d.name).slice(0,60),price:+d.price,minutes:+d.minutes,validityMinutes:Math.max(0,+d.validityMinutes||0),dataMb:Math.max(0,+d.dataMb||0),profile:String(d.profile||'default'),category:d.category==='charging'?'charging':'internet',enabled:true};state.rates.push(r);log('rate.created',{id:r.id});save();return send(res,201,r)}
 if(p.startsWith('/api/rates/')&&req.method==='DELETE'){const id=p.split('/').pop(),n=state.rates.length;state.rates=state.rates.filter(x=>x.id!==id);if(n===state.rates.length)return send(res,404,{error:'Rate not found'});log('rate.deleted',{id});save();return send(res,200,{ok:true})}
 if(p==='/api/devices')return send(res,200,state.devices);
 if(p==='/api/vouchers'&&req.method==='GET')return send(res,200,state.vouchers);
 if(p==='/api/vouchers/generate'&&req.method==='POST'){const d=await read(req),rate=state.rates.find(x=>x.id===d.rateId),qty=Math.max(1,Math.min(500,Math.floor(+d.quantity||1)));if(!rate)return send(res,400,{error:'Select a valid promo rate'});const prefix=String(d.prefix||state.settings.voucherPrefix).replace(/[^a-z]/ig,'').slice(0,2).toUpperCase()||'WV',made=[];for(let i=0;i<qty;i++){const code=prefix+crypto.randomBytes(3).toString('hex').toUpperCase(),v={id:newId('vch'),code,username:code,password:state.settings.voucherLogin==='username-password'?crypto.randomBytes(3).toString('hex').toUpperCase():null,rateId:rate.id,rateName:rate.name,price:rate.price,minutes:rate.minutes,profile:rate.profile,status:'unused',createdAt:new Date().toISOString(),expiresAt:null};state.vouchers.push(v);made.push(v)}if(d.addToSales){state.stats.currentSales+=rate.price*qty;state.stats.lifetimeSales+=rate.price*qty}log('vouchers.generated',{quantity:qty,rateId:rate.id});save();return send(res,201,{vouchers:made})}
 if(p==='/api/topup/start'&&req.method==='POST'){const d=await read(req),rate=state.rates.find(x=>x.id===d.rateId&&x.enabled);if(!rate)return send(res,400,{error:'Rate not found'});const client=clientKey(d.clientId);if(coinBlocked(client))return send(res,429,{error:'Coin vending temporarily locked. Please try again later.'});if(state.sessions.some(x=>x.clientId===client&&x.status==='accepting'))return send(res,409,{error:'A coin session is already active'});const timeout=Math.max(15,Math.min(600,Number(state.settings.coinTimeoutSeconds)||60));const s={id:newId('coin'),clientId:client,rateId:rate.id,rateName:rate.name,price:rate.price,received:0,pulses:0,status:'accepting',createdAt:new Date().toISOString(),deadline:Date.now()+timeout*1000};state.sessions.push(s);save();return send(res,201,{sessionId:s.id,amountDue:s.price,received:0,deadline:s.deadline,simulator:true})}
 if(p==='/api/topup/pulse'&&req.method==='POST'){const d=await read(req),s=state.sessions.find(x=>x.id===d.sessionId&&x.status==='accepting');if(!s)return send(res,404,{error:'Active coin session not found'});if(Date.now()>=s.deadline){s.status='expired';coinFailure(s.clientId);save();return send(res,410,{error:'Coin session expired'})}const n=Math.max(1,Math.min(20,Math.floor(Number(d.pulses)||1))),value=Math.max(0.01,Math.min(1000,Number(state.settings.coinValuePerPulse)||1));s.pulses+=n;s.received=Math.round((s.received+n*value)*100)/100;if(s.received>=s.price){s.status='paid';delete state.coinFailures[s.clientId]}save();return send(res,200,{sessionId:s.id,received:s.received,amountDue:s.price,remaining:Math.max(0,Math.round((s.price-s.received)*100)/100),status:s.status,simulator:true})}
 if(p==='/api/topup/cancel'&&req.method==='POST'){const d=await read(req),s=state.sessions.find(x=>x.id===d.sessionId);if(!s)return send(res,404,{error:'Session not found'});if(['paid','completed'].includes(s.status))return send(res,409,{error:'Paid session cannot be cancelled'});if(s.status!=='cancelled'){s.status='cancelled';coinFailure(s.clientId);log('coin.session.cancelled',{sessionId:s.id})}save();return send(res,200,{ok:true})}
 if(p==='/api/topup/complete'&&req.method==='POST'){const d=await read(req),s=state.sessions.find(x=>x.id===d.sessionId&&x.status==='paid');if(!s)return send(res,409,{error:'Session is not paid'});const rate=state.rates.find(x=>x.id===s.rateId),code=state.settings.voucherPrefix.toUpperCase()+crypto.randomBytes(3).toString('hex').toUpperCase(),v={id:newId('vch'),code,username:code,password:null,rateId:rate.id,rateName:rate.name,price:rate.price,minutes:rate.minutes,profile:rate.profile,status:'unused',createdAt:new Date().toISOString(),expiresAt:null};state.vouchers.push(v);s.status='completed';s.voucherId=v.id;state.stats.currentSales+=rate.price;state.stats.lifetimeSales+=rate.price;log('coin.voucher-issued',{voucherId:v.id});save();return send(res,201,{voucher:v})}
 if(p==='/api/vouchers/redeem'&&req.method==='POST'){
  if(redeemAttemptBlocked(req))return send(res,429,{error:'Too many voucher attempts. Please wait ten minutes before trying again.'});
  if(!sameOriginIfProvided(req))return send(res,403,{error:'Cross-site request rejected'});if(!jsonRequest(req))return send(res,415,{error:'JSON request required'});if(!jsonRequest(req))return send(res,415,{error:'JSON request required'});
  const d=await read(req),code=String(d.code||'').trim().toUpperCase();
  if(!/^[A-Z0-9-]{4,32}$/.test(code)){recordRedeemFailure(req);return send(res,400,{error:'Enter a valid voucher code'})}
  const v=state.vouchers.find(x=>x.code===code);
  if(!v){recordRedeemFailure(req);return send(res,404,{error:'Voucher not found. Check the code and try again.'})}
  if(v.status!=='unused'){recordRedeemFailure(req);return send(res,409,{error:'This voucher has already been redeemed or is unavailable.'})}
  const token=crypto.randomBytes(32).toString('base64url'),now=Date.now();
  try{await enforceAuthorize(req,v.minutes*60)}catch(error){return send(res,503,{error:'Network access could not be enabled. Your voucher was not consumed. '+error.message})}
  redeemAttempts.delete(clientAddress(req));v.status='used';v.redeemedAt=new Date(now).toISOString();v.expiresAt=new Date(now+v.minutes*60000).toISOString();
  v.sessionId=newId('sess');v.sessionTokenHash=sessionTokenHash(token);v.clientAddress=clientAddress(req);
  v.sessionStatus='active';v.remainingSeconds=v.minutes*60;v.lastResumedAt=now;
  state.stats.customersServed++;log('voucher.redeemed',{voucherId:v.id});save();
  setCustomerCookie(res,token,v.minutes*60,!!req.socket.encrypted);
  return send(res,200,{ok:true,voucher:{code:v.code,minutes:v.minutes,expiresAt:v.expiresAt},session:{status:v.sessionStatus,remainingSeconds:v.remainingSeconds},mode:state.settings.mode});
 }
 if(p==='/api/customer/session'&&req.method==='GET'){
  const v=customerVoucher(req);if(!v)return send(res,401,{error:'No active customer session. Redeem your voucher to connect.'});
  const remaining=remainingSeconds(v);if(remaining<=0){await enforceDeauthorize(req);v.sessionStatus='expired';v.remainingSeconds=0;v.lastResumedAt=null;v.sessionTokenHash=null;log('customer.session.expired',{voucherId:v.id});save();clearCustomerCookie(res,!!req.socket.encrypted);return send(res,410,{error:'Your internet session has expired.'})}
  return send(res,200,{code:v.code,status:v.sessionStatus,remainingSeconds:remaining,expiresAt:v.expiresAt,rateName:v.rateName,mode:state.settings.mode});
 }
 if(p==='/api/customer/session/action'&&req.method==='POST'){
  if(!sameOriginIfProvided(req))return send(res,403,{error:'Cross-site request rejected'});
  if(!jsonRequest(req))return send(res,415,{error:'JSON request required'});
  const v=customerVoucher(req);if(!v)return send(res,401,{error:'Customer session not authorized.'});
  const d=await read(req),remaining=remainingSeconds(v);if(remaining<=0){await enforceDeauthorize(req);v.sessionStatus='expired';v.remainingSeconds=0;v.sessionTokenHash=null;save();clearCustomerCookie(res,!!req.socket.encrypted);return send(res,410,{error:'Session expired'})}
  if(d.action==='pause'){if(!state.settings.showPause)return send(res,403,{error:'Pause is disabled'});if(v.sessionStatus!=='active')return send(res,409,{error:'Session is not active'});await enforceDeauthorize(req);v.remainingSeconds=remaining;v.sessionStatus='paused';v.lastResumedAt=null}
  else if(d.action==='resume'){if(v.sessionStatus!=='paused')return send(res,409,{error:'Session is not paused'});await enforceAuthorize(req,remaining);v.sessionStatus='active';v.lastResumedAt=Date.now()}
  else if(d.action==='logout'){await enforceDeauthorize(req);v.remainingSeconds=remaining;v.sessionStatus='logged-out';v.lastResumedAt=null;v.sessionTokenHash=null;clearCustomerCookie(res,!!req.socket.encrypted)}
  else return send(res,400,{error:'Unsupported session action'});
  log('customer.session.'+d.action,{voucherId:v.id});save();return send(res,200,{status:v.sessionStatus,remainingSeconds:v.remainingSeconds});
 }
 if(p==='/api/customer/session/extend'&&req.method==='POST'){
  if(!sameOriginIfProvided(req))return send(res,403,{error:'Cross-site request rejected'});
  if(!jsonRequest(req))return send(res,415,{error:'JSON request required'});
  const v=customerVoucher(req),d=await read(req),rate=state.rates.find(x=>x.id===d.rateId&&x.enabled);
  if(!v)return send(res,401,{error:'Customer session not authorized.'});if(!rate)return send(res,404,{error:'Promo rate not found.'});
  if(!state.settings.showExtend)return send(res,403,{error:'Extension is disabled'});
  if(!['active','paused'].includes(v.sessionStatus))return send(res,409,{error:'Session cannot be extended'});
  const remaining=remainingSeconds(v);if(remaining<=0){await enforceDeauthorize(req);v.sessionStatus='expired';v.sessionTokenHash=null;save();clearCustomerCookie(res,!!req.socket.encrypted);return send(res,410,{error:'Session expired'})}
  v.remainingSeconds=remaining+rate.minutes*60;v.expiresAt=new Date(Date.now()+v.remainingSeconds*1000).toISOString();if(v.sessionStatus==='active'){await enforceAuthorize(req,v.remainingSeconds);v.lastResumedAt=Date.now();}
  v.price+=rate.price;state.stats.currentSales+=rate.price;state.stats.lifetimeSales+=rate.price;log('customer.session.extended',{voucherId:v.id,rateId:rate.id});save();
  return send(res,200,{status:v.sessionStatus,remainingSeconds:v.remainingSeconds,expiresAt:v.expiresAt});
 }
 if(p==='/api/stats/reset'&&req.method==='POST'){const d=await read(req);if(!['currentSales','lifetimeSales','customersServed'].includes(d.metric))return send(res,400,{error:'Invalid statistic'});state.stats[d.metric]=0;log('stats.reset',{metric:d.metric});save();return send(res,200,state.stats)}
 if(p==='/api/audit')return send(res,200,state.audit);
 if(p==='/api/router/test'&&req.method==='POST')return send(res,501,{error:'RouterOS adapter pending; no live router connection has been attempted.'});
 if(req.method==='GET'&&['/generate_204','/gen_204','/hotspot-detect.html','/connecttest.txt','/ncsi.txt','/redirect'].includes(p)){res.writeHead(302,{location:process.env.WIFI_VENDO_PORTAL_URL||'/hotspot/customer.html','cache-control':'no-store'});return res.end()}const file=p==='/'?'/index.html':decodeURIComponent(p),isHotspot=file.startsWith('/hotspot/'),root=isHotspot?HOTSPOT:PUB,target=path.resolve(root,isHotspot?'.'+file.slice('/hotspot'.length):'.'+file);if(!target.startsWith(root+path.sep))return send(res,403,{error:'Forbidden'});fs.readFile(target,(e,b)=>{if(e)return send(res,404,{error:'Not found'});const ext=path.extname(target);res.writeHead(200,{'content-type':({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'}[ext]||'application/octet-stream'),'cache-control':ext==='.html'?'no-cache':'public, max-age=300','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'no-referrer','permissions-policy':'camera=(self), microphone=(), geolocation=()','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"});res.end(b)})
}
const server=http.createServer((req,res)=>handler(req,res).catch(e=>send(res,500,{error:e.message})));
if(require.main===module){
 (async()=>{
  if(state.settings.mode==='standalone'&&enforcement.mode==='nftables')await enforcement.setup();
  server.listen(PORT,()=>console.log('WiFi Vendo listening on http://localhost:'+PORT));
 })().catch(error=>{console.error('WiFi Vendo startup blocked: firewall initialization failed:',error.message);process.exitCode=1});
}
module.exports={server,state};
