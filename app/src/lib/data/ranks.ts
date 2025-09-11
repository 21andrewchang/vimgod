export type RankName = 'Unranked' | 'Iron' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Nova' | 'Supernova' | 'Singularity';

export const RANKS: RankName[] = ['Unranked', 'Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Nova', 'Supernova', 'Singularity'];

export const motionsByRank: Record<Exclude<RankName, 'Unranked'>, string[]> = {
    Iron: ['h', 'j', 'k', 'l'],
    Bronze: [],
    Silver: [],
    Gold: [],
    Platinum: [],
    Diamond: [],
    Nova: [],
    Supernova: [],
    Singularity: [],
};