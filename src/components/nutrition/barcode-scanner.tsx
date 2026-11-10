import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/** The formats printed on food packaging (EAN-13/8, UPC-A/E). */
const FOOD_BARCODES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

/** Camera view that reports the first barcode it reads (once, until remounted) — `busy` pauses reads while a lookup runs. */
export function BarcodeScanner({ busy, onScanned }: { busy: boolean; onScanned: (code: string) => void }) {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const last = useRef<string | null>(null);

  if (!permission) return <View style={styles.fill} />;

  if (!permission.granted) {
    return (
      <View style={[styles.fill, styles.center]}>
        <ThemedText style={styles.message}>Per leggere il codice a barre serve l’accesso alla fotocamera.</ThemedText>
        <Pressable onPress={requestPermission} accessibilityRole="button" style={[styles.button, { backgroundColor: theme.accent }]}>
          <ThemedText style={{ color: theme.onAccent, fontWeight: '600' }}>Consenti la fotocamera</ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <CameraView
        style={styles.fill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: [...FOOD_BARCODES] }}
        onBarcodeScanned={
          busy
            ? undefined
            : ({ data }) => {
                if (data === last.current) return;
                last.current = data;
                onScanned(data);
              }
        }
      />
      <View pointerEvents="none" style={styles.frameWrap}>
        <View style={[styles.frame, { borderColor: theme.accent }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, borderRadius: 20, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  message: { textAlign: 'center' },
  button: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  frameWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  frame: { width: '78%', height: 150, borderWidth: 3, borderRadius: 18 },
});
