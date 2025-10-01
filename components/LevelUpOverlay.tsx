

import React from 'react';
import type { Perk } from '../types';

interface LevelUpOverlayProps {
  perks: Perk[];
  onReroll: () => void;
  rerollsLeft: number;
  onBanish: (perkId: string) => void;
  banishesLeft: number;
}

export const LevelUpOverlay: React.FC<LevelUpOverlayProps> = ({ perks, onReroll, rerollsLeft, onBanish, banishesLeft }) => {
  return (
    <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center backdrop-blur-md z-20">
      <div className="bg-indigo-950 border border-fuchsia-800 rounded-2xl p-8 text-center shadow-2xl shadow-fuchsia-500/20 text-white w-full max-w-4xl relative">
        <h1 className="text-5xl font-bold mb-2 text-cyan-300">Level Up!</h1>
        <p className="text-gray-400 mb-8 text-lg">Choose one upgrade</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {perks.map((p) => (
            <div key={p.id} className="relative">
              <button
                onClick={p.apply}
                className="w-full bg-indigo-800 hover:bg-indigo-700 border border-indigo-600 text-white p-6 rounded-lg text-left transition-all transform hover:scale-105 hover:border-cyan-400 h-full"
              >
                <h3 className="text-xl font-bold mb-2 text-cyan-400">{p.name}</h3>
                <p className="text-gray-300">{p.desc}</p>
              </button>
              {banishesLeft > 0 && (
                <button
                  onClick={() => onBanish(p.id)}
                  className="absolute -top-2 -right-2 bg-red-700 hover:bg-red-600 text-white font-bold w-7 h-7 rounded-full flex items-center justify-center text-xs border-2 border-indigo-950"
                  aria-label="Banish this perk for the rest of the run"
                  title="Banish this perk for the rest of the run"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex gap-4 items-center">
          {rerollsLeft > 0 && (
            <button
              onClick={onReroll}
              className="bg-teal-600 hover:bg-teal-500 text-white font-bold py-2 px-6 rounded-lg text-md transition-transform transform hover:scale-105"
            >
              Reroll ({rerollsLeft} left)
            </button>
          )}
          {banishesLeft > 0 && (
            <span className="text-md text-gray-300 bg-black/50 px-3 py-1 rounded-md">
              Banishes: {banishesLeft}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};