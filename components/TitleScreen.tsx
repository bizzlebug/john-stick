import React, { useState, useEffect } from 'react';
import type { Score } from '../types';

interface TitleScreenProps {
  onStart: () => void;
  onShowInfo: () => void;
  onShowUpgrades: () => void;
  onShowChangelog: () => void;
  onStartDuels: () => void;  // ✅ Add this line
  scores: Score[];
  loading: boolean;
  online: boolean;
}

const fmtTime = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export const TitleScreen: React.FC<TitleScreenProps> = ({ onStart, onShowInfo, onShowUpgrades, onShowChangelog, onStartDuels, scores, loading, online }) => {
  const [showDuelsToast, setShowDuelsToast] = useState(false);

  useEffect(() => {
    let timer: number;
    if (showDuelsToast) {
      timer = window.setTimeout(() => {
        setShowDuelsToast(false);
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [showDuelsToast]);

 // const handleDuelsClick = () => {
 //   setShowDuelsToast(true);
 // };
  
  const rainDrops = React.useMemo(() => {
    return Array.from({ length: 150 }).map((_, i) => {
      const style = {
        left: `${Math.random() * 100}%`,
        width: `${1 + Math.random() * 2}px`,
        height: `${60 + Math.random() * 60}px`,
        animationDuration: `${0.6 + Math.random() * 0.6}s`,
        animationDelay: `${Math.random() * 5}s`,
        opacity: `${0.2 + Math.random() * 0.5}`,
      };
      return <div key={i} className="drop" style={style}></div>;
    });
  }, []);
  
  const rankColors = [
    'text-yellow-400', // 1st
    'text-gray-300',   // 2nd
    'text-orange-400'  // 3rd
  ];

  return (
    <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center backdrop-blur-md z-20">
      <div className="rain fixed top-0 left-0 w-full h-full pointer-events-none">
        {rainDrops}
      </div>
      
      <div className="bg-indigo-950 border border-fuchsia-800 rounded-2xl p-8 text-center shadow-2xl shadow-fuchsia-500/20 text-white w-full max-w-4xl relative">
        
        <h1 className="pixel-title my-8">
          <span style={{paddingRight: '1ch'}}>JOHN</span>
          <span>ST</span>
          <span className="wick-i-silhouette"></span>
          <span>CK</span>
        </h1>
        
        <div className="w-full h-1 border-t-4 border-b-2 border-black/30 my-8"></div>

        <div className="flex justify-center gap-4">
  <button onClick={onStart} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-8 rounded-lg text-xl transition-transform transform hover:scale-105">
    Start Game
  </button>
  
  {/* 👇 ADD THIS DUELS BUTTON */}
  <button onClick={onStartDuels} className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-8 rounded-lg text-xl transition-transform transform hover:scale-105">
    🔥 Duels
  </button>
  {/* 👆 END OF DUELS BUTTON */}
  
  <button onClick={onShowUpgrades} className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold py-3 px-8 rounded-lg text-xl transition-transform transform hover:scale-105">
    Upgrades
  </button>
  <button onClick={onShowInfo} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-8 rounded-lg text-xl transition-transform transform hover:scale-105">
    Game Info
  </button>
</div>
        <h2 className="text-2xl font-semibold mt-8 mb-4">
            {online ? 'Online Leaderboard' : 'High Scores'}
            {!online && !loading && <span className="text-sm text-gray-500 ml-2">(Offline)</span>}
        </h2>
        <div className="text-left bg-black/30 border border-indigo-800 rounded-lg p-2 max-h-64 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-500 min-h-[14rem]">Loading...</div>
          ) : scores.length === 0 ? (
            <p className="text-gray-500 text-center py-4 min-h-[14rem] flex items-center justify-center">No scores yet. Play a run!</p>
          ) : (
            scores.slice(0, 10).map((s, i) => (
              <div key={i} className="flex justify-between items-center py-3 px-3 my-1 border-b border-indigo-900/50 last:border-b-0 transition-colors hover:bg-indigo-800/30 rounded-lg">
                <div className="flex items-center gap-4">
                  <span className={`font-bold w-8 text-center text-2xl ${rankColors[i] || 'text-gray-500'}`}>{i + 1}.</span>
                  <div>
                    <div className={`font-semibold text-lg ${rankColors[i] || 'text-gray-100'}`}>{s.hero}</div>
                    <div className="text-gray-400 text-xs flex items-center gap-3 mt-1">
                      <span><span className="text-gray-500">Wave:</span> {s.wave}</span>
                      <span><span className="text-gray-500">Kills:</span> {s.kills}</span>
                      <span><span className="text-gray-500">Time:</span> {fmtTime(s.time)}</span>
                    </div>
                  </div>
                </div>
                <div className={`font-bold text-2xl ${rankColors[i] || 'text-cyan-400'}`}>{s.score.toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
        <div className="mt-4 text-center">
            <a href="https://discord.gg/yFmaJVYdG5" target="_blank" rel="noopener noreferrer" className="text-lg text-indigo-300 hover:text-indigo-200 underline transition-colors">
                Join our Discord!
            </a>
        </div>
        <p className="text-gray-300 mt-2 text-xs">
          Tip: Duels mode coming soon, get ready for some PvP action!
          <button onClick={onShowChangelog} className="ml-4 underline hover:text-white focus:outline-none focus:text-white">
            Alpha 0.225
          </button>
        </p>
      </div>
      {showDuelsToast && (
        <div className="toast-notification absolute bottom-24 left-1/2 -translate-x-1/2 bg-gray-800 text-white py-2 px-4 rounded-lg shadow-lg border border-fuchsia-500">
          Duels mode coming soon! Server connection needed.
        </div>
      )}
    </div>
  );
};