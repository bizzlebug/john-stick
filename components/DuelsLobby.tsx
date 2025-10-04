import React, { useState, useEffect } from 'react';

// Custom Popup Component
interface CustomPopupProps {
  title: string;
  message: string;
  type?: 'info' | 'success' | 'error' | 'warning';
  onClose: () => void;
  buttons?: {
    text: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'danger';
  }[];
}

const CustomPopup: React.FC<CustomPopupProps> = ({ 
  title, 
  message, 
  type = 'info',
  onClose, 
  buttons = [{ text: 'OK', onClick: onClose, variant: 'primary' }]
}) => {
  const typeStyles = {
    info: 'border-cyan-500 bg-cyan-950',
    success: 'border-green-500 bg-green-950',
    error: 'border-red-500 bg-red-950',
    warning: 'border-yellow-500 bg-yellow-950'
  };

  const typeIcons = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warning: '⚠️'
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className={`relative w-full max-w-md mx-4 ${typeStyles[type]} border-4 rounded-xl shadow-2xl p-6`}
           style={{ animation: 'scaleIn 0.2s ease-out' }}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-4 pb-4 border-b-2 border-white/20">
          <span className="text-3xl">{typeIcons[type]}</span>
          <h2 className="text-2xl font-bold text-white">{title}</h2>
        </div>

        {/* Message */}
        <p className="text-white text-lg mb-6 leading-relaxed">{message}</p>

        {/* Buttons */}
        <div className="flex gap-3 justify-end">
          {buttons.map((btn, idx) => {
            const variantStyles = {
              primary: 'bg-cyan-600 hover:bg-cyan-500 border-cyan-400',
              secondary: 'bg-gray-600 hover:bg-gray-500 border-gray-400',
              danger: 'bg-red-600 hover:bg-red-500 border-red-400'
            };
            
            return (
              <button
                key={idx}
                onClick={btn.onClick}
                className={`${variantStyles[btn.variant || 'primary']} text-white font-bold py-2 px-6 rounded-lg border-2 transition-all transform hover:scale-105 active:scale-95`}
              >
                {btn.text}
              </button>
            );
          })}
        </div>
      </div>
      <style>{`
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
};

// Main DuelsLobby Component
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
  const [isSearching, setIsSearching] = useState(false);
  const [popup, setPopup] = useState<{
    title: string;
    message: string;
    type: 'info' | 'success' | 'error' | 'warning';
    buttons?: any[];
  } | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const handleJoinQueue = () => {
    if (!wsConnected) {
      setPopup({
        title: 'Connection Error',
        message: 'Not connected to server! Please try again.',
        type: 'error'
      });
      return;
    }

    setIsSearching(true);
    onJoinQueue();
  };

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
            onClick={handleJoinQueue}
            disabled={!wsConnected || isSearching}
            className={`flex-1 font-bold py-4 px-6 rounded-lg text-xl transition-all transform ${
              !isSearching ? 'hover:scale-105' : ''
            } ${
              isSearching
                ? 'bg-orange-600 border-4 border-orange-400 cursor-wait'
                : wsConnected
                ? 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 shadow-lg shadow-red-500/50'
                : 'bg-gray-600 cursor-not-allowed'
            } text-white relative overflow-hidden`}
          >
            {isSearching ? (
              <span className="flex items-center justify-center gap-3">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle 
                    className="opacity-25" 
                    cx="12" 
                    cy="12" 
                    r="10" 
                    stroke="currentColor" 
                    strokeWidth="4"
                    fill="none"
                  />
                  <path 
                    className="opacity-75" 
                    fill="currentColor" 
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Searching...
              </span>
            ) : (
              '🎮 Find Match'
            )}
            
            {/* Animated shimmer when searching */}
            {isSearching && (
              <div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                style={{ animation: 'shimmer 2s infinite' }}
              />
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-gray-500 text-sm">
          {isSearching ? (
            <p>Searching for an opponent{dots}</p>
          ) : wsConnected ? (
            <p>Click "Find Match" to enter the matchmaking queue</p>
          ) : (
            <p>Establishing connection to duels server{dots}</p>
          )}
        </div>
      </div>

      {/* Custom Popup */}
      {popup && (
        <CustomPopup
          title={popup.title}
          message={popup.message}
          type={popup.type}
          onClose={() => setPopup(null)}
          buttons={popup.buttons}
        />
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};