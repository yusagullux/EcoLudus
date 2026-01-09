# 🌍 EcoLudus

<div align="center">

**Gamified Environmental Sustainability Platform**




## 📖 About

EcoLudus is a modern, gamified web application designed to raise awareness about environmental sustainability. Users complete eco-friendly missions, track their carbon footprint reduction, earn XP and EcoPoints, unlock badges, collect virtual plants, and compete on global leaderboards. By turning environmental actions into a game, EcoLudus makes sustainability engaging and rewarding.

### 🎯 Mission

Our mission is to inspire millions of people to adopt eco-friendly habits through gamification, making environmental consciousness a daily practice rather than an occasional thought.

---

## ✨ Features

### 🎮 Core Features

- **📋 Daily Missions System**
  - 25+ eco-friendly quests across 7 categories
  - Daily quest reset with countdown timer
  - Progress tracking with visual indicators
  - Replay mode with bonus rewards for completed quests

- **🏆 Gamification System**
  - **XP & Leveling**: 9 levels with unique badges (Cat → Lion)
  - **EcoPoints**: Virtual currency for shop purchases
  - **Badge System**: Unlock badges as you level up
  - **Achievement Tracking**: Master Eco Warrior badge for completing all quests

- **📊 Progress Tracking**
  - Real-time XP and level progress bars
  - Category completion charts (Chart.js)
  - Carbon footprint reduction visualization
  - Quest completion statistics

- **🛒 Plant Shop & Collection**
  - Purchase virtual plants with EcoPoints
  -  Unique plants with rarity tiers (Common, Rare, Epic, Legendary)
  - Personal collection showcase
  - Plant selling system

- **👥 Social Features**
  - Global leaderboard ranked by XP
  - User profiles with statistics
  - Best rank tracking
  - **Team Collaboration System**
    - Create or join teams (up to 8 members)
    - 20+ collaborative team missions
    - Difficulty-based missions (Easy, Medium, Hard)
    - Dynamic rewards based on team size and participation
    - Mission cooldowns and daily limits
    - Team leaderboard and statistics

- **📱 Responsive Design**
  - Mobile-first approach
  - Smooth animations and transitions
  - Accessible UI with ARIA labels

### 🎨 User Experience

- **Modern UI/UX**: Clean, intuitive interface with smooth animations
- **Real-time Updates**: Instant feedback on quest completion
- **Visual Feedback**: Progress bars, charts, and badges
- **Accessibility**: WCAG-compliant design with screen reader support

---

## 🛠 Tech Stack

### Frontend
- **HTML5** - Semantic markup and structure
- **CSS3** - Modern styling with CSS variables, flexbox, and grid
- **JavaScript (ES6+)** - No frameworks, pure JavaScript
- **Chart.js** - Data visualization for progress tracking

### Backend & Services
- **Firebase Authentication** - Secure user authentication
- **Cloud Firestore** - Real-time database for user data and progress
- **Firebase Hosting** - Fast, secure hosting

### Development Tools
- **Firebase CLI** - Deployment and configuration
- **Modern Browser APIs** - LocalStorage, Fetch API, etc.

---

## 🎮 How It Works

### Quest System

1. **Daily Quests**: Users receive 5 random quests daily
2. **Quest Categories**: 
   - ♻️ Recycling
   - 💡 Energy Saving
   - 🚶 Transportation
   - 💧 Water Saving
   - 🧹 Clean-Up Missions
   - 🌱 Gardening & Nature
   - ♻️ Sustainable Living

3. **Quest Completion**: 
   - Select completed missions
   - Earn XP and EcoPoints
   - Track carbon footprint reduction
   - Unlock achievements

### Leveling System

| Level | XP Required | Badge |
|-------|-------------|-------|
| 1 | 0 XP | 🐱 Cat |
| 2 | 100 XP | 🦊 Fox |
| 3 | 250 XP | 🐰 Rabbit |
| 4 | 500 XP | 🦌 Deer |
| 5 | 1,000 XP | 🐺 Wolf |
| 6 | 2,500 XP | 🐻 Bear |
| 7 | 5,000 XP | 🦅 Eagle |
| 8 | 10,000 XP | 🐯 Tiger |
| 9 | 50,000 XP | 🦁 Lion |

### EcoPoints System

EcoPoints are earned based on:
- XP conversion (varies by level)
- Badge bonuses (+10 per badge)
- Quest completion bonuses
- Replay mode bonuses (up to 50% extra)

---

## 🔒 Security

- **Firebase Authentication**: Secure email/password authentication
- **Firestore Rules**: User data protection
  - Users can only read/write their own data
  - Leaderboard data is read-only for authenticated users
- **Input Validation**: Client-side validation for all forms
- **XSS Protection**: Input sanitization

---




## 👥 Team Collaboration System

EcoLudus features a comprehensive team system that allows users to collaborate on larger environmental challenges:

### Team Features
- **Team Creation & Management**
  - Create teams with custom names
  - Join teams via 6-character codes
  - Up to 8 members per team
  - Leader and co-leader roles
  - Team statistics tracking

- **Team Missions**
  - **20+ Mission Types** across 3 difficulty levels:
    - **Easy**: Quick wins (3-4 missions) - 210-280 XP, 120-170 EcoPoints
    - **Medium**: Moderate effort (2 missions) - 300-380 XP, 180-230 EcoPoints  
    - **Hard**: Significant impact (1 mission) - 500-600 XP, 300-360 EcoPoints
  - **Dynamic Rewards**: Rewards scale based on:
    - Team size (up to 15% bonus for full teams)
    - Difficulty level (1.0x to 1.5x multiplier)
    - Participation rate
  - **Mission Categories**: Recycling, Clean-Up, Transportation, Water Saving, Energy, Gardening, Sustainable Living
  - **Cooldown System**: Prevents mission spam with difficulty-based cooldowns
  - **Submission System**: Team members submit progress with reflections
  - **Approval Process**: Leaders review and approve completed missions

### Team Mission Examples
- **Easy**: Recycle 15 bottles, Clean shared area, Power down devices
- **Medium**: Sustainable commute, Water conservation, Local produce challenge
- **Hard**: Energy audit, Community garden, Zero waste week, Tree planting

### Team Limits
- Maximum 5 active missions at once
- Up to 8 missions per day
- Difficulty-based limits (3 Easy, 2 Medium, 1 Hard)
- 30-minute cooldown between submissions

---
