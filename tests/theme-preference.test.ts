import { describe,it,expect,vi } from 'vitest';
import { createThemePreference } from '../src/lib/theme-preference';
describe('shared persistent theme',()=>{
 it('publishes to all mounted consumers and survives reload',async()=>{
  let stored:string|null=null;const storage={getItem:async()=>stored,setItem:async(_key:string,value:string)=>{stored=value;}};
  const theme=createThemePreference(storage),a=vi.fn(),b=vi.fn();theme.subscribe(a);theme.subscribe(b);
  await theme.set('dark');expect(theme.getSnapshot()).toBe('dark');expect(a).toHaveBeenCalled();expect(b).toHaveBeenCalled();
  const reloaded=createThemePreference(storage);await reloaded.hydrate();expect(reloaded.getSnapshot()).toBe('dark');
 });
 it('does not claim saved preference when persistence fails',async()=>{
  const theme=createThemePreference({getItem:async()=>null,setItem:async()=>{throw Error('full');}});
  await expect(theme.set('dark')).rejects.toThrow('full');expect(theme.getSnapshot()).toBeNull();
 });
 it('does not overwrite a user change with late initial loading',async()=>{
  let finish!:(v:string)=>void;const theme=createThemePreference({getItem:()=>new Promise<string>(resolve=>{finish=resolve;}),setItem:async()=>{}});
  const loading=theme.hydrate();await theme.set('dark');finish('light');await loading;expect(theme.getSnapshot()).toBe('dark');
 });
});
