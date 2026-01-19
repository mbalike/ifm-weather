import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useWeather } from '../state/WeatherContext';
import { StarryBackground } from '../ui/components/StarryBackground';
import { GlassCard } from '../ui/components/GlassCard';
import { SegmentedTabs } from '../ui/components/SegmentedTabs';
import { BottomDock } from '../ui/components/BottomDock';
import { theme } from '../ui/theme';

function formatHourLabel(date, isNow) {
  if (isNow) return 'Now';
  return date
    .toLocaleTimeString([], { hour: 'numeric' })
    .toUpperCase()
    .replace(' ', '');
}

function buildHourly(tempC, chanceOfRainPct) {
  const base = typeof tempC === 'number' ? tempC : 20;
  const rain = typeof chanceOfRainPct === 'number' ? chanceOfRainPct : 30;
  const now = new Date();

  return Array.from({ length: 8 }).map((_, i) => {
    const d = new Date(now.getTime() + i * 60 * 60 * 1000);
    const wiggle = Math.sin(i / 2) * 2.2;
    const t = Math.round(base + wiggle);
    const p = Math.max(0, Math.min(100, Math.round(rain + (i % 3) * 6 - 6)));
    return {
      key: `h-${i}`,
      label: formatHourLabel(d, i === 0),
      temp: t,
      pop: p,
      icon: p >= 45 ? 'rainy-outline' : 'cloud-outline',
    };
  });
}

function buildWeekly(tempC) {
  const base = typeof tempC === 'number' ? tempC : 20;
  const now = new Date();

  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    const day = d.toLocaleDateString([], { weekday: 'short' });
    const hi = Math.round(base + 2 + Math.sin(i / 1.7) * 2);
    const lo = Math.round(base - 2 + Math.cos(i / 1.9) * 2);
    return {
      key: `d-${i}`,
      label: i === 0 ? 'Today' : day,
      hi,
      lo,
      icon: 'partly-sunny-outline',
    };
  });
}

function HouseIllustration() {
  return (
    <View style={styles.houseWrap}>
      <View style={styles.houseGround} />
      <View style={styles.houseBody}>
        <View style={styles.houseRoof} />
        <View style={styles.houseWindowsRow}>
          <View style={styles.houseWindow} />
          <View style={styles.houseWindow} />
        </View>
        <View style={styles.houseDoor} />
      </View>
    </View>
  );
}

export function LandingScreen({ navigation }) {
  const { selectedLocation, forecast, loading, error, refresh } = useWeather();
  const [tab, setTab] = useState('left');

  const hourly = useMemo(
    () => buildHourly(forecast?.tempC, forecast?.chanceOfRainPct),
    [forecast?.chanceOfRainPct, forecast?.tempC]
  );

  const weekly = useMemo(
    () => buildWeekly(forecast?.tempC),
    [forecast?.tempC]
  );

  const tempText = typeof forecast?.tempC === 'number' ? `${Math.round(forecast.tempC)}°` : '--°';
  const hi = typeof forecast?.highC === 'number' ? Math.round(forecast.highC) : null;
  const lo = typeof forecast?.lowC === 'number' ? Math.round(forecast.lowC) : null;

  return (
    <StarryBackground>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <Pressable style={styles.locationPress} onPress={() => navigation.navigate('Locations')}>
            <Text style={styles.city} numberOfLines={1}>
              {selectedLocation?.name ?? '—'}
            </Text>
            <Ionicons name="chevron-down" size={18} color={theme.colors.text2} />
          </Pressable>

          <Text style={styles.temp}>{tempText}</Text>
          <Text style={styles.summary}>{forecast?.summary ?? 'Mostly Clear'}</Text>
          <Text style={styles.hilo}>
            {hi != null ? `H:${hi}°` : 'H:--'}  {lo != null ? `L:${lo}°` : 'L:--'}
          </Text>

          {error ? (
            <Pressable style={styles.errorPill} onPress={refresh}>
              <Ionicons name="warning-outline" size={16} color={theme.colors.text} />
              <Text style={styles.errorText} numberOfLines={1}>{error}</Text>
              <Text style={styles.retryText}>Tap to retry</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.illustrationSlot}>
          <HouseIllustration />
        </View>

        <View style={styles.bottomPanel}>
          <GlassCard style={styles.glassPanel} intensity={28}>
            <SegmentedTabs
              leftLabel="Hourly Forecast"
              rightLabel="Weekly Forecast"
              value={tab}
              onChange={setTab}
            />

            <View style={{ height: 14 }} />

            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={theme.colors.text} />
                <Text style={styles.loadingText}>Loading…</Text>
              </View>
            ) : (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={tab === 'left' ? hourly : weekly}
                keyExtractor={(item) => item.key}
                contentContainerStyle={styles.pillsContent}
                renderItem={({ item, index }) => (
                  <View style={[styles.pill, index === 0 && styles.pillActive]}>
                    <Text style={styles.pillTime}>{item.label}</Text>
                    <Ionicons
                      name={item.icon}
                      size={22}
                      color={theme.colors.text}
                      style={{ marginTop: 8 }}
                    />
                    {tab === 'left' ? (
                      <>
                        <Text style={styles.pillPop}>{item.pop}%</Text>
                        <Text style={styles.pillTemp}>{item.temp}°</Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.pillPop}>{item.hi}° / {item.lo}°</Text>
                        <Text style={styles.pillTemp}> </Text>
                      </>
                    )}
                  </View>
                )}
              />
            )}
          </GlassCard>
        </View>
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
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: theme.spacing.lg,
  },
  locationPress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  city: {
    color: theme.colors.text,
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  temp: {
    marginTop: 10,
    color: theme.colors.text,
    fontSize: 86,
    fontWeight: '300',
    lineHeight: 92,
  },
  summary: {
    marginTop: 2,
    color: theme.colors.text2,
    fontSize: 16,
    fontWeight: '500',
  },
  hilo: {
    marginTop: 4,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.9,
  },
  errorPill: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(244,63,94,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.30)',
  },
  errorText: {
    color: theme.colors.text,
    maxWidth: 170,
    fontSize: 12,
    fontWeight: '600',
  },
  retryText: {
    color: theme.colors.text2,
    fontSize: 12,
    fontWeight: '600',
  },
  illustrationSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  bottomPanel: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 110,
  },
  glassPanel: {
    borderRadius: 30,
  },
  loadingRow: {
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: theme.colors.text2,
    fontWeight: '600',
  },
  pillsContent: {
    paddingVertical: 6,
    gap: 12,
  },
  pill: {
    width: 72,
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  pillActive: {
    backgroundColor: 'rgba(167,139,250,0.22)',
    borderColor: 'rgba(167,139,250,0.35)',
  },
  pillTime: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.9,
  },
  pillPop: {
    marginTop: 6,
    color: theme.colors.accent2,
    fontSize: 12,
    fontWeight: '700',
  },
  pillTemp: {
    marginTop: 10,
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },

  // Tiny house illustration (placeholder until you add a real image)
  houseWrap: {
    width: 220,
    height: 190,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  houseGround: {
    position: 'absolute',
    bottom: 22,
    width: 230,
    height: 22,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  houseBody: {
    width: 200,
    height: 120,
    borderRadius: 26,
    backgroundColor: 'rgba(120, 96, 220, 0.26)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    paddingTop: 28,
  },
  houseRoof: {
    position: 'absolute',
    top: -22,
    width: 150,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  houseWindowsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 6,
  },
  houseWindow: {
    width: 38,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  houseDoor: {
    marginTop: 18,
    width: 46,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(20, 24, 60, 0.38)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
});
