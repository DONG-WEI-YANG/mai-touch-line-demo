// Run with the VM service's EnvironmentFile. Never sends LINE user messages.
async function main(){
  const relay=process.env.LINE_API_PROXY_URL;
  const headers={Authorization:`Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,'Content-Type':'application/json'};
  const info=await fetch(`${relay}/_line/v2/bot/info`,{headers,signal:AbortSignal.timeout(25000)});
  console.log('LINE bot identity HTTP',info.status);
  if(!info.ok) throw new Error('LINE identity probe failed');
  console.log('LINE basic ID:',(await info.json()).basicId);
  const validate=await fetch(`${relay}/_line/v2/bot/message/validate/reply`,{
    method:'POST',headers,body:JSON.stringify({messages:[{type:'text',text:'公設預約服務測試'}]}),
    signal:AbortSignal.timeout(25000),
  });
  console.log('LINE payload validation HTTP',validate.status);
  if(!validate.ok) throw new Error('LINE validation probe failed');
  const base=process.env.OPENAI_BASE_URL.replace(/\/$/,'');
  const ai=await fetch(`${base}/chat/completions`,{
    method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY.split(',')[0].trim()}`,'Content-Type':'application/json'},
    body:JSON.stringify({model:process.env.OPENAI_MODEL,messages:[{role:'user',content:'Reply with OK.'}],max_tokens:16}),
    signal:AbortSignal.timeout(25000),
  });
  console.log('Gemini HTTP',ai.status);
  if(!ai.ok) throw new Error('Gemini probe failed');
  const result=await ai.json();
  if(!result.choices?.[0]?.message?.content) throw new Error('Gemini returned no response text');
  console.log('Gemini response received; content not logged');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
