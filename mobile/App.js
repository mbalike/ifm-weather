import 'react-native-gesture-handler';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';

function getApiBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }

  const hostUri = Constants.expoConfig?.hostUri ?? Constants.manifest2?.extra?.expoClient?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:8000`;
  }

  return 'http://localhost:8000';
}

const API_BASE_URL = getApiBaseUrl();

const Stack = createNativeStackNavigator();

function LocationsScreen({ navigation }) {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/locations`);
        if (!res.ok) {
          throw new Error('Failed to load locations');
        }
        const data = await res.json();
        setLocations(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) {
    return (
      <View style={styles.centeredFull}>
        <View style={styles.illustrationCircle}>
          <Text style={styles.illustrationEmoji}>⛅</Text>
        </View>
        <ActivityIndicator color="#38bdf8" style={{ marginTop: 16 }} />
        <Text style={styles.muted}>Loading locations...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centeredFull}>
        <View style={[styles.illustrationCircle, { backgroundColor: '#fee2e2' }]}>
          <Text style={styles.illustrationEmoji}>⚠️</Text>
        </View>
        <Text style={[styles.error, { marginTop: 12 }]}>Network issue</Text>
        <Text style={styles.muted}>Tap below to try again.</Text>
        <Pressable style={[styles.primaryButton, { marginTop: 20 }]} onPress={() => navigation.replace('Locations')}>
          <Text style={styles.primaryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!locations.length) {
    return (
      <View style={styles.centeredFull}>
        <View style={styles.illustrationCircle}>
          <Text style={styles.illustrationEmoji}>📭</Text>
        </View>
        <Text style={[styles.muted, { marginTop: 12 }]}>No locations available yet.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screenBackground}>
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>Weather & Alerts</Text>
        <Text style={styles.headerSubtitle}>Select a community to see today&apos;s conditions.</Text>
      </View>
      <FlatList
        data={locations}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => navigation.navigate('Details', { location: item })}
          >
            <View style={styles.cardRow}>
              <View style={styles.cardIconCircle}>
                <Text style={styles.cardIcon}>🌦️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                {item.region ? <Text style={styles.cardSubtitle}>{item.region}</Text> : null}
              </View>
            </View>
          </Pressable>
        )}
      />
      <Pressable
        style={styles.fabButton}
        onPress={() => navigation.navigate('Report')}
      >
        <Text style={styles.fabText}>＋</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function DetailsScreen({ route }) {
  const { location } = route.params;
  const [forecast, setForecast] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [fRes, aRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/locations/${location.id}/forecast`),
          fetch(`${API_BASE_URL}/api/locations/${location.id}/alerts`),
        ]);

        if (!fRes.ok) {
          throw new Error('Failed to load forecast');
        }

        const fData = await fRes.json();
        const aData = aRes.ok ? await aRes.json() : [];

        setForecast(fData);
        setAlerts(aData);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [location.id]);

  if (loading) {
    return (
      <View style={styles.centeredFull}>
        <View style={styles.illustrationCircle}>
          <Text style={styles.illustrationEmoji}>🌧️</Text>
        </View>
        <ActivityIndicator color="#38bdf8" style={{ marginTop: 16 }} />
        <Text style={styles.muted}>Loading forecast...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centeredFull}>
        <View style={[styles.illustrationCircle, { backgroundColor: '#fee2e2' }]}>
          <Text style={styles.illustrationEmoji}>⚠️</Text>
        </View>
        <Text style={[styles.error, { marginTop: 12 }]}>Couldn&apos;t load forecast</Text>
        <Text style={styles.muted}>Please go back and try again.</Text>
      </View>
    );
  }

  if (!forecast) {
    return (
      <View style={styles.centeredFull}>
        <View style={styles.illustrationCircle}>
          <Text style={styles.illustrationEmoji}>📭</Text>
        </View>
        <Text style={[styles.muted, { marginTop: 12 }]}>No forecast available for this location.</Text>
      </View>
    );
  }

  const tempC = forecast.temp_c != null ? Number(forecast.temp_c) : null;
  const feelsLikeC = forecast.feels_like_c != null ? Number(forecast.feels_like_c) : null;
  const chanceOfRain = forecast.chance_of_rain_pct != null ? Number(forecast.chance_of_rain_pct) : null;
  const windMs = forecast.wind_ms != null ? Number(forecast.wind_ms) : null;
  const windKph =
    forecast.wind_kph != null
      ? Number(forecast.wind_kph)
      : windMs != null
        ? Number((windMs * 3.6).toFixed(1))
        : null;
  const windLevel =
    forecast.wind_level ?? (windMs != null ? (windMs >= 15 ? 'strong' : windMs >= 9 ? 'breezy' : 'calm') : 'unknown');

  return (
    <SafeAreaView style={styles.screenBackground}>
      <View style={styles.detailCard}>
        <Text style={styles.detailTitle}>{location.name}</Text>
        <Text style={styles.detailTemp}>{tempC != null && Number.isFinite(tempC) ? tempC.toFixed(1) : '--'}°C</Text>
        <Text style={styles.detailFeelsLike}>
          Feels like: {feelsLikeC != null && Number.isFinite(feelsLikeC) ? feelsLikeC.toFixed(1) : '--'}°C
        </Text>
        {forecast.summary ? (
          <Text style={styles.detailSummary}>{forecast.summary}</Text>
        ) : null}
        <Text style={styles.detailRow}>Humidity: {forecast.humidity ?? '--'}%</Text>
        <Text style={styles.detailRow}>
          Wind: {windKph != null && Number.isFinite(windKph) ? windKph : (forecast.wind_ms ?? '--')} {windKph != null ? 'km/h' : 'm/s'}
          {windLevel ? ` • ${String(windLevel).toUpperCase()}` : ''}
        </Text>
        <Text style={styles.detailRow}>Chance of rain: {chanceOfRain != null && Number.isFinite(chanceOfRain) ? `${chanceOfRain}%` : '--'}</Text>
        <Text style={styles.detailRow}>Rain (last hour): {forecast.rain_mm ?? 0} mm</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active Alerts</Text>
        {alerts.length === 0 ? (
          <Text style={styles.muted}>No active alerts.</Text>
        ) : (
          alerts.map((alert) => (
            <View key={alert.id} style={styles.alertCard}>
              <Text style={styles.alertLevel}>{alert.level?.toUpperCase()}</Text>
              <Text style={styles.alertTitle}>{alert.title}</Text>
              {alert.message ? <Text style={styles.alertMessage}>{alert.message}</Text> : null}
            </View>
          ))
        )}
      </View>
    </SafeAreaView>
  );
}

function HazardsScreen() {
  const [hazards, setHazards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/hazards`);
        if (!res.ok) {
          throw new Error('Failed to load hazards');
        }
        const data = await res.json();
        setHazards(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) {
    return (
      <View style={styles.centeredFull}>
        <View style={styles.illustrationCircle}>
          <Text style={styles.illustrationEmoji}>🚧</Text>
        </View>
        <ActivityIndicator color="#38bdf8" style={{ marginTop: 16 }} />
        <Text style={styles.muted}>Loading hazards...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centeredFull}>
        <View style={styles.illustrationCircle}>
          <Text style={styles.illustrationEmoji}>⚠️</Text>
        </View>
        <Text style={[styles.error, { marginTop: 12 }]}>Couldn&apos;t load hazards</Text>
        <Text style={styles.muted}>{error}</Text>
      </View>
    );
  }

  if (!hazards.length) {
    return (
      <View style={styles.centeredFull}>
        <View style={styles.illustrationCircle}>
          <Text style={styles.illustrationEmoji}>✅</Text>
        </View>
        <Text style={[styles.muted, { marginTop: 12 }]}>No hazards reported yet.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screenBackground}>
      <FlatList
        data={hazards}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.hazardCard}>
            <View style={styles.hazardHeader}>
              <Text style={styles.hazardType}>{String(item.type ?? 'hazard').toUpperCase()}</Text>
              <Text style={styles.hazardSeverity}>{item.severity ? String(item.severity).toUpperCase() : '—'}</Text>
            </View>
            <Text style={styles.hazardLocation}>{item.location?.name ?? `Location #${item.location_id}`}</Text>
            {item.note ? <Text style={styles.hazardNote}>{item.note}</Text> : null}
            <Text style={styles.hazardMeta}>{item.reported_at ? `Reported: ${String(item.reported_at)}` : ''}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function ReportScreen() {
  const [locations, setLocations] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [type, setType] = useState('rain');
  const [severity, setSeverity] = useState('medium');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const loadLocations = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/locations`);
        if (!res.ok) {
          throw new Error('Failed to load locations');
        }
        const data = await res.json();
        setLocations(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length && selectedLocationId == null) {
          setSelectedLocationId(data[0].id);
        }
      } catch (e) {
        setMessage(`Error: ${e.message}`);
      }
    };

    loadLocations();
  }, []);

  const submit = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      if (!selectedLocationId) {
        throw new Error('Select a location first');
      }

      const res = await fetch(`${API_BASE_URL}/api/hazards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: Number(selectedLocationId),
          type,
          severity,
          note,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || 'Failed to submit report');
      }

      setMessage('Report sent. Asante!');
      setNote('');
    } catch (e) {
      setMessage(`Error: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screenBackground}>
      <View style={styles.formGroup}>
        <Text style={styles.label}>Location</Text>
        {locations.length === 0 ? (
          <Text style={styles.muted}>Loading locations...</Text>
        ) : (
          <View style={styles.locationPicker}>
            {locations.map((loc) => {
              const selected = Number(selectedLocationId) === Number(loc.id);
              return (
                <Pressable
                  key={String(loc.id)}
                  onPress={() => setSelectedLocationId(loc.id)}
                  style={[styles.locationChip, selected && styles.locationChipSelected]}
                >
                  <Text style={[styles.locationChipText, selected && styles.locationChipTextSelected]}>
                    {loc.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Type</Text>
        <TextInput
          style={styles.input}
          value={type}
          onChangeText={setType}
          placeholder="rain, flood, wind..."
          placeholderTextColor="#64748b"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Severity</Text>
        <TextInput
          style={styles.input}
          value={severity}
          onChangeText={setSeverity}
          placeholder="low, medium, high"
          placeholderTextColor="#64748b"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Note</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          multiline
          value={note}
          onChangeText={setNote}
          placeholder="Describe what you see..."
          placeholderTextColor="#64748b"
        />
      </View>

      <Pressable
        style={[styles.primaryButton, submitting && styles.buttonDisabled]}
        disabled={submitting}
        onPress={submit}
      >
        <Text style={styles.primaryButtonText}>{submitting ? 'Sending...' : 'Send report'}</Text>
      </Pressable>

      {message ? <Text style={styles.message}>{message}</Text> : null}
    </SafeAreaView>
  );
}

function HomeScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.screenBackground}>
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>Local Weather & Alerts</Text>
        <Text style={styles.headerSubtitle}>Choose what you want to see today.</Text>
      </View>

      <View style={styles.menuGrid}>
        <Pressable style={styles.menuCard} onPress={() => navigation.navigate('Locations')}>
          <Text style={styles.menuEmoji}>📍</Text>
          <Text style={styles.menuTitle}>Locations</Text>
          <Text style={styles.menuSubtitle}>Browse communities</Text>
        </Pressable>

        <Pressable style={styles.menuCard} onPress={() => navigation.navigate('Locations')}>
          <Text style={styles.menuEmoji}>🌦️</Text>
          <Text style={styles.menuTitle}>Forecasts</Text>
          <Text style={styles.menuSubtitle}>See today&apos;s weather</Text>
        </Pressable>

        <Pressable style={styles.menuCard} onPress={() => navigation.navigate('Report')}>
          <Text style={styles.menuEmoji}>🚨</Text>
          <Text style={styles.menuTitle}>Alerts & Reports</Text>
          <Text style={styles.menuSubtitle}>Send what you see</Text>
        </Pressable>

        <Pressable style={styles.menuCard} onPress={() => navigation.navigate('Hazards')}>
          <Text style={styles.menuEmoji}>🚧</Text>
          <Text style={styles.menuTitle}>Hazards</Text>
          <Text style={styles.menuSubtitle}>View community reports</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function LocationsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#f9fafb',
        contentStyle: { backgroundColor: '#020617' },
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Weather Home' }} />
      <Stack.Screen name="Locations" component={LocationsScreen} options={{ title: 'Locations' }} />
      <Stack.Screen name="Details" component={DetailsScreen} options={{ title: 'Forecast' }} />
      <Stack.Screen name="Hazards" component={HazardsScreen} options={{ title: 'Hazards' }} />
      <Stack.Screen name="Report" component={ReportScreen} options={{ title: 'Report incident' }} />
    </Stack.Navigator>
  );
}

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#020617',
  },
};

export default function App() {
  return (
    <NavigationContainer theme={navTheme}>
      <LocationsStack />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  screenBackground: {
    flex: 1,
    backgroundColor: '#020617',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
  },
  centeredFull: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#020617',
  },
  headerCard: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#0f172a',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#e5e7eb',
  },
  headerSubtitle: {
    marginTop: 4,
    color: '#9ca3af',
  },
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1f2937',
    marginBottom: 12,
    elevation: 2,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardIcon: {
    fontSize: 22,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e5e7eb',
  },
  cardSubtitle: {
    marginTop: 4,
    color: '#9ca3af',
  },
  primaryButton: {
    margin: 16,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  muted: {
    marginTop: 8,
    color: '#9ca3af',
  },
  error: {
    color: '#fecaca',
  },
  detailCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    color: '#e5e7eb',
  },
  detailTemp: {
    fontSize: 40,
    fontWeight: '700',
    marginBottom: 4,
    color: '#e5e7eb',
  },
  detailFeelsLike: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 8,
  },
  detailSummary: {
    fontSize: 16,
    marginBottom: 8,
    color: '#e5e7eb',
  },
  detailRow: {
    fontSize: 14,
    marginTop: 2,
    color: '#9ca3af',
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#e5e7eb',
  },
  alertCard: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1f2937',
    marginBottom: 8,
  },
  alertLevel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fca5a5',
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e5e7eb',
  },
  alertMessage: {
    fontSize: 13,
    marginTop: 4,
    color: '#cbd5e1',
  },
  formGroup: {
    marginHorizontal: 16,
    marginTop: 12,
  },
  label: {
    fontSize: 14,
    marginBottom: 4,
    color: '#e5e7eb',
  },
  input: {
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#020617',
    color: '#e5e7eb',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  message: {
    marginHorizontal: 16,
    marginTop: 16,
    color: '#e5e7eb',
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 16,
  },
  menuCard: {
    width: '48%',
    marginBottom: 16,
    paddingVertical: 20,
    borderRadius: 16,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1f2937',
    alignItems: 'center',
  },
  menuEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  menuTitle: {
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: '600',
  },
  menuSubtitle: {
    color: '#9ca3af',
    marginTop: 4,
    fontSize: 12,
  },
  fabButton: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  fabText: {
    fontSize: 28,
    color: '#052e16',
    marginTop: -2,
  },
  hazardCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1f2937',
    marginBottom: 12,
  },
  hazardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  hazardType: {
    color: '#e5e7eb',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.4,
  },
  hazardSeverity: {
    color: '#93c5fd',
    fontWeight: '700',
    fontSize: 12,
  },
  hazardLocation: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600',
  },
  hazardNote: {
    color: '#e5e7eb',
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
  },
  hazardMeta: {
    color: '#94a3b8',
    marginTop: 10,
    fontSize: 12,
  },
  locationPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  locationChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#020617',
    marginRight: 8,
    marginBottom: 8,
  },
  locationChipSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  locationChipText: {
    color: '#e5e7eb',
    fontSize: 12,
    fontWeight: '600',
  },
  locationChipTextSelected: {
    color: '#fff',
  },
  illustrationCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationEmoji: {
    fontSize: 40,
  },
});
