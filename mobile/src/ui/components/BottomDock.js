import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

export function BottomDock({ onLeft, onCenter, onRight }) {
  return (
    <View style={styles.root} pointerEvents="box-none">
      <View style={styles.bar}>
        <BlurView intensity={22} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.barOverlay} />

        <Pressable style={styles.item} onPress={onLeft}>
          <Ionicons name="navigate" size={22} color={theme.colors.text2} />
          <Text style={styles.label}>Locations</Text>
        </Pressable>

        <View style={styles.centerSlot}>
          <Pressable style={styles.centerButton} onPress={onCenter}>
            <View style={styles.centerButtonGlow} />
            <Ionicons name="add" size={26} color={theme.colors.bgTop} />
          </Pressable>
        </View>

        <Pressable style={styles.item} onPress={onRight}>
          <Ionicons name="list" size={22} color={theme.colors.text2} />
          <Text style={styles.label}>Insights</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bar: {
    height: 88,
    paddingHorizontal: 28,
    paddingTop: 14,
    paddingBottom: 22,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  barOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(12, 14, 40, 0.55)',
  },
  item: {
    width: 86,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  label: {
    color: theme.colors.text3,
    fontSize: 11,
    fontWeight: '600',
  },
  centerSlot: {
    width: 110,
    alignItems: 'center',
  },
  centerButton: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    marginTop: -30,
    overflow: 'hidden',
  },
  centerButtonGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(167,139,250,0.18)',
  },
});
