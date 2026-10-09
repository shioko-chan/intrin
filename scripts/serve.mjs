import http from 'node:http';
import { stat, readFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../dist/',import.meta.url)));
const port = Number(process.env.PREVIEW_PORT || 4317);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.mp4':'video/mp4','.vtt':'text/vtt; charset=utf-8','.txt':'text/plain; charset=utf-8'};
const server = http.createServer(async (req,res)=>{
  res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'none'; img-src 'self'; style-src 'self'; media-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  res.setHeader('Cache-Control','no-store');
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    let file=path.resolve(root,`.${pathname}`);
    if (file !== root && !file.startsWith(root + path.sep)) {res.writeHead(403);return res.end();}
    let info=await stat(file);
    if(info.isDirectory()) {file=path.join(file,'index.html');info=await stat(file);}
    const type=types[path.extname(file)];
    if(!type || !info.isFile()) throw new Error('Not public');
    res.setHeader('Content-Type',type);
    res.setHeader('Accept-Ranges','bytes');
    let start=0,end=info.size-1;
    if(req.headers.range){
      const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if(!match || (!match[1]&&!match[2])) {res.writeHead(416,{'Content-Range':`bytes */${info.size}`});return res.end();}
      if(!match[1]) start=Math.max(0,info.size-Number(match[2]));
      else {start=Number(match[1]);if(match[2])end=Math.min(Number(match[2]),end);}
      if(start>end || start>=info.size) {res.writeHead(416,{'Content-Range':`bytes */${info.size}`});return res.end();}
      res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${info.size}`);
    }
    res.setHeader('Content-Length',end-start+1);
    if(req.method==='HEAD')return res.end();
    createReadStream(file,{start,end}).pipe(res);
  }catch{
    res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});
    if(req.method==='HEAD')return res.end();
    res.end(await readFile(path.join(root,'404.html')));
  }
});
server.listen(port,'127.0.0.1',()=>console.log(`Local preview: http://127.0.0.1:${port}/ (loopback only)`));
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
