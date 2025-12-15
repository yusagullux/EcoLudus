import { getUserProfile, updateUserProfile } from "./auth.js";

const ANIMALS = {
    common: [
        { id: "animal_common_1", name: "Cat", image: "../images/pets/cat.png", rarity: "common", weight: 1 },
        { id: "animal_common_2", name: "Dog", image: "../images/pets/dog.png", rarity: "common", weight: 1 },
        { id: "animal_common_3", name: "Rabbit", image: "../images/pets/rabbit.png", rarity: "common", weight: 1 },
        { id: "animal_common_4", name: "Bee", image: "../images/pets/bee.png", rarity: "common", weight: 1 },
        { id: "animal_common_5", name: "Mouse", image: "../images/pets/mouse.png", rarity: "common", weight: 1 },
        { id: "animal_common_6", name: "Worm", image: "../images/pets/worm.png", rarity: "common", weight: 1 }
    ],
    rare: [
        { id: "animal_rare_1", name: "Deer", image: "../images/pets/deer.png", rarity: "rare", weight: 1 },
        { id: "animal_rare_2", name: "Owl", image: "../images/pets/owl.png", rarity: "rare", weight: 1 },
        { id: "animal_rare_3", name: "Panda", image: "../images/pets/panda.png", rarity: "rare", weight: 1 },
        { id: "animal_rare_4", name: "Cobra", image: "../images/pets/cobra.png", rarity: "rare", weight: 1 },
        { id: "animal_rare_5", name: "Jaguar", image: "../images/pets/jaguar.png", rarity: "rare", weight: 1 }
    ],
    epic: [
        { id: "animal_epic_1", name: "Wolf", image: "../images/pets/wolf.png", rarity: "epic", weight: 1 },
        { id: "animal_epic_2", name: "Bear", image: "../images/pets/bear.png", rarity: "epic", weight: 1 },
        { id: "animal_epic_3", name: "Eagle", image: "../images/pets/eagle.png", rarity: "epic", weight: 1 },
        { id: "animal_epic_4", name: "Lynx", image: "../images/pets/lynx.png", rarity: "epic", weight: 1 },
        { id: "animal_epic_5", name: "Shark", image: "../images/pets/shark.png", rarity: "epic", weight: 1 },
        { id: "animal_epic_6", name: "Whale", image: "../images/pets/whale.png", rarity: "epic", weight: 1 }
    ],
    legendary: [
        { id: "animal_legendary_1", name: "Tiger", image: "../images/pets/tiger.png", rarity: "legendary", weight: 1 },
        { id: "animal_legendary_2", name: "Lion", image: "../images/pets/lion.png", rarity: "legendary", weight: 1 },
        { id: "animal_legendary_3", name: "Phoenix", image: "../images/pets/phoenix.png", rarity: "legendary", weight: 0.3 },
        { id: "animal_legendary_4", name: "Dragon", image: "../images/pets/dragon.png", rarity: "legendary", weight: 0.3 },
        { id: "animal_legendary_5", name: "Kraken", image: "../images/pets/kraken.png", rarity: "legendary", weight: 1 },
        { id: "animal_legendary_6", name: "Octapus", image: "../images/pets/octapus.png", rarity: "legendary", weight: 1 }
    ]
};

function getRandomAnimal(rarity) {
    const animals = ANIMALS[rarity] || ANIMALS.common;
    const totalWeight = animals.reduce((sum, animal) => sum + (animal.weight || 1), 0);
    let random = Math.random() * totalWeight;
    
    for (const animal of animals) {
        random -= (animal.weight || 1);
        if (random <= 0) {
            return animal;
        }
    }
    
    return animals[0];
}

function getAnimalEmoji(name) {
    const emojiMap = {
        "Cat": "🐱", "Dog": "🐶", "Rabbit": "🐰", "Bee": "🐝",
        "Mouse": "🐭", "Worm": "🪱",
        "Deer": "🦌", "Owl": "🦉", "Panda": "🐼", "Cobra": "🐍", "Jaguar": "🐆",
        "Wolf": "🐺", "Bear": "🐻", "Eagle": "🦅", "Lynx": "🐱",
        "Shark": "🦈", "Whale": "🐋",
        "Tiger": "🐯", "Lion": "🦁", "Phoenix": "🔥", "Dragon": "🐉",
        "Kraken": "🐙", "Octapus": "🐙"
    };
    return emojiMap[name] || "🐾";
}

export async function showHatchingAnimation(animal) {
    return new Promise((resolve) => {
        const modal = document.createElement("div");
        modal.className = "hatching-modal";
        modal.innerHTML = `
            <div class="hatching-content">
                <div class="egg-crack-animation">
                    <div class="egg-shell">
                        <div class="egg-crack-line crack-1"></div>
                        <div class="egg-crack-line crack-2"></div>
                        <div class="egg-crack-line crack-3"></div>
                    </div>
                </div>
                <div class="animal-reveal" style="display: none;">
                    <img src="${animal.image}" alt="${animal.name}" class="hatched-animal-image"
                         onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'placeholder-animal\\'>${getAnimalEmoji(animal.name)}</div><h2 class=\\'animal-name-reveal\\'>${animal.name}!</h2><div class=\\'rarity-badge ${animal.rarity}\\'>${animal.rarity}</div>';" />
                    <h2 class="animal-name-reveal">${animal.name}!</h2>
                    <div class="rarity-badge ${animal.rarity}">${animal.rarity}</div>
                </div>
                <div class="sparkle sparkle-1"></div>
                <div class="sparkle sparkle-2"></div>
                <div class="sparkle sparkle-3"></div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        setTimeout(() => {
            modal.querySelector(".egg-crack-animation").classList.add("cracking");
        }, 500);
        
        setTimeout(() => {
            modal.querySelector(".egg-crack-animation").style.display = "none";
            const animalReveal = modal.querySelector(".animal-reveal");
            animalReveal.style.display = "block";
            animalReveal.classList.add("revealed");
        }, 2000);
        
        setTimeout(() => {
            modal.classList.add("fade-out");
            setTimeout(() => {
                if (document.body.contains(modal)) {
                    document.body.removeChild(modal);
                }
                resolve();
            }, 500);
        }, 4000);
    });
}

export async function checkAndProcessHatchings(userId) {
    try {
        const profileResult = await getUserProfile(userId);
        if (!profileResult.success) {
            return { hasNewHatchings: false, newAnimals: [] };
        }

        const profile = profileResult.data;
        const userHatchings = profile.hatchings || [];
        const userAnimals = profile.animals || [];
        const now = Date.now();
        const updatedHatchings = [];
        const newAnimals = [];

        for (const hatching of userHatchings) {
            if (hatching.endTime <= now) {
                const animal = getRandomAnimal(hatching.rarity);
                newAnimals.push({
                    ...animal,
                    hatchedAt: new Date().toISOString(),
                    fromEgg: hatching.eggId
                });
            } else {
                updatedHatchings.push(hatching);
            }
        }

        if (newAnimals.length > 0) {
            const updatedAnimals = [...userAnimals, ...newAnimals];
            await updateUserProfile(userId, {
                hatchings: updatedHatchings,
                animals: updatedAnimals
            });
            
            return { hasNewHatchings: true, newAnimals, updatedHatchings, updatedAnimals };
        } else if (updatedHatchings.length !== userHatchings.length) {
            await updateUserProfile(userId, {
                hatchings: updatedHatchings
            });
        }

        return { hasNewHatchings: false, newAnimals: [] };
    } catch (error) {
        console.error("Error checking hatchings:", error);
        return { hasNewHatchings: false, newAnimals: [] };
    }
}

export async function showHatchingAnimationsSequentially(animals) {
    for (const animal of animals) {
        await showHatchingAnimation(animal);
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

