// Flat ESLint config. Next 16 removed `next lint`; this is the direct ESLint
// setup. eslint-config-next@16 ships a flat-config array export, which we
// spread in directly (no @eslint/eslintrc FlatCompat needed).
//
// The codebase still has files with `@ts-nocheck` and liberal `any` (being
// cleaned up in Phase 4), so typescript-eslint's type-aware rules are kept off
// — enough to catch unused vars and Next-specific footguns without a wall of
// errors. CI fails on errors only; warnings surface locally.

import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
// eslint-plugin-react-hooks v7 (React 19) is a transitive dep of next; register
// it explicitly so our override block can reference its rules. core-web-vitals
// declares the plugin in its own config object, but plugin scope in flat config
// does not carry into sibling override blocks.
import reactHooks from "eslint-plugin-react-hooks";

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "docs/**",
      "ecoquest/**",
      "legacy/**",
      "supabase/**",
      "scripts/**",
      "tsconfig.tsbuildinfo"
    ]
  },
  ...nextCoreWebVitals,
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      // Downgrade noisy / premature rules so CI (fails on errors only) stays green.
      "react/no-unescaped-entities": "off",
      "@next/next/no-img-element": "warn",
      // React 19's compiler-style rules (purity / set-state-in-effect /
      // immutability / refs) flag patterns in the older page files that Phase 4
      // will rewrite. Downgrade to warnings for now; the rewrites can ratchet
      // these back to errors.
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn"
    }
  }
];

export default config;