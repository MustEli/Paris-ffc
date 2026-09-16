import { useState } from 'react';
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

/**
 * A collapsed select control — a bordered box showing the current value
 * (or a placeholder) with a chevron, that opens a list of options in a
 * sheet on tap — for a small, admin-managed list of options (Reception's
 * Transporter Company / Packaging Type, and any future admin-managed
 * dropdown needing the same thing). Replaced an earlier always-expanded
 * chip-row version per explicit feedback that it didn't read as a real
 * dropdown; this is a bottom-sheet-style list rather than a popover
 * anchored exactly under the trigger, since that's far simpler and just
 * as clear on a phone screen.
 */
export function DropdownPicker({ options, value, onChange, placeholder = 'Select…', isLoading, emptyLabel }: DropdownPickerProps) {
  const [open, setOpen] = useState(false);
  const hasOptions = options.length > 0;

  if (isLoading) {
    return <ActivityIndicator style={styles.spinner} />;
  }

  return (
    <>
      <Pressable style={styles.trigger} onPress={() => hasOptions && setOpen(true)} disabled={!hasOptions}>
        <Text
          style={[styles.triggerText, !value && styles.placeholderText]}
          numberOfLines={1}
        >
          {value ?? (hasOptions ? placeholder : (emptyLabel ?? 'No options available yet.'))}
        </Text>
        <Text style={styles.chevron}>⌄</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          {/* Consumes the touch so tapping inside the sheet doesn't fall
              through to the backdrop's onPress and close it. */}
          <Pressable style={styles.sheet} onPress={() => {}}>
            <ScrollView style={styles.optionList}>
              {options.map((option) => (
                <Pressable
                  key={option}
                  style={[styles.option, value === option && styles.optionSelected]}
                  onPress={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.optionText, value === option && styles.optionTextSelected]}>{option}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.cancelButton} onPress={() => setOpen(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    paddingBottom: 24,
    maxHeight: '60%',
  },
  optionList: {
    flexGrow: 0,
  },
  option: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  optionSelected: {
    backgroundColor: '#f1f5f9',
  },
  optionText: {
    fontSize: 16,
    color: '#374151',
  },
  optionTextSelected: {
    color: '#0f172a',
    fontWeight: '700',
  },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
});
