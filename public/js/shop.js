import { requireAuth } from "./auth-guard.js";
import { logOut, getUserProfile, updateUserProfile } from "./auth.js";

const EGGS = [
    {
        id: "egg_common",
        name: "Common Egg",
        image: "../images/eggs/common-egg.png",
        rarity: "common",
        price: 100,
        hatchingTime: 3600000
    },
    {
        id: "egg_rare",
        name: "Rare Egg",
        image: "../images/eggs/rare-egg.png",
        rarity: "rare",
        price: 300,
        hatchingTime: 10800000
    },
    {
        id: "egg_epic",
        name: "Epic Egg",
        image: "../images/eggs/epic-egg.png",
        rarity: "epic",
        price: 600,
        hatchingTime: 43200000
    },
    {
        id: "egg_legendary",
        name: "Legendary Egg",
        image: "../images/eggs/legendary-egg.png",
        rarity: "legendary",
        price: 1200,
        hatchingTime: 86400000
    }
];

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

// Valib juhusliku looma kaalutud tõenäosusega
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

const PLANTS = [
    // Harilikud taimed
    {
        id: "plant_1",
        name: "Sunflower",
        image: "../images/plants/sunflower.png",
        rarity: "common",
        price: 50
    },
    {
        id: "plant_2",
        name: "Basil",
        image: "../images/plants/basil.png",
        rarity: "common",
        price: 40
    },
    {
        id: "plant_3",
        name: "Mint",
        image: "../images/plants/mint.png",
        rarity: "common",
        price: 45
    },
    {
        id: "plant_4",
        name: "Lavender",
        image: "../images/plants/lavender.png",
        rarity: "common",
        price: 55
    },
    // Haruldased taimed
    {
        id: "plant_5",
        name: "Rose",
        image: "../images/plants/rose.png",
        rarity: "rare",
        price: 150
    },
    {
        id: "plant_6",
        name: "Tulip",
        image: "../images/plants/tulip.png",
        rarity: "rare",
        price: 120
    },
    {
        id: "plant_7",
        name: "Orchid",
        image: "../images/plants/orchid.png",
        rarity: "rare",
        price: 180
    },
    {
        id: "plant_8",
        name: "Jasmine",
        image: "../images/plants/jasmine.png",
        rarity: "rare",
        price: 160
    },
    // Efsanevi bitkiler
    {
        id: "plant_9",
        name: "Bamboo",
        image: "../images/plants/bamboo.png",
        rarity: "epic",
        price: 350
    },
    {
        id: "plant_10",
        name: "Bonsai",
        image: "../images/plants/bonsai.png",
        rarity: "epic",
        price: 400
    },
    {
        id: "plant_11",
        name: "Lotus",
        image: "../images/plants/lotus.png",
        rarity: "epic",
        price: 380
    },
    {
        id: "plant_12",
        name: "Cherry Blossom",
        image: "../images/plants/cherry_blossom.png",
        rarity: "epic",
        price: 420
    },
    // Legendaarsed taimed
    {
        id: "plant_13",
        name: "Golden Tree",
        image: "../images/plants/goldentree.png",
        rarity: "legendary",
        price: 800
    },
    {
        id: "plant_14",
        name: "Dragon Fruit",
        image: "../images/plants/dragonfruit.png",
        rarity: "legendary",
        price: 1000
    }
];

const TOAST_DISPLAY_DURATION = 3000;
const DEFAULT_FILTER = "all";

let currentUser = null;
let userEcoPoints = 0;
let userCollection = [];
let userHatchings = [];
let userAnimals = [];
let currentFilter = DEFAULT_FILTER;
let shopMode = "plants";

function showToast(message, type = "success") {
    const toast = document.getElementById("toast");
    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, TOAST_DISPLAY_DURATION);
}

function showLoadingState(isLoading) {
    const loadingMessage = document.querySelector(".loading-message");
    if (loadingMessage) {
        loadingMessage.textContent = isLoading ? "Loading..." : "";
        loadingMessage.style.display = isLoading ? "block" : "none";
    }
}

function updateEcoPointsDisplay(ecoPointsAmount) {
    const ecoPointsElement = document.getElementById("ecopointsValue");
    if (ecoPointsElement) {
        ecoPointsElement.textContent = ecoPointsAmount.toLocaleString();
    }
}

function renderPlants(plantsToRender) {
    const plantsGridElement = document.getElementById("plantsGrid");
    if (!plantsGridElement) return;

    plantsGridElement.innerHTML = "";

    if (plantsToRender.length === 0) {
        plantsGridElement.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: var(--spacing-xl);">
                <p>No items found in this category.</p>
            </div>
        `;
        return;
    }

    plantsToRender.forEach(item => {
        const cardElement = shopMode === "eggs" ? createEggCard(item) : createPlantCard(item);
        plantsGridElement.appendChild(cardElement);
    });
}

function createEggCard(eggData) {
    const cardElement = document.createElement("div");
    cardElement.className = `plant-card ${eggData.rarity} egg-card`;

    const canAffordEgg = userEcoPoints >= eggData.price;

    const placeholderImageUrl = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect width=%22100%22 height=%22100%22 fill=%22%23f5f5f5%22/%3E%3Ctext x=%2250%22 y=%2250%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-family=%22Arial%22 font-size=%2214%22%3E🥚%3C/text%3E%3C/svg%3E';
    
    cardElement.innerHTML = `
        <div class="rarity-badge ${eggData.rarity}">${eggData.rarity}</div>
        <div class="plant-image-container egg-image-container">
            <img src="${eggData.image}" alt="${eggData.name}" class="plant-image egg-image" 
                 onerror="this.onerror=null; this.src='${placeholderImageUrl}';" />
        </div>
        <div class="plant-info">
            <h3 class="plant-name">${eggData.name}</h3>
            <div class="plant-price">
                <span class="plant-price-icon">🌿</span>
                <span>${eggData.price}</span>
            </div>
            <p style="font-size: 12px; color: var(--color-text); opacity: 0.7; margin: 4px 0;">
                Mystery animal inside!
            </p>
            <button class="buy-button" 
                    data-egg-id="${eggData.id}" 
                    ${!canAffordEgg ? 'disabled' : ''}>
                ${!canAffordEgg ? 'Not Enough EcoPoints' : 'Buy & Incubate'}
            </button>
        </div>
    `;

    const buyButtonElement = cardElement.querySelector(".buy-button");
    if (buyButtonElement && canAffordEgg) {
        buyButtonElement.addEventListener("click", () => handleBuyEgg(eggData));
    }

    return cardElement;
}

function createPlantCard(plantData) {
    const cardElement = document.createElement("div");
    cardElement.className = `plant-card ${plantData.rarity}`;

    const canAffordPlant = userEcoPoints >= plantData.price;
    const ownedCount = userCollection.filter(ownedPlant => ownedPlant.id === plantData.id).length;

    const placeholderImageUrl = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect width=%22100%22 height=%22100%22 fill=%22%23f5f5f5%22/%3E%3Ctext x=%2250%22 y=%2250%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-family=%22Arial%22 font-size=%2214%22%3E🌱%3C/text%3E%3C/svg%3E';
    
    cardElement.innerHTML = `
        <div class="rarity-badge ${plantData.rarity}">${plantData.rarity}</div>
        <div class="plant-image-container">
            <img src="${plantData.image}" alt="${plantData.name}" class="plant-image" 
                 onerror="this.onerror=null; this.src='${placeholderImageUrl}';" />
        </div>
        <div class="plant-info">
            <h3 class="plant-name">${plantData.name}</h3>
            <div class="plant-price">
                <span class="plant-price-icon">🌿</span>
                <span>${plantData.price}</span>
            </div>
            ${ownedCount > 0 ? `<p style="font-size: 12px; color: var(--color-primary); margin: 0;">Owned: ${ownedCount}</p>` : ''}
            <button class="buy-button" 
                    data-plant-id="${plantData.id}" 
                    ${!canAffordPlant ? 'disabled' : ''}>
                ${!canAffordPlant ? 'Not Enough EcoPoints' : 'Buy'}
            </button>
        </div>
    `;

    const buyButtonElement = cardElement.querySelector(".buy-button");
    if (buyButtonElement && canAffordPlant) {
        buyButtonElement.addEventListener("click", () => handleBuyPlant(plantData));
    }

    return cardElement;
}

function filterPlants(selectedRarity) {
    currentFilter = selectedRarity;
    
    const filterButtons = document.querySelectorAll(".filter-btn");
    filterButtons.forEach(button => {
        button.classList.remove("active");
        if (button.dataset.rarity === selectedRarity) {
            button.classList.add("active");
        }
    });

    const itemsToFilter = shopMode === "eggs" ? EGGS : PLANTS;
    const filteredList = selectedRarity === DEFAULT_FILTER 
        ? itemsToFilter 
        : itemsToFilter.filter(item => item.rarity === selectedRarity);

    renderPlants(filteredList);
}

function switchShopMode(mode) {
    shopMode = mode;
    const modeButtons = document.querySelectorAll(".shop-mode-btn");
    modeButtons.forEach(btn => {
        btn.classList.remove("active");
        if (btn.dataset.mode === mode) {
            btn.classList.add("active");
        }
    });
    
    const headerTitle = document.querySelector(".shop-header h1");
    if (headerTitle) {
        headerTitle.textContent = mode === "eggs" ? "🥚 Egg Shop" : "🌱 Plant Shop";
    }
    
    filterPlants(currentFilter);
}

async function loadUserData() {
    showLoadingState(true);
    
    try {
        const profileResult = await getUserProfile(currentUser.uid);
        if (!profileResult.success) {
            throw new Error(profileResult.error || "Failed to load user profile");
        }

        const profile = profileResult.data;
        userEcoPoints = profile.ecoPoints || 0;
        userCollection = profile.plants || [];
        userHatchings = profile.hatchings || [];
        userAnimals = profile.animals || [];

        await checkHatchings();

        updateEcoPointsDisplay(userEcoPoints);
        filterPlants(currentFilter);
        renderHatchings();
        startHatchingTimer();
    } catch (error) {
        console.error("Error loading user data:", error);
        showToast("Error loading your data. Please refresh the page.", "error");
    } finally {
        showLoadingState(false);
    }
}

function renderHatchings() {
    const hatchingGrid = document.getElementById("hatchingGrid");
    if (!hatchingGrid) return;

    if (userHatchings.length === 0) {
        hatchingGrid.innerHTML = `
            <div class="empty-hatching">
                <p>No eggs hatching. Buy an egg to start!</p>
            </div>
        `;
        return;
    }

    hatchingGrid.innerHTML = "";
    userHatchings.forEach((hatching, index) => {
        const hatchingCard = createHatchingCard(hatching, index);
        hatchingGrid.appendChild(hatchingCard);
    });
}

function createHatchingCard(hatching, index) {
    const card = document.createElement("div");
    card.className = `hatching-card ${hatching.rarity}`;
    card.dataset.index = index;

    const now = Date.now();
    const remaining = Math.max(0, hatching.endTime - now);
    const total = hatching.endTime - hatching.startTime;
    const progress = Math.min(100, ((total - remaining) / total) * 100);

    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    let timeDisplay = "";
    if (hours > 0) {
        timeDisplay = `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
        timeDisplay = `${minutes}m ${seconds}s`;
    } else {
        timeDisplay = `${seconds}s`;
    }

    card.innerHTML = `
        <div class="rarity-badge ${hatching.rarity}">${hatching.rarity}</div>
        <div class="hatching-image-container">
            <div class="egg-pulse-animation">
                <img src="../images/eggs/${hatching.rarity}-egg.png" alt="${hatching.eggName}" 
                     class="hatching-egg-image"
                     onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect width=%22100%22 height=%22100%22 fill=%22%23f5f5f5%22/%3E%3Ctext x=%2250%22 y=%2250%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-family=%22Arial%22 font-size=%2214%22%3E🥚%3C/text%3E%3C/svg%3E';" />
            </div>
        </div>
        <div class="hatching-info">
            <h3 class="hatching-name">${hatching.eggName}</h3>
            <div class="hatching-timer" id="timer-${index}">
                ${timeDisplay}
            </div>
            <div class="hatching-progress">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
            </div>
            <p class="hatching-status">Hatching...</p>
        </div>
    `;

    return card;
}

let hatchingInterval = null;

function startHatchingTimer() {
    if (hatchingInterval) {
        clearInterval(hatchingInterval);
    }

    hatchingInterval = setInterval(() => {
        const now = Date.now();
        let needsUpdate = false;

        userHatchings.forEach((hatching, index) => {
            const remaining = Math.max(0, hatching.endTime - now);
            const timerElement = document.getElementById(`timer-${index}`);
            
            if (timerElement && remaining > 0) {
                const hours = Math.floor(remaining / 3600000);
                const minutes = Math.floor((remaining % 3600000) / 60000);
                const seconds = Math.floor((remaining % 60000) / 1000);
                
                let timeDisplay = "";
                if (hours > 0) {
                    timeDisplay = `${hours}h ${minutes}m`;
                } else if (minutes > 0) {
                    timeDisplay = `${minutes}m ${seconds}s`;
                } else {
                    timeDisplay = `${seconds}s`;
                }
                
                timerElement.textContent = timeDisplay;
                
                const total = hatching.endTime - hatching.startTime;
                const progress = Math.min(100, ((total - remaining) / total) * 100);
                const progressFill = timerElement.closest('.hatching-card')?.querySelector('.progress-fill');
                if (progressFill) {
                    progressFill.style.width = `${progress}%`;
                }
            } else if (remaining <= 0) {
                needsUpdate = true;
            }
        });

        if (needsUpdate) {
            checkHatchings().then(() => {
                renderHatchings();
            });
        }
    }, 1000);
}

async function showHatchingAnimation(animal) {
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
                     onerror="this.onerror=null; this.innerHTML='<div class=\\'placeholder-animal\\'>${getAnimalEmoji(animal.name)}</div>';" />
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
            document.body.removeChild(modal);
        }, 500);
    }, 4000);
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

async function checkHatchings() {
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
        await updateUserProfile(currentUser.uid, {
            hatchings: updatedHatchings,
            animals: updatedAnimals
        });
        userHatchings = updatedHatchings;
        userAnimals = updatedAnimals;
        
        for (const animal of newAnimals) {
            await showHatchingAnimation(animal);
            showToast(`🎉 ${animal.name} hatched from your egg!`, "success");
        }
        
        renderHatchings();
    } else if (updatedHatchings.length !== userHatchings.length) {
        await updateUserProfile(currentUser.uid, {
            hatchings: updatedHatchings
        });
        userHatchings = updatedHatchings;
        renderHatchings();
    }
}

async function handleBuyEgg(eggData) {
    if (userEcoPoints < eggData.price) {
        showToast("Not enough EcoPoints!", "error");
        return;
    }

    try {
        const updatedEcoPoints = userEcoPoints - eggData.price;
        const now = Date.now();
        
        const newHatching = {
            eggId: eggData.id,
            rarity: eggData.rarity,
            startTime: now,
            endTime: now + eggData.hatchingTime,
            eggName: eggData.name
        };
        
        const updatedHatchings = [...userHatchings, newHatching];

        const updateResult = await updateUserProfile(currentUser.uid, {
            ecoPoints: updatedEcoPoints,
            hatchings: updatedHatchings
        });

        if (!updateResult.success) {
            throw new Error(updateResult.error || "Failed to update profile");
        }

        userEcoPoints = updatedEcoPoints;
        userHatchings = updatedHatchings;

        updateEcoPointsDisplay(userEcoPoints);
        filterPlants(currentFilter);
        renderHatchings();
        startHatchingTimer();

        showToast(`${eggData.name} added to hatching chamber! 🥚`, "success");

    } catch (error) {
        console.error("Error buying egg:", error);
        showToast("Error purchasing egg. Please try again.", "error");
    }
}

async function handleBuyPlant(plantData) {
    if (userEcoPoints < plantData.price) {
        showToast("Not enough EcoPoints!", "error");
        return;
    }

    try {
        const updatedEcoPoints = userEcoPoints - plantData.price;
        const purchaseTimestamp = new Date().toISOString();
        
        const newPlantEntry = {
            id: plantData.id,
            name: plantData.name,
            rarity: plantData.rarity,
            image: plantData.image,
            price: plantData.price,
            purchasedAt: purchaseTimestamp
        };
        
        const updatedCollection = [...userCollection, newPlantEntry];

        const updateResult = await updateUserProfile(currentUser.uid, {
            ecoPoints: updatedEcoPoints,
            plants: updatedCollection
        });

        if (!updateResult.success) {
            throw new Error(updateResult.error || "Failed to update profile");
        }

        userEcoPoints = updatedEcoPoints;
        userCollection = updatedCollection;

        updateEcoPointsDisplay(userEcoPoints);
        filterPlants(currentFilter);

        showToast(`Successfully purchased ${plantData.name}! 🌱`, "success");

    } catch (error) {
        console.error("Error buying plant:", error);
        showToast("Error purchasing plant. Please try again.", "error");
    }
}


function initializeShop() {
    document.querySelectorAll(".shop-mode-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            switchShopMode(btn.dataset.mode);
        });
    });

    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            filterPlants(btn.dataset.rarity);
        });
    });

    const logoutButton = document.getElementById("logoutButton");
    const logoutButtonMobile = document.getElementById("logoutButtonMobile");

    if (logoutButton) {
        logoutButton.addEventListener("click", async () => {
            const result = await logOut();
            if (result.success) {
                window.location.href = "login.html";
            }
        });
    }

    if (logoutButtonMobile) {
        logoutButtonMobile.addEventListener("click", async () => {
            const result = await logOut();
            if (result.success) {
                window.location.href = "login.html";
            }
        });
    }

    const mobileMenuToggle = document.getElementById("mobileMenuToggle");
    const mobileMenu = document.getElementById("mobileMenu");

    if (mobileMenuToggle && mobileMenu) {
        mobileMenuToggle.addEventListener("click", () => {
            const isActive = mobileMenu.classList.contains("active");
            mobileMenu.classList.toggle("active");
            mobileMenuToggle.classList.toggle("active");
            mobileMenuToggle.setAttribute("aria-expanded", !isActive);
            
            if (!isActive) {
                document.body.style.overflow = "hidden";
            } else {
                document.body.style.overflow = "";
            }
        });

        const menuLinks = mobileMenu.querySelectorAll("a");
        menuLinks.forEach(link => {
            link.addEventListener("click", () => {
                mobileMenu.classList.remove("active");
                mobileMenuToggle.classList.remove("active");
                mobileMenuToggle.setAttribute("aria-expanded", "false");
                document.body.style.overflow = "";
            });
        });
    }

    const loadingState = document.getElementById("loadingState");
    if (loadingState) {
        loadingState.style.display = "none";
    }
}

requireAuth().then(async (user) => {
    currentUser = user;
    await loadUserData();
    initializeShop();
}).catch((error) => {
    console.error("Auth error:", error);
    const loadingState = document.getElementById("loadingState");
    const errorState = document.getElementById("errorState");
    if (loadingState) loadingState.style.display = "none";
    if (errorState) errorState.style.display = "block";
});

