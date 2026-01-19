import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { API_BASE_URL } from '../state/apiBaseUrl';
import { StarryBackground } from '../ui/components/StarryBackground';
import { GlassCard } from '../ui/components/GlassCard';
import { BottomDock } from '../ui/components/BottomDock';
import { theme } from '../ui/theme';

export function ReportScreen({ navigation }) {
  const [locationId, setLocationId] = useState('1');
  const [type, setType] = useState('rain');
  const [severity, setSeverity] = useState('medium');
  const [note, setNote] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const submit = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: Number(locationId),
          type,
          severity,
          note,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || 'Failed to submit report');
      }

      setMessage('Report sent. Thank you!');
      setNote('');
    } catch (e) {
      setMessage(`Error: ${e?.message || 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StarryBackground>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <Text style={styles.title}>Report</Text>
          <Text style={styles.subtitle}>Share what you’re seeing</Text>
        </View>

        <View style={styles.form}>
          <GlassCard style={styles.card} intensity={26}>
            <Text style={styles.label}>Location ID</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={locationId}
              onChangeText={setLocationId}
              placeholder="1"
              placeholderTextColor={theme.colors.text3}
            />

            <View style={{ height: 12 }} />

            <Text style={styles.label}>Type</Text>
            <TextInput
              style={styles.input}
              value={type}
              onChangeText={setType}
              placeholder="rain, flood, wind…"
              placeholderTextColor={theme.colors.text3}
            />

            <View style={{ height: 12 }} />

            <Text style={styles.label}>Severity</Text>
            <TextInput
              style={styles.input}
              value={severity}
              onChangeText={setSeverity}
              placeholder="low, medium, high"
              placeholderTextColor={theme.colors.text3}
            />

            <View style={{ height: 12 }} />

            <Text style={styles.label}>Note</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              multiline
              value={note}
              onChangeText={setNote}
              placeholder="Describe what you see…"
              placeholderTextColor={theme.colors.text3}
            />

            <View style={{ height: 16 }} />

            <Pressable style={[styles.button, submitting && styles.buttonDisabled]} onPress={submit} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color={theme.colors.bgTop} />
              ) : (
                <>
                  <Ionicons name="send" size={16} color={theme.colors.bgTop} />
                  <Text style={styles.buttonText}>Send report</Text>
                </>
              )}
            </Pressable>

            {message ? <Text style={styles.message}>{message}</Text> : null}
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
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 18,
    paddingBottom: 10,
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
  form: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 10,
    paddingBottom: 140,
  },
  card: {
    borderRadius: 26,
  },
  label: {
    color: theme.colors.text3,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  input: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: theme.colors.text,
    fontWeight: '600',
  },
  textArea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  button: {
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: theme.colors.bgTop,
    fontWeight: '800',
  },
  message: {
    marginTop: 12,
    color: theme.colors.text2,
    fontWeight: '600',
  },
});
