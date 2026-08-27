import { type ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

interface KeyboardAwareScreenProps {
  children: ReactNode;
  /** Same role as ScrollView's contentContainerStyle — this is a drop-in
   * replacement for a screen's top-level ScrollView (or plain View). */
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}

/**
 * Shared, app-wide screen wrapper for every screen with text inputs.
 *
 * Before this existed, opening the keyboard on any screen made the layout
 * static — content the keyboard covered became permanently unreachable
 * until the keyboard was dismissed some other way, and there was no way to
 * dismiss it except focusing a different input. This fixes both, in one
 * place, for every screen instead of per-screen:
 *  - KeyboardAvoidingView so iOS shifts content clear of the keyboard
 *    (Android resizes the window natively, so no behavior is needed there).
 *  - A ScrollView so covered content can be dragged into view.
 *  - A tap-catcher that dismisses the keyboard on a tap outside any input.
 *    `keyboardShouldPersistTaps="handled"` keeps taps on inputs/buttons
 *    working normally — only taps that land on non-interactive areas
 *    bubble up and dismiss the keyboard.
 */
export function KeyboardAwareScreen({ children, contentContainerStyle, style }: KeyboardAwareScreenProps) {
  return (
    <KeyboardAvoidingView
      style={[{ flex: 1 }, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[{ flexGrow: 1 }, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={{ flex: 1 }}>{children}</View>
        </TouchableWithoutFeedback>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
