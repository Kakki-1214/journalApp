import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { View, ActivityIndicator } from 'react-native';

import { useColorScheme } from '@/hooks/useColorScheme';
import { JournalProvider } from '@/context/JournalContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { SubscriptionProvider } from '@/context/SubscriptionContext';

function AppNavigator(){
  const { user, initializing } = useAuth();
  if(initializing){
    return <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}><ActivityIndicator /></View>;
  }
  return (
    <Stack screenOptions={{ headerShown:false }}>
      {user ? (
        <>
          <Stack.Screen name="(dashboard)" />
          <Stack.Screen name="+not-found" />
        </>
      ) : (
        <Stack.Screen name="(auth)/login" />
      )}
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <SubscriptionProvider>
          <JournalProvider>
            <AppNavigator />
            <StatusBar style="auto" />
          </JournalProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
