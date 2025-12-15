import { requireAuth } from "./auth-guard.js";
import { logOut, getUserProfile, getAllUsers, updateUserProfile } from "./auth.js";

const DEFAULT_FILTER = "all";
const DEFAULT_LEVEL = 1;
const DEFAULT_XP = 0;

let currentUser = null;
let profileUserId = null;
let userCollection = [];
let currentFilter = DEFAULT_FILTER;
let allUsers = [];


function getBadgeImageForLevel(level) {
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

function calculateLevel(xp) {
    const LEVEL_MILESTONES = [0, 100, 250, 500, 1000, 2500, 5000, 10000, 50000];
    for (let i = LEVEL_MILESTONES.length - 1; i >= 0; i--) {
        if (xp >= LEVEL_MILESTONES[i]) {
            return i + 1;
        }
    }
    return DEFAULT_LEVEL;
}

function getAnimalEmojiForProfile(name) {
    const emojiMap = {
        "Cat": "🐱", "Dog": "🐶", "Rabbit": "🐰", "Bee": "🐝",
        "Deer": "🦌", "Owl": "🦉", "Panda": "🐼", "Cobra": "🐍",
        "Wolf": "🐺", "Bear": "🐻", "Eagle": "🦅", "Lynx": "🐱",
        "Tiger": "🐯", "Lion": "🦁", "Phoenix": "🔥", "Dragon": "🐉"
    };
    return emojiMap[name] || "🐾";
}


async function calculateRanking(userId) {
    try {
        const result = await getAllUsers();
        if (!result.success) {
            return { current: null, best: null };
        }

        const users = result.data || [];
        users.sort((a, b) => (b.xp || 0) - (a.xp || 0));

        const userIndex = users.findIndex(u => u.id === userId);
        const currentRank = userIndex >= 0 ? userIndex + 1 : null;
        
        const profileResult = await getUserProfile(userId);
        const bestRank = profileResult.success ? (profileResult.data.bestRank || null) : null;

        return { 
            current: currentRank, 
            best: bestRank 
        };
    } catch (error) {
        console.error("Error calculating ranking:", error);
        return { current: null, best: null };
    }
}

async function updateBestRank(userId, currentRank) {
    try {
        if (!currentRank || currentRank <= 0) {
            return;
        }

        const profileResult = await getUserProfile(userId);
        if (!profileResult.success) return;

        const profile = profileResult.data;
        const bestRank = profile.bestRank;

        if (bestRank === null || bestRank === undefined) {
            await updateUserProfile(userId, { bestRank: currentRank });
        } else if (currentRank < bestRank) {
            await updateUserProfile(userId, { bestRank: currentRank });
        }
    } catch (error) {
        console.error("Error updating best rank:", error);
    }
}


function showError(message) {
    const errorState = document.getElementById("errorState");
    const loadingState = document.getElementById("loadingState");
    const profileContent = document.getElementById("profileContent");

    if (loadingState) loadingState.style.display = "none";
    if (profileContent) profileContent.style.display = "none";
    if (errorState) {
        const errorText = errorState.querySelector("p");
        if (errorText) {
            errorText.textContent = message;
        } else {
            errorState.textContent = message;
        }
        errorState.style.display = "block";
    }
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

function renderCollection(plants) {
    const plantsGrid = document.getElementById("plantsGrid");
    const emptyCollection = document.getElementById("emptyCollection");
    
    if (!plantsGrid) return;

    if (plants.length === 0) {
        plantsGrid.innerHTML = "";
        if (emptyCollection) {
            emptyCollection.style.display = "block";
        }
        return;
    }

    if (emptyCollection) {
        emptyCollection.style.display = "none";
    }

    const groupedPlants = groupPlantsByType(plants);
    
    let filteredPlants = groupedPlants;
    if (currentFilter !== DEFAULT_FILTER) {
        filteredPlants = groupedPlants.filter(plant => plant.rarity === currentFilter);
    }

    plantsGrid.innerHTML = "";

    if (filteredPlants.length === 0) {
        plantsGrid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: var(--spacing-xl);">
                <p>No plants found in this category.</p>
            </div>
        `;
        return;
    }

    filteredPlants.forEach(plantGroup => {
        const plantCard = createCollectionCard(plantGroup);
        plantsGrid.appendChild(plantCard);
    });
}

function createCollectionCard(plantGroup) {
    const card = document.createElement("div");
    card.className = `plant-card ${plantGroup.rarity} collection-card`;

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
        </div>
    `;

    return card;
}

function filterCollection(rarity) {
    currentFilter = rarity;
    
    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.classList.remove("active");
        if (btn.dataset.rarity === rarity) {
            btn.classList.add("active");
        }
    });

    let filteredPlants = userCollection;
    if (rarity !== DEFAULT_FILTER) {
        filteredPlants = userCollection.filter(plant => plant.rarity === rarity);
    }

    renderCollection(filteredPlants);
}


async function loadQuestsData() {
    try {
        const response = await fetch('../quests.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Error loading quests.json:", error);
        return null;
    }
}

function mapCompletedQuestIds(completedQuestIds) {
    const QUEST_ID_MAPPING = {
        "1": { jsonIds: ["recycling_1", "cleanup_1"] },
        "2": { jsonIds: ["energy_1"] },
        "3": { jsonIds: ["recycling_2"] },
        "4": { jsonIds: ["transportation_1"] },
        "5": { jsonIds: ["water_1"] },
        "6": { jsonIds: ["recycling_3", "cleanup_2"] },
        "7": { jsonIds: ["recycling_4"] },
        "8": { jsonIds: ["water_2"] },
        "9": { jsonIds: ["recycling_5"] },
        "10": { jsonIds: ["energy_2"] },
        "11": { jsonIds: ["energy_3"] },
        "12": { jsonIds: ["gardening_1"] },
        "13": { jsonIds: ["transportation_2"] },
        "14": { jsonIds: ["sustainable_1"] },
        "15": { jsonIds: ["sustainable_2"] },
        "16": { jsonIds: ["energy_4"] },
        "17": { jsonIds: ["sustainable_3"] },
        "18": { jsonIds: ["energy_5"] },
        "19": { jsonIds: ["recycling_6"] },
        "20": { jsonIds: ["cleanup_3"] },
        "21": { jsonIds: ["energy_6"] },
        "22": { jsonIds: ["transportation_3"] },
        "23": { jsonIds: ["sustainable_4"] },
        "24": { jsonIds: ["energy_7"] },
        "25": { jsonIds: ["gardening_2"] }
    };
    
    const mappedIds = new Set();
    completedQuestIds.forEach(id => {
        const mapped = QUEST_ID_MAPPING[id];
        if (mapped && mapped.jsonIds) {
            mapped.jsonIds.forEach(mappedId => mappedIds.add(mappedId));
        }
    });
    return Array.from(mappedIds);
}

async function calculateTotalCarbonReduction(completedQuestIds) {
    try {
        const questsData = await loadQuestsData();
        if (!questsData || !questsData.categories) {
            return 0;
        }

        const mappedCompletedIds = mapCompletedQuestIds(completedQuestIds || []);
        let totalCarbon = 0;

        questsData.categories.forEach(category => {
            if (!category || !category.quests) return;
            
            category.quests.forEach(quest => {
                if (quest && mappedCompletedIds.includes(quest.id)) {
                    totalCarbon += quest.carbonFootprintReduction || 0;
                }
            });
        });

        return totalCarbon;
    } catch (error) {
        console.error("Error calculating total carbon reduction:", error);
        return 0;
    }
}

function calculateQuestProgress(questsData, completedQuestIds) {
    if (!questsData || !questsData.categories) {
        return null;
    }

    const mappedCompletedIds = mapCompletedQuestIds(completedQuestIds || []);

    const categoryStats = questsData.categories.map(category => {
        const totalQuests = category.quests.length;
        const completedQuests = category.quests.filter(quest => 
            mappedCompletedIds.includes(quest.id)
        ).length;
        
        const totalCarbonReduction = category.quests.reduce((sum, quest) => {
            if (mappedCompletedIds.includes(quest.id)) {
                return sum + quest.carbonFootprintReduction;
            }
            return sum;
        }, 0);

        const maxCarbonReduction = category.quests.reduce((sum, quest) => 
            sum + quest.carbonFootprintReduction, 0
        );

        return {
            id: category.id,
            name: category.name,  
            icon: category.icon,
            color: category.color,
            badgeName: category.badgeName,
            totalQuests,
            completedQuests,
            completionPercentage: totalQuests > 0 ? (completedQuests / totalQuests) * 100 : 0,
            totalCarbonReduction,
            maxCarbonReduction,
            carbonPercentage: maxCarbonReduction > 0 ? (totalCarbonReduction / maxCarbonReduction) * 100 : 0
        };
    });

    return categoryStats;
}

async function renderQuestCategoryProgress(completedQuestIds) {
    try {
        const progressList = document.getElementById("questCategoryProgressList");
        if (!progressList) return;

        const questsData = await loadQuestsData();
        if (!questsData) {
            progressList.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">Unable to load quest data.</p>';
            return;
        }

        const categoryStats = calculateQuestProgress(questsData, completedQuestIds || []);
        if (!categoryStats || categoryStats.length === 0) {
            progressList.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No quest categories found.</p>';
            return;
        }

        progressList.innerHTML = "";

        categoryStats.forEach(category => {
            const categoryCard = document.createElement("div");
            categoryCard.className = "category-progress-card";
            categoryCard.style.borderLeft = `4px solid ${category.color}`;

            const isCompleted = category.completedQuests === category.totalQuests && category.totalQuests > 0;

            categoryCard.innerHTML = `
                <div class="category-progress-header">
                    <div class="category-info">
                        <span class="category-icon">${category.icon}</span>
                        <div>
                            <h4>${category.name}</h4>
                            <p class="category-stats">${category.completedQuests} / ${category.totalQuests} quests completed</p>
                        </div>
                    </div>
                    ${isCompleted ? `<span class="category-badge">🏆 ${category.badgeName}</span>` : ''}
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="background: ${category.color}20;">
                        <div class="progress-fill" style="width: ${category.completionPercentage}%; background: ${category.color};"></div>
                    </div>
                    <span class="progress-text">${category.completionPercentage.toFixed(0)}%</span>
                </div>
                <div class="carbon-info">
                    <span>Carbon Reduced: <strong>${category.totalCarbonReduction.toFixed(1)} / ${category.maxCarbonReduction.toFixed(1)} kg CO₂</strong></span>
                </div>
            `;

            progressList.appendChild(categoryCard);
        });
    } catch (error) {
        console.error("Error rendering quest category progress:", error);
        const progressList = document.getElementById("questCategoryProgressList");
        if (progressList) {
            progressList.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">Error loading quest progress.</p>';
        }
    }
}


async function loadProfileData() {
    try {
        if (!profileUserId) {
            throw new Error("User ID is required");
        }

        const profileResult = await getUserProfile(profileUserId);
        if (!profileResult.success) {
            throw new Error(profileResult.error || "Failed to load profile");
        }

        const profile = profileResult.data;
        const xp = profile.xp || DEFAULT_XP;
        const level = calculateLevel(xp);
        const displayName = profile.displayName || profile.email?.split("@")[0] || "Anonymous";
        const email = profile.email || "Unknown";
        const missionsCompleted = profile.missionsCompleted || 0;
        const allQuestsCompletedCount = profile.allQuestsCompletedCount || 0;
        const allQuestsCompleted = profile.allQuestsCompleted || false;
        userCollection = profile.plants || [];
        const activePet = profile.activePet || null;

        const profileName = document.getElementById("profileName");
        const profileEmail = document.getElementById("profileEmail");
        const profileBadge = document.getElementById("profileBadge");
        const profileLevel = document.getElementById("profileLevel");
        const missionsCompletedEl = document.getElementById("missionsCompleted");
        const totalPlantsEl = document.getElementById("totalPlants");
        const totalCarbonReducedEl = document.getElementById("totalCarbonReduced");
        const replayModeCard = document.getElementById("replayModeCard");
        const replayModeCount = document.getElementById("replayModeCount");
        const teamInfoCard = document.getElementById("teamInfoCard");
        const teamNameDisplay = document.getElementById("teamNameDisplay");
        const teamRoleDisplay = document.getElementById("teamRoleDisplay");

        if (profileName) profileName.textContent = displayName;
        if (profileEmail) profileEmail.textContent = email;
        if (profileBadge) {
            profileBadge.src = getBadgeImageForLevel(level);
            profileBadge.alt = `Level ${level} Badge`;
        }
        
        // Kuvab aktiivse lemmiku statistikute kaardil
        const activePetCard = document.getElementById("activePetCard");
        const activePetDisplay = document.getElementById("activePetDisplay");
        const activePetImage = document.getElementById("activePetImage");
        const activePetName = document.getElementById("activePetName");
        if (activePetCard && activePetDisplay && activePetImage && activePetName) {
            if (activePet && activePet.image) {
                activePetImage.src = activePet.image;
                activePetImage.alt = activePet.name || "Active Pet";
                activePetName.textContent = activePet.name || "-";
                activePetImage.onerror = function() {
                    // Kasutab emoji kohatäit kui pilt ebaõnnestub
                    this.style.display = "none";
                    activePetDisplay.innerHTML = `
                        <div class="placeholder-active-pet-stat">${getAnimalEmojiForProfile(activePet.name)}</div>
                    `;
                };
                activePetCard.style.display = "flex";
            } else {
                activePetCard.style.display = "none";
            }
        }
        if (profileLevel) profileLevel.textContent = level;
        if (missionsCompletedEl) missionsCompletedEl.textContent = missionsCompleted;
        if (totalPlantsEl) totalPlantsEl.textContent = userCollection.length;
        
        const completedQuests = profile.completedQuests || [];
        const totalCarbon = await calculateTotalCarbonReduction(completedQuests);
        if (totalCarbonReducedEl) {
            totalCarbonReducedEl.textContent = totalCarbon.toFixed(1);
        }
        
        // Render quest category progress
        await renderQuestCategoryProgress(completedQuests);
        
        if (replayModeCard && replayModeCount) {
            if (allQuestsCompleted && allQuestsCompletedCount > 0) {
                replayModeCard.style.display = "flex";
                replayModeCount.textContent = allQuestsCompletedCount;
            } else {
                replayModeCard.style.display = "none";
            }
        }

        if (profile.teamId && profile.teamId !== null) {
            try {
                const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                const { db } = await import("./firebase-config.js");
                const teamDoc = await getDoc(doc(db, "teams", profile.teamId));
                if (teamDoc.exists()) {
                    const teamData = teamDoc.data();
                    if (teamInfoCard) teamInfoCard.style.display = "flex";
                    if (teamNameDisplay) teamNameDisplay.textContent = teamData.name || "Team";
                    if (teamRoleDisplay) {
                        const role = profile.teamRole || "member";
                        teamRoleDisplay.textContent = role.charAt(0).toUpperCase() + role.slice(1);
                    }
                } else {
                    if (teamInfoCard) teamInfoCard.style.display = "none";
                }
            } catch (error) {
                console.error("Error loading team info:", error);
                if (teamInfoCard) teamInfoCard.style.display = "none";
            }
        } else {
            if (teamInfoCard) teamInfoCard.style.display = "none";
        }

        const ranking = await calculateRanking(profileUserId);
        const currentRankEl = document.getElementById("currentRank");
        const bestRankEl = document.getElementById("bestRank");

        if (currentRankEl) {
            currentRankEl.textContent = ranking.current ? `#${ranking.current}` : "-";
        }
        
        let bestRankFromProfile = profile.bestRank;
        
        if (profileUserId === currentUser.uid && ranking.current) {
            await updateBestRank(profileUserId, ranking.current);
            const updatedProfileResult = await getUserProfile(profileUserId);
            if (updatedProfileResult.success) {
                bestRankFromProfile = updatedProfileResult.data.bestRank;
            }
        }
        
        if (bestRankEl) {
            if (bestRankFromProfile !== null && bestRankFromProfile !== undefined && bestRankFromProfile > 0) {
                bestRankEl.textContent = `#${bestRankFromProfile}`;
            } else if (ranking.current && profileUserId === currentUser.uid) {
                bestRankEl.textContent = `#${ranking.current}`;
            } else {
                bestRankEl.textContent = "-";
            }
        }

        filterCollection(currentFilter);

        const loadingState = document.getElementById("loadingState");
        const profileContent = document.getElementById("profileContent");
        if (loadingState) loadingState.style.display = "none";
        if (profileContent) profileContent.style.display = "block";

    } catch (error) {
        console.error("Error loading profile data:", error);
        const errorMessage = error.message || "Error loading profile. Please try again later.";
        showError(errorMessage);
    }
}


function initializeProfile() {
    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            filterCollection(btn.dataset.rarity);
        });
    });

    if (profileUserId === currentUser.uid) {
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
    } else {
        const logoutButton = document.getElementById("logoutButton");
        const logoutButtonMobile = document.getElementById("logoutButtonMobile");
        const mobileMenu = document.getElementById("mobileMenu");

        if (logoutButton) logoutButton.style.display = "none";
        if (logoutButtonMobile) logoutButtonMobile.style.display = "none";
        
        if (mobileMenu) {
            const logoutLi = mobileMenu.querySelector("li:has(.logout-button-mobile)");
            if (logoutLi) logoutLi.remove();
        }

        const header = document.querySelector("header");
        if (header) {
            const nav = header.querySelector("nav");
            if (nav) {
                let backButton = nav.querySelector(".back-button");
                if (!backButton) {
                    backButton = document.createElement("button");
                    backButton.className = "back-button";
                    backButton.textContent = "← Back to Leaderboard";
                    backButton.style.cssText = "background: var(--color-primary); color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: 500; margin-left: auto; transition: all 0.3s ease;";
                    backButton.addEventListener("click", () => {
                        window.location.href = "leaderboard.html";
                    });
                    backButton.addEventListener("mouseenter", () => {
                        backButton.style.background = "var(--color-accent)";
                    });
                    backButton.addEventListener("mouseleave", () => {
                        backButton.style.background = "var(--color-primary)";
                    });
                    
                    const logo = nav.querySelector("img");
                    const mobileToggle = nav.querySelector("#mobileMenuToggle");
                    if (logo && mobileToggle) {
                        nav.insertBefore(backButton, mobileToggle);
                    } else if (logo) {
                        nav.insertBefore(backButton, logo.nextSibling);
                    } else {
                        nav.appendChild(backButton);
                    }
                }
            }
        }
    }
}


requireAuth().then(async (user) => {
    currentUser = user;
    
    const urlParams = new URLSearchParams(window.location.search);
    profileUserId = urlParams.get("userId") || user.uid;

    await loadProfileData();
    initializeProfile();
}).catch((error) => {
    console.error("Auth error:", error);
    showError("Authentication error. Please log in.");
});

