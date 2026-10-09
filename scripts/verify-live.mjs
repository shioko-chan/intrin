import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const origin=process.argv[2]||'https://intrin.org';
const manifest=JSON.parse(await readFile(path.join(root,'artifacts/pages-asset-manifest.json'),'utf8'));
const digest=buffer=>createHash('sha256').update(buffer).digest('hex');
const items=Object.keys(manifest),results=[];
const failures=[];
async function verify(file){
  const route=file==='/index.html'?'/':file.replace(/\/index\.html$/,'/');
  try{
    const response=await fetch(origin+route,{signal:AbortSignal.timeout(25000)});
    const received=Buffer.from(await response.arrayBuffer());
    const expected=await readFile(path.join(root,'release',file));
    const entry={route,status:response.status,bytes:received.length,matchesRelease:digest(received)===digest(expected),contentType:response.headers.get('content-type'),robots:response.headers.get('x-robots-tag')};
    results.push(entry);
    if(!response.ok||!entry.matchesRelease||!entry.robots?.includes('noindex'))failures.push(route);
  }catch(error){results.push({route,error:error.message});failures.push(route);}
}
for(let i=0;i<items.length;i+=4)await Promise.all(items.slice(i,i+4).map(verify));
const missing=await fetch(origin+'/missing-preview-page/',{signal:AbortSignal.timeout(25000)});
const missingBytes=Buffer.from(await missing.arrayBuffer());
const custom404=missing.status===404&&digest(missingBytes)===digest(await readFile(path.join(root,'release/404.html')));
if(!custom404)failures.push('custom 404');
const range=await fetch(origin+'/media/mujoco-whiteboard.mp4',{headers:{Range:'bytes=0-1023'},signal:AbortSignal.timeout(25000)});
const videoRange={status:range.status,bytes:(await range.arrayBuffer()).byteLength,contentRange:range.headers.get('content-range')};
if(videoRange.status!==206||videoRange.bytes!==1024)failures.push('video range request');
const report={origin,checkedAt:new Date().toISOString(),results,custom404,videoRange,failures};
await mkdir(path.join(root,'artifacts/production'),{recursive:true});
await writeFile(path.join(root,'artifacts/production/http-qa.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({origin,files:results.length,custom404,videoRange,failures},null,2));
if(failures.length)process.exitCode=1;
