import { JetBrainsMono_500Medium, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import { Oswald_700Bold } from '@expo-google-fonts/oswald';
import { PlusJakartaSans_500Medium, PlusJakartaSans_700Bold, useFonts } from '@expo-google-fonts/plus-jakarta-sans';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Text, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { initNotifications } from './src/core/notifications/setup';
import { RootNavigator } from './src/navigation/RootNavigator';

const queryClient = new QueryClient();

/**
 * UI-Docs' "Primary UI Font: Plus Jakarta Sans" mandate, applied once
 * app-wide rather than touching every screen's StyleSheet — RN has no
 * CSS-style font inheritance, so a global `defaultProps.style` override
 * on `Text`/`TextInput` is the standard way to get every existing (and
 * future) usage onto the new family for free. Only overridden when a
 * style explicitly sets its own `fontFamily` (e.g. the monospace code
 * font for bin/barcode/tracking-ID text).
 */
function applyGlobalFont() {
  const sansRegular = { fontFamily: 'PlusJakartaSans_500Medium' };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Text as any).defaultProps = (Text as any).defaultProps || {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Text as any).defaultProps.style = [sansRegular, (Text as any).defaultProps.style];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (TextInput as any).defaultProps = (TextInput as any).defaultProps || {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (TextInput as any).defaultProps.style = [sansRegular, (TextInput as any).defaultProps.style];
}

export default function App() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_700Bold,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
    Oswald_700Bold,
  });

  useEffect(() => {
    initNotifications();
  }, []);

  useEffect(() => {
    if (fontsLoaded) applyGlobalFont();
  }, [fontsLoaded]);

  // No custom splash/loading UI here — Expo's own splash screen (icon
  // on a solid background, see app.config.js) stays on-screen for this
  // brief window regardless, so an extra spinner would just be a flash
  // between two loading states.
  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <RootNavigator />
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
