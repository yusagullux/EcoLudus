export function requiredXP(level) {
    const safeLevel = Math.max(1, Math.floor(level));
    return 100 * safeLevel + 25 * safeLevel * safeLevel;
}

export function calculateLevel(xp) {
    const safeXp = Math.max(0, Math.floor(Number.isFinite(xp) ? xp : 0));
    let level = 1;
    while (safeXp >= requiredXP(level)) {
        level += 1;
    }
    return level;
}

export function getXPRequiredForLevel(level) {
    const activeLevel = Math.max(1, Math.floor(level));
    return requiredXP(activeLevel) - (activeLevel <= 1 ? 0 : requiredXP(activeLevel - 1));
}

export function getTotalXPForLevel(level) {
    if (level <= 1) return 0;
    return requiredXP(level - 1);
}

export function getXPProgress(xp, currentLevel = null) {
    const safeXP = Math.max(0, parseInt(xp) || 0);
    const level = currentLevel || calculateLevel(safeXP);

    const totalXPForCurrentLevel = level <= 1 ? 0 : requiredXP(level - 1);
    const totalXPForNextLevel = requiredXP(level);
    const xpInCurrentLevel = safeXP - totalXPForCurrentLevel;
    const requiredXPInLevel = totalXPForNextLevel - totalXPForCurrentLevel;

    const percentage = requiredXPInLevel > 0
        ? Math.min(100, (xpInCurrentLevel / requiredXPInLevel) * 100)
        : 100;

    return {
        current: xpInCurrentLevel,
        required: requiredXPInLevel,
        percentage: Math.max(0, percentage)
    };
}

export function getBadgeImageForLevel(level) {
    const activeLevel = Math.max(1, Math.floor(level));
    const badgeIndex = ((activeLevel - 1) % 9) + 1;
    const badgeImages = {
        1: "/images/ecoquests-badges/cat-badge-removedbg.png",
        2: "/images/ecoquests-badges/fox-badge-removedbg.png",
        3: "/images/ecoquests-badges/rabbit-badge-removedbg.png",
        4: "/images/ecoquests-badges/deer-badge-removedbg.png",
        5: "/images/ecoquests-badges/wolf-badge-removedbg.png",
        6: "/images/ecoquests-badges/bear-badge-removedbg.png",
        7: "/images/ecoquests-badges/eagle-badge-removedbg.png",
        8: "/images/ecoquests-badges/tiger-badge-removedbg.png",
        9: "/images/ecoquests-badges/lion-badge-removedbg.png"
    };
    return badgeImages[badgeIndex] || badgeImages[1];
}

export function getBadgeNameForLevel(level) {
    const activeLevel = Math.max(1, Math.floor(level));
    const badgeIndex = ((activeLevel - 1) % 9) + 1;
    const tier = Math.floor((activeLevel - 1) / 9);

    const baseNames = {
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

    const tiers = ["Bronze", "Silver", "Gold", "Platinum", "Emerald", "Diamond", "Master", "Grandmaster", "Legendary"];
    const tierName = tiers[Math.min(tier, tiers.length - 1)];
    const animalName = baseNames[badgeIndex] || "Explorer";

    if (tier >= tiers.length) {
        const roman = getRomanNumeral(tier - tiers.length + 1);
        return `Legendary ${animalName} ${roman}`;
    }

    return `${tierName} ${animalName}`;
}

function getRomanNumeral(num) {
    const lookup = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
    let roman = '';
    for (let i in lookup) {
        while (num >= lookup[i]) {
            roman += i;
            num -= lookup[i];
        }
    }
    return roman;
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
