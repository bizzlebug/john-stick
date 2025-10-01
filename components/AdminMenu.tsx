import React from 'react';
import { EVOLUTIONS } from '../constants';

interface AdminMenuProps {
  onClose: () => void;
  onUnlockEvolution: (evoId: string) => void;
  onGainXp: () => void;
  onGainCoins: () => void;
  onGiveAllItems: () => void;
  onToggleGodMode: () => void;
  isGodMode: boolean;
  onSpawnBigBoss: () => void;
  onPostPatchNotes: () => void;
}

export const AdminMenu: React.FC<AdminMenuProps> = ({
  onClose,
  onUnlockEvolution,
  onGainXp,
  onGainCoins,
  onGiveAllItems,
  onToggleGodMode,
  isGodMode,
  onSpawnBigBoss,
  onPostPatchNotes,
}) => {
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-900/90 border border-yellow-500 rounded-lg p-6 shadow-2xl text-white w-full max-w-lg z-50">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-yellow-400">Admin Panel</h2>
        <button onClick={onClose} className="bg-red-600 hover:bg-red-500 text-white font-bold py-1 px-3 rounded-md">&times;</button>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Evolutions</h3>
          <div className="flex flex-col gap-2">
            {EVOLUTIONS.map(evo => (
              <button key={evo.id} onClick={() => onUnlockEvolution(evo.id)} className="bg-blue-600 hover:bg-blue-500 text-white text-sm py-2 px-4 rounded-md text-left">
                Unlock {evo.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">Cheats</h3>
          <div className="flex flex-col gap-2">
            <button onClick={onGainXp} className="bg-green-600 hover:bg-green-500 text-white text-sm py-2 px-4 rounded-md">
              Gain 10k XP
            </button>
             <button onClick={onToggleGodMode} className={`text-white text-sm py-2 px-4 rounded-md ${isGodMode ? 'bg-purple-700 hover:bg-purple-600' : 'bg-gray-600 hover:bg-gray-500'}`}>
              God Mode: {isGodMode ? 'ON' : 'OFF'}
            </button>
            <button onClick={onGiveAllItems} className="bg-yellow-600 hover:bg-yellow-500 text-white text-sm py-2 px-4 rounded-md">
              Give Best Items
            </button>
            <button onClick={onGainCoins} className="bg-yellow-500 hover:bg-yellow-400 text-black text-sm py-2 px-4 rounded-md">
              Gain 1000 Coins
            </button>
            <button onClick={onSpawnBigBoss} className="bg-red-700 hover:bg-red-600 text-white text-sm py-2 px-4 rounded-md">
              Spawn Big Boss
            </button>
            <button onClick={onPostPatchNotes} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm py-2 px-4 rounded-md">
              Post Patch Notes
            </button>
          </div>
        </div>
      </div>
       <p className="text-xs text-gray-500 mt-4 text-center">Press Ctrl+Alt+D to close. Game is paused.</p>
    </div>
  );
};
