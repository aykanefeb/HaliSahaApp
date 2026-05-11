// Algorithm Weights
export const positionWeights = {
    'Kaleci': {
        'reflexes': { label: 'Refleks', weight: 0.40 },
        'footwork': { label: 'Ayak (Degaj)', weight: 0.20 },
        'physical': { label: 'Fizik', weight: 0.10 },
        'leadership': { label: 'Liderlik', weight: 0.10 },
        'aerial': { label: 'Hava Topu', weight: 0.10 },
        'passing': { label: 'Pas', weight: 0.10 }
    },
    'Defans': {
        'defense': { label: 'Defans', weight: 0.30 },
        'physical': { label: 'Fizik', weight: 0.20 },
        'aerial': { label: 'Hava Topu', weight: 0.15 },
        'pace': { label: 'Hız', weight: 0.10 },
        'passing': { label: 'Pas', weight: 0.10 },
        'stamina': { label: 'Dayanıklılık', weight: 0.10 },
        'leadership': { label: 'Liderlik', weight: 0.05 }
    },
    'Orta Saha': {
        'passing': { label: 'Pas', weight: 0.25 },
        'technique': { label: 'Teknik', weight: 0.18 },
        'stamina': { label: 'Dayanıklılık', weight: 0.17 },
        'defense': { label: 'Defans', weight: 0.10 },
        'physical': { label: 'Fizik', weight: 0.10 },
        'shooting': { label: 'Şut', weight: 0.09 },
        'pace': { label: 'Hız', weight: 0.08 },
        'leadership': { label: 'Liderlik', weight: 0.03 }
    },
    'Kanat': {
        'pace': { label: 'Hız', weight: 0.30 },
        'technique': { label: 'Teknik', weight: 0.25 },
        'stamina': { label: 'Dayanıklılık', weight: 0.20 },
        'passing': { label: 'Pas', weight: 0.10 },
        'shooting': { label: 'Şut', weight: 0.10 },
        'finishing': { label: 'Bitiricilik', weight: 0.05 }
    },
    'Forvet': {
        'finishing': { label: 'Bitiricilik', weight: 0.35 },
        'shooting': { label: 'Şut', weight: 0.20 },
        'physical': { label: 'Fizik', weight: 0.15 },
        'aerial': { label: 'Hava Topu', weight: 0.10 },
        'pace': { label: 'Hız', weight: 0.10 },
        'technique': { label: 'Teknik', weight: 0.10 }
    }
};

export const universalAttributes = {
    pace: 'Hız',
    shooting: 'Şut',
    finishing: 'Bitiricilik',
    passing: 'Pas',
    physical: 'Fizik',
    defense: 'Defans',
    stamina: 'Dayanıklılık',
    technique: 'Teknik',
    leadership: 'Liderlik',
    aerial: 'Hava Topu',
    reflexes: 'Refleks',
    footwork: 'Ayak (Degaj)'
};

// Calculate overall rating based on skills and weights
export function calculateRating(stats, position) {
    const weights = positionWeights[position];
    let score = 0;

    for (const key in weights) {
        const val = stats[key] || 50;
        score += val * weights[key].weight;
    }

    // Convert to 5-star scale
    return (score / 20).toFixed(1);
}
