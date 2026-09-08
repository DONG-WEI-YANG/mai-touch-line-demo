import { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { monthDays, shiftMonth, taipeiToday } from '@/lib/booking-calendar';

export function BookingCalendar({ dates, selected, onSelect }: {
  dates: string[]; selected: string | null; onSelect: (date: string | null) => void;
}) {
  const colors = useColors();
  const today = taipeiToday();
  const [month, setMonth] = useState(today.slice(0, 7));
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const date of dates) map.set(date, (map.get(date) ?? 0) + 1);
    return map;
  }, [dates]);
  const button = (label: string, action: () => void) => <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={action} style={{ minHeight:44, minWidth:44, justifyContent:'center', paddingHorizontal:12 }}><Text style={{ color:colors.primary }}>{label}</Text></Pressable>;
  return <View style={{ backgroundColor:colors.surface, borderColor:colors.border, borderWidth:1, borderRadius:12, padding:12, marginBottom:16 }}>
    <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
      {button('上個月',()=>setMonth(shiftMonth(month,-1)))}
      <Text accessibilityRole="header" style={{ color:colors.foreground, fontSize:18, fontWeight:'700' }}>{month.replace('-', ' 年 ')} 月</Text>
      {button('下個月',()=>setMonth(shiftMonth(month,1)))}
    </View>
    <View style={{ flexDirection:'row', flexWrap:'wrap' }}>
      {['日','一','二','三','四','五','六'].map(day=><Text key={day} style={{ width:'14.2857%', textAlign:'center', color:colors.muted, paddingVertical:10 }}>{day}</Text>)}
      {monthDays(month).map((date,i)=>date ? <Pressable key={date} accessibilityRole="button" accessibilityLabel={`${date}，${counts.get(date) ?? 0} 筆預約`} accessibilityState={{ selected:selected===date }} onPress={()=>onSelect(date)} style={{ width:'14.2857%', minHeight:58, alignItems:'center', justifyContent:'center', borderRadius:8, backgroundColor:selected===date ? colors.primary : colors.surface, borderWidth:date===today ? 1 : 0, borderColor:colors.primary }}>
        <Text style={{ color:selected===date ? colors.background : colors.foreground, fontWeight:'600' }}>{Number(date.slice(-2))}</Text>
        <Text style={{ color:selected===date ? colors.background : colors.muted, fontSize:10, marginTop:4 }}>{counts.get(date) ? `${counts.get(date)} 筆` : ' '}</Text>
      </Pressable> : <View key={`blank-${i}`} style={{ width:'14.2857%', minHeight:58 }} />)}
    </View>
    <View style={{ flexDirection:'row', flexWrap:'wrap', justifyContent:'space-between' }}>
      {button('今天',()=>{setMonth(today.slice(0,7));onSelect(today);})}
      {button('全部紀錄',()=>onSelect(null))}
    </View>
    <Text style={{ color:colors.muted, fontSize:12 }}>{selected ? `${selected} 的預約` : '顯示全部紀錄，點日期查看當天歷史'}（含取消／完成）</Text>
  </View>;
}
