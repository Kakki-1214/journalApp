import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const items: { label: string; icon: keyof typeof Ionicons.glyphMap; href: string }[] = [
  { label: 'Home', icon: 'home-outline', href: '/(dashboard)/home' },
  { label: 'Entries', icon: 'book-outline', href: '/(dashboard)/entries' },
  { label: 'Calendar', icon: 'calendar-outline', href: '/(dashboard)/calendar' },
  { label: 'Tags', icon: 'pricetags-outline', href: '/(dashboard)/tags' },
  { label: 'Stats', icon: 'stats-chart-outline', href: '/(dashboard)/stats' },
  { label: 'Settings', icon: 'settings-outline', href: '/(dashboard)/settings' },
];

export const Sidebar: React.FC<{ collapsed?: boolean; onNavigate?: ()=>void }> = ({ collapsed, onNavigate }) => {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={[styles.container, collapsed && styles.collapsed]}>
      <View style={styles.menu}>
        {items.map(it => {
          const active = pathname.startsWith(it.href);
          return (
            <TouchableOpacity key={it.href} style={[styles.item, active && styles.itemActive]} onPress={() => { router.replace(it.href as any); onNavigate?.(); }}>
              <Ionicons name={it.icon} size={20} color={active ? '#0a7ea4' : '#4A5965'} />
              {!collapsed && <Text style={[styles.itemLabel, active && styles.itemLabelActive]}>{it.label}</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
      {!collapsed && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>Journal</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: 180, backgroundColor:'#FFFFFF', paddingTop: 24, paddingHorizontal:14, borderRightWidth:1, borderColor:'#E5E9EC' },
  collapsed: { width:64, paddingHorizontal:8 },
  menu: { gap: 6 },
  item: { flexDirection:'row', alignItems:'center', gap:10, paddingVertical:10, paddingHorizontal:10, borderRadius:10 },
  itemActive: { backgroundColor:'#E8F4F8' },
  itemLabel: { fontSize:14, color:'#4A5965', fontWeight:'500' },
  itemLabelActive: { color:'#0a7ea4', fontWeight:'600' },
  footer: { marginTop:'auto', paddingVertical:20 },
  footerText: { fontSize:12, opacity:0.5 }
});
