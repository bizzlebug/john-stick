



export enum GameStatus {
  Title,
  Playing,
  Paused,
  LevelUp,
  GameOver,
  Upgrades,
  Duels,
}

export interface Weapon {
  id: string;
  name: string;
  level: number;
  // Base stats
  baseDmgMin: number;
  baseDmgMax: number;
  attackCDBase: number;
  clipSize: number;
  reloadTime: number;
  projCount: number;
  projSpeed: number;
  projSpread: number;
  projPierce: number;
  // Upgrade path
  upgrade: {
    dmg?: number;
    attackSpeed?: number;
    clip?: number;
    reload?: number;
    multishot?: number;
  };
  // Current calculated stats
  currentDmgMin: number;
  currentDmgMax: number;
  currentAttackCD: number;
  currentClipSize: number;
  currentReloadTime: number;
  currentProjCount: number;
  currentProjSpeed: number;
  currentProjSpread: number;
  currentProjPierce: number;
  // Runtime state
  ammo: number;
  reloading: boolean;
  reloadT: number;
  attackCooldown: number;
}

export interface Player {
  x: number;
  y: number;
  r: number;
  hitboxHeight: number;
  baseSpeed: number;
  speed: number;
  hp: number;
  hpMax: number;
  invuln: number;
  facing: number;
  facingDirection: number;
  aimAngle: number;
  jumpCooldown: number;
  jumpCDBase: number;
  dmgMult: number;
  dmgTakenMul: number;
  ricochet: number;
  critChance: number;
  critDamage: number;
  level: number;
  xp: number;
  xpNext: number;
  weapon: Weapon;
  runT: number;
  bob: number;
  evo: { gun: string | null };
  slow: { duration: number; factor: number };
  rerollsLeft: number;
  banishesLeft: number;
  chainBounces: number;
  stompDamage?: number;
  lifestealPercent?: number;
  thornsDamage?: number;
  isDemo?: boolean;
  _statsView?: any;
  // New perk fields
  momentum?: { duration: number };
  momentumBonus?: number;
  secondWindUsed?: boolean;
  hollowPointsBonus?: number;
  overchargeBonus?: number;
  executionerBuff?: { duration: number };
}

export interface Enemy {
  id: number;
  type: string;
  x: number;
  y: number;
  r: number;
  hitboxHeight: number;
  speed: number;
  hp: number;
  hpMax: number;
  dmg: number;
  hitTimer: number;
  stun: number;
  facingDirection: number;
  runT: number;
  shoot?: number;
  atk?: number;
  burstLeft?: number;
  burstGap?: number;
  detonation?: number; // for bombers
  healRate?: number;    // for healers
  healRadius?: number;  // for healers
  spawnCD?: number;     // for summoners
  strafeTimer?: number; // for AI movement
  strafeDuration?: number; // for AI movement
  strafeDir?: number;      // for AI movement
  // Elite Affixes
  affix?: 'Hasted' | 'Shielded' | 'Explosive Death' | 'Life Leech';
  shield?: number;
  shieldMax?: number;
  shieldRechargeTimer?: number;
  // Variation
  faceType?: 'normal' | 'angry' | 'smirk';
  hairColor?: string;
  shirtColor?: string;
  pantsColor?: string;
  meleeWeapon?: 'bat' | 'knife' | null;
  meleeAttackCD?: number;
  meleeAttackTimer?: number;
  dealtDamageThisSwing?: boolean;
  // Big Boss properties
  isBigBoss?: boolean;
  bossType?: 'warden' | 'don';
  phase?: number;
  attackState?: string;
  attackTimer?: number;
  bigBossInfo?: {
    name: string;
    title: string;
  };
  chargeTarget?: { x: number; y: number };
  fromOpponent?: boolean;  // Marks enemies sent from opponent in Duels mode
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  t: number;
  pierce?: number;
  explosive?: boolean;
  hitEnemies?: number[];
  slows?: boolean;
  chainLightning?: boolean;
  bouncesLeft?: number;
  forceCrit?: boolean; // For Overcharge perk
  hasTrail?: boolean;
  trailPoints?: {x: number, y: number}[];
}

export interface Orb {
  x: number;
  y: number;
  xp: number;
  mult: number;
  r: number;
}

export interface Drop {
  type: 'magnet' | 'item' | 'goldenCoin' | 'health';
  x: number;
  y: number;
  r: number;
  t: number;
  itemId?: string;
  color?: string;
}

export interface FloatingText {
  id: number;
  x: number;
  y: number;
  amount: string;
  isCrit: boolean;
  color?: string;
  t?: number;
  isAnnouncement?: boolean;
  critPower?: number;
}

export interface Perk {
  id: string;
  name: string;
  desc: string;
  apply: () => void;
}

export interface Item {
  id:string;
  name:string;
  slot: string;
  rarity: string;
  mods: Record<string, number>;
}

export interface Score {
  score: number;
  time: number;
  kills: number;
  wave: number;
  hero: string;
}

export interface HudData {
  hp: number;
  hpMax: number;
  level: number;
  xp: number;
  xpNext: number;
  attackCooldown: number;
  attackCDBase: number;
  jumpCooldown: number;
  jumpCDBase: number;
  reloading: boolean;
  reloadT: number;
  reloadTime: number;
  ammo: number;
  clipSize: number;
  bossData?: Enemy | null;
}

export interface GameState {
  running: boolean;
  paused: boolean;
  elapsed: number;
  wave: number;
  vacuumAllTimer: number;
  waveInProgress: boolean;
  waveBreak: number;
  spawnQueue: number;
  spawnTimer: number;
}

export interface Effect {
  id: number;
  type: 'shockwave' | 'explosion' | 'muzzle-flash' | 'heal-aura' | 'railgun-beam' | 'chain-lightning' | 'singularity';
  x: number;
  y: number;
  r: number;
  maxR: number;
  t: number;
  maxT: number;
  color?: string;
  endX?: number; // For beam
  endY?: number; // For beam
  points?: {x: number, y: number}[]; // For multi-segment beams
}

export interface BloodParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  t: number;
  maxT: number;
  color: string;
}

export interface GorePiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vr: number; // rotational velocity
  t: number;
  maxT: number;
  type: 'head' | 'arm' | 'leg';
  color: string;
  size: { w: number, h: number };
}

export interface PlayerAfterimage {
  x: number;
  y: number;
  facingDirection: number;
  aimAngle: number;
  runT: number;
  t: number;
  maxT: number;
  trailPosition: number;
}

// Meta Progression
export interface MetaUpgradeState {
  [key: string]: number; // id: level
}

export interface MetaState {
  coins: number;
  // FIX: Corrected typo 'MetaUpgrade-State' to 'MetaUpgradeState'.
  upgrades: MetaUpgradeState;
}
