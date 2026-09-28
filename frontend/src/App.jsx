import React, { useState } from 'react';
import { ShareComponent } from './components/ShareComponent';
import { UserStatsCard } from './components/UserStatsCard';
import { 
  Sparkles, 
  Flame, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle, 
  AlertCircle,
  Play,
  Award
} from 'lucide-react';

export default function App() {
  const [demoUser, setDemoUser] = useState({
    id: 'user-demo-uuid-101',
    name: 'Alex Rivera',
    email: 'alex.rivera@example.com',
    referralCode: 'REF-X892A',
    token: ''
  });

  const [simulationResult, setSimulationResult] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [refereeId, setRefereeId] = useState('referee-user-202');

  // Trigger conversion action on backend to test end-to-end reward issuance
  const handleSimulateConversion = async () => {
    setSimulating(true);
    setSimulationResult(null);

    try {
      const res = await fetch('/api/actions/complete-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: refereeId,
          orderId: `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
          orderAmount: 99.99,
          clientIp: '192.168.1.50',
          deviceHash: `dev-${Math.random().toString(36).substring(7)}`
        })
      });

      const data = await res.json();
      setSimulationResult(data);
    } catch (err) {
      setSimulationResult({ success: false, error: err.message });
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start p-4 md:p-8 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Background Glow Accents */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-10 right-1/4 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-5xl space-y-8 relative z-10">
        {/* Header Bar */}
        <header className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 p-0.5 shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
                <Flame className="w-6 h-6 text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">VouchEngine</h1>
                <span className="px-2.5 py-0.5 text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full uppercase tracking-wider">
                  Day 3 Live
                </span>
              </div>
              <p className="text-xs text-slate-400">Viral Referral & Client-Side Sharing Engine</p>
            </div>
          </div>

          {/* User Badge */}
          <div className="flex items-center space-x-3 bg-slate-800/80 p-2.5 px-4 rounded-2xl border border-slate-700/60">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-xs text-white">
              AR
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-slate-200">{demoUser.name}</div>
              <div className="text-[11px] font-mono text-indigo-400 font-semibold">{demoUser.referralCode}</div>
            </div>
          </div>
        </header>

        {/* ── Task 3: Real-Time Supabase Statistics Component ────────────────── */}
        <section>
          <UserStatsCard userId={demoUser.id} token={demoUser.token} />
        </section>

        {/* ── Tasks 1 & 2: Client-Side Sharing & Dynamic QR Code Component ───── */}
        <section>
          <ShareComponent 
            referralCode={demoUser.referralCode} 
            userToken={demoUser.token} 
          />
        </section>

        {/* ── Bonus: Conversion Action Simulator ─────────────────────────────── */}
        <section className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-purple-600/20 text-purple-400 rounded-xl border border-purple-500/30">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Conversion Event Simulator</h3>
                <p className="text-xs text-slate-400">Trigger simulated qualifying action (POST /api/actions/complete-order)</p>
              </div>
            </div>

            <button
              onClick={handleSimulateConversion}
              disabled={simulating}
              className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/30 transition-all transform hover:-translate-y-0.5 disabled:opacity-50"
            >
              <Play className={`w-4 h-4 ${simulating ? 'animate-spin' : ''}`} />
              <span>{simulating ? 'Processing...' : 'Simulate Order Completion'}</span>
            </button>
          </div>

          {simulationResult && (
            <div className={`p-4 rounded-2xl border text-xs font-mono transition-all ${
              simulationResult.success 
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' 
                : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
            }`}>
              <div className="flex items-center space-x-2 font-bold mb-2">
                {simulationResult.success ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
                <span>{simulationResult.message || simulationResult.error}</span>
              </div>
              <pre className="overflow-x-auto p-2 bg-slate-950/80 rounded-lg text-[11px] text-slate-300">
                {JSON.stringify(simulationResult, null, 2)}
              </pre>
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="text-center text-xs text-slate-500 pt-4 pb-8">
          VouchEngine • Built with Node.js, Express, Supabase & React • Day 3 Complete
        </footer>
      </div>
    </div>
  );
}
