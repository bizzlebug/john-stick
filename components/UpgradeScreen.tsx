

import React from 'react';
import { META_UPGRADES } from '../constants';
import type { MetaState } from '../types';

interface UpgradeScreenProps {
  metaState: MetaState;
  onUpdateMetaState: (newState: MetaState) => void;
  onBack: () => void;
}

const formatEffect = (id: string, level: number): string => {
    if (level === 0) return 'No Bonus';

    const upgradeInfo = META_UPGRADES[id];
    const effect = upgradeInfo.effect(level);

    const key = Object.keys(effect)[0];
    const value = effect[key];

    switch (key) {
        case 'baseHpMaxAdd':
            return `+${value} Max HP`;
        case 'rerolls':
            return `+${value} Reroll${value > 1 ? 's' : ''}`;
        case 'banishes':
            return `+${value} Banish${value > 1 ? 'es' : ''}`;
        case 'baseXpMul':
            return `+${Math.round(value * 100)}% XP Gain`;
        case 'coinMul':
             return `+${Math.round(value * 100)}% Coins`;
        case 'baseDmgMul':
            return `+${Math.round(value * 100)}% Damage`;
        case 'baseDmgTakenMul':
            return `+${Math.round(Math.abs(value) * 100)}% Dmg Reduction`;
        case 'baseCritChanceAdd':
            return `+${Math.round(value * 100)}% Crit Chance`;
        case 'baseMoveSpdMul':
            return `+${Math.round(value * 100)}% Move Speed`;
        default:
            return '';
    }
}

const formatNextLevelEffect = (id: string, currentLevel: number): string => {
    const upgradeInfo = META_UPGRADES[id];
    if (currentLevel >= upgradeInfo.maxLevel) return '';

    const nextLevel = currentLevel + 1;
    const currentEffect = upgradeInfo.effect(currentLevel);
    const nextEffect = upgradeInfo.effect(nextLevel);

    const key = Object.keys(nextEffect)[0];
    const currentValue = currentEffect[key] || 0;
    const nextValue = nextEffect[key];

    const diff = nextValue - currentValue;

    switch (key) {
        case 'baseHpMaxAdd':
            return `+${diff} Max HP`;
        case 'rerolls':
            return `+${diff} Reroll`;
        case 'banishes':
            return `+${diff} Banish`;
        case 'baseXpMul':
            return `+${Math.round(diff * 100)}% XP Gain`;
        case 'coinMul':
             return `+${Math.round(diff * 100)}% Coins`;
        case 'baseDmgMul':
            return `+${Math.round(diff * 100)}% Damage`;
        case 'baseDmgTakenMul':
            return `+${Math.round(Math.abs(diff) * 100)}% Dmg Reduction`;
        case 'baseCritChanceAdd':
            return `+${Math.round(diff * 100)}% Crit Chance`;
        case 'baseMoveSpdMul':
            return `+${Math.round(diff * 100)}% Move Speed`;
        default:
            return '';
    }
}

const UpgradeCard: React.FC<{
  id: string;
  metaState: MetaState;
  onUpdateMetaState: (newState: MetaState) => void;
}> = ({ id, metaState, onUpdateMetaState }) => {
  const upgradeInfo = META_UPGRADES[id];
  if (!upgradeInfo) return null;

  const currentLevel = metaState.upgrades[id] || 0;
  const isMaxLevel = currentLevel >= upgradeInfo.maxLevel;
  const cost = isMaxLevel ? 0 : upgradeInfo.cost(currentLevel);
  const canAfford = metaState.coins >= cost;

  const handlePurchase = () => {
    if (canAfford && !isMaxLevel) {
      const newUpgrades = { ...metaState.upgrades, [id]: currentLevel + 1 };
      onUpdateMetaState({
        coins: metaState.coins - cost,
        upgrades: newUpgrades,
      });
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 flex flex-col justify-between">
      <div>
        <h3 className="text-xl font-bold text-yellow-400">{upgradeInfo.name}</h3>
        <p className="text-gray-300 text-sm mt-1 mb-2">{upgradeInfo.desc}</p>
        <p className="text-cyan-400 text-sm font-semibold mb-1">
            Current: {formatEffect(id, currentLevel)}
        </p>
        {!isMaxLevel && (
            <p className="text-green-400 text-sm font-semibold mb-3">
                Next: {formatNextLevelEffect(id, currentLevel)}
            </p>
        )}
      </div>
      <div className="flex items-center justify-between mt-auto pt-2">
        <span className="text-gray-400 font-semibold">
          Level: {currentLevel} / {upgradeInfo.maxLevel}
        </span>
        <button
          onClick={handlePurchase}
          disabled={!canAfford || isMaxLevel}
          className={`font-bold py-2 px-4 rounded-lg text-sm transition-colors ${
            isMaxLevel
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : canAfford
              ? 'bg-green-600 hover:bg-green-500 text-white'
              : 'bg-red-800 text-red-300 cursor-not-allowed'
          }`}
        >
          {isMaxLevel ? 'Maxed' : `💰 ${cost}`}
        </button>
      </div>
    </div>
  );
};


export const UpgradeScreen: React.FC<UpgradeScreenProps> = ({ metaState, onUpdateMetaState, onBack }) => {
  return (
    <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center backdrop-blur-sm z-30">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 shadow-2xl text-white w-full max-w-4xl h-[90vh]">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-4xl font-bold">Permanent Upgrades</h1>
            <p className="text-gray-400">Spend Golden Coins to improve your stats for all future runs.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-gray-900/50 border border-yellow-600 px-4 py-2 rounded-lg">
              <span className="text-yellow-400 font-bold text-2xl">💰 {metaState.coins.toLocaleString()}</span>
            </div>
            <button onClick={onBack} className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-6 rounded-lg text-lg">
                Back
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto h-[calc(100%-6rem)] pr-4">
            {Object.keys(META_UPGRADES).map(id => (
              <UpgradeCard key={id} id={id} metaState={metaState} onUpdateMetaState={onUpdateMetaState} />
            ))}
        </div>
      </div>
    </div>
  );
};