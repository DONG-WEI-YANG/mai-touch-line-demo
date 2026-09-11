const http = require('node:http');
const crypto = require('node:crypto');

const allowedLine = new Set([
  'GET /v2/bot/info',
  'POST /v2/bot/message/reply',
  'POST /v2/bot/message/push',
  'POST /v2/bot/message/validate/reply',
]);
const hopHeaders = new Set(['host','connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailer','transfer-encoding','upgrade']);
function headersWithoutHop(headers) {
  const blocked = new Set([...hopHeaders,...String(headers.connection || '').split(',').map(s=>s.trim().toLowerCase())]);
  return Object.fromEntries(Object.entries(headers).filter(([name])=>!blocked.has(name.toLowerCase())));
}
function authorized(actual, token) {
  return crypto.timingSafeEqual(crypto.createHash('sha256').update(String(actual || '')).digest(),
    crypto.createHash('sha256').update(`Bearer ${token}`).digest());
}
function readBody(req) {
  return new Promise((resolve,reject)=>{
    let size=0; const chunks=[];
    req.on('data',chunk=>{
      size+=chunk.length;
      if(size>1024*1024) { reject(Object.assign(new Error('Too large'),{status:413})); return; }
      chunks.push(chunk);
    });
    req.on('end',()=>resolve(Buffer.concat(chunks)));
    req.on('error',reject);
  });
}
// Cloud Run's startup probe targets /_gateway/ready so a new instance takes traffic only once its
// Direct VPC path reaches the backend; a cold path silently drops packets for minutes after start.
// Any HTTP answer proves the path; backend app health is reported by the backend's own /health.
function backendReachable(backend,timeoutMs) {
  return new Promise(resolve=>{
    const probe=http.get({hostname:backend.hostname,port:backend.port || 80,path:'/health',timeout:timeoutMs},response=>{
      response.resume();
      resolve(true);
    });
    probe.on('timeout',()=>probe.destroy(new Error('Backend probe timeout')));
    probe.on('error',()=>resolve(false));
  });
}
function createGateway({backendOrigin,lineToken,lineFetch=fetch,readyTimeoutMs=3000}) {
  if(!backendOrigin || !lineToken) throw new Error('Backend and LINE token are required');
  const backend=new URL(backendOrigin);
  if(backend.protocol!=='http:') throw new Error('Backend must be an internal HTTP origin');
  return async(req,res)=>{
    const target=req.url || '/';
    res.setHeader('cache-control','no-store');
    if(!target.startsWith('/') || target.startsWith('//')) { res.writeHead(400).end(); return; }
    if(target==='/_gateway/ready') {
      res.writeHead(await backendReachable(backend,readyTimeoutMs)?200:503).end();
      return;
    }
    if(target.startsWith('/_line')) {
      if(!authorized(req.headers.authorization,lineToken)) { res.writeHead(401).end(); return; }
      const path=target.slice('/_line'.length);
      if(!allowedLine.has(`${req.method} ${path}`)) { res.writeHead(404).end(); return; }
      try {
        const body=await readBody(req);
        const retryKey=req.headers['x-line-retry-key'];
        if(retryKey && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(retryKey))) { res.writeHead(400).end(); return; }
        const response=await lineFetch(`https://api.line.me${path}`,{
          method:req.method,
          headers:{Authorization:`Bearer ${lineToken}`,'Content-Type':'application/json',...(retryKey?{'X-Line-Retry-Key':retryKey}:{})},
          ...(req.method==='GET'?{}:{body}),
          redirect:'error',signal:AbortSignal.timeout(15000),
        });
        res.setHeader('content-type',response.headers.get('content-type') || 'application/json');
        if(response.headers.get('x-line-accepted-request-id')) res.setHeader('x-line-accepted-request-id',response.headers.get('x-line-accepted-request-id'));
        res.writeHead(response.status).end(Buffer.from(await response.arrayBuffer()));
      } catch(error) {
        if(!res.headersSent) res.writeHead(error.status || 502);
        res.end('LINE relay unavailable');
      }
      return;
    }
    const upstream=http.request({
      hostname:backend.hostname,port:backend.port || 80,path:target,method:req.method,
      headers:headersWithoutHop(req.headers),timeout:45000,
    },response=>{
      res.writeHead(response.statusCode || 502,{...headersWithoutHop(response.headers),'cache-control':'no-store'});
      response.pipe(res);
    });
    upstream.on('timeout',()=>upstream.destroy(new Error('Backend timeout')));
    upstream.on('error',()=>{if(!res.headersSent) res.writeHead(502);res.end('Backend unavailable');});
    res.on('close',()=>upstream.destroy());
    req.pipe(upstream);
  };
}
module.exports={createGateway};
if(require.main===module) {
  http.createServer(createGateway({backendOrigin:process.env.BACKEND_ORIGIN,lineToken:process.env.LINE_CHANNEL_ACCESS_TOKEN}))
    .listen(Number(process.env.PORT || 8080),'0.0.0.0');
}
