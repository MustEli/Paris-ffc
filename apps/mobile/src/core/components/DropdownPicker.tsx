import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface DropdownPickerProps {
  options: string[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  isLoading?: boolean;
  /** Shown as the trigger's label when `options` is empty and not loading — e.g. "Ask an Admin to add one first." */
  emptyLabel?: string;
}

interface AnchorLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A collapsed select control — a bordered box showing the current value
 * (or a placeholder) with a chevron, that opens a list of options
 * anchored directly beneath the box itself on tap — for a small,
 * admin-managed list of options (Reception's Transporter Company /
 * Packaging Type, and any future admin-managed dropdown needing the
 * same thing). An earlier version opened a bottom sheet instead —
 * replaced per feedback that it didn't read as a real dropdown, with a
 * reference screenshot of exactly this "opens right under the box"
 * behavior.
 */
export function DropdownPicker({ options, value, onChange, placeholder = 'Select…', isLoading, emptyLabel }: DropdownPickerProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<AnchorLayout | null>(null);
  // collapsable={false} is required on Android — without it, a plain
  // wrapper View with a single child can get optimized out of the
  // native view hierarchy, and measureInWindow() below either fails
  // silently or measures the wrong node.
  const triggerRef = useRef<View>(null);
  const hasOptions = options.length > 0;

  if (isLoading) {
    return <ActivityIndicator style={styles.spinner} />;
  }

  function handleOpen() {
    if (!hasOptions) return;
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  }

  return (
    <>
      <View ref={triggerRef} collapsable={false}>
        <Pressable style={styles.trigger} onPress={handleOpen} disabled={!hasOptions}>
          <Text style={[styles.triggerText, !value && styles.placeholderText]} numberOfLines={1}>
            {value ?? (hasOptions ? placeholder : (emptyLabel ?? 'No options available yet.'))}
          </Text>
          <Text style={styles.chevron}>⌄</Text>
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        {/* Covers the whole screen so a tap anywhere outside the
            dropdown itself closes it — the dropdown's own Pressable
            (below) consumes taps landing on it before they reach this. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)}>
          {anchor && (
            <View
              style={[
                styles.dropdown,
                { top: anchor.y + anchor.height + 4, left: anchor.x, width: anchor.width },
              ]}
            >
              <Pressable onPress={() => {}}>
                <ScrollView style={styles.optionList} keyboardShouldPersistTaps="handled">
                  {options.map((option) => (
                    <Pressable
                      key={option}
                      style={[styles.option, value === option && styles.optionSelected]}
                      onPress={() => {
                        onChange(option);
                        setOpen(false);
                      }}
                    >
                      <Text style={[styles.optionText, value === option && styles.optionTextSelected]}>
                        {option}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  spinner: {
    marginVertical: 8,
  },
  trigger: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
  },
  triggerText: {
    fontSize: 15,
    color: '#0f172a',
    flex: 1,
  },
  placeholderText: {
    color: '#9ca3af',
  },
  chevron: {
    fontSize: 16,
    color: '#6b7280',
    marginLeft: 8,
  },
  dropdown: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    // A visible shadow matters more here than most cards in this app —
    // this floats directly over other form content, not inline with it.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    overflow: 'hidden',
  },
  optionList: {
    maxHeight: 240,
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  optionSelected: {
    backgroundColor: '#f1f5f9',
  },
  optionText: {
    fontSize: 15,
    color: '#374151',
  },
  optionTextSelected: {
    color: '#0f172a',
    fontWeight: '700',
  },
});
