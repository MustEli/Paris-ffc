import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAwareScreen } from '../../core/components/KeyboardAwareScreen';
import { useAuthStore } from '../../core/auth/authStore';
import { spacing } from '../../core/theme/spacing';
import { fontSize, fontWeight } from '../../core/theme/typography';

const elnoLogo = require('../../../assets/elno-logo.png');

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const status = useAuthStore((state) => state.status);
  const error = useAuthStore((state) => state.error);
  const login = useAuthStore((state) => state.login);

  const isLoading = status === 'loading';
  // This screen has no native header (it's the login/auth flow), so
  // nothing else accounts for the status bar or the bottom gesture bar /
  // home indicator — without this, content can render right up against
  // either edge on some devices.
  const insets = useSafeAreaInsets();

  function handleSubmit() {
    login(email.trim(), password).catch(() => {
      // Error is already captured in the store — nothing else to do here.
    });
  }

  return (
    <KeyboardAwareScreen
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <Image source={elnoLogo} style={styles.logo} resizeMode="contain" />
      <Text style={styles.poweredBy}>Powered by OVOKO France</Text>
      <Text style={styles.title}>Sign in</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          editable={!isLoading}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#9ca3af"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!isLoading}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={({ pressed }) => [
            styles.button,
            (pressed || isLoading) && styles.buttonPressed,
            (!email || !password) && styles.buttonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={isLoading || !email || !password}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </Pressable>
      </View>

      {/* Only shown in local dev (talking to a laptop-hosted backend) —
          never in a standalone build pointed at the live hosted backend,
          which is what any build handed to someone outside this project
          uses (EXPO_PUBLIC_API_BASE_URL is only ever set for those). No
          credentials should be visible on a client-facing build. */}
      {!process.env.EXPO_PUBLIC_API_BASE_URL && (
        <Text style={styles.devNotice}>
          Dev accounts: staff@warehousehq.dev / admin@warehousehq.dev /{'\n'}
          management@warehousehq.dev — password: password123
        </Text>
      )}
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Deliberately NOT the Staff-only dark `colors` palette — this
    // screen is shared by all 3 roles (Staff/Admin/Management), and
    // Admin/Management stay on a light theme app-wide (see colors.ts's
    // own doc comment). A separate, intentional light palette, not an
    // oversight — left as literal values rather than forced onto the
    // dark token set.
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
  },
  logo: {
    // Fixed dp dimensions rather than width:'%' + aspectRatio — the
    // percentage-based version rendered at the image's native pixel
    // size instead of being constrained (a real RN layout quirk, not
    // just a "make it smaller" tweak). elno-logo.png is cropped tight to
    // the letters themselves (no more baked-in transparent padding), so
    // 240x65 matches its real ~3.68:1 ratio.
    width: 240,
    height: 65,
    marginBottom: spacing[1],
  },
  poweredBy: {
    fontSize: fontSize.sm,
    color: '#6b7280',
    // Deliberately left as a literal 14, not snapped to the spacing
    // scale's 12/16 neighbors — this exact value was tuned to "half of
    // the original 28" per specific client feedback (see git history),
    // and nudging it either way would quietly undo that tuning.
    marginBottom: 14,
  },
  title: {
    fontSize: fontSize.display,
    fontWeight: fontWeight.strong,
    marginBottom: spacing[8],
  },
  form: {
    width: '100%',
    gap: spacing[3],
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    // 16 in the original — nudged to the scale's nearest step rather
    // than keeping a near-duplicate size one step off from the rest of
    // the app's "larger body text" (imperceptible, same consolidation
    // applied to buttonText below).
    fontSize: fontSize.lg,
  },
  error: {
    color: '#dc2626',
    fontSize: fontSize.sm,
  },
  button: {
    backgroundColor: '#0f172a',
    paddingVertical: spacing[4],
    borderRadius: 10,
    alignItems: 'center',
    marginTop: spacing[2],
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: fontSize.lg,
    fontWeight: fontWeight.strong,
  },
  devNotice: {
    marginTop: spacing[10],
    fontSize: fontSize.xs,
    color: '#9ca3af',
    textAlign: 'center',
  },
});
