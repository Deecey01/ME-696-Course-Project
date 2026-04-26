import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import Slider from '@react-native-community/slider';
import { Wifi, Cloud, AlertTriangle } from 'lucide-react-native';

// Configure Notifications to show up immediately even when app is active
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [connectionState, setConnectionState] = useState('setup'); // 'setup', 'connecting', 'connected'
  const [method, setMethod] = useState('wifi'); // 'wifi', 'ngrok'
  const [url, setUrl] = useState('192.168.0.');
  
  const [score, setScore] = useState(0);
  const [threshold, setThreshold] = useState(75);
  
  const lastAlertTime = useRef(0);
  const wsRef = useRef(null);

  // ─── PERMISSIONS ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        alert('Please allow notifications for the app to alert you of high stress.');
      }
    })();
  }, []);

  // ─── NOTIFICATIONS & HAPTICS ──────────────────────────────────────────────
  useEffect(() => {
    if (connectionState !== 'connected') return;

    if (score >= threshold) {
      const now = Date.now();
      // Throttle alerts to once every 60 seconds
      if (now - lastAlertTime.current > 60000) {
        lastAlertTime.current = now;
        
        // Deep hardware haptic vibration (fallback to normal vibration)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {
          Vibration.vibrate([200, 100, 200, 100, 500]);
        });
        
        // Push native system notification with sound
        Notifications.scheduleNotificationAsync({
          content: {
            title: '⚠️ High Stress Detected!',
            body: `Stress Score reached ${score}. Please take a moment to breathe.`,
            sound: true, // Will play default OS notification sound
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: null, // trigger immediately
        });
      }
    }
  }, [score, threshold, connectionState]);

  // ─── CONNECTION LOGIC ─────────────────────────────────────────────────────
  const connectWebSocket = (wsUrl) => {
    setConnectionState('connecting');
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => setConnectionState('connected');
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.ml && data.ml.stress_score !== undefined) {
            setScore(Math.round(data.ml.stress_score));
          } else if (data.raw && data.raw.stress_level !== undefined) {
             setScore(Math.round(data.raw.stress_level * 100));
          }
        } catch (e) {}
      };
      ws.onerror = (e) => {
        console.error("WS Error", e);
        setConnectionState('setup');
        alert("Connection failed. Check IP/URL.");
      };
      ws.onclose = () => setConnectionState('setup');
    } catch (e) {
      alert("Invalid WebSocket URL");
      setConnectionState('setup');
    }
  };

  const handleConnect = () => {
    if (method === 'wifi') {
      connectWebSocket(`ws://${url}:8002/ws/frontend`);
    } else {
      let cleanUrl = url.replace("https://", "wss://").replace("http://", "ws://");
      if (!cleanUrl.startsWith("ws")) cleanUrl = "wss://" + cleanUrl;
      connectWebSocket(`${cleanUrl}/ws/frontend`);
    }
  };

  const disconnect = () => {
    if (wsRef.current) wsRef.current.close();
    setConnectionState('setup');
  };

  // ─── SETUP UI ─────────────────────────────────────────────────────────────
  if (connectionState === 'setup' || connectionState === 'connecting') {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Smart Vest</Text>
          <Text style={styles.subtitle}>Native Connection Setup</Text>

          <View style={styles.methodSelector}>
            <TouchableOpacity 
              style={[styles.methodBtn, method === 'wifi' && styles.methodBtnActive]}
              onPress={() => setMethod('wifi')}
            >
              <Wifi color={method === 'wifi' ? '#3b82f6' : '#94a3b8'} size={24} />
              <View style={styles.methodTextContainer}>
                <Text style={styles.methodTitle}>Local Network</Text>
                <Text style={styles.methodSub}>WiFi or Mobile Hotspot</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.methodBtn, method === 'ngrok' && styles.methodBtnActive]}
              onPress={() => setMethod('ngrok')}
            >
              <Cloud color={method === 'ngrok' ? '#a855f7' : '#94a3b8'} size={24} />
              <View style={styles.methodTextContainer}>
                <Text style={styles.methodTitle}>Cloud Proxy</Text>
                <Text style={styles.methodSub}>Ngrok via Cellular</Text>
              </View>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>
            {method === 'wifi' ? 'PC Local IP Address' : 'Ngrok URL'}
          </Text>
          <TextInput 
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder={method === 'wifi' ? "192.168.1.55" : "https://xxx.ngrok.app"}
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity 
            style={styles.connectBtn}
            onPress={handleConnect}
            disabled={connectionState === 'connecting'}
          >
            <Text style={styles.connectBtnText}>
              {connectionState === 'connecting' ? 'Connecting...' : 'Connect to Vest'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── DASHBOARD UI ─────────────────────────────────────────────────────────
  const isHighStress = score >= threshold;

  return (
    <View style={styles.dashboardContainer}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Smart Vest Native</Text>
        <TouchableOpacity onPress={disconnect}>
          <Text style={styles.disconnectText}>Disconnect</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.scoreContainer}>
        <View style={[styles.scoreCircle, isHighStress && styles.scoreCircleDanger]}>
          <Text style={styles.scoreLabel}>STRESS SCORE</Text>
          <Text style={[styles.scoreValue, isHighStress && styles.scoreValueDanger]}>
            {score}
          </Text>
        </View>

        {isHighStress && (
          <View style={styles.alertBadge}>
            <AlertTriangle color="#ef4444" size={20} />
            <Text style={styles.alertText}>High Stress Detected</Text>
          </View>
        )}
      </View>

      <View style={styles.settingsContainer}>
        <View style={styles.settingsHeader}>
          <Text style={styles.settingsTitle}>Alert Threshold</Text>
          <Text style={styles.settingsValue}>{threshold}</Text>
        </View>
        <Slider
          style={{ width: '100%', height: 40 }}
          minimumValue={10}
          maximumValue={100}
          step={1}
          value={threshold}
          onValueChange={setThreshold}
          minimumTrackTintColor="#3b82f6"
          maximumTrackTintColor="#334155"
        />
        <Text style={styles.settingsHint}>
          Native notification & sound will trigger when score exceeds {threshold}.
        </Text>
      </View>
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#1e293b',
    padding: 30,
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f8fafc',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 30,
  },
  methodSelector: {
    gap: 15,
    marginBottom: 30,
  },
  methodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
  },
  methodBtnActive: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  methodTextContainer: {
    marginLeft: 15,
  },
  methodTitle: {
    color: '#f8fafc',
    fontWeight: '600',
    fontSize: 16,
  },
  methodSub: {
    color: '#64748b',
    fontSize: 12,
  },
  label: {
    color: '#94a3b8',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 10,
    color: '#f8fafc',
    padding: 15,
    fontSize: 16,
    marginBottom: 30,
  },
  connectBtn: {
    backgroundColor: '#2563eb',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  connectBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  dashboardContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 25,
    paddingBottom: 20,
    backgroundColor: '#1e293b',
  },
  headerText: {
    color: '#f8fafc',
    fontWeight: 'bold',
    fontSize: 18,
  },
  disconnectText: {
    color: '#94a3b8',
  },
  scoreContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreCircle: {
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#1e293b',
    borderWidth: 3,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  scoreCircleDanger: {
    borderColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOpacity: 0.5,
  },
  scoreLabel: {
    color: '#94a3b8',
    letterSpacing: 2,
    fontWeight: '600',
    marginBottom: 10,
  },
  scoreValue: {
    fontSize: 100,
    fontWeight: '900',
    color: '#f8fafc',
  },
  scoreValueDanger: {
    color: '#f87171',
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 30,
    marginTop: 40,
    gap: 10,
  },
  alertText: {
    color: '#f87171',
    fontWeight: 'bold',
  },
  settingsContainer: {
    backgroundColor: '#1e293b',
    margin: 25,
    marginBottom: 50,
    padding: 20,
    borderRadius: 20,
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  settingsTitle: {
    color: '#f8fafc',
    fontWeight: '600',
  },
  settingsValue: {
    color: '#f8fafc',
    fontWeight: 'bold',
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  settingsHint: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 15,
  }
});
