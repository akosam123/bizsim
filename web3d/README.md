# BizSim 3D (web prototype)

A walkable 3D front end for BizSim. It reuses the real game engine in `../src/game`
(economy, decision cards, rivals, 24-month run) and swaps the menus for a
neighbourhood you walk around: your shop (floor, back room, office) on Main St,
the Oak Ave intersection with working traffic lights, City Hall, the apartments,
the bank, the gym, a café, the supply depot, row houses, a construction site, the
market square, a court and a diner. Every recurring character lives somewhere on
the map and walks over when they need a decision.

Controls: WASD or tap to walk, Shift to run, drag to look, E to talk/use,
M for the map (fast travel), V for first person, B for the books.

- `src/world.ts`: your shop and its interiors per business, lighting, sky, time of day, seasons
- `src/city.ts`: the neighbourhood: buildings, streets, props, signals
- `src/cars.ts`: vehicle models
- `src/textures.ts`: procedural textures with normal maps, sky shader
- `src/batch.ts`: static mesh batching
- `src/jsm/`: three.js post-processing passes (MIT), bundled
- `src/people.ts`: jointed characters, walk/run cycle, sitting, gestures
- `src/main.ts`: game loop, month flow, talking to people, activities, camera, input
- `src/ui.ts`: HUD, dialogue cards, books, recap, setup and end screens
- `src/nav.ts`: walkability grid and A* pathfinding

Build: `node build.mjs` (needs esbuild) writes `dist/bizsim3d.html`, a single page
that loads three.js 0.160.0 from jsDelivr.
