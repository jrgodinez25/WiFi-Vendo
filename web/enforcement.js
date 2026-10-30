'use strict';
const {spawn,execFile}=require('node:child_process');
const {promisify}=require('node:util');
const net=require('node:net');
const execFileAsync=promisify(execFile);
const mode=process.env.WIFI_VENDO_ENFORCEMENT==='nftables'?'nftables':'simulated';
const iface=process.env.WIFI_VENDO_LAN_IFACE||'br-vendo';
let ready=false,setupInFlight=null;
function validInterface(value){return /^[a-zA-Z0-9_.:-]{1,15}$/.test(value)}
function runNft(script){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.env.NFT_BIN||'nft',['-f','-'],{stdio:['pipe','pipe','pipe']});
    let stdout='',stderr='';
    child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);
    child.on('error',reject);child.on('close',code=>code===0?resolve(stdout):reject(new Error(stderr.trim()||'nft command failed')));
    child.stdin.end(script);
  });
}
async function exists(args){try{await execFileAsync(process.env.NFT_BIN||'nft',args,{timeout:5000});return true}catch{return false}}
async function setup(){
  if(mode==='simulated')return {mode,ready:true};
  if(ready)return {mode,ready:true};
  if(setupInFlight)return setupInFlight;
  setupInFlight=(async()=>{
    if(!validInterface(iface))throw new Error('Invalid WIFI_VENDO_LAN_IFACE value');
    if(!await exists(['list','table','inet','wifi_vendo']))await runNft('add table inet wifi_vendo\\n');
    if(!await exists(['list','set','inet','wifi_vendo','allowed_v4']))await runNft('add set inet wifi_vendo allowed_v4 { type ipv4_addr; flags timeout; }\\n');
    if(!await exists(['list','set','inet','wifi_vendo','allowed_v6']))await runNft('add set inet wifi_vendo allowed_v6 { type ipv6_addr; flags timeout; }\\n');
    if(!await exists(['list','chain','inet','wifi_vendo','forward']))await runNft('add chain inet wifi_vendo forward { type filter hook forward priority -10; policy accept; }\\n');
    const chain=await execFileAsync(process.env.NFT_BIN||'nft',['list','chain','inet','wifi_vendo','forward'],{timeout:5000});
    if(!chain.stdout.includes('ip saddr != @allowed_v4'))await runNft('add rule inet wifi_vendo forward iifname "'+iface+'" ip saddr != @allowed_v4 drop\\n');
    if(!chain.stdout.includes('ip6 saddr != @allowed_v6'))await runNft('add rule inet wifi_vendo forward iifname "'+iface+'" ip6 saddr != @allowed_v6 drop\\n');
    if(!await exists(['list','chain','inet','wifi_vendo','portal_nat']))await runNft('add chain inet wifi_vendo portal_nat { type nat hook prerouting priority dstnat; policy accept; }\\n');
    const nat=await execFileAsync(process.env.NFT_BIN||'nft',['list','chain','inet','wifi_vendo','portal_nat'],{timeout:5000});
    if(!nat.stdout.includes('ip saddr != @allowed_v4'))await runNft('add rule inet wifi_vendo portal_nat iifname "'+iface+'" ip saddr != @allowed_v4 tcp dport 80 redirect to :3000\\n');
    if(!nat.stdout.includes('ip6 saddr != @allowed_v6'))await runNft('add rule inet wifi_vendo portal_nat iifname "'+iface+'" ip6 saddr != @allowed_v6 tcp dport 80 redirect to :3000\\n');
    ready=true;return {mode,ready:true,interface:iface};
  })();
  try{return await setupInFlight}finally{setupInFlight=null}
}
async function authorize(address,seconds){
  if(mode==='simulated')return {mode,authorized:true};
  const family=net.isIP(address);if(family!==4&&family!==6)throw new Error('Client address is not a valid IPv4 or IPv6 address');
  await setup();
  const set=family===4?'allowed_v4':'allowed_v6',ttl=Math.max(1,Math.min(604800,Math.floor(Number(seconds)||1)));
  try{await runNft('add element inet wifi_vendo '+set+' { '+address+' timeout '+ttl+'s }\n')}catch(error){if(!/File exists|already exists/i.test(error.message))throw error;await runNft('replace element inet wifi_vendo '+set+' { '+address+' timeout '+ttl+'s }\n')}
  return {mode,authorized:true,expiresIn:ttl};
}
async function deauthorize(address){
  if(mode==='simulated')return {mode,authorized:false};
  const family=net.isIP(address);if(family!==4&&family!==6)return {mode,authorized:false};
  await setup();
  const set=family===4?'allowed_v4':'allowed_v6';
  try{await runNft('delete element inet wifi_vendo '+set+' { '+address+' }\n')}catch(error){if(!/No such file|does not exist|not found/i.test(error.message))throw error}
  return {mode,authorized:false};
}
module.exports={mode,setup,authorize,deauthorize,interface:iface};
