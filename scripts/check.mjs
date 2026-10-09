import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const production = process.argv.includes('--production');
const root = fileURLToPath(new URL(production ? '../release/' : '../dist/',import.meta.url));
async function walk(dir){return (await Promise.all((await readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?walk(path.join(dir,e.name)):path.join(dir,e.name)))).flat();}
const files=await walk(root), pages=files.filter(f=>f.endsWith('.html')), errors=[];
let checked=0;const externals=new Set();
for(const file of pages){
 const html=await readFile(file,'utf8');
 const url='/'+path.relative(root,file).replace(/index\.html$/,'');
 if((html.match(/<h1(?:\s|>)/g)||[]).length!==1)errors.push(`${url}: expected one h1`);
 if(!html.includes('noindex,nofollow,noarchive'))errors.push(`${url}: missing preview noindex`);
 if(/(?:\/home\/|\/media\/Documents\/|file:\/\/|localhost:9228|github\.com\/(?!shioko-chan\/DOM))/.test(html))errors.push(`${url}: prohibited path or repository URL`);
 if(/<script/.test(html))errors.push(`${url}: unexpected script`);
 if(!production && /https:\/\/intrin\.org|rel="canonical"/.test(html))errors.push(`${url}: unexpected public origin claim`);
 if(production && /Local preview|Not published|proposed site| — Preview/.test(html))errors.push(`${url}: local-only label in release`);
 for(const img of html.matchAll(/<img\b[^>]*>/g))if(!/\balt="/.test(img[0]))errors.push(`${url}: image without alt`);
 for(const video of html.matchAll(/<video\b[^>]*>/g))if(/\bautoplay\b/.test(video[0])||!/\bcontrols\b/.test(video[0]))errors.push(`${url}: video must use controls and no autoplay`);
 for(const attr of html.matchAll(/\b(?:href|src|poster)="([^"]+)"/g)){
  const value=attr[1];
  if(/^https:\/\//.test(value)){if(production && value.startsWith('https://intrin.org/'))continue;externals.add(value);continue;}
  const resolved=new URL(value,'http://preview.test'+url);
  if(resolved.origin!=='http://preview.test'){errors.push(`${url}: unexpected URL ${value}`);continue;}
  let target=path.join(root,decodeURIComponent(resolved.pathname));
  try{
    if((await stat(target)).isDirectory())target=path.join(target,'index.html');
    await stat(target);checked++;
    if(resolved.hash){const doc=await readFile(target,'utf8');if(!doc.includes(`id="${resolved.hash.slice(1)}"`))errors.push(`${url}: missing anchor ${value}`);}
  }catch{errors.push(`${url}: missing ${value}`);}
 }
}
const updates=JSON.parse(await readFile(new URL('../content/en/updates.json',import.meta.url),'utf8'));
if(updates.some(u=>!u.draft))errors.push('Every preview update must be marked draft');
const allowed=new Set(['https://intrin.cc/','https://github.com/shioko-chan/DOM']);
for(const url of externals)if(!allowed.has(url))errors.push(`Unexpected external URL ${url}`);
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log(`PASS: ${pages.length} pages; ${checked} local links/media/anchors; draft/noindex, media accessibility and public URL allowlist.\nExternal links: ${[...externals].join(', ')}`);
