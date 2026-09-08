export function serviceIcon(name: string, size = '48px') {
  const base = (process.env.LINE_ASSET_BASE_URL ?? process.env.WEB_BASE_URL ?? 'https://mai-touch-web.vercel.app').replace(/\/$/, '');
  return { type:'image', url:`${base}/line-icons/${name}.png`, size, aspectRatio:'1:1', aspectMode:'fit' };
}
