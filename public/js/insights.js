import { requireAuth } from "./auth-guard.js";
import { logOut, getUserProfile } from "./auth.js";

let currentUser = null;
let currentProfileData = null;

function getTodayDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function renderWeeklyInsights(profile) {
    const container = document.getElementById('insightHighlights');
    if (!container) return;
    const dailyCompletions = profile.dailyQuestCompletions || {};
    const todayKey = getTodayDateString();
    const todayCount = Array.isArray(dailyCompletions[todayKey]) ? dailyCompletions[todayKey].length : 0;
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - (6 * 24 * 60 * 60 * 1000));
    let weeklyTotal = 0;
    Object.entries(dailyCompletions).forEach(([dateKey, quests]) => {
        const date = new Date(dateKey);
        if (date >= sevenDaysAgo && Array.isArray(quests)) {
            weeklyTotal += quests.length;
        }
    });
    const teamMissions = profile.teamStats?.missionsCompleted || 0;
    container.innerHTML = `
        <div class="insight-chip">
            <span>Today's quests</span>
            <strong>${todayCount}/5</strong>
        </div>
        <div class="insight-chip">
            <span>Quests last 7 days</span>
            <strong>${weeklyTotal}</strong>
        </div>
        <div class="insight-chip">
            <span>Team missions cleared</span>
            <strong>${teamMissions}</strong>
        </div>
    `;
}

async function renderInsightCharts(profile) {
    const dailyCompletions = profile.dailyQuestCompletions || {};
    const now = new Date();
    const labels = [];
    const questData = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
        const quests = Array.isArray(dailyCompletions[dateKey]) ? dailyCompletions[dateKey].length : 0;
        questData.push(quests);
    }
    
    const questTrendCtx = document.getElementById('questTrendChart');
    if (questTrendCtx && window.Chart) {
        const hasData = questData.some(val => val > 0);
        
        if (!hasData) {
            questTrendCtx.parentElement.innerHTML = `
                <h3>Quest Completion Trend (7 Days)</h3>
                <div style="padding: 40px; text-align: center; color: #999;">
                    <p>Complete quests to see your progress trend</p>
                </div>
            `;
        } else {
            new Chart(questTrendCtx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Quests Completed',
                        data: questData,
                        borderColor: '#4caf50',
                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                        tension: 0.4,
                        fill: true,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        pointBackgroundColor: '#4caf50',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    aspectRatio: 2,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            padding: 12,
                            titleFont: { size: 14, weight: 'bold' },
                            bodyFont: { size: 13 },
                            callbacks: {
                                label: function(context) {
                                    return `${context.parsed.y} quest${context.parsed.y !== 1 ? 's' : ''} completed`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: { 
                            beginAtZero: true, 
                            ticks: { 
                                stepSize: 1,
                                precision: 0
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)'
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            }
                        }
                    }
                }
            });
        }
    }

    // Map old quest IDs (1-25) to new JSON quest IDs (recycling_1, etc.)
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
            } else if (typeof id === 'string' && id.includes('_')) {
                // Already in new format (recycling_1, etc.)
                mappedIds.add(id);
            }
        });
        return Array.from(mappedIds);
    }

    const completedQuests = profile.completedQuests || [];
    const categoryCounts = {};
    
    try {
        const response = await fetch('../quests.json');
        if (response.ok) {
            const questsData = await response.json();
            const mappedCompletedIds = mapCompletedQuestIds(completedQuests);
            
            // Iterate through categories and their quests
            if (questsData.categories && Array.isArray(questsData.categories)) {
                questsData.categories.forEach(category => {
                    if (category.quests && Array.isArray(category.quests)) {
                        category.quests.forEach(quest => {
                            if (mappedCompletedIds.includes(quest.id)) {
                                const categoryName = category.name || category.id || 'Other';
                                categoryCounts[categoryName] = (categoryCounts[categoryName] || 0) + 1;
                            }
                        });
                    }
                });
            }
        }
    } catch (error) {
        console.error("Error loading quests for category chart:", error);
    }
    
    const categoryCtx = document.getElementById('categoryDistributionChart');
    if (categoryCtx && window.Chart) {
        const categoryLabels = Object.keys(categoryCounts);
        const categoryValues = Object.values(categoryCounts);
        
        // Show empty state if no data
        if (categoryLabels.length === 0) {
            categoryCtx.parentElement.innerHTML = `
                <h3>Category Distribution</h3>
                <div style="padding: 40px; text-align: center; color: #999;">
                    <p>Complete some quests to see category distribution</p>
                </div>
            `;
        } else {
            new Chart(categoryCtx, {
                type: 'doughnut',
                data: {
                    labels: categoryLabels,
                    datasets: [{
                        data: categoryValues,
                        backgroundColor: [
                            '#4CAF50', '#2196F3', '#FFC107', '#9C27B0', 
                            '#00BCD4', '#8BC34A', '#66BB6A', '#FF9800',
                            '#E91E63', '#795548'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    aspectRatio: 1.5,
                    plugins: {
                        legend: { 
                            position: 'bottom',
                            labels: {
                                boxWidth: 12,
                                padding: 10,
                                font: {
                                    size: 12
                                }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.parsed || 0;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return `${label}: ${value} quests (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }
    }

    const xpGrowthCtx = document.getElementById('xpGrowthChart');
    if (xpGrowthCtx && window.Chart) {
        const currentXP = profile.xp || 0;
        const currentEco = profile.ecoPoints || 0;
        
        if (currentXP === 0 && currentEco === 0) {
            xpGrowthCtx.parentElement.innerHTML = `
                <h3>XP & EcoPoints Growth</h3>
                <div style="padding: 40px; text-align: center; color: #999;">
                    <p>Start completing quests to earn XP and EcoPoints</p>
                </div>
            `;
        } else {
            new Chart(xpGrowthCtx, {
                type: 'bar',
                data: {
                    labels: ['XP', 'EcoPoints'],
                    datasets: [{
                        label: 'Total',
                        data: [currentXP, currentEco],
                        backgroundColor: ['#4caf50', '#2196F3'],
                        borderRadius: 8,
                        borderSkipped: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    aspectRatio: 2,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            padding: 12,
                            titleFont: { size: 14, weight: 'bold' },
                            bodyFont: { size: 13 },
                            callbacks: {
                                label: function(context) {
                                    const value = context.parsed.y;
                                    const formatted = value.toLocaleString();
                                    return `${context.label}: ${formatted}`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: { 
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    if (value >= 1000) {
                                        return (value / 1000).toFixed(1) + 'k';
                                    }
                                    return value;
                                }
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)'
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            }
                        }
                    }
                }
            });
        }
    }
}

requireAuth().then(async (user) => {
    currentUser = user;
    try {
        const profileResult = await getUserProfile(user.uid);
        if (profileResult.success) {
            const profile = profileResult.data;
            currentProfileData = profile;
            renderWeeklyInsights(profile);
            await renderInsightCharts(profile);
        }
    } catch (error) {
        console.error("Error loading insights page:", error);
        alert("Unable to load insights information.");
    }
});

const logoutButton = document.getElementById("logoutButton");
const logoutButtonMobile = document.getElementById("logoutButtonMobile");
if (logoutButton) logoutButton.addEventListener("click", logOut);
if (logoutButtonMobile) logoutButtonMobile.addEventListener("click", logOut);

const mobileMenuToggle = document.getElementById("mobileMenuToggle");
const mobileMenu = document.getElementById("mobileMenu");
if (mobileMenuToggle && mobileMenu) {
    mobileMenuToggle.addEventListener("click", () => {
        mobileMenu.classList.toggle("active");
        mobileMenuToggle.classList.toggle("active");
    });
}

