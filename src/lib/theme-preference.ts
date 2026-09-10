export type ThemePreference = 'light' | 'dark';
type Storage = { getItem(key:string):Promise<string|null>; setItem(key:string,value:string):Promise<void> };
export function createThemePreference(storage: Storage) {
  let preference:ThemePreference|null=null;
  let revision=0;
  let hydration:Promise<void>|undefined;
  let writes=Promise.resolve();
  const listeners=new Set<()=>void>();
  const publish=(value:ThemePreference)=>{preference=value;for(const listener of listeners)listener();};
  return {
    getSnapshot:()=>preference,
    subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};},
    hydrate:()=>{
      if(!hydration){const started=revision;hydration=storage.getItem('mai-touch.theme').then(value=>{
        if(revision===started && (value==='light'||value==='dark'))publish(value);
      }).catch(()=>{});}
      return hydration;
    },
    set:(value:ThemePreference)=>{
      revision++;
      const pending=writes.catch(()=>{}).then(async()=>{await storage.setItem('mai-touch.theme',value);publish(value);});
      writes=pending;
      return pending;
    },
  };
}
