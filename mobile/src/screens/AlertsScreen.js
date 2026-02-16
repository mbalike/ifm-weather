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

function rankAlert(alert) {
  const level = String(alert?.level ?? alert?.severity ?? '').toLowerCase();
  if (level === 'emergency' || level === 'high') return 3;
  if (level === 'warning' || level === 'med' || level === 'medium') return 2;
  if (level === 'watch' || level === 'low') return 1;
  return 0;
}

function normalizeAlert(alert) {
  if (!alert) return null;

  // Local safety/activity alerts from backend: { category, level, msg, metric }
  if (alert?.msg) {
    const level = alert?.level ? String(alert.level).toUpperCase() : null;
    const title = `${level ? `${level} • ` : ''}${String(alert.category ?? 'Alert')}`;
    return {
      key: String(alert.id ?? alert.rule_ref ?? `${alert.category}-${alert.level}-${alert.metric ?? ''}`),
      title,
      message: String(alert.msg),
      source: 'local',
      level: level ?? null,
      metric: alert.metric ? String(alert.metric) : null,
      startsAt: null,
      endsAt: null,
    };
  }

  // OpenWeather alerts stored in DB: { title, message, level, starts_at, ends_at, source }
  const level = alert?.level ? String(alert.level).toUpperCase() : null;
  return {
    key: String(alert.id ?? alert.rule_ref ?? `${alert.title ?? 'alert'}`),
    title: `${level ? `${level} • ` : ''}${String(alert.title ?? alert.event ?? 'Weather alert')}`,
    message: alert.message ?? alert.description ?? null,
    source: alert.source ?? 'server',
    level: level ?? null,
    metric: null,
    startsAt: alert.starts_at ?? null,
    endsAt: alert.ends_at ?? null,
  };
}

function classifyAlert(a) {
  const title = String(a?.title ?? '').toLowerCase();
  const metric = String(a?.metric ?? '').toLowerCase();
  const blob = `${title} ${metric}`;

  if (a?.source !== 'local') return 'Official';

  if (/health/.test(blob) || /uv|heat|mask|dust|haze|smoke/.test(blob)) return 'Health Hazards';
  if (/flood|storm|thunder|lightning|rain/.test(blob)) return 'Physical Hazards';
  if (/driver|visibility|road|commuter/.test(blob)) return 'Travel';
  if (/fisher|coast|sea|marine|boat|kusi/.test(blob)) return 'Marine';
  if (/agri|farm|crop|frost/.test(blob)) return 'Agriculture';
  return 'Activity';
}

function formatTimeRange(startsAt, endsAt) {
  const sTxt = formatTimeEAT(startsAt, { weekday: true });
  if (!sTxt) return null;
  const eTxt = formatTimeEAT(endsAt, { weekday: false });
  if (!eTxt) return sTxt;
  return `${sTxt} → ${eTxt}`;
}

export function AlertsScreen({ navigation }) {
  const { selectedLocation, alerts, loading, error, refresh } = useWeather();

  const items = useMemo(() => {
    const list = Array.isArray(alerts) ? alerts : [];
    const normalized = list.map(normalizeAlert).filter(Boolean);
    normalized.sort((a, b) => rankAlert(b) - rankAlert(a));
    return normalized;
  }, [alerts]);

  const groups = useMemo(() => {
    const order = ['Health Hazards', 'Physical Hazards', 'Travel', 'Marine', 'Agriculture', 'Activity', 'Official'];
    const map = new Map();
    for (const a of items) {
      const k = classifyAlert(a);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(a);
    }
    return order
      .filter((k) => map.has(k) && map.get(k).length)
      .map((k) => ({ key: k, title: k, items: map.get(k) }));
  }, [items]);

  return (
    <StarryBackground>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.topHeader}>
            <Pressable style={styles.locationPress} onPress={() => navigation.navigate('Locations')}>
              <Text style={styles.city} numberOfLines={1}>{selectedLocation?.name ?? '—'}</Text>
              <Ionicons name="chevron-down" size={18} color={theme.colors.text2} />
            </Pressable>
            <Text style={styles.title}>Alerts</Text>
            <Text style={styles.subtitle}>Safety & activity notices</Text>
          </View>

          {error ? (
            <Pressable style={styles.errorPill} onPress={refresh}>
              <Ionicons name="warning-outline" size={16} color={theme.colors.text} />
              <Text style={styles.errorText} numberOfLines={1}>{error}</Text>
              <Text style={styles.retryText}>Tap to retry</Text>
            </Pressable>
          ) : null}

          {loading ? (
            <GlassCard style={styles.loadingCard} intensity={22}>
              <Text style={styles.loadingText}>Loading alerts…</Text>
            </GlassCard>
          ) : items.length === 0 ? (
            <GlassCard style={styles.emptyCard} intensity={22}>
              <Ionicons name="checkmark-circle-outline" size={18} color={theme.colors.text2} />
              <Text style={styles.emptyTitle}>No active alerts</Text>
              <Text style={styles.emptyMsg}>You’re all clear for now. We’ll post safety alerts here when conditions change.</Text>
            </GlassCard>
          ) : (
            <View style={styles.list}>
              {groups.map((g) => (
                <View key={g.key} style={styles.group}>
                  <Text style={styles.groupTitle}>{g.title}</Text>
                  <View style={styles.groupList}>
                    {g.items.map((a) => {
                      const time = formatTimeRange(a.startsAt, a.endsAt);
                      const badge = a.source === 'local' ? 'Activity' : 'Official';
                      return (
                        <GlassCard key={a.key} style={styles.alertCard} intensity={24}>
                          <View style={styles.alertRow}>
                            <View style={styles.iconDot}>
                              <Ionicons name="alert-circle-outline" size={16} color={theme.colors.text} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <View style={styles.titleRow}>
                                <Text style={styles.alertTitle} numberOfLines={1}>{a.title}</Text>
                                <Text style={styles.badge}>{badge}</Text>
                              </View>
                              {a.metric ? <Text style={styles.metric} numberOfLines={1}>{a.metric}</Text> : null}
                              {a.message ? <Text style={styles.alertMsg}>{String(a.message)}</Text> : null}
                              {time ? <Text style={styles.time}>{time}</Text> : null}
                            </View>
                          </View>
                        </GlassCard>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          )}

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
  title: {
    marginTop: 6,
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: theme.colors.text2,
    fontWeight: '600',
  },
  errorPill: {
    marginTop: 14,
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
  loadingCard: {
    marginTop: 18,
    borderRadius: 22,
    padding: 16,
    alignItems: 'center',
  },
  loadingText: {
    color: theme.colors.text2,
    fontWeight: '700',
  },
  emptyCard: {
    marginTop: 18,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontWeight: '800',
  },
  emptyMsg: {
    color: theme.colors.text2,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  list: {
    marginTop: 18,
    gap: 12,
  },
  group: {
    gap: 10,
  },
  groupTitle: {
    color: theme.colors.text3,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontSize: 12,
    paddingHorizontal: 6,
  },
  groupList: {
    gap: 10,
  },
  alertCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    padding: 12,
  },
  alertRow: {
    flexDirection: 'row',
    gap: 12,
  },
  iconDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244,63,94,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.24)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  alertTitle: {
    flex: 1,
    color: theme.colors.text,
    fontWeight: '900',
  },
  badge: {
    color: theme.colors.text3,
    fontWeight: '800',
    fontSize: 11,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  metric: {
    marginTop: 6,
    color: theme.colors.text3,
    fontWeight: '700',
  },
  alertMsg: {
    marginTop: 6,
    color: theme.colors.text2,
    fontWeight: '600',
    lineHeight: 18,
  },
  time: {
    marginTop: 8,
    color: theme.colors.text3,
    fontWeight: '700',
    fontSize: 12,
  },
});
