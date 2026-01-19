import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useWeather } from '../state/WeatherContext';
import { StarryBackground } from '../ui/components/StarryBackground';
import { GlassCard } from '../ui/components/GlassCard';
import { BottomDock } from '../ui/components/BottomDock';
import { theme } from '../ui/theme';

export function LocationsScreen({ navigation }) {
  const { locations, selectedLocation, loading, error, selectLocation, refresh } = useWeather();

  return (
    <StarryBackground>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <Text style={styles.title}>Locations</Text>
          <Text style={styles.subtitle}>Pick a city/community</Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.colors.text} />
            <Text style={styles.muted}>Loading locations…</Text>
          </View>
        ) : error ? (
          <Pressable style={styles.center} onPress={refresh}>
            <Ionicons name="warning-outline" size={18} color={theme.colors.text} />
            <Text style={[styles.muted, { marginTop: 10 }]}>{error}</Text>
            <Text style={styles.tap}>Tap to retry</Text>
          </Pressable>
        ) : (
          <FlatList
            data={locations}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const active = selectedLocation?.id === item.id;
              return (
                <Pressable
                  onPress={async () => {
                    await selectLocation(item);
                    navigation.navigate('Landing');
                  }}
                >
                  <GlassCard style={[styles.rowCard, active && styles.rowCardActive]} intensity={22}>
                    <View style={styles.row}>
                      <View style={[styles.dot, active && styles.dotActive]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{item.name}</Text>
                        {item.region ? <Text style={styles.rowSub}>{item.region}</Text> : null}
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={theme.colors.text3} />
                    </View>
                  </GlassCard>
                </Pressable>
              );
            }}
          />
        )}
      </SafeAreaView>

      <BottomDock
        onLeft={() => navigation.navigate('Locations')}
        onCenter={() => navigation.navigate('Report')}
        onRight={() => navigation.navigate('Insights')}
      />
    </StarryBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 18,
    paddingBottom: 8,
    alignItems: 'center',
  },
  title: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 6,
    color: theme.colors.text2,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 120,
  },
  muted: {
    color: theme.colors.text2,
    fontWeight: '600',
  },
  tap: {
    marginTop: 6,
    color: theme.colors.text3,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 10,
    paddingBottom: 140,
    gap: 12,
  },
  rowCard: {
    borderRadius: 22,
  },
  rowCardActive: {
    borderColor: 'rgba(167,139,250,0.55)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotActive: {
    backgroundColor: theme.colors.accent,
  },
  rowTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  rowSub: {
    marginTop: 4,
    color: theme.colors.text3,
    fontWeight: '600',
  },
});
