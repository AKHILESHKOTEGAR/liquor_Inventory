# Graph Report - .  (2026-05-30)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 483 nodes · 597 edges · 31 communities (25 shown, 6 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Web Dashboard Pages|Web Dashboard Pages]]
- [[_COMMUNITY_Mobile App Screens|Mobile App Screens]]
- [[_COMMUNITY_Fastify API Routes|Fastify API Routes]]
- [[_COMMUNITY_Mobile Dependencies|Mobile Dependencies]]
- [[_COMMUNITY_API Dependencies|API Dependencies]]
- [[_COMMUNITY_Web Dependencies|Web Dependencies]]
- [[_COMMUNITY_Expo App Config|Expo App Config]]
- [[_COMMUNITY_Database Package|Database Package]]
- [[_COMMUNITY_Monorepo Config|Monorepo Config]]
- [[_COMMUNITY_System Architecture Concepts|System Architecture Concepts]]
- [[_COMMUNITY_Web TypeScript Config|Web TypeScript Config]]
- [[_COMMUNITY_Base TypeScript Config|Base TypeScript Config]]
- [[_COMMUNITY_Turborepo Pipeline|Turborepo Pipeline]]
- [[_COMMUNITY_Mobile App Entry + Audio|Mobile App Entry + Audio]]
- [[_COMMUNITY_Mobile UI Components|Mobile UI Components]]
- [[_COMMUNITY_API TypeScript Config|API TypeScript Config]]
- [[_COMMUNITY_Mobile TypeScript Config|Mobile TypeScript Config]]
- [[_COMMUNITY_Web Layout + Providers|Web Layout + Providers]]
- [[_COMMUNITY_DB TypeScript Config|DB TypeScript Config]]
- [[_COMMUNITY_Metro Bundler Config|Metro Bundler Config]]
- [[_COMMUNITY_Prisma Seed Script|Prisma Seed Script]]
- [[_COMMUNITY_Jest Config|Jest Config]]
- [[_COMMUNITY_Tailwind Config|Tailwind Config]]
- [[_COMMUNITY_Expo Devices|Expo Devices]]
- [[_COMMUNITY_Prisma Client|Prisma Client]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 15 edges
2. `compilerOptions` - 15 edges
3. `scripts` - 13 edges
4. `cn()` - 12 edges
5. `expo` - 12 edges
6. `useScanStore` - 9 edges
7. `LiquorSafe Setup Guide` - 9 edges
8. `Expo React Native Mobile App` - 9 edges
9. `scripts` - 7 edges
10. `tasks` - 6 edges

## Surprising Connections (you probably didn't know these)
- `Mobile App Favicon (dark navy, small web icon)` --references--> `Expo React Native Mobile App`  [EXTRACTED]
  apps/mobile/assets/favicon.png → SETUP.md
- `Mobile App Splash Screen (dark navy, portrait, blank placeholder)` --references--> `Expo React Native Mobile App`  [EXTRACTED]
  apps/mobile/assets/splash.png → SETUP.md
- `Mobile App Icon (dark navy, placeholder branding)` --references--> `Expo React Native Mobile App`  [EXTRACTED]
  apps/mobile/assets/icon.png → SETUP.md
- `Mobile App Adaptive Icon (dark navy, Android adaptive icon placeholder)` --references--> `Expo React Native Mobile App`  [EXTRACTED]
  apps/mobile/assets/adaptive-icon.png → SETUP.md
- `cn()` --calls--> `clsx`  [INFERRED]
  apps/web/lib/utils.ts → apps/web/package.json

## Communities (31 total, 6 thin omitted)

### Community 0 - "Web Dashboard Pages"
Cohesion: 0.05
Nodes (41): DiscrepancyMatrix(), MatrixRow, Props, Props, SessionCard(), nav, ROLE_COLORS, Sidebar() (+33 more)

### Community 1 - "Mobile App Screens"
Cohesion: 0.07
Nodes (38): MainTabParamList, MainTabs(), makeNavigation(), styles, TabName, TABS, HomeScreen(), Props (+30 more)

### Community 2 - "Fastify API Routes"
Cohesion: 0.09
Nodes (27): authenticate(), getAccessibleStoreIds(), JwtPayload, requireAdmin(), auditRoutes(), createSessionSchema, authRoutes(), boxRoutes() (+19 more)

### Community 3 - "Mobile Dependencies"
Cohesion: 0.06
Nodes (34): dependencies, axios, expo, expo-av, expo-camera, expo-file-system, expo-haptics, expo-image-picker (+26 more)

### Community 4 - "API Dependencies"
Cohesion: 0.06
Nodes (32): dependencies, bcryptjs, dotenv, fastify, @fastify/cors, @fastify/jwt, @fastify/multipart, @fastify/static (+24 more)

### Community 5 - "Web Dependencies"
Cohesion: 0.06
Nodes (32): dependencies, axios, clsx, date-fns, js-cookie, @liquor/db, lucide-react, next (+24 more)

### Community 6 - "Expo App Config"
Cohesion: 0.08
Nodes (25): backgroundColor, foregroundImage, adaptiveIcon, package, permissions, expo, android, icon (+17 more)

### Community 7 - "Database Package"
Cohesion: 0.08
Nodes (23): dependencies, bcryptjs, @prisma/client, devDependencies, prisma, ts-node, @types/bcryptjs, @types/node (+15 more)

### Community 8 - "Monorepo Config"
Cohesion: 0.09
Nodes (22): devDependencies, prettier, turbo, @types/node, typescript, name, packageManager, private (+14 more)

### Community 9 - "System Architecture Concepts"
Cohesion: 0.18
Nodes (19): Fastify API Server (localhost:3001), Mobile App Adaptive Icon (dark navy, Android adaptive icon placeholder), Mobile App Favicon (dark navy, small web icon), Mobile App Icon (dark navy, placeholder branding), Mobile App Splash Screen (dark navy, portrait, blank placeholder), /api/scan/batch-sync Endpoint, Blind Counting Design Pattern, Bottle Status State Machine (INWARDED → ON_SHELF → SOLD / DAMAGED) (+11 more)

### Community 10 - "Web TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 11 - "Base TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution (+8 more)

### Community 12 - "Turborepo Pipeline"
Cohesion: 0.12
Nodes (16): dependsOn, outputs, cache, persistent, cache, globalDependencies, outputs, $schema (+8 more)

### Community 13 - "Mobile App Entry + Audio"
Cohesion: 0.16
Nodes (8): Props, styles, NAV_THEME, RootStackParamList, Stack, loadSounds(), playErrorChime(), unloadSounds()

### Community 14 - "Mobile UI Components"
Cohesion: 0.22
Nodes (7): ExceptionMode, Props, styles, KEYS, NumericKeypad(), Props, styles

### Community 15 - "API TypeScript Config"
Cohesion: 0.22
Nodes (8): compilerOptions, module, moduleResolution, outDir, rootDir, exclude, extends, include

### Community 16 - "Mobile TypeScript Config"
Cohesion: 0.29
Nodes (6): compilerOptions, paths, strict, extends, include, @/*

### Community 17 - "Web Layout + Providers"
Cohesion: 0.40
Nodes (3): inter, metadata, Providers()

### Community 18 - "DB TypeScript Config"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 19 - "Metro Bundler Config"
Cohesion: 0.40
Nodes (4): config, { getDefaultConfig }, monorepoRoot, path

## Knowledge Gaps
- **274 isolated node(s):** `target`, `module`, `moduleResolution`, `lib`, `strict` (+269 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Web Dashboard Pages` to `Web Dependencies`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `clsx` connect `Web Dependencies` to `Web Dashboard Pages`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `target`, `module`, `moduleResolution` to the rest of the system?**
  _274 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Web Dashboard Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.05223880597014925 - nodes in this community are weakly interconnected._
- **Should `Mobile App Screens` be split into smaller, more focused modules?**
  _Cohesion score 0.06775510204081632 - nodes in this community are weakly interconnected._
- **Should `Fastify API Routes` be split into smaller, more focused modules?**
  _Cohesion score 0.09146341463414634 - nodes in this community are weakly interconnected._
- **Should `Mobile Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._