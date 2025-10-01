import type { Item, Weapon } from './types';

export const INITIAL_PLAYER_STATS = {
  hpMax: 100,
  dmgMult: 1.0,
  moveSpd: 330,
  dodgeCD: 2.2,
  dmgTakenMul: 1.0,
  ricochet: 0.0,
  critChance: 0.10,
  critDamage: 1.5,
};

export const INITIAL_WEAPON: Omit<Weapon, 'level' | 'ammo' | 'reloading' | 'reloadT' | 'attackCooldown' | 'currentDmgMin' | 'currentDmgMax' | 'currentAttackCD' | 'currentClipSize' | 'currentReloadTime' | 'currentProjCount' | 'currentProjSpeed' | 'currentProjSpread' | 'currentProjPierce'> = {
  id: 'pistol',
  name: 'Old Pistol',
  baseDmgMin: 10,
  baseDmgMax: 18,
  attackCDBase: 1.0,
  clipSize: 7,
  reloadTime: 1.2,
  projCount: 1,
  projSpeed: 780,
  projSpread: 0.12,
  projPierce: 0,
  upgrade: {
    dmg: 3,
    attackSpeed: 0.92,
    clip: 1,
    reload: 0.95,
  }
};

// FIX: Changed type from Record<string, any> to Record<string, Item> to provide strong typing.
export const ITEMS: Record<string, Item> = {
  relic1: { id:'relic1', name:'Relic I',  slot:'charm', rarity:'white', mods:{ hpMaxAdd:50,  atkCDMul:0.90, dmgTakenMul:0.90, ricochetAdd:0.05 } },
  relic2: { id:'relic2', name:'Relic II', slot:'charm', rarity:'blue', mods:{ hpMaxAdd:100, atkCDMul:0.80, dmgTakenMul:0.85, ricochetAdd:0.10 } },
  relic3: { id:'relic3', name:'Relic III',slot:'charm', rarity:'purple', mods:{ hpMaxAdd:150, atkCDMul:0.70, dmgTakenMul:0.80, ricochetAdd:0.15 } },
  relic4: { id:'relic4', name:'Relic IV', slot:'charm', rarity:'gold', mods:{ hpMaxAdd:200, atkCDMul:0.50, dmgTakenMul:0.75, ricochetAdd:0.20 } },
  scope1: { id:'scope1', name:'Laser Sight', slot:'head', rarity:'blue', mods:{ critChanceAdd:0.10, critDamageAdd:0.25 } },

  // Body
  vest1: { id:'vest1', name:'Combat Vest', slot:'body', rarity:'white', mods:{ hpMaxAdd: 75, dmgTakenMul: 0.95 } },
  vest2: { id:'vest2', name:'Plated Armor', slot:'body', rarity:'blue', mods:{ hpMaxAdd: 150, dmgTakenMul: 0.90, moveSpdMul: 0.95 } },
  vest3: { id:'vest3', name:'Reactive Armor', slot:'body', rarity:'purple', mods:{ hpMaxAdd: 200, dmgTakenMul: 0.85 } },

  // Boots
  boots1: { id:'boots1', name:'Running Shoes', slot:'boots', rarity:'white', mods:{ moveSpdMul: 1.10 } },
  boots2: { id:'boots2', name:'Combat Boots', slot:'boots', rarity:'blue', mods:{ moveSpdMul: 1.15, dodgeCDMul: 0.90 } },
  boots3: { id:'boots3', name:'Hover Boots', slot:'boots', rarity:'purple', mods:{ moveSpdMul: 1.20, dodgeCDMul: 0.90 } },
};

export const RARITY_RANK: Record<string, number> = { white:1, blue:2, purple:3, gold:4 };

export const BOSS_DROP = {
  dropChance: 0.75,
  weights: [ ['relic1',0.62], ['relic2',0.25], ['relic3',0.12], ['relic4',0.01] ]
};

export const MINIBOSS_DROP = {
  dropChance: 0.50,
  weights: [ ['scope1', 0.20], ['vest2', 0.30], ['boots2', 0.30], ['relic1', 0.20] ]
};

export const EVOLUTIONS = [
  { id: 'railgun', name: 'Railgun', req: { pierce: 2, spread: 1 }, apply(player: any) { player.evo.gun = 'railgun'; } },
  { id: 'smg', name: 'SMG Frenzy', req: { multishot: 2 }, apply(player: any) { player.evo.gun = 'smg'; } },
  { id: 'explosive', name: 'Explosive Rounds', req: { pierce: 1, multishot: 1 }, apply(player: any) { player.evo.gun = 'explosive'; } },
  { id: 'shotgun', name: 'Shotgun Blast', req: { multishot: 1, spread: 1 }, apply(player: any) { player.evo.gun = 'shotgun'; } },
  { id: 'chain', name: 'Chain Lightning', req: { pierce: 2, critChance: 1 }, apply(player: any) { player.evo.gun = 'chain'; } }
];

export const LOCAL_SCORE_KEY = 'johnstick.scores.v1';
export const GET_LEADERBOARD_URL = 'leaderboard.php';
export const SUBMIT_SCORE_URL = 'submit_score.php';
export const META_STORAGE_KEY = 'johnstick.meta.v1';

export const META_UPGRADES: Record<string, {
  name: string;
  desc: string;
  maxLevel: number;
  cost: (lvl: number) => number;
  effect: (lvl: number) => Record<string, number>;
}> = {
  hp: { name: 'Toughness', desc: 'Start with more Max HP.', maxLevel: 10, cost: (lvl: number) => 20 + lvl * 10, effect: (lvl: number) => ({ baseHpMaxAdd: lvl * 10 }) },
  xp: { name: 'Fast Learner', desc: 'Gain more XP from all sources.', maxLevel: 10, cost: (lvl: number) => 30 + lvl * 20, effect: (lvl: number) => ({ baseXpMul: lvl * 0.02 }) },
  coins: { name: 'Greed', desc: 'Find more Golden Coins.', maxLevel: 5, cost: (lvl: number) => 100 + lvl * 100, effect: (lvl: number) => ({ coinMul: lvl * 0.1 }) },
  reroll: { name: 'Reroll Choice', desc: 'Start each run with one additional reroll.', maxLevel: 5, cost: (lvl: number) => 250 + lvl * 200, effect: (lvl: number) => ({ rerolls: lvl }) },
  banish: { name: 'Banish Choice', desc: 'Permanently remove a perk choice from the pool for the rest of the run.', maxLevel: 5, cost: (lvl: number) => 300 + lvl * 200, effect: (lvl: number) => ({ banishes: lvl }) },
  dmg: { name: 'Power', desc: 'Start with a small damage bonus.', maxLevel: 5, cost: (lvl: number) => 50 + lvl * 30, effect: (lvl: number) => ({ baseDmgMul: lvl * 0.02 }) },
  dr: { name: 'Armor', desc: 'Start with a small amount of damage reduction.', maxLevel: 5, cost: (lvl: number) => 50 + lvl * 30, effect: (lvl: number) => ({ baseDmgTakenMul: -lvl * 0.02 }) },
  critChance: { name: 'Critical Focus', desc: 'Start with a higher critical hit chance.', maxLevel: 5, cost: (lvl: number) => 50 + lvl * 30, effect: (lvl: number) => ({ baseCritChanceAdd: lvl * 0.01 }) },
  moveSpd: { name: 'Agility', desc: 'Start with a small movement speed bonus.', maxLevel: 5, cost: (lvl: number) => 50 + lvl * 30, effect: (lvl: number) => ({ baseMoveSpdMul: lvl * 0.02 }) },
};

export const CHANGELOG_VERSIONS = [
  {
    version: 'Alpha 0.225',
    notes: [
      "Security Fix: The Discord webhook for posting patch notes is now handled by a secure backend service, resolving a client-side vulnerability where the webhook URL was exposed.",
    ],
  },
  {
    version: 'Alpha 0.224',
    notes: [
      "Visuals: The Fog of War is now static at the edges of the screen, creating a more atmospheric effect of enemies emerging from the darkness.",
      "Balance: Ricochet perk chance has been reduced from 15% to 5% per level.",
      "Balance: The Ricochet bonus provided by Relic items has been significantly re-tuned (5%/10%/15%/20%).",
      "Balance: Melee enemy contact damage has been increased by 15%.",
      "Meta: The cost of all permanent upgrades has been increased to slow down progression.",
      "Meta: The 'Reroll' upgrade has been reworked. It is now a 5-level upgrade that grants starting rerolls for a run, similar to how 'Banish' works.",
    ],
  },
  {
    version: 'Alpha 0.223.2',
    notes: [
      "Gameplay: The Railgun evolution now synergizes with the Ricochet perk. The beam can now bend after hitting enemies to strike additional targets.",
      "Balance: Re-tuned the stats on Relic items. Damage reduction and late-game HP bonuses have been lowered.",
      "Balance: 'The Don' boss has received a 40% movement speed increase, making the encounter more dynamic and challenging.",
    ],
  },
  {
    version: 'Alpha 0.223.1',
    notes: [
      "Bug Fix: Corrected an issue where Banishes and Rerolls were being incorrectly restored whenever player stats were recalculated (e.g., after picking up an item). These resources are now correctly persisted for the entire run.",
    ],
  },
  {
    version: 'Alpha 0.223',
    notes: [
      "UI/UX Overhaul: The permanent Upgrades menu is now a non-pausing overlay on the title screen, consistent with the Game Info screen's design and color scheme.",
      "Clarity Improvement: Permanent upgrade cards now display their current stat bonus (e.g., '+10% XP Gain'), providing clearer feedback on your progression.",
      "New Meta Upgrade: 'Banish Choice' has been added! Level it up to gain charges that let you permanently remove a perk from the selection pool for the rest of your run.",
      "New Feature: Banish buttons now appear on perk cards during level-up, allowing you to use your Banish charges for greater control over your build.",
    ],
  },
  {
    version: 'Alpha 0.222',
    notes: [
      "UI/UX Improvement: Replaced the browser's native `prompt()` for name entry with a seamless input form integrated directly into the Game Over screen.",
      "Bug Fix: Resolved an issue where the game could get stuck on the Game Over screen if score submission was cancelled.",
      "Leaderboard Logic: Hardened the leaderboard submission flow to be more reliable and provide better user feedback.",
    ],
  },
  {
    version: 'Alpha 0.221',
    notes: [
      "Added temporary placeholder sound effects for key actions to improve gameplay feedback. These will be replaced with final assets in a future update.",
      "Developer Note: We are investigating intermittent connectivity issues with the online leaderboard. The game will automatically fall back to local high scores if the online service is unavailable.",
    ],
  },
  {
    version: 'Alpha 0.220',
    notes: [
      "Added 10 new unique perks to the level-up pool, offering more diverse playstyle choices.",
      "New Perks: Ricochet Rounds, Momentum, Adrenaline Rush, Glass Cannon, Singularity, Second Wind, Golden Touch, Hollow Points, Overcharge, and Executioner's Might.",
      "Updated internal types to support the new perk mechanics.",
      "Integrated the logic for all new perks into the core game loop.",
    ],
  },
  {
    version: 'Alpha 0.211.1',
    notes: [
      "Fixed a critical bug that caused the game to freeze and become unresponsive after submitting a high score.",
      "The bug was triggered by a state update loop that repeatedly reset the game's internal clock and core functions, preventing a new game from starting.",
      "Resolved a related issue where the game would continuously try to fetch the online leaderboard after a run, leading to 'Failed to fetch' errors.",
    ],
  },
  {
    version: 'Alpha 0.211',
    notes: [
      "Complete visual overhaul: The game now features a dark, neon color scheme with vibrant blues, magentas, and purples.",
      "Gameplay Rebalance: Removed automatic health gain on enemy kills to increase difficulty.",
      "Gameplay Rebalance: The 'Vampiric Rounds' (Lifesteal) perk now provides 1% lifesteal (down from 2%).",
      "New Feature: Enemies now have a 5% chance to drop a Health Pack, which restores 25% of your max HP.",
      "Quality of Life: All pickups (Items, Coins, Health Packs) are now affected by the player's pickup radius and magnets.",
    ],
  },
  {
    version: 'Alpha 0.210',
    notes: [
      "Added a new gore system: defeating enemies now produces blood splatters and gibs for more satisfying feedback.",
      "Added 3 new perks to the level-up pool: 'Seismic Slam', 'Vampiric Rounds', and 'Reactive Plating'.",
      "'Seismic Slam' (Stomp): Your dodge now creates a damaging shockwave.",
      "'Vampiric Rounds' (Lifesteal): Heal for a percentage of the damage you deal.",
      "'Reactive Plating' (Thorns): Enemies that hit you take damage in return.",
      "Removed the floating XP text on orb pickup to reduce visual clutter.",
    ],
  },
  {
    version: 'Alpha 0.200',
    notes: [
      'Introduced a new, more challenging Big Boss: "The Don", who appears every 10 waves.',
      'The Don features unique artwork based on the new design, and a more aggressive AI, including a tommy gun projectile spray.',
      'Increased the Big Boss\'s health to provide a tougher fight.',
      'The Don now summons a larger squad of minions when his health drops below 50%.',
    ],
  },
  {
    version: 'Alpha 0.102',
    notes: [
      'Fixed a critical bug causing XP gain to multiply exponentially throughout a run.',
      'Overhauled the stat calculation system to be more robust and prevent similar compounding bugs with other stats.',
      'Added floating text feedback to show the exact amount of XP gained (including all bonuses) when collecting orbs.',
      'Adjusted the "XP Gain" perk value back to +5% per level.',
    ],
  },
  {
    version: 'Alpha 0.101',
    notes: [
      'Added version number and changelog to the title screen.',
      'Corrected game title to "John Stick".',
      'Developer Note: We are aware of ongoing audio issues and are working on a fix for the next update. Thank you for your patience!',
    ],
  },
  {
    version: 'Alpha 0.100',
    notes: [
        'Initial public alpha release.',
        'Introduced new special enemies: Healer, Summoner, and Disabler.',
        'Added Elite enemy affixes: Hasted, Shielded, Explosive Death, and Life Leech.',
        'Implemented the weapon evolution system with 5 unique gun evolutions.',
        'Added permanent meta-progression upgrades system.',
    ],
  },
];