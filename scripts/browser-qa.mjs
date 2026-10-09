import {writeFile,mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const origin=process.env.QA_ORIGIN||'http://127.0.0.1:4317';
const artifactDir=path.join(root,'artifacts',process.env.QA_ARTIFACT_SUBDIR||'');
const endpoint=process.env.CDP_ENDPOINT||'http://127.0.0.1:9228';
const targets=await (await fetch(`${endpoint}/json/list`)).json();
const target=targets.find(t=>t.type==='page');
if(!target)throw new Error('No local browser page target');
const ws=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
let sequence=0;const pending=new Map(),events=[];
ws.onmessage=e=>{const msg=JSON.parse(e.data);if(msg.id){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(msg.error):p.resolve(msg.result);}else events.push(msg);};
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result.value;}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Log.enable');
const projects=JSON.parse(await readFile(path.join(root,'content/en/projects.json'),'utf8'));
const updates=JSON.parse(await readFile(path.join(root,'content/en/updates.json'),'utf8'));
const routes=[['home','/'],...projects.map(p=>[p.id,`/projects/${p.id}/`]),['updates','/updates/'],...updates.map(u=>[u.id,`/updates/${u.id}/`]),['404','/missing-preview-page/']];
const dir=path.join(artifactDir,'screenshots');await mkdir(dir,{recursive:true});
const report={origin,checkedAt:new Date().toISOString(),pages:[],videos:[],interactions:[]};
for(const [device,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
 await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:device==='mobile'});
 for(const [name,route] of routes){
  events.length=0;await send('Page.navigate',{url:origin+route});
  for(let i=0;i<80;i++){await pause(80);if(await evaluate('document.readyState==="complete"'))break;}
  await evaluate(`Promise.all([...document.images].map(img=>{img.loading='eager';return img.decode().catch(()=>{});})).then(()=>true)`);
  await pause(['llcl','sketchvla'].includes(name) ? 1200 : 180);
  const state=await evaluate(`(()=>({title:document.title,h1s:document.querySelectorAll('h1').length,width:document.documentElement.clientWidth,documentWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,images:[...document.images].map(x=>({src:new URL(x.src).pathname,loaded:x.complete&&x.naturalWidth>0})),overflow:[...document.querySelectorAll('body *')].filter(x=>{let r=x.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left < -1)&&!x.classList.contains('skip-link')&&!x.classList.contains('sr-only')}).map(x=>x.tagName+'.'+x.className),videos:[...document.querySelectorAll('video')].map(v=>({ready:v.readyState,duration:v.duration,error:v.error?.message||null,autoplay:v.autoplay,controls:v.controls,tracks:[...v.textTracks].map(t=>({kind:t.kind,language:t.language,cues:t.cues?.length}))}))}))()`);
  const errors=events.filter(e=>e.method==='Runtime.exceptionThrown'||(e.method==='Log.entryAdded'&&e.params.entry.level==='error'&&!(name==='404'&&e.params.entry.source==='network'&&e.params.entry.url===origin+route))).map(e=>e.params);
  const responses=events.filter(e=>e.method==='Network.responseReceived').map(e=>({url:e.params.response.url,status:e.params.response.status}));
  report.pages.push({name,device,route,expectedViewport:width,...state,errors,responses});
  const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height:state.height,scale:1}});
  await writeFile(path.join(dir,`${name}-${device}.png`),Buffer.from(screenshot.data,'base64'));
  if(name==='home'){const view=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(dir,`home-${device}-viewport.png`),Buffer.from(view.data,'base64'));}
  console.log(`${device} ${route}: ${state.width}/${state.documentWidth}px, ${state.images.length} images, ${errors.length} errors`);
 }
}
// Playback and seeking: both real recordings must decode and advance.
for(const p of projects.filter(p=>p.mediaKind==='video')){
 await send('Page.navigate',{url:origin+`/projects/${p.id}/`});await pause(600);
 const playback=await evaluate(`(async()=>{const v=document.querySelector('video');v.muted=true;await v.play();await new Promise(r=>setTimeout(r,700));let played=v.currentTime;v.pause();v.currentTime=v.duration/2;await new Promise(r=>setTimeout(r,250));return {played,seeked:v.currentTime,duration:v.duration,error:v.error?.message||null};})()`);
 report.videos.push({id:p.id,...playback});
}
// Exercise real navigation and keyboard focus.
await send('Page.navigate',{url:origin+'/'});await pause(300);
await evaluate(`document.querySelector('.card-copy h3 a').click()`);await pause(300);
report.interactions.push({name:'Project title opens LLCL',passed:(await evaluate('location.pathname'))==='/projects/llcl/'});
await evaluate(`document.querySelector('.contents a[href="#evidence"]').click()`);await pause(100);
report.interactions.push({name:'On-page evidence navigation',passed:(await evaluate('location.hash'))==='#evidence'});
await evaluate(`document.querySelector('.related-update h3 a').click()`);await pause(300);
report.interactions.push({name:'Project update opens matching note',passed:(await evaluate('location.pathname'))==='/updates/2026-10-07-llcl/'});
await send('Page.navigate',{url:origin+'/'});await pause(200);
await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
report.interactions.push({name:'Skip link first keyboard focus',passed:await evaluate('document.activeElement.classList.contains("skip-link")')});
// Narrow viewport plus enlarged text: no horizontal clipping.
await send('Emulation.setDeviceMetricsOverride',{width:320,height:900,deviceScaleFactor:1,mobile:true});
await evaluate('document.documentElement.style.fontSize="200%"');await pause(100);
const zoom=await evaluate('({width:document.documentElement.clientWidth,documentWidth:document.documentElement.scrollWidth,viewport:innerWidth})');
report.interactions.push({name:'320px viewport at 200% text size',passed:zoom.documentWidth<=320&&zoom.width<=320,...zoom});
const zoomShot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(dir,'home-320-text-200.png'),Buffer.from(zoomShot.data,'base64'));
report.failures=report.pages.flatMap(p=>[...(p.documentWidth>p.width||p.documentWidth>p.expectedViewport?[`${p.device} ${p.route}: horizontal overflow`]:[]),...p.images.filter(i=>!i.loaded).map(i=>`${p.route}: broken image ${i.src}`),...(p.errors.length?[`${p.route}: browser errors`]:[])])
 .concat(report.videos.filter(v=>v.error||v.played<=0||v.seeked<v.duration/2-.5).map(v=>`${v.id}: playback failed`),report.interactions.filter(i=>!i.passed).map(i=>i.name));
await writeFile(path.join(artifactDir,'browser-qa.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({pages:report.pages.length,videos:report.videos,interactions:report.interactions,failures:report.failures},null,2));
ws.close();if(report.failures.length)process.exitCode=1;
