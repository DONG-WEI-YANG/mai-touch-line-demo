import { Link } from 'expo-router';
import { Text, ScrollView, Pressable } from 'react-native';

const COLORS = { bg: '#1a1a1a', card: '#252525', accent: '#C9A96E', text: '#fff', muted: '#888' };

const SECTIONS = [
  { href: '/admin/announcements', title: '公告 Announcements',  desc: 'Compose / pin / delete building-wide notices' },
  { href: '/admin/packages',      title: '包裹 Packages',         desc: 'Front-desk register + mint PIN + mark picked up' },
  { href: '/admin/parking',       title: '停車 Parking',          desc: 'Spot grid + assign / release / visitor handling' },
  { href: '/admin/billing',       title: '帳單 Billing',          desc: 'Issue monthly invoices + mark paid (no payment gateway)' },
  { href: '/admin/bookings',    title: '預約管理 Bookings',     desc: 'List + status mutation across all residents' },
  { href: '/admin/work-orders', title: '工單管理 Work Orders',  desc: 'Filter, assign, change status; default view = open' },
  { href: '/admin/amenities',   title: '設施管理 Amenities',    desc: 'Create / edit / deactivate facilities' },
  { href: '/admin/residents',   title: '住戶 Residents',        desc: 'Search users; role / unit / last sign-in' },
  { href: '/admin/amenity-iot', title: 'Amenity IoT',           desc: 'Smart-amenity device monitoring and control' },
  { href: '/admin/line',        title: 'LINE Demo Admin',       desc: 'Logs, runtime config, demo scripts, users, health, manual push' },
];

export default function AdminIndex() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg, padding: 16 }}>
      <Text style={{ color: COLORS.accent, fontSize: 22, fontWeight: 'bold', marginBottom: 16 }}>
        Admin Console
      </Text>
      {SECTIONS.map(s => (
        <Link key={s.href} href={s.href as any} asChild>
          <Pressable style={({ pressed }) => ({
            padding: 16, marginBottom: 12, backgroundColor: COLORS.card, borderRadius: 6,
            opacity: pressed ? 0.7 : 1,
          })}>
            <Text style={{ color: COLORS.accent, fontSize: 16, fontWeight: 'bold' }}>{s.title}</Text>
            <Text style={{ color: COLORS.muted, fontSize: 13, marginTop: 4 }}>{s.desc}</Text>
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}
