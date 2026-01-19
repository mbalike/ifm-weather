import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useWeather } from '../state/WeatherContext';
import { StarryBackground } from '../ui/components/StarryBackground';
import { GlassCard } from '../ui/components/GlassCard';
import { SegmentedTabs } from '../ui/components/SegmentedTabs';
import { BottomDock } from '../ui/components/BottomDock';
import { theme } from '../ui/theme';

function buildHourly(tempC, chanceOfRainPct) {
  const base = typeof tempC === 'number' ? tempC : 20;
  const rain = typeof chanceOfRainPct === 'number' ? chanceOfRainPct : 30;
  const now = new Date();

  return Array.from({ length: 8 }).map((_, i) => {
    const d = new Date(now.getTime() + i * 60 * 60 * 1000);
    const label = i === 0
      ? 'Now'
      : d.toLocaleTimeString([], { hour: 'numeric' }).toUpperCase().replace(' ', '');

    const wiggle = Math.sin(i / 2) * 2.2;
    const t = Math.round(base + wiggle);
    const p = Math.max(0, Math.min(100, Math.round(rain + (i % 3) * 7 - 7)));

    return {
      key: `h-${i}`,
      label,
      temp: t,
      pop: p,
      icon: p >= 45 ? 'rainy-outline' : 'cloud-outline',
    };
  });
}

function MetricCard({ title, subtitle, right, icon, accent, children }) {
  return (
    <GlassCard style={styles.metricCard} intensity={26}>
      <View style={styles.metricTop}>
        <View style={styles.metricTitleRow}>
          <Ionicons name={icon} size={14} color={theme.colors.text3} />
          <Text style={styles.metricTitle}>{title}</Text>
        </View>
        {right ? <Text style={styles.metricRight}>{right}</Text> : null}
      </View>
      {subtitle ? <Text style={styles.metricSubtitle}>{subtitle}</Text> : null}
      {children ? <View style={styles.metricBody}>{children}</View> : null}
      {accent ? <View style={[styles.metricAccent, { backgroundColor: accent }]} /> : null}
    </GlassCard>
  );
}

export function InsightsScreen({ navigation }) {
  const { selectedLocation, forecast, loading, error, refresh } = useWeather();
  const [tab, setTab] = useState('left');

  const hourly = useMemo(
    () => buildHourly(forecast?.tempC, forecast?.chanceOfRainPct),
    [forecast?.chanceOfRainPct, forecast?.tempC]
  );

  const tempText = typeof forecast?.tempC === 'number' ? `${Math.round(forecast.tempC)}°` : '--°';

  return (
    <StarryBackground>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.topHeader}>
            <Pressable style={styles.locationPress} onPress={() => navigation.navigate('Locations')}>
              <Text style={styles.city} numberOfLines={1}>{selectedLocation?.name ?? '—'}</Text>
              <Ionicons name="chevron-down" size={18} color={theme.colors.text2} />
            </Pressable>
            <Text style={styles.smallRow} numberOfLines={1}>
              {tempText}  |  {forecast?.summary ?? 'Mostly Clear'}
            </Text>
          </View>

          <View style={styles.tabsRow}>
            <SegmentedTabs
              leftLabel="Hourly Forecast"
              rightLabel="Weekly Forecast"
              value={tab}
              onChange={setTab}
            />
          </View>

          <View style={styles.hourlyWrap}>
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={theme.colors.text} />
                <Text style={styles.loadingText}>Loading…</Text>
              </View>
            ) : (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={hourly}
                keyExtractor={(item) => item.key}
                contentContainerStyle={styles.pillsContent}
                renderItem={({ item, index }) => (
                  <View style={[styles.pill, index === 0 && styles.pillActive]}>
                    <Text style={styles.pillTime}>{item.label}</Text>
                    <Ionicons name={item.icon} size={22} color={theme.colors.text} style={{ marginTop: 8 }} />
                    <Text style={styles.pillPop}>{item.pop}%</Text>
                    <Text style={styles.pillTemp}>{item.temp}°</Text>
                  </View>
                )}
              />
            )}
          </View>

          {error ? (
            <Pressable style={styles.errorPill} onPress={refresh}>
              <Ionicons name="warning-outline" size={16} color={theme.colors.text} />
              <Text style={styles.errorText} numberOfLines={1}>{error}</Text>
              <Text style={styles.retryText}>Tap to retry</Text>
            </Pressable>
          ) : null}

          <View style={styles.metrics}>
            <MetricCard
              title="Air Quality"
              subtitle="3 - Low Health Risk"
              right="See more"
              icon="leaf-outline"
              accent={theme.colors.pink}
            >
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: '78%', backgroundColor: theme.colors.pink }]} />
              </View>
            </MetricCard>

            <View style={styles.gridRow}>
              <MetricCard
                title="UV Index"
                subtitle={forecast?.uvIndex != null ? `${forecast.uvIndex}` : '4'}
                right="Moderate"
                icon="sunny-outline"
                accent={theme.colors.pink}
              >
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: '52%', backgroundColor: theme.colors.pink }]} />
                </View>
              </MetricCard>

              <MetricCard
                title="Sunrise"
                subtitle={forecast?.sunrise ?? '5:28 AM'}
                right={forecast?.sunset ? `Sunset: ${forecast.sunset}` : 'Sunset: 7:25 PM'}
                icon="time-outline"
                accent={theme.colors.accent2}
              >
                <View style={styles.sunPath}>
                  <View style={styles.sunPathDot} />
                </View>
              </MetricCard>
            </View>

            <View style={styles.gridRow}>
              <MetricCard
                title="Wind"
                subtitle={forecast?.windMs != null ? `${forecast.windMs.toFixed(1)} m/s` : '9.7 km/h'}
                right="N"
                icon="compass-outline"
                accent={theme.colors.accent}
              />

              <MetricCard
                title="Rainfall"
                subtitle={forecast?.rainMm != null ? `${forecast.rainMm} mm` : '1.8 mm'}
                right="in last hour"
                icon="water-outline"
                accent={theme.colors.accent2}
              />
            </View>
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>
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
  scroll: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 18,
  },
  topHeader: {
    alignItems: 'center',
    gap: 6,
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
  },
  smallRow: {
    color: theme.colors.text2,
    fontWeight: '600',
  },
  tabsRow: {
    marginTop: 18,
    alignItems: 'center',
  },
  hourlyWrap: {
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.06)',
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
    paddingHorizontal: 12,
    gap: 12,
    paddingVertical: 6,
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
  errorPill: {
    marginTop: 12,
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
  metrics: {
    marginTop: 16,
    gap: 14,
  },
  metricCard: {
    borderRadius: 26,
    padding: 0,
  },
  metricTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metricTitle: {
    color: theme.colors.text3,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  metricRight: {
    color: theme.colors.text3,
    fontSize: 12,
    fontWeight: '700',
  },
  metricSubtitle: {
    marginTop: 10,
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  metricBody: {
    marginTop: 12,
  },
  metricAccent: {
    marginTop: 14,
    height: 3,
    borderRadius: 999,
    opacity: 0.9,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  sunPath: {
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sunPathDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.accent2,
    alignSelf: 'center',
    opacity: 0.9,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 14,
  },
});
