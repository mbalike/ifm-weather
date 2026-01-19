import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { theme } from '../theme';

export function GlassCard({ children, style, intensity = 22 }) {
  return (
    <View style={[styles.shell, style]}>
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.overlay} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.glass,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.glass,
  },
  content: {
    padding: theme.spacing.md,
  },
});
