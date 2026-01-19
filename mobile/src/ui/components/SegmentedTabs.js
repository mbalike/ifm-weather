import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

export function SegmentedTabs({ leftLabel, rightLabel, value, onChange }) {
  return (
    <View style={styles.wrap}>
      <Pressable
        style={[styles.tab, value === 'left' && styles.tabActive]}
        onPress={() => onChange('left')}
      >
        <Text style={[styles.tabText, value === 'left' && styles.tabTextActive]}>{leftLabel}</Text>
      </Pressable>
      <Pressable
        style={[styles.tab, value === 'right' && styles.tabActive]}
        onPress={() => onChange('right')}
      >
        <Text style={[styles.tabText, value === 'right' && styles.tabTextActive]}>{rightLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: 8,
    padding: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 999,
  },
  tabActive: {
    backgroundColor: 'rgba(167,139,250,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
  },
  tabText: {
    color: theme.colors.text3,
    fontWeight: '600',
    fontSize: 13,
  },
  tabTextActive: {
    color: theme.colors.text,
  },
});
