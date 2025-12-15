# EcoQuest - System Schemas

Simple, easy-to-understand schemas for each section of the EcoQuest application.

---

## 🔐 Authentication Flow

```
User → Sign Up/Login → Firebase Auth → User Profile Created → Dashboard
  ↓
Email/Password Validation → Firebase Authentication → Firestore User Document
```

**Files:**
- `public/html/login.html` - Login page
- `public/html/signup.html` - Registration page
- `public/js/auth.js` - Authentication functions
- `public/js/auth-guard.js` - Route protection

---

## 📋 Quest System Flow

```
Daily Reset (24h) → Load 5 Random Quests → User Selects Quests → Start Tracking
  ↓
User Completes Task → Check Verification → Calculate Rewards → Update Profile
  ↓
XP + EcoPoints + Carbon Reduction → Level Up Check → Badge Unlock
```

**Verification Steps:**
1. Check quest start time
2. Verify minimum time passed
3. Check daily limit (5 quests/day)
4. Detect abnormal patterns
5. Calculate rewards

**Files:**
- `public/html/dashboard.html` - Quest display & completion
- `public/quests.json` - Quest definitions
- `public/quests.md` - Quest documentation

---

## 🏆 Gamification System

```
XP Earned → Calculate Level → Check Badge → Update Profile
  ↓
Level 1-9: Cat → Fox → Rabbit → Deer → Wolf → Bear → Eagle → Tiger → Lion
  ↓
EcoPoints = (XP / multiplier) + (Badges × 10) + Bonuses
```

**Level System:**
- 9 levels total
- XP milestones: 0, 100, 250, 500, 1000, 2500, 5000, 10000, 50000
- Each level unlocks a unique badge

**Files:**
- `public/html/dashboard.html` - Level calculation & badge display
- `public/js/profile.js` - Badge system

---

## 🛒 Shop & Collection System

```
User Earns EcoPoints → Browse Shop → Select Plant → Purchase
  ↓
Deduct EcoPoints → Add Plant to Collection → Update Profile
  ↓
Collection Display → Filter by Rarity → View Owned Plants
```

**Plant Rarities:**
- Common (4 plants) - 40-55 EcoPoints
- Rare (4 plants) - 120-180 EcoPoints
- Epic (3 plants) - 300-400 EcoPoints
- Legendary (3 plants) - 500-1000 EcoPoints

**Files:**
- `public/html/shop.html` - Plant shop
- `public/html/collection.html` - Plant collection
- `public/js/shop.js` - Shop functionality
- `public/js/collection.js` - Collection management

---

## 👤 Profile & Leaderboard System

```
User Profile → Load Stats → Calculate Rank → Display Information
  ↓
XP, Level, Missions, CO₂ Reduced, Rank, Best Rank, Plants
```

**Leaderboard:**
- Sorted by XP (descending)
- Shows top users globally
- Updates in real-time

**Files:**
- `public/html/profile.html` - User profile
- `public/html/leaderboard.html` - Global rankings
- `public/js/profile.js` - Profile management

---

## 🌍 Carbon Reduction Tracking

```
Quest Completed → Find Quest in quests.json → Get Carbon Value
  ↓
Sum All Completed Quests → Display Total kg CO₂ Reduced
  ↓
Dashboard: Real-time display
Profile: Total reduction display
```

**Calculation:**
- Each quest has `carbonFootprintReduction` value
- Sum all completed quests' carbon values
- Display in kg CO₂ format

**Files:**
- `public/html/dashboard.html` - Carbon calculation
- `public/js/profile.js` - Carbon calculation
- `public/quests.json` - Carbon values per quest

---

## ✅ Quest Verification System

```
User Checks Quest → Start Time Recorded → User Completes Task
  ↓
Click "Complete" → Verification Checks:
  1. Quest started? (start time exists)
  2. Minimum time passed? (based on quest type)
  3. Daily limit OK? (max 10 quests/day)
  4. Not too fast? (10 min between batches)
  5. Not too many? (max 3 at once)
  ↓
If Valid → Award Rewards → Update Profile
If Invalid → Show Error → Block Completion
```

**Quest Types & Minimum Times:**
- Duration quests: Specified minutes + 2 min buffer
- Count quests: 3 minutes per item
- Boolean quests: 2 hours minimum

**Files:**
- `public/html/dashboard.html` - Verification logic
- `getQuestMinimumTime()` - Time calculation
- `detectAbnormalPattern()` - Pattern detection
- `startQuestTracking()` - Start time tracking

---

## 📊 Data Flow

```
User Action → JavaScript Function → Firebase API → Firestore Database
  ↓
Firestore Update → Real-time Sync → UI Update → User Sees Changes
```

**Data Structure:**
```
users/{userId}
  ├── xp: number
  ├── level: number
  ├── ecoPoints: number
  ├── badges: array
  ├── completedQuests: array
  ├── dailyQuestsCompleted: array
  ├── questStartTimes: object
  ├── questCompletionCount: object
  ├── dailyQuestCompletions: object
  ├── totalCarbonReduced: number (calculated)
  └── plants: array
```

**Files:**
- `public/js/auth.js` - Data operations
- `firestore.rules` - Security rules

---

## 🎯 Quest Categories

```
7 Categories → 25+ Quests Total
  ↓
♻️ Recycling (6 quests)
💡 Energy Saving (7 quests)
🚶 Transportation (3 quests)
💧 Water Saving (2 quests)
🧹 Clean-Up (3 quests)
🌱 Gardening (2 quests)
♻️ Sustainable Living (4 quests)
```

**Category Badges:**
- Complete all quests in a category → Unlock category badge
- Track progress per category
- Visual charts for completion

---

## 🔄 Daily Quest Reset System

```
Last Reset Time → Check 24h Passed → Generate 5 Random Quests
  ↓
Update Profile → Display New Quests → Start Countdown Timer
  ↓
24h Countdown → Auto Reset → Reload Page
```

**Reset Logic:**
- Checks `lastQuestResetTime`
- If 24h passed → Reset
- If no quests → Reset
- Random selection from available quests

---

## 🎁 Reward System

```
Quest Completed → Base XP → Check Completion Count → Apply Bonus
  ↓
XP Calculation:
  - Base XP × Bonus Multiplier (up to 3x)
  - Bonus: 1 + (completionCount × 0.2)
  ↓
EcoPoints Calculation:
  - XP / Level Multiplier + Badge Bonus + Repeat Bonus
  ↓
Carbon Reduction:
  - Sum from quests.json values
```

**Bonus System:**
- First completion: 1x XP
- Repeat 1: 1.2x XP
- Repeat 2: 1.4x XP
- Repeat 3+: Up to 3x XP

---

## 📱 Page Structure

```
Landing → Login/Signup → Dashboard (Main)
  ↓
Dashboard Links:
  ├── Shop → Buy Plants
  ├── Collection → View Plants
  ├── Profile → View Stats
  └── Leaderboard → View Rankings
```

**Navigation:**
- All pages have header with navigation
- Auth guard protects routes
- Mobile-responsive menu

---

## 🔒 Security Flow

```
User Request → Auth Guard Check → Firebase Auth Verify
  ↓
If Authenticated → Allow Access → Load User Data
If Not Authenticated → Redirect to Login
  ↓
Firestore Rules → Verify User ID → Allow/Deny Operation
```

**Security Rules:**
- Users can only read/write their own data
- Leaderboard: Read-only for all authenticated users
- Profile: Read own, write own

---

## 📈 Progress Tracking

```
User Completes Quest → Update Stats → Recalculate Progress
  ↓
XP Progress Bar → Level Progress → Category Charts
  ↓
Carbon Chart → Category Progress List → Badge Unlocks
```

**Visual Elements:**
- Chart.js for category completion
- Chart.js for carbon reduction
- Progress bars for XP and levels
- Category progress cards

---

## 🎮 Replay Mode

```
All 25 Quests Completed → Master Eco Warrior Badge Unlocked
  ↓
Replay Mode Activated → Repeat Quests → Bonus Rewards
  ↓
Completion Count Tracked → Bonus Multiplier Applied
  ↓
Daily Reset Still Works → New Random Quests Daily
```

**Replay Benefits:**
- Up to 3x XP bonus
- Extra EcoPoints
- Track completion count
- Continue earning rewards

---

## 📝 File Organization

```
public/
├── html/          → All page files
├── css/           → Stylesheets per page
├── js/            → JavaScript modules
├── images/        → Assets (badges, plants, logos)
├── quests.json    → Quest data
└── quests.md      → Quest documentation
```

---

## 🔧 Key Functions

**Authentication:**
- `signUp()` - Create account
- `signIn()` - Login
- `logOut()` - Sign out
- `getUserProfile()` - Load user data
- `updateUserProfile()` - Save user data

**Quests:**
- `loadQuests()` - Load from quests.md
- `loadQuestsData()` - Load from quests.json
- `renderQuests()` - Display quests
- `getQuestMinimumTime()` - Calculate min time
- `detectAbnormalPattern()` - Verify completion
- `startQuestTracking()` - Track start time

**Gamification:**
- `calculateLevel()` - Get level from XP
- `calculateEcoPoints()` - Calculate EcoPoints
- `getBadgeImageForLevel()` - Get badge image
- `getBadgeNameForLevel()` - Get badge name

**Carbon:**
- `calculateTotalCarbonReduction()` - Sum carbon values
- `mapCompletedQuestIds()` - Map quest IDs
- `calculateQuestProgress()` - Category progress

---

## 🎯 Simple User Journey

```
1. Sign Up → Create Account
2. Dashboard → See Daily Quests
3. Select Quest → Start Tracking
4. Complete Task → Wait Minimum Time
5. Complete Quest → Earn XP & EcoPoints
6. Level Up → Unlock Badge
7. Shop → Buy Plants with EcoPoints
8. Collection → View Plants
9. Profile → See Stats & Carbon Reduced
10. Leaderboard → Compare with Others
```

---

## 📊 Database Schema

```
users/{userId}
  ├── email: string
  ├── displayName: string
  ├── xp: number
  ├── level: number
  ├── ecoPoints: number
  ├── badges: string[]
  ├── activeBadge: string
  ├── missionsCompleted: number
  ├── completedQuests: string[]
  ├── dailyQuestsCompleted: string[]
  ├── currentDailyQuests: string[]
  ├── lastQuestResetTime: timestamp
  ├── questStartTimes: {questId: timestamp}
  ├── questCompletionCount: {questId: number}
  ├── dailyQuestCompletions: {date: string[]}
  ├── lastQuestCompletionTime: timestamp
  ├── allQuestsCompleted: boolean
  ├── allQuestsCompletedCount: number
  ├── allQuestsCompletedDate: timestamp
  ├── plants: plant[]
  ├── bestRank: number
  └── createdAt: timestamp
```

---

## 🎨 UI Components

**Dashboard:**
- User stats cards (XP, EcoPoints, CO₂)
- Badge showcase
- Daily quests list
- Progress charts
- Category progress list

**Profile:**
- Profile header (badge, name, email)
- Stats grid (rank, level, missions, CO₂)
- Collection section
- Filter buttons

**Shop:**
- Plant grid
- Rarity filters
- Purchase buttons
- EcoPoints display

**Leaderboard:**
- User ranking table
- XP display
- Badge display
- Search/filter

---

## 🔄 State Management

```
Current User → Load Profile → Update UI
  ↓
User Action → Update State → Save to Firestore → Update UI
  ↓
Real-time Sync → Firebase Listener → Auto Update UI
```

**State Variables:**
- `currentUser` - Firebase user object
- `profile` - User profile data
- `quests` - Current daily quests
- `completedQuests` - All completed quest IDs
- `dailyCompleted` - Today's completed quests

---

## ✅ Validation Rules

**Quest Completion:**
- Quest must be started (checkbox checked)
- Minimum time must pass (quest type dependent)
- Daily limit: 10 quests/day
- Batch limit: 10 min between batches
- Too many: Warning if >3 at once

**User Input:**
- Email validation
- Password strength (min 6 chars)
- Display name validation
- Input sanitization

---

## 🎯 Summary

**Main Sections:**
1. **Auth** - Login/Signup/Protection
2. **Quests** - Daily missions with verification
3. **Gamification** - XP, Levels, Badges, EcoPoints
4. **Shop** - Plant purchases
5. **Collection** - Plant showcase
6. **Profile** - User stats & info
7. **Leaderboard** - Global rankings
8. **Carbon Tracking** - CO₂ reduction display

**Key Features:**
- Time-based quest verification
- Carbon footprint tracking
- Gamified progression system
- Virtual plant collection
- Social leaderboard

**Tech:**
- Frontend: HTML/CSS/JS (Vanilla)
- Backend: Firebase (Auth, Firestore)
- Charts: Chart.js


