import React from 'react';
import { ITEMS, EVOLUTIONS } from '../constants';
import type { Item } from '../types';

interface GameInfoOverlayProps {
  onClose: () => void;
}

const RARITY_CLASSES: Record<string, string> = {
  white: 'text-gray-300 border-gray-600',
  blue: 'text-cyan-400 border-cyan-800',
  purple: 'text-fuchsia-400 border-fuchsia-800',
  gold: 'text-yellow-400 border-yellow-800',
};

const fmtMods = (mods: Record<string, number> = {}) => {
  const out = [];
  if (mods.hpMaxAdd) out.push(`+${mods.hpMaxAdd} HP`);
  if (mods.atkCDMul) out.push(`+${Math.round((1 - mods.atkCDMul) * 100)}% Atk Spd`);
  if (mods.dmgTakenMul) out.push(`${Math.round((1 - mods.dmgTakenMul) * 100)}% DR`);
  if (mods.ricochetAdd) out.push(`${Math.round((mods.ricochetAdd || 0) * 100)}% Ricochet`);
  if (mods.dmgMultMul && mods.dmgMultMul !== 1) out.push(`+${Math.round((mods.dmgMultMul - 1) * 100)}% Damage`);
  if (mods.critChanceAdd) out.push(`+${Math.round((mods.critChanceAdd) * 100)}% Crit Chance`);
  if (mods.critDamageAdd) out.push(`+${Math.round((mods.critDamageAdd) * 100)}% Crit Damage`);
  if (mods.moveSpdMul && mods.moveSpdMul !== 1) out.push(`+${Math.round((mods.moveSpdMul - 1) * 100)}% Move Spd`);
  if (mods.dodgeCDMul && mods.dodgeCDMul !== 1) out.push(`-${Math.round((1 - mods.dodgeCDMul) * 100)}% Dodge CD`);
  return out.join(' • ');
};

const newEnemies = [
    { name: 'Healer', color: 'text-green-400', desc: 'Emits a healing aura, restoring health to all nearby enemies. A high-priority target!' },
    { name: 'Summoner', color: 'text-purple-400', desc: 'Stays at a distance and continuously spawns weak minions to swarm you.' },
    { name: 'Disabler', color: 'text-blue-400', desc: 'Fires sticky projectiles that slow your movement speed on hit, leaving you vulnerable.' },
];

const eliteEnemies = [
    { name: 'Hasted', color: 'text-yellow-400', desc: 'Moves and attacks significantly faster than normal enemies.' },
    { name: 'Shielded', color: 'text-blue-400', desc: 'Protected by a regenerating energy shield that must be depleted before health can be damaged.' },
    { name: 'Explosive Death', color: 'text-purple-400', desc: 'Detonates in a damaging explosion upon death. Keep your distance!' },
    { name: 'Life Leech', color: 'text-red-400', desc: 'Heals itself for a portion of the damage it deals to you.' },
];

const perkNames: Record<string, string> = {
    pierce: 'Piercing +1',
    spread: 'Tighter Spread',
    multishot: 'Multi-shot +2',
    critChance: 'Deadly Precision',
};

const evolutions = EVOLUTIONS.map(e => {
    const reqs = Object.entries(e.req).map(([perkId, level]) => `${perkNames[perkId] || perkId} (x${level})`).join(' + ');
    let desc = '';
    switch (e.id) {
        case 'railgun': desc = 'Transforms your weapon to fire a powerful, instantaneous beam that pierces through all enemies in a line.'; break;
        case 'smg': desc = 'Drastically increases fire rate and the number of projectiles fired with each shot, overwhelming enemies with a hail of bullets.'; break;
        case 'explosive': desc = 'Your projectiles now explode on impact, dealing area-of-effect damage to nearby enemies.'; break;
        case 'shotgun': desc = 'Converts your weapon into a shotgun, firing a wide cone of pellets. Devastating at close range, but projectiles disappear after a short distance.'; break;
        case 'chain': desc = 'Your projectiles consume pierce to arc between nearby enemies, dealing reduced damage with each jump.'; break;
    }
    return { name: e.name, reqs, desc };
});


export const GameInfoOverlay: React.FC<GameInfoOverlayProps> = ({ onClose }) => {
  // FIX: Added a return statement with JSX to complete the component and resolve the error.
  return (
    <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center backdrop-blur-md z-30">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 shadow-2xl text-white w-full max-w-4xl h-[90vh]">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-4xl font-bold">Game Info</h1>
            <button onClick={onClose} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-6 rounded-lg text-lg">
                Close
            </button>
        </div>
        <div className="space-y-8 overflow-y-auto h-[calc(100%-4rem)] pr-4">
          
          {/* Evolutions Section */}
          <div>
            <h2 className="text-2xl font-semibold mb-3 text-cyan-300">Weapon Evolutions</h2>
            <div className="space-y-4">
              {evolutions.map(e => (
                <div key={e.name} className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                  <h3 className="text-xl font-bold text-cyan-400">{e.name}</h3>
                  <p className="text-sm text-gray-400 mb-2">Requires: {e.reqs}</p>
                  <p className="text-gray-300">{e.desc}</p>
                </div>
              ))}
            </div>
          </div>
          
          {/* Items Section */}
          <div>
            <h2 className="text-2xl font-semibold mb-3 text-yellow-300">Items</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.values(ITEMS).map((item: Item) => (
                <div key={item.id} className={`bg-gray-900 border rounded-lg p-3 ${RARITY_CLASSES[item.rarity] || 'border-gray-600'}`}>
                  <h4 className="font-bold">{item.name} <span className="text-xs capitalize text-gray-500">({item.slot})</span></h4>
                  <p className="text-sm text-gray-400">{fmtMods(item.mods)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* New Enemies Section */}
          <div>
            <h2 className="text-2xl font-semibold mb-3 text-red-400">New Special Enemies</h2>
            <div className="space-y-3">
              {newEnemies.map(e => (
                <div key={e.name}>
                  <h4 className={`font-bold ${e.color}`}>{e.name}</h4>
                  <p className="text-sm text-gray-400">{e.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Elite Enemies Section */}
          <div>
            <h2 className="text-2xl font-semibold mb-3 text-fuchsia-400">Elite Enemy Modifiers</h2>
            <div className="space-y-3">
              {eliteEnemies.map(e => (
                <div key={e.name}>
                  <h4 className={`font-bold ${e.color}`}>{e.name}</h4>
                  <p className="text-sm text-gray-400">{e.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
