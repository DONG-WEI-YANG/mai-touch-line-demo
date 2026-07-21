import { Link } from 'expo-router';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { ScreenContainer } from '@/components/screen-container';
import { AdminHeader } from '@/components/admin/admin-ui';
import { IconSymbol } from '@/components/ui/icon-symbol';

const PAGES = [
  { href: '/admin/line/logs',    title: 'Live Logs',      desc: 'Real-time LINE message stream with keyword filtering', icon: 'list.bullet.rectangle' },
  { href: '/admin/line/config',  title: 'Runtime Config', desc: 'AI models, rate limits, banner text, and admin whitelist', icon: 'slider.horizontal.3' },
  { href: '/admin/line/scripts', title: 'Demo Scripts',  desc: 'Manage automated facility, repair, and visitor flows', icon: 'scroll.fill' },
  { href: '/admin/line/users',   title: 'LINE Users',     desc: 'User mapping, role management, and demo purging', icon: 'person.badge.shield.checkmark.fill' },
  { href: '/admin/line/health',  title: 'System Health',  desc: 'Daily message counts, error rates, and uptime monitoring', icon: 'waveform.path.ecg' },
  { href: '/admin/line/push',    title: 'Manual Push',   desc: 'Developer debug tool — send raw text to any LINE ID', icon: 'paperplane.fill' },
];

export default function LineAdminIndex() {
  const colors = useColors();

  return (
    <ScreenContainer edges={['top']}>
      <AdminHeader 
        title="LINE Bot Admin" 
        subtitle="Manage the automated LINE integration gateway"
      />

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.grid}>
          {PAGES.map(p => (
            <Link key={p.href} href={p.href as "/admin/line/logs" | "/admin/line/config" | "/admin/line/scripts" | "/admin/line/users" | "/admin/line/health" | "/admin/line/push"} asChild>
              <Pressable style={({ pressed }) => [
                styles.menuItem,
                { 
                  backgroundColor: colors.surface, 
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1 
                }
              ]}>
                <View style={[styles.iconWrap, { backgroundColor: colors.primary + '15' }]}>
                  <IconSymbol name={p.icon} size={22} color={colors.primary} />
                </View>
                <View style={styles.textWrap}>
                  <Text style={[styles.menuTitle, { color: colors.foreground }]}>{p.title}</Text>
                  <Text style={[styles.menuDesc, { color: colors.muted }]}>{p.desc}</Text>
                </View>
                <IconSymbol name="chevron.right" size={16} color={colors.muted} />
              </Pressable>
            </Link>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.muted }]}>
            All changes apply instantly to the bot without redeploy
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
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 14,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textWrap: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  menuDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  footer: {
    marginTop: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    fontWeight: '600',
    fontStyle: 'italic',
  },
});
