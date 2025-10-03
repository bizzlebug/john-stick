import React, { useState, useEffect } from 'react';

interface DuelsLobbyProps {
  onBack: () => void;
  onJoinQueue: () => void;
  wsConnected: boolean;
  serverStatus: {
    queueLength: number;
    activeMatches: number;
    connectedPlayers: number;
  } | null;
}

export const DuelsLobby: React.FC<DuelsLobbyProps> = ({
  onBack,
  onJoinQueue,
  wsConnected,
  serverStatus
}) => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center backdrop-blur-md z-50">
      <div className="bg-indigo-950 border border-red-500 rounded-2xl p-8 max-w-2xl w-full shadow-2xl shadow-red-500/20">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-pink-500 to-purple-500 mb-2">
            ⚔️ DUELS LOBBY
          </h1>
          <p className="text-gray-400 text-lg">
            Competitive 1v1 Survival Battle
          </p>
        </div>

        {/* Connection Status */}
        <div className="mb-6">
          <div className="flex items-center justify-between bg-gray-800/50 rounded-lg p-4 border-2 border-gray-700">
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-white font-semibold">
                {wsConnected ? 'Connected to Server' : 'Connecting' + dots}
              </span>
            </div>
            {wsConnected && (
              <span className="text-green-400 text-sm">✓ Ready</span>
            )}
          </div>
        </div>

        {/* Server Stats */}
        {wsConnected && serverStatus && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-gradient-to-br from-cyan-900/50 to-cyan-950/50 border-2 border-cyan-600 rounded-lg p-4 text-center">
              <div className="text-cyan-400 text-3xl font-bold mb-1">
                {serverStatus.connectedPlayers}
              </div>
              <div className="text-cyan-300 text-sm">Players Online</div>
            </div>
            
            <div className="bg-gradient-to-br from-yellow-900/50 to-yellow-950/50 border-2 border-yellow-600 rounded-lg p-4 text-center">
              <div className="text-yellow-400 text-3xl font-bold mb-1">
                {serverStatus.queueLength}
              </div>
              <div className="text-yellow-300 text-sm">In Queue</div>
            </div>
            
            <div className="bg-gradient-to-br from-purple-900/50 to-purple-950/50 border-2 border-purple-600 rounded-lg p-4 text-center">
              <div className="text-purple-400 text-3xl font-bold mb-1">
                {serverStatus.activeMatches}
              </div>
              <div className="text-purple-300 text-sm">Active Matches</div>
            </div>
          </div>
        )}

        {/* Game Rules */}
        <div className="bg-gray-800/30 border-2 border-gray-700 rounded-lg p-4 mb-6">
          <h3 className="text-white font-bold text-lg mb-3 flex items-center gap-2">
            <span>📜</span> How It Works
          </h3>
          <ul className="text-gray-300 text-sm space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-red-500 font-bold">•</span>
              <span>Kill enemies in your game to send them to your opponent</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 font-bold">•</span>
              <span>Stronger enemies = more basic enemies sent to opponent</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 font-bold">•</span>
              <span>Enemies from opponent appear with a red glow</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 font-bold">•</span>
              <span>Last player standing wins. First to die loses!</span>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={onBack}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg text-xl transition-all transform hover:scale-105"
          >
            ← Back
          </button>
          
          <button
            onClick={onJoinQueue}
            disabled={!wsConnected}
            className={`flex-1 font-bold py-4 px-6 rounded-lg text-xl transition-all transform hover:scale-105 ${
              wsConnected
                ? 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white shadow-lg shadow-red-500/50'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            {wsConnected ? '🎮 Find Match' : 'Connecting...'}
          </button>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-gray-500 text-sm">
          {wsConnected ? (
            <p>Click "Find Match" to enter the matchmaking queue</p>
          ) : (
            <p>Establishing connection to duels server{dots}</p>
          )}
        </div>
      </div>
    </div>
  );
};