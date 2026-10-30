'use strict';
const $=id=>document.getElementById(id);
let session=null,remaining=0,tick=null,poll=null,stream=null,detector=null,scanFrame=null,busy=false;
async function api(url,options={}) {
  const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options,headers:{'content-type':'application/json',...(options.headers||{})}});
  const data=await response.json().catch(()=>({error:'Unexpected server response'}));
  if(!response.ok)throw new Error(data.error||'Request failed');
  return data;
}
function notice(message,kind='info') {
  const el=$('notice');el.textContent=message;el.dataset.kind=kind;el.classList.add('visible');
  clearTimeout(notice.timer);notice.timer=setTimeout(()=>el.classList.remove('visible'),5000);
}
function formatTime(value) {
  const seconds=Math.max(0,Math.floor(Number(value)||0));
  const days=Math.floor(seconds/86400),hours=Math.floor((seconds%86400)/3600),minutes=Math.floor((seconds%3600)/60),secs=seconds%60;
  if(days)return days+'d '+hours+'h '+minutes+'m';
  if(hours)return hours+'h '+String(minutes).padStart(2,'0')+'m';
  return minutes+':'+String(secs).padStart(2,'0');
}
function stopTimers(){if(tick)clearInterval(tick);if(poll)clearInterval(poll);tick=null;poll=null}
function stopCamera(){
  if(scanFrame)cancelAnimationFrame(scanFrame);scanFrame=null;
  if(stream){stream.getTracks().forEach(track=>track.stop());stream=null}
  const video=$('camera');video.pause();video.srcObject=null;video.hidden=true;$('camera-note').hidden=true;
}
function showLogin(){
  stopTimers();session=null;$('session-card').hidden=true;$('login-card').hidden=false;
}
function showSession(data){
  session=data;remaining=Math.max(0,Number(data.remainingSeconds)||0);
  $('login-card').hidden=true;$('session-card').hidden=false;
  $('session-code').textContent=data.code||'—';
  $('expiry').textContent=data.expiresAt?new Date(data.expiresAt).toLocaleString():'—';
  paintSession();
  stopTimers();
  tick=setInterval(()=>{if(session?.status==='active'){remaining=Math.max(0,remaining-1);paintSession();if(remaining===0)syncSession()}},1000);
  poll=setInterval(syncSession,20000);
}
function paintSession(){
  if(!session)return;
  const active=session.status==='active',paused=session.status==='paused';
  $('time-left').textContent=formatTime(remaining);
  $('session-state').textContent=active?'Your internet time is running':paused?'Your time is paused':'Session '+session.status;
  $('session-pill').textContent=active?'Active':paused?'Paused':'Ended';
  $('session-pill').className='status-pill '+(active?'is-active':paused?'is-paused':'is-ended');
  $('pause').hidden=!active;$('resume').hidden=!paused;$('logout').disabled=!active&&!paused;
  $('extend').disabled=!active&&!paused;
}
async function syncSession(){
  try{const data=await api('/api/customer/session');showSession(data)}
  catch(error){if(error.message.includes('No active customer session')||error.message.includes('not authorized')||error.message.includes('expired')){showLogin();if(error.message.includes('expired'))notice(error.message,'warning')}else notice(error.message,'error')}
}
async function loadRates(){
  try{
    const rates=await api('/api/rates'),select=$('extend-rate');select.replaceChildren();
    const available=rates.filter(rate=>rate.enabled&&rate.category==='internet');
    for(const rate of available){const option=document.createElement('option');option.value=rate.id;option.textContent=rate.name+' · ₱'+Number(rate.price).toFixed(2)+' · '+rate.minutes+' min';select.append(option)}
    $('extend').disabled=available.length===0;
    if(!available.length){const option=document.createElement('option');option.textContent='No extension plans available';select.append(option)}
  }catch(error){notice('Promo plans could not be loaded: '+error.message,'error')}
}
$('redeem-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  const code=$('voucher').value.trim().toUpperCase();if(!code){notice('Enter your voucher code first.','warning');return}
  busy=true;$('redeem').disabled=true;$('redeem').textContent='Connecting…';
  try{const data=await api('/api/vouchers/redeem',{method:'POST',body:JSON.stringify({code})});stopCamera();await loadRates();await syncSession();notice('Voucher accepted. Your session is ready.','success')}
  catch(error){notice(error.message,'error')}
  finally{busy=false;$('redeem').disabled=false;$('redeem').innerHTML='Connect to the internet <span aria-hidden="true">→</span>'}
});
async function sessionAction(action){
  if(busy||!session)return;busy=true;
  try{await api('/api/customer/session/action',{method:'POST',body:JSON.stringify({action})});if(action==='logout'){stopTimers();session=null;showLogin();notice('Your session has ended.','success')}else await syncSession()}
  catch(error){notice(error.message,'error');await syncSession()}
  finally{busy=false}
}
$('pause').addEventListener('click',()=>sessionAction('pause'));
$('resume').addEventListener('click',()=>sessionAction('resume'));
$('logout').addEventListener('click',()=>{if(confirm('End your internet session now? Any remaining time will be forfeited.'))sessionAction('logout')});
$('extend').addEventListener('click',async()=>{
  if(busy||!session)return;const rateId=$('extend-rate').value;if(!rateId){notice('No extension plan is available.','warning');return}
  busy=true;$('extend').disabled=true;
  try{await api('/api/customer/session/extend',{method:'POST',body:JSON.stringify({rateId})});await syncSession();notice('Your session time has been extended.','success')}
  catch(error){notice(error.message,'error')}
  finally{busy=false;paintSession()}
});
$('scan').addEventListener('click',async()=>{
  if(!('BarcodeDetector'in window)){notice('QR scanning is not supported by this browser. Please enter the code manually.','warning');return}
  if(!navigator.mediaDevices?.getUserMedia){notice('Camera access is unavailable. Enter your voucher code manually.','warning');return}
  try{
    detector=new BarcodeDetector({formats:['qr_code']});stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
    const video=$('camera');video.srcObject=stream;video.hidden=false;$('camera-note').hidden=false;await video.play();
    const scan=async()=>{if(!stream||video.hidden)return;try{const hits=await detector.detect(video);if(hits.length){$('voucher').value=String(hits[0].rawValue||'').trim().toUpperCase();stopCamera();$('voucher').focus();notice('Voucher QR code scanned. Select Connect to continue.','success');return}}catch{}scanFrame=requestAnimationFrame(scan)};
    scan();
  }catch(error){stopCamera();notice('Unable to open camera. Check browser permission or enter the code manually.','warning')}
});
$('year').textContent=new Date().getFullYear();
loadRates().finally(syncSession);
window.addEventListener('pagehide',stopCamera);
