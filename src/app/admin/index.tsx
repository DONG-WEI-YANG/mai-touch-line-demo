import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/use-colors';
import { ScreenContainer } from '@/components/screen-container';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AdminHeader } from '@/components/admin/admin-ui';

const MENU_ITEMS = [
  { 
    title: '公告管理', 
    subtitle: '發布社區公告與置頂重要資訊',
    icon: 'megaphone.fill', 
    route: '/admin/announcements',
    color: '#fbbf24' 
  },
  { 
    title: '設施管理', 
    subtitle: '編輯公設名稱、容量與開放時段',
    icon: 'building.2.fill', 
    route: '/admin/amenities',
    color: '#60a5fa' 
  },
  { 
    title: '預約管理', 
    subtitle: '審核與更新住戶公設預約狀態',
    icon: 'calendar.badge.clock', 
    route: '/admin/bookings',
    color: '#34d399' 
  },
  {
    title: '櫃台語音代辦',
    subtitle: '物業代住戶口說預約公設與報修派單',
    icon: 'mic.fill',
    route: '/admin/voice-desk',
    color: '#c084fc'
  },
  {
    title: '包裹管理',
    subtitle: '登記到府包裹與追蹤領取狀態',
    icon: 'shippingbox.fill',
    route: '/admin/packages',
    color: '#f87171'
  },
  { 
    title: '工單管理', 
    subtitle: '分配維修任務與追蹤修繕進度',
    icon: 'wrench.and.screwdriver.fill', 
    route: '/admin/work-orders',
    color: '#a78bfa' 
  },
  { 
    title: '帳單管理', 
    subtitle: '開立管理費發票與手動記帳',
    icon: 'creditcard.fill', 
    route: '/admin/billing',
    color: '#f472b6' 
  },
  { 
    title: '停車管理', 
    subtitle: '管理車位分配與訪客臨時登記',
    icon: 'car.fill', 
    route: '/admin/parking',
    color: '#2dd4bf' 
  },
  { 
    title: '住戶管理', 
    subtitle: '編輯住戶資料與房號對應',
    icon: 'person.2.fill', 
    route: '/admin/residents',
    color: '#fb923c' 
  },
  { 
    title: 'IoT 控制', 
    subtitle: '硬體閘道監控與批次裝置控制',
    icon: 'bolt.fill', 
    route: '/admin/amenity-iot',
    color: '#e879f9' 
  },
  { 
    title: '系統配置', 
    subtitle: 'Runtime Config 與 LINE 介接參數',
    icon: 'gearshape.fill', 
    route: '/admin/line/config',
    color: '#94a3b8' 
  },
];

export default function AdminIndex() {
  const router = useRouter();
  const colors = useColors();

  return (
    <ScreenContainer edges={['top']}>
      <AdminHeader 
        title="管理後台" 
        subtitle="Luxury Smart Building Admin Console"
      />

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.grid}>
          {MENU_ITEMS.map((item) => (
            <Pressable
              key={item.route}
              onPress={() => router.push(item.route as any)}
              style={({ pressed }) => [
                styles.menuItem,
                { 
                  backgroundColor: colors.surface, 
                  borderColor: colors.border,
                  opacity: pressed ? 0.8 : 1 
                }
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: item.color + '15' }]}>
                <IconSymbol name={item.icon} size={24} color={item.color} />
              </View>
              <View style={styles.textWrap}>
                <Text style={[styles.menuTitle, { color: colors.foreground }]}>{item.title}</Text>
                <Text style={[styles.menuSubtitle, { color: colors.muted }]} numberOfLines={2}>
                  {item.subtitle}
                </Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color={colors.muted} />
            </Pressable>
          ))}
        </View>
        
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.muted }]}>
            Build v1.4.0 • Environment: Production
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  grid: {
    gap: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 16,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textWrap: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  menuSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  footer: {
    marginTop: 32,
    paddingBottom: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
