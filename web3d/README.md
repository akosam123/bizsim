# BizSim 3D (web prototype)

A walkable 3D front end for BizSim. It reuses the real game engine in `../src/game`
(economy, decision cards, rivals, 24-month run) and swaps the menus for a block you
walk around: your shop (floor, back room, office), the bank, Marcus's gym, the
storefront across the street, and a market square.

- `src/world.ts`: the block, the shop interiors per business, lighting, time of day, seasons
- `src/people.ts`: low-poly characters, walk cycle, sitting
- `src/main.ts`: game loop, month flow, talking to people, activities, camera, input
- `src/ui.ts`: HUD, dialogue cards, books, recap, setup and end screens
- `src/nav.ts`: walkability grid and A* pathfinding

Build: `node build.mjs` (needs esbuild) writes `dist/bizsim3d.html`, a single page
that loads three.js 0.160.0 from jsDelivr.
