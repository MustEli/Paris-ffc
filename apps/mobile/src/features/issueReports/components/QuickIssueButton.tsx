import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '../../../core/auth/authStore';
import { useActiveTaskContextStore } from '../../../core/navigation/activeTaskContextStore';
import { colors } from '../../../core/theme/colors';
import { PhotoCaptureButton } from '../../sellerStock/components/PhotoCaptureButton';
import { useCreateIssueReport } from '../hooks/useIssueReports';

/** How long the button stays disabled after a successful report, so a slow double-tap can't fire two in a row — staff can still raise another real issue once it's back up. */
const COOLDOWN_MS = 2 * 60 * 1000;

/**
 * A small floating shortcut, visible only while some screen has set an
 * active-task context label (see activeTaskContextStore) — lets staff
 * flag a problem without leaving/pausing what they're doing (nothing
 * here pauses any task — it's a pure side-channel report). Submits to
 * the same 'other' Issue Reporting category the full menu flow uses
 * (comment + optional photo, already alerts Admin), just via a lighter
 * popup and with the current task noted automatically — staff can send
 * as many of these as genuinely needed for one task, one at a time,
 * each gated by COOLDOWN_MS so it can't be spammed.
 */
export function QuickIssueButton() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const role = useAuthStore((state) => state.user?.role);
  const label = useActiveTaskContextStore((state) => state.label);
  const taskRef = useActiveTaskContextStore((state) => state.taskRef);
  const [isOpen, setIsOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
  }, []);

  const create = useCreateIssueReport();

  if (role !== 'staff' || !label) return null;

  function handleSend() {
    const trimmed = comment.trim();
    if (!trimmed) return;
    create.mutate(
      { category: 'other', comment: trimmed, photoUrls: photoUrl ? [photoUrl] : [], contextLabel: label ?? undefined, taskRef: taskRef ?? undefined },
      {
        onSuccess: () => {
          setComment('');
          setPhotoUrl(null);
          setIsOpen(false);
          setIsCoolingDown(true);
          cooldownTimer.current = setTimeout(() => setIsCoolingDown(false), COOLDOWN_MS);
          Alert.alert(t('issueReports.quick.title'), t('issueReports.quick.sent'));
        },
      },
    );
  }

  return (
    <>
      <Pressable
        style={[styles.fab, { bottom: insets.bottom + 110 }, isCoolingDown && styles.fabDisabled]}
        onPress={() => !isCoolingDown && setIsOpen(true)}
        disabled={isCoolingDown}
        accessibilityLabel={isCoolingDown ? t('issueReports.quick.buttonLabelCoolingDown') : t('issueReports.quick.buttonLabel')}
      >
        <Ionicons name="flag-outline" size={22} color="#fff" />
      </Pressable>

      <Modal transparent visible={isOpen} animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.title}>{t('issueReports.quick.title')}</Text>
            <Text style={styles.context}>{t('issueReports.quick.contextLabel', { context: label })}</Text>

            <TextInput
              style={styles.input}
              placeholder={t('issueReports.quick.placeholder')}
              placeholderTextColor={colors.textMuted}
              multiline
              value={comment}
              onChangeText={setComment}
            />

            <View style={styles.photoWrap}>
              <PhotoCaptureButton label={t('issueReports.field.photoOptional')} value={photoUrl} onChange={setPhotoUrl} />
            </View>

            {create.error && <Text style={styles.error}>{create.error.message}</Text>}

            <View style={styles.actions}>
              <Pressable style={styles.cancelButton} disabled={create.isPending} onPress={() => setIsOpen(false)}>
                <Text style={styles.cancelText}>{t('issueReports.quick.cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.sendButton, (!comment.trim() || create.isPending) && styles.sendButtonDisabled]}
                disabled={!comment.trim() || create.isPending}
                onPress={handleSend}
              >
                {create.isPending ? <ActivityIndicator color="#1a1200" /> : <Text style={styles.sendText}>{t('issueReports.quick.send')}</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.alert,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
    zIndex: 20,
  },
  fabDisabled: {
    opacity: 0.4,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 13, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  context: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  photoWrap: {
    marginTop: 12,
  },
  error: {
    color: colors.alert,
    fontSize: 13,
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  sendButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: colors.brandOrange,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendText: {
    color: '#1a1200',
    fontSize: 15,
    fontWeight: '700',
  },
});
