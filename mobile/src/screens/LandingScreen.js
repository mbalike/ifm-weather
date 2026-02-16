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
import { formatTimeEAT, formatWeekdayEAT } from '../state/time';

function formatHourLabel(date, isNow) {
  if (isNow) return 'Now';
  const txt = formatTimeEAT(date, { weekday: false });
  if (!txt) return '--';
  // Keep the compact look used before.
  return String(txt).toUpperCase().replace(' ', '');
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
    const day = formatWeekdayEAT(d) ?? '--';
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

function iconForWeather(main, pop, rainMm) {
  const m = String(main ?? '').toLowerCase();
  const p = typeof pop === 'number' ? pop : 0;
  const r = typeof rainMm === 'number' ? rainMm : 0;

  if (m.includes('thunder')) return 'thunderstorm-outline';
  if (m.includes('snow')) return 'snow-outline';
  if (m.includes('rain') || m.includes('drizzle') || r > 0 || p >= 0.45) return 'rainy-outline';
  if (m.includes('clear')) return 'sunny-outline';
  if (m.includes('cloud')) return 'cloud-outline';
  return 'partly-sunny-outline';
}

function toDate(iso) {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

function buildHourlyFromTimeline(timeline, fallbackTempC, fallbackChancePct) {
  const hourly = Array.isArray(timeline?.hourly) ? timeline.hourly : [];
  if (hourly.length > 0) {
    return hourly.slice(0, 24).map((h, i) => {
      const d = toDate(h?.dt) ?? new Date(Date.now() + i * 60 * 60 * 1000);
      const pop = typeof h?.pop === 'number' ? h.pop : 0;
      const rain1h = typeof h?.rain_1h_mm === 'number' ? h.rain_1h_mm : 0;
      const main = h?.weather_main;
      const temp = typeof h?.temp_c === 'number' ? Math.round(h.temp_c) : null;

      return {
        key: `h-${i}`,
        label: formatHourLabel(d, i === 0),
        temp: temp ?? Math.round(typeof fallbackTempC === 'number' ? fallbackTempC : 20),
        popPct: Math.round(pop * 100),
        icon: iconForWeather(main, pop, rain1h),
      };
    });
  }
  return buildHourly(fallbackTempC, fallbackChancePct).map((x) => ({
    ...x,
    popPct: x.pop,
  }));
}

function buildWeeklyFromTimeline(timeline, fallbackTempC) {
  const daily = Array.isArray(timeline?.daily) ? timeline.daily : [];
  if (daily.length > 0) {
    return daily.slice(0, 7).map((d, i) => {
      const dt = toDate(d?.dt) ?? new Date(Date.now() + i * 24 * 60 * 60 * 1000);
      const label = i === 0 ? 'Today' : (formatWeekdayEAT(dt) ?? '--');
      const hi = typeof d?.temp_max_c === 'number' ? Math.round(d.temp_max_c) : null;
      const lo = typeof d?.temp_min_c === 'number' ? Math.round(d.temp_min_c) : null;
      const pop = typeof d?.pop === 'number' ? d.pop : 0;
      const rainMm = typeof d?.rain_mm === 'number' ? d.rain_mm : 0;
      const main = d?.weather_main;

      return {
        key: `d-${i}`,
        label,
        hi: hi ?? Math.round(typeof fallbackTempC === 'number' ? fallbackTempC + 2 : 22),
        lo: lo ?? Math.round(typeof fallbackTempC === 'number' ? fallbackTempC - 2 : 18),
        icon: iconForWeather(main, pop, rainMm),
      };
    });
  }
  return buildWeekly(fallbackTempC);
}

function rankAlert(alert) {
  const level = String(alert?.level ?? alert?.severity ?? '').toLowerCase();
  if (level === 'emergency' || level === 'high') return 3;
  if (level === 'warning' || level === 'med' || level === 'medium') return 2;
  if (level === 'watch' || level === 'low') return 1;
  return 0;
}

function pickPrimaryAlert(alerts) {
  if (!Array.isArray(alerts) || alerts.length === 0) return null;
  return [...alerts].sort((a, b) => rankAlert(b) - rankAlert(a))[0] ?? null;
}

function alertParts(alert) {
  if (!alert) return { title: null, message: null, level: null };
  const level = alert?.level ? String(alert.level).toUpperCase() : null;
  if (alert?.msg) {
    return { title: level ? `${level} • ${alert.category ?? 'Alert'}` : (alert.category ?? 'Alert'), message: String(alert.msg), level };
  }
  const title = alert?.title ?? alert?.event ?? 'Weather alert';
  const message = alert?.message ?? alert?.description ?? null;
  return { title: level ? `${level} • ${title}` : String(title), message: message ? String(message) : null, level };
}

function pickBackgroundColors(forecast) {
  const main = String(forecast?.timeline?.current?.weather_main ?? '').toLowerCase();
  if (main.includes('thunder') || main.includes('rain') || main.includes('drizzle')) {
    return ['#060B1E', '#0B2452', theme.colors.bgBottom];
  }
  if (main.includes('clear')) {
    return ['#120B1E', '#2B1F55', '#3B2B73'];
  }
  return [theme.colors.bgTop, theme.colors.bgMid, theme.colors.bgBottom];
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
  const { selectedLocation, forecast, alerts, loading, error, refresh } = useWeather();
  const [tab, setTab] = useState('left');

  const hourly = useMemo(
    () => buildHourlyFromTimeline(forecast?.timeline, forecast?.tempC, forecast?.chanceOfRainPct),
    [forecast?.chanceOfRainPct, forecast?.tempC, forecast?.timeline]
  );

  const weekly = useMemo(
    () => buildWeeklyFromTimeline(forecast?.timeline, forecast?.tempC),
    [forecast?.tempC, forecast?.timeline]
  );

  const tempText = typeof forecast?.tempC === 'number' ? `${Math.round(forecast.tempC)}°` : '--°';
  const hi = typeof forecast?.highC === 'number' ? Math.round(forecast.highC) : null;
  const lo = typeof forecast?.lowC === 'number' ? Math.round(forecast.lowC) : null;

  const primaryAlert = useMemo(() => pickPrimaryAlert(alerts), [alerts]);
  const { title: alertTitle, message: alertMessage } = useMemo(() => alertParts(primaryAlert), [primaryAlert]);

  const bgColors = useMemo(() => pickBackgroundColors(forecast), [forecast?.timeline?.current?.weather_main]);

  return (
    <StarryBackground colors={bgColors}>
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

          {primaryAlert ? (
            <Pressable style={styles.alertBanner} onPress={() => navigation.navigate('Insights')}>
              <Ionicons name="alert-circle-outline" size={18} color={theme.colors.text} />
              <View style={{ flex: 1 }}>
                <Text style={styles.alertTitle} numberOfLines={1}>{alertTitle ?? 'Weather alert'}</Text>
                {alertMessage ? (
                  <Text style={styles.alertMessage} numberOfLines={2}>{alertMessage}</Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.text3} />
            </Pressable>
          ) : null}

          <View style={styles.quickGrid}>
            <GlassCard style={styles.quickCard} intensity={20}>
              <Text style={styles.quickLabel}>Humidity</Text>
              <Text style={styles.quickValue}>{forecast?.humidity != null ? `${Math.round(forecast.humidity)}%` : '--'}</Text>
            </GlassCard>
            <GlassCard style={styles.quickCard} intensity={20}>
              <Text style={styles.quickLabel}>UV</Text>
              <Text style={styles.quickValue}>{forecast?.uvIndex != null ? `${forecast.uvIndex}` : '--'}</Text>
            </GlassCard>
            <GlassCard style={styles.quickCard} intensity={20}>
              <Text style={styles.quickLabel}>Visibility</Text>
              <Text style={styles.quickValue}>{forecast?.visibilityKm != null ? `${forecast.visibilityKm} km` : '--'}</Text>
            </GlassCard>
            <GlassCard style={styles.quickCard} intensity={20}>
              <Text style={styles.quickLabel}>Pressure</Text>
              <Text style={styles.quickValue}>{forecast?.pressureHpa != null ? `${Math.round(forecast.pressureHpa)} hPa` : '--'}</Text>
            </GlassCard>
          </View>
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
        onCenter={() => navigation.navigate('Alerts')}
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
  alertBanner: {
    width: '100%',
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 14,
    marginBottom: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(244,63,94,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.30)',
  },
  alertTitle: {
    color: theme.colors.text,
    fontWeight: '800',
  },
  alertMessage: {
    marginTop: 2,
    color: theme.colors.text2,
    fontWeight: '600',
    lineHeight: 16,
  },
  quickGrid: {
    width: '100%',
    maxWidth: 520,
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  quickCard: {
    width: '48%',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  quickLabel: {
    color: theme.colors.text3,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.3,
  },
  quickValue: {
    marginTop: 6,
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 16,
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
