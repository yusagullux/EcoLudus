import sharp from "sharp";
import fs from "fs";
import path from "path";

// 512x512 crisp gamified SVG icons for chests with tier-themed backgrounds

const woodenChestSVG = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background Gradients & Filters -->
    <radialGradient id="bg-wood" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#386641"/>
      <stop offset="60%" stop-color="#1b4332"/>
      <stop offset="100%" stop-color="#081c15"/>
    </radialGradient>
    <radialGradient id="sunburst-wood" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#74c69d" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#74c69d" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="pedestal-wood" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#2d6a4f"/>
      <stop offset="100%" stop-color="#1b4332"/>
    </linearGradient>

    <!-- Chest Gradients -->
    <linearGradient id="wood-plank-lid" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#b07d4f"/>
      <stop offset="50%" stop-color="#8b5e34"/>
      <stop offset="100%" stop-color="#6c4625"/>
    </linearGradient>
    <linearGradient id="wood-plank-base" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#9a693b"/>
      <stop offset="100%" stop-color="#583a1d"/>
    </linearGradient>
    <linearGradient id="brass-trim" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffe169"/>
      <stop offset="40%" stop-color="#d4a373"/>
      <stop offset="100%" stop-color="#8c5e2b"/>
    </linearGradient>
    <linearGradient id="leaf-glow" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#b7e4c7"/>
      <stop offset="100%" stop-color="#52b788"/>
    </linearGradient>

    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#000000" flood-opacity="0.5"/>
    </filter>
    <filter id="glow-green" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- Card Background -->
  <rect x="16" y="16" width="480" height="480" rx="40" fill="url(#bg-wood)"/>
  <rect x="24" y="24" width="464" height="464" rx="32" fill="none" stroke="#52b788" stroke-width="3" stroke-opacity="0.3"/>
  <circle cx="256" cy="256" r="210" fill="url(#sunburst-wood)"/>

  <!-- Sunburst Rays -->
  <g opacity="0.12" stroke="#b7e4c7" stroke-width="16" stroke-linecap="round">
    <line x1="256" y1="256" x2="256" y2="40"/>
    <line x1="256" y1="256" x2="408" y2="104"/>
    <line x1="256" y1="256" x2="472" y2="256"/>
    <line x1="256" y1="256" x2="408" y2="408"/>
    <line x1="256" y1="256" x2="104" y2="408"/>
    <line x1="256" y1="256" x2="40" y2="256"/>
    <line x1="256" y1="256" x2="104" y2="104"/>
  </g>

  <!-- Floating Forest Leaves/Particles -->
  <g fill="#74c69d" opacity="0.6">
    <circle cx="100" cy="140" r="6"/>
    <circle cx="390" cy="120" r="8"/>
    <circle cx="420" cy="340" r="5"/>
    <circle cx="80" cy="360" r="7"/>
    <path d="M 120 180 Q 130 170 140 180 Q 130 190 120 180 Z" fill="#b7e4c7"/>
    <path d="M 360 280 Q 370 270 380 280 Q 370 290 360 280 Z" fill="#b7e4c7"/>
  </g>

  <!-- Pedestal -->
  <ellipse cx="256" cy="400" rx="170" ry="32" fill="#081c15" opacity="0.6"/>
  <path d="M 116 385 C 116 365 396 365 396 385 L 376 415 C 376 430 136 430 136 415 Z" fill="url(#pedestal-wood)"/>
  <ellipse cx="256" cy="385" rx="140" ry="20" fill="#40916c" opacity="0.7"/>

  <!-- CHEST GROUP WITH SHADOW -->
  <g filter="url(#shadow)">

    <!-- CHEST BASE -->
    <path d="M 112 250 L 124 370 C 124 380 136 388 152 388 L 360 388 C 376 388 388 380 388 370 L 400 250 Z" fill="url(#wood-plank-base)"/>

    <!-- Wood Grain Details Base -->
    <path d="M 140 260 Q 256 270 372 260" stroke="#3d2612" stroke-width="2" fill="none" opacity="0.6"/>
    <path d="M 135 310 Q 256 320 377 310" stroke="#3d2612" stroke-width="2" fill="none" opacity="0.6"/>
    <path d="M 130 350 Q 256 358 382 350" stroke="#3d2612" stroke-width="2" fill="none" opacity="0.6"/>

    <!-- Brass Straps Base -->
    <!-- Left Strap -->
    <path d="M 164 250 L 170 384 L 194 384 L 188 250 Z" fill="url(#brass-trim)"/>
    <circle cx="177" cy="270" r="3" fill="#3d2612"/>
    <circle cx="180" cy="320" r="3" fill="#3d2612"/>
    <circle cx="182" cy="365" r="3" fill="#3d2612"/>

    <!-- Right Strap -->
    <path d="M 324 250 L 318 384 L 342 384 L 348 250 Z" fill="url(#brass-trim)"/>
    <circle cx="335" cy="270" r="3" fill="#3d2612"/>
    <circle cx="332" cy="320" r="3" fill="#3d2612"/>
    <circle cx="330" cy="365" r="3" fill="#3d2612"/>

    <!-- Bottom Brass Corners -->
    <path d="M 118 340 L 124 370 C 124 380 136 388 152 388 L 160 388 L 156 340 Z" fill="url(#brass-trim)"/>
    <path d="M 394 340 L 388 370 C 388 380 376 388 360 388 L 352 388 L 356 340 Z" fill="url(#brass-trim)"/>

    <!-- CHEST LID (Domed Wood) -->
    <path d="M 96 250 C 96 160 416 160 416 250 C 416 260 404 265 388 265 L 124 265 C 108 265 96 260 96 250 Z" fill="url(#wood-plank-lid)"/>

    <!-- Lid Wood Grain -->
    <path d="M 120 220 Q 256 185 392 220" stroke="#3d2612" stroke-width="2.5" fill="none" opacity="0.6"/>
    <path d="M 110 240 Q 256 215 402 240" stroke="#3d2612" stroke-width="2.5" fill="none" opacity="0.6"/>

    <!-- Lid Brass Rim Rim -->
    <path d="M 96 248 C 96 258 108 265 124 265 L 388 265 C 404 265 416 258 416 248 L 416 256 C 416 266 404 273 388 273 L 124 273 C 108 273 96 266 96 256 Z" fill="url(#brass-trim)"/>

    <!-- Lid Brass Straps -->
    <path d="M 160 252 C 160 185 174 175 186 172 C 190 172 196 185 192 252 Z" fill="url(#brass-trim)"/>
    <path d="M 352 252 C 352 185 338 175 326 172 C 322 172 316 185 320 252 Z" fill="url(#brass-trim)"/>

    <!-- Top Metal Crest -->
    <path d="M 230 166 L 256 156 L 282 166 L 276 178 L 236 178 Z" fill="url(#brass-trim)"/>

    <!-- FRONT LOCK PLATE (Sprout Leaf Emblem) -->
    <g filter="url(#glow-green)">
      <rect x="226" y="238" width="60" height="70" rx="12" fill="url(#brass-trim)" stroke="#3d2612" stroke-width="3"/>
      <!-- Inner Dark Lock Surface -->
      <rect x="236" y="248" width="40" height="50" rx="8" fill="#2b1810"/>
      <!-- Leaf Keyhole Glow -->
      <path d="M 256 256 C 244 266 246 282 256 288 C 266 282 268 266 256 256 Z" fill="url(#leaf-glow)"/>
      <circle cx="256" cy="274" r="3" fill="#ffffff"/>
    </g>

  </g>
</svg>
`;

const bronzeChestSVG = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background Gradients -->
    <radialGradient id="bg-bronze" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#6c2e08"/>
      <stop offset="60%" stop-color="#3d1a04"/>
      <stop offset="100%" stop-color="#1a0a02"/>
    </radialGradient>
    <radialGradient id="sunburst-bronze" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#f4a261" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#f4a261" stop-opacity="0"/>
    </radialGradient>

    <!-- Bronze Metallic Gradients -->
    <linearGradient id="bronze-body" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#cd7f32"/>
      <stop offset="40%" stop-color="#a0522d"/>
      <stop offset="100%" stop-color="#5c2c16"/>
    </linearGradient>
    <linearGradient id="copper-trim" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffb703"/>
      <stop offset="50%" stop-color="#e76f51"/>
      <stop offset="100%" stop-color="#9b2226"/>
    </linearGradient>
    <radialGradient id="amber-gem" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="30%" stop-color="#ffb703"/>
      <stop offset="70%" stop-color="#fb8500"/>
      <stop offset="100%" stop-color="#d00000"/>
    </radialGradient>

    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
    <filter id="glow-amber" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="10" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- Card Background -->
  <rect x="16" y="16" width="480" height="480" rx="40" fill="url(#bg-bronze)"/>
  <rect x="24" y="24" width="464" height="464" rx="32" fill="none" stroke="#f4a261" stroke-width="3" stroke-opacity="0.35"/>
  <circle cx="256" cy="256" r="210" fill="url(#sunburst-bronze)"/>

  <!-- Sunburst Rays -->
  <g opacity="0.15" stroke="#ffb703" stroke-width="16" stroke-linecap="round">
    <line x1="256" y1="256" x2="256" y2="40"/>
    <line x1="256" y1="256" x2="408" y2="104"/>
    <line x1="256" y1="256" x2="472" y2="256"/>
    <line x1="256" y1="256" x2="408" y2="408"/>
    <line x1="256" y1="256" x2="104" y2="408"/>
    <line x1="256" y1="256" x2="40" y2="256"/>
    <line x1="256" y1="256" x2="104" y2="104"/>
  </g>

  <!-- Ember Sparkles -->
  <g fill="#ffb703" opacity="0.7">
    <circle cx="110" cy="130" r="5"/>
    <circle cx="380" cy="110" r="7"/>
    <circle cx="410" cy="360" r="6"/>
    <circle cx="90" cy="340" r="8"/>
    <polygon points="256,70 260,82 272,86 260,90 256,102 252,90 240,86 252,82"/>
  </g>

  <!-- Pedestal -->
  <ellipse cx="256" cy="400" rx="170" ry="32" fill="#1a0a02" opacity="0.7"/>
  <path d="M 116 385 C 116 365 396 365 396 385 L 376 415 C 376 430 136 430 136 415 Z" fill="#5c2c16"/>
  <ellipse cx="256" cy="385" rx="140" ry="20" fill="#a0522d" opacity="0.8"/>

  <!-- CHEST GROUP -->
  <g filter="url(#shadow)">

    <!-- CHEST BASE -->
    <path d="M 112 250 L 124 370 C 124 380 136 388 152 388 L 360 388 C 376 388 388 380 388 370 L 400 250 Z" fill="url(#bronze-body)"/>

    <!-- Copper Reinforced Edges Base -->
    <path d="M 112 250 L 124 370 L 148 370 L 138 250 Z" fill="url(#copper-trim)"/>
    <path d="M 400 250 L 388 370 L 364 370 L 374 250 Z" fill="url(#copper-trim)"/>

    <!-- Horizontal Copper Band Base -->
    <path d="M 120 300 Q 256 312 392 300 L 390 320 Q 256 332 122 320 Z" fill="url(#copper-trim)"/>
    <circle cx="160" cy="310" r="4" fill="#3d1a04"/>
    <circle cx="352" cy="310" r="4" fill="#3d1a04"/>

    <!-- CHEST LID -->
    <path d="M 96 250 C 96 150 416 150 416 250 C 416 260 404 265 388 265 L 124 265 C 108 265 96 260 96 250 Z" fill="url(#bronze-body)"/>

    <!-- Copper Lid Border -->
    <path d="M 96 245 C 96 258 108 265 124 265 L 388 265 C 404 265 416 258 416 245 C 416 255 404 272 388 272 L 124 272 C 108 272 96 255 96 245 Z" fill="url(#copper-trim)"/>

    <!-- Copper Arch Straps -->
    <path d="M 150 250 C 150 175 170 165 186 162 L 202 165 C 186 175 174 250 174 250 Z" fill="url(#copper-trim)"/>
    <path d="M 362 250 C 362 175 342 165 326 162 L 310 165 C 326 175 338 250 338 250 Z" fill="url(#copper-trim)"/>

    <!-- Top Bronze Shield Emblem -->
    <path d="M 230 160 L 256 142 L 282 160 L 274 175 L 238 175 Z" fill="url(#copper-trim)"/>

    <!-- FRONT LOCK PLATE & AMBER GEMSTONE -->
    <g filter="url(#glow-amber)">
      <polygon points="256,220 296,255 284,310 228,310 216,255" fill="url(#copper-trim)" stroke="#3d1a04" stroke-width="3"/>
      <!-- Inner Dark Lock -->
      <polygon points="256,232 284,258 274,298 238,298 228,258" fill="#240e03"/>
      <!-- Amber Gem -->
      <polygon points="256,242 272,265 256,288 240,265" fill="url(#amber-gem)"/>
      <circle cx="252" cy="255" r="3" fill="#ffffff" opacity="0.8"/>
    </g>

  </g>
</svg>
`;

const silverChestSVG = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background Gradients -->
    <radialGradient id="bg-silver" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#1b263b"/>
      <stop offset="60%" stop-color="#0d1b2a"/>
      <stop offset="100%" stop-color="#04080f"/>
    </radialGradient>
    <radialGradient id="sunburst-silver" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#48cae4" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#48cae4" stop-opacity="0"/>
    </radialGradient>

    <!-- Silver Metallic Gradients -->
    <linearGradient id="silver-body" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="35%" stop-color="#e0e1dd"/>
      <stop offset="70%" stop-color="#778da9"/>
      <stop offset="100%" stop-color="#415a77"/>
    </linearGradient>
    <linearGradient id="blue-steel-trim" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#90e0ef"/>
      <stop offset="50%" stop-color="#00b4d8"/>
      <stop offset="100%" stop-color="#0077b6"/>
    </linearGradient>
    <radialGradient id="sapphire-gem" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="30%" stop-color="#90e0ef"/>
      <stop offset="70%" stop-color="#0077b6"/>
      <stop offset="100%" stop-color="#03045e"/>
    </radialGradient>

    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
    <filter id="glow-sapphire" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="12" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- Card Background -->
  <rect x="16" y="16" width="480" height="480" rx="40" fill="url(#bg-silver)"/>
  <rect x="24" y="24" width="464" height="464" rx="32" fill="none" stroke="#90e0ef" stroke-width="3" stroke-opacity="0.4"/>
  <circle cx="256" cy="256" r="210" fill="url(#sunburst-silver)"/>

  <!-- Sunburst Rays -->
  <g opacity="0.18" stroke="#48cae4" stroke-width="16" stroke-linecap="round">
    <line x1="256" y1="256" x2="256" y2="40"/>
    <line x1="256" y1="256" x2="408" y2="104"/>
    <line x1="256" y1="256" x2="472" y2="256"/>
    <line x1="256" y1="256" x2="408" y2="408"/>
    <line x1="256" y1="256" x2="104" y2="408"/>
    <line x1="256" y1="256" x2="40" y2="256"/>
    <line x1="256" y1="256" x2="104" y2="104"/>
  </g>

  <!-- Ice Crystal Sparkles -->
  <g fill="#90e0ef" opacity="0.8">
    <circle cx="100" cy="130" r="6"/>
    <circle cx="390" cy="110" r="8"/>
    <circle cx="420" cy="350" r="6"/>
    <circle cx="85" cy="350" r="7"/>
    <!-- Diamond Stars -->
    <polygon points="256,60 262,76 278,82 262,88 256,104 250,88 234,82 250,76"/>
    <polygon points="360,260 364,270 374,274 364,278 360,288 356,278 346,274 356,270"/>
  </g>

  <!-- Pedestal -->
  <ellipse cx="256" cy="400" rx="170" ry="32" fill="#04080f" opacity="0.7"/>
  <path d="M 116 385 C 116 365 396 365 396 385 L 376 415 C 376 430 136 430 136 415 Z" fill="#1b263b"/>
  <ellipse cx="256" cy="385" rx="140" ry="20" fill="#415a77" opacity="0.8"/>

  <!-- CHEST GROUP -->
  <g filter="url(#shadow)">

    <!-- CHEST BASE -->
    <path d="M 112 250 L 124 370 C 124 380 136 388 152 388 L 360 388 C 376 388 388 380 388 370 L 400 250 Z" fill="url(#silver-body)"/>

    <!-- Blue Steel Corner Armor Base -->
    <path d="M 112 250 L 124 370 L 154 370 L 142 250 Z" fill="url(#blue-steel-trim)"/>
    <path d="M 400 250 L 388 370 L 358 370 L 370 250 Z" fill="url(#blue-steel-trim)"/>

    <!-- Central Blue Steel Band Base -->
    <path d="M 120 300 Q 256 312 392 300 L 390 324 Q 256 336 122 324 Z" fill="url(#blue-steel-trim)"/>
    <circle cx="160" cy="312" r="4" fill="#ffffff"/>
    <circle cx="352" cy="312" r="4" fill="#ffffff"/>

    <!-- CHEST LID -->
    <path d="M 96 250 C 96 145 416 145 416 250 C 416 260 404 265 388 265 L 124 265 C 108 265 96 260 96 250 Z" fill="url(#silver-body)"/>

    <!-- Blue Steel Rim Rim -->
    <path d="M 96 245 C 96 258 108 265 124 265 L 388 265 C 404 265 416 258 416 245 C 416 255 404 274 388 274 L 124 274 C 108 274 96 255 96 245 Z" fill="url(#blue-steel-trim)"/>

    <!-- Blue Steel Lid Straps -->
    <path d="M 152 250 C 152 172 172 162 188 158 L 204 162 C 188 172 176 250 176 250 Z" fill="url(#blue-steel-trim)"/>
    <path d="M 360 250 C 360 172 340 162 324 158 L 308 162 C 324 172 336 250 336 250 Z" fill="url(#blue-steel-trim)"/>

    <!-- Top Silver Crest -->
    <path d="M 230 156 L 256 138 L 282 156 L 274 172 L 238 172 Z" fill="url(#blue-steel-trim)"/>

    <!-- FRONT LOCK PLATE & SAPPHIRE GEM -->
    <g filter="url(#glow-sapphire)">
      <rect x="222" y="224" width="68" height="80" rx="16" fill="url(#blue-steel-trim)" stroke="#0d1b2a" stroke-width="3"/>
      <!-- Inner Dark Lock Surface -->
      <rect x="232" y="234" width="48" height="60" rx="10" fill="#03045e"/>
      <!-- Sapphire Gemstone -->
      <polygon points="256,242 274,264 256,286 238,264" fill="url(#sapphire-gem)"/>
      <circle cx="250" cy="254" r="4" fill="#ffffff"/>
    </g>

  </g>
</svg>
`;

const goldenChestSVG = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background Gradients -->
    <radialGradient id="bg-gold" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#543705"/>
      <stop offset="60%" stop-color="#2c1a00"/>
      <stop offset="100%" stop-color="#120a00"/>
    </radialGradient>
    <radialGradient id="sunburst-gold" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffe169" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#ffe169" stop-opacity="0"/>
    </radialGradient>

    <!-- Gold Metallic Gradients -->
    <linearGradient id="gold-body" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fff3b0"/>
      <stop offset="30%" stop-color="#ffc300"/>
      <stop offset="70%" stop-color="#e3a008"/>
      <stop offset="100%" stop-color="#996515"/>
    </linearGradient>
    <linearGradient id="gold-accent-trim" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="40%" stop-color="#ffd60a"/>
      <stop offset="100%" stop-color="#d48806"/>
    </linearGradient>
    <radialGradient id="emerald-gem" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="30%" stop-color="#74c69d"/>
      <stop offset="70%" stop-color="#2d6a4f"/>
      <stop offset="100%" stop-color="#081c15"/>
    </radialGradient>

    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000000" flood-opacity="0.7"/>
    </filter>
    <filter id="glow-gold" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="14" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- Card Background -->
  <rect x="16" y="16" width="480" height="480" rx="40" fill="url(#bg-gold)"/>
  <rect x="24" y="24" width="464" height="464" rx="32" fill="none" stroke="#ffd60a" stroke-width="3" stroke-opacity="0.5"/>
  <circle cx="256" cy="256" r="215" fill="url(#sunburst-gold)"/>

  <!-- Sunburst Rays -->
  <g opacity="0.25" stroke="#ffc300" stroke-width="18" stroke-linecap="round">
    <line x1="256" y1="256" x2="256" y2="40"/>
    <line x1="256" y1="256" x2="408" y2="104"/>
    <line x1="256" y1="256" x2="472" y2="256"/>
    <line x1="256" y1="256" x2="408" y2="408"/>
    <line x1="256" y1="256" x2="104" y2="408"/>
    <line x1="256" y1="256" x2="40" y2="256"/>
    <line x1="256" y1="256" x2="104" y2="104"/>
  </g>

  <!-- Golden Magic Sparkles -->
  <g fill="#fff3b0" opacity="0.95">
    <circle cx="95" cy="125" r="7"/>
    <circle cx="395" cy="105" r="9"/>
    <circle cx="425" cy="345" r="7"/>
    <circle cx="80" cy="345" r="8"/>
    <!-- Big Golden Stars -->
    <polygon points="256,50 264,70 286,76 264,82 256,102 248,82 226,76 248,70"/>
    <polygon points="120,240 125,250 136,254 125,258 120,268 115,258 104,254 115,250"/>
    <polygon points="390,230 395,240 406,244 395,248 390,258 385,248 374,244 385,240"/>
  </g>

  <!-- Pedestal -->
  <ellipse cx="256" cy="400" rx="175" ry="34" fill="#120a00" opacity="0.75"/>
  <path d="M 114 385 C 114 365 398 365 398 385 L 378 416 C 378 432 134 432 134 416 Z" fill="#543705"/>
  <ellipse cx="256" cy="385" rx="142" ry="20" fill="#ffc300" opacity="0.85"/>

  <!-- CHEST GROUP -->
  <g filter="url(#shadow)">

    <!-- CHEST BASE -->
    <path d="M 110 248 L 122 370 C 122 382 136 390 152 390 L 360 390 C 376 390 390 382 390 370 L 402 248 Z" fill="url(#gold-body)"/>

    <!-- Royal Ornate Corner Straps Base -->
    <path d="M 110 248 L 122 370 L 156 370 L 144 248 Z" fill="url(#gold-accent-trim)"/>
    <path d="M 402 248 L 390 370 L 356 370 L 368 248 Z" fill="url(#gold-accent-trim)"/>

    <!-- Horizontal Gold Band Base -->
    <path d="M 118 298 Q 256 310 394 298 L 392 322 Q 256 334 120 322 Z" fill="url(#gold-accent-trim)"/>
    <circle cx="160" cy="310" r="5" fill="#7a4300"/>
    <circle cx="352" cy="310" r="5" fill="#7a4300"/>

    <!-- CHEST LID -->
    <path d="M 92 248 C 92 138 420 138 420 248 C 420 260 406 266 390 266 L 122 266 C 106 266 92 260 92 248 Z" fill="url(#gold-body)"/>

    <!-- Gold Lid Border -->
    <path d="M 92 243 C 92 256 106 266 122 266 L 390 266 C 406 266 420 256 420 243 C 420 255 406 276 390 276 L 122 276 C 106 276 92 255 92 243 Z" fill="url(#gold-accent-trim)"/>

    <!-- Gold Arch Straps -->
    <path d="M 150 248 C 150 168 172 158 188 154 L 206 158 C 190 168 178 248 178 248 Z" fill="url(#gold-accent-trim)"/>
    <path d="M 362 248 C 362 168 340 158 324 154 L 306 158 C 322 168 334 248 334 248 Z" fill="url(#gold-accent-trim)"/>

    <!-- Crowned Top Gold Emblem -->
    <path d="M 226 150 L 256 130 L 286 150 L 276 168 L 236 168 Z" fill="url(#gold-accent-trim)"/>
    <circle cx="256" cy="144" r="5" fill="#ffffff"/>

    <!-- FRONT LOCK PLATE & EMERALD ECO-GEM -->
    <g filter="url(#glow-gold)">
      <polygon points="256,214 302,250 290,314 222,314 210,250" fill="url(#gold-accent-trim)" stroke="#543705" stroke-width="3"/>
      <!-- Inner Dark Lock Plate -->
      <polygon points="256,226 288,252 278,300 234,300 224,252" fill="#2c1a00"/>
      <!-- Emerald Gem -->
      <polygon points="256,236 276,262 256,288 236,262" fill="url(#emerald-gem)"/>
      <circle cx="250" cy="252" r="4" fill="#ffffff"/>
    </g>

  </g>
</svg>
`;

const outputDir = path.join(process.cwd(), "public", "images", "chests");

async function main() {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const items = [
    { name: "wooden-chest.png", svg: woodenChestSVG },
    { name: "bronze-chest.png", svg: bronzeChestSVG },
    { name: "silver-chest.png", svg: silverChestSVG },
    { name: "golden-chest.png", svg: goldenChestSVG }
  ];

  for (const item of items) {
    const dest = path.join(outputDir, item.name);
    await sharp(Buffer.from(item.svg))
      .resize(512, 512)
      .png()
      .toFile(dest);
    console.log(`Generated ${item.name} (${fs.statSync(dest).size} bytes)`);
  }
}

main().catch(console.error);
