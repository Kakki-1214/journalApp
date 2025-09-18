import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: { position: 'absolute' },
          default: {},
        }),
      }}>
      <Tabs.Screen name="journal" options={{ title:'Entries', tabBarIcon: ({color})=> <IconSymbol size={26} name="book.closed.fill" color={color} /> }} />
      <Tabs.Screen name="calendar" options={{ title:'Calendar', tabBarIcon: ({color})=> <IconSymbol size={26} name="calendar" color={color} /> }} />
      <Tabs.Screen name="tags" options={{ title:'Tags', tabBarIcon: ({color})=> <IconSymbol size={26} name="tag" color={color} /> }} />
      <Tabs.Screen name="stats" options={{ title:'Stats', tabBarIcon: ({color})=> <IconSymbol size={26} name="chart.bar.fill" color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title:'Settings', tabBarIcon: ({color})=> <IconSymbol size={26} name="gear" color={color} /> }} />
    </Tabs>
  );
}
