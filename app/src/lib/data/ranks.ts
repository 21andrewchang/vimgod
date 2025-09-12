export type RankName = 
    | 'Unranked' | 'Iron' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum' 
    | 'Diamond' | 'Nova' | 'Supernova' | 'Singularity';

export const RANKS: RankName[] = [
    'Unranked', 'Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Nova', 'Supernova', 'Singularity'
];

export const FAMILY_MOTIONS = {
    // modes (normal, insert, visual, command)
    modes: [
        'esc', ':', 'R',
        'i', 'I', 'a', 'A', 'o', 'O', 'gi',
        'v', 'V', 'ctrl-v', 'gv'
    ],
  
    // basic movement (hjkl)
    basicMovement: [
      'h', 'j', 'k', 'l'
    ],
  
    // horizontal movement (w, b, $, ^)
    horizontalMovement: [
      'w', 'b', 'e', 'ge', 'W', 'B', 'E',
      '0', '^', '$', '|',
      'f{char}', 'F{char}', 't{char}', 'T{char}', ';', ','
    ],
  
    // vertical movement ( {, }, %, gg, G )
    verticalMovement: [
      '{', '}', '%', 'gg', 'G',
      'H', 'M', 'L',
      'ctrl-d', 'ctrl-u', 'ctrl-f', 'ctrl-b',
      'zz', 'zt', 'zb'
    ],
  
    // commands (d, c, y, v, x)
    commands: [
      'd', 'c', 'y', 'x',
      'r', '~', 'J',
      's', 'S', 'C', 'D', 'Y',
      'p', 'P'
    ],
  
    // undo/redo (u, Ctrl-r)
    undoRedo: [
      'u', 'ctrl-r'
    ],
  
    // searching (/, *, #, n, N)
    searching: [
      '/', '*', '#', 'n', 'N'
    ],
  
    // combos (command count motion, numbered hjkl)
    combos: [
      '{count}',
      'count-hjkl',
      'd{motion}', 'c{motion}', 'y{motion}',
      'g~{motion}', 'gu{motion}', 'gU{motion}',
      'df{char}', 'dt{char}', 'cf{char}', 'ct{char}',
      'viw', 'ciw', 'daw', 
      'iW', 'aW', 'ip', 'ap', 'is', 'as', 'it', 'at', 'i"', 'a"', "i'", "a'",
      '.'
    ]
} as const;

export type FamilyKey = keyof typeof FAMILY_MOTIONS;
export type Motion = typeof FAMILY_MOTIONS[FamilyKey][number];

export const FAMILY_LABEL: Record<FamilyKey, string> = {
    modes: 'Modes',
    basicMovement: 'Basic Movement',
    horizontalMovement: 'Horizontal Movement',
    verticalMovement: 'Vertical Movement',
    commands: 'Commands',
    undoRedo: 'Undo / Redo',
    searching: 'Searching',
    combos: 'Combos'
};
  
export const MOTIONS: Motion[] = (Object.keys(FAMILY_MOTIONS) as FamilyKey[])
  .flatMap((k) => [...FAMILY_MOTIONS[k]]);

export const FAMILY_WEIGHT: Record<FamilyKey, number> = {
    modes: 20,
    basicMovement: 10,
    horizontalMovement: 17,
    verticalMovement: 14,
    commands: 16,
    undoRedo: 5,
    searching: 9,
    combos: 9
};

export const MOTION_WEIGHT: Record<Motion, number> = (() => {
    const out = new Map<Motion, number>();
    (Object.keys(FAMILY_MOTIONS) as FamilyKey[]).forEach((fam) => {
      const motions = FAMILY_MOTIONS[fam];
      const per = FAMILY_WEIGHT[fam] / motions.length;
      motions.forEach((m) => out.set(m, per));
    });

    return Object.fromEntries(out) as any as Record<Motion, number>;
})();

export const DIAMOND_FAMILY_FLOORS: Partial<Record<FamilyKey, number>> = {
    searching: 0.30,
    horizontalMovement: 0.25,
    commands: 0.25,
    combos: 0.20
};


export const COVERAGE_THRESHOLDS = {
    Iron: 0.05,
    Bronze: 0.20,
    Silver: 0.35,
    Gold: 0.50,
    Platinum: 0.65,
    Diamond: 0.80
} as const;

export const SKILL_THRESHOLDS = {
    Nova: 70,
    Supernova: 82,
    Singularity: 92,
    SingularityStabilityMaxStdDev: 8 // ensures rank stability based on recent performance
} as const;

export const EFFICIENCY_LAMBDA_BY_RANK: Record<RankName, number> = {
    Unranked: 0.0,
    Iron: 0.0,
    Bronze: 0.0,
    Silver: 0.0,
    Gold: 0.0,
    Platinum: 0.0,
    Diamond: 0.25,
    Nova: 0.50,
    Supernova: 0.75,
    Singularity: 1.00
};

export const FAMILY_UNLOCK_RANK: Record<FamilyKey, RankName> = {
    modes: 'Iron',
    basicMovement: 'Iron',
    horizontalMovement: 'Bronze',
    verticalMovement: 'Gold',
    commands: 'Gold',
    undoRedo: 'Bronze',
    searching: 'Platinum',
    combos: 'Gold'
};

export type Mastery = Partial<Record<Motion, number>>;

export interface KnownParams {
    masteryThreshold?: number;
}

export function isMotionKnown(motion: Motion, mastery: Mastery, params: KnownParams = {}): boolean {
    const tau = params.masteryThreshold ?? 0.7;
    return (mastery[motion] ?? 0) >= tau;
}

export function knownSet(mastery: Mastery, params?: KnownParams): Set<Motion> {
    const s = new Set<Motion>();
    for (const motion of MOTIONS) if (isMotionKnown(motion, mastery, params)) s.add(motion);
    return s;
}

export function coverage(M: Mastery): number {
    let num = 0, den = 0;
    for (const m of MOTIONS) {
      const w = MOTION_WEIGHT[m];
      den += w;
      num += w * Math.min(1, M[m] ?? 0);
    }
    return den ? num / den : 0;
}

export function coverageByFamily(mastery: Mastery): Record<FamilyKey, number> {
    const out = {} as Record<FamilyKey, number>;
    (Object.keys(FAMILY_MOTIONS) as FamilyKey[]).forEach((fam) => {
      const motions = FAMILY_MOTIONS[fam];
      const wFam = FAMILY_WEIGHT[fam];
      if (wFam <= 0) { out[fam] = 0; return; }
      const share = wFam / motions.length;
      const num = motions.reduce((s, m) => s + share * Math.min(1, mastery[m] ?? 0), 0);
      out[fam] = num / wFam;
    });
    return out;
}

export function meetsDiamondFloors(M: Mastery): boolean {
    const famCov = coverageByFamily(M);
    for (const [fam, min] of Object.entries(DIAMOND_FAMILY_FLOORS) as [FamilyKey, number][]) {
      if ((famCov[fam] ?? 0) < min) return false;
    }
    return true;
}

export interface RankInputs {
    mastery: Mastery;
    skillIndex?: number;
    skillStdDev?: number;
}

export function rankFromInputs(inputs: RankInputs): RankName {
    const cov = coverage(inputs.mastery);
  
    // Pre-Diamond tiers by coverage
    if (cov < COVERAGE_THRESHOLDS.Iron) return 'Unranked';
    if (cov < COVERAGE_THRESHOLDS.Bronze) return 'Iron';
    if (cov < COVERAGE_THRESHOLDS.Silver) return 'Bronze';
    if (cov < COVERAGE_THRESHOLDS.Gold) return 'Silver';
    if (cov < COVERAGE_THRESHOLDS.Platinum) return 'Gold';
  
    if (cov < COVERAGE_THRESHOLDS.Diamond || !meetsDiamondFloors(inputs.mastery)) return 'Platinum';
  
    const skill = inputs.skillIndex ?? 0;
    if (skill < SKILL_THRESHOLDS.Nova) return 'Diamond';
    if (skill < SKILL_THRESHOLDS.Supernova) return 'Nova';
    if (skill < SKILL_THRESHOLDS.Singularity) return 'Supernova';
  
    const stable = inputs.skillStdDev === undefined ||
                   inputs.skillStdDev <= SKILL_THRESHOLDS.SingularityStabilityMaxStdDev;
    return stable ? 'Singularity' : 'Supernova';
}

export function efficiencyBlend(kUser: number, kOptGlobal: number, kOptKnown: number, rank: RankName): number {
    const clamp = (x: number) => Math.max(0, Math.min(1, x));
    const E_global = clamp(kOptGlobal / Math.max(1, kUser));
    const E_known  = clamp(kOptKnown  / Math.max(1, kUser));
    const lambda = EFFICIENCY_LAMBDA_BY_RANK[rank] ?? 0;
    return clamp(lambda * E_global + (1 - lambda) * E_known);
}

export function familiesVisibleAt(rank: RankName): FamilyKey[] {
    const idx = RANKS.indexOf(rank);
    return (Object.keys(FAMILY_UNLOCK_RANK) as FamilyKey[])
      .filter(f => RANKS.indexOf(FAMILY_UNLOCK_RANK[f]) <= idx);
}
  
export const MOTION_FAMILY = Object.fromEntries(
    (Object.keys(FAMILY_MOTIONS) as FamilyKey[]).flatMap(f =>
        FAMILY_MOTIONS[f].map(m => [m as Motion, f] as const)
    )
) as Record<Motion, FamilyKey>;

export const familyOf = (m: Motion): FamilyKey => MOTION_FAMILY[m] ?? 'modes';