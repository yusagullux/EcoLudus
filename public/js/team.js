import { requireAuth } from "./auth-guard.js";
import { logOut, getUserProfile, updateUserProfile } from "./auth.js";
import { 
    doc, 
    setDoc,
    getDoc,
    updateDoc,
    collection,
    addDoc,
    getDocs,
    query,
    where,
    limit,
    deleteDoc,
    deleteField,
    increment
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase-config.js";

let currentUser = null;
let currentTeamData = null;
let activeTeamMissions = [];
let teamModalMode = null;
let teamSubmissionContext = null;
let currentProfileData = null;

const TEAM_LIMITS = {
    maxMembers: 8,
    maxActiveMissions: 5, // Increased from 3 to allow more simultaneous missions
    dailyMissionCap: 8, // Increased from 5 to allow more daily missions
    memberSubmissionCooldownMinutes: 30, // Reduced from 60 for better engagement
    minUniqueSubmitters: 2,
    requiredApprovals: 1,
    maxMissionsPerDifficulty: {
        Easy: 3,
        Medium: 2,
        Hard: 1
    }
};

const TEAM_REWARD_RULES = {
    ecoRatio: 0.6,
    streakBonusPercent: 10,
    minReflectionLength: 20,
    // Difficulty-based reward multipliers
    difficultyMultipliers: {
        Easy: 1.0,
        Medium: 1.2,
        Hard: 1.5
    },
    // Participation bonus - more members = slightly better rewards
    participationBonus: {
        min: 1.0,
        max: 1.15, // Up to 15% bonus for full team participation
        threshold: 6 // Full bonus at 6+ members
    }
};

const TEAM_MISSION_LIBRARY = [
    // Easy Missions - Quick wins for team building
    {
        id: "team_recycle_15",
        title: "Recycle 15 Plastic Bottles",
        description: "Split the work and collect/recycle at least 15 plastic bottles as a team.",
        icon: "♻️",
        difficulty: "Easy",
        xpReward: 240,
        ecoReward: 140,
        requiredSubmissions: 3,
        category: "Recycling",
        cooldownHours: 12,
        carbonReduction: 3.5
    },
    {
        id: "team_cleanup_block",
        title: "Clean One Shared Area",
        description: "Pick a park block, beach spot or stairwell and leave it visibly better.",
        icon: "🧹",
        difficulty: "Easy",
        xpReward: 260,
        ecoReward: 160,
        requiredSubmissions: 3,
        category: "Clean-Up",
        cooldownHours: 12,
        carbonReduction: 4.0
    },
    {
        id: "team_power_down",
        title: "Night Power Down",
        description: "Before sleep, unplug unused chargers/devices across at least 3 households.",
        icon: "🔌",
        difficulty: "Easy",
        xpReward: 220,
        ecoReward: 130,
        requiredSubmissions: 2,
        category: "Energy",
        cooldownHours: 10,
        carbonReduction: 2.5
    },
    {
        id: "team_micro_garden",
        title: "Plant or Care for 3 Greens",
        description: "Plant seeds, repot, or tend to three different plants as a joint effort.",
        icon: "🌱",
        difficulty: "Easy",
        xpReward: 210,
        ecoReward: 120,
        requiredSubmissions: 3,
        category: "Gardening",
        cooldownHours: 12,
        carbonReduction: 2.0
    },
    {
        id: "team_reusable_day",
        title: "Zero Single-Use Day",
        description: "All participating members avoid single-use plastics for one full day.",
        icon: "🥤",
        difficulty: "Easy",
        xpReward: 250,
        ecoReward: 150,
        requiredSubmissions: 3,
        category: "Recycling",
        cooldownHours: 12,
        carbonReduction: 3.0
    },
    {
        id: "team_led_swap",
        title: "Switch to LED Bulbs",
        description: "Replace at least 5 incandescent bulbs with LED bulbs across team households.",
        icon: "💡",
        difficulty: "Easy",
        xpReward: 280,
        ecoReward: 170,
        requiredSubmissions: 3,
        category: "Energy",
        cooldownHours: 24,
        carbonReduction: 5.0
    },
    
    // Medium Missions - Moderate effort, better rewards
    {
        id: "team_commute_swap",
        title: "Commute Sustainably Together",
        description: "On the same day, at least 3 teammates should bike, walk or take transit instead of a car trip.",
        icon: "🚶",
        difficulty: "Medium",
        xpReward: 300,
        ecoReward: 180,
        requiredSubmissions: 3,
        category: "Transportation",
        cooldownHours: 18,
        carbonReduction: 6.0
    },
    {
        id: "team_water_saver",
        title: "Save 50 Liters of Water",
        description: "Each teammate shortens showers or reuses water to collectively save about 50 liters.",
        icon: "💧",
        difficulty: "Medium",
        xpReward: 320,
        ecoReward: 190,
        requiredSubmissions: 3,
        category: "Water Saving",
        cooldownHours: 18,
        carbonReduction: 2.5
    },
    {
        id: "team_meatless_day",
        title: "Team Meatless Monday",
        description: "All participating members choose vegetarian meals for one day.",
        icon: "🥗",
        difficulty: "Medium",
        xpReward: 350,
        ecoReward: 210,
        requiredSubmissions: 4,
        category: "Sustainable Living",
        cooldownHours: 24,
        carbonReduction: 8.0
    },
    {
        id: "team_local_produce",
        title: "Buy Local Produce",
        description: "Team members purchase locally grown food items to reduce transportation emissions.",
        icon: "🛒",
        difficulty: "Medium",
        xpReward: 330,
        ecoReward: 200,
        requiredSubmissions: 3,
        category: "Sustainable Living",
        cooldownHours: 18,
        carbonReduction: 4.5
    },
    {
        id: "team_compost_setup",
        title: "Start Composting",
        description: "Set up composting systems in at least 3 team households.",
        icon: "🌿",
        difficulty: "Medium",
        xpReward: 340,
        ecoReward: 205,
        requiredSubmissions: 3,
        category: "Sustainable Living",
        cooldownHours: 24,
        carbonReduction: 6.0
    },
    {
        id: "team_donation_drive",
        title: "Donation Drive",
        description: "Collect and donate clothes, electronics, or books instead of throwing them away.",
        icon: "📦",
        difficulty: "Medium",
        xpReward: 360,
        ecoReward: 220,
        requiredSubmissions: 4,
        category: "Recycling",
        cooldownHours: 24,
        carbonReduction: 10.0
    },
    {
        id: "team_beach_cleanup",
        title: "Beach or Park Cleanup",
        description: "Organize a team cleanup event at a local beach, park, or natural area.",
        icon: "🏖️",
        difficulty: "Medium",
        xpReward: 380,
        ecoReward: 230,
        requiredSubmissions: 4,
        category: "Clean-Up",
        cooldownHours: 24,
        carbonReduction: 12.0
    },
    {
        id: "team_carpool_week",
        title: "Carpool Challenge",
        description: "Share rides for at least 5 trips during the week instead of driving alone.",
        icon: "🚗",
        difficulty: "Medium",
        xpReward: 370,
        ecoReward: 225,
        requiredSubmissions: 3,
        category: "Transportation",
        cooldownHours: 24,
        carbonReduction: 15.0
    },
    
    // Hard Missions - Significant effort, high rewards
    {
        id: "team_energy_audit",
        title: "Home Energy Audit",
        description: "Conduct energy audits in team households and implement at least 3 improvements.",
        icon: "📊",
        difficulty: "Hard",
        xpReward: 500,
        ecoReward: 300,
        requiredSubmissions: 4,
        category: "Energy",
        cooldownHours: 48,
        carbonReduction: 20.0
    },
    {
        id: "team_garden_project",
        title: "Community Garden Project",
        description: "Start or contribute to a community garden, planting at least 10 different plants.",
        icon: "🌳",
        difficulty: "Hard",
        xpReward: 550,
        ecoReward: 330,
        requiredSubmissions: 5,
        category: "Gardening",
        cooldownHours: 72,
        carbonReduction: 25.0
    },
    {
        id: "team_zero_waste_week",
        title: "Zero Waste Week",
        description: "Team members attempt zero-waste living for one full week.",
        icon: "♻️",
        difficulty: "Hard",
        xpReward: 600,
        ecoReward: 360,
        requiredSubmissions: 5,
        category: "Sustainable Living",
        cooldownHours: 168,
        carbonReduction: 30.0
    },
    {
        id: "team_solar_advocacy",
        title: "Renewable Energy Advocacy",
        description: "Research and share information about renewable energy options in your area.",
        icon: "☀️",
        difficulty: "Hard",
        xpReward: 520,
        ecoReward: 310,
        requiredSubmissions: 4,
        category: "Energy",
        cooldownHours: 48,
        carbonReduction: 18.0
    },
    {
        id: "team_tree_planting",
        title: "Tree Planting Event",
        description: "Organize or participate in a tree planting event, planting at least 5 trees.",
        icon: "🌲",
        difficulty: "Hard",
        xpReward: 580,
        ecoReward: 350,
        requiredSubmissions: 5,
        category: "Gardening",
        cooldownHours: 72,
        carbonReduction: 50.0
    },
    {
        id: "team_water_conservation",
        title: "Water Conservation Project",
        description: "Install water-saving devices or implement conservation practices in multiple households.",
        icon: "💧",
        difficulty: "Hard",
        xpReward: 540,
        ecoReward: 320,
        requiredSubmissions: 4,
        category: "Water Saving",
        cooldownHours: 48,
        carbonReduction: 15.0
    }
];

function escapeHtml(value = "") {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
}

function getTodayDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function calculateLevel(xp) {
    const LEVEL_MILESTONES = [0, 100, 250, 500, 1000, 2500, 5000, 10000, 50000];
    for (let i = LEVEL_MILESTONES.length - 1; i >= 0; i--) {
        if (xp >= LEVEL_MILESTONES[i]) {
            return i + 1;
        }
    }
    return 1;
}

function normalizeTeamCode(code = "") {
    return (code || "").toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

async function teamJoinCodeExists(code) {
    try {
        const teamsRef = collection(db, "teams");
        const q = query(teamsRef, where("joinCode", "==", code), limit(1));
        const snapshot = await getDocs(q);
        return !snapshot.empty;
    } catch (error) {
        console.error("Error checking team code:", error);
        return false;
    }
}

async function generateUniqueTeamCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let attempts = 0;
    while (attempts < 8) {
        let candidate = "";
        for (let i = 0; i < 6; i++) {
            candidate += alphabet[Math.floor(Math.random() * alphabet.length)];
        }
        const exists = await teamJoinCodeExists(candidate);
        if (!exists) {
            return candidate;
        }
        attempts++;
    }
    throw new Error("Unable to generate unique team code. Please try again.");
}

async function fetchTeamDocument(teamId) {
    if (!teamId) return null;
    try {
        const teamRef = doc(db, "teams", teamId);
        const snapshot = await getDoc(teamRef);
        if (!snapshot.exists()) {
            return null;
        }
        return { id: snapshot.id, ...snapshot.data() };
    } catch (error) {
        console.error("Error fetching team:", error);
        return null;
    }
}

async function fetchTeamMissions(teamId) {
    if (!teamId) return [];
    try {
        const missionsRef = collection(db, "teams", teamId, "activeMissions");
        const snapshot = await getDocs(missionsRef);
        return snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
        }));
    } catch (error) {
        console.error("Error fetching team missions:", error);
        return [];
    }
}

function renderTeamEmptyState() {
    const emptyState = document.getElementById('teamEmptyState');
    const details = document.getElementById('teamDetails');
    const leaveBtn = document.getElementById('teamLeaveBtn');
    if (emptyState) emptyState.style.display = 'block';
    if (details) details.style.display = 'none';
    if (leaveBtn) leaveBtn.style.display = 'none';
}

function renderTeamOverview(profile) {
    const emptyState = document.getElementById('teamEmptyState');
    const details = document.getElementById('teamDetails');
    const leaveBtn = document.getElementById('teamLeaveBtn');
    if (!currentTeamData) {
        renderTeamEmptyState();
        return;
    }
    if (emptyState) emptyState.style.display = 'none';
    if (details) details.style.display = 'block';
    if (leaveBtn) leaveBtn.style.display = 'inline-flex';
    
    const role = profile.teamRole || (currentTeamData.leaderId === currentUser.uid ? "leader" : "member");
    if (document.getElementById('teamNameDisplay')) {
        document.getElementById('teamNameDisplay').textContent = currentTeamData.name || "Unnamed Team";
    }
    if (document.getElementById('teamCodeDisplay')) {
        document.getElementById('teamCodeDisplay').textContent = `Code: ${currentTeamData.joinCode || "-"}`;
    }
    if (document.getElementById('teamRoleDisplay')) {
        document.getElementById('teamRoleDisplay').textContent = `Role: ${role}`;
    }
    if (document.getElementById('teamXpStat')) {
        document.getElementById('teamXpStat').textContent = currentTeamData.stats?.xpEarned || 0;
    }
    if (document.getElementById('teamEcoStat')) {
        document.getElementById('teamEcoStat').textContent = currentTeamData.stats?.ecoEarned || 0;
    }
    if (document.getElementById('teamMissionStat')) {
        document.getElementById('teamMissionStat').textContent = currentTeamData.stats?.missionsCompleted || 0;
    }
    if (document.getElementById('teamMemberCount')) {
        const memberCount = currentTeamData.members ? Object.keys(currentTeamData.members).length : 0;
        document.getElementById('teamMemberCount').textContent = memberCount;
    }
    renderTeamMembers();
}

function renderTeamMembers() {
    const list = document.getElementById('teamMembersList');
    if (!list) return;
    if (!currentTeamData || !currentTeamData.members) {
        list.innerHTML = '<li class="team-muted">No members yet.</li>';
        return;
    }
    const members = Object.entries(currentTeamData.members).map(([id, info]) => ({
        id,
        ...info
    }));
    members.sort((a, b) => {
        if (a.role === b.role) return (a.displayName || '').localeCompare(b.displayName || '');
        if (a.role === 'leader') return -1;
        if (b.role === 'leader') return 1;
        if (a.role === 'co_leader') return -1;
        if (b.role === 'co_leader') return 1;
        return 0;
    });
    list.innerHTML = members.map(member => `
        <li class="team-member ${member.id === currentUser.uid ? 'self' : ''}">
            <span>${escapeHtml(member.displayName || 'Member')}</span>
            <span class="team-role">${escapeHtml(member.role || 'member')}</span>
        </li>
    `).join('');
}

function renderTeamMissionLibrary(profile) {
    const library = document.getElementById('teamMissionLibrary');
    if (!library) return;
    if (!profile.teamId) {
        library.innerHTML = `<p class="team-muted">Join a team to unlock collaborative missions.</p>`;
        return;
    }
    
    // Group missions by difficulty
    const missionsByDifficulty = {
        Easy: TEAM_MISSION_LIBRARY.filter(m => m.difficulty === 'Easy'),
        Medium: TEAM_MISSION_LIBRARY.filter(m => m.difficulty === 'Medium'),
        Hard: TEAM_MISSION_LIBRARY.filter(m => m.difficulty === 'Hard')
    };
    
    let html = '';
    
    // Render each difficulty category
    ['Easy', 'Medium', 'Hard'].forEach(difficulty => {
        const missions = missionsByDifficulty[difficulty];
        if (missions.length === 0) return;
        
        const activeCount = activeTeamMissions.filter(m => m.difficulty === difficulty).length;
        const maxCount = TEAM_LIMITS.maxMissionsPerDifficulty[difficulty] || 999;
        const canAssignMore = activeCount < maxCount;
        
        html += `
            <div class="mission-difficulty-section">
                <h3 class="difficulty-header difficulty-${difficulty.toLowerCase()}">
                    ${difficulty} Missions 
                    <span class="mission-count-badge">${activeCount}/${maxCount} active</span>
                </h3>
                <div class="mission-templates-grid">
        `;
        
        missions.forEach(mission => {
            const isAlreadyActive = activeTeamMissions.some(m => m.missionTemplateId === mission.id);
            const disabled = !profile.teamId || 
                           (profile.teamRole !== 'leader' && profile.teamRole !== 'co_leader') || 
                           isAlreadyActive || 
                           !canAssignMore;
            
            // Calculate potential rewards with team size bonus
            const teamSize = currentTeamData?.members ? Object.keys(currentTeamData.members).length : 1;
            const participationMultiplier = Math.min(
                TEAM_REWARD_RULES.participationBonus.max,
                TEAM_REWARD_RULES.participationBonus.min + 
                ((teamSize / TEAM_REWARD_RULES.participationBonus.threshold) * 
                 (TEAM_REWARD_RULES.participationBonus.max - TEAM_REWARD_RULES.participationBonus.min))
            );
            const difficultyMultiplier = TEAM_REWARD_RULES.difficultyMultipliers[mission.difficulty] || 1.0;
            const potentialXp = Math.floor(mission.xpReward * difficultyMultiplier * participationMultiplier);
            const potentialEco = Math.floor(mission.ecoReward * difficultyMultiplier * participationMultiplier);
            
            html += `
                <div class="team-mission-template ${isAlreadyActive ? 'active' : ''}">
                    <div>
                        <h4>${mission.icon} ${escapeHtml(mission.title)}</h4>
                        <p>${escapeHtml(mission.description)}</p>
                        <div class="mission-meta">
                            <span class="difficulty-badge difficulty-${mission.difficulty.toLowerCase()}">${mission.difficulty}</span>
                            <span>Reward: +${potentialXp} XP / +${potentialEco} Eco</span>
                            <span>Need ${mission.requiredSubmissions} teammates</span>
                            ${mission.carbonReduction ? `<span>🌍 ${mission.carbonReduction} kg CO₂</span>` : ''}
                            ${mission.cooldownHours ? `<span>⏱️ ${mission.cooldownHours}h cooldown</span>` : ''}
                        </div>
                        ${isAlreadyActive ? '<p style="color: #4caf50; font-size: 12px; margin-top: 8px;">✓ Already active</p>' : ''}
                        ${!canAssignMore && !isAlreadyActive ? '<p style="color: #ff9800; font-size: 12px; margin-top: 8px;">⚠️ Limit reached for this difficulty</p>' : ''}
                    </div>
                    <button 
                        class="team-btn ${disabled ? 'ghost' : ''}" 
                        data-team-action="assign" 
                        data-template-id="${mission.id}"
                        ${disabled ? 'disabled' : ''}>
                        ${isAlreadyActive ? 'Active' : 'Assign'}
                    </button>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    });
    
    library.innerHTML = html || '<p class="team-muted">No missions available.</p>';
}

function renderActiveTeamMissions(profile) {
    const container = document.getElementById('activeTeamMissions');
    const hint = document.getElementById('teamMissionHint');
    if (hint) {
        hint.textContent = profile.teamId
            ? `Active missions: ${activeTeamMissions.length}/${TEAM_LIMITS.maxActiveMissions}`
            : "Complete cooperative tasks for extra XP.";
    }
    if (!container) return;
    if (!profile.teamId) {
        container.innerHTML = `<p class="team-muted">Join or create a team to unlock collaborative missions.</p>`;
        return;
    }
    if (!activeTeamMissions || activeTeamMissions.length === 0) {
        container.innerHTML = `<p class="team-muted">No active missions yet. Assign one to get started.</p>`;
        return;
    }
    container.innerHTML = activeTeamMissions.map(mission => {
        const submissions = mission.submissions || [];
        const requirement = Math.max(1, mission.requiredSubmissions || 1);
        const progress = mission.progress !== undefined ? mission.progress : Math.min(100, Math.round((submissions.length / requirement) * 100));
        const ready = submissions.length >= requirement;
        const alreadySubmitted = submissions.some(s => s.userId === currentUser.uid);
        const canApprove = ready && (profile.teamRole === 'leader' || profile.teamRole === 'co_leader');
        const canSubmit = !alreadySubmitted && !ready;
        return `
            <div class="team-mission-card ${ready ? 'ready' : ''}">
                <div class="team-mission-head">
                    <div>
                        <h4>${mission.icon || '🌿'} ${escapeHtml(mission.title)}</h4>
                        <p>${escapeHtml(mission.description || '')}</p>
                    </div>
                    <div class="team-mission-rewards">
                        <span>+${mission.xpReward} XP</span>
                        <span>+${mission.ecoReward} Eco</span>
                    </div>
                </div>
                <div class="team-mission-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width:${progress}%;"></div>
                    </div>
                    <span>${submissions.length}/${mission.requiredSubmissions} submissions</span>
                </div>
                <div class="team-mission-actions">
                    <button 
                        class="team-btn ${canSubmit ? '' : 'ghost'}" 
                        data-team-action="submit" 
                        data-mission-id="${mission.id}"
                        ${canSubmit ? '' : 'disabled'}>
                        ${alreadySubmitted ? "Submitted" : "Submit Progress"}
                    </button>
                    <button 
                        class="team-btn secondary" 
                        data-team-action="review" 
                        data-mission-id="${mission.id}"
                        ${canApprove ? '' : 'disabled'}>
                        ${ready ? "Approve & Reward" : "Waiting for team"}
                    </button>
                </div>
                <div class="team-mission-submissions">
                    ${submissions.map(sub => `
                        <div class="submission-chip">
                            <strong>${escapeHtml(sub.displayName || 'Member')}</strong>
                            <p>${escapeHtml(sub.note || 'Submitted proof')}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}

async function renderTeamLeaderboard(profile) {
    const container = document.getElementById('teamLeaderboardContainer');
    if (!container) return;
    if (!profile.teamId) {
        container.innerHTML = `<p class="team-muted">Join a team to see the leaderboard.</p>`;
        return;
    }
    try {
        const teamDoc = await getDoc(doc(db, "teams", profile.teamId));
        if (!teamDoc.exists()) {
            container.innerHTML = `<p class="team-muted">Team not found.</p>`;
            return;
        }
        const teamData = teamDoc.data();
        const members = teamData.members || {};
        const memberIds = Object.keys(members);
        if (memberIds.length === 0) {
            container.innerHTML = `<p class="team-muted">No members yet.</p>`;
            return;
        }
        const memberProfiles = [];
        for (const memberId of memberIds) {
            try {
                const memberResult = await getUserProfile(memberId);
                if (memberResult.success) {
                    memberProfiles.push({
                        ...memberResult.data,
                        id: memberId,
                        role: members[memberId]?.role || 'member'
                    });
                }
            } catch (error) {
                console.error(`Error loading member ${memberId}:`, error);
            }
        }
        memberProfiles.sort((a, b) => (b.xp || 0) - (a.xp || 0));
        container.innerHTML = `
            <div class="team-leaderboard-list">
                ${memberProfiles.map((member, index) => `
                    <div class="team-leaderboard-item ${member.id === currentUser.uid ? 'current-user' : ''}">
                        <div class="leaderboard-rank">#${index + 1}</div>
                        <div class="leaderboard-info">
                            <strong>${escapeHtml(member.displayName || member.email || 'Member')}</strong>
                            <span class="leaderboard-role">${member.role === 'leader' ? '👑 Leader' : member.role === 'co_leader' ? '⭐ Co-Leader' : 'Member'}</span>
                        </div>
                        <div class="leaderboard-stats">
                            <span>${(member.xp || 0).toLocaleString()} XP</span>
                            <span>${(member.ecoPoints || 0).toLocaleString()} Eco</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (error) {
        console.error("Error rendering team leaderboard:", error);
        container.innerHTML = `<p class="team-muted">Error loading leaderboard.</p>`;
    }
}

async function refreshTeamData(profile) {
    if (!profile.teamId) {
        currentTeamData = null;
        activeTeamMissions = [];
        renderTeamEmptyState();
        renderActiveTeamMissions(profile);
        await renderTeamLeaderboard(profile);
        return;
    }
    currentTeamData = await fetchTeamDocument(profile.teamId);
    activeTeamMissions = await fetchTeamMissions(profile.teamId);
    renderTeamOverview(profile);
    renderTeamMissionLibrary(profile);
    renderActiveTeamMissions(profile);
    await renderTeamLeaderboard(profile);
}

async function createTeamDocument(profile, teamName) {
    const trimmed = (teamName || "").trim();
    if (trimmed.length < 3) {
        throw new Error("Team name must have at least 3 characters.");
    }
    const joinCode = await generateUniqueTeamCode();
    const teamRef = doc(collection(db, "teams"));
    const timestamp = new Date().toISOString();
    const members = {};
    members[currentUser.uid] = {
        displayName: profile.displayName || profile.email || "Member",
        role: "leader",
        joinedAt: timestamp
    };
    await setDoc(teamRef, {
        name: trimmed,
        joinCode,
        leaderId: currentUser.uid,
        members,
        stats: {
            missionsCompleted: 0,
            xpEarned: 0,
            ecoEarned: 0,
            approvals: 0
        },
        dailyMissionCounter: {},
        createdAt: timestamp,
        activeMissionCount: 0
    });
    await updateUserProfile(currentUser.uid, { teamId: teamRef.id, teamRole: "leader" });
    return teamRef.id;
}

async function joinTeamByCode(profile, teamCode) {
    const normalized = normalizeTeamCode(teamCode);
    if (!normalized || normalized.length < 6) {
        throw new Error("Please enter a valid 6-character code.");
    }
    const teamsRef = collection(db, "teams");
    const q = query(teamsRef, where("joinCode", "==", normalized), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        throw new Error("No team found with that code.");
    }
    const teamDoc = snapshot.docs[0];
    const data = teamDoc.data();
    const members = data.members || {};
    if (members[currentUser.uid]) {
        throw new Error("You are already part of this team.");
    }
    if (Object.keys(members).length >= TEAM_LIMITS.maxMembers) {
        throw new Error("This team reached the member limit.");
    }
    const joinedAt = new Date().toISOString();
    await updateDoc(teamDoc.ref, {
        [`members.${currentUser.uid}`]: {
            displayName: profile.displayName || profile.email || "Member",
            role: "member",
            joinedAt
        }
    });
    await updateUserProfile(currentUser.uid, { teamId: teamDoc.id, teamRole: "member" });
    return teamDoc.id;
}

async function leaveCurrentTeam(profile) {
    if (!profile.teamId) return;
    const teamRef = doc(db, "teams", profile.teamId);
    const snapshot = await getDoc(teamRef);
    if (!snapshot.exists()) {
        await updateUserProfile(currentUser.uid, { teamId: null, teamRole: null });
        return;
    }
    const data = snapshot.data();
    const members = data.members || {};
    if (!members[currentUser.uid]) {
        await updateUserProfile(currentUser.uid, { teamId: null, teamRole: null });
        return;
    }
    const remainingMembers = Object.keys(members).filter(uid => uid !== currentUser.uid);
    if (remainingMembers.length === 0) {
        await deleteDoc(teamRef);
    } else {
        const updates = {
            [`members.${currentUser.uid}`]: deleteField()
        };
        if (data.leaderId === currentUser.uid) {
            const newLeaderId = remainingMembers[0];
            updates.leaderId = newLeaderId;
            updates[`members.${newLeaderId}.role`] = "leader";
        }
        await updateDoc(teamRef, updates);
    }
    await updateUserProfile(currentUser.uid, { teamId: null, teamRole: null });
    currentTeamData = null;
    activeTeamMissions = [];
}

async function assignTeamMission(profile, templateId) {
    if (!profile.teamId) {
        throw new Error("Join a team first.");
    }
    if (!currentTeamData) {
        await refreshTeamData(profile);
    }
    if (profile.teamRole !== 'leader' && profile.teamRole !== 'co_leader') {
        throw new Error("Only leaders can assign new missions.");
    }
    const template = TEAM_MISSION_LIBRARY.find(m => m.id === templateId);
    if (!template) {
        throw new Error("Mission template not found.");
    }
    
    // Fetch fresh missions from Firestore to check for duplicates and limits
    const currentMissions = await fetchTeamMissions(profile.teamId);
    const existingMission = currentMissions.find(m => 
        m.missionTemplateId === templateId && 
        (m.status === 'active' || m.status === 'ready_for_review' || !m.status)
    );
    if (existingMission) {
        throw new Error(`Mission "${template.title}" is already active. Complete it first before assigning again.`);
    }
    
    // Check total active missions limit
    if (currentMissions.length >= TEAM_LIMITS.maxActiveMissions) {
        throw new Error(`Maximum active missions reached (${TEAM_LIMITS.maxActiveMissions}). Complete some missions first.`);
    }
    
    // Check difficulty-based limits
    const missionsByDifficulty = currentMissions.filter(m => m.difficulty === template.difficulty);
    const maxForDifficulty = TEAM_LIMITS.maxMissionsPerDifficulty[template.difficulty] || 999;
    if (missionsByDifficulty.length >= maxForDifficulty) {
        throw new Error(`You can only have ${maxForDifficulty} active ${template.difficulty} mission(s) at a time.`);
    }
    
    // Check cooldown - prevent assigning same mission too soon after completion
    const missionLogsRef = collection(db, "teams", profile.teamId, "missionLogs");
    const logsQuery = query(missionLogsRef, where("missionId", "==", templateId), limit(1));
    const logsSnapshot = await getDocs(logsQuery);
    if (!logsSnapshot.empty) {
        const lastLog = logsSnapshot.docs[0].data();
        const lastCompleted = new Date(lastLog.completedAt);
        const cooldownMs = (template.cooldownHours || 24) * 60 * 60 * 1000;
        const timeSinceCompletion = Date.now() - lastCompleted.getTime();
        if (timeSinceCompletion < cooldownMs) {
            const hoursRemaining = Math.ceil((cooldownMs - timeSinceCompletion) / (60 * 60 * 1000));
            throw new Error(`This mission is on cooldown. Try again in ${hoursRemaining} hour(s).`);
        }
    }
    
    // Check daily mission cap
    const todayKey = getTodayDateString();
    const teamDailyCount = currentTeamData?.dailyMissionCounter?.[todayKey] || 0;
    if (teamDailyCount >= TEAM_LIMITS.dailyMissionCap) {
        throw new Error(`Team reached today's mission limit (${TEAM_LIMITS.dailyMissionCap}). Try again tomorrow.`);
    }
    
    // Calculate dynamic rewards based on team size and difficulty
    const teamSize = currentTeamData?.members ? Object.keys(currentTeamData.members).length : 1;
    const participationMultiplier = Math.min(
        TEAM_REWARD_RULES.participationBonus.max,
        TEAM_REWARD_RULES.participationBonus.min + 
        ((teamSize / TEAM_REWARD_RULES.participationBonus.threshold) * 
         (TEAM_REWARD_RULES.participationBonus.max - TEAM_REWARD_RULES.participationBonus.min))
    );
    const difficultyMultiplier = TEAM_REWARD_RULES.difficultyMultipliers[template.difficulty] || 1.0;
    
    const finalXpReward = Math.floor(template.xpReward * difficultyMultiplier * participationMultiplier);
    const finalEcoReward = Math.floor(template.ecoReward * difficultyMultiplier * participationMultiplier);
    
    await addDoc(collection(db, "teams", profile.teamId, "activeMissions"), {
        missionTemplateId: template.id,
        title: template.title,
        description: template.description,
        icon: template.icon,
        difficulty: template.difficulty,
        xpReward: finalXpReward,
        ecoReward: finalEcoReward,
        baseXpReward: template.xpReward, // Store base for reference
        baseEcoReward: template.ecoReward,
        carbonReduction: template.carbonReduction || 0,
        requiredSubmissions: template.requiredSubmissions,
        status: "active",
        submissions: [],
        progress: 0,
        startedBy: currentUser.uid,
        startedAt: new Date().toISOString(),
        cooldownHours: template.cooldownHours || 24
    });
    await updateDoc(doc(db, "teams", profile.teamId), {
        activeMissionCount: increment(1)
    });
    await refreshTeamData(profile);
    alert(`Mission "${template.title}" assigned to your team! Rewards: ${finalXpReward} XP, ${finalEcoReward} EcoPoints`);
}

// meeskonna missiooni edenemise esitamine, kontrollib kõiki valideerimisi enne salvestamist
async function submitTeamMissionProgress(profile, missionId, note) {
    // kontrollib, et kasutaja on meeskonnas
    if (!profile.teamId) {
        throw new Error("Join a team first.");
    }
    // värskendab meeskonna andmeid, kui need puuduvad
    if (!currentTeamData) {
        await refreshTeamData(profile);
    }
    // kontrollib, et märkused on piisavalt pikad
    const trimmed = (note || "").trim();
    if (trimmed.length < TEAM_REWARD_RULES.minReflectionLength) {
        throw new Error(`Please describe your effort in at least ${TEAM_REWARD_RULES.minReflectionLength} characters.`);
    }
    const missionRef = doc(db, "teams", profile.teamId, "activeMissions", missionId);
    const snapshot = await getDoc(missionRef);
    // kontrollib, et missioon on olemas
    if (!snapshot.exists()) {
        throw new Error("Mission not found.");
    }
    const mission = snapshot.data();
    const submissions = mission.submissions || [];
    // kontrollib, et kasutaja pole juba esitanud
    if (submissions.some(sub => sub.userId === currentUser.uid)) {
        throw new Error("You already submitted proof for this mission.");
    }
    const newSubmissions = [
        ...submissions,
        {
            userId: currentUser.uid,
            displayName: profile.displayName || profile.email || "Member",
            note: trimmed,
            submittedAt: new Date().toISOString()
        }
    ];
    const ready = newSubmissions.length >= mission.requiredSubmissions;
    const progress = Math.min(100, Math.round((newSubmissions.length / mission.requiredSubmissions) * 100));
    
    await updateDoc(missionRef, {
        submissions: newSubmissions,
        status: ready ? "ready_for_review" : "active",
        lastUpdatedAt: new Date().toISOString(),
        progress: progress
    });
    
    // Update local state
    activeTeamMissions = activeTeamMissions.map(m => 
        m.id === missionId ? { ...m, submissions: newSubmissions, status: ready ? "ready_for_review" : "active", progress: progress } : m
    );
    
    // Refresh UI to show updated progress
    renderActiveTeamMissions(profile);
    
    // Show feedback
    if (ready) {
        alert(`Great! Mission is ready for review. ${newSubmissions.length}/${mission.requiredSubmissions} team members have submitted.`);
    } else {
        alert(`Progress updated! ${newSubmissions.length}/${mission.requiredSubmissions} team members have submitted.`);
    }
}

// meeskonna missiooni kinnitamine, kontrollib õigusi ja esituste arvu enne kinnitamist
async function approveTeamMission(profile, missionId) {
    // kontrollib, et kasutaja on meeskonnas
    if (!profile.teamId) {
        throw new Error("No team linked.");
    }
    // värskendab meeskonna andmeid, kui need puuduvad
    if (!currentTeamData) {
        await refreshTeamData(profile);
    }
    // kontrollib, et ainult juhid saavad kinnitada
    if (profile.teamRole !== 'leader' && profile.teamRole !== 'co_leader') {
        throw new Error("Only leaders can approve missions.");
    }
    const missionRef = doc(db, "teams", profile.teamId, "activeMissions", missionId);
    const snapshot = await getDoc(missionRef);
    // kontrollib, et missioon on olemas
    if (!snapshot.exists()) {
        throw new Error("Mission not found.");
    }
    const mission = snapshot.data();
    const submissions = mission.submissions || [];
    // kontrollib minimaalset esitajate arvu
    if (submissions.length < TEAM_LIMITS.minUniqueSubmitters) {
        throw new Error(`Need at least ${TEAM_LIMITS.minUniqueSubmitters} unique submissions before approval.`);
    }
    // kontrollib, et kõik vajalikud esitused on olemas
    if (submissions.length < mission.requiredSubmissions) {
        throw new Error(`Need ${mission.requiredSubmissions} submissions, but only ${submissions.length} provided.`);
    }
    
    const participants = submissions;
    // arvutab tasu kasutaja kohta minimaalsete garantidega
    const xpPerUser = Math.max(15, Math.floor(mission.xpReward / participants.length));
    const ecoPerUser = Math.max(8, Math.floor(mission.ecoReward / participants.length));
    
    // Bonus for leader who approves (small incentive)
    const approverBonus = profile.teamRole === 'leader' ? 1.1 : 1.0;
    const approverXp = Math.floor(xpPerUser * approverBonus);
    const approverEco = Math.floor(ecoPerUser * approverBonus);
    
    // jaotab tasud kõikidele osalejatele, kontrollib iga osaleja profiili
    for (const participant of participants) {
        try {
            // kontrollib, et osaleja profiil on olemas
            const profileResult = await getUserProfile(participant.userId);
            if (!profileResult.success) continue;
            const participantProfile = profileResult.data;
            
            // kontrollib, kas see on kinnitaja (saab boonust)
            const isApprover = participant.userId === currentUser.uid;
            const rewardXp = isApprover ? approverXp : xpPerUser;
            const rewardEco = isApprover ? approverEco : ecoPerUser;
            
            // tagab, et XP ja EcoPoints on alati positiivsed arvud
            const newXP = (participantProfile.xp || 0) + rewardXp;
            const newLevel = calculateLevel(newXP);
            const newEco = (participantProfile.ecoPoints || 0) + rewardEco;
            const teamStats = participantProfile.teamStats || { 
                missionsCompleted: 0, 
                xpEarned: 0, 
                ecoEarned: 0, 
                approvalsGiven: 0 
            };
            
            await updateUserProfile(participant.userId, {
                xp: newXP,
                ecoPoints: newEco,
                level: newLevel,
                missionsCompleted: (participantProfile.missionsCompleted || 0) + 1,
                teamStats: {
                    missionsCompleted: (teamStats.missionsCompleted || 0) + 1,
                    xpEarned: (teamStats.xpEarned || 0) + rewardXp,
                    ecoEarned: (teamStats.ecoEarned || 0) + rewardEco,
                    approvalsGiven: isApprover ? (teamStats.approvalsGiven || 0) + 1 : (teamStats.approvalsGiven || 0)
                }
            });
        } catch (error) {
            console.error("Error rewarding participant:", error);
        }
    }
    
    // Update team stats
    const totalXpRewarded = mission.xpReward || 0;
    const totalEcoRewarded = mission.ecoReward || 0;
    
    await updateDoc(doc(db, "teams", profile.teamId), {
        "stats.missionsCompleted": increment(1),
        "stats.xpEarned": increment(totalXpRewarded),
        "stats.ecoEarned": increment(totalEcoRewarded),
        "stats.approvals": increment(1),
        activeMissionCount: increment(-1),
        [`dailyMissionCounter.${getTodayDateString()}`]: increment(1),
        lastMissionCompletedAt: new Date().toISOString()
    });
    
    // Log mission completion
    try {
        await addDoc(collection(db, "teams", profile.teamId, "missionLogs"), {
            missionId: missionId,
            missionTemplateId: mission.missionTemplateId,
            title: mission.title,
            difficulty: mission.difficulty,
            completedAt: new Date().toISOString(),
            rewardedXp: totalXpRewarded,
            rewardedEco: totalEcoRewarded,
            carbonReduction: mission.carbonReduction || 0,
            participants: participants.map(p => ({ 
                userId: p.userId, 
                displayName: p.displayName || "Member" 
            })),
            approvedBy: currentUser.uid
        });
    } catch (error) {
        console.warn("Unable to write team mission log:", error);
    }
    
    await deleteDoc(missionRef);
    activeTeamMissions = activeTeamMissions.filter(m => m.id !== missionId);
    await refreshTeamData(profile);
    renderActiveTeamMissions(profile);
    alert(`Approved "${mission.title}"! ${participants.length} teammates received rewards.`);
}

function openTeamManagerModal(mode) {
    const modal = document.getElementById('teamManagerModal');
    const title = document.getElementById('teamModalTitle');
    const description = document.getElementById('teamModalDescription');
    const input = document.getElementById('teamModalInput');
    if (!modal || !title || !description || !input) return;
    teamModalMode = mode;
    input.value = '';
    if (mode === 'create') {
        title.textContent = "Create a Team";
        description.textContent = "Name your squad so friends can recognize it.";
        input.placeholder = "Example: Green Guardians";
    } else {
        title.textContent = "Join a Team";
        description.textContent = "Enter the 6-character invite code shared by your teammate.";
        input.placeholder = "Example: ECO123";
    }
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
    input.focus();
}

function closeTeamManagerModal() {
    const modal = document.getElementById('teamManagerModal');
    if (modal) {
        modal.style.display = 'none';
    }
    document.body.classList.remove('modal-open');
    teamModalMode = null;
}

function openTeamSubmissionModal(missionId) {
    if (!missionId) return;
    const modal = document.getElementById('teamSubmissionModal');
    const title = document.getElementById('teamSubmissionTitle');
    const note = document.getElementById('teamSubmissionNote');
    if (!modal || !title || !note) return;
    const mission = activeTeamMissions.find(m => m.id === missionId);
    teamSubmissionContext = missionId;
    title.textContent = mission ? `Update: ${mission.title}` : "Mission Update";
    note.value = "";
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
    note.focus();
}

function closeTeamSubmissionModal() {
    const modal = document.getElementById('teamSubmissionModal');
    if (modal) {
        modal.style.display = 'none';
    }
    document.body.classList.remove('modal-open');
    teamSubmissionContext = null;
}

function bindTeamUI(profile) {
    const createButtons = [
        document.getElementById('teamCreateBtn'),
        document.getElementById('teamQuickCreateBtn')
    ];
    createButtons.forEach(btn => {
        if (!btn) return;
        btn.addEventListener('click', () => openTeamManagerModal('create'));
    });
    
    const joinButtons = [
        document.getElementById('teamJoinBtn'),
        document.getElementById('teamQuickJoinBtn')
    ];
    joinButtons.forEach(btn => {
        if (!btn) return;
        btn.addEventListener('click', () => openTeamManagerModal('join'));
    });
    
    const leaveBtn = document.getElementById('teamLeaveBtn');
    if (leaveBtn) {
        leaveBtn.addEventListener('click', async () => {
            if (!confirm("Leave the current team?")) return;
            try {
                await leaveCurrentTeam(profile);
                profile.teamId = null;
                profile.teamRole = null;
                await refreshTeamData(profile);
                alert("You left the team.");
            } catch (error) {
                alert(error.message || "Unable to leave the team right now.");
            }
        });
    }
    
    const copyBtn = document.getElementById('teamCopyCodeBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            if (!currentTeamData?.joinCode) {
                alert("No code to copy.");
                return;
            }
            try {
                await navigator.clipboard.writeText(currentTeamData.joinCode);
                alert("Team code copied to clipboard.");
            } catch {
                alert("Unable to copy automatically. Code: " + currentTeamData.joinCode);
            }
        });
    }
    
    const manageBtn = document.getElementById('teamManageBtn');
    if (manageBtn) {
        manageBtn.addEventListener('click', () => {
            if (!currentTeamData?.joinCode) {
                alert("Team code not available yet.");
                return;
            }
            alert(`Share this code with teammates:\n\n${currentTeamData.joinCode}`);
        });
    }
    
    const assignBtn = document.getElementById('assignMissionBtn');
    if (assignBtn) {
        assignBtn.addEventListener('click', () => {
            const library = document.getElementById('teamMissionLibrary');
            if (library) {
                library.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }
    
    const modalSubmit = document.getElementById('teamModalSubmit');
    const modalCancel = document.getElementById('teamModalCancel');
    const modalClose = document.getElementById('teamModalCloseBtn');
    const handleClose = () => closeTeamManagerModal();
    if (modalCancel) modalCancel.addEventListener('click', handleClose);
    if (modalClose) modalClose.addEventListener('click', handleClose);
    if (modalSubmit) {
        modalSubmit.addEventListener('click', async () => {
            const input = document.getElementById('teamModalInput');
            if (!input) {
                alert("Input field not found.");
                return;
            }
            const value = input.value.trim();
            if (!value) {
                alert("Please enter a team name or code.");
                return;
            }
            try {
                if (teamModalMode === 'create') {
                    if (value.length < 3) {
                        alert("Team name must be at least 3 characters.");
                        return;
                    }
                    const teamId = await createTeamDocument(profile, value);
                    profile.teamId = teamId;
                    profile.teamRole = "leader";
                    await refreshTeamData(profile);
                    alert(`Team created! Share code: ${currentTeamData.joinCode}`);
                } else {
                    if (value.length < 6) {
                        alert("Please enter a valid 6-character team code.");
                        return;
                    }
                    const teamId = await joinTeamByCode(profile, value);
                    profile.teamId = teamId;
                    profile.teamRole = "member";
                    await refreshTeamData(profile);
                    alert("Successfully joined the team!");
                }
                closeTeamManagerModal();
            } catch (error) {
                console.error("Team operation error:", error);
                alert(error.message || "Unable to process the request. Please try again.");
            }
        });
    }
    
    const managerModal = document.getElementById('teamManagerModal');
    if (managerModal) {
        managerModal.addEventListener('click', (event) => {
            if (event.target === managerModal) {
                closeTeamManagerModal();
            }
        });
    }
    
    const submissionCancel = document.getElementById('teamSubmissionCancel');
    const submissionClose = document.getElementById('teamSubmissionClose');
    const submissionSubmit = document.getElementById('teamSubmissionSubmit');
    const closeSubmission = () => closeTeamSubmissionModal();
    if (submissionCancel) submissionCancel.addEventListener('click', closeSubmission);
    if (submissionClose) submissionClose.addEventListener('click', closeSubmission);
    if (submissionSubmit) {
        submissionSubmit.addEventListener('click', async () => {
            if (!teamSubmissionContext) {
                closeTeamSubmissionModal();
                return;
            }
            const noteInput = document.getElementById('teamSubmissionNote');
            try {
                await submitTeamMissionProgress(profile, teamSubmissionContext, noteInput.value);
                closeTeamSubmissionModal();
                alert("Progress submitted!");
            } catch (error) {
                alert(error.message || "Could not submit progress.");
            }
        });
    }
    
    const submissionModal = document.getElementById('teamSubmissionModal');
    if (submissionModal) {
        submissionModal.addEventListener('click', (event) => {
            if (event.target === submissionModal) {
                closeTeamSubmissionModal();
            }
        });
    }
    
    const missionContainer = document.getElementById('activeTeamMissions');
    if (missionContainer) {
        missionContainer.addEventListener('click', (event) => {
            const target = event.target.closest('[data-team-action]');
            if (!target) return;
            const missionId = target.dataset.missionId;
            const action = target.dataset.teamAction;
            if (!missionId || !action) return;
            if (action === 'submit') {
                openTeamSubmissionModal(missionId);
            } else if (action === 'review') {
                approveTeamMission(profile, missionId).catch(error => alert(error.message || "Unable to approve mission."));
            }
        });
    }
    
    const missionLibrary = document.getElementById('teamMissionLibrary');
    if (missionLibrary) {
        missionLibrary.addEventListener('click', (event) => {
            const target = event.target.closest('[data-team-action="assign"]');
            if (!target) return;
            const templateId = target.dataset.templateId;
            if (!templateId) return;
            assignTeamMission(profile, templateId).catch(error => alert(error.message || "Unable to assign mission."));
        });
    }
}

requireAuth().then(async (user) => {
    currentUser = user;
    try {
        const profileResult = await getUserProfile(user.uid);
        if (profileResult.success) {
            const profile = profileResult.data;
            currentProfileData = profile;
            await refreshTeamData(profile);
            bindTeamUI(profile);
        }
    } catch (error) {
        console.error("Error loading team page:", error);
        alert("Unable to load team information.");
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

