import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useWeather } from '../state/WeatherContext';
import { StarryBackground } from '../ui/components/StarryBackground';
import { GlassCard } from '../ui/components/GlassCard';
import { BottomDock } from '../ui/components/BottomDock';
import { theme } from '../ui/theme';
import { formatTimeEAT } from '../state/time';

function MetricCard({ title, subtitle, right, icon, accent, children, style }) {
  return (
    <GlassCard style={[styles.metricCard, style]} intensity={26}>
      <View style={styles.metricTop}>
        <View style={styles.metricTitleRow}>
          <Ionicons name={icon} size={14} color={theme.colors.text3} />
          <Text style={styles.metricTitle}>{title}</Text>
        </View>
        {right ? <Text style={styles.metricRight} numberOfLines={1}>{right}</Text> : null}
      </View>
      {subtitle ? <Text style={styles.metricSubtitle}>{subtitle}</Text> : null}
      {children ? <View style={styles.metricBody}>{children}</View> : null}
      {accent ? <View style={[styles.metricAccent, { backgroundColor: accent }]} /> : null}
    </GlassCard>
  );
}

export function InsightsScreen({ navigation }) {
  const { selectedLocation, forecast } = useWeather();

  const tempText = typeof forecast?.tempC === 'number' ? `${Math.round(forecast.tempC)}°` : '--°';
  const sunriseTxt = formatTimeEAT(forecast?.sunrise) || '—';
  const sunsetTxt = formatTimeEAT(forecast?.sunset) || '—';

  const feelsLikeTxt = typeof forecast?.feelsLikeC === 'number' ? `Feels ${Math.round(forecast.feelsLikeC)}°` : null;
  const humidityTxt = typeof forecast?.humidity === 'number' ? `${Math.round(forecast.humidity)}%` : null;
  const rainChanceTxt = typeof forecast?.chanceOfRainPct === 'number' ? `${Math.round(forecast.chanceOfRainPct)}%` : null;
  const pressureTxt = typeof forecast?.pressureHpa === 'number' ? `${Math.round(forecast.pressureHpa)} hPa` : null;
  const visibilityTxt = typeof forecast?.visibilityKm === 'number' ? `${forecast.visibilityKm} km` : null;
  const quick = [
    feelsLikeTxt,
    humidityTxt ? `Humidity ${humidityTxt}` : null,
    rainChanceTxt ? `Rain ${rainChanceTxt}` : null,
    pressureTxt ? `Pressure ${pressureTxt}` : null,
    visibilityTxt ? `Visibility ${visibilityTxt}` : null,
  ].filter(Boolean).join('  •  ');

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

            {quick ? (
              <GlassCard style={styles.quickCard} intensity={22}>
                <Text style={styles.quickText} numberOfLines={2}>{quick}</Text>
              </GlassCard>
            ) : null}

            <View style={styles.gridRow}>
              <MetricCard
                title="UV Index"
                subtitle={forecast?.uvIndex != null ? `${forecast.uvIndex}` : '4'}
                right="Moderate"
                icon="sunny-outline"
                accent={theme.colors.pink}
                style={styles.half}
              >
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: '52%', backgroundColor: theme.colors.pink }]} />
                </View>
              </MetricCard>

              <MetricCard
                title="Sunrise"
                subtitle={sunriseTxt}
                right={`Sunset: ${sunsetTxt}`}
                icon="time-outline"
                accent={theme.colors.accent2}
                style={styles.half}
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
                style={styles.half}
              />

              <MetricCard
                title="Rainfall"
                subtitle={forecast?.rainMm != null ? `${forecast.rainMm} mm` : '1.8 mm'}
                right="in last hour"
                icon="water-outline"
                accent={theme.colors.accent2}
                style={styles.half}
              />
            </View>
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>
      </SafeAreaView>

      <BottomDock
        onLeft={() => navigation.navigate('Locations')}
        onCenter={() => navigation.navigate('Alerts')}
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
  metrics: {
    marginTop: 16,
    gap: 14,
  },
  metricCard: {
    borderRadius: 26,
    padding: 0,
  },
  half: {
    flex: 1,
    minWidth: 0,
  },
  quickCard: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  quickText: {
    color: theme.colors.text2,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
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
