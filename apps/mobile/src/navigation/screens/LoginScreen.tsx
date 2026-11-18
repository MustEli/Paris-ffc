import { useState } from 'react';
import { ActivityIndicator, Image, ImageBackground, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAwareScreen } from '../../core/components/KeyboardAwareScreen';
import { useAuthStore } from '../../core/auth/authStore';
import { colors } from '../../core/theme/colors';
import { spacing } from '../../core/theme/spacing';
import { fontSize, fontWeight } from '../../core/theme/typography';

const elnoLogo = require('../../../assets/elno-logo.png');
const loginBackground = require('../../../assets/login-background.jpg');

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
    <ImageBackground source={loginBackground} style={styles.background} resizeMode="cover" blurRadius={1}>
      <View style={styles.scrim} />
      <KeyboardAwareScreen
        style={styles.screen}
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <View style={styles.card}>
          <View style={styles.cardAccent}>
            <View style={[styles.cardAccentSegment, { backgroundColor: colors.frBlue }]} />
            <View style={[styles.cardAccentSegment, { backgroundColor: colors.frWhite }]} />
            <View style={[styles.cardAccentSegment, { backgroundColor: colors.frRed }]} />
          </View>
          <View style={styles.cardBody}>
            <View style={styles.logoRow}>
              <Image source={elnoLogo} style={styles.logo} resizeMode="contain" />
              <View style={styles.logoTextCol}>
                <Text style={styles.wordmark}>
                  <Text style={styles.wordmarkElno}>ELNO</Text> <Text style={styles.wordmarkTeam}>TEAM</Text>
                </Text>
                <Text style={styles.logoTag}>for Ovoko Fulfillment</Text>
              </View>
            </View>
            <Text style={styles.title}>Sign in</Text>
            <Text style={styles.subtitle}>Access the ELNO TEAM application</Text>

            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#9aa7b8"
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
                placeholderTextColor="#9aa7b8"
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
                  <ActivityIndicator color="#1a1200" />
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
          </View>
        </View>
      </KeyboardAwareScreen>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  // A black & white photo with its own generated geometric line-art
  // overlay (see the web login page's matching styles.css comment) —
  // no baked-in UI of its own, so this only needs a light darkening
  // for contrast, not the heavy blur the original color crop needed.
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9, 10, 13, 0.3)',
  },
  screen: {
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.background,
    borderRadius: 16,
    overflow: 'hidden',
  },
  // The French micro-accent — login card top edge only, per UI-Docs.
  // 3 flat segments rather than a gradient (no expo-linear-gradient
  // dependency in this app). Height is 2.5x the original 3px per
  // client request.
  cardAccent: {
    height: 7.5,
    flexDirection: 'row',
  },
  cardAccentSegment: {
    flex: 1,
  },
  cardBody: {
    padding: spacing[6],
    paddingTop: spacing[5],
    paddingBottom: spacing[5],
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 10,
  },
  logoTextCol: {
    alignItems: 'flex-start',
    gap: 4,
  },
  wordmark: {
    fontSize: 29,
    fontWeight: fontWeight.strong,
  },
  wordmarkElno: {
    color: colors.textPrimary,
  },
  // Distinct condensed/geometric family matching the logo artwork's
  // actual "TEAM" lettering, not just a color change (see the web
  // login page's matching styles.css comment).
  wordmarkTeam: {
    color: colors.brandOrange,
    fontFamily: 'Oswald_700Bold',
    letterSpacing: 0.5,
  },
  logoTag: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 999,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    overflow: 'hidden',
  },
  title: {
    fontSize: fontSize.display,
    fontWeight: fontWeight.strong,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  form: {
    width: '100%',
    gap: spacing[3],
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    // 16 in the original — nudged to the scale's nearest step rather
    // than keeping a near-duplicate size one step off from the rest of
    // the app's "larger body text" (imperceptible, same consolidation
    // applied to buttonText below).
    fontSize: fontSize.lg,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  error: {
    color: colors.alert,
    fontSize: fontSize.sm,
  },
  button: {
    backgroundColor: colors.brandOrange,
    paddingVertical: spacing[4],
    borderRadius: 10,
    alignItems: 'center',
    marginTop: spacing[2],
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#1a1200',
    fontSize: fontSize.lg,
    fontWeight: fontWeight.strong,
  },
  devNotice: {
    marginTop: spacing[10],
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
