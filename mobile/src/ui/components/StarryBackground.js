import { useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';

function mulberry32(seed) {
  let t = seed;
  return function random() {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function StarryBackground({ children }) {
  const stars = useMemo(() => {
    const { width, height } = Dimensions.get('window');
    const rand = mulberry32(1337);
    const count = 120;
    return Array.from({ length: count }).map((_, i) => {
      const size = 1 + rand() * 2.2;
      const opacity = 0.18 + rand() * 0.65;
      return {
        key: `s-${i}`,
        left: rand() * width,
        top: rand() * height * 0.75,
        size,
        opacity,
      };
    });
  }, []);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[theme.colors.bgTop, theme.colors.bgMid, theme.colors.bgBottom]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {stars.map((s) => (
          <View
            key={s.key}
            style={[
              styles.star,
              {
                left: s.left,
                top: s.top,
                width: s.size,
                height: s.size,
                opacity: s.opacity,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  star: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
});
