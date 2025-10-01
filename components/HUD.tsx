import React from 'react';
import type { HudData } from '../types';

interface HUDProps {
  data: HudData;
}

const StatBar: React.FC<{ value: number; max: number; colorClass: string; children: React.ReactNode }> = ({ value, max, colorClass, children }) => (
    <div className="relative w-full h-4 bg-slate-900/50 rounded-full overflow-hidden border border-black/20" style={{boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)'}}>
        <div
            className={`${colorClass} h-full transition-all duration-200 ease-out`}
            style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }}
        ></div>
        <div className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-mono font-bold" style={{textShadow: '1px 1px 1px #000'}}>
            {children}
        </div>
    </div>
);

const SkillTile: React.FC<{ label: string; cooldown: number; maxCooldown: number; children?: React.ReactNode; }> = ({ label, cooldown, maxCooldown, children }) => {
  const onCooldown = cooldown > 0;
  const progress = onCooldown ? cooldown / maxCooldown : 0;

  return (
    <div className={`skill relative w-12 h-12 bg-gray-200 border border-gray-400 rounded-md shadow-md flex flex-col items-center justify-end pb-1 text-black ${onCooldown ? 'on-cd' : ''}`}>
      {children}
      <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
      {onCooldown && (
        <div 
          className="cd-overlay absolute inset-0 rounded-sm flex items-center justify-center text-white text-sm font-bold"
          style={{ '--p': progress } as React.CSSProperties}
        >
          {cooldown > 0.1 ? cooldown.toFixed(1) : ''}
        </div>
      )}
    </div>
  );
};


export const HUD: React.FC<HUDProps> = ({ data }) => {
  const textShadow = {textShadow: '1px 1px 2px rgba(0,0,0,0.7)'};
  return (
    <>
      <div className="absolute top-2 left-0 right-0 p-2 pointer-events-none z-10">
        <div className="max-w-md mx-auto flex items-center justify-between gap-2 bg-indigo-950/80 backdrop-blur-sm p-1.5 rounded-lg border border-white/10 shadow-2xl">
          
          {/* Left Side Stats */}
          <div className="flex-grow flex items-center gap-2 text-white">
            <div className="text-center w-10 flex-shrink-0">
              <div className="font-bold text-xs leading-none text-gray-300" style={textShadow}>LV</div>
              <div className="font-black text-xl leading-tight" style={textShadow}>{data.level}</div>
            </div>
            <div className="flex-grow space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-fuchsia-400 w-5" style={textShadow}>HP</span>
                <StatBar value={data.hp} max={data.hpMax} colorClass="bg-fuchsia-600">
                  {`${Math.ceil(data.hp)} / ${data.hpMax}`}
                </StatBar>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-cyan-400 w-5" style={textShadow}>XP</span>
                <StatBar value={data.xp} max={data.xpNext} colorClass="bg-cyan-500">
                  {`${Math.floor(data.xp)} / ${Math.floor(data.xpNext)}`}
                </StatBar>
              </div>
            </div>
          </div>

          {/* Right Side Skills */}
          <div className="flex gap-1.5 pointer-events-auto">
            <SkillTile label="Dodge" cooldown={data.jumpCooldown} maxCooldown={data.jumpCDBase} />
            <SkillTile label="Reload" cooldown={data.reloadT} maxCooldown={data.reloadTime}>
              <div className={`absolute inset-0 flex items-center justify-center font-black text-xl text-gray-800 ${data.reloading ? 'opacity-20' : ''}`}>
                {data.ammo}
              </div>
            </SkillTile>
          </div>
        </div>
      </div>
      
      {data.bossData && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 pointer-events-none z-10">
            <div className="text-center mb-2">
                <h2 className="text-3xl font-bold text-fuchsia-400" style={{textShadow: '2px 2px 2px #000'}}>{data.bossData.bigBossInfo?.name}</h2>
                <p className="text-lg text-gray-300" style={{textShadow: '1px 1px 1px #000'}}>{data.bossData.bigBossInfo?.title}</p>
            </div>
            <div className="relative w-full h-6 bg-slate-900/70 rounded-full overflow-hidden border-2 border-fuchsia-900/50" style={{boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)'}}>
                <div
                    className="bg-fuchsia-600 h-full transition-all duration-200 ease-out"
                    style={{ width: `${Math.max(0, Math.min(100, (data.bossData.hp / data.bossData.hpMax) * 100))}%` }}
                ></div>
                <div className="absolute inset-0 flex items-center justify-center text-white text-sm font-mono font-bold" style={{textShadow: '1px 1px 1px #000'}}>
                    {`${Math.ceil(data.bossData.hp)} / ${data.bossData.hpMax}`}
                </div>
            </div>
        </div>
      )}
    </>
  );
};