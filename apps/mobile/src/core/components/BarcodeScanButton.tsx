import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';

interface Props {
  /** Called with the scanned value as soon as a barcode is read — the modal closes itself right after. */
  onScan: (value: string) => void;
}

const BARCODE_TYPES = [
  'code128',
  'code39',
  'code93',
  'codabar',
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'itf14',
  'qr',
  'pdf417',
  'datamatrix',
  'aztec',
] as const;

/**
 * Icon button that opens a full-screen camera scanner and calls back
 * with whatever barcode it reads — an alternative to typing a tracking
 * ID, not a replacement; the caller's own text input keeps working
 * exactly as before. Self-contained, same shape as PhotoCaptureButton
 * (owns its own permission request + error display).
 */
export function BarcodeScanButton({ onScan }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [isOpen, setIsOpen] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePress() {
    setError(null);
    const current = permission?.granted ? permission : await requestPermission();
    if (!current.granted) {
      setError(t('barcodeScanner.cameraPermissionRequired'));
      return;
    }
    setHasScanned(false);
    setIsOpen(true);
  }

  function handleScanned({ data }: { data: string }) {
    // CameraView keeps firing onBarcodeScanned for every frame while the
    // same code is in view — this latch makes sure only the first read
    // of a given open session actually does anything.
    if (hasScanned) return;
    setHasScanned(true);
    setIsOpen(false);
    onScan(data);
  }

  return (
    <View>
      <Pressable
        style={styles.button}
        onPress={handlePress}
        accessibilityLabel={t('barcodeScanner.scanButtonLabel')}
        hitSlop={8}
      >
        <Ionicons name="barcode-outline" size={22} color={colors.brandOrange} />
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}

      <Modal visible={isOpen} animationType="slide" onRequestClose={() => setIsOpen(false)}>
        <View style={styles.scannerContainer}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
            onBarcodeScanned={handleScanned}
          />
          <View style={styles.frame} pointerEvents="none" />
          <Text style={styles.hint}>{t('barcodeScanner.hint')}</Text>
          <Pressable
            style={[styles.closeButton, { top: insets.top + 12 }]}
            onPress={() => setIsOpen(false)}
            hitSlop={12}
          >
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: colors.alert,
    fontSize: 12,
    marginTop: 6,
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  frame: {
    position: 'absolute',
    top: '35%',
    left: '12%',
    right: '12%',
    height: 140,
    borderWidth: 2,
    borderColor: colors.brandOrange,
    borderRadius: 12,
  },
  hint: {
    position: 'absolute',
    bottom: 60,
    left: 24,
    right: 24,
    textAlign: 'center',
    color: '#fff',
    fontSize: 14,
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
