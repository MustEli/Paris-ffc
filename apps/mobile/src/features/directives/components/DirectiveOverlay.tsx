import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { resolvePhotoUrl } from '../../../core/api/upload';
import { PhotoCaptureButton } from '../../sellerStock/components/PhotoCaptureButton';
import { useAuthStore } from '../../../core/auth/authStore';
import { useAcknowledgeDirective, useMyDirectives, useResolveDirective } from '../hooks/useDirectives';
import { DIRECTIVE_TYPE_LABELS } from '../types';

/**
 * Admin to Staff doc: an urgent overlay reachable from anywhere in the
 * app — mounted once at the navigation root (see RootNavigator), not
 * inside any one screen. Deliberately NOT a hard lock on the rest of
 * the app (no blocked navigation underneath) — see the backend's
 * Directive model doc comment for why a full force-pause of whatever
 * the staff member is doing was out of scope for this pass. What this
 * does deliver: a prominent, un-missable prompt with acknowledge +
 * (for photo_demand) mandatory photo resolution.
 */
export function DirectiveOverlay() {
  const role = useAuthStore((state) => state.user?.role);
  const userId = useAuthStore((state) => state.user?.id);
  const { data: directives } = useMyDirectives();
  const acknowledge = useAcknowledgeDirective();
  const resolve = useResolveDirective();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  if (role !== 'staff') return null;
  const active = directives?.[0];
  if (!active) return null;

  const isAcknowledgedByMe = active.status === 'in_progress' && active.receivedByUserId === userId;

  function handleResolve() {
    if (!photoUrl || !comment.trim()) return;
    resolve.mutate(
      { id: active!.id, completionPhotoUrl: photoUrl, completionComment: comment.trim() },
      {
        onSuccess: () => {
          setPhotoUrl(null);
          setComment('');
        },
      },
    );
  }

  return (
    <Modal transparent visible animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.badge}>ADMIN DIRECTIVE</Text>
          <Text style={styles.type}>{DIRECTIVE_TYPE_LABELS[active.type]}</Text>
          <Text style={styles.message}>{active.message}</Text>

          {active.status === 'pushed' && (
            <Pressable
              style={[styles.button, acknowledge.isPending && styles.buttonDisabled]}
              disabled={acknowledge.isPending}
              onPress={() => acknowledge.mutate(active.id)}
            >
              {acknowledge.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>I'M ON IT</Text>}
            </Pressable>
          )}
          {acknowledge.error && <Text style={styles.error}>{acknowledge.error.message}</Text>}

          {isAcknowledgedByMe && (
            <>
              {(active.creationPhotoUrl || active.creationComment) && (
                <View style={styles.creationBox}>
                  {active.creationComment && <Text style={styles.creationComment}>{active.creationComment}</Text>}
                  {active.creationPhotoUrl && (
                    <Image source={{ uri: resolvePhotoUrl(active.creationPhotoUrl) }} style={styles.creationPhoto} />
                  )}
                </View>
              )}

              <View style={styles.photoWrap}>
                <PhotoCaptureButton label="Photo" value={photoUrl} onChange={setPhotoUrl} />
              </View>
              <TextInput
                style={styles.commentInput}
                placeholder="Comment"
                placeholderTextColor="#9ca3af"
                multiline
                value={comment}
                onChangeText={setComment}
              />
              {resolve.error && <Text style={styles.error}>{resolve.error.message}</Text>}
              <Pressable
                style={[styles.button, (!photoUrl || !comment.trim() || resolve.isPending) && styles.buttonDisabled]}
                disabled={!photoUrl || !comment.trim() || resolve.isPending}
                onPress={handleResolve}
              >
                {resolve.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>SUBMIT &amp; CLEAR</Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#dc2626',
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 12,
  },
  type: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  message: {
    fontSize: 15,
    color: '#374151',
    marginBottom: 20,
  },
  creationBox: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  creationComment: {
    fontSize: 14,
    color: '#334155',
    marginBottom: 8,
  },
  creationPhoto: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  photoWrap: {
    marginBottom: 12,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0f172a',
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#dc2626',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  error: {
    color: '#dc2626',
    fontSize: 13,
    marginTop: 8,
  },
});
