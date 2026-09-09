const fs=require('node:fs/promises');
const crypto=require('node:crypto');

// Uses LINE_CHANNEL_ACCESS_TOKEN from the process environment. Does not send messages.
async function main(){
  if (!process.argv.includes('--apply')) throw new Error('Use --apply to publish the default LINE rich menu.');
  const token=process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is required');
  const menu=JSON.parse(await fs.readFile('public/line-menu/community.json','utf8'));
  const png=await fs.readFile('public/line-menu/community.png');
  if(png.length>1024*1024) throw new Error('Rich menu image exceeds 1 MiB');
  menu.name='MAI Touch '+crypto.createHash('sha256').update(JSON.stringify(menu)).update(png).digest('hex').slice(0,12);
  async function call(path,{method='GET',body,upload=false,optional=false}={}){
    const response=await fetch(`https://${upload?'api-data':'api'}.line.me${path}`,{
      method,headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':upload?'image/png':'application/json'}:{})},
      ...(body?{body:upload?body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000),redirect:'error',
    });
    if(optional && response.status===404) return null;
    if(!response.ok) throw new Error(`LINE ${method} ${path}: HTTP ${response.status}`);
    const text=await response.text(); return text?JSON.parse(text):{};
  }
  await call('/v2/bot/richmenu/validate',{method:'POST',body:menu});
  const before=await call('/v2/bot/user/all/richmenu',{optional:true});
  const {richmenus}=await call('/v2/bot/richmenu/list');
  let richMenuId=richmenus.find(item=>item.name===menu.name)?.richMenuId;
  if(!richMenuId){
    ({richMenuId}=await call('/v2/bot/richmenu',{method:'POST',body:menu}));
  }
  const content=await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(30000)});
  if(content.status===404) await call(`/v2/bot/richmenu/${richMenuId}/content`,{method:'POST',body:png,upload:true});
  else if(!content.ok) throw new Error(`Cannot verify rich menu image: HTTP ${content.status}`);
  await content.arrayBuffer();
  // Record rollback target before changing the default. Existing menus are preserved.
  await fs.mkdir('_local',{recursive:true});
  const record={before,richMenuId,name:menu.name,at:new Date().toISOString()};
  await fs.writeFile(`_local/line-rich-menu-${Date.now()}.json`,JSON.stringify(record,null,2));
  await call(`/v2/bot/user/all/richmenu/${richMenuId}`,{method:'POST'});
  const current=await call('/v2/bot/user/all/richmenu');
  if(current.richMenuId!==richMenuId) throw new Error('Default rich menu did not match');
  console.log(JSON.stringify({richMenuId,defaultVerified:true,areas:menu.areas.length}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
