import { useEffect, useSyncExternalStore } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createThemePreference } from '@/lib/theme-preference';
const preference=createThemePreference(AsyncStorage);
const serverSnapshot=()=>null;
/** Every palette consumer observes the same persisted override. */
export function useThemePreference(){
  const system=useColorScheme();
  const override=useSyncExternalStore(preference.subscribe,preference.getSnapshot,serverSnapshot);
  useEffect(()=>{void preference.hydrate();},[]);
  return {scheme:override??(system==='dark'?'dark':'light'),setTheme:preference.set};
}
