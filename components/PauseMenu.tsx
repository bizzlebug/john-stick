import React from 'react';
import type { Item, Weapon } from '../types';

interface PauseMenuProps {
  onResume: () => void;
  onRestart: () => void;
  onExit: () => void;
  gameInfo: { wave: number; kills: number; time: number; };
  perks: { name: string; lvl: number | string; effect: string; legendary?: boolean; }[];
  stats: [string, string | number][];
  items: Record<string, Item | null>;
  playerEvo: string | null;
  weapon: Weapon;
}

const RARITY_CLASSES: Record<string, string> = {
  white: 'text-gray-300',
  blue: 'text-cyan-400',
  purple: 'text-fuchsia-400',
  gold: 'text-yellow-400',
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

const StatItem: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="flex justify-between items-center py-1.5 border-b border-indigo-800 last:border-b-0">
    <span className="text-gray-300">{label}</span>
    <span className="font-semibold text-gray-100">{value}</span>
  </div>
);

export const PauseMenu: React.FC<PauseMenuProps> = ({ onResume, onRestart, onExit, gameInfo, perks, stats, items, playerEvo, weapon }) => {
  const evoName = playerEvo === 'railgun' ? 'Railgun'
                : playerEvo === 'smg' ? 'SMG Frenzy'
                : playerEvo === 'explosive' ? 'Explosive Rounds'
                : playerEvo;

  return (
    <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center backdrop-blur-md z-20">
      <div className="bg-indigo-950 border border-fuchsia-800 rounded-2xl p-8 shadow-2xl shadow-fuchsia-500/20 text-white w-full max-w-4xl">
        <h1 className="text-4xl font-bold mb-2 text-center">Paused</h1>
        <div className="text-gray-400 mb-6 text-center">{`Wave ${gameInfo.wave} · Kills ${gameInfo.kills} · Time ${Math.floor(gameInfo.time)}s`}</div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {/* Perks Column */}
          <div className="md:col-span-1">
            <h2 className="text-xl font-semibold mb-2">Perks</h2>
            <div className="bg-black/30 border border-indigo-700 rounded-lg p-3 max-h-80 overflow-y-auto">
              {playerEvo && <div className="flex justify-between py-1.5 border-b border-indigo-800 text-amber-400 font-bold"><span>Evolution</span><div className="flex items-center gap-3"><span>{evoName}</span><span className="bg-amber-400 text-amber-900 text-xs font-bold px-2 py-0.5 rounded-full">EVO</span></div></div>}
              {perks.map((p, i) => (
                <div key={i} className="flex justify-between items-center py-1 border-b border-indigo-800 last:border-b-0 text-xs">
                  <span className="text-gray-200 whitespace-nowrap">{p.name}</span>
                  <div className="flex items-center gap-2 text-right ml-2">
                    <span className="text-cyan-400 font-semibold text-right">{p.effect}</span>
                    <span className="bg-indigo-800 text-indigo-200 font-bold w-14 text-center px-2 py-0.5 rounded-full">Lv {p.lvl}</span>
                  </div>
                </div>
              ))}
              {perks.length === 0 && !playerEvo && <div className="text-gray-500 text-center py-4 text-sm">No perks yet.</div>}
            </div>
          </div>
          
          {/* Stats Column */}
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Weapon: {weapon.name} <span className="text-cyan-400">(Lvl {weapon.level})</span></h2>
              <div className="bg-black/30 border border-indigo-700 rounded-lg p-3 text-sm">
                <StatItem label="Damage" value={`${weapon.currentDmgMin}-${weapon.currentDmgMax}`} />
                <StatItem label="Fire Rate" value={`${(1 / weapon.currentAttackCD).toFixed(2)}/s`} />
                <StatItem label="Clip Size" value={weapon.currentClipSize} />
                <StatItem label="Reload Time" value={`${weapon.currentReloadTime.toFixed(2)}s`} />
                <StatItem label="Projectiles" value={weapon.currentProjCount} />
                <StatItem label="Pierce" value={weapon.currentProjPierce} />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2">Player Stats</h2>
              <div className="bg-black/30 border border-indigo-700 rounded-lg p-3 text-sm">
                {stats.map(([label, value], i) => <StatItem key={i} label={label} value={value} />)}
              </div>
            </div>
          </div>
        </div>
        
        <h2 className="text-xl font-semibold mt-6 mb-2 text-center">Items</h2>
        <div className="grid grid-cols-4 gap-4">
          {/* FIX: Explicitly type the item from Object.entries to resolve properties not existing on type 'unknown'. */}
          {Object.entries(items).map(([slot, item]: [string, Item | null]) => (
            <div key={slot}>
              <div className="text-sm text-gray-500 capitalize mb-1 text-center">{slot}</div>
              <div className="bg-black/30 border border-indigo-700 rounded-lg p-3 h-24 flex flex-col justify-center items-center">
                {item ? (
                  <div className="text-center">
                    <div className={`font-bold text-sm ${RARITY_CLASSES[item.rarity] || 'text-white'}`}>{item.name}</div>
                    <div className="text-xs text-gray-400 mt-1">{fmtMods(item.mods)}</div>
                  </div>
                ) : (
                  <div className="text-gray-600 text-sm">Empty</div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-center items-center gap-4">
            <button onClick={onResume} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-8 rounded-lg text-xl transition-transform transform hover:scale-105">
              Resume
            </button>
            <button onClick={onRestart} className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold py-3 px-8 rounded-lg text-xl transition-transform transform hover:scale-105">
              Restart
            </button>
            <button onClick={onExit} className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-8 rounded-lg text-xl transition-transform transform hover:scale-105">
              Exit
            </button>
        </div>
      </div>
    </div>
  );
};