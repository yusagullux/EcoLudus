export const LEVEL_MILESTONES = [
    0,      // Level 1
    100,    // Level 2
    250,    // Level 3
    500,    // Level 4
    1000,   // Level 5
    2500,   // Level 6
    5000,   // Level 7
    10000,  // Level 8
    50000   // Level 9
];

export const MAX_LEVEL = LEVEL_MILESTONES.length; // 9

export function calculateLevel(xp) {
    if (typeof xp !== 'number' || xp < 0) return 1;
    for (let i = LEVEL_MILESTONES.length - 1; i >= 0; i--) {
        if (xp >= LEVEL_MILESTONES[i]) {
            return i + 1;
        }
    }
    return 1;
}

export function getXPRequiredForLevel(level) {
    if (level <= 1) return LEVEL_MILESTONES[1] - LEVEL_MILESTONES[0]; // 100
    if (level >= MAX_LEVEL) return Infinity; // Maksimumtase saavutatud
    return LEVEL_MILESTONES[level] - LEVEL_MILESTONES[level - 1];
}

export function getTotalXPForLevel(level) {
    if (level <= 1) return 0;
    if (level > MAX_LEVEL) return LEVEL_MILESTONES[MAX_LEVEL - 1];
    return LEVEL_MILESTONES[level - 1];
}

export function getXPProgress(xp, currentLevel = null) {
    const safeXP = Math.max(0, parseInt(xp) || 0);
    const level = currentLevel || calculateLevel(safeXP);

    // Maksimumtaseme korral kuva täisriba
    if (level >= MAX_LEVEL) {
        return {
            current: safeXP - LEVEL_MILESTONES[MAX_LEVEL - 1],
            required: 0,
            percentage: 100
        };
    }

    const totalXPForCurrentLevel = getTotalXPForLevel(level);
    const xpInCurrentLevel = safeXP - totalXPForCurrentLevel;
    const requiredXP = getXPRequiredForLevel(level + 1);

    const percentage = requiredXP > 0
        ? Math.min(100, (xpInCurrentLevel / requiredXP) * 100)
        : 100;

    return {
        current: xpInCurrentLevel,
        required: requiredXP,
        percentage: Math.max(0, percentage)
    };
}

export function getBadgeImageForLevel(level) {
    const badgeImages = {
        1: "../images/ecoquests-badges/cat-badge-removedbg.png",
        2: "../images/ecoquests-badges/fox-badge-removedbg.png",
        3: "../images/ecoquests-badges/rabbit-badge-removedbg.png",
        4: "../images/ecoquests-badges/deer-badge-removedbg.png",
        5: "../images/ecoquests-badges/wolf-badge-removedbg.png",
        6: "../images/ecoquests-badges/bear-badge-removedbg.png",
        7: "../images/ecoquests-badges/eagle-badge-removedbg.png",
        8: "../images/ecoquests-badges/tiger-badge-removedbg.png",
        9: "../images/ecoquests-badges/lion-badge-removedbg.png"
    };
    return badgeImages[level] || badgeImages[1];
}

export function getBadgeNameForLevel(level) {
    const badgeNames = {
        1: "Cat",
        2: "Fox",
        3: "Rabbit",
        4: "Deer",
        5: "Wolf",
        6: "Bear",
        7: "Eagle",
        8: "Tiger",
        9: "Lion"
    };
    return badgeNames[level] || badgeNames[1];
}

export function calculateEcoPoints(xp, level, badgesCount = 0) {
    if (xp < 0 || level < 1 || badgesCount < 0) {
        return 0;
    }

    let basePoints = 0;
    if (level <= 3) {
        basePoints = Math.floor(xp / 10);
    } else if (level <= 5) {
        basePoints = Math.floor(xp / 15);
    } else if (level <= 7) {
        basePoints = Math.floor(xp / 25);
    } else {
        basePoints = Math.floor(xp / 50);
    }

    const badgeBonus = badgesCount * 10;
    return Math.max(0, basePoints + badgeBonus);
}
