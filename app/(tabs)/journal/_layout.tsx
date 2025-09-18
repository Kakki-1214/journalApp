import React from 'react';
import { Stack } from 'expo-router';

export default function JournalTabStackLayout(){
  return (
    <Stack screenOptions={{ headerShown:true }}>
      <Stack.Screen name="index" options={{ title:'Entries' }} />
      <Stack.Screen name="new" options={{ title:'New Entry' }} />
      <Stack.Screen name="[id]" options={{ title:'Detail' }} />
    </Stack>
  );
}
