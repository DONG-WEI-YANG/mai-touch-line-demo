import { Link } from 'expo-router';
import { Text, ScrollView, Pressable } from 'react-native';

const COLORS = { bg: '#1a1a1a', card: '#252525', accent: '#C9A96E', text: '#fff', muted: '#888' };

const PAGES = [
  { href: '/admin/line/logs',    title: 'Logs',          desc: 'Live LINE message log with filter (5s polling)' },
  { href: '/admin/line/config',  title: 'Runtime Config', desc: 'Edit rate limits, AI model, banner, admin whitelist (no redeploy)' },
  { href: '/admin/line/scripts', title: 'Demo Scripts',  desc: 'Enable/disable + edit /demo facility/repair/visitor/complaint' },
  { href: '/admin/line/users',   title: 'Users',         desc: 'List line_user, change role, purge demo users' },
  { href: '/admin/line/health',  title: 'Health',        desc: 'Today\'s message count, error rate, server uptime' },
  { href: '/admin/line/push',    title: 'Manual Push',   desc: 'Debug — send a text directly to a LINE userId' },
];

export default function LineAdminIndex() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg, padding: 16 }}>
      <Text style={{ color: COLORS.accent, fontSize: 22, fontWeight: 'bold', marginBottom: 4 }}>
        LINE Demo Admin
      </Text>
      <Text style={{ color: COLORS.muted, fontSize: 12, marginBottom: 16 }}>
        Operate the LINE bot demo without redeploying. All changes apply immediately.
      </Text>

      {PAGES.map(p => (
        <Link key={p.href} href={p.href as any} asChild>
          <Pressable style={({ pressed }) => ({
            padding: 14, marginBottom: 8, backgroundColor: COLORS.card, borderRadius: 6,
            opacity: pressed ? 0.7 : 1,
          })}>
            <Text style={{ color: COLORS.accent, fontSize: 15, fontWeight: 'bold' }}>{p.title}</Text>
            <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 2 }}>{p.desc}</Text>
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}
