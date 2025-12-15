
import { requireAuth } from "./auth-guard.js";
import { logOut, getUserProfile, updateUserProfile } from "./auth.js";

const TOAST_DISPLAY_DURATION = 3000;
const SELL_PRICE_MULTIPLIER = 0.8;
const MINIMUM_PLANTS_TO_SELL = 2;
const DEFAULT_FILTER = "all";

let currentUser = null;
let userEcoPoints = 0;
let userCollection = [];
let userAnimals = [];
let userHatchings = [];
let currentFilter = DEFAULT_FILTER;
let collectionMode = "plants";


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

function updateEcoPointsDisplay(ecoPointsAmount) {
    const ecoPointsElement = document.getElementById("ecopointsValue");
    if (ecoPointsElement) {
        ecoPointsElement.textContent = ecoPointsAmount.toLocaleString();
    }
}

function updateCollectionStats() {
    const totalPlants = userCollection.length;
    const totalAnimals = userAnimals.length;

    const totalPlantsEl = document.getElementById("totalPlants");
    const totalAnimalsEl = document.getElementById("totalAnimals");

    if (totalPlantsEl) totalPlantsEl.textContent = totalPlants;
    if (totalAnimalsEl) totalAnimalsEl.textContent = totalAnimals;
}

function groupPlantsByType(plants) {
    const grouped = {};
    plants.forEach(plant => {
        if (!grouped[plant.id]) {
            grouped[plant.id] = {
                ...plant,
                count: 0,
                instances: []
            };
        }
        grouped[plant.id].count++;
        grouped[plant.id].instances.push(plant);
    });
    return Object.values(grouped);
}

function groupAnimalsByType(animals) {
    const grouped = {};
    animals.forEach(animal => {
        if (!grouped[animal.id]) {
            grouped[animal.id] = {
                ...animal,
                count: 0,
                instances: []
            };
        }
        grouped[animal.id].count++;
        grouped[animal.id].instances.push(animal);
    });
    return Object.values(grouped);
}

function renderCollection(items) {
    const plantsGrid = document.getElementById("plantsGrid");
    const emptyCollection = document.getElementById("emptyCollection");
    
    if (!plantsGrid) return;

    if (items.length === 0) {
        plantsGrid.innerHTML = "";
        if (emptyCollection) {
            emptyCollection.style.display = "block";
            const emptyContent = emptyCollection.querySelector(".empty-state-content");
            if (emptyContent) {
                if (collectionMode === "plants") {
                    emptyContent.innerHTML = `
                        <h2>Your collection is empty</h2>
                        <p>Visit the shop to start collecting plants!</p>
                        <a href="shop.html" class="shop-link-btn">Go to Shop</a>
                    `;
                } else {
                    emptyContent.innerHTML = `
                        <h2>No animals yet</h2>
                        <p>Buy eggs from the shop and incubate them to hatch animals!</p>
                        <a href="shop.html" class="shop-link-btn">Go to Shop</a>
                    `;
                }
            }
        }
        return;
    }

    if (emptyCollection) {
        emptyCollection.style.display = "none";
    }

    // Grupeeri üksused tüübi järgi
    const groupedItems = collectionMode === "plants" 
        ? groupPlantsByType(items)
        : groupAnimalsByType(items);
    
    // Filtreeri harulduse järgi kui vaja
    let filteredItems = groupedItems;
    if (currentFilter !== "all") {
        filteredItems = groupedItems.filter(item => item.rarity === currentFilter);
    }

    plantsGrid.innerHTML = "";

    if (filteredItems.length === 0) {
        plantsGrid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: var(--spacing-xl);">
                <p>No items found in this category.</p>
            </div>
        `;
        return;
    }

    filteredItems.forEach(itemGroup => {
        const card = collectionMode === "plants" 
            ? createCollectionCard(itemGroup)
            : createAnimalCard(itemGroup);
        plantsGrid.appendChild(card);
    });
}

let userActivePet = null;

function createAnimalCard(animalGroup) {
    const card = document.createElement("div");
    card.className = `plant-card ${animalGroup.rarity} collection-card animal-card`;
    
    const isActivePet = userActivePet && userActivePet.id === animalGroup.id;

    const placeholderImageUrl = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect width=%22100%22 height=%22100%22 fill=%22%23f5f5f5%22/%3E%3Ctext x=%2250%22 y=%2250%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-family=%22Arial%22 font-size=%2214%22%3E🐾%3C/text%3E%3C/svg%3E';

    card.innerHTML = `
        <div class="rarity-badge ${animalGroup.rarity}">${animalGroup.rarity}</div>
        ${isActivePet ? '<div class="active-pet-badge">⭐ Active</div>' : ''}
        <div class="plant-image-container animal-image-container">
            <img src="${animalGroup.image}" alt="${animalGroup.name}" class="plant-image animal-image" 
                 onerror="this.onerror=null; this.src='${placeholderImageUrl}';" />
            ${animalGroup.count > 1 ? `<div class="count-badge">x${animalGroup.count}</div>` : ''}
        </div>
        <div class="plant-info">
            <h3 class="plant-name">${animalGroup.name}</h3>
            <div class="plant-count-info">
                <span>Owned: <strong>${animalGroup.count}</strong></span>
            </div>
            ${isActivePet ? `
                <div class="active-pet-info">
                    <span>⭐ Currently Active</span>
                </div>
            ` : `
                <button class="set-active-pet-btn" data-animal-id="${animalGroup.id}">
                    Set as Active Pet
                </button>
            `}
        </div>
    `;

    if (!isActivePet) {
        const setActiveBtn = card.querySelector(".set-active-pet-btn");
        if (setActiveBtn) {
            setActiveBtn.addEventListener("click", () => handleSetActivePet(animalGroup));
        }
    }

    return card;
}

async function handleSetActivePet(animalGroup) {
    if (!currentUser) return;

    try {
        const updateResult = await updateUserProfile(currentUser.uid, {
            activePet: {
                id: animalGroup.id,
                name: animalGroup.name,
                image: animalGroup.image,
                rarity: animalGroup.rarity
            }
        });

        if (!updateResult.success) {
            throw new Error(updateResult.error || "Failed to update active pet");
        }

        userActivePet = {
            id: animalGroup.id,
            name: animalGroup.name,
            image: animalGroup.image,
            rarity: animalGroup.rarity
        };

        showToast(`⭐ ${animalGroup.name} is now your active pet!`, "success");
        
        filterCollection(currentFilter);

    } catch (error) {
        console.error("Error setting active pet:", error);
        showToast("Error setting active pet. Please try again.", "error");
    }
}

function createCollectionCard(plantGroup) {
    const card = document.createElement("div");
    card.className = `plant-card ${plantGroup.rarity} collection-card`;

    const canSell = plantGroup.count >= MINIMUM_PLANTS_TO_SELL;
    const sellPrice = Math.floor(plantGroup.price * SELL_PRICE_MULTIPLIER);

    card.innerHTML = `
        <div class="rarity-badge ${plantGroup.rarity}">${plantGroup.rarity}</div>
        <div class="plant-image-container">
            <img src="${plantGroup.image}" alt="${plantGroup.name}" class="plant-image" 
                 onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect width=%22100%22 height=%22100%22 fill=%22%23f5f5f5%22/%3E%3Ctext x=%2250%22 y=%2250%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-family=%22Arial%22 font-size=%2214%22%3E🌱%3C/text%3E%3C/svg%3E';" />
            ${plantGroup.count > 1 ? `<div class="count-badge">x${plantGroup.count}</div>` : ''}
        </div>
        <div class="plant-info">
            <h3 class="plant-name">${plantGroup.name}</h3>
            <div class="plant-count-info">
                <span>Owned: <strong>${plantGroup.count}</strong></span>
            </div>
            ${canSell ? `
                <div class="sell-info">
                    <span class="sell-price">Sell for: 🌿${sellPrice}</span>
                </div>
                <button class="sell-button" data-plant-id="${plantGroup.id}">
                    Sell One
                </button>
            ` : `
                <div class="no-sell-info">
                    <span>Keep this one!</span>
                </div>
            `}
        </div>
    `;

    if (canSell) {
        const sellButton = card.querySelector(".sell-button");
        if (sellButton) {
            sellButton.addEventListener("click", () => handleSellPlant(plantGroup, sellPrice));
        }
    }

    return card;
}

function filterCollection(selectedRarity) {
    currentFilter = selectedRarity;
    
    const filterButtons = document.querySelectorAll(".filter-btn");
    filterButtons.forEach(button => {
        button.classList.remove("active");
        if (button.dataset.rarity === selectedRarity) {
            button.classList.add("active");
        }
    });

    const itemsToFilter = collectionMode === "plants" ? userCollection : userAnimals;
    const filteredList = selectedRarity === DEFAULT_FILTER 
        ? itemsToFilter 
        : itemsToFilter.filter(item => item.rarity === selectedRarity);

    renderCollection(filteredList);
}

function switchCollectionMode(mode) {
    collectionMode = mode;
    const modeButtons = document.querySelectorAll(".collection-mode-btn");
    modeButtons.forEach(btn => {
        btn.classList.remove("active");
        if (btn.dataset.mode === mode) {
            btn.classList.add("active");
        }
    });
    
    filterCollection(currentFilter);
}

async function loadUserData() {
    const loadingMessage = document.querySelector(".loading-message");
    if (loadingMessage) {
        loadingMessage.textContent = "Loading your collection...";
        loadingMessage.style.display = "block";
    }
    
    try {
        const profileResult = await getUserProfile(currentUser.uid);
        if (!profileResult.success) {
            throw new Error(profileResult.error || "Failed to load user profile");
        }

        const profile = profileResult.data;
        userEcoPoints = profile.ecoPoints || 0;
        userCollection = profile.plants || [];
        userAnimals = profile.animals || [];
        userHatchings = profile.hatchings || [];
        userActivePet = profile.activePet || null;

        await checkHatchings();

        updateEcoPointsDisplay(userEcoPoints);
        updateCollectionStats();
        filterCollection(currentFilter);
    } catch (error) {
        console.error("Error loading user data:", error);
        showToast("Error loading your collection. Please refresh the page.", "error");
    } finally {
        if (loadingMessage) {
            loadingMessage.style.display = "none";
        }
    }
}

async function handleSellPlant(plantGroupData, sellPriceAmount) {
    if (plantGroupData.count < MINIMUM_PLANTS_TO_SELL) {
        showToast("You can only sell duplicate plants!", "error");
        return;
    }

    try {
        const plantIndexToRemove = userCollection.findIndex(plant => plant.id === plantGroupData.id);
        if (plantIndexToRemove === -1) {
            throw new Error("Plant not found in collection");
        }

        const updatedCollection = [...userCollection];
        updatedCollection.splice(plantIndexToRemove, 1);

        const updatedEcoPoints = userEcoPoints + sellPriceAmount;

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
        updateCollectionStats();
        filterCollection(currentFilter);

        showToast(`Sold ${plantGroupData.name} for ${sellPriceAmount} EcoPoints! 🌿`, "success");

    } catch (error) {
        console.error("Error selling plant:", error);
        showToast("Error selling plant. Please try again.", "error");
    }
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
        
        updateCollectionStats();
    } else if (updatedHatchings.length !== userHatchings.length) {
        await updateUserProfile(currentUser.uid, {
            hatchings: updatedHatchings
        });
        userHatchings = updatedHatchings;
    }
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
            if (document.body.contains(modal)) {
                document.body.removeChild(modal);
            }
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

function getRandomAnimal(rarity) {
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



function initializeCollection() {
    document.querySelectorAll(".collection-mode-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            switchCollectionMode(btn.dataset.mode);
        });
    });

    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            filterCollection(btn.dataset.rarity);
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
    initializeCollection();
}).catch((error) => {
    console.error("Auth error:", error);
    const loadingState = document.getElementById("loadingState");
    const errorState = document.getElementById("errorState");
    if (loadingState) loadingState.style.display = "none";
    if (errorState) errorState.style.display = "block";
});

