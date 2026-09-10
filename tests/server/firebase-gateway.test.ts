import { afterEach, expect, it } from 'vitest';
import http from 'node:http';
import request from 'supertest';
const { createGateway } = require('../../infrastructure/firebase-gateway/server.cjs');
const servers: http.Server[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(s => new Promise<void>(r => s.close(() => r())))); });

it('preserves webhook bytes and signature through the private backend hop', async () => {
  const backend = http.createServer((req,res) => {
    let body=''; req.on('data',c=>body+=c); req.on('end',()=>{
      res.setHeader('content-type','application/json');
      res.end(JSON.stringify({body,signature:req.headers['x-line-signature'],path:req.url}));
    });
  });
  servers.push(backend);
  await new Promise<void>(r=>backend.listen(0,'127.0.0.1',r));
  const port=(backend.address() as any).port;
  const app=createGateway({backendOrigin:`http://127.0.0.1:${port}`,lineToken:'secret'});
  const raw='{ "events": [] }';
  const res=await request(app).post('/line/webhook').set('x-line-signature','signed-by-line').set('content-type','application/json').send(raw);
  expect(res.status).toBe(200);
  expect(res.body).toEqual({body:raw,signature:'signed-by-line',path:'/line/webhook'});
});

it('rejects unauthenticated outbound requests before contacting LINE', async () => {
  const app=createGateway({backendOrigin:'http://127.0.0.1:1',lineToken:'secret',lineFetch:()=>{throw new Error('must not call LINE');}});
  expect((await request(app).post('/_line/v2/bot/message/reply').send({})).status).toBe(401);
});

it('only relays allowlisted LINE endpoints even for an authenticated caller',async()=>{
  const app=createGateway({backendOrigin:'http://127.0.0.1:1',lineToken:'secret',lineFetch:()=>{throw new Error('must not call LINE');}});
  expect((await request(app).post('/_line/v2/bot/message/broadcast').set('authorization','Bearer secret').send({})).status).toBe(404);
});

it('preserves LINE error status and JSON so expired reply tokens can fall back',async()=>{
  const app=createGateway({backendOrigin:'http://127.0.0.1:1',lineToken:'secret',lineFetch:async(url:string,init:any)=>{
    expect(url).toBe('https://api.line.me/v2/bot/message/reply');
    expect(init.headers.Authorization).toBe('Bearer secret');
    expect(JSON.parse(init.body.toString())).toEqual({replyToken:'expired',messages:[]});
    return new Response('{"message":"Invalid reply token"}',{status:400,headers:{'content-type':'application/json'}});
  }});
  const res=await request(app).post('/_line/v2/bot/message/reply').set('authorization','Bearer secret').send({replyToken:'expired',messages:[]});
  expect(res.status).toBe(400); expect(res.body.message).toBe('Invalid reply token');
});

it('forwards LINE retry key and accepted-request acknowledgement for duplicate delivery',async()=>{
 const key='af2f390b-91cc-4ffb-a7a9-5bdca06fe632';
 const app=createGateway({backendOrigin:'http://127.0.0.1:1',lineToken:'secret',lineFetch:async(_url:string,init:any)=>{
  expect(init.headers['X-Line-Retry-Key']).toBe(key);
  return new Response('{}',{status:409,headers:{'x-line-accepted-request-id':'accepted-id'}});
 }});
 const res=await request(app).post('/_line/v2/bot/message/push').set('authorization','Bearer secret').set('X-Line-Retry-Key',key).send({to:'U1',messages:[]});
 expect(res.status).toBe(409);expect(res.headers['x-line-accepted-request-id']).toBe('accepted-id');
});
