

import React, { useState } from 'react';

interface GameOverOverlayProps {
  onRestart: () => void;
  onExit: () => void;
  stats: { kills: number; wave: number; time: number; coins: number; };
  onScoreSubmit: (name: string) => void;
  submitted: boolean;
}

const PROFANITY_LIST = ['shit', 'fuck', 'bitch', 'cunt', 'asshole', 'damn', 'hell', 'piss', 'cock', 'pussy', 'dick', 'faggot', 'nigger', 'slut', 'whore'];

const isProfane = (text: string): boolean => {
    const lowerText = text.toLowerCase().replace(/[^a-z0-9]/gi, '');
    if (!lowerText) return false;
    const sanitizedText = lowerText.replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/0/g, 'o').replace(/@/g, 'a');
    return PROFANITY_LIST.some(word => sanitizedText.includes(word));
};

export const GameOverOverlay: React.FC<GameOverOverlayProps> = ({ onRestart, onExit, stats, onScoreSubmit, submitted }) => {
  const [name, setName] = useState('Gunner');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isProfane(name)) {
        setError('Please choose a different name.');
        return;
    }
    setError(null);
    onScoreSubmit(name || 'Gunner');
  };
  
  return (
    <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center backdrop-blur-md z-20">
      <div className="bg-indigo-950 border border-fuchsia-800 rounded-2xl p-10 text-center shadow-2xl shadow-fuchsia-500/20 text-white w-full max-w-md">
        <h1 className="text-5xl font-bold mb-4 text-fuchsia-500">Game Over</h1>
        <div className="text-lg text-gray-300 mb-8 space-y-2">
            <p>Kills: <span className="font-bold text-cyan-400">{stats.kills}</span></p>
            <p>Wave: <span className="font-bold text-cyan-400">{stats.wave}</span></p>
            <p>Time: <span className="font-bold text-cyan-400">{Math.floor(stats.time)}s</span></p>
            <p>Golden Coins: <span className="font-bold text-cyan-400">💰 {stats.coins}</span></p>
        </div>
        {submitted ? (
          <>
            <p className="text-lg text-green-400 mb-6">Score Submitted!</p>
            <div className="flex justify-center items-center gap-4">
              <button onClick={onRestart} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-8 rounded-lg text-xl transition-transform transform hover:scale-105">
                Restart
              </button>
              <button onClick={onExit} className="bg-fuchsia-700 hover:bg-fuchsia-600 text-white font-bold py-3 px-8 rounded-lg text-xl transition-transform transform hover:scale-105">
                Exit
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name-input" className="block text-lg text-gray-300 mb-2">Enter Name for Leaderboard</label>
              <input
                id="name-input"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                maxLength={12}
                className="w-full bg-gray-800 border border-indigo-600 text-white text-center text-xl p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-400"
                autoFocus
              />
            </div>
            {error && <p className="text-red-500 text-sm -mt-2 pb-2">{error}</p>}
            <button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-8 rounded-lg text-xl transition-transform transform hover:scale-105 w-full">
              Submit Score
            </button>
          </form>
        )}
      </div>
    </div>
  );
};