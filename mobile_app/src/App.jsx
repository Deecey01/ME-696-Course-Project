import React, { useState, useEffect, useRef } from 'react';
import { Settings, Zap, Bluetooth, Wifi, Cloud, AlertTriangle } from 'lucide-react';

const SERVICE_UUID = "12345678-1234-5678-1234-56789abcdef0";
const CHAR_UUID    = "12345678-1234-5678-1234-56789abcdef1";

function App() {
  const [connectionState, setConnectionState] = useState('setup'); // 'setup', 'connecting', 'connected'
  const [method, setMethod] = useState('wifi'); // 'wifi', 'ngrok', 'bluetooth'
  const [url, setUrl] = useState(window.location.hostname);
  
  const [score, setScore] = useState(0);
  const [threshold, setThreshold] = useState(75);
  
  const lastAlertTime = useRef(0);
  const wsRef = useRef(null);
  const bleCharRef = useRef(null);

  // ─── NOTIFICATIONS & HAPTICS ──────────────────────────────────────────────
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (connectionState !== 'connected') return;

    if (score >= threshold) {
      const now = Date.now();
      // Throttle alerts to once every 60 seconds
      if (now - lastAlertTime.current > 60000) {
        lastAlertTime.current = now;
        
        // Haptics
        if ("vibrate" in navigator) {
          navigator.vibrate([200, 100, 200, 100, 500]);
        }
        
        // Push notification
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("High Stress Detected!", {
            body: `Stress Score reached ${score}. Please take a moment to breathe.`,
            icon: "/vite.svg"
          });
        }
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
             // Fallback to simulator level if ML isn't calibrated
             setScore(Math.round(data.raw.stress_level * 100));
          }
        } catch (e) {}
      };
      ws.onerror = (e) => {
        console.error("WS Error", e);
        setConnectionState('setup');
        alert("Connection failed. Check URL or network.");
      };
      ws.onclose = () => setConnectionState('setup');
    } catch (e) {
      alert("Invalid WebSocket URL");
      setConnectionState('setup');
    }
  };

  const connectBluetooth = async () => {
    if (!navigator.bluetooth) {
      alert("Web Bluetooth is not supported on this browser/device. (Not supported on iOS Safari).");
      return;
    }
    try {
      setConnectionState('connecting');
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name: 'SmartVest' }],
        optionalServices: [SERVICE_UUID]
      });

      device.addEventListener('gattserverdisconnected', () => {
        setConnectionState('setup');
      });

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);
      const characteristic = await service.getCharacteristic(CHAR_UUID);
      
      bleCharRef.current = characteristic;
      
      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', (event) => {
        const value = new TextDecoder().decode(event.target.value);
        setScore(Math.round(parseFloat(value)));
      });

      setConnectionState('connected');
    } catch (error) {
      console.error(error);
      setConnectionState('setup');
    }
  };

  const handleConnect = () => {
    if (method === 'bluetooth') {
      connectBluetooth();
    } else if (method === 'wifi') {
      connectWebSocket(`ws://${url}:8002/ws/frontend`);
    } else {
      // ngrok
      let cleanUrl = url.replace("https://", "wss://").replace("http://", "ws://");
      if (!cleanUrl.startsWith("ws")) cleanUrl = "wss://" + cleanUrl;
      connectWebSocket(`${cleanUrl}/ws/frontend`);
    }
  };

  const disconnect = () => {
    if (wsRef.current) wsRef.current.close();
    if (bleCharRef.current) {
      bleCharRef.current.stopNotifications().catch(console.error);
      if (bleCharRef.current.service.device.gatt.connected) {
        bleCharRef.current.service.device.gatt.disconnect();
      }
    }
    setConnectionState('setup');
  };

  // ─── UI COMPONENTS ────────────────────────────────────────────────────────
  if (connectionState === 'setup' || connectionState === 'connecting') {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-sm">
          <div className="flex items-center justify-center gap-3 mb-8">
            <Zap className="text-blue-500 w-8 h-8" />
            <h1 className="text-2xl font-bold">Smart Vest</h1>
          </div>

          <div className="space-y-4 mb-8">
            <button 
              onClick={() => setMethod('wifi')}
              className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all ${method === 'wifi' ? 'border-blue-500 bg-blue-500/10' : 'border-slate-600 hover:bg-slate-700'}`}
            >
              <Wifi className={method === 'wifi' ? 'text-blue-400' : 'text-slate-400'} />
              <div className="text-left">
                <div className="font-semibold">Local Network</div>
                <div className="text-xs text-slate-400">WiFi or Mobile Hotspot</div>
              </div>
            </button>

            <button 
              onClick={() => setMethod('ngrok')}
              className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all ${method === 'ngrok' ? 'border-purple-500 bg-purple-500/10' : 'border-slate-600 hover:bg-slate-700'}`}
            >
              <Cloud className={method === 'ngrok' ? 'text-purple-400' : 'text-slate-400'} />
              <div className="text-left">
                <div className="font-semibold">Cloud Proxy</div>
                <div className="text-xs text-slate-400">Ngrok over Cellular Data</div>
              </div>
            </button>

            <button 
              onClick={() => setMethod('bluetooth')}
              className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all ${method === 'bluetooth' ? 'border-cyan-500 bg-cyan-500/10' : 'border-slate-600 hover:bg-slate-700'}`}
            >
              <Bluetooth className={method === 'bluetooth' ? 'text-cyan-400' : 'text-slate-400'} />
              <div className="text-left">
                <div className="font-semibold">Bluetooth LE</div>
                <div className="text-xs text-slate-400">Offline direct connection</div>
              </div>
            </button>
          </div>

          {method !== 'bluetooth' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-400 mb-2">
                {method === 'wifi' ? 'PC Local IP Address' : 'Ngrok URL'}
              </label>
              <input 
                type="text" 
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-slate-100 focus:outline-none focus:border-blue-500"
                placeholder={method === 'wifi' ? "192.168.1.55" : "https://xxx.ngrok.app"}
              />
            </div>
          )}

          <button 
            onClick={handleConnect}
            disabled={connectionState === 'connecting'}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg transition-all"
          >
            {connectionState === 'connecting' ? 'Connecting...' : 'Connect to Vest'}
          </button>
        </div>
      </div>
    );
  }

  // ─── DASHBOARD UI ─────────────────────────────────────────────────────────
  const isHighStress = score >= threshold;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col text-slate-100 pb-10">
      {/* Header */}
      <div className="p-6 flex justify-between items-center bg-slate-800 shadow-md">
        <div className="flex items-center gap-2">
          {method === 'wifi' && <Wifi className="text-blue-400 w-5 h-5" />}
          {method === 'ngrok' && <Cloud className="text-purple-400 w-5 h-5" />}
          {method === 'bluetooth' && <Bluetooth className="text-cyan-400 w-5 h-5" />}
          <span className="font-bold">Smart Vest Mobile</span>
        </div>
        <button onClick={disconnect} className="text-sm text-slate-400 hover:text-white">Disconnect</button>
      </div>

      {/* Main Score Display */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className={`relative w-64 h-64 rounded-full flex items-center justify-center transition-all duration-500
          ${isHighStress ? 'bg-red-500/20 shadow-[0_0_50px_rgba(239,68,68,0.4)] border-2 border-red-500' 
                         : 'bg-slate-800 shadow-[0_0_30px_rgba(59,130,246,0.15)] border-2 border-slate-700'}`}>
          
          {isHighStress && (
            <div className="absolute inset-0 rounded-full border-4 border-red-500 animate-ping opacity-20" />
          )}
          
          <div className="text-center z-10">
            <div className="text-sm uppercase tracking-widest text-slate-400 mb-2 font-semibold">Stress Score</div>
            <div className={`text-8xl font-black transition-colors duration-300 ${isHighStress ? 'text-red-400' : 'text-slate-100'}`}>
              {score}
            </div>
          </div>
        </div>

        {isHighStress && (
          <div className="mt-8 flex items-center gap-3 text-red-400 bg-red-500/10 px-6 py-3 rounded-full border border-red-500/30 animate-pulse">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-bold">High Stress Detected</span>
          </div>
        )}
      </div>

      {/* Threshold Slider */}
      <div className="px-8 mt-auto">
        <div className="bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-700">
          <div className="flex justify-between items-center mb-4">
            <span className="text-slate-300 font-semibold flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-400" />
              Alert Threshold
            </span>
            <span className="bg-slate-900 px-3 py-1 rounded-lg text-sm font-bold border border-slate-600">
              {threshold}
            </span>
          </div>
          <input 
            type="range" 
            min="10" max="100" 
            value={threshold} 
            onChange={(e) => setThreshold(parseInt(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <p className="text-xs text-slate-500 mt-4 text-center">
            You will be notified via vibration and push alert when your score exceeds this threshold. (Max 1 alert per minute).
          </p>
        </div>
      </div>

    </div>
  );
}

export default App;
