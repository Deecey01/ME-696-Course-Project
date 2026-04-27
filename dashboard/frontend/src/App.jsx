import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  AlertTriangle, Activity, Loader2, PlaySquare, Zap,
} from 'lucide-react';

const WEBSOCKET_URL = "ws://localhost:8002/ws/frontend";
const API_BASE_URL = "http://localhost:8002/api";

// ─── helpers ────────────────────────────────────────────────────────────────

function lerp(a, b, t) { return a + (b - a) * t; }

function levelColor(level) {
  // 0 → green, 0.5 → yellow, 1 → red (HSL interpolation)
  if (level < 0.5) {
    const h = lerp(142, 48, level * 2);
    return `hsl(${h}, 90%, 52%)`;
  }
  const h = lerp(48, 0, (level - 0.5) * 2);
  return `hsl(${h}, 90%, 52%)`;
}

// ─── Main App ────────────────────────────────────────────────────────────────

function App() {
  const [dataBuffer, setDataBuffer] = useState([]);
  const [latestState, setLatestState] = useState(null);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [stressLevel, setStressLevel] = useState(0);   // 0–1 from simulator

  // Tap button visual state
  const [tapPulse, setTapPulse] = useState(false);

  const wsRef = useRef(null);

  // ── WebSocket ──────────────────────────────────────────────────────────────

  const connectWebSocket = useCallback(() => {
    wsRef.current = new WebSocket(WEBSOCKET_URL);

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const raw = data.raw;
      const ml = data.ml;

      const point = {
        time: new Date(raw.timestamp).toLocaleTimeString(),
        gsr: raw.gsr,
        hr: raw.hr,
        hrv: raw.hrv,
        respiration: raw.respiration,
        imuMag: Math.sqrt(raw.imu.ax ** 2 + raw.imu.ay ** 2 + raw.imu.az ** 2),
      };

      setDataBuffer(prev => {
        const nb = [...prev, point];
        if (nb.length > 60) nb.shift();
        return nb;
      });

      setLatestState({ raw, ml });

      // Live stress level from the simulator
      if (raw.stress_level !== undefined) setStressLevel(raw.stress_level);

      if (ml.status === 'calibrating') {
        setIsCalibrating(true);
        setCalibrationProgress(ml.progress * 100);
      } else {
        setIsCalibrating(false);
      }
    };

    wsRef.current.onerror = (err) => console.error("WS error:", err);
    wsRef.current.onclose = () => setTimeout(connectWebSocket, 3000);
  }, []);

  useEffect(() => {
    connectWebSocket();
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, [connectWebSocket]);

  // ── Controls ───────────────────────────────────────────────────────────────

  const startBaseline = async () => {
    try {
      await fetch(`${API_BASE_URL}/baseline`, { method: "POST" });
      setIsCalibrating(true);
      setCalibrationProgress(0);
    } catch (e) { console.error(e); }
  };

  const handleTap = async () => {
    // Trigger visual pulse
    setTapPulse(true);
    setTimeout(() => setTapPulse(false), 250);

    try {
      await fetch(`${API_BASE_URL}/stress/tap`, { method: "POST" });
    } catch (e) { console.error(e); }
  };


  // ── Derived display state ──────────────────────────────────────────────────

  const stressScore = latestState?.ml?.stress_score || 0;
  const isStressed = stressScore > 75;

  let scoreColor = "text-green-400";
  let scoreShadow = "drop-shadow-[0_0_18px_rgba(74,222,128,0.5)]";
  if (stressScore > 40) {
    scoreColor = "text-yellow-400";
    scoreShadow = "drop-shadow-[0_0_18px_rgba(250,204,21,0.55)]";
  }
  if (stressScore > 75) {
    scoreColor = "text-red-400";
    scoreShadow = "drop-shadow-[0_0_22px_rgba(248,113,113,0.8)]";
  }

  const levelPct = Math.round(stressLevel * 100);
  const levelClr = levelColor(stressLevel);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-900 p-6 flex flex-col gap-6 font-sans">

      {/* ── Header ── */}
      <div className={`p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 transition-all duration-700 shadow-lg
          ${isStressed ? 'bg-red-900/40 border border-red-500/50' : 'bg-slate-800 border border-slate-700'}`}>

        <div className="flex flex-col gap-4 w-full md:w-auto flex-1">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3 text-slate-100">
              <Activity className={isStressed ? 'animate-pulse text-red-400' : 'text-blue-400'} />
              Smart Vest Monitor
            </h1>
            <p className="text-slate-400 mt-1 text-sm">Real-time Physiological Telemetry</p>
          </div>

          {/* ── Stress Level Meter (Moved to top) ── */}
          <div className="w-full max-w-sm mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Simulator Level
              </span>
              <span className="text-[10px] font-bold" style={{ color: levelClr }}>
                {levelPct}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${levelPct}%`,
                  background: `linear-gradient(90deg, #22c55e, ${levelClr})`,
                  boxShadow: `0 0 10px ${levelClr}88`,
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end">
          {/* ── Circular Tap to Stress Button (Moved to top) ── */}
          <div className="flex flex-col items-center gap-2">
            <button
              id="btn-tap-stress"
              onClick={handleTap}
              className={`relative overflow-hidden w-20 h-20 rounded-full flex justify-center items-center
                shadow-lg transition-transform active:scale-90 select-none
                bg-gradient-to-br from-orange-500 to-pink-600 hover:from-orange-400 hover:to-pink-500 text-white
                ${tapPulse ? 'scale-90' : 'scale-100'}`}
              style={{ transition: 'transform 0.12s ease' }}
            >
              {tapPulse && <span className="absolute inset-0 rounded-full border-4 border-white/60 animate-ping" />}
              <Zap size={28} className={tapPulse ? 'animate-bounce' : ''} />
            </button>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tap to Stress</span>
          </div>

          <div className="flex flex-col items-end gap-1 min-w-[120px]">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Stress Score</span>
            {isCalibrating ? (
              <div className="flex items-center gap-3">
                <Loader2 className="animate-spin text-blue-400" />
                <span className="text-2xl font-bold text-blue-400">{calibrationProgress.toFixed(0)}%</span>
              </div>
            ) : (
              <div className={`text-6xl font-black ${scoreColor} ${scoreShadow} transition-all duration-300`}>
                {stressScore.toFixed(0)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Stress Alert ── */}
      {isStressed && !isCalibrating && (
        <div className="bg-red-500/20 text-red-200 p-4 rounded-xl flex items-center gap-4 border border-red-500/50
            animate-pulse">
          <AlertTriangle className="text-red-400 shrink-0" />
          <h2 className="font-bold text-base">High Stress Detected — immediate intervention advised.</h2>
        </div>
      )}

      {/* ── Charts grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="GSR · Galvanic Skin Response (µS)" data={dataBuffer} dataKey="gsr" color="#3b82f6" />
        <ChartCard title="Heart Rate (BPM)" data={dataBuffer} dataKey="hr" color="#ef4444" domain={['dataMin - 5', 'dataMax + 5']} />
        <ChartCard title="IMU Magnitude" data={dataBuffer} dataKey="imuMag" color="#8b5cf6" />
        <ChartCard title="Respiration Waveform" data={dataBuffer} dataKey="respiration" color="#10b981" />
      </div>

      {/* ── Controls row ── */}
      <div className="flex justify-center">
        {/* Baseline button */}
        <button
          id="btn-baseline"
          onClick={startBaseline}
          disabled={isCalibrating}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500
            text-white font-semibold py-3 px-8 rounded-xl transition-colors flex justify-center items-center gap-3 shadow w-full md:w-auto"
        >
          {isCalibrating ? <Loader2 className="animate-spin" size={20} /> : <PlaySquare size={20} />}
          {isCalibrating ? 'Calibrating...' : 'Start 30s Baseline Calibration'}
        </button>
      </div>

    </div>
  );
}

// ─── Chart Card ──────────────────────────────────────────────────────────────

function ChartCard({ title, data, dataKey, color, domain = ['auto', 'auto'] }) {
  return (
    <div className="bg-slate-800 p-5 rounded-2xl shadow border border-slate-700 flex flex-col">
      <h3 className="text-slate-300 font-semibold text-sm mb-3">{title}</h3>
      <div className="w-full h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: -22, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="time" stroke="#64748b" fontSize={11}
              tick={{ fill: '#64748b' }} tickMargin={8} minTickGap={35} />
            <YAxis stroke="#64748b" fontSize={11}
              tick={{ fill: '#64748b' }} domain={domain} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b', border: '1px solid #334155',
                borderRadius: '8px', color: '#f8fafc', fontSize: 12
              }}
              itemStyle={{ color }}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default App;
