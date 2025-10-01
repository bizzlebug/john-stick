// FIX: Import useState, useRef, useCallback, and useEffect from React to resolve multiple errors.
import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { Player, Enemy, Projectile, Orb, Drop, FloatingText, Perk, Item, Score, HudData, GameState, Effect, Weapon, MetaState, BloodParticle, GorePiece, PlayerAfterimage } from './types';
import { GameStatus } from './types';
import { INITIAL_PLAYER_STATS, INITIAL_WEAPON, ITEMS, RARITY_RANK, BOSS_DROP, MINIBOSS_DROP, EVOLUTIONS, LOCAL_SCORE_KEY, GET_LEADERBOARD_URL, SUBMIT_SCORE_URL, META_STORAGE_KEY, META_UPGRADES, CHANGELOG_VERSIONS } from './constants';
import { TitleScreen } from './components/TitleScreen';
import { LevelUpOverlay } from './components/LevelUpOverlay';
import { GameOverOverlay } from './components/GameOverOverlay';
import { PauseMenu } from './components/PauseMenu';
import { HUD } from './components/HUD';
import { GameInfoOverlay } from './components/GameInfoOverlay';
import { UpgradeScreen } from './components/UpgradeScreen';
import { AdminMenu } from './components/AdminMenu';
import { ChangelogOverlay } from './components/ChangelogOverlay';


// A dummy weapon object to prevent crashes if the pause menu is rendered before the player's weapon is initialized.
const DUMMY_WEAPON: Weapon = {
    ...INITIAL_WEAPON,
    level: 0,
    ammo: 0,
    reloading: false,
    reloadT: 0,
    attackCooldown: 0,
    currentDmgMin: 0,
    currentDmgMax: 0,
    currentAttackCD: 1, // Must be non-zero to prevent division by zero errors.
    currentClipSize: 0,
    currentReloadTime: 0,
    currentProjCount: 0,
    currentProjSpeed: 0,
    currentProjSpread: 0,
    currentProjPierce: 0,
};

// --- Utility Functions ---
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const rand = (a: number, b: number) => a + Math.random() * (b - a);

type Capsule = { x: number; y: number; r: number; hitboxHeight: number };
type Circle = { x: number; y: number; r: number };

// --- Collision Functions ---
const checkCapsuleCollision = (capsule: Capsule, circle: Circle): boolean => {
    const capsuleTopY = capsule.y - capsule.hitboxHeight / 2;
    const capsuleBottomY = capsule.y + capsule.hitboxHeight / 2;
    
    const closestY = Math.max(capsuleTopY, Math.min(circle.y, capsuleBottomY));
    
    const dx = capsule.x - circle.x;
    const dy = closestY - circle.y;
    
    const distSq = dx * dx + dy * dy;
    const combinedRadius = capsule.r + circle.r;
    
    return distSq < combinedRadius * combinedRadius;
};

const checkCapsuleCapsuleCollision = (c1: Capsule, c2: Capsule): {
    collided: boolean;
    overlap?: number;
    normal?: { x: number; y: number };
} => {
    const c1Top = c1.y - c1.hitboxHeight / 2;
    const c1Bottom = c1.y + c1.hitboxHeight / 2;
    const c2Top = c2.y - c2.hitboxHeight / 2;
    const c2Bottom = c2.y + c2.hitboxHeight / 2;

    const dx = c1.x - c2.x;
    const dy_dist = Math.max(0, c2Top - c1Bottom, c1Top - c2Bottom);

    const distSq = dx * dx + dy_dist * dy_dist;
    const combinedRadius = c1.r + c2.r;
    const collided = distSq < combinedRadius * combinedRadius;

    if (collided) {
        const dist = Math.sqrt(distSq);
        const overlap = combinedRadius - dist;
        // The normal for separation can be simplified to be the vector between centers. This is usually good enough.
        const centerDx = c1.x - c2.x;
        // FIX: Corrected a copy-paste error where `c1.y` was subtracted from itself, causing the Y-component of the collision normal to always be zero.
        const centerDy = c1.y - c2.y;
        const centerDist = Math.hypot(centerDx, centerDy) || 1;

        return {
            collided: true,
            overlap: overlap,
            normal: { x: centerDx / centerDist, y: centerDy / centerDist },
        };
    }

    return { collided: false };
};


// FIX: Added 'export' to the component declaration to make it available for import in other modules.
export const App: React.FC = () => {
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.Title);
  const [scores, setScores] = useState<Score[]>([]);
  const [loadingScores, setLoadingScores] = useState(true);
  const [onlineLeaderboardActive, setOnlineLeaderboardActive] = useState(false);
  const [levelUpPerks, setLevelUpPerks] = useState<Perk[]>([]);
  const [gameOverStats, setGameOverStats] = useState({ kills: 0, wave: 0, time: 0, coins: 0 });
  const [isMuted, setIsMuted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [infoScreenVisible, setInfoScreenVisible] = useState(false);
  const [isUpgradeScreenVisible, setIsUpgradeScreenVisible] = useState(false);
  const [isChangelogVisible, setIsChangelogVisible] = useState(false);
  const [metaState, setMetaState] = useState<MetaState>({ coins: 0, upgrades: {} });
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  const [isGodMode, setIsGodMode] = useState(false);
  const [scoreToSubmit, setScoreToSubmit] = useState<Omit<Score, 'hero'> | null>(null);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);


  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopId = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const audioInitialized = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sfxPool = useRef<Record<string, { elements: HTMLAudioElement[]; next: number }>>({});
  const isFetchingScores = useRef(false);
  const leaderboardRefreshIntervalRef = useRef<number | null>(null);
  // FIX: Added refs to hold state values to break dependency cycles in callbacks, preventing infinite loops.
  const metaStateRef = useRef(metaState);
  metaStateRef.current = metaState;
  const onlineLeaderboardActiveRef = useRef(onlineLeaderboardActive);
  onlineLeaderboardActiveRef.current = onlineLeaderboardActive;


  // Game State Refs
  const playerRef = useRef<Player>({} as Player);
  const enemiesRef = useRef<Enemy[]>([]);
  const pshotsRef = useRef<Projectile[]>([]); // Player shots
  const shotsRef = useRef<Projectile[]>([]); // Enemy shots
  const orbsRef = useRef<Orb[]>([]);
  const dropsRef = useRef<Drop[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const effectsRef = useRef<Effect[]>([]);
  const bloodParticlesRef = useRef<BloodParticle[]>([]);
  const gorePiecesRef = useRef<GorePiece[]>([]);
  const afterimagesRef = useRef<PlayerAfterimage[]>([]);
  const stateRef = useRef<GameState>({} as GameState);
  const keysRef = useRef<Set<string>>(new Set());
  const mouseRef = useRef({ x: 0, y: 0, down: false });
  const moveVectorRef = useRef({ x: 0, y: 0 });
  const perkCountsRef = useRef<Record<string, number>>({});
  const banishedPerksRef = useRef<Set<string>>(new Set());
  const statModsRef = useRef<Record<string, any>>({});
  const itemSlotsRef = useRef<Record<string, Item | null>>({ head: null, body: null, charm: null, boots: null });
  const killCountRef = useRef(0);
  const hudUpdateTimer = useRef(0.1);
  const killEnemyRef = useRef<((idx: number) => void) | null>(null);
  const coinsThisRunRef = useRef(0);
  const coinSfxCooldownRef = useRef(0);
  const pendingLevelUpsRef = useRef(0);
  const bigBossRef = useRef<Enemy | null>(null);
  const demoAIStateRef = useRef({ target: null as Enemy | null, moveTarget: { x: 0, y: 0 }, moveTimer: 0 });
  const duelsMode = useRef(false);
  const duelsWs = useRef<WebSocket | null>(null);
  const incomingEnemyQueue = useRef<Array<{type: string, wave: number, delay: number}>>([]);
  const enemySpawnTimer = useRef(0);
  const opponentStats = useRef({
        name: 'Opponent',
        hp: 100,
        hpMax: 100,
        wave: 1,
        kills: 0,
        level: 1
  });
  const duelsStatsUpdateTimer = useRef(0);

  // Viewport refs
  const virtualWidthRef = useRef(window.innerWidth);
  const virtualHeightRef = useRef(window.innerHeight);

  // Mobile controls ref
  const joystickStateRef = useRef({
      active: false,
      touchId: null as number | null,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
  });
  const JOYSTICK_MAX_DIST = 50;

  const [hudData, setHudData] = useState<HudData>({} as HudData);

  // --- Audio ---
  useEffect(() => {
    // Pre-load SFX into a pool for better performance and reliability
    document.querySelectorAll('audio[id^="sfx-"]').forEach(sfxTemplate => {
        const id = sfxTemplate.id;
        // More clones for rapid-fire sounds
        const poolSize = id === 'sfx-smg' ? 5 : 3; 
        const elements: HTMLAudioElement[] = [];
        for (let i = 0; i < poolSize; i++) {
            elements.push(sfxTemplate.cloneNode(true) as HTMLAudioElement);
        }
        sfxPool.current[id] = { elements, next: 0 };
    });
  }, []);

  const initAudio = useCallback(() => {
    if (audioInitialized.current) return;

    // This function must be called from a user interaction (e.g., a click)
    // to unlock audio playback in the browser.

    if (!audioContextRef.current) {
        try {
            // Create a single AudioContext for the entire application.
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContext) {
                audioContextRef.current = new AudioContext();
            } else {
                console.warn("Web Audio API is not supported. Sound may not work.");
                // Fallback for older browsers: just set initialized to true and hope for the best.
                audioInitialized.current = true;
                return;
            }
        } catch (e) {
            console.error("Could not create AudioContext:", e);
            audioInitialized.current = true; // Still try to play sounds without context
            return;
        }
    }

    // Resume the AudioContext if it was suspended by the browser's autoplay policy.
    if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().then(() => {
            console.log("AudioContext resumed successfully.");
            audioInitialized.current = true;
        }).catch(e => console.error("Error resuming AudioContext:", e));
    } else if (audioContextRef.current.state === 'running') {
        audioInitialized.current = true;
    }
  }, []);


  const playSfx = useCallback((id: string) => {
    if (!audioInitialized.current || isMuted || gameStatus === GameStatus.Title) return;
    const pool = sfxPool.current[id];
    if (pool) {
        const audio = pool.elements[pool.next];
        pool.next = (pool.next + 1) % pool.elements.length;

        audio.currentTime = 0;
        audio.volume = 0.6;
        audio.play().catch(e => {
             if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') {
                 console.error(`SFX play failed for ${id}:`, e);
             }
        });
    }
  }, [isMuted, gameStatus]);

  // --- High Scores & Leaderboard ---
  const loadLocalScores = useCallback(() => {
    try {
      const stored = localStorage.getItem(LOCAL_SCORE_KEY);
      setScores(stored ? JSON.parse(stored) : []);
    } catch { setScores([]); }
    setLoadingScores(false);
  }, []);

  const saveLocalScores = useCallback((newScores: Score[]) => {
      try {
          localStorage.setItem(LOCAL_SCORE_KEY, JSON.stringify(newScores));
      } catch {}
  }, []);

  const loadLeaderboard = useCallback(async () => {
    if (isFetchingScores.current) return;
    isFetchingScores.current = true;
    setLoadingScores(true);
    try {
      let response: Response | null = null;
      let lastError: Error | null = null;

      // Retry logic for flaky server (e.g., Glitch waking up)
      for (let i = 0; i < 3; i++) {
        try {
          response = await fetch(GET_LEADERBOARD_URL);
          if (response.ok) {
            lastError = null;
            break; // Success
          }
        } catch (error) {
          lastError = error as Error;
        }
        await new Promise(resolve => setTimeout(resolve, 500 * (i + 1))); // Wait before retrying
      }

      if (!response || !response.ok) {
        throw lastError || new Error(`Failed to fetch leaderboard after retries. Status: ${response?.status}`);
      }

      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Invalid leaderboard data');

      const mappedScores: Score[] = data.map((item: any) => {
          const compositeName = item.name || '';
          const score = item.score || 0;
          
          const parts = compositeName.split('|');
          const hero = parts[0] || 'Unknown';
          let wave = 0, kills = 0, time = 0;
          
          parts.slice(1).forEach((part: string) => {
              const [key, value] = part.split(':');
              if (value == null) return;
              const numValue = parseInt(value, 10);
              if (isNaN(numValue)) return;

              if (key === 'W') wave = numValue;
              else if (key === 'K') kills = numValue;
              else if (key === 'T') time = numValue;
          });
          
          return { hero, score, wave, kills, time };
      });

      setScores(mappedScores);
      setOnlineLeaderboardActive(true);
    } catch (error) {
      console.warn("Online leaderboard failed:", error instanceof Error ? error.message : "Unknown error");
      setOnlineLeaderboardActive(false);
      loadLocalScores(); // Fallback to local
    } finally {
      setLoadingScores(false);
      isFetchingScores.current = false;
    }
  }, [loadLocalScores]);

  const addScore = useCallback(async (newEntry: Score) => {
    // Immediately update local scores for offline persistence and optimistic UI
    setScores(currentScores => {
        const updatedScores = [...currentScores, newEntry].sort((a, b) => b.score - a.score).slice(0, 50);
        saveLocalScores(updatedScores);
        return updatedScores;
    });

    if (onlineLeaderboardActiveRef.current) {
      try {
        let response: Response | null = null;
        let lastError: Error | null = null;

        const compositeName = `${newEntry.hero}|W:${newEntry.wave ?? 0}|K:${newEntry.kills ?? 0}|T:${newEntry.time ?? 0}`;
        
        // Retry logic for submitting score
        for (let i = 0; i < 3; i++) {
          try {
            response = await fetch(SUBMIT_SCORE_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                name: compositeName,
                score: newEntry.score.toString()
              })
            });
            if (response.ok) {
              lastError = null;
              break;
            }
          } catch (error) {
            lastError = error as Error;
          }
          await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
        }
        if (!response || !response.ok) {
          throw lastError || new Error(`Failed to submit score. Status: ${response?.status}`);
        }
        await loadLeaderboard(); // Refresh leaderboard on success
      } catch (error) {
        console.error("Failed to submit online score, but it has been saved locally.", error);
      }
    }
  }, [saveLocalScores, loadLeaderboard]);
  
  // --- Meta Progression ---
  const saveMetaState = useCallback((state: MetaState) => {
    try {
      localStorage.setItem(META_STORAGE_KEY, JSON.stringify(state));
    } catch (e) { console.error("Failed to save meta progress", e); }
  }, []);
  
  const updateMetaState = useCallback((newState: MetaState) => {
    setMetaState(newState);
    saveMetaState(newState);
  }, [saveMetaState]);

  // --- Floating Text ---
  const addFloatingText = useCallback((x: number, y: number, amount: string, isCrit: boolean, opts: { color?: string; lifetime?: number; isAnnouncement?: boolean; numericAmount?: number; } = {}) => {
    let critPower;
    if (isCrit && opts.numericAmount) {
        critPower = clamp(opts.numericAmount / 500, 0.1, 1.0);
    }
    floatingTextsRef.current.push({ id: Date.now() + Math.random(), x, y, amount, isCrit, color: opts.color, t: opts.lifetime ?? 1.0, isAnnouncement: opts.isAnnouncement, critPower });
  }, []);

// Determine how many enemies to send based on what was killed
const getEnemyValue = (type: string): number => {
  const values: Record<string, number> = {
    'melee': 1,
    'runner': 1,
    'shooter': 1,
    'tank': 2,
    'bomber': 2,
    'splitter': 2,
    'healer': 3,
    'summoner': 3,
    'disabler': 2,
    'miniboss': 5,
    'boss_bullethell': 8,
    'boss_tank': 10,
    'boss_summoner': 8
  };
  return values[type] || 1;
};

// Determine which enemy type to actually send (slightly weaker for balance)
const selectEnemyTypeToSend = (type: string): string => {
  const mapping: Record<string, string> = {
    'tank': 'melee',
    'bomber': 'runner',
    'healer': 'shooter',
    'summoner': 'melee',
    'miniboss': 'tank',
    'boss_bullethell': 'tank',
    'boss_tank': 'tank',
    'boss_summoner': 'shooter'
  };
  return mapping[type] || type;
};

// Send killed enemy to opponent
const sendEnemyToOpponent = useCallback((enemyType: string) => {
  if (!duelsWs.current || duelsWs.current.readyState !== WebSocket.OPEN) return;

  const enemyValue = getEnemyValue(enemyType);
  const enemies = [];

  for (let i = 0; i < enemyValue; i++) {
    enemies.push({
      type: selectEnemyTypeToSend(enemyType),
      wave: stateRef.current.wave,
      spawnDelay: i * 0.2
    });
  }

  duelsWs.current.send(JSON.stringify({
    type: 'SPAWN_ENEMIES',
    payload: {
      enemies,
      timestamp: Date.now()
    }
  }));
}, []);

    // --- Game Mechanics ---
    const recalcWeaponStats = useCallback((weapon: Weapon) => {
        const lvl = weapon.level - 1;
        weapon.currentDmgMin = weapon.baseDmgMin + (weapon.upgrade.dmg || 0) * lvl;
        weapon.currentDmgMax = weapon.baseDmgMax + (weapon.upgrade.dmg || 0) * lvl;
        weapon.currentAttackCD = weapon.attackCDBase * Math.pow(weapon.upgrade.attackSpeed || 1, lvl);
        weapon.currentClipSize = Math.floor(weapon.clipSize + (weapon.upgrade.clip || 0) * lvl);
        weapon.currentReloadTime = weapon.reloadTime * Math.pow(weapon.upgrade.reload || 1, lvl);
        weapon.currentProjCount = Math.floor(weapon.projCount + (weapon.upgrade.multishot || 0) * lvl);
        
        // These are not upgraded by weapon level, but by perks/items
        weapon.currentProjSpeed = weapon.projSpeed;
        weapon.currentProjSpread = weapon.projSpread;
        weapon.currentProjPierce = weapon.projPierce;
    }, []);

    const recalcStats = useCallback(() => {
        const p = playerRef.current;
        if (!p) return;

        // A fresh object to hold all calculated modifiers from all sources.
        const mods: Record<string, number> = {
            hpMaxAdd: 0, dmgMultMul: 1, moveSpdMul: 1, dodgeCDMul: 1, dmgTakenMul: 1,
            ricochetAdd: 0, critChanceAdd: 0, critDamageAdd: 0, clipAdd: 0,
            multishotAdd: 0, pierceAdd: 0, spreadAdd: 0, atkCDMul: 1, reloadMul: 1,
            projSpeedMul: 1, orbRangeMul: 1, xpMul: 1, rerolls: 0, banishes: 0, chainBouncesAdd: 0,
            stompDamage: 0, lifestealPercent: 0, thornsDamage: 0
        };

        // 1. Apply Meta Upgrades
        for (const [key, upgrade] of Object.entries(META_UPGRADES)) {
            const level = metaStateRef.current.upgrades[key] || 0;
            if (level > 0) {
                const effects = upgrade.effect(level);
                for (const [stat, value] of Object.entries(effects)) {
                    if (stat === 'baseHpMaxAdd') mods.hpMaxAdd += value;
                    else if (stat === 'baseXpMul') mods.xpMul *= (1 + value);
                    else if (stat === 'banishes') mods.banishes += value;
                    else if (stat === 'baseDmgMul') mods.dmgMultMul *= (1 + value);
                    else if (stat === 'baseDmgTakenMul') mods.dmgTakenMul *= (1 + value); // value is negative, so 1 + (-0.02) = 0.98
                    else if (stat === 'baseCritChanceAdd') mods.critChanceAdd += value;
                    else if (stat === 'baseMoveSpdMul') mods.moveSpdMul *= (1 + value);
                }
            }
        }

        // 2. Apply Perks (from perkCountsRef)
// FIX: The variable 'perks' was not defined. It has been replaced with 'perkCountsRef.current' to correctly reference the player's collected perks.
        if (perkCountsRef.current['hp']) mods.hpMaxAdd += 20 * perkCountsRef.current['hp'];
        if (perkCountsRef.current['speed']) mods.moveSpdMul *= Math.pow(1.10, perkCountsRef.current['speed']);
        if (perkCountsRef.current['dmg']) mods.dmgMultMul *= Math.pow(1.15, perkCountsRef.current['dmg']);
        if (perkCountsRef.current['cdr']) {
            const cdrBonus = Math.pow(0.85, perkCountsRef.current['cdr']);
            mods.atkCDMul *= cdrBonus;
            mods.dodgeCDMul *= cdrBonus;
        }
        if (perkCountsRef.current['multishot']) mods.multishotAdd += perkCountsRef.current['multishot'];
        if (perkCountsRef.current['spread']) mods.spreadAdd -= 0.03 * perkCountsRef.current['spread'];
        if (perkCountsRef.current['pierce']) mods.pierceAdd += perkCountsRef.current['pierce'];
        if (perkCountsRef.current['clip+']) mods.clipAdd += 3 * perkCountsRef.current['clip+'];
        if (perkCountsRef.current['xp+']) mods.xpMul *= Math.pow(1.05, perkCountsRef.current['xp+']);
        if (perkCountsRef.current['orbRange']) mods.orbRangeMul *= Math.pow(1.15, perkCountsRef.current['orbRange']);
        if (perkCountsRef.current['critChance']) mods.critChanceAdd += 0.05 * perkCountsRef.current['critChance'];
        if (perkCountsRef.current['critDmg']) mods.critDamageAdd += 0.25 * perkCountsRef.current['critDmg'];
        if (perkCountsRef.current['chainBounce']) mods.chainBouncesAdd += perkCountsRef.current['chainBounce'];
        if (perkCountsRef.current['stomp']) mods.stompDamage = 25 * perkCountsRef.current['stomp'];
        if (perkCountsRef.current['lifesteal']) mods.lifestealPercent = 0.01 * perkCountsRef.current['lifesteal'];
        if (perkCountsRef.current['thorns']) mods.thornsDamage = 30 * perkCountsRef.current['thorns'];
        // New Perks
        if (perkCountsRef.current['ricochet']) mods.ricochetAdd += 0.05 * perkCountsRef.current['ricochet'];
        if (perkCountsRef.current['glassCannon']) {
            mods.dmgMultMul *= Math.pow(1.50, perkCountsRef.current['glassCannon']);
            mods.dmgTakenMul *= Math.pow(1.25, perkCountsRef.current['glassCannon']);
        }
        if (p.executionerBuff && p.executionerBuff.duration > 0) {
            mods.dmgMultMul *= Math.pow(2.0, (perkCountsRef.current['executioner'] || 0));
        }

        p.momentumBonus = 0.3 * (perkCountsRef.current['momentum'] || 0);
        p.hollowPointsBonus = 0.05 * (perkCountsRef.current['hollowPoints'] || 0);
        p.overchargeBonus = 2.0 * (perkCountsRef.current['overcharge'] || 0);
        
        // 3. Apply Items
        let totalItemDR = 0; // for additive stacking
        // FIX: Explicitly type the iterated item as `Item | null` to fix type inference issues.
        Object.values(itemSlotsRef.current).forEach((it: Item | null) => {
          if (!it) return;
          const itemMods = it.mods || {};
          for (const k in itemMods) {
            if (k === 'dmgTakenMul') {
                totalItemDR += (1 - itemMods[k]);
            } else if (k.endsWith('Mul')) (mods as any)[k] = ((mods as any)[k] ?? 1) * itemMods[k];
            else (mods as any)[k] = ((mods as any)[k] ?? 0) + itemMods[k];
          }
        });
        mods.dmgTakenMul *= (1 - totalItemDR); // Apply combined DR

        // 4. Store final calculated mods for reference
        statModsRef.current = mods;

        // 5. Apply mods to calculate final player & weapon stats
        const s = { ...INITIAL_PLAYER_STATS };
        if (p.weapon) {
            recalcWeaponStats(p.weapon);
        }
        
        s.hpMax += mods.hpMaxAdd;
        s.ricochet = Math.max(0, Math.min(1, mods.ricochetAdd));
        s.dmgMult *= mods.dmgMultMul;
        s.moveSpd *= mods.moveSpdMul;
        s.dodgeCD *= mods.dodgeCDMul;
        s.dmgTakenMul *= mods.dmgTakenMul;
        s.critChance += mods.critChanceAdd;
        s.critDamage += mods.critDamageAdd;
        s.dodgeCD = Math.max(0.4, s.dodgeCD);

        p.chainBounces = mods.chainBouncesAdd;
        if (p.evo?.gun === 'chain') {
            p.chainBounces += 1;
        }

        p.hpMax = Math.floor(s.hpMax);
        p.hp = Math.min(p.hp, p.hpMax); // Cap current HP to new max HP
        p.baseSpeed = s.moveSpd;
        p.speed = s.moveSpd;
        p.jumpCDBase = s.dodgeCD;
        p.dmgMult = s.dmgMult;
        p.dmgTakenMul = s.dmgTakenMul;
        p.ricochet = s.ricochet;
        p.critChance = s.critChance;
        p.critDamage = s.critDamage;
        // Rerolls and Banishes are managed separately as run resources and are not reset here.
        p.stompDamage = mods.stompDamage;
        p.lifestealPercent = mods.lifestealPercent;
        p.thornsDamage = mods.thornsDamage;

        if (p.weapon) {
            p.weapon.currentClipSize += mods.clipAdd;
            p.weapon.currentProjCount += mods.multishotAdd;
            p.weapon.currentProjPierce += mods.pierceAdd;
            p.weapon.currentProjSpread += mods.spreadAdd;
            p.weapon.currentAttackCD *= mods.atkCDMul;
            p.weapon.currentReloadTime *= mods.reloadMul;
            p.weapon.currentProjSpeed *= mods.projSpeedMul;

            p.weapon.currentProjSpread = Math.max(0.02, p.weapon.currentProjSpread);
            p.weapon.currentAttackCD = Math.max(0.06, p.weapon.currentAttackCD);
            p.weapon.currentReloadTime = Math.max(0.2, p.weapon.currentReloadTime);
            p.weapon.currentClipSize = Math.max(1, Math.floor(p.weapon.currentClipSize));

            if (p.evo?.gun === 'smg') {
                p.weapon.currentAttackCD = Math.max(0.06, p.weapon.currentAttackCD * 0.55);
                p.weapon.currentProjCount = Math.max(1, (p.weapon.currentProjCount || 1) + 2);
                p.weapon.currentProjSpread = Math.max(0.05, p.weapon.currentProjSpread * 0.7);
            }
            if (p.evo?.gun === 'shotgun') {
                p.weapon.currentProjCount = Math.max(1, (p.weapon.currentProjCount || 1) + 6);
                p.weapon.currentProjSpread = Math.max(0.1, p.weapon.currentProjSpread * 2.5);
                p.weapon.currentAttackCD = Math.max(0.2, p.weapon.currentAttackCD * 1.20); // Slower fire rate
            }
        }
        
        p._statsView = s; // For display
    }, [recalcWeaponStats]);

  const equipItem = useCallback((id: string) => {
    const it = ITEMS[id];
    if (!it) return false;
    const slot = it.slot;
    const cur = itemSlotsRef.current[slot];
    if (cur) {
      const rCur = RARITY_RANK[cur.rarity || 'white'] || 1;
      const rNew = RARITY_RANK[it.rarity || 'white'] || 1;
      if (rNew <= rCur) return false;
    }
    itemSlotsRef.current[slot] = it;
    recalcStats();
    addFloatingText(playerRef.current.x, playerRef.current.y - 36, `Equipped ${it.name}`, true);
    return true;
  }, [recalcStats, addFloatingText]);

  const checkEvolutions = useCallback(() => {
    for (const e of EVOLUTIONS) {
      if (playerRef.current.evo.gun) continue;
      let ok = true;
      for (const k in e.req) {
        const requiredLevel = e.req[k as keyof typeof e.req];
        if (requiredLevel === undefined || (perkCountsRef.current[k] || 0) < requiredLevel) {
          ok = false;
          break;
        }
      }
      if (ok) {
        e.apply(playerRef.current);
        recalcStats();
        addFloatingText(playerRef.current.x, playerRef.current.y - 36, `Evolved: ${e.name}!`, false, { lifetime: 2, isAnnouncement: true });
      }
    }
  }, [recalcStats, addFloatingText]);

  const generateLevelUpPerks = useCallback(() => {
      const p = playerRef.current;
      const allPerks: Omit<Perk, 'apply'>[] = [
          { id:'hp', name:'+20 Max HP', desc:'Increase max health by 20' },
          { id:'speed', name:'+10% Speed', desc:'Move faster' },
          { id:'dmg', name:'+15% Damage', desc:'Deal more damage' },
          { id:'cdr', name:'-15% Cooldown', desc:'Attack and dodge faster' },
          { id:'multishot', name:'Multi-shot +1', desc:'Shoot +1 projectile' },
          { id:'spread', name:'Tighter Spread', desc:'More accurate shots' },
          { id:'pierce', name:'Piercing +1', desc:'Projectiles pierce +1' },
          { id:'clip+', name:'+3 Clip Size', desc:'Increase magazine by 3' },
          { id:'xp+', name:'+5% XP Gain', desc:'Gain experience faster' },
          { id:'orbRange', name:'+15% Orb Pickup Range', desc:'Collect XP orbs from farther away' },
          { id:'critChance', name:'Deadly Precision', desc:'+5% critical hit chance.' },
          { id:'critDmg', name:'Overwhelm', desc:'+25% critical hit damage.' },
          { id: 'weaponUpgrade', name: 'Upgrade Weapon', desc: `Enhance your ${p.weapon.name} to Level ${p.weapon.level + 1}.` },
          { id: 'stomp', name: 'Seismic Slam', desc: 'Your Dodge creates a shockwave, damaging nearby enemies.' },
          { id: 'lifesteal', name: 'Vampiric Rounds', desc: 'Heal for 1% of damage dealt.' },
          { id: 'thorns', name: 'Reactive Plating', desc: 'Enemies that hit you take 30 damage.' },
          // New Perks
          { id: 'ricochet', name: 'Ricochet Rounds', desc: '+5% chance for projectiles to ricochet to a nearby enemy.' },
          { id: 'momentum', name: 'Momentum', desc: 'Killing an enemy grants +30% movement speed for 3 seconds.' },
          { id: 'adrenaline', name: 'Adrenaline Rush', desc: 'Picking up an XP orb grants 0.2s of invulnerability.' },
          { id: 'glassCannon', name: 'Glass Cannon', desc: '+50% damage dealt, but +25% damage taken.' },
          { id: 'singularity', name: 'Singularity', desc: 'Enemies have a 5% chance on death to create a black hole, pulling others in.' },
          { id: 'secondWind', name: 'Second Wind', desc: 'Once per run, survive fatal damage with 50% HP and brief invincibility.' },
          { id: 'goldenTouch', name: 'Golden Touch', desc: 'Enemies have a 5% chance to drop a Golden Coin on death.' },
          { id: 'hollowPoints', name: 'Hollow Points', desc: "Critical hits deal bonus damage equal to 5% of the enemy's missing health." },
          { id: 'overcharge', name: 'Overcharge', desc: 'The last bullet in your clip deals +200% damage and is a guaranteed crit.' },
          { id: 'executioner', name: "Baba Yaga", desc: 'Killing an elite or boss grants +100% damage for 10 seconds. You glow red while this effect is active.' },
      ];

      if (p.evo.gun === 'chain') {
        allPerks.push({ id: 'chainBounce', name: '+1 Bounce', desc: 'Chain lightning hits one additional target.' });
      }

      const perkPool = allPerks.filter(perk => !banishedPerksRef.current.has(perk.id));
      const picks: Perk[] = [];
      for (let i = 0; i < 3 && perkPool.length; i++) {
        const choice = perkPool.splice(Math.floor(Math.random() * perkPool.length), 1)[0];
        const apply = () => {
            // Special handling BEFORE stat recalculation
            if (choice.id === 'weaponUpgrade') {
                playerRef.current.weapon.level++;
            }

            perkCountsRef.current[choice.id] = (perkCountsRef.current[choice.id] || 0) + 1;
            
            // Recalculate stats. Rerolls and Banishes are managed separately and are not affected.
            recalcStats();

            // Special handling AFTER stat recalculation for immediate effects
            if (choice.id === 'hp') {
                const oldHp = playerRef.current.hp;
                playerRef.current.hp = Math.min(playerRef.current.hpMax, playerRef.current.hp + 20);
                const actualHeal = playerRef.current.hp - oldHp;
                if (actualHeal > 0) {
                    addFloatingText(playerRef.current.x, playerRef.current.y - 45, `+${Math.floor(actualHeal)} HP`, false, { color: '#4ade80', lifetime: 1.5 });
                }
            } else if (choice.id === 'clip+') {
                playerRef.current.weapon.ammo = Math.min(playerRef.current.weapon.ammo + 3, playerRef.current.weapon.currentClipSize);
            } else if (choice.id === 'weaponUpgrade') {
                playerRef.current.weapon.ammo = playerRef.current.weapon.currentClipSize;
            }

            checkEvolutions();
            
            pendingLevelUpsRef.current -= 1;

            if (pendingLevelUpsRef.current > 0) {
                generateLevelUpPerks();
            } else {
                setGameStatus(GameStatus.Playing);
            }
        };
        picks.push({ ...choice, apply });
      }
      setLevelUpPerks(picks);
  }, [recalcStats, addFloatingText, checkEvolutions, setGameStatus, setLevelUpPerks]);

  const handleRerollPerks = useCallback(() => {
    if (playerRef.current.rerollsLeft > 0) {
        playerRef.current.rerollsLeft--;
        generateLevelUpPerks();
    }
  }, [generateLevelUpPerks]);
  
  const handleBanishPerk = useCallback((perkId: string) => {
    const p = playerRef.current;
    if (p.banishesLeft > 0) {
        p.banishesLeft--;
        banishedPerksRef.current.add(perkId);
        // TODO: Play a sound effect for banish
        generateLevelUpPerks();
    }
  }, [generateLevelUpPerks]);

  // --- Game State Management ---
  const resetGame = useCallback(() => {
    enemiesRef.current = []; pshotsRef.current = []; shotsRef.current = []; orbsRef.current = []; dropsRef.current = []; floatingTextsRef.current = []; effectsRef.current = []; bloodParticlesRef.current = []; gorePiecesRef.current = []; afterimagesRef.current = [];
    killCountRef.current = 0;
    coinsThisRunRef.current = 0;
    perkCountsRef.current = {};
    banishedPerksRef.current.clear();
    pendingLevelUpsRef.current = 0;
    statModsRef.current = {};
    itemSlotsRef.current = { head: null, body: null, charm: null, boots: null };
    bigBossRef.current = null;
    setIsAdminMenuOpen(false);
    setIsGodMode(false);
    setScoreToSubmit(null);
    setScoreSubmitted(false);

    const initialWeapon: Weapon = {
        ...INITIAL_WEAPON,
        level: 1,
        ammo: INITIAL_WEAPON.clipSize,
        reloading: false,
        reloadT: 0,
        attackCooldown: 0,
        currentDmgMin: 0, currentDmgMax: 0, currentAttackCD: 0, currentClipSize: 0,
        currentReloadTime: 0, currentProjCount: 0, currentProjSpeed: 0,
        currentProjSpread: 0, currentProjPierce: 0,
    };

    playerRef.current = {
      x: virtualWidthRef.current / 2, y: virtualHeightRef.current / 2, r: 15, hitboxHeight: 75,
      hp: 100, invuln: 0, facing: 0, facingDirection: 1, aimAngle: 0,
      jumpCooldown: 0,
      level: 1, xp: 0, xpNext: 50,
      evo: { gun: null },
      runT: 0, bob: 0,
      slow: { duration: 0, factor: 1 },
      rerollsLeft: 0,
      banishesLeft: 0,
      chainBounces: 0,
      isDemo: false,
      ...INITIAL_PLAYER_STATS,
      baseSpeed: INITIAL_PLAYER_STATS.moveSpd,
      speed: INITIAL_PLAYER_STATS.moveSpd,
      jumpCDBase: INITIAL_PLAYER_STATS.dodgeCD,
      weapon: initialWeapon,
      momentum: { duration: 0 },
      momentumBonus: 0,
      secondWindUsed: false,
      hollowPointsBonus: 0,
      overchargeBonus: 0,
      executionerBuff: { duration: 0 },
    };
    
    // Recalculate base stats first
    recalcStats();
    
    // Manually set initial resources based on meta upgrades
    const banishLevel = metaStateRef.current.upgrades['banish'] || 0;
    if (banishLevel > 0) {
        playerRef.current.banishesLeft = META_UPGRADES['banish'].effect(banishLevel).banishes;
    }
    const rerollLevel = metaStateRef.current.upgrades['reroll'] || 0;
    if (rerollLevel > 0) {
        playerRef.current.rerollsLeft = META_UPGRADES['reroll'].effect(rerollLevel).rerolls;
    }

    playerRef.current.hp = playerRef.current.hpMax;
    playerRef.current.weapon.ammo = playerRef.current.weapon.currentClipSize;

    stateRef.current = {
      running: false, paused: false, elapsed: 0, wave: 1, vacuumAllTimer: 0,
      waveInProgress: false, waveBreak: 0.5, spawnQueue: 0, spawnTimer: 0,
    };
  }, [recalcStats]);

  const startBackgroundDemo = useCallback(() => {
    resetGame();
    const p = playerRef.current;
    p.isDemo = true;
    p.hpMax = 99999;
    p.hp = 99999;
    p.dmgMult = 2.5;
    p.weapon.level = 8;
    const evo = EVOLUTIONS.find(e => e.id === 'smg');
    if (evo) evo.apply(p);
    recalcStats();
    p.weapon.ammo = p.weapon.currentClipSize;

    stateRef.current.waveInProgress = true;
    stateRef.current.spawnQueue = 999;
    stateRef.current.spawnTimer = 0.5;
    stateRef.current.wave = 8;
  }, [resetGame, recalcStats]);

  const gameOver = useCallback(() => {
    if (playerRef.current.isDemo) {
        startBackgroundDemo();
        return;
    }

    playSfx('sfx-gameover');
    // 👇 ADD THIS FOR DUELS MODE
  if (duelsMode.current && duelsWs.current) {
    console.log('💀 Sending death to server...');
    duelsWs.current.send(JSON.stringify({
      type: 'PLAYER_DEATH'
    }));
    // Don't continue - wait for server to send MATCH_END
    return;
  }
  // 👆 END OF DUELS DEATH HANDLING
    const finalWave = stateRef.current.wave - (stateRef.current.waveInProgress ? 0 : 1);
    const scoreValue = Math.floor(stateRef.current.elapsed * 10) + killCountRef.current * 5 + Math.max(0, finalWave - 1) * 100;
    
    const stats = {
      kills: killCountRef.current,
      wave: Math.max(1, finalWave),
      time: stateRef.current.elapsed,
    };
    const coins = coinsThisRunRef.current;
    
    setScoreToSubmit({ score: scoreValue, ...stats });
    setGameOverStats({ ...stats, coins });
    
    const newTotalCoins = metaStateRef.current.coins + coins;
    updateMetaState({ ...metaStateRef.current, coins: newTotalCoins });

    setGameStatus(GameStatus.GameOver);
  }, [playSfx, updateMetaState, startBackgroundDemo]);

  const handleScoreSubmit = useCallback(async (name: string) => {
    if (!scoreToSubmit) return;
    const hero = (name || 'Gunner').replace(/[|:]/g, '').substring(0, 12);
    const finalScoreEntry = { ...scoreToSubmit, hero };
    await addScore(finalScoreEntry);
    setScoreSubmitted(true);
  }, [addScore, scoreToSubmit]);


  useEffect(() => {
    if (gameStatus === GameStatus.Title && onlineLeaderboardActiveRef.current) {
        // Refresh every 30 seconds
        leaderboardRefreshIntervalRef.current = window.setInterval(() => {
            if (!isFetchingScores.current) {
                loadLeaderboard();
            }
        }, 30000);
    }

    return () => {
        if (leaderboardRefreshIntervalRef.current) {
            clearInterval(leaderboardRefreshIntervalRef.current);
            leaderboardRefreshIntervalRef.current = null;
        }
    };
  }, [gameStatus, loadLeaderboard]);

  useEffect(() => {
    loadLeaderboard();
    // Load meta progress on startup
    try {
      const storedMeta = localStorage.getItem(META_STORAGE_KEY);
      if (storedMeta) {
        setMetaState(JSON.parse(storedMeta));
      }
    } catch {
      // Could not parse, start fresh
      setMetaState({ coins: 0, upgrades: {} });
    }
    startBackgroundDemo();
  }, [loadLeaderboard, startBackgroundDemo]);

  useEffect(() => {
    setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);
  

  const gainXP = useCallback((n: number) => {
    const p = playerRef.current;
    if (!p || gameStatus === GameStatus.GameOver) return;

    const totalXpMultiplier = statModsRef.current.xpMul || 1;
    const finalXp = Math.floor(n * totalXpMultiplier);
    p.xp += finalXp;

    if (p.xp < p.xpNext) return;

    let levelsGained = 0;
    let totalHealed = 0;
    while (p.xp >= p.xpNext) {
      levelsGained++;
      p.level += 1;
      p.xp -= p.xpNext;
      p.xpNext = Math.ceil(p.xpNext * 1.35 + 10);
      const oldHp = p.hp;
      p.hp = Math.min(p.hpMax, p.hp + 15);
      totalHealed += p.hp - oldHp;
    }
    
    if (!p.isDemo && totalHealed > 0) {
        addFloatingText(p.x, p.y - 45, `+${Math.floor(totalHealed)} HP`, false, { color: '#4ade80', lifetime: 1.5 });
    }

    if (levelsGained > 0) {
      if (p.isDemo) {
        // Silently upgrade the demo player to keep it effective without showing UI.
        // We'll just give it some core stats.
        perkCountsRef.current['dmg'] = (perkCountsRef.current['dmg'] || 0) + levelsGained;
        perkCountsRef.current['cdr'] = (perkCountsRef.current['cdr'] || 0) + levelsGained;
        recalcStats();
        return;
      }

      pendingLevelUpsRef.current += levelsGained;
      playSfx('sfx-levelup');
      addFloatingText(p.x, p.y - 27, `Level Up! (+${levelsGained})`, true, { lifetime: 1.5 });
      
      if (gameStatus !== GameStatus.LevelUp) {
          generateLevelUpPerks();
          setGameStatus(GameStatus.LevelUp);
      }
    }
  }, [addFloatingText, playSfx, generateLevelUpPerks, setGameStatus, recalcStats]);

    const critRollAndAmount = useCallback((base: number, forceCrit = false) => {
        const p = playerRef.current;
        const chance = p.critChance;
        const mult = p.critDamage;
        const isCrit = forceCrit || Math.random() < chance;
        const amount = Math.max(1, Math.floor(base * (isCrit ? mult : 1)));
        return { amount, isCrit };
    }, []);

    const createExplosion = useCallback((x: number, y: number, radius: number, baseDmg: number, canCrit: boolean, damagesEnemies: boolean) => {
        effectsRef.current.push({
            id: Date.now() + Math.random(), type: 'explosion', x, y, r: 15, maxR: radius,
            t: 0.4, maxT: 0.4, color: '#ff00ff'
        });
        playSfx('sfx-explosion');

        if (damagesEnemies) {
            for (let i = enemiesRef.current.length - 1; i >= 0; i--) {
                const e = enemiesRef.current[i];
                if(!e) continue;
                const distSq = (e.x - x)**2 + (e.y - y)**2;
                if (distSq < (radius + e.r)**2) {
                    const dist = Math.sqrt(distSq);
                    const dmg = Math.floor(baseDmg * (1 - dist / radius));
                    const result = canCrit ? critRollAndAmount(dmg) : { amount: dmg, isCrit: false };
                    let actualDmg = result.amount;
                    if (result.isCrit && playerRef.current.hollowPointsBonus) {
                        const missingHealth = e.hpMax - e.hp;
                        if (missingHealth > 0) {
                            actualDmg += Math.floor(missingHealth * playerRef.current.hollowPointsBonus);
                        }
                    }

                    if(e.shield && e.shield > 0) {
                        const shieldDmg = Math.min(e.shield, actualDmg);
                        e.shield -= shieldDmg;
                        e.hp -= (actualDmg - shieldDmg);
                    } else {
                        e.hp -= actualDmg;
                    }
                    addFloatingText(e.x, e.y - 9, `${actualDmg}`, result.isCrit, { numericAmount: actualDmg });
                    if (playerRef.current.lifestealPercent) {
                        const healAmount = actualDmg * playerRef.current.lifestealPercent;
                        const oldHp = playerRef.current.hp;
                        playerRef.current.hp = Math.min(playerRef.current.hpMax, playerRef.current.hp + healAmount);
                        const actualHeal = playerRef.current.hp - oldHp;
                        if (actualHeal > 0.1) {
                            addFloatingText(playerRef.current.x + rand(-15, 15), playerRef.current.y - 27, `+${actualHeal.toFixed(1)} HP`, false, { color: '#4ade80', lifetime: 1.0 });
                        }
                    }
                    if (e.hp <= 0) killEnemyRef.current?.(i);
                }
            }
        }
    }, [critRollAndAmount, addFloatingText, playSfx]);

    const handlePlayerDamage = useCallback((amount: number, source?: Enemy) => {
        if (isGodMode || playerRef.current.isDemo) return;
        const p = playerRef.current;
        if (p.invuln > 0) return;

        const finalDmg = Math.ceil(amount * p.dmgTakenMul);
        p.hp -= finalDmg;
        p.invuln = Math.max(p.invuln, 0.5); // Grant brief invulnerability
        playSfx('sfx-hurt');

        if (source?.affix === 'Life Leech') {
          source.hp = Math.min(source.hpMax, source.hp + finalDmg);
        }

        if (itemSlotsRef.current.body?.id === 'vest3' && Math.random() < 0.25) {
            createExplosion(p.x, p.y, 150, 50, true, true);
        }
        
        if (p.hp <= 0) {
            if (perkCountsRef.current['secondWind'] && !p.secondWindUsed) {
                p.secondWindUsed = true;
                p.hp = p.hpMax * 0.5;
                p.invuln = 3.0;
                addFloatingText(p.x, p.y - 45, 'Second Wind!', true, { lifetime: 2.0 });
                playSfx('sfx-levelup');
            } else {
                gameOver();
            }
        }
    }, [gameOver, playSfx, createExplosion, isGodMode, addFloatingText]);

    const spawnGibs = useCallback((enemy: Enemy) => {
        const numBlood = rand(20, 35);
        for (let i = 0; i < numBlood; i++) {
            const angle = rand(0, Math.PI * 2);
            const speed = rand(100, 500);
            const lifetime = rand(0.5, 1.5);
            bloodParticlesRef.current.push({
                x: enemy.x,
                y: enemy.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                r: rand(1, 4),
                t: lifetime,
                maxT: lifetime,
                color: '#be185d',
            });
        }

        const enemyScale = enemy.r / 14;
        const pieces: { type: GorePiece['type'], color: string, size: {w: number, h: number} }[] = [
            { type: 'head', color: '#f2d5b1', size: { w: 20 * enemyScale, h: 20 * enemyScale } },
            { type: 'arm', color: enemy.shirtColor || '#444', size: { w: 8 * enemyScale, h: 25 * enemyScale } },
            { type: 'arm', color: enemy.shirtColor || '#444', size: { w: 8 * enemyScale, h: 25 * enemyScale } },
            { type: 'leg', color: enemy.pantsColor || '#3a3a3a', size: { w: 10 * enemyScale, h: 30 * enemyScale } },
            { type: 'leg', color: enemy.pantsColor || '#3a3a3a', size: { w: 10 * enemyScale, h: 30 * enemyScale } },
        ];

        pieces.forEach(p => {
            if (Math.random() < 0.6) { // Not all pieces always fly off
                const angle = rand(0, Math.PI * 2);
                const speed = rand(50, 250);
                const lifetime = rand(2.0, 4.0);
                gorePiecesRef.current.push({
                    ...p,
                    x: enemy.x,
                    y: enemy.y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    rotation: rand(0, Math.PI * 2),
                    vr: rand(-5, 5),
                    t: lifetime,
                    maxT: lifetime,
                });
            }
        });
    }, []);

    const killEnemy = useCallback((idx: number) => {
        const enemies = enemiesRef.current;
        if (!enemies[idx]) return;
    
        const [e] = enemies.splice(idx, 1);
        
        if (e.isBigBoss) {
            bigBossRef.current = null;
        }
    
        if (e.affix === 'Explosive Death') {
          const p = playerRef.current;
          const radius = 180;
          if ((p.x - e.x)**2 + (p.y - e.y)**2 < (radius + p.r)**2) {
            handlePlayerDamage(e.dmg * 2);
          }
          effectsRef.current.push({
            id: Date.now(), type: 'explosion', x: e.x, y: e.y, r: 0, maxR: radius,
            t: 0.4, maxT: 0.4, color: '#9400D3'
          });
          playSfx('sfx-explosion');
        }

        if (e.type === 'bomber') {
            createExplosion(e.x, e.y, 120, Math.ceil(40 * (1 + 0.1 * stateRef.current.wave)), false, true);
        }
    
        killCountRef.current++;

        if (duelsMode.current && duelsWs.current) {
        sendEnemyToOpponent(e.type);
        }
        
        // Restore 0.5 HP on kill
        const p = playerRef.current;
        if (p.hp < p.hpMax && !p.isDemo) {
            p.hp = Math.min(p.hpMax, p.hp + 0.5);
        }
        
        if (perkCountsRef.current['momentum'] && playerRef.current.momentum) {
            playerRef.current.momentum.duration = 3.0;
        }
        if (perkCountsRef.current['singularity'] && Math.random() < 0.05 * perkCountsRef.current['singularity']) {
            effectsRef.current.push({ id: Date.now() + Math.random(), type: 'singularity', x: e.x, y: e.y, r: 0, maxR: 180, t: 2.0, maxT: 2.0, color: '#a855f7' });
        }
        if ((e.affix || e.type.includes('boss') || e.isBigBoss) && perkCountsRef.current['executioner'] && playerRef.current.executionerBuff) {
            const wasActive = playerRef.current.executionerBuff.duration > 0;
            playerRef.current.executionerBuff.duration = 10.0;
            recalcStats();
            if (!wasActive) {
                addFloatingText(playerRef.current.x, playerRef.current.y - 36, "Baba Yaga!", true, { lifetime: 2 });
            }
        }

        const getBaseXP = (en: Enemy) => {
            if (en.isBigBoss) return 5000;
            if (en.type.startsWith('boss')) return 400;
            if (en.type === 'miniboss') return 90;
            if (en.type === 'tank') return 34;
            if (en.type === 'runner') return 16;
            if (en.type === 'shooter') return 30;
            if (en.type === 'splitter') return 20;
            if (en.type === 'bomber') return 18;
            if (en.type === 'healer') return 38;
            if (en.type === 'summoner') return 45;
            if (en.type === 'disabler') return 28;
            return 18;
        };
    
        let totalXP = getBaseXP(e) + Math.floor(stateRef.current.wave * 6);
        if (e.affix) totalXP *= 2; // Elites give more XP

        while (totalXP > 0) {
            const c = Math.min(totalXP, 15 + Math.floor(Math.random() * 10));
            totalXP -= c;
            const mult = c >= 60 ? 3 : (c >= 30 ? 2 : 1);
            orbsRef.current.push({ x: e.x + rand(-6,6), y: e.y + rand(-6,6), xp: c, mult, r: 6 * (mult === 3 ? 2.2 : (mult === 2 ? 1.6 : 1))});
        }
    
        const magnetExists = dropsRef.current.some(d => d.type === 'magnet');
        if (stateRef.current.vacuumAllTimer <= 0 && !magnetExists && Math.random() < 0.03) {
            dropsRef.current.push({ type:'magnet', x:e.x+rand(-10,10), y:e.y+rand(-10,10), r:12, t:20 });
        }

        const HEALTH_DROP_CHANCE = 0.05;
        if (Math.random() < HEALTH_DROP_CHANCE) {
            dropsRef.current.push({ type: 'health', x: e.x + rand(-8, 8), y: e.y + rand(-8, 8), r: 12, t: 45 });
        }

        if (perkCountsRef.current['goldenTouch'] && Math.random() < 0.05 * perkCountsRef.current['goldenTouch']) {
            dropsRef.current.push({ type: 'goldenCoin', x: e.x + rand(-8, 8), y: e.y + rand(-8, 8), r: 10, t: 45 });
        }

        if (e.type === 'splitter'){
            for (let k = 0; k < 2; k++) {
                enemiesRef.current.push({ type:'minion', id: Date.now() + Math.random() * (k+1), x:e.x+rand(-10,10), y:e.y+rand(-10,10), r:10.5, hitboxHeight: 10.5 * 5, speed:195*(1+0.01*stateRef.current.wave), hp:10, hpMax:10, dmg:6*(1+0.1*stateRef.current.wave), hitTimer: 0, stun: 0, facingDirection: 1, runT: 0 });
            }
        }
        playSfx('sfx-kill');
        spawnGibs(e);
    
        const dropItem = (weights: (string | number)[][]) => {
            let r = Math.random(), acc = 0;
            let itemId = weights[0][0] as string;
            for (const [id, w] of weights) {
                acc += w as number;
                if (r <= acc) {
                    itemId = id as string;
                    break;
                }
            }
            const it = ITEMS[itemId];
            dropsRef.current.push({ type: 'item', x: e.x, y: e.y, r: 15, t: 45, itemId, color: (it.rarity === 'gold' ? '#ffcc33' : it.rarity === 'purple' ? '#c06cff' : it.rarity === 'blue' ? '#66aaff' : '#ddd') });
        }
    
        if (e.type === 'miniboss' && Math.random() <= MINIBOSS_DROP.dropChance) {
            dropItem(MINIBOSS_DROP.weights);
        } else if (e.type.startsWith('boss') && Math.random() <= BOSS_DROP.dropChance) {
            dropItem(BOSS_DROP.weights);
        }

        if (e.type.startsWith('boss') || e.isBigBoss || e.affix) {
          const coinLevel = metaStateRef.current.upgrades['coins'] || 0;
          const coinMultiplier = 1 + META_UPGRADES['coins'].effect(coinLevel).coinMul;
          const baseCoins = e.isBigBoss ? rand(25, 40) : e.type.startsWith('boss') ? rand(4, 6) : 1;
          const totalCoins = Math.ceil(baseCoins * coinMultiplier);
          for (let i = 0; i < totalCoins; i++) {
              dropsRef.current.push({ type: 'goldenCoin', x: e.x + rand(-8, 8), y: e.y + rand(-8, 8), r: 10, t: 45 });
          }
        }
    }, [playSfx, createExplosion, handlePlayerDamage, spawnGibs, recalcStats, addFloatingText, sendEnemyToOpponent]);

  const startReload = useCallback(() => {
    const w = playerRef.current.weapon;
    if (w.reloading || w.ammo >= w.currentClipSize) return;
    w.reloading = true;
    w.reloadT = w.currentReloadTime;
    playSfx('sfx-reload');
  }, [playSfx]);
  
  const shootProjectile = useCallback((originPlayer: Player, ang: number, speed: number, radius: number, dmg: number, opts: { pierce?: number; explosive?: boolean; lifetime?: number; chainLightning?: boolean; forceCrit?: boolean; } = {}) => {
      const gunLen = 40; // Approximate distance of gun muzzle from player center
      const sx = originPlayer.x + Math.cos(ang) * gunLen;
      const sy = originPlayer.y + Math.sin(ang) * gunLen;
      pshotsRef.current.push({ x: sx, y: sy, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: radius, dmg, t: opts.lifetime ?? 2.8, pierce: opts.pierce || 0, explosive: !!opts.explosive, hitEnemies: [], chainLightning: !!opts.chainLightning, bouncesLeft: opts.chainLightning ? originPlayer.chainBounces : 0, forceCrit: !!opts.forceCrit });
  }, []);

  const attack = useCallback((target?: {x: number, y: number}) => {
    const p = playerRef.current;
    const w = p.weapon;
    if (w.attackCooldown > 0 || w.reloading) return;
    if (w.ammo <= 0) { startReload(); return; }

    const targetX = target?.x ?? mouseRef.current.x;
    const targetY = target?.y ?? mouseRef.current.y;
    const a = Math.atan2(targetY - p.y, targetX - p.x);

    let sfxToPlay = 'sfx-pistol';
    if (p.evo.gun === 'railgun') sfxToPlay = 'sfx-railgun';
    else if (p.evo.gun === 'shotgun') sfxToPlay = 'sfx-shotgun';
    else if (p.evo.gun === 'smg') sfxToPlay = 'sfx-smg';
    playSfx(sfxToPlay);

    const isLastShot = w.ammo === 1;
    const overchargeActive = !!(p.overchargeBonus && isLastShot);
    let dmgBase = Math.max(1, Math.floor(rand(w.currentDmgMin, w.currentDmgMax) * p.dmgMult));
    if (overchargeActive && typeof p.overchargeBonus === 'number') {
        dmgBase = Math.floor(dmgBase * (1 + p.overchargeBonus));
    }

    if (p.evo.gun !== 'railgun') {
        const gunLen = 40;
        const flashX = p.x + Math.cos(a) * gunLen;
        const flashY = p.y + Math.sin(a) * gunLen;
        effectsRef.current.push({
            id: Date.now() + Math.random(), type: 'muzzle-flash',
            x: flashX, y: flashY, r: 0, maxR: 20, t: 0.1, maxT: 0.1
        });
    }

    if (p.evo.gun === 'railgun') {
      const cnt = w.currentProjCount;
      const sp = w.currentProjSpread;
      const alreadyHitThisAttack = new Set<number>();

      for (let k = 0; k < cnt; k++) {
        let currentOrigin = { x: p.x, y: p.y };
        let currentAngle = a + (cnt > 1 ? rand(-sp, sp) : 0);
        const beamPath = [currentOrigin];
        const maxBounces = 1; // Allow one ricochet
        let currentDmg = dmgBase;

        for (let bounce = 0; bounce <= maxBounces; bounce++) {
            const range = 1500;
            
            const segmentHits: { enemy: Enemy, distSq: number }[] = [];
            for (const e of enemiesRef.current) {
                if (alreadyHitThisAttack.has(e.id)) continue;
        
                const dx_origin = e.x - currentOrigin.x;
                const dy_origin = e.y - currentOrigin.y;
                const projection = dx_origin * Math.cos(currentAngle) + dy_origin * Math.sin(currentAngle);
                
                if (projection < 0 || projection > range) continue;
                
                const perpDist = Math.abs(-Math.sin(currentAngle) * dx_origin + Math.cos(currentAngle) * dy_origin);
                
                if (perpDist <= (25 + e.r)) {
                    segmentHits.push({ enemy: e, distSq: projection * projection });
                }
            }

            if (segmentHits.length > 0) {
                segmentHits.sort((a, b) => a.distSq - b.distSq);
                
                let lastHitEnemy: Enemy | null = null;
                for (const hit of segmentHits) {
                    const e = hit.enemy;
                    if (alreadyHitThisAttack.has(e.id)) continue;
                    
                    alreadyHitThisAttack.add(e.id);
                    lastHitEnemy = e;

                    const { amount, isCrit } = critRollAndAmount(Math.floor(currentDmg * 1.4), overchargeActive);
                    let finalAmount = amount;
                    if (isCrit && p.hollowPointsBonus) {
                        const missingHealth = e.hpMax - e.hp;
                        if (missingHealth > 0) {
                            finalAmount += Math.floor(missingHealth * p.hollowPointsBonus);
                        }
                    }
                    if(e.shield && e.shield > 0) e.shield -= finalAmount; else e.hp -= finalAmount;
                    addFloatingText(e.x, e.y - 9, `${finalAmount}`, isCrit, { numericAmount: finalAmount });
                    if (p.lifestealPercent) {
                        const healAmount = finalAmount * p.lifestealPercent;
                        const oldHp = p.hp;
                        p.hp = Math.min(p.hpMax, p.hp + healAmount);
                        const actualHeal = p.hp - oldHp;
                        if (actualHeal > 0.1) {
                            addFloatingText(p.x + rand(-15, 15), p.y - 27, `+${actualHeal.toFixed(1)} HP`, false, { color: '#4ade80', lifetime: 1.0 });
                        }
                    }
                    if (e.hp <= 0) {
                        const enemyIndex = enemiesRef.current.findIndex(en => en.id === e.id);
                        if (enemyIndex !== -1) killEnemy(enemyIndex);
                    }
                }
                
                if (lastHitEnemy) {
                    beamPath.push({ x: lastHitEnemy.x, y: lastHitEnemy.y });
                    if (bounce < maxBounces && p.ricochet > 0 && Math.random() < p.ricochet) {
                        let newTarget: Enemy | null = null;
                        let min_dist_sq = Infinity;
                        const RICOCHET_RADIUS_SQ = 450**2;

                        for (const potentialTarget of enemiesRef.current) {
                            if (alreadyHitThisAttack.has(potentialTarget.id)) continue;
                            const dist_sq = (lastHitEnemy.x - potentialTarget.x)**2 + (lastHitEnemy.y - potentialTarget.y)**2;
                            if (dist_sq < min_dist_sq && dist_sq < RICOCHET_RADIUS_SQ) {
                                min_dist_sq = dist_sq;
                                newTarget = potentialTarget;
                            }
                        }
                        
                        if (newTarget) {
                            playSfx('sfx-ricochet');
                            currentOrigin = { x: lastHitEnemy.x, y: lastHitEnemy.y };
                            currentAngle = Math.atan2(newTarget.y - currentOrigin.y, newTarget.x - currentOrigin.x);
                            currentDmg = Math.floor(currentDmg * 0.8);
                            continue;
                        }
                    }
                }
            }
            
            const beamEndX = currentOrigin.x + Math.cos(currentAngle) * range;
            const beamEndY = currentOrigin.y + Math.sin(currentAngle) * range;
            beamPath.push({ x: beamEndX, y: beamEndY });
            break;
        }

        effectsRef.current.push({
            id: Date.now() + Math.random(), type: 'railgun-beam', t: 0.2, maxT: 0.2,
            x: p.x, y: p.y, r: 0, maxR: 0, points: beamPath 
        });
      }
      w.attackCooldown = Math.max(0.22, w.currentAttackCD * 1.1);
    } else {
      const cnt = w.currentProjCount;
      const sp = w.currentProjSpread;
      const isShotgun = p.evo.gun === 'shotgun';
      for (let k = 0; k < cnt; k++) {
        const ang = a + rand(-sp, sp);
        shootProjectile(p, ang, w.currentProjSpeed + 80, 5, dmgBase, { 
            pierce: w.currentProjPierce, 
            explosive: p.evo.gun === 'explosive',
            lifetime: isShotgun ? 0.4 : undefined,
            chainLightning: p.evo.gun === 'chain',
            forceCrit: overchargeActive,
        });
      }
      w.attackCooldown = w.currentAttackCD;
    }
    
    w.ammo = Math.max(0, w.ammo - 1);
  }, [startReload, killEnemy, critRollAndAmount, addFloatingText, playSfx, shootProjectile]);

  const tryJump = useCallback(() => {
    const p = playerRef.current;
    if (p.jumpCooldown > 0 || p.slow.duration > 0) return;

    const oldX = p.x;
    const oldY = p.y;

    p.jumpCooldown = p.jumpCDBase;
    p.invuln = Math.max(p.invuln, 0.35);
    playSfx('sfx-dodge');
    if (itemSlotsRef.current.boots?.id === 'boots3') {
        p.invuln = Math.max(p.invuln, 0.75);
    }
    const dash = 250;
    
    // Add afterimage trail
    const NUM_GHOSTS = 4;
    const GHOST_LIFETIME = 0.25;
    for (let i = 1; i <= NUM_GHOSTS; i++) {
        const progress = i / (NUM_GHOSTS + 1);
        afterimagesRef.current.push({
            x: oldX + Math.cos(p.facing) * dash * progress,
            y: oldY + Math.sin(p.facing) * dash * progress,
            facingDirection: p.facingDirection,
            aimAngle: p.aimAngle,
            runT: p.runT,
            t: GHOST_LIFETIME,
            maxT: GHOST_LIFETIME,
            trailPosition: progress,
        });
    }

    p.x = clamp(p.x + Math.cos(p.facing) * dash, 16, virtualWidthRef.current - 16);
    p.y = clamp(p.y + Math.sin(p.facing) * dash, 16, virtualHeightRef.current - 16);

    if (p.stompDamage && p.stompDamage > 0) {
        const stompRadius = 150;
        const stompX = p.x;
        const stompY = p.y;
        
        playSfx('sfx-stomp');
        effectsRef.current.push({ id: Date.now(), type: 'shockwave', x: stompX, y: stompY, r: 15, maxR: stompRadius, t: 0.3, maxT: 0.3 });
        
        for (let i = enemiesRef.current.length - 1; i >= 0; i--) {
            const e = enemiesRef.current[i];
            if (!e) continue;
            const distSq = (e.x - stompX)**2 + (e.y - stompY)**2;
            if (distSq < (stompRadius + e.r)**2) {
                const dmg = p.stompDamage;
                if(e.shield && e.shield > 0) e.shield -= dmg; else e.hp -= dmg;
                addFloatingText(e.x, e.y-9, `${dmg}`, false, {color: '#f9a8d4'});
                if (e.hp <= 0) killEnemy(i);
            }
        }
    }
  }, [playSfx, addFloatingText, killEnemy]);
  
  const enterFullscreen = () => {
    const element = document.documentElement;
    if (element.requestFullscreen) {
        element.requestFullscreen().catch(err => console.error(`Fullscreen error: ${err.message}`));
    } else if ((element as any).webkitRequestFullscreen) { /* Safari */
        (element as any).webkitRequestFullscreen();
    } else if ((element as any).msRequestFullscreen) { /* IE11 */
        (element as any).msRequestFullscreen();
    }
  };

  const startGame = useCallback(() => {
    initAudio();
    if (isMobile && !document.fullscreenElement) {
        if (window.confirm("For a better experience, play in fullscreen?")) {
            enterFullscreen();
        }
    }
    resetGame();
    setGameStatus(GameStatus.Playing);
  }, [resetGame, isMobile, initAudio]);

  const handlePause = (paused: boolean) => {
    setGameStatus(paused ? GameStatus.Paused : GameStatus.Playing);
  };
  
  const restartGame = useCallback(() => {
    resetGame();
    setGameStatus(GameStatus.Playing);
  }, [resetGame]);

  const exitToTitle = useCallback(() => {
    setGameStatus(GameStatus.Title);
    setInfoScreenVisible(false);
    setIsUpgradeScreenVisible(false);
    loadLeaderboard();
    startBackgroundDemo();
  }, [loadLeaderboard, startBackgroundDemo]);

  const spawnBigBoss = useCallback((wave: number) => {
      const waveMult = 1 + (wave / 10 - 1) * 0.75;

      const boss: Enemy = {
          type: 'big_boss_don',
          bossType: 'don',
          id: Date.now(),
          x: virtualWidthRef.current / 2,
          y: 150,
          r: 60, hitboxHeight: 60 * 2.5,
          speed: 168,
          hp: 8000 * waveMult, hpMax: 8000 * waveMult,
          dmg: 45 * waveMult,
          hitTimer: 0, stun: 0, facingDirection: 1, runT: 0,
          isBigBoss: true,
          phase: 1,
          attackState: 'idle',
          attackTimer: 3, // time until first special
          bigBossInfo: {
              name: 'The Don',
              title: 'The Underworld Kingpin'
          },
          shoot: rand(1.0, 1.5),
          burstLeft: 0,
          burstGap: 0,
      };

      enemiesRef.current.push(boss);
      bigBossRef.current = boss;
      addFloatingText(virtualWidthRef.current / 2, virtualHeightRef.current / 2 - 100, `The Don has appeared!`, false, { isAnnouncement: true, lifetime: 3 });
  }, [addFloatingText]);

  const spawnEnemy = useCallback((type: string, wave: number, pos?: {x: number, y: number}) => {
      let x, y;
      if (pos) {
        x = pos.x + rand(-10, 10);
        y = pos.y + rand(-10, 10);
      } else {
        const m = 60;
        const side = Math.floor(Math.random() * 4);
        x = (side === 0 || side === 2) ? rand(-m, virtualWidthRef.current + m) : (side === 1 ? -m : virtualWidthRef.current + m);
        y = (side === 0 ? -m : (side === 2 ? virtualHeightRef.current + m : rand(-m, virtualHeightRef.current + m)));
      }
      
      const baseEnemies: Record<string, Omit<Enemy, 'id' | 'x' | 'y' | 'hitTimer' | 'stun' | 'facingDirection' | 'runT'>> = {
          'melee': { type: 'melee', r: 13.5, hitboxHeight: 13.5 * 5, speed: rand(105, 165), hp: 20, hpMax: 20, dmg: 8 },
          'minion': { type: 'minion', r: 10.5, hitboxHeight: 10.5 * 5, speed: 195, hp: 10, hpMax: 10, dmg: 7 },
          'shooter': { type: 'shooter', r: 13.5, hitboxHeight: 13.5 * 5, speed: rand(90, 142), hp: 28, hpMax: 28, dmg: 8, shoot: rand(0.5, 1.5) },
          'tank': { type: 'tank', r: 18, hitboxHeight: 18 * 5, speed: 90, hp: 60, hpMax: 60, dmg: 14 },
          'runner': { type: 'runner', r: 12, hitboxHeight: 12 * 5, speed: 225, hp: 14, hpMax: 14, dmg: 8 },
          'splitter': { type: 'splitter', r: 13.5, hitboxHeight: 13.5 * 5, speed: 150, hp: 26, hpMax: 26, dmg: 8 },
          'bomber': { type: 'bomber', r: 14.25, hitboxHeight: 14.25 * 5, speed: 165, hp: 18, hpMax: 18, dmg: 30, detonation: 3.0 },
          'healer': { type: 'healer', r: 13.5, hitboxHeight: 13.5 * 5, speed: 120, hp: 40, hpMax: 40, dmg: 6, shoot: 1.5, healRate: 15, healRadius: 200 },
          'summoner': { type: 'summoner', r: 15, hitboxHeight: 15 * 5, speed: 105, hp: 55, hpMax: 55, dmg: 12, spawnCD: 5.0 },
          'disabler': { type: 'disabler', r: 13.5, hitboxHeight: 13.5 * 5, speed: 130, hp: 35, hpMax: 35, dmg: 9, shoot: 2.0 },
          'miniboss': { type: 'miniboss', r: 21, hitboxHeight: 21 * 5, speed: 135, hp: 220, hpMax: 220, dmg: 16, atk: 0 },
          'boss_bullethell': { type: 'boss_bullethell', r: 25.5, hitboxHeight: 25.5 * 5, speed: 142, hp: 450, hpMax: 450, dmg: 19, atk: 0, burstLeft: 0, burstGap: 0 },
          'boss_tank': { type: 'boss_tank', r: 30, hitboxHeight: 30 * 5, speed: 112, hp: 800, hpMax: 800, dmg: 28, atk: 4.0 },
          'boss_summoner': { type: 'boss_summoner', r: 27, hitboxHeight: 27 * 5, speed: 127, hp: 650, hpMax: 650, dmg: 17, spawnCD: 6.0, shoot: 2.0 },
      };
      const base = baseEnemies[type] || baseEnemies['melee'];
      const e: Enemy = { ...base, id: Date.now() + Math.random(), x, y, hitTimer: 0, stun: 0, facingDirection: 1, runT: 0 };

      if(['melee', 'runner', 'tank', 'splitter', 'minion', 'miniboss'].includes(type)) {
        e.strafeTimer = rand(0, 1);
      } else {
        e.strafeTimer = rand(1, 3);
        e.strafeDuration = 0;
      }
      
      const waveScale = (1 + 0.18 * (wave - 1));
      if (type !== 'minion') {
        e.hp = Math.ceil(e.hp * waveScale);
        e.hpMax = e.hp;
        e.dmg = Math.ceil(e.dmg * (0.85 + 0.22 * wave));
        e.speed *= (1 + 0.015 * wave);
      }
      
      const eliteChance = 0.05 + wave * 0.005;
      const eligibleTypes = ['melee', 'shooter', 'tank', 'runner', 'splitter', 'bomber', 'healer', 'summoner', 'miniboss', 'disabler'];
      if (eligibleTypes.includes(type) && Math.random() < eliteChance) {
        const affixes: Array<Enemy['affix']> = ['Hasted', 'Shielded', 'Explosive Death', 'Life Leech'];
        const chosenAffix = affixes[Math.floor(Math.random() * affixes.length)];

        e.affix = chosenAffix;
        e.r *= 1.2;
        e.hitboxHeight *= 1.2;
        e.hp = Math.ceil(e.hp * 1.5);
        e.hpMax = e.hp;

        switch(chosenAffix) {
            case 'Hasted': e.speed *= 1.4; break;
            case 'Shielded': e.shield = Math.ceil(e.hpMax * 0.5); e.shieldMax = e.shield; e.shieldRechargeTimer = 5.0; break;
            case 'Explosive Death': case 'Life Leech': break;
        }
      }

      // Add visual variation
      const faceTypes: Array<Enemy['faceType']> = ['normal', 'angry', 'smirk'];
      e.faceType = faceTypes[Math.floor(Math.random() * faceTypes.length)];
      const hairColors = ['#1a1a1a', '#4a2c1a', '#a1a1a1', '#e0c077'];
      e.hairColor = hairColors[Math.floor(Math.random() * hairColors.length)];
      const shirtColors = ['#555', '#7a2d2d', '#2d7a3d', '#3d2d7a'];
      e.shirtColor = shirtColors[Math.floor(Math.random() * shirtColors.length)];
      e.pantsColor = '#3a3a3a';

      const isMeleeType = ['melee', 'runner', 'tank', 'splitter', 'minion', 'miniboss'].includes(type);
      if (isMeleeType) {
        e.meleeWeapon = Math.random() < 0.5 ? 'bat' : 'knife';
        e.meleeAttackCD = 1.2;
        e.meleeAttackTimer = 0;
      }

      enemiesRef.current.push(e);
  }, []);

    const updateEnemies = useCallback((dt: number) => {
        const p = playerRef.current;
        const singularityEffects = effectsRef.current.filter(ef => ef.type === 'singularity');

        for (let i = enemiesRef.current.length - 1; i >= 0; i--) {
            const e = enemiesRef.current[i];
            if (!e) continue;

            if (e.hitTimer > 0) e.hitTimer -= dt;
            if (e.meleeAttackCD) e.meleeAttackCD = Math.max(0, e.meleeAttackCD - dt);

            const dx_center = p.x - e.x;
            const dy_center = p.y - e.y;
            const dToPSq = dx_center**2 + dy_center**2;
            const a = Math.atan2(dy_center, dx_center);
            
            e.facingDirection = dx_center > 0 ? 1 : -1;
            
            const isRanged = ['shooter', 'healer', 'summoner', 'boss_bullethell', 'boss_summoner', 'disabler'].includes(e.type);
            const isMelee = !!e.meleeWeapon;
            
            if (e.isBigBoss) {
                if (e.attackTimer !== undefined) e.attackTimer = Math.max(0, e.attackTimer - dt);
                if (e.shoot !== undefined) e.shoot = Math.max(0, e.shoot - dt);

                // Phase transition
                if (e.phase === 1 && e.hp < e.hpMax / 2) {
                    e.phase = 2;
                    e.attackState = 'enrage';
                    e.attackTimer = 1.5;
                    effectsRef.current.push({ id: Date.now(), type: 'shockwave', x: e.x, y: e.y, r: 15, maxR: 400, t: 0.5, maxT: 0.5, color: '#dc2626' });
                }

                let moved = false;
                switch (e.attackState) {
                    case 'enrage':
                        if (e.attackTimer !== undefined && e.attackTimer <= 0) {
                            e.attackState = 'idle';
                            e.attackTimer = 2;
                        }
                        break;
                    case 'idle':
                        // Slow move towards player
                        const boss_mag = Math.hypot(dx_center, dy_center) || 1;
                        e.x += (dx_center / boss_mag) * e.speed * dt;
                        e.y += (dy_center / boss_mag) * e.speed * dt;
                        moved = true;

                        if (e.burstLeft && e.burstLeft > 0) {
                            if (e.burstGap !== undefined) {
                                e.burstGap -= dt;
                                if (e.burstGap <= 0) {
                                    e.burstGap = 0.07;
                                    const ang = a + rand(-0.1, 0.1);
                                    const sp = 520;
                                    if (e.burstLeft % 2 === 0) playSfx('sfx-smg');
                                    shotsRef.current.push({ x: e.x, y: e.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: 7, dmg: Math.ceil(e.dmg * 0.5), t: 2.5 });
                                    e.burstLeft--;
                                }
                            }
                        } else if (e.shoot !== undefined && e.shoot <= 0) {
                            e.shoot = rand(1.2, 1.8);
                            e.burstLeft = 12;
                            e.burstGap = 0;
                        }

                        if (e.attackTimer !== undefined && e.attackTimer <= 0) {
                            const nextAttack = e.phase === 1 ? rand(0, 1) : rand(0, 2);
                            if (nextAttack < 0.5) { // Stomp
                                e.attackState = 'telegraph_stomp'; e.attackTimer = 1.0;
                            } else if (nextAttack < 1.0) { // Charge
                                e.attackState = 'telegraph_charge'; e.attackTimer = 1.2; e.chargeTarget = { x: p.x, y: p.y };
                            } else { // Summon (Phase 2 only)
                                e.attackState = 'summoning'; e.attackTimer = 1.0;
                            }
                        }
                        break;
                    case 'telegraph_stomp':
                        if (e.attackTimer !== undefined && e.attackTimer <= 0) {
                            e.attackState = 'stomp'; e.attackTimer = 0.3; playSfx('sfx-stomp');
                            const stompRadius = 350;
                            effectsRef.current.push({ id: Date.now(), type: 'shockwave', x: e.x, y: e.y, r: 15, maxR: stompRadius, t: 0.3, maxT: 0.3 });
                            if (dToPSq < (stompRadius + p.r)**2) handlePlayerDamage(e.dmg * 1.2, e);
                        }
                        break;
                    case 'stomp':
                        if (e.attackTimer !== undefined && e.attackTimer <= 0) {
                            e.attackState = 'idle'; e.attackTimer = e.phase === 1 ? 4 : 2.5;
                        }
                        break;
                    case 'telegraph_charge':
                        if (e.attackTimer !== undefined && e.attackTimer <= 0) {
                            e.attackState = 'charging'; e.attackTimer = 1.5; // Charge duration
                        }
                        break;
                    case 'charging':
                        if (e.chargeTarget) {
                            const charge_dx = e.chargeTarget.x - e.x;
                            const charge_dy = e.chargeTarget.y - e.y;
                            const charge_dist = Math.hypot(charge_dx, charge_dy) || 1;
                            const chargeSpeed = 600;
                            e.x += (charge_dx / charge_dist) * chargeSpeed * dt;
                            e.y += (charge_dy / charge_dist) * chargeSpeed * dt;
                            moved = true;
                        }
                        if (e.attackTimer !== undefined && e.attackTimer <= 0) {
                            e.attackState = 'idle'; e.attackTimer = e.phase === 1 ? 5 : 3.5;
                        }
                        break;
                    case 'summoning':
                        if (e.attackTimer !== undefined && e.attackTimer <= 0) {
                            const count = 5 + Math.floor(stateRef.current.wave / 10);
                            for(let k=0; k < count; ++k) {
                                const typeToSpawn = k < 2 ? 'tank' : 'shooter';
                                spawnEnemy(typeToSpawn, stateRef.current.wave, {x: e.x, y: e.y});
                            }
                            e.attackState = 'idle'; e.attackTimer = 8;
                        }
                        break;
                }
                 if (moved) e.runT += dt * e.speed * 0.05;
                const playerCollision = checkCapsuleCapsuleCollision(e, p);
                if (playerCollision.collided && e.hitTimer <= 0) {
                    handlePlayerDamage(e.dmg, e);
                    e.hitTimer = 0.5;
                }
                continue; // Skip normal AI for Big Boss
            }

            if (e.affix === 'Shielded' && e.shield !== undefined && e.shieldMax !== undefined) {
                if (e.shieldRechargeTimer !== undefined && e.shieldRechargeTimer > 0) {
                    e.shieldRechargeTimer -= dt;
                } else if (e.shield < e.shieldMax) {
                    e.shield = Math.min(e.shieldMax, e.shield + (e.shieldMax * 0.2) * dt);
                }
            }
            
            let moved = false;

            for (const ef of singularityEffects) {
                const pull_dx = ef.x - e.x;
                const pull_dy = ef.y - e.y;
                const pull_dist_sq = pull_dx * pull_dx + pull_dy * pull_dy;
                if (pull_dist_sq > 0 && pull_dist_sq < (ef.maxR ** 2)) {
                    const pull_force = 1 - (pull_dist_sq / (ef.maxR ** 2));
                    const pull_strength = 600;
                    const pull_dist = Math.sqrt(pull_dist_sq);
                    e.x += (pull_dx / pull_dist) * pull_strength * pull_force * dt;
                    e.y += (pull_dy / pull_dist) * pull_strength * pull_force * dt;
                    moved = true;
                }
            }
            
            // --- Melee Attack AI ---
            if (isMelee) {
                const c1 = e, c2 = p;
                const c1Top = c1.y - c1.hitboxHeight / 2, c1Bottom = c1.y + c1.hitboxHeight / 2;
                const c2Top = c2.y - c2.hitboxHeight / 2, c2Bottom = c2.y + c2.hitboxHeight / 2;
                const dxMelee = c1.x - c2.x;
                const dy_dist = Math.max(0, c2Top - c1Bottom, c1Top - c2Bottom);
                const distSqMelee = dxMelee * dxMelee + dy_dist * dy_dist;
                const combinedRadiusAndRange = c1.r + c2.r + 20; // 20 is melee range
                const inMeleeRange = distSqMelee < combinedRadiusAndRange * combinedRadiusAndRange;

                if (e.meleeAttackTimer && e.meleeAttackTimer > 0) {
                    e.meleeAttackTimer -= dt;
                    // Deal damage at the peak of the swing
                    if (e.meleeAttackTimer <= 0.2 && !e.dealtDamageThisSwing) {
                        if (inMeleeRange) {
                            handlePlayerDamage(e.dmg, e);
                            if (p.thornsDamage) {
                                e.hp -= p.thornsDamage;
                                addFloatingText(e.x, e.y-9, `${p.thornsDamage}`, false, {color: '#f472b6'});
                                if (e.hp <= 0) {
                                    killEnemy(i);
                                    continue;
                                }
                            }
                        }
                        e.dealtDamageThisSwing = true;
                    }

                    if (e.meleeAttackTimer <= 0) {
                      e.meleeAttackTimer = 0;
                    }
                } else if (inMeleeRange) { // Attack range check
                    if (e.meleeAttackCD !== undefined && e.meleeAttackCD <= 0) {
                        e.meleeAttackCD = 1.2; // Attack CD
                        e.meleeAttackTimer = 0.4; // Attack animation duration
                        e.dealtDamageThisSwing = false;
                        playSfx('sfx-melee-swing');
                    }
                }
            }


            if (e.meleeAttackTimer && e.meleeAttackTimer > 0) {
                // Don't move while attacking
            } else if(isRanged) {
                if(e.strafeTimer) e.strafeTimer -= dt;

                if (e.strafeDuration && e.strafeDuration > 0) e.strafeDuration -= dt;
                else if (e.strafeTimer && e.strafeTimer <= 0) {
                    e.strafeTimer = rand(3, 5) - Math.min(2.5, stateRef.current.wave * 0.1);
                    if (Math.random() < 0.4) {
                        e.strafeDuration = rand(0.4, 0.7);
                        e.strafeDir = Math.random() < 0.5 ? -1 : 1;
                    }
                }

                const desiredDistSq = (e.type === 'healer' || e.type === 'summoner') ? (350)**2 : (250)**2;
                const moveDir = dToPSq > desiredDistSq ? 1 : -0.5;
                let moveX = Math.cos(a) * e.speed * dt * moveDir;
                let moveY = Math.sin(a) * e.speed * dt * moveDir;

                if (e.strafeDuration && e.strafeDuration > 0 && e.strafeDir) {
                    const strafeSpeed = e.speed * 0.8;
                    moveX += -Math.sin(a) * strafeSpeed * dt * e.strafeDir;
                    moveY += Math.cos(a) * strafeSpeed * dt * e.strafeDir;
                }
                
                if (Math.abs(moveX) > 0.1 || Math.abs(moveY) > 0.1) {
                    e.x += moveX;
                    e.y += moveY;
                    moved = true;
                }

            } else {
                let moveX = Math.cos(a);
                let moveY = Math.sin(a);
                if (e.strafeTimer !== undefined && e.strafeTimer <= 0) {
                    e.strafeTimer = rand(0.5, 1.5);
                    e.strafeDir = (Math.random() - 0.5) * 1.5;
                }
                if(e.strafeTimer !== undefined) e.strafeTimer -= dt;
                if(e.strafeDir !== undefined){
                    moveX += -Math.sin(a) * e.strafeDir;
                    moveY += Math.cos(a) * e.strafeDir;
                }
                const mag = Math.hypot(moveX, moveY) || 1;
                e.x += (moveX / mag) * e.speed * dt;
                e.y += (moveY / mag) * e.speed * dt;
                moved = true;
            }
            
            if (moved) {
                e.runT += dt * e.speed * 0.05;
            } else {
                e.runT = 0;
            }
            
            const playerCollision = checkCapsuleCapsuleCollision(e, p);
            if (playerCollision.collided) {
                // Push enemy away from player
                if (playerCollision.overlap && playerCollision.normal) {
                    const separationX = playerCollision.normal.x * playerCollision.overlap;
                    const separationY = playerCollision.normal.y * playerCollision.overlap;
                    e.x += separationX;
                    e.y += separationY;
                }

                if (!isMelee && e.hitTimer <= 0) {
                    handlePlayerDamage(e.dmg, e);
                    e.hitTimer = 0.5;
                    if (p.thornsDamage) {
                        e.hp -= p.thornsDamage;
                        addFloatingText(e.x, e.y-9, `${p.thornsDamage}`, false, {color: '#f472b6'});
                        if (e.hp <= 0) {
                            killEnemy(i);
                            continue;
                        }
                    }
                }
            }


            if (e.type === 'bomber' && e.detonation) {
                e.detonation -= dt;
                if (e.detonation <= 0) {
                    killEnemy(i);
                    continue;
                }
            }

            switch (e.type) {
                case 'shooter':
                    if (e.shoot !== undefined) {
                        e.shoot -= dt;
                        if (e.shoot <= 0 && dToPSq < (780)**2) {
                            e.shoot = rand(1.6, 2.4) - Math.min(1.2, stateRef.current.wave * 0.08);
                            const sp = 390 + stateRef.current.wave * 12;
                            playSfx('sfx-enemy-shoot');
                            shotsRef.current.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 5, dmg: Math.ceil(10 * (0.9 + 0.15 * stateRef.current.wave)), t: 3 });
                        }
                    }
                    break;
                case 'disabler':
                    if (e.shoot !== undefined) {
                        e.shoot -= dt;
                        if (e.shoot <= 0 && dToPSq < (600)**2) {
                            e.shoot = rand(2.0, 2.8) - Math.min(1.5, stateRef.current.wave * 0.08);
                            const sp = 330 + stateRef.current.wave * 10;
                            playSfx('sfx-enemy-shoot');
                            shotsRef.current.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 6, dmg: Math.ceil(8 * (0.9 + 0.15 * stateRef.current.wave)), t: 3, slows: true });
                        }
                    }
                    break;
                case 'healer':
                    if (e.shoot !== undefined && e.healRate && e.healRadius) {
                        e.shoot -= dt;
                        if (e.shoot <= 0) {
                            e.shoot = 2.0 - Math.min(1.0, stateRef.current.wave * 0.06);
                            effectsRef.current.push({ id: Date.now(), type: 'heal-aura', x: e.x, y: e.y, r: 0, maxR: e.healRadius, t: 0.5, maxT: 0.5 });
                            for(const other of enemiesRef.current) {
                                if (other !== e && other.hp < other.hpMax && ((e.x - other.x)**2 + (e.y - other.y)**2) < e.healRadius**2) {
                                    other.hp = Math.min(other.hpMax, other.hp + (e.healRate * (1 + stateRef.current.wave * 0.05)));
                                }
                            }
                        }
                    }
                    break;
                case 'summoner':
                    if(e.spawnCD) {
                        e.spawnCD -= dt;
                        if (e.spawnCD <= 0) {
                            e.spawnCD = 5.0 - Math.min(3.5, stateRef.current.wave * 0.15);
                            spawnEnemy('minion', stateRef.current.wave, {x: e.x, y: e.y});
                        }
                    }
                    break;
                case 'miniboss':
                    if (e.atk !== undefined) {
                        e.atk -= dt;
                        if (e.atk <= 0) {
                            e.atk = 2.2 - Math.min(1.6, stateRef.current.wave * 0.08);
                            playSfx('sfx-enemy-shoot');
                            for (let rb = 0; rb < 8; rb++) {
                                const angR = a + rb * (Math.PI * 2 / 8);
                                const spR = 360 + stateRef.current.wave * 18;
                                shotsRef.current.push({ x: e.x, y: e.y, vx: Math.cos(angR) * spR, vy: Math.sin(angR) * spR, r: 6, dmg: Math.ceil(12 * (0.9 + 0.15 * stateRef.current.wave)), t: 3.2 });
                            }
                        }
                    }
                    break;
                case 'boss_bullethell':
                    if (e.atk !== undefined && e.burstLeft !== undefined && e.burstGap !== undefined) {
                        e.atk -= dt;
                        if (e.burstLeft > 0) {
                            e.burstGap -= dt;
                            if (e.burstGap <= 0) {
                                e.burstGap = 0.09;
                                const ang = a + rand(-0.08, 0.08);
                                const sp = 480 + stateRef.current.wave * 15;
                                if (e.burstLeft % 3 === 0) playSfx('sfx-enemy-shoot');
                                shotsRef.current.push({ x: e.x, y: e.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: 6, dmg: Math.ceil(19 * (0.9 + 0.2 * stateRef.current.wave)), t: 3.0 });
                                e.burstLeft--;
                            }
                        } else if (e.atk <= 0) {
                            e.atk = 2.8 - Math.min(1.8, stateRef.current.wave * 0.08);
                            e.burstLeft = 10 + Math.floor(stateRef.current.wave / 5);
                            e.burstGap = 0;
                        }
                    }
                    break;
                case 'boss_tank':
                    if (e.atk !== undefined) {
                        e.atk -= dt;
                        if (e.atk <= 0) {
                            e.atk = 5.0 - Math.min(3.5, stateRef.current.wave * 0.12);
                            playSfx('sfx-stomp');
                            effectsRef.current.push({ id: Date.now(), type: 'shockwave', x: e.x, y: e.y, r: 15, maxR: 270, t: 0.3, maxT: 0.3 });
                            if (dToPSq < (270 + p.r)**2) handlePlayerDamage(e.dmg * 1.5, e);
                        }
                    }
                    break;
                case 'boss_summoner':
                    if(e.spawnCD) {
                        e.spawnCD -= dt;
                        if(e.spawnCD <= 0) {
                            e.spawnCD = 7.0 - Math.min(4.5, stateRef.current.wave * 0.15);
                            for(let k=0; k < 3; k++) spawnEnemy('minion', stateRef.current.wave, {x: e.x, y: e.y});
                        }
                    }
                    if(e.shoot) {
                        e.shoot -= dt;
                        if(e.shoot <= 0) {
                            e.shoot = 1.8 - Math.min(1.2, stateRef.current.wave * 0.08);
                            playSfx('sfx-enemy-shoot');
                            const sp = 420 + stateRef.current.wave * 8;
                            shotsRef.current.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 6, dmg: Math.ceil(14 * (0.9 + 0.15 * stateRef.current.wave)), t: 3 });
                        }
                    }
                    break;
            }
        }
        
        // Enemy separation logic to prevent stacking
        const allEnemies = enemiesRef.current;
        for (let i = 0; i < allEnemies.length; i++) {
            for (let j = i + 1; j < allEnemies.length; j++) {
                const e1 = allEnemies[i];
                const e2 = allEnemies[j];
                const collisionResult = checkCapsuleCapsuleCollision(e1, e2);

                if (collisionResult.collided && collisionResult.overlap && collisionResult.normal) {
                    const separationX = collisionResult.normal.x * collisionResult.overlap / 2;
                    const separationY = collisionResult.normal.y * collisionResult.overlap / 2;

                    e1.x += separationX;
                    e1.y += separationY;
                    e2.x -= separationX;
                    e2.y -= separationY;
                }
            }
        }

    }, [handlePlayerDamage, killEnemy, spawnEnemy, playSfx, addFloatingText]);
    
    const updateProjectiles = useCallback((dt: number) => {
        const p = playerRef.current;
        
        for (let i = pshotsRef.current.length - 1; i >= 0; i--) {
            const s = pshotsRef.current[i];
            if (s.hasTrail && s.trailPoints) {
                s.trailPoints.push({x: s.x, y: s.y});
                if (s.trailPoints.length > 8) {
                    s.trailPoints.shift();
                }
            }

            s.t -= dt; s.x += s.vx * dt; s.y += s.vy * dt;

            if (s.t <= 0 || s.x < -20 || s.y < -20 || s.x > virtualWidthRef.current + 20 || s.y > virtualHeightRef.current + 20) {
                pshotsRef.current.splice(i, 1);
                continue;
            }

            let projectileConsumed = false;

            for (let j = enemiesRef.current.length - 1; j >= 0; j--) {
                const en = enemiesRef.current[j];
                if (!en || (s.hitEnemies && s.hitEnemies.includes(en.id))) {
                    continue;
                }

                if (checkCapsuleCollision(en, s)) {
                    if (!s.hitEnemies) s.hitEnemies = [];
                    s.hitEnemies.push(en.id);

                    let damageAbsorbedByShield = 0;
                    if (en.affix === 'Shielded' && en.shield !== undefined && en.shield > 0) {
                        if (en.shieldRechargeTimer !== undefined) en.shieldRechargeTimer = 5.0;
                        
                        const damageToShield = Math.min(en.shield, s.dmg);
                        en.shield -= damageToShield;
                        damageAbsorbedByShield = damageToShield;
                        addFloatingText(en.x, en.y - 18, `${damageToShield}`, false, { color: '#00f2ff' });
                    }

                    const remainingDmg = s.dmg - damageAbsorbedByShield;
                    if (remainingDmg > 0) {
                      const { amount, isCrit } = critRollAndAmount(remainingDmg, s.forceCrit);
                      let finalAmount = amount;
                      if (isCrit && p.hollowPointsBonus) {
                          const missingHealth = en.hpMax - en.hp;
                          if (missingHealth > 0) {
                              finalAmount += Math.floor(missingHealth * p.hollowPointsBonus);
                          }
                      }
                      en.hp -= finalAmount;
                      addFloatingText(en.x, en.y - 9, `${finalAmount}`, isCrit, { numericAmount: finalAmount });
                      if (p.lifestealPercent) {
                          const healAmount = finalAmount * p.lifestealPercent;
                          const oldHp = p.hp;
                          p.hp = Math.min(p.hpMax, p.hp + healAmount);
                          const actualHeal = p.hp - oldHp;
                          if (actualHeal > 0.1) {
                            addFloatingText(p.x + rand(-15, 15), p.y - 27, `+${actualHeal.toFixed(1)} HP`, false, { color: '#4ade80', lifetime: 1.0 });
                          }
                      }
                    }

                    if (en.hp <= 0) {
                        killEnemy(j);
                    } else {
                        playSfx('sfx-hit');
                    }
                    
                    // --- Perk Synergy Logic ---

                    // On-hit effect: explosion. Happens regardless of piercing.
                    if (s.explosive) {
                        createExplosion(en.x, en.y, 100, Math.floor(s.dmg * 0.7), true, true);
                    }

                    // Projectile continuation logic.
                    if (s.pierce !== undefined && s.pierce > 0) {
                        s.pierce--;
                        // Projectile continues.
                    } else if (s.chainLightning && s.bouncesLeft !== undefined && s.bouncesLeft > 0) {
                        let newTarget: Enemy | null = null;
                        let min_dist_sq = Infinity;
                        const CHAIN_RADIUS_SQ = 350**2;

                        for (const potentialTarget of enemiesRef.current) {
                            if (s.hitEnemies.includes(potentialTarget.id)) continue;
                            const dist_sq = (en.x - potentialTarget.x)**2 + (en.y - potentialTarget.y)**2;
                            if (dist_sq < min_dist_sq && dist_sq < CHAIN_RADIUS_SQ) {
                                min_dist_sq = dist_sq;
                                newTarget = potentialTarget;
                            }
                        }
                        if (newTarget) {
                            s.bouncesLeft--;
                            effectsRef.current.push({
                                id: Date.now() + Math.random(), type: 'chain-lightning', 
                                x: en.x, y: en.y, endX: newTarget.x, endY: newTarget.y,
                                r: 0, maxR: 0, t: 0.2, maxT: 0.2
                            });
                            const angle = Math.atan2(newTarget.y - en.y, newTarget.x - en.x);
                            const speed = Math.hypot(s.vx, s.vy);
                            s.vx = Math.cos(angle) * speed;
                            s.vy = Math.sin(angle) * speed;
                            s.x = en.x; s.y = en.y; // Start from the enemy just hit
                            s.dmg = Math.floor(s.dmg * 0.75); // Damage falloff
                        } else {
                            projectileConsumed = true; // No target found, projectile dies.
                        }
                    } else if (p.ricochet > 0 && Math.random() < p.ricochet) {
                        let newTarget: Enemy | null = null;
                        let min_dist_sq = Infinity;
                        const RICOCHET_RADIUS_SQ = 450**2; // Give ricochet a bit more range

                        for (const potentialTarget of enemiesRef.current) {
                            if (s.hitEnemies.includes(potentialTarget.id)) continue;
                            const dist_sq = (en.x - potentialTarget.x)**2 + (en.y - potentialTarget.y)**2;
                            if (dist_sq < min_dist_sq && dist_sq < RICOCHET_RADIUS_SQ) {
                                min_dist_sq = dist_sq;
                                newTarget = potentialTarget;
                            }
                        }
                        if (newTarget) {
                            playSfx('sfx-ricochet');
                            const angle = Math.atan2(newTarget.y - en.y, newTarget.x - en.x);
                            const speed = Math.hypot(s.vx, s.vy) * 1.2; // Increase speed
                            s.vx = Math.cos(angle) * speed;
                            s.vy = Math.sin(angle) * speed;
                            s.x = en.x; s.y = en.y; // Start from the enemy just hit
                            s.hasTrail = true;
                            s.trailPoints = [{x: en.x, y: en.y}];
                        } else {
                            projectileConsumed = true;
                        }
                    } else {
                        projectileConsumed = true;
                    }
                    
                    if (projectileConsumed) break;
                }
            }

            if (projectileConsumed) {
                pshotsRef.current.splice(i, 1);
            }
        }

        for (let i = shotsRef.current.length - 1; i >= 0; i--) {
            const s = shotsRef.current[i];
            s.t -= dt; s.x += s.vx * dt; s.y += s.vy * dt;
            if (s.t <= 0 || s.x < 0 || s.y < 0 || s.x > virtualWidthRef.current || s.y > virtualHeightRef.current) {
                shotsRef.current.splice(i, 1);
                continue;
            }
            if (checkCapsuleCollision(p, s)) {
                handlePlayerDamage(s.dmg);
                if(s.slows) {
                    p.slow = { duration: 3, factor: 0.5 };
                }
                shotsRef.current.splice(i, 1);
            }
        }
    }, [critRollAndAmount, addFloatingText, killEnemy, playSfx, handlePlayerDamage, createExplosion]);

    const updateDropsAndOrbs = useCallback((dt: number) => {
        stateRef.current.vacuumAllTimer = Math.max(0, stateRef.current.vacuumAllTimer - dt);
        const p = playerRef.current;
        const BASE_PICKUP_RADIUS = 120;
        const rangeMul = statModsRef.current.orbRangeMul || 1;
        const effectivePickupRadius = BASE_PICKUP_RADIUS * rangeMul;

        for (let i = orbsRef.current.length - 1; i >= 0; i--) {
            const o = orbsRef.current[i];
            const distSq = (p.x - o.x)**2 + (p.y - o.y)**2;
            const pickupRadiusSq = (effectivePickupRadius + o.r)**2;
            
            if (stateRef.current.vacuumAllTimer > 0 || distSq < pickupRadiusSq) {
                 const dx = p.x - o.x, dy = p.y - o.y, D = Math.hypot(dx, dy) || 1;
                 const sp = 600;
                 o.x += (dx / D) * sp * dt; o.y += (dy / D) * sp * dt;
            }
            if (((p.x - o.x)**2 + (p.y - o.y)**2) < (p.r + o.r)**2) {
                gainXP(o.xp);
                if (perkCountsRef.current['adrenaline']) {
                    playerRef.current.invuln = Math.max(playerRef.current.invuln, 0.2 * perkCountsRef.current['adrenaline']);
                }
                orbsRef.current.splice(i, 1);
            }
        }
        for (let i = dropsRef.current.length - 1; i >= 0; i--) {
            const d = dropsRef.current[i];
            d.t -= dt;
            if (d.t <= 0) { dropsRef.current.splice(i, 1); continue; }

            const distSq = (p.x - d.x)**2 + (p.y - d.y)**2;
            const pickupRadiusSq = (effectivePickupRadius + d.r)**2;
            
            if (stateRef.current.vacuumAllTimer > 0 || distSq < pickupRadiusSq) {
                 // FIX: Corrected a copy-paste error by using `d.y` instead of `o.y`.
                 const dx = p.x - d.x, dy = p.y - d.y, D = Math.hypot(dx, dy) || 1;
                 const sp = 600;
                 d.x += (dx / D) * sp * dt; d.y += (dy / D) * sp * dt;
            }

            // FIX: Corrected a copy-paste error by using `d.y` instead of `o.y`.
            if (((p.x - d.x)**2 + (p.y - d.y)**2) < (p.r + d.r)**2) {
                if (d.type === 'magnet') {
                    stateRef.current.vacuumAllTimer = Math.max(stateRef.current.vacuumAllTimer, 6);
                    addFloatingText(p.x, p.y - 36, 'Magnet!', true);
                    playSfx('sfx-item-pickup');
                } else if (d.type === 'item' && d.itemId) {
                    if(equipItem(d.itemId)) playSfx('sfx-item-pickup');
                } else if (d.type === 'goldenCoin') {
                    coinsThisRunRef.current++;
                    if (coinSfxCooldownRef.current <= 0) {
                        playSfx('sfx-coin-pickup');
                        coinSfxCooldownRef.current = 0.05;
                    }
                } else if (d.type === 'health') {
                    const healAmount = p.hpMax * 0.25;
                    const oldHp = p.hp;
                    p.hp = Math.min(p.hpMax, p.hp + healAmount);
                    const actualHeal = p.hp - oldHp;
                    if (actualHeal > 0) {
                      addFloatingText(p.x, p.y - 27, `+${Math.floor(actualHeal)} HP`, false, { color: '#4ade80', lifetime: 1.5 });
                    }
                    playSfx('sfx-item-pickup');
                }
                dropsRef.current.splice(i, 1);
            }
        }
    }, [gainXP, equipItem, addFloatingText, playSfx]);

    const updateFloatingTexts = useCallback((dt: number) => {
        for (let i = floatingTextsRef.current.length - 1; i >= 0; i--) {
            const ft = floatingTextsRef.current[i];
            ft.y -= 75 * dt;
            ft.t = (ft.t ?? 1) - dt;
            if (ft.t <= 0) {
                floatingTextsRef.current.splice(i, 1);
            }
        }
    }, []);

  const runDemoAI = useCallback((dt: number) => {
    const p = playerRef.current;
    if (!p) return;

    let nearestEnemy: Enemy | null = null;
    let minDistanceSq = Infinity;
    for (const enemy of enemiesRef.current) {
      const dx = enemy.x - p.x;
      const dy = enemy.y - p.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < minDistanceSq) {
        minDistanceSq = distSq;
        nearestEnemy = enemy;
      }
    }
    demoAIStateRef.current.target = nearestEnemy;

    if (nearestEnemy) {
      p.aimAngle = Math.atan2(nearestEnemy.y - p.y, nearestEnemy.x - p.x);
      p.facingDirection = (p.aimAngle > -Math.PI / 2 && p.aimAngle < Math.PI / 2) ? 1 : -1;
      attack(nearestEnemy);
    }

    demoAIStateRef.current.moveTimer -= dt;
    if (demoAIStateRef.current.moveTimer <= 0) {
      demoAIStateRef.current.moveTimer = rand(2, 4);
      if (nearestEnemy && Math.random() < 0.8) {
        const angleToEnemy = Math.atan2(nearestEnemy.y - p.y, nearestEnemy.x - p.x);
        const kiteAngle = angleToEnemy + Math.PI + rand(-Math.PI / 3, Math.PI / 3);
        demoAIStateRef.current.moveTarget.x = p.x + Math.cos(kiteAngle) * 500;
        demoAIStateRef.current.moveTarget.y = p.y + Math.sin(kiteAngle) * 500;
      } else {
        demoAIStateRef.current.moveTarget.x = rand(100, virtualWidthRef.current - 100);
        demoAIStateRef.current.moveTarget.y = rand(100, virtualHeightRef.current - 100);
      }
    }

    const mdx = demoAIStateRef.current.moveTarget.x - p.x;
    const mdy = demoAIStateRef.current.moveTarget.y - p.y;
    const mag = Math.hypot(mdx, mdy) || 1;
    let vx = 0, vy = 0;
    if (mag > 30) {
      vx = mdx / mag;
      vy = mdy / mag;
    }

    const isMoving = Math.hypot(vx, vy) > 0.1;
    if (isMoving) {
        const moveMag = Math.hypot(vx, vy) || 1;
        p.x += (vx / moveMag) * p.speed * dt;
        p.y += (vy / moveMag) * p.speed * dt;
        p.facing = Math.atan2(vy, vx);
        p.runT += dt * 8;
        p.bob = Math.sin(p.runT) * 4;
    } else {
        p.runT = 0;
        if (Math.abs(p.bob) > 0.1) { p.bob *= 0.9; } else { p.bob = 0; }
    }
    p.x = clamp(p.x, p.r, virtualWidthRef.current - p.r);
    p.y = clamp(p.y, p.r, virtualHeightRef.current - p.r);

    if (p.jumpCooldown <= 0 && minDistanceSq < (200 ** 2) && Math.random() < 0.03) {
      tryJump();
    }
  }, [attack, tryJump]);

  const drawDetailedCharacter = useCallback((
    ctx: CanvasRenderingContext2D,
    character: Player | Enemy,
    isPlayer: boolean,
    aimAngle: number,
    isOutline = false,
    outlineColor = ''
  ) => {
      const p = character;
      const bob = isPlayer ? (p as Player).bob : 0;
      const moving = p.runT > 0;
      const runT = p.runT;
  
      ctx.save();
      ctx.translate(p.x, p.y);
      if (isPlayer && !isOutline && (p as Player).invuln > 0 && Math.floor((p as Player).invuln * 10) % 2 === 0) {
          ctx.globalAlpha = 0.5;
      }
      ctx.scale(p.facingDirection, 1);
  
      // FIX: Explicitly cast 'p.r' to a number to resolve type inference issues causing arithmetic errors.
      const scale = (p.r as number) / 14; 
      const baseScale = scale;

      if (isOutline) {
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.shadowColor = outlineColor;
          ctx.shadowBlur = 10;
          ctx.globalAlpha = 0.8;
      } else {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
      
      const idleSway = Math.sin(stateRef.current.elapsed * 2) * 0.05;
  
      // --- Define Colors ---
      const enemy = isPlayer ? null : p as Enemy;
      
      if (!isPlayer && enemy?.bossType === 'don') {
          // --- The Don Drawing Logic ---
          // FIX: Explicitly cast 'p.r' to a number to resolve type inference issues causing arithmetic errors.
          const donScale = (p.r as number) / 45; 
          const bodyColor = isOutline ? outlineColor : '#2d3748';
          const pinstripeColor = isOutline ? outlineColor : '#4a5568';
          const shirtColor = isOutline ? outlineColor : '#E5E7EB';
          const skinColor = isOutline ? outlineColor : '#f2d5b1';
          const hatColor = isOutline ? outlineColor : '#1a1a1a';
          const hatBandColor = isOutline ? outlineColor : '#c53030';
          const briefcaseColor = isOutline ? outlineColor : '#111';
          const gunColor = '#444';
          const gunWoodColor = '#6b4623';

          // Legs and Feet
          ctx.save();
          ctx.translate(0, 25 * donScale);
          ctx.strokeStyle = bodyColor;
          ctx.lineWidth = isOutline ? 30 * donScale : 18 * donScale;
          // Left leg
          ctx.beginPath(); ctx.moveTo(-15 * donScale, 0); ctx.lineTo(-20 * donScale, 20 * donScale); ctx.stroke();
          // Right leg
          ctx.beginPath(); ctx.moveTo(15 * donScale, 0); ctx.lineTo(20 * donScale, 20 * donScale); ctx.stroke();
          // Feet
          ctx.fillStyle = hatColor;
          ctx.beginPath(); ctx.ellipse(-25 * donScale, 22 * donScale, 10 * donScale, 5 * donScale, 0, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(25 * donScale, 22 * donScale, 10 * donScale, 5 * donScale, 0, 0, Math.PI * 2); ctx.fill();
          ctx.restore();

          // Body
          ctx.fillStyle = bodyColor;
          ctx.beginPath(); ctx.ellipse(0, 0, 40 * donScale, 45 * donScale, 0, 0, Math.PI * 2); ctx.fill();

          if (!isOutline) { // Pinstripes
              ctx.strokeStyle = pinstripeColor; ctx.lineWidth = 1.5 * donScale;
              for (let i = -4; i <= 4; i++) {
                  if (i === 0) continue;
                  const x = i * 6 * donScale;
                  const yOffset = Math.sqrt(Math.max(0, 1 - (x / (40 * donScale))**2)) * 45 * donScale;
                  ctx.beginPath(); ctx.moveTo(x, -yOffset); ctx.lineTo(x, yOffset); ctx.stroke();
              }
          }

          // Shirt & Vest
          ctx.fillStyle = shirtColor;
          ctx.beginPath(); ctx.moveTo(0, -35 * donScale); ctx.lineTo(15 * donScale, 5 * donScale); ctx.lineTo(-15 * donScale, 5 * donScale); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = bodyColor; ctx.lineWidth = 10 * donScale;
          ctx.beginPath(); ctx.moveTo(0, -35 * donScale); ctx.lineTo(20 * donScale, 10 * donScale); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, -35 * donScale); ctx.lineTo(-20 * donScale, 10 * donScale); ctx.stroke();
          
          if (!isOutline) { // Buttons
              ctx.fillStyle = '#111';
              [ -10, 0, 10 ].forEach(yOff => {
                  ctx.beginPath(); ctx.arc(0, yOff * donScale, 3 * donScale, 0, Math.PI * 2); ctx.fill();
              });
          }

          // Head
          const headY = -40 * donScale;
          ctx.fillStyle = skinColor;
          ctx.beginPath(); ctx.ellipse(0, headY, 20 * donScale, 18 * donScale, 0, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(-15 * donScale, headY + 10 * donScale, 8 * donScale, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(15 * donScale, headY + 10 * donScale, 8 * donScale, 0, Math.PI * 2); ctx.fill();
          
          // Hat
          ctx.fillStyle = hatColor;
          ctx.beginPath(); ctx.ellipse(0, headY - 12 * donScale, 30 * donScale, 6 * donScale, 0, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(0, headY - 20 * donScale, 22 * donScale, 10 * donScale, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = hatBandColor;
          ctx.fillRect(-23 * donScale, headY - 18 * donScale, 46 * donScale, 6 * donScale);

          // Glasses
          ctx.fillStyle = '#000';
          ctx.beginPath(); ctx.arc(-10 * donScale, headY, 6 * donScale, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(10 * donScale, headY, 6 * donScale, 0, Math.PI * 2); ctx.fill();
          if (!isOutline) { // Lightning bolts on glasses
              ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * donScale;
              const drawBolt = (x_offset:number) => {
                  ctx.beginPath();
                  ctx.moveTo(x_offset - 3 * donScale, headY - 3 * donScale); ctx.lineTo(x_offset + 3 * donScale, headY + 3 * donScale);
                  ctx.moveTo(x_offset - 3 * donScale, headY); ctx.lineTo(x_offset, headY - 3 * donScale);
                  ctx.moveTo(x_offset, headY + 3 * donScale); ctx.lineTo(x_offset + 3 * donScale, headY);
                  ctx.stroke();
              };
              drawBolt(-10 * donScale); drawBolt(10 * donScale);
          }
          
          // Arms & Items
          ctx.save();
          const rotAngle = p.facingDirection === 1 ? aimAngle : Math.PI - aimAngle;
          ctx.rotate(rotAngle + idleSway);
          
          // Briefcase arm (back)
          ctx.strokeStyle = bodyColor; ctx.lineWidth = isOutline ? 24 * donScale : 20 * donScale;
          ctx.beginPath(); ctx.moveTo(0, -20 * donScale); ctx.lineTo(30 * donScale, 20 * donScale); ctx.stroke();
          ctx.fillStyle = briefcaseColor;
          ctx.fillRect(20 * donScale, 25 * donScale, 30 * donScale, 20 * donScale);
          
          // Tommy gun arm (front)
          ctx.beginPath(); ctx.moveTo(10 * donScale, -20 * donScale); ctx.lineTo(50 * donScale, -10 * donScale); ctx.stroke();
          
          // Tommy Gun
          ctx.save();
          ctx.translate(50 * donScale, -10 * donScale);
          ctx.fillStyle = gunColor;
          ctx.fillRect(-10 * donScale, -5 * donScale, 40 * donScale, 10 * donScale);
          ctx.fillRect(30 * donScale, -2 * donScale, 25 * donScale, 4 * donScale);
          ctx.beginPath(); ctx.arc(15 * donScale, 15 * donScale, 12 * donScale, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = gunWoodColor;
          ctx.fillRect(-15 * donScale, 5 * donScale, 8 * donScale, 15 * donScale);
          ctx.fillRect(25 * donScale, 5 * donScale, 8 * donScale, 10 * donScale);
          ctx.restore();

          ctx.restore();
          ctx.restore(); // End main transform
          return;
      }
      
      const skinColor = isOutline ? outlineColor : isPlayer ? '#f2d5b1' : '#d1b59a';
      const playerHairColor = '#1a1a1a';
      const hairColor = isOutline ? outlineColor : isPlayer ? playerHairColor : enemy?.hairColor || '#1a1a1a';
      const suitColor = isOutline ? outlineColor : isPlayer ? '#222' : '#444';
      const shirtColor = isOutline ? outlineColor : isPlayer ? '#E5E7EB' : enemy?.shirtColor || '#aaa';
      const tieColor = isPlayer ? '#111' : '#990000';
      const pantsColor = isOutline ? outlineColor : isPlayer ? '#1a1a1a' : enemy?.pantsColor || '#3a3a3a';
      const gunmetalColor = '#111827';
      const silverColor = '#D1D5DB';

      // --- LEGS & BELT ---
      ctx.save();
      ctx.translate(0, bob);
      let legAngle = 0, backLegAngle = 0, kneeAngle = 0, backKneeAngle = 0;
      if (moving) {
          legAngle = Math.sin(runT * 0.5) * 0.6;
          kneeAngle = Math.max(0, Math.cos(runT * 0.5)) * 0.7;
          backLegAngle = Math.sin(runT * 0.5 + Math.PI) * 0.6;
          backKneeAngle = Math.max(0, Math.cos(runT * 0.5 + Math.PI)) * 0.7;
      }
  
      const upperLegL = 16 * baseScale, lowerLegL = 18 * baseScale;
      const hipY = 8 * baseScale;
      
      const drawLeg = (lAngle: number, kAngle: number) => {
          ctx.strokeStyle = pantsColor;
          ctx.lineWidth = isOutline ? 18 * baseScale : 6 * baseScale;
          ctx.beginPath();
          ctx.moveTo(0, hipY);
          const kneeX = Math.sin(lAngle) * upperLegL;
          const kneeY = hipY + Math.cos(lAngle) * upperLegL;
          ctx.lineTo(kneeX, kneeY);
  
          const footX = kneeX + Math.sin(lAngle + kAngle) * lowerLegL;
          const footY = kneeY + Math.cos(lAngle + kAngle) * lowerLegL;
          ctx.lineTo(footX, footY);
          ctx.stroke();
      };
      
      drawLeg(backLegAngle, backKneeAngle);
      drawLeg(legAngle, kneeAngle);

      if (isPlayer && !isOutline) {
          ctx.strokeStyle = '#333';
          ctx.lineWidth = 3 * baseScale;
          ctx.beginPath();
          ctx.moveTo(-6 * baseScale, hipY);
          ctx.lineTo(6 * baseScale, hipY);
          ctx.stroke();

          ctx.fillStyle = '#ccc';
          ctx.fillRect(6 * baseScale, hipY - 3 * baseScale, 4 * baseScale, 6 * baseScale);
      }
      ctx.restore(); // leg bob
  
      // --- TORSO & HEAD ---
      ctx.save();
      ctx.translate(0, bob);
      const shoulderY = -18 * baseScale;
      
      // Shirt & Tie
      ctx.fillStyle = shirtColor;
      ctx.beginPath();
      ctx.moveTo(0, shoulderY);
      ctx.lineTo(7 * baseScale, shoulderY + 2 * baseScale);
      ctx.lineTo(3 * baseScale, hipY);
      ctx.lineTo(-3 * baseScale, hipY);
      ctx.lineTo(-7 * baseScale, shoulderY + 2 * baseScale);
      ctx.closePath();
      ctx.fill();

      if (isPlayer && !isOutline) {
        ctx.fillStyle = tieColor;
        ctx.beginPath();
        ctx.moveTo(0, shoulderY + 4 * baseScale);
        ctx.lineTo(2 * baseScale, hipY - 2 * baseScale);
        ctx.lineTo(-2 * baseScale, hipY - 2 * baseScale);
        ctx.closePath();
        ctx.fill();
      }

      // Suit Jacket
      ctx.strokeStyle = suitColor;
      ctx.lineWidth = isOutline ? 22 * baseScale : 14 * baseScale;
      ctx.beginPath();
      ctx.moveTo(0, hipY);
      ctx.lineTo(0, shoulderY);
      ctx.stroke();

      // Head
      const headY = -32 * baseScale;
      ctx.fillStyle = skinColor;
      ctx.beginPath();
      ctx.arc(0, headY, isOutline ? 11 * baseScale : 10 * baseScale, 0, Math.PI * 2);
      ctx.fill();
      if (!isOutline) {
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1.5 * baseScale;
        ctx.stroke();
      }
  
      // Character-specific details
      if (!isOutline) {
          if (isPlayer) {
              ctx.fillStyle = playerHairColor;
              
              // Beard
              ctx.beginPath();
              ctx.moveTo(8 * baseScale, headY + 9 * baseScale); // Bottom point of beard
              ctx.quadraticCurveTo(0, headY + 12 * baseScale, -8 * baseScale, headY + 9 * baseScale); // Chin curve
              ctx.lineTo(-8 * baseScale, headY - 2 * baseScale); // Left sideburn
              ctx.arc(0, headY, 10 * baseScale, Math.PI * 0.7, Math.PI * 0.35, true); // jawline arc
              ctx.lineTo(8 * baseScale, headY - 2 * baseScale); // Right sideburn
              ctx.closePath();
              ctx.fill();
              
              // Hair
              ctx.beginPath();
              ctx.moveTo(-10 * baseScale, headY - 3 * baseScale); // Back of hair
              ctx.bezierCurveTo(-14 * baseScale, headY - 14 * baseScale, 5 * baseScale, headY - 18 * baseScale, 10 * baseScale, headY - 8 * baseScale); // Top of hair
              ctx.lineTo(10.5 * baseScale, headY - 4 * baseScale); // Front hairline
              ctx.arc(0, headY, 10 * baseScale, -Math.PI * 0.25, -Math.PI * 0.6, true); // Connecting to side
              ctx.closePath();
              ctx.fill();
    
              // Moustache
              ctx.beginPath();
              ctx.moveTo(9 * baseScale, headY + 3 * baseScale);
              ctx.quadraticCurveTo(4 * baseScale, headY + 5 * baseScale, 1 * baseScale, headY + 3 * baseScale);
              ctx.fill();
    
              // Nose
              ctx.strokeStyle = '#000';
              ctx.lineWidth = 1.5 * baseScale;
              ctx.beginPath();
              ctx.moveTo(10 * baseScale, headY - 2 * baseScale);
              ctx.lineTo(8 * baseScale, headY + 2 * baseScale);
              ctx.stroke();
              
              // Eye
              ctx.strokeStyle = playerHairColor;
              ctx.lineWidth = 1.5 * baseScale;
              ctx.beginPath();
              ctx.moveTo(8 * baseScale, headY - 4 * baseScale);
              ctx.lineTo(5 * baseScale, headY - 3.5 * baseScale);
              ctx.stroke();
          } else { // Enemy faces
              ctx.fillStyle = hairColor;
              ctx.beginPath();
              ctx.arc(0, headY, 10 * baseScale, Math.PI, 0);
              ctx.rect(-10 * baseScale, headY, 20 * baseScale, 0);
              ctx.fill();
              
              ctx.strokeStyle = '#000';
              ctx.lineWidth = 1 * baseScale;
              const faceY = headY - 3 * baseScale;
              // Eyes
              ctx.beginPath();
              if (enemy?.faceType === 'angry') {
                  ctx.moveTo(8 * baseScale, faceY - 2); ctx.lineTo(3 * baseScale, faceY);
                  ctx.moveTo(1 * baseScale, faceY - 2); ctx.lineTo(-4 * baseScale, faceY);
              } else {
                  ctx.arc(5 * baseScale, faceY, 1.5 * baseScale, 0, Math.PI * 2);
                  ctx.moveTo(-2 * baseScale, faceY);
                  ctx.arc(-2 * baseScale, faceY, 1.5 * baseScale, 0, Math.PI * 2);
              }
              ctx.stroke();
              // Mouth
              ctx.beginPath();
              if (enemy?.faceType === 'angry') { ctx.arc(2 * baseScale, headY + 5 * baseScale, 4 * baseScale, Math.PI * 0.1, Math.PI * 0.9); }
              else if (enemy?.faceType === 'smirk') { ctx.moveTo(7 * baseScale, headY + 5 * baseScale); ctx.quadraticCurveTo(2 * baseScale, headY + 3 * baseScale, -2 * baseScale, headY + 5 * baseScale); }
              ctx.stroke();
          }
      }

      ctx.restore(); // torso bob
  
      // --- ARMS and WEAPONS ---
      ctx.save();
      ctx.translate(0, bob);
      
      const upperArmL = 15 * baseScale, lowerArmL = 16 * baseScale;
      const isMelee = !isPlayer && !!enemy?.meleeWeapon;

      const drawArm = (sleeveColor: string, handColor: string) => {
          ctx.strokeStyle = isOutline ? outlineColor : sleeveColor;
          ctx.lineWidth = isOutline ? 18 * baseScale : 10 * baseScale;
          ctx.beginPath();
          ctx.moveTo(0, shoulderY);
          const elbowX = upperArmL; const elbowY = shoulderY; ctx.lineTo(elbowX, elbowY);
          const handX = elbowX + lowerArmL; const handY = elbowY; ctx.lineTo(handX, handY);
          ctx.stroke();
          ctx.fillStyle = isOutline ? outlineColor : handColor; 
          ctx.beginPath(); 
          ctx.arc(handX, handY, isOutline ? 6.5 * baseScale : 5.5 * baseScale, 0, Math.PI * 2); 
          ctx.fill();
          return { handX, handY };
      };
      
      // Back Arm
      ctx.save();
      const rotAngle = p.facingDirection === 1 ? aimAngle : Math.PI - aimAngle;
      if (isMelee) { ctx.rotate(0.2 + idleSway); } 
      else { ctx.rotate(rotAngle + idleSway * (moving ? 0.2 : 1)); }
      drawArm(suitColor, skinColor);
      ctx.restore();

      // Front Arm & Weapon
      ctx.save();
      if (isMelee) {
          const attackProgress = enemy.meleeAttackTimer && enemy.meleeAttackTimer > 0 ? (0.4 - enemy.meleeAttackTimer) / 0.4 : 0;
          const swingAngle = Math.sin(attackProgress * Math.PI) * -1.8;
          ctx.rotate(rotAngle + swingAngle);
      } else {
          ctx.rotate(rotAngle + idleSway * (moving ? 0.2 : 1));
      }
      const { handX, handY } = drawArm(suitColor, skinColor);
      
      // Weapon
      ctx.save();
      ctx.translate(handX - 4 * baseScale, handY);
      
      if (isMelee) {
          if (enemy.meleeWeapon === 'bat') {
              ctx.fillStyle = isOutline ? outlineColor : '#854d0e'; ctx.beginPath(); ctx.roundRect(-4 * baseScale, -4 * baseScale, 30 * baseScale, 8 * baseScale, 4 * baseScale);
          } else if (enemy.meleeWeapon === 'knife') {
              ctx.fillStyle = isOutline ? outlineColor : '#9ca3af'; ctx.beginPath(); ctx.moveTo(0, -3 * baseScale); ctx.lineTo(25 * baseScale, 0); ctx.lineTo(0, 3 * baseScale); ctx.closePath();
          }
          ctx.fill(); 
          if (!isOutline) {
            ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5 * baseScale;
            ctx.stroke();
          }
      } else { // Gun
          let gunType = 'pistol';
          if (isPlayer) {
              const playerEvo = (p as Player).evo.gun;
              if (playerEvo === 'shotgun' || playerEvo === 'smg') {
                  gunType = playerEvo;
              }
          }
  
          if (!isOutline) {
              ctx.strokeStyle = '#222';
              ctx.lineWidth = 1.5 * baseScale;
          }
          
          switch (gunType) {
              case 'shotgun':
                  ctx.fillStyle = isOutline ? outlineColor : '#854d0e'; // wood color
                  ctx.beginPath(); // Stock
                  ctx.moveTo(0, -2 * baseScale);
                  ctx.lineTo(-12 * baseScale, -4 * baseScale);
                  ctx.lineTo(-15 * baseScale, 6 * baseScale);
                  ctx.lineTo(-3 * baseScale, 8 * baseScale);
                  ctx.closePath();
                  ctx.fill();
                  if (!isOutline) ctx.stroke();
                  
                  ctx.fillStyle = isOutline ? outlineColor : gunmetalColor;
                  ctx.beginPath(); // Body and barrel
                  ctx.rect(0, -5 * baseScale, 28 * baseScale, 6 * baseScale); // Barrel
                  ctx.rect(0, -2 * baseScale, 15 * baseScale, 8 * baseScale); // Body
                  ctx.fill();
                  if (!isOutline) {
                    ctx.beginPath();
                    ctx.rect(0, -5 * baseScale, 28 * baseScale, 6 * baseScale);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.rect(0, -2 * baseScale, 15 * baseScale, 8 * baseScale);
                    ctx.stroke();
                  }
                  break;
  
              case 'smg':
                  ctx.fillStyle = isOutline ? outlineColor : gunmetalColor;
                  ctx.beginPath(); // Main body
                  ctx.rect(-2 * baseScale, -6 * baseScale, 25 * baseScale, 8 * baseScale);
                  ctx.fill();
                  if (!isOutline) ctx.stroke();
  
                  ctx.beginPath(); // Magazine
                  ctx.rect(5 * baseScale, 2 * baseScale, 6 * baseScale, 12 * baseScale);
                  ctx.fill();
                  if (!isOutline) ctx.stroke();
                  
                  ctx.beginPath(); // Stock
                  ctx.strokeStyle = isOutline ? outlineColor : gunmetalColor;
                  ctx.lineWidth = isOutline ? 6 * baseScale : 3 * baseScale;
                  ctx.moveTo(-2 * baseScale, -2 * baseScale);
                  ctx.lineTo(-12 * baseScale, -2 * baseScale);
                  ctx.lineTo(-14 * baseScale, 4 * baseScale);
                  ctx.stroke();
                  break;
                  
              default: // Pistol
                  const gunL = 22 * baseScale, gunH = 10 * baseScale;
                  ctx.fillStyle = isOutline ? outlineColor : (isPlayer ? silverColor : gunmetalColor);
                  ctx.beginPath();
                  ctx.moveTo(0, -gunH * 0.2); ctx.lineTo(0, gunH * 0.6); ctx.lineTo(gunL * 0.3, gunH * 0.6); ctx.lineTo(gunL * 0.4, -gunH * 0.5);
                  ctx.lineTo(gunL, -gunH * 0.5); ctx.lineTo(gunL, -gunH); ctx.lineTo(gunL * 0.3, -gunH); ctx.closePath();
                  ctx.fill(); 
                  if (!isOutline) {
                      ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5 * baseScale;
                      ctx.stroke();
                  }
                  break;
          }
      }
      ctx.restore();
      ctx.restore();

      ctx.restore(); // end arms
      ctx.restore(); // end main transform
  }, []);

  const drawItemDrop = useCallback((ctx: CanvasRenderingContext2D, drop: Drop, bob: number) => {
      const item = drop.itemId ? ITEMS[drop.itemId] : null;
      if (!item) return;
  
      ctx.save();
      ctx.translate(drop.x, drop.y + bob);
  
      const r = drop.r || 15;
      const rarityColors: Record<string, string> = {
          white: '#E5E7EB', blue: '#00f2ff', purple: '#ff00ff', gold: '#FBBF24'
      };
      const color = rarityColors[item.rarity] || '#E5E7EB';
      const darkColor = '#4B5563';
  
      ctx.strokeStyle = color;
      ctx.fillStyle = darkColor;
      ctx.lineWidth = 3;
  
      switch(item.slot) {
          case 'head': // Helmet
              ctx.beginPath();
              ctx.moveTo(-r * 0.7, r * 0.1);
              ctx.arc(0, r * 0.1, r * 0.7, Math.PI, 0);
              ctx.lineTo(r * 0.7, r * 0.5);
              ctx.lineTo(-r * 0.7, r * 0.5);
              ctx.closePath();
              break;
          case 'body': // Armor
              ctx.beginPath();
              ctx.moveTo(-r * 0.8, -r * 0.6);
              ctx.lineTo(r * 0.8, -r * 0.6);
              ctx.lineTo(r * 0.6, r * 0.7);
              ctx.lineTo(-r * 0.6, r * 0.7);
              ctx.closePath();
              break;
          case 'boots': // Boots
              ctx.beginPath();
              ctx.moveTo(-r * 0.6, -r * 0.7);
              ctx.lineTo(r * 0.2, -r * 0.7);
              ctx.lineTo(r * 0.2, r * 0.2);
              ctx.lineTo(r * 0.8, r * 0.2);
              ctx.lineTo(r * 0.8, r * 0.7);
              ctx.lineTo(-r * 0.6, r * 0.7);
              ctx.closePath();
              break;
          case 'charm': // Relic/Charm
              ctx.beginPath();
              ctx.moveTo(0, -r);
              ctx.lineTo(r * 0.3, -r * 0.3);
              ctx.lineTo(r, 0);
              ctx.lineTo(r * 0.3, r * 0.3);
              ctx.lineTo(0, r);
              ctx.lineTo(-r * 0.3, r * 0.3);
              ctx.lineTo(-r, 0);
              ctx.lineTo(-r * 0.3, -r * 0.3);
              ctx.closePath();
              break;
          default:
              ctx.fillStyle = drop.color || '#ddd';
              ctx.beginPath();
              ctx.arc(0, 0, r, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = 'black';
              ctx.font = 'bold 16px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('?', 0, 0);
              ctx.restore();
              return;
      }
      ctx.stroke();
      ctx.fill();
  
      ctx.restore();
  }, []);

  const renderGame = useCallback((ctx: CanvasRenderingContext2D) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    ctx.fillStyle = '#111827'; // bg-gray-900 for letterboxing
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();

    const p = playerRef.current;
    const camX = clamp(p.x - canvas.width / 2, 0, virtualWidthRef.current - canvas.width);
    const camY = clamp(p.y - canvas.height / 2, 0, virtualHeightRef.current - canvas.height);
    ctx.translate(-camX, -camY);

    const gradientX = p && typeof p.x === 'number' ? p.x : virtualWidthRef.current / 2;
    const gradientY = p && typeof p.y === 'number' ? p.y : virtualHeightRef.current / 2;
    const grd = ctx.createRadialGradient(gradientX, gradientY, 100, virtualWidthRef.current / 2, virtualHeightRef.current / 2, Math.max(virtualWidthRef.current, virtualHeightRef.current));
    grd.addColorStop(0, '#4f2f7f');
    grd.addColorStop(1, '#1a0a3a');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, virtualWidthRef.current, virtualHeightRef.current);
    
    // Grid
    const gridSize = 50;
    ctx.strokeStyle = 'rgba(0, 242, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= virtualWidthRef.current; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, virtualHeightRef.current);
    }
    for (let y = 0; y <= virtualHeightRef.current; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(virtualWidthRef.current, y);
    }
    ctx.stroke();

    gorePiecesRef.current.forEach(g => {
        ctx.save();
        ctx.globalAlpha = Math.min(1.0, g.t / (g.maxT * 0.5));
        ctx.translate(g.x, g.y);
        ctx.rotate(g.rotation);
        ctx.fillStyle = g.color;
        
        if (g.type === 'head') {
            ctx.beginPath();
            ctx.arc(0, 0, g.size.w / 2, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillRect(-g.size.w / 2, -g.size.h / 2, g.size.w, g.size.h);
        }
        ctx.restore();
    });

    bloodParticlesRef.current.forEach(b => {
        ctx.save();
        ctx.globalAlpha = Math.min(1.0, b.t / b.maxT);
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    afterimagesRef.current.forEach(a => {
        const ghost = {
            ...playerRef.current,
            x: a.x,
            y: a.y,
            facingDirection: a.facingDirection,
            runT: a.runT,
            bob: 0,
            invuln: 0,
        };
        ctx.save();
        const timeProgress = a.t / a.maxT;
        // The trailPosition property (from 0 to 1) determines the opacity along the trail,
        // creating a gradient effect where afterimages closer to the player's destination are more opaque.
        const positionFactor = a.trailPosition;
        const maxOpacity = 0.7;
        ctx.globalAlpha = maxOpacity * positionFactor * (timeProgress * timeProgress);
        drawDetailedCharacter(ctx, ghost, true, a.aimAngle, true, '#00f2ff');
        ctx.restore();
    });

    effectsRef.current.forEach(effect => {
        const progress = 1 - (effect.t / effect.maxT);
        if (effect.type === 'shockwave') {
            ctx.strokeStyle = effect.color ? `${effect.color.slice(0, -1)}, ${1-progress})` :`rgba(0, 242, 255, ${1 - progress})`;
            ctx.lineWidth = 6 * (1-progress);
            ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.r, 0, Math.PI * 2); ctx.stroke();
        } else if (effect.type === 'explosion') {
            const alpha = 1 - progress * progress;
            if (effect.color === '#ff00ff') {
                ctx.fillStyle = `rgba(255, 0, 255, ${alpha})`;
            } else if (effect.color === '#9400D3') { // Explosive Death
                ctx.fillStyle = `rgba(148, 0, 211, ${alpha})`;
            } else {
                ctx.fillStyle = `rgba(255, 0, 255, ${alpha})`;
            }
            ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.r, 0, Math.PI * 2); ctx.fill();
        } else if (effect.type === 'muzzle-flash') {
            ctx.fillStyle = `rgba(0, 242, 255, ${1 - progress})`;
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, effect.r, 0, Math.PI * 2);
            ctx.fill();
        } else if (effect.type === 'heal-aura') {
            ctx.strokeStyle = `rgba(74, 222, 128, ${1 - progress})`; // green-400
            ctx.lineWidth = 4 * (1 - progress);
            ctx.beginPath(); ctx.arc(effect.x, effect.y, effect.r, 0, Math.PI * 2); ctx.stroke();
        } else if (effect.type === 'railgun-beam') {
            ctx.save();
            ctx.shadowColor = '#00f2ff';
            ctx.shadowBlur = 15;
            ctx.strokeStyle = `rgba(255, 255, 255, ${1 - progress})`;
            ctx.lineWidth = 15 * (1 - progress);
            ctx.beginPath();
            if (effect.points && effect.points.length > 1) {
                ctx.moveTo(effect.points[0].x, effect.points[0].y);
                for (let i = 1; i < effect.points.length; i++) {
                    ctx.lineTo(effect.points[i].x, effect.points[i].y);
                }
            } else if (effect.endX && effect.endY) {
                ctx.moveTo(effect.x, effect.y);
                ctx.lineTo(effect.endX, effect.endY);
            }
            ctx.stroke();
            ctx.restore();
        } else if (effect.type === 'chain-lightning' && effect.endX && effect.endY) {
            ctx.strokeStyle = `rgba(139, 92, 246, ${1 - progress})`; // violet-500
            ctx.lineWidth = 4 * (1 - progress);
            
            ctx.beginPath();
            ctx.moveTo(effect.x, effect.y);
            const dx = effect.endX - effect.x;
            const dy = effect.endY - effect.y;
            const dist = Math.hypot(dx, dy);
            const segments = Math.max(3, Math.floor(dist / 20));
            
            for (let i = 1; i < segments; i++) {
                const segProgress = i / segments;
                const offsetX = (Math.random() - 0.5) * 20;
                const offsetY = (Math.random() - 0.5) * 20;
                ctx.lineTo(
                    effect.x + dx * segProgress + offsetX, 
                    effect.y + dy * segProgress + offsetY
                );
            }

            ctx.lineTo(effect.endX, effect.endY);
            ctx.stroke();
        } else if (effect.type === 'singularity') {
            ctx.save();
            ctx.translate(effect.x, effect.y);
            const r = effect.maxR * (progress * 0.5 + 0.5 * Math.sin(progress * Math.PI));
            const grd = ctx.createRadialGradient(0, 0, 1, 0, 0, r);
            grd.addColorStop(0, '#111');
            grd.addColorStop(0.7, effect.color || '#a855f7');
            grd.addColorStop(1, 'rgba(168, 85, 247, 0)');
            ctx.fillStyle = grd;
            ctx.globalAlpha = 1 - progress;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    });

    orbsRef.current.forEach(o => {
        const colors: Record<number, string> = { 1: '#00f2ff', 2: '#a855f7', 3: '#f59e0b' };
        ctx.fillStyle = colors[o.mult] || colors[1];
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fill();
    });

    dropsRef.current.forEach(d => {
        ctx.save();
        ctx.globalAlpha = Math.min(1, d.t / 2);
        const bob = Math.sin(stateRef.current.elapsed * 4 + d.x) * 4;

        if (d.type === 'magnet') {
            ctx.save();
            ctx.translate(d.x, d.y + bob);
            ctx.rotate(0.3);
            const r = d.r * 1.1;
            const thickness = r * 0.6;
        
            ctx.strokeStyle = '#be185d'; // pink-700
            ctx.lineWidth = thickness;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(0, r * 0.2, r * 0.7, Math.PI, 0);
            ctx.stroke();
        
            ctx.fillStyle = '#d1d5db'; // gray-300
            const tipHeight = r * 0.4;
            ctx.fillRect(-r * 0.7 - thickness / 2, -tipHeight + r * 0.2, thickness, tipHeight);
            ctx.fillRect(r * 0.7 - thickness / 2, -tipHeight + r * 0.2, thickness, tipHeight);
            
            ctx.restore();
        } else if (d.type === 'item' && d.itemId) {
            drawItemDrop(ctx, d, bob);
        } else if (d.type === 'goldenCoin') {
            ctx.fillStyle = '#f59e0b'; // yellow-500
            ctx.beginPath(); ctx.arc(d.x, d.y + bob, d.r, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fef08a'; // yellow-200
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('💰', d.x, d.y + bob);
        } else if (d.type === 'health') {
            const r = d.r;
            ctx.fillStyle = '#dc2626'; // red-600
            ctx.strokeStyle = '#fef2f2'; // red-50
            ctx.lineWidth = 3;
            // Cross shape
            ctx.beginPath();
            ctx.rect(d.x - r * 0.2, d.y + bob - r * 0.6, r * 0.4, r * 1.2);
            ctx.rect(d.x - r * 0.6, d.y + bob - r * 0.2, r * 1.2, r * 0.4);
            ctx.fill();
            ctx.stroke();
        }
        ctx.restore();
    });

    pshotsRef.current.forEach(s => {
        ctx.fillStyle = s.explosive ? '#ff00ff' : '#00f2ff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();

        if (s.hasTrail && s.trailPoints && s.trailPoints.length > 1) {
            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            for (let i = 1; i < s.trailPoints.length; i++) {
                const p1 = s.trailPoints[i-1];
                const p2 = s.trailPoints[i];
                const alpha = i / s.trailPoints.length * 0.5;
                const width = s.r * (i / s.trailPoints.length);
                ctx.strokeStyle = `rgba(0, 242, 255, ${alpha})`;
                ctx.lineWidth = width;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
            ctx.restore();
        }
    });
    shotsRef.current.forEach(s => {
        ctx.fillStyle = s.slows ? '#8b5cf6' : '#ff00ff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
    });
    
    enemiesRef.current.forEach(e => {
        const p = playerRef.current;
        const angleToPlayer = Math.atan2(p.y - e.y, p.x - e.x);
        
        ctx.save();
        ctx.translate(e.x, e.y);
        // Explosive Death AOE indicator
        if (e.affix === 'Explosive Death') {
            const radius = 180;
            ctx.strokeStyle = 'rgba(148, 0, 211, 0.5)';
            ctx.lineWidth = 2;
            const pulse = Math.sin(stateRef.current.elapsed * 5) * 0.05 + 0.95;
            ctx.beginPath(); ctx.arc(0, 0, radius * pulse, 0, Math.PI * 2); ctx.stroke();
        }
        // Big Boss Telegraphs
        if (e.isBigBoss && e.attackState === 'telegraph_charge' && e.chargeTarget) {
            ctx.restore(); // Restore translate to draw from origin
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(e.x, e.y);
            ctx.lineTo(e.chargeTarget.x, e.chargeTarget.y);
            ctx.strokeStyle = `rgba(255, 0, 255, ${0.5 + Math.sin(stateRef.current.elapsed * 20) * 0.2})`;
            ctx.lineWidth = 10;
            ctx.setLineDash([20, 15]);
            ctx.stroke();
            ctx.restore();
            ctx.save(); // Re-save for char drawing
            ctx.translate(e.x, e.y);
        }
        if (e.isBigBoss && e.attackState === 'telegraph_stomp') {
            ctx.strokeStyle = `rgba(0, 242, 255, ${0.3 + Math.sin(stateRef.current.elapsed * 10) * 0.2})`;
            ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(0, 0, 350, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();

        const isShooter = ['shooter', 'miniboss', 'boss_bullethell', 'boss_summoner', 'healer', 'disabler'].includes(e.type);
        const aimAngle = isShooter || e.isBigBoss ? angleToPlayer : e.facingDirection === 1 ? 0.1 : Math.PI - 0.1;
        
        if (e.affix) {
            const eliteColors: Record<string, string> = { 'Hasted': '#f59e0b', 'Shielded': '#00f2ff', 'Explosive Death': '#a855f7', 'Life Leech': '#ef4444' };
            const color = eliteColors[e.affix] || '#ffffff';
            drawDetailedCharacter(ctx, e, false, aimAngle, true, color);
        }

        drawDetailedCharacter(ctx, e, false, aimAngle);

        // HP Bar (above)
        if (!e.isBigBoss) {
            const hpYOff = -e.r * 2.5 - 40;
            const hpW = e.r * 2.5;
            const hpH = 8;
            ctx.fillStyle = '#3f3f46';
            ctx.fillRect(e.x - hpW / 2, e.y + hpYOff, hpW, hpH);
            ctx.fillStyle = '#ff00ff';
            ctx.fillRect(e.x - hpW / 2, e.y + hpYOff, hpW * (e.hp / e.hpMax), hpH);
            if (e.affix === 'Shielded' && e.shield !== undefined && e.shieldMax !== undefined && e.shield > 0) {
                ctx.fillStyle = '#00f2ff';
                ctx.fillRect(e.x - hpW / 2, e.y + hpYOff, hpW * (e.shield / e.shieldMax), hpH);
            }
        }
    });

    if (p && p.hp !== undefined) {
        if (p.slow.duration > 0) {
            ctx.save();
            const alpha = Math.min(0.7, p.slow.duration); // Fade in/out
            ctx.strokeStyle = `rgba(0, 242, 255, ${alpha})`;
            ctx.lineWidth = 2;
    
            const webRadius = p.r * 3;
            const segments = 8;
    
            ctx.beginPath();
            // Draw radial lines
            for (let i = 0; i < segments; i++) {
                const angle = (i / segments) * Math.PI * 2;
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x + Math.cos(angle) * webRadius, p.y + Math.sin(angle) * webRadius);
            }
    
            // Draw connecting polygons
            const rings = 3;
            for (let r = 1; r <= rings; r++) {
                const radius = (webRadius / rings) * r;
                const startAngle = 0;
                ctx.moveTo(p.x + Math.cos(startAngle) * radius, p.y + Math.sin(startAngle) * radius);
                for (let i = 1; i <= segments; i++) {
                    const angle = (i / segments) * Math.PI * 2;
                    ctx.lineTo(p.x + Math.cos(angle) * radius, p.y + Math.sin(angle) * radius);
                }
            }
            ctx.stroke();
            ctx.restore();
        }
        
        if (p.executionerBuff && p.executionerBuff.duration > 0) {
            ctx.save();
            ctx.shadowColor = '#ef4444'; // red-500
            ctx.shadowBlur = Math.sin(stateRef.current.elapsed * 15) * 5 + 15;
            drawDetailedCharacter(ctx, p, true, p.aimAngle);
            ctx.restore();
        } else {
            drawDetailedCharacter(ctx, p, true, p.aimAngle);
        }
    }

    floatingTextsRef.current.sort((a, b) => (a.isCrit ? 1 : 0) - (b.isCrit ? 1 : 0));
    floatingTextsRef.current.forEach(ft => {
        ctx.save();
        const alpha = Math.min(1.0, (ft.t ?? 1) * 2);

        if (ft.isAnnouncement) {
            let fontSize = 48;
            if (ft.amount.startsWith('Evolved:')) {
                fontSize = 36;
            }
            ctx.font = `bold ${fontSize}px sans-serif`;
            ctx.textAlign = 'center';
            let color = `rgba(0, 242, 255, ${alpha})`; // Default: Cyan for Wave/Boss
            if (ft.amount.startsWith('Evolved:')) {
                color = `rgba(251, 191, 36, ${alpha})`; // amber-400
            }
            ctx.fillStyle = color;
            ctx.strokeStyle = `rgba(0, 0, 0, ${alpha * 0.7})`;
            ctx.lineWidth = 4;
            ctx.strokeText(ft.amount, ft.x, ft.y);
            ctx.fillText(ft.amount, ft.x, ft.y);
        } else {
            let fontSize = 18;
            let fontWeight = '';
            if (ft.isCrit) {
                fontWeight = 'bold';
                fontSize = 22;
                if (ft.critPower) {
                    fontSize = 20 + 25 * ft.critPower; // Scale from 20px to 45px
                    const shakeIntensity = 8 * ft.critPower * (ft.t ?? 1); // Fades out
                    const shakeX = (Math.random() - 0.5) * shakeIntensity;
                    const shakeY = (Math.random() - 0.5) * shakeIntensity;
                    ctx.translate(shakeX, shakeY);
                }
            }
            
            ctx.font = `${fontWeight} ${fontSize.toFixed(0)}px sans-serif`;
            ctx.fillStyle = ft.color ? `rgba(${parseInt(ft.color.slice(1,3), 16)}, ${parseInt(ft.color.slice(3,5), 16)}, ${parseInt(ft.color.slice(5,7), 16)}, ${alpha})` : ft.isCrit ? `rgba(255, 235, 59, ${alpha})` : `rgba(255, 255, 255, ${alpha})`;
            ctx.strokeStyle = `rgba(0, 0, 0, ${alpha * 0.8})`;
            ctx.lineWidth = 3;
            ctx.strokeText(ft.amount, ft.x, ft.y);
            ctx.fillText(ft.amount, ft.x, ft.y);
        }
        ctx.restore();
    });

    ctx.restore();

    // Fog of War / Vignette - draw in screen space
    if (p.hp > 0) {
        const fogCenterX = canvas.width / 2;
        const fogCenterY = canvas.height / 2;
        const fogInnerRadius = Math.min(canvas.width, canvas.height) / 2.5;
        const fogOuterRadius = Math.max(canvas.width, canvas.height) * 0.7;
        const fogGrd = ctx.createRadialGradient(fogCenterX, fogCenterY, fogInnerRadius, fogCenterX, fogCenterY, fogOuterRadius);
        fogGrd.addColorStop(0.7, 'rgba(17, 24, 39, 0)');
        fogGrd.addColorStop(1, 'rgba(17, 24, 39, 1)');
        ctx.fillStyle = fogGrd;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw UI elements on canvas (like joystick) AFTER restoring context
    if (isMobile && joystickStateRef.current.active) {
        const { startX, startY, currentX, currentY } = joystickStateRef.current;
        const baseRadius = 50;
        const stickRadius = 25;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.arc(startX, startY, baseRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(currentX, currentY, stickRadius, 0, Math.PI * 2);
        ctx.fill();
    }
  }, [isMobile, drawDetailedCharacter, drawItemDrop]);

  const gameLoop = useCallback((timestamp: number) => {
    if (lastTimeRef.current === null) lastTimeRef.current = timestamp;
    const dt = Math.min(0.033, (timestamp - lastTimeRef.current) / 1000);
    lastTimeRef.current = timestamp;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    
    if ((gameStatus === GameStatus.Playing || gameStatus === GameStatus.Title) && !isAdminMenuOpen) {
      stateRef.current.elapsed += dt;
      coinSfxCooldownRef.current = Math.max(0, coinSfxCooldownRef.current - dt);

      if (!stateRef.current.waveInProgress) {
        stateRef.current.waveBreak -= dt;
        if (stateRef.current.waveBreak <= 0) {
          const w = stateRef.current.wave;
          stateRef.current.waveInProgress = true;
          playSfx('sfx-wave-start');
          addFloatingText(virtualWidthRef.current / 2, virtualHeightRef.current / 2 + 100, `Wave ${w}`, false, { isAnnouncement: true, lifetime: 2.5 });
          
          if (w > 0 && w % 10 === 0 && !playerRef.current.isDemo) {
              stateRef.current.spawnQueue = 0;
              stateRef.current.spawnTimer = 0;
              spawnBigBoss(w);
          } else {
              stateRef.current.spawnQueue = (w === 1 ? 8 : 10 + (w - 1) * 5);
              stateRef.current.spawnTimer = 0;
              if (w % 3 === 0) spawnEnemy('miniboss', w);
          }
        }
      } else {
        stateRef.current.spawnTimer -= dt;
        if (stateRef.current.spawnQueue > 0 && stateRef.current.spawnTimer <= 0) {
          const w = stateRef.current.wave;
          const pool = ['melee'];
          if (w >= 2) pool.push('runner', 'shooter');
          if (w >= 3) pool.push('tank');
          if (w >= 4) pool.push('splitter', 'bomber');
          if (w >= 5) pool.push('disabler');
          if (w >= 6) pool.push('healer');
          if (w >= 8) pool.push('summoner');
          
          const batch = Math.min(stateRef.current.spawnQueue, 2 + Math.floor(Math.min(5, w / 2)));
          for (let i = 0; i < batch; i++) {
            spawnEnemy(pool[Math.floor(Math.random() * pool.length)], w);
          }
          stateRef.current.spawnQueue -= batch;
          stateRef.current.spawnTimer = Math.max(0.2, 1.1 - w * 0.06);
        }
        if (stateRef.current.spawnQueue <= 0 && enemiesRef.current.length === 0 && !playerRef.current.isDemo) {
          stateRef.current.waveInProgress = false;
          stateRef.current.wave += 1;
          stateRef.current.waveBreak = 3.5;
        }
      }

      const p = playerRef.current;
      const camX = clamp(p.x - canvas.width / 2, 0, virtualWidthRef.current - canvas.width);
      const camY = clamp(p.y - canvas.height / 2, 0, virtualHeightRef.current - canvas.height);
      const w = p.weapon;
      
      let statsNeedRecalc = false;
      if (p.executionerBuff && p.executionerBuff.duration > 0) {
        p.executionerBuff.duration -= dt;
        if (p.executionerBuff.duration <= 0) {
            statsNeedRecalc = true;
        }
      }
      if (p.momentum && p.momentum.duration > 0) {
          p.momentum.duration -= dt;
      }
      if (statsNeedRecalc) {
          recalcStats();
      }

      if (gameStatus === GameStatus.Title) {
        runDemoAI(dt);
      } else {
        // --- Player Movement ---
        let vx = 0, vy = 0;

        if (keysRef.current.has('w') || keysRef.current.has('arrowup')) vy -= 1;
        if (keysRef.current.has('s') || keysRef.current.has('arrowdown')) vy += 1;
        if (keysRef.current.has('a') || keysRef.current.has('arrowleft')) vx -= 1;
        if (keysRef.current.has('d') || keysRef.current.has('arrowright')) vx += 1;

        const moveVec = moveVectorRef.current;
        if (isMobile && (moveVec.x !== 0 || moveVec.y !== 0)) {
          vx = moveVec.x;
          vy = moveVec.y;
        }
        
        const isMoving = Math.hypot(vx, vy) > 0.1;
        const momentumBonus = (p.momentum && p.momentum.duration > 0 && p.momentumBonus) ? (1 + p.momentumBonus) : 1;
        p.slow.duration = Math.max(0, p.slow.duration - dt);
        const currentSpeed = (p.slow.duration > 0 ? p.speed * p.slow.factor : p.speed) * momentumBonus;

        if (isMoving) {
            const mag = Math.hypot(vx, vy) || 1;
            p.x += (vx / mag) * currentSpeed * dt;
            p.y += (vy / mag) * currentSpeed * dt;
            p.facing = Math.atan2(vy, vx);
            p.runT += dt * 8;
            p.bob = Math.sin(p.runT) * 4;
        } else {
            p.runT = 0;
            if (Math.abs(p.bob) > 0.1) { p.bob *= 0.9; } else { p.bob = 0; }
        }
        p.x = clamp(p.x, p.r, virtualWidthRef.current - p.r);
        p.y = clamp(p.y, p.r, virtualHeightRef.current - p.r);

        // --- Aiming and Shooting Logic (Auto-aim & Auto-attack) ---
        let aimTarget: { x: number; y: number } | null = null;
        let isShooting = false;
        
        let nearestEnemy: Enemy | null = null;
        let minDistanceSq = Infinity;
        // Generous range for auto-targeting, especially on desktop.
        const autoFireRangeSq = 800 ** 2;
        
        for (const enemy of enemiesRef.current) {
            const dx = enemy.x - p.x;
            const dy = enemy.y - p.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < minDistanceSq && distSq < autoFireRangeSq) {
                minDistanceSq = distSq;
                nearestEnemy = enemy;
            }
        }
        
        if (nearestEnemy) {
            aimTarget = nearestEnemy;
            isShooting = true;
        }
              
        if (p.hp > 0) {
            if (aimTarget) {
                // Aim at the nearest enemy
                p.aimAngle = Math.atan2(aimTarget.y - p.y, aimTarget.x - p.x);
            } else if (!isMobile) {
                // On desktop with no enemies, aim with mouse
                const worldMouseX = mouseRef.current.x + camX;
                const worldMouseY = mouseRef.current.y + camY;
                p.aimAngle = Math.atan2(worldMouseY - p.y, worldMouseX - p.x);
            } else {
                // On mobile with no enemies, aim in direction of movement
                if (isMoving) {
                    p.aimAngle = Math.atan2(vy, vx);
                }
                // If not moving, keep the last aimAngle
            }
            p.facingDirection = (p.aimAngle > -Math.PI / 2 && p.aimAngle < Math.PI / 2) ? 1 : -1;
        }
        
        if (isShooting && aimTarget) {
            attack(aimTarget);
        }
      }

      w.attackCooldown = Math.max(0, w.attackCooldown - dt);
      p.jumpCooldown = Math.max(0, p.jumpCooldown - dt);
      p.invuln = Math.max(0, p.invuln - dt);
      if (w.reloading) {
        w.reloadT -= dt;
        if (w.reloadT <= 0) {
          w.reloading = false;
          w.ammo = w.currentClipSize;
          if (!p.isDemo) {
            addFloatingText(p.x, p.y - 27, 'Reloaded', true);
          }
        }
      }
      
      for (let i = effectsRef.current.length - 1; i >= 0; i--) {
        const effect = effectsRef.current[i];
        effect.t -= dt;
        if(effect.type !== 'railgun-beam' && effect.type !== 'chain-lightning') {
            effect.r = effect.maxR * (1 - (effect.t / effect.maxT));
        }
        if (effect.t <= 0) effectsRef.current.splice(i, 1);
      }

      const GRAVITY = 800;
      // update blood
      for (let i = bloodParticlesRef.current.length - 1; i >= 0; i--) {
          const b = bloodParticlesRef.current[i];
          b.t -= dt;
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.vy += GRAVITY * dt;
          b.vx *= 0.99;
          if (b.t <= 0) {
              bloodParticlesRef.current.splice(i, 1);
          }
      }

      // update gore
      for (let i = gorePiecesRef.current.length - 1; i >= 0; i--) {
          const g = gorePiecesRef.current[i];
          g.t -= dt;
          g.x += g.vx * dt;
          g.y += g.vy * dt;
          g.vy += GRAVITY * dt;
          g.vx *= 0.98;
          g.rotation += g.vr * dt;
          g.vr *= 0.98;
          if (g.t <= 0) {
              gorePiecesRef.current.splice(i, 1);
          }
      }
      
      // update afterimages
      for (let i = afterimagesRef.current.length - 1; i >= 0; i--) {
          const a = afterimagesRef.current[i];
          a.t -= dt;
          if (a.t <= 0) {
              afterimagesRef.current.splice(i, 1);
          }
      }

      updateEnemies(dt);
      updateProjectiles(dt);
      updateDropsAndOrbs(dt);
      updateFloatingTexts(dt);

      hudUpdateTimer.current -= dt;
      if (hudUpdateTimer.current <= 0) {
          hudUpdateTimer.current = 0.1;
          setHudData({ 
            hp: p.hp, hpMax: p.hpMax, level: p.level, xp: p.xp, xpNext: p.xpNext, 
            attackCooldown: w.attackCooldown, attackCDBase: w.currentAttackCD, 
            jumpCooldown: p.jumpCooldown, jumpCDBase: p.jumpCDBase,
            reloading: w.reloading, reloadT: w.reloadT, reloadTime: w.currentReloadTime, 
            ammo: w.ammo, clipSize: w.currentClipSize,
            bossData: bigBossRef.current,
          });
      }
    }

// 👇 PART D: ADD DUELS STATS UPDATE HERE
if (duelsMode.current && duelsWs.current && gameStatus === GameStatus.Playing) {
  duelsStatsUpdateTimer.current -= dt;
  
  if (duelsStatsUpdateTimer.current <= 0) {
    const p = playerRef.current;  // ✅ Define p here
    duelsWs.current.send(JSON.stringify({
      type: 'STATS_UPDATE',
      payload: {
        hp: p.hp,
        hpMax: p.hpMax,
        wave: stateRef.current.wave,
        kills: killCountRef.current,
        level: p.level
      }
    }));
    duelsStatsUpdateTimer.current = 0.5;
  }
}
// 👆 END OF PART D
// 👇 PART E: SPAWN ENEMIES FROM OPPONENT
    if (duelsMode.current && incomingEnemyQueue.current.length > 0 && gameStatus === GameStatus.Playing) {
      enemySpawnTimer.current -= dt;
      
      if (enemySpawnTimer.current <= 0) {
        const enemyToSpawn = incomingEnemyQueue.current.shift();
        if (enemyToSpawn) {
          console.log('👹 Spawning enemy from opponent:', enemyToSpawn.type);
          
          // Spawn the enemy
          spawnEnemy(enemyToSpawn.type, enemyToSpawn.wave);
          
          // Reset timer for next spawn
          enemySpawnTimer.current = 0.3; // 0.3 seconds between spawns
        }
      }
    }
    // 👆 END OF PART E

    renderGame(ctx);
    gameLoopId.current = requestAnimationFrame(gameLoop);
  }, [gameStatus, attack, isMobile, addFloatingText, spawnEnemy, updateEnemies, updateProjectiles, updateDropsAndOrbs, spawnBigBoss, updateFloatingTexts, playSfx, isAdminMenuOpen, tryJump, recalcStats, runDemoAI, renderGame]);


  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { innerWidth, innerHeight } = window;
    
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    
    virtualWidthRef.current = innerWidth * 1.25;
    virtualHeightRef.current = innerHeight * 1.25;
  }, []);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);
  
  useEffect(() => {
    gameLoopId.current = requestAnimationFrame(gameLoop);
    return () => {
      if (gameLoopId.current) {
        cancelAnimationFrame(gameLoopId.current);
      }
    };
  }, [gameLoop]);

  const getMousePos = (e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return { x, y };
  };

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (joystickStateRef.current.active) return;
  
      const touch = e.changedTouches[0];
      if (touch) {
          // FIX: Explicitly cast 'touch' to the 'Touch' type to resolve property access errors on 'unknown'.
          const typedTouch = touch as Touch;
          joystickStateRef.current = {
              active: true,
              touchId: typedTouch.identifier,
              startX: typedTouch.clientX,
              startY: typedTouch.clientY,
              currentX: typedTouch.clientX,
              currentY: typedTouch.clientY,
          };
      }
  }, []);
  
  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const { active, touchId } = joystickStateRef.current;
      if (!active) return;
  
      // FIX: Explicitly cast the elements of 'changedTouches' to the 'Touch' type to resolve property access errors on 'unknown'.
      for (const touch of Array.from(e.changedTouches) as Touch[]) {
          if (touch.identifier === touchId) {
              const { startX, startY } = joystickStateRef.current;
              let dx = touch.clientX - startX;
              let dy = touch.clientY - startY;
              const dist = Math.hypot(dx, dy);
  
              if (dist > JOYSTICK_MAX_DIST) {
                  dx = (dx / dist) * JOYSTICK_MAX_DIST;
                  dy = (dy / dist) * JOYSTICK_MAX_DIST;
              }
  
              joystickStateRef.current.currentX = startX + dx;
              joystickStateRef.current.currentY = startY + dy;
  
              const clampedDist = Math.min(dist, JOYSTICK_MAX_DIST);
              const moveMagnitude = clampedDist / JOYSTICK_MAX_DIST;
              const moveAngle = Math.atan2(dy, dx);
              
              moveVectorRef.current = {
                  x: dist > 0.1 ? Math.cos(moveAngle) * moveMagnitude : 0,
                  y: dist > 0.1 ? Math.sin(moveAngle) * moveMagnitude : 0,
              };
  
              break;
          }
      }
  }, []);
  
  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const { active, touchId } = joystickStateRef.current;
      if (!active) return;
      
      // FIX: Explicitly cast the elements of 'changedTouches' to the 'Touch' type to resolve property access errors on 'unknown'.
      for (const touch of Array.from(e.changedTouches) as Touch[]) {
          if (touch.identifier === touchId) {
              joystickStateRef.current.active = false;
              joystickStateRef.current.touchId = null;
              moveVectorRef.current = { x: 0, y: 0 };
              break;
          }
      }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'd') {
            e.preventDefault();
            if (gameStatus === GameStatus.Playing) {
                setIsAdminMenuOpen(prev => !prev);
            }
        }
        keysRef.current.add(e.key.toLowerCase());
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysRef.current.delete(key);
      if (key === 'r') startReload();
      if (key === ' ') tryJump();
      if (key === 'escape') {
          if (isAdminMenuOpen) {
              setIsAdminMenuOpen(false);
          } else if (gameStatus === GameStatus.Playing || gameStatus === GameStatus.Paused) {
              handlePause(gameStatus !== GameStatus.Paused);
          }
      }
    };
    const handleMouseDown = (e: MouseEvent) => { if (e.button === 0) mouseRef.current.down = true; };
    const handleMouseUp = (e: MouseEvent) => { if (e.button === 0) mouseRef.current.down = false; };
    const handleMouseMove = (e: MouseEvent) => { mouseRef.current = { ...mouseRef.current, ...getMousePos(e) }; };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [gameStatus, startReload, tryJump, isAdminMenuOpen]);

  killEnemyRef.current = killEnemy;

  const playerStateForPauseMenu = {
    gameInfo: {
        wave: stateRef.current.wave,
        kills: killCountRef.current,
        time: stateRef.current.elapsed,
    },
    perks: Object.entries(perkCountsRef.current).map(([id, lvl]) => {
        const perkMap: Record<string, {name: string, effect: string}> = {
            'hp': { name: 'Max HP', effect: `+${20 * lvl}` },
            'speed': { name: 'Move Speed', effect: `+${Math.round((Math.pow(1.1, lvl) - 1) * 100)}%` },
            'dmg': { name: 'Damage', effect: `+${Math.round((Math.pow(1.15, lvl) - 1) * 100)}%` },
            'cdr': { name: 'Cooldowns', effect: `-${Math.round((1 - Math.pow(0.85, lvl)) * 100)}%` },
            'multishot': { name: 'Multishot', effect: `+${1 * lvl}` },
            'spread': { name: 'Tighter Spread', effect: `${Math.round(0.03 * lvl * 100)}%` },
            'pierce': { name: 'Pierce', effect: `+${lvl}` },
            'clip+': { name: 'Clip Size', effect: `+${3 * lvl}` },
            'xp+': { name: 'XP Gain', effect: `+${Math.round((Math.pow(1.05, lvl) - 1) * 100)}%` },
            'orbRange': { name: 'Pickup Range', effect: `+${Math.round((Math.pow(1.15, lvl) - 1) * 100)}%` },
            'critChance': { name: 'Crit Chance', effect: `+${5 * lvl}%` },
            'critDmg': { name: 'Crit Damage', effect: `+${25 * lvl}%` },
            'weaponUpgrade': { name: 'Weapon Level', effect: '' },
            'chainBounce': { name: 'Chain Bounces', effect: `+${lvl}` },
            'stomp': { name: 'Seismic Slam', effect: `Dmg: ${25 * lvl}` },
            'lifesteal': { name: 'Vampiric Rounds', effect: `${1 * lvl}% Lifesteal` },
            'thorns': { name: 'Reactive Plating', effect: `Dmg: ${30 * lvl}` },
            'ricochet': { name: 'Ricochet', effect: `${5 * lvl}% Chance` },
            'momentum': { name: 'Momentum', effect: `+${30 * lvl}% Spd on Kill` },
            'adrenaline': { name: 'Adrenaline Rush', effect: `${(0.2 * lvl).toFixed(1)}s Invuln` },
            'glassCannon': { name: 'Glass Cannon', effect: `+${Math.round((Math.pow(1.5, lvl) - 1) * 100)}% Dmg / +${Math.round((Math.pow(1.25, lvl) - 1) * 100)}% Taken` },
            'singularity': { name: 'Singularity', effect: `${5 * lvl}% Chance` },
            'secondWind': { name: 'Second Wind', effect: `1 Use` },
            'goldenTouch': { name: 'Golden Touch', effect: `${5 * lvl}% Coin Drop` },
            'hollowPoints': { name: 'Hollow Points', effect: `+${5 * lvl}% Missing HP Dmg` },
            'overcharge': { name: 'Overcharge', effect: `+${200 * lvl}% Last Shot Dmg` },
            'executioner': { name: "Baba Yaga", effect: `+${100 * lvl}% Dmg on Elite Kill` },
        };
        return { name: perkMap[id]?.name || id, lvl, effect: perkMap[id]?.effect || '' };
    }).filter(p => p.name !== 'Weapon Level'),
    stats: [
        ['Max HP', playerRef.current.hpMax ?? INITIAL_PLAYER_STATS.hpMax],
        ['Move Speed', `${(playerRef.current.baseSpeed ?? INITIAL_PLAYER_STATS.moveSpd).toFixed(0)}`],
        ['Damage Bonus', `${Math.round(((playerRef.current.dmgMult ?? INITIAL_PLAYER_STATS.dmgMult) - 1) * 100)}%`],
        ['Damage Reduction', `${Math.round((1 - (playerRef.current.dmgTakenMul ?? INITIAL_PLAYER_STATS.dmgTakenMul)) * 100)}%`],
        ['Crit Chance', `${Math.round((playerRef.current.critChance ?? INITIAL_PLAYER_STATS.critChance) * 100)}%`],
        ['Crit Damage', `${Math.round((playerRef.current.critDamage ?? INITIAL_PLAYER_STATS.critDamage) * 100)}%`],
        ['Ricochet', `${Math.round((playerRef.current.ricochet ?? INITIAL_PLAYER_STATS.ricochet) * 100)}%`],
        ['Dodge CD', `${(playerRef.current.jumpCDBase ?? INITIAL_PLAYER_STATS.dodgeCD).toFixed(2)}s`],
        ['XP Gain', `${Math.round(((statModsRef.current.xpMul ?? 1) - 1) * 100)}%`],
    ] as [string, string | number][],
    items: itemSlotsRef.current,
    playerEvo: playerRef.current.evo?.gun,
    weapon: playerRef.current.weapon || DUMMY_WEAPON,
  };

  const handleStartGame = useCallback(() => {
    initAudio();
    startGame();
  }, [initAudio, startGame]);

  const handleShowInfo = useCallback(() => {
    initAudio();
    setInfoScreenVisible(true);
  }, [initAudio]);
  
  const handleShowChangelog = useCallback(() => {
    initAudio();
    setIsChangelogVisible(true);
  }, [initAudio]);

  const handleShowUpgrades = useCallback(() => {
    initAudio();
    setIsUpgradeScreenVisible(true);
  }, [initAudio]);

  // 1️⃣ FIRST: Define handleDuelsMessage
const handleDuelsMessage = useCallback((message: any) => {
  console.log('📨 Received message:', message.type);
  
  switch (message.type) {
    case 'MATCH_FOUND':
      console.log('🎯 Match found! Opponent:', message.payload.opponent.name);
      alert(`Match found! vs ${message.payload.opponent.name}`);
      break;

    case 'MATCH_COUNTDOWN':
      console.log('⏱️ Countdown:', message.payload.countdown);
      break;

    case 'MATCH_START':
      console.log('🎮 Match starting!');
      duelsMode.current = true;
      resetGame();
      setGameStatus(GameStatus.Playing);
      break;

    case 'ENEMY_SPAWN':
      console.log('👹 Receiving enemies from opponent:', message.payload.enemies);
      message.payload.enemies.forEach((enemy: any) => {
        incomingEnemyQueue.current.push({
          type: enemy.type,
          wave: enemy.wave,
          delay: enemy.spawnDelay || 0
        });
      });
      break;

    case 'OPPONENT_STATS':
      opponentStats.current = {
        name: message.payload.name || 'Opponent',
        hp: message.payload.hp,
        hpMax: message.payload.hpMax,
        wave: message.payload.wave,
        kills: message.payload.kills,
        level: message.payload.level
      };
      break;

    case 'OPPONENT_DISCONNECTED':
      alert('Opponent disconnected! You win!');
      setGameStatus(GameStatus.GameOver);
      duelsMode.current = false;
      break;

    case 'MATCH_END':
      console.log('🏁 Match ended!', message.payload);
      alert(message.payload.won ? 'You won!' : 'You lost!');
      setGameStatus(GameStatus.GameOver);
      duelsMode.current = false;
      break;

    default:
      console.log('Unknown message type:', message.type);
  }
}, [resetGame, setGameStatus]);

// 2️⃣ SECOND: Define connectToDuels (which uses handleDuelsMessage)
const connectToDuels = useCallback(() => {
  const serverUrl = 'wss://bizzles-projects-production.up.railway.app/';
  const ws = new WebSocket(serverUrl);

  ws.onopen = () => {
    console.log('✅ Connected to Duels server');
    duelsWs.current = ws;
    
    ws.send(JSON.stringify({
      type: 'JOIN_QUEUE',
      payload: {
        playerId: Date.now().toString(),
        playerName: 'Player',
        rating: 1000
      }
    }));
  };

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleDuelsMessage(message);
  };

  ws.onerror = (error) => {
    console.error('❌ Duels connection error:', error);
    alert('Failed to connect to Duels server. Make sure the server is running!');
    setGameStatus(GameStatus.Title);
  };

  ws.onclose = () => {
    console.log('🔌 Disconnected from Duels server');
    duelsWs.current = null;
    duelsMode.current = false;
  };
}, [handleDuelsMessage, setGameStatus]);

// 3️⃣ THIRD: Define handleStartDuels (which uses connectToDuels)
const handleStartDuels = useCallback(() => {
  initAudio();
  console.log('🔥 Starting Duels mode...');
  connectToDuels();
  alert('Connecting to Duels server... Check console for status!');
}, [initAudio, connectToDuels]);

  // --- Admin Panel Handlers ---
  const handleUnlockEvolution = useCallback((evoId: string) => {
      const evo = EVOLUTIONS.find(e => e.id === evoId);
      if (evo && playerRef.current.evo) {
          evo.apply(playerRef.current);
          recalcStats();
          addFloatingText(playerRef.current.x, playerRef.current.y - 36, `Admin: Unlocked ${evo.name}!`, true, { lifetime: 2 });
      }
  }, [recalcStats, addFloatingText]);

  const handleGainXpAdmin = useCallback(() => {
      gainXP(10000);
  }, [gainXP]);
  
  const handleGainCoinsAdmin = useCallback(() => {
      const newTotalCoins = metaState.coins + 1000;
      updateMetaState({ ...metaState, coins: newTotalCoins });
      addFloatingText(playerRef.current.x, playerRef.current.y - 36, `+1000 Coins!`, true, { lifetime: 2 });
  }, [metaState, updateMetaState, addFloatingText]);

  const handleGiveAllItems = useCallback(() => {
      const bestItems: Record<string, Item> = {};
      Object.values(ITEMS).forEach(item => {
          const currentBest = bestItems[item.slot];
          if (!currentBest || RARITY_RANK[item.rarity] > RARITY_RANK[currentBest.rarity]) {
              bestItems[item.slot] = item;
          }
      });
      Object.values(bestItems).forEach(item => equipItem(item.id));
      recalcStats();
      addFloatingText(playerRef.current.x, playerRef.current.y - 36, `Admin: Equipped Best Items!`, true, { lifetime: 2 });
  }, [equipItem, recalcStats, addFloatingText]);

  const handleSpawnBigBossAdmin = useCallback(() => {
      enemiesRef.current = [];
      bigBossRef.current = null;
      spawnBigBoss(stateRef.current.wave);
      addFloatingText(playerRef.current.x, playerRef.current.y - 36, `Admin: Spawning Big Boss!`, true, { lifetime: 2 });
  }, [spawnBigBoss, addFloatingText]);

  const handleToggleGodMode = useCallback(() => {
    setIsGodMode(prev => {
        const newState = !prev;
        addFloatingText(playerRef.current.x, playerRef.current.y - 36, `God Mode: ${newState ? 'ON' : 'OFF'}`, true, { lifetime: 2 });
        return newState;
    });
}, [addFloatingText]);

const postPatchNotes = useCallback(async () => {
    // Use CHANGELOG_VERSIONS instead of changelog
    if (!CHANGELOG_VERSIONS || CHANGELOG_VERSIONS.length === 0) {
        console.error("No changelog data found.");
        addFloatingText(playerRef.current.x, playerRef.current.y - 36, "Error: No changelog", true);
        return;
    }

    const latestPatch = CHANGELOG_VERSIONS[0];
    
    // YOUR BACKEND URL - update this to match your domain
    const backendUrl = "https://john-stick.com/api/postPatchNotes.php";
    
    // YOUR API KEY from config.php
    const apiKey = "k8j2h9f3n5m1p7q4r6t8w0x2z9a5c7e1g3i5";

    addFloatingText(playerRef.current.x, playerRef.current.y - 36, "Posting notes...", false, { lifetime: 3 });

    try {
        const response = await fetch(backendUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": apiKey
            },
            body: JSON.stringify({
                version: latestPatch.version,
                notes: latestPatch.notes
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                addFloatingText(playerRef.current.x, playerRef.current.y - 36, "Patch notes posted!", true, { lifetime: 3 });
            } else {
                console.error("Backend returned error:", data.error);
                addFloatingText(playerRef.current.x, playerRef.current.y - 36, `Post failed: ${data.error}`, true, { lifetime: 3 });
            }
        } else {
            const errorText = await response.text();
            console.error("Failed to post patch notes:", response.status, errorText);
            addFloatingText(playerRef.current.x, playerRef.current.y - 36, `Post failed: ${response.status}`, true, { lifetime: 3 });
        }
    } catch (error) {
        console.error("Error posting patch notes:", error);
        addFloatingText(playerRef.current.x, playerRef.current.y - 36, "Post failed! (Check console)", true, { lifetime: 3 });
    }
}, [addFloatingText]);

  const renderContent = () => {
    switch(gameStatus) {
      case GameStatus.Title:
        return <>
            <TitleScreen 
              onStart={handleStartGame} 
              onShowInfo={handleShowInfo} 
              onShowUpgrades={handleShowUpgrades} 
              onShowChangelog={handleShowChangelog}
              onStartDuels={handleStartDuels}  // ✅ Add this line
              scores={scores} 
              loading={loadingScores} 
              online={onlineLeaderboardActive} 
            />
            {infoScreenVisible && <GameInfoOverlay onClose={() => setInfoScreenVisible(false)} />}
            {isUpgradeScreenVisible && <UpgradeScreen 
                  metaState={metaState} 
                  onUpdateMetaState={updateMetaState} 
                  onBack={() => setIsUpgradeScreenVisible(false)} 
                />}
          </>;
      case GameStatus.LevelUp:
        return <LevelUpOverlay 
                    perks={levelUpPerks} 
                    onReroll={handleRerollPerks} 
                    rerollsLeft={playerRef.current.rerollsLeft}
                    onBanish={handleBanishPerk}
                    banishesLeft={playerRef.current.banishesLeft}
                />;
      case GameStatus.GameOver:
        return <GameOverOverlay 
                    onRestart={startGame} 
                    onExit={exitToTitle} 
                    stats={gameOverStats}
                    onScoreSubmit={handleScoreSubmit}
                    submitted={scoreSubmitted}
                />;
      case GameStatus.Paused:
        return <PauseMenu onResume={() => handlePause(false)} onRestart={restartGame} onExit={exitToTitle} {...playerStateForPauseMenu} />;
      case GameStatus.Playing:
        return <HUD data={hudData} />;
      default:
        return null;
    }
  }

  return (
    <div className="w-screen h-screen bg-gray-900 text-white select-none overflow-hidden cursor-crosshair">
      <canvas 
        ref={canvasRef} 
        className="absolute top-0 left-0 w-full h-full"
        onTouchStart={isMobile ? handleTouchStart : undefined}
        onTouchMove={isMobile ? handleTouchMove : undefined}
        onTouchEnd={isMobile ? handleTouchEnd : undefined}
        onTouchCancel={isMobile ? handleTouchEnd : undefined}
      />
      
      {renderContent()}

      {isChangelogVisible && <ChangelogOverlay onClose={() => setIsChangelogVisible(false)} />}

      {isAdminMenuOpen && gameStatus === GameStatus.Playing && (
          <AdminMenu
              onClose={() => setIsAdminMenuOpen(false)}
              onUnlockEvolution={handleUnlockEvolution}
              onGainXp={handleGainXpAdmin}
              onGainCoins={handleGainCoinsAdmin}
              onGiveAllItems={handleGiveAllItems}
              onToggleGodMode={handleToggleGodMode}
              isGodMode={isGodMode}
              onSpawnBigBoss={handleSpawnBigBossAdmin}
              onPostPatchNotes={postPatchNotes}
          />
      )}
      
      {/* UI Controls */}
      <div className="absolute top-2 right-2 flex gap-2 z-30">
        <button onClick={() => setIsMuted(!isMuted)} className="bg-gray-800/80 p-2 rounded-md hover:bg-gray-700" aria-label={isMuted ? 'Unmute' : 'Mute'}>
          {isMuted ? '🔇' : '🔊'}
        </button>
      </div>

      {/* The mobile controls section was removed because the input file was truncated and malformed. */}
    </div>
  );
};