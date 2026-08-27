import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { KeyboardAwareScreen } from '../../core/components/KeyboardAwareScreen';
import { useAuthStore } from '../../core/auth/authStore';

const elnoLogo = require('../../../assets/elno-logo.png');

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const status = useAuthStore((state) => state.status);
  const error = useAuthStore((state) => state.error);
  const login = useAuthStore((state) => state.login);

  const isLoading = status === 'loading';

  function handleSubmit() {
    login(email.trim(), password).catch(() => {
      // Error is already captured in the store — nothing else to do here.
    });
  }

  return (
    <KeyboardAwareScreen contentContainerStyle={styles.container}>
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

      <Text style={styles.devNotice}>
        Dev accounts: staff@warehousehq.dev / admin@warehousehq.dev /{'\n'}
        management@warehousehq.dev — password: password123
      </Text>
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
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
    marginBottom: 4,
  },
  poweredBy: {
    fontSize: 13,
    color: '#6b7280',
    // Half of the original 28 — brings "Sign in" and everything below it
    // up closer to the subtitle, per feedback.
    marginBottom: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 32,
  },
  form: {
    width: '100%',
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: {
    color: '#dc2626',
    fontSize: 13,
  },
  button: {
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  devNotice: {
    marginTop: 40,
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
});
