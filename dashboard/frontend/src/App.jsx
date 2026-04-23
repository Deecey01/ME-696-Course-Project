import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { AlertTriangle, Activity, Loader2, PlaySquare, ChevronDown, ChevronUp, Check, X } from 'lucide-react';

const WEBSOCKET_URL = "ws://localhost:8002/ws/frontend";
const API_BASE_URL = "http://localhost:8002/api";

function App() {
  const [dataBuffer, setDataBuffer] = useState([]);
  const [latestState, setLatestState] = useState(null);
  const [stressActive, setStressActive] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);

  // Retraining toggle state
  const [showRetrainPanel, setShowRetrainPanel] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyCorrections, setHistoryCorrections] = useState({});
  
  const wsRef = useRef(null);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const connectWebSocket = () => {
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
        imuMag: Math.sqrt(raw.imu.ax**2 + raw.imu.ay**2 + raw.imu.az**2),
      };

      setDataBuffer((prev) => {
        const newBuf = [...prev, point];
        if (newBuf.length > 50) newBuf.shift(); // keep last 50 points
        return newBuf;
      });

      setLatestState({ raw, ml });

      if (ml.status === 'calibrating') {
        setIsCalibrating(true);
        setCalibrationProgress(ml.progress * 100);
      } else {
        setIsCalibrating(false);
      }
    };

    wsRef.current.onerror = (err) => {
      console.error("WS error:", err);
    };

    wsRef.current.onclose = () => {
      setTimeout(connectWebSocket, 3000); // Reconnect
    };
  };

  const toggleStress = async () => {
    const newState = !stressActive;
    try {
      await fetch(`${API_BASE_URL}/stress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: newState })
      });
      setStressActive(newState);
    } catch (e) {
      console.error(e);
    }
  };

  const startBaseline = async () => {
    try {
      await fetch(`${API_BASE_URL}/baseline`, { method: "POST" });
      setIsCalibrating(true);
      setCalibrationProgress(0);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/history`);
      const data = await res.json();
      setHistoryData(data.reverse()); // latest first
      setHistoryCorrections({});
    } catch (e) {
      console.error(e);
    }
    setHistoryLoading(false);
  };

  const handleTogglePanel = () => {
    if (!showRetrainPanel) {
        fetchHistory();
    }
    setShowRetrainPanel(!showRetrainPanel);
  };

  const setCorrection = (index, label) => {
    setHistoryCorrections(prev => ({ ...prev, [index]: label }));
  };

  const submitRetrain = async () => {
    const samplesToTrain = [];
    Object.keys(historyCorrections).forEach(idx => {
      const item = historyData[idx];
      samplesToTrain.push({
        features: item.features,
        label: historyCorrections[idx]
      });
    });

    if(samplesToTrain.length === 0) return;

    try {
      await fetch(`${API_BASE_URL}/train`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ samples: samplesToTrain })
      });
      setHistoryCorrections({});
      fetchHistory();
      alert(`Model successfully retrained on ${samplesToTrain.length} samples!`);
    } catch (e) {
      console.error(e);
      alert("Error retraining model.");
    }
  };

  const stressScore = latestState?.ml?.stress_score || 0;
  const isStressed = stressScore > 75;

  let scoreColor = "text-green-500";
  let dropShadow = "drop-shadow-[0_0_15px_rgba(34,197,94,0.5)]";
  if (stressScore > 40) {
    scoreColor = "text-yellow-500";
    dropShadow = "drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]";
  }
  if (stressScore > 75) {
    scoreColor = "text-red-500";
    dropShadow = "drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]";
  }

  return (
    <div className="min-h-screen bg-slate-900 p-8 flex flex-col gap-8 font-sans">
      
      {/* Header & Alert */}
      <div className={`p-6 rounded-2xl flex items-center justify-between transition-all duration-500 shadow-lg ${isStressed ? 'bg-red-900/40 border border-red-500/50' : 'bg-slate-800'}`}>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Activity className={isStressed ? 'animate-pulse text-red-500' : 'text-blue-400'} />
            Smart Vest Monitor
          </h1>
          <p className="text-slate-400 mt-1">Real-time Physiological telemetry</p>
        </div>
        
        <div className="flex flex-col items-end">
          <span className="text-sm text-slate-400 mb-1 uppercase tracking-wider font-semibold">Stress Score</span>
          {isCalibrating ? (
             <div className="flex items-center gap-3">
                <Loader2 className="animate-spin text-blue-400" />
                <span className="text-2xl font-bold text-blue-400">{calibrationProgress.toFixed(0)}%</span>
             </div>
          ) : (
             <div className={`text-5xl lg:text-6xl font-black ${scoreColor} ${dropShadow} transition-colors`}>
               {stressScore.toFixed(0)}
             </div>
          )}
        </div>
      </div>

      {isStressed && !isCalibrating && (
        <div className="bg-red-500/20 text-red-200 p-4 rounded-lg flex items-center gap-4 animate-bounce border border-red-500/50">
          <AlertTriangle className="text-red-500" />    
          <h2 className="font-bold text-lg">High Stress Detected! Intervene immediately.</h2>
        </div>
      )}

      {/* Grid of Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-grow">
        <ChartCard title="GSR (Galvanic Skin Response)" data={dataBuffer} dataKey="gsr" color="#3b82f6" />
        <ChartCard title="Heart Rate (BPM)" data={dataBuffer} dataKey="hr" color="#ef4444" domain={['dataMin - 5', 'dataMax + 5']} />
        <ChartCard title="IMU Magnitude" data={dataBuffer} dataKey="imuMag" color="#8b5cf6" />
        <ChartCard title="Respiration Waveform" data={dataBuffer} dataKey="respiration" color="#10b981" />
      </div>

      {/* Controls */}
      <div className="bg-slate-800 p-6 rounded-2xl flex gap-4 shadow-lg border border-slate-700">
        <button 
          onClick={startBaseline}
          disabled={isCalibrating}
          className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex justify-center items-center gap-2"
        >
          {isCalibrating ? <Loader2 className="animate-spin" /> : <PlaySquare />}
          Start 30s Baseline
        </button>
        
        <button 
          onClick={toggleStress}
          className={`flex-1 font-semibold py-3 px-6 rounded-lg transition-colors flex justify-center items-center gap-2
            ${stressActive ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
        >
          <AlertTriangle size={18} />
          {stressActive ? 'Deactivate Stress Event' : 'Inject Stress Event'}
        </button>
      </div>

      {/* Retraining Panel Toggle */}
      <div className="bg-slate-800 rounded-2xl shadow-lg border border-slate-700 overflow-hidden">
        <button 
          onClick={handleTogglePanel}
          className="w-full flex justify-between items-center p-6 hover:bg-slate-700/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Activity className="text-purple-400" />
            <h2 className="text-xl font-bold text-slate-200">Model Feedback & Retraining</h2>
          </div>
          {showRetrainPanel ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
        </button>
        
        {showRetrainPanel && (
          <div className="p-6 border-t border-slate-700 bg-slate-800/50">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-slate-400">Review recent predictions (last {historyData.length}). Mark corrections and submit to incrementally retrain the model.</p>
              <button onClick={fetchHistory} disabled={historyLoading} className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-2">
                  {historyLoading && <Loader2 size={14} className="animate-spin" />}
                  Refresh List
              </button>
            </div>

            <div className="bg-slate-900 rounded-lg overflow-x-auto max-h-64 overflow-y-auto mb-4 border border-slate-700">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-800 text-slate-400 sticky top-0">
                  <tr>
                    <th className="p-3 font-semibold">Time</th>
                    <th className="p-3 font-semibold">Score</th>
                    <th className="p-3 font-semibold">Prediction</th>
                    <th className="p-3 font-semibold">Provide Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.length === 0 ? (
                      <tr><td colSpan="4" className="p-4 text-center text-slate-500">No history available yet.</td></tr>
                  ) : historyData.map((item, idx) => {
                    const currentLabel = historyCorrections[idx] !== undefined ? historyCorrections[idx] : item.label;
                    const isEdited = historyCorrections[idx] !== undefined && historyCorrections[idx] !== item.label;
                    
                    return (
                      <tr key={idx} className={`border-t border-slate-800 ${isEdited ? 'bg-indigo-900/20' : ''}`}>
                        <td className="p-3 font-mono text-xs">{new Date(item.timestamp).toLocaleTimeString()}</td>
                        <td className="p-3">{item.stress_score}%</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${item.label === 1 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                              {item.label === 1 ? 'Stress' : 'Calm'}
                          </span>
                        </td>
                        <td className="p-3 flex gap-2">
                          <button 
                              onClick={() => setCorrection(idx, 0)}
                              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${currentLabel === 0 ? 'bg-green-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                          >
                              {currentLabel === 0 && <Check size={12}/>} Calm
                          </button>
                          <button 
                              onClick={() => setCorrection(idx, 1)}
                              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${currentLabel === 1 ? 'bg-red-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                          >
                              {currentLabel === 1 && <Check size={12}/>} Stress
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <button 
                  disabled={Object.keys(historyCorrections).length === 0}
                  onClick={submitRetrain}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-2 px-6 rounded transition-colors"
              >
                  Execute Retraining ({Object.keys(historyCorrections).length} samples)
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

function ChartCard({ title, data, dataKey, color, domain=['auto', 'auto'] }) {
  return (
    <div className="bg-slate-800 p-5 rounded-2xl shadow-lg border border-slate-700 flex flex-col">
      <h3 className="text-slate-300 font-semibold mb-4">{title}</h3>
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tick={{fill: '#94a3b8'}} tickMargin={10} minTickGap={30} />
            <YAxis stroke="#94a3b8" fontSize={12} tick={{fill: '#94a3b8'}} domain={domain} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }}
              itemStyle={{ color: color }}
            />
            <Line 
              type="monotone" 
              dataKey={dataKey} 
              stroke={color} 
              strokeWidth={3}
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
