import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { trpc } from '@/lib/trpc';
import { useColors } from '@/hooks/use-colors';

export function BookingRelatedRecords({ id }: { id: number }) {
  const colors = useColors();
  const [open,setOpen] = useState(false);
  const q = trpc.bookings.relatedRecords.useQuery({ id }, { enabled:open });
  return <View style={{ marginTop:12 }}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded:open }} onPress={()=>setOpen(!open)} style={{ minHeight:44, justifyContent:'center' }}>
      <Text style={{ color:colors.primary }}>{open ? '收合訪客／車號紀錄' : '查看關聯訪客／車號'}</Text>
    </Pressable>
    {open && q.isLoading && <Text style={{ color:colors.muted }}>讀取中…</Text>}
    {open && q.error && <Pressable accessibilityRole="button" onPress={()=>q.refetch()}><Text style={{ color:colors.error }}>關聯紀錄讀取失敗，點此重試</Text></Pressable>}
    {open && q.data?.length===0 && <Text style={{ color:colors.muted }}>尚無關聯紀錄</Text>}
    {open && q.data?.map(r=><Text key={r.ref} style={{ color:colors.foreground, marginBottom:8 }}>{r.ref}｜{r.detail}</Text>)}
  </View>;
}
