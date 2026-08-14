import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuthStore } from '../../core/auth/authStore';

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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.eyebrow}>Warehouse HQ</Text>
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
    </KeyboardAvoidingView>
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
  eyebrow: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
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
