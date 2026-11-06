# BizSim 3D, live source

This is the 3D game as published on Oct 11, rebuilt as editable source. The original source was never
committed, so it was recovered from the published page:

- `game.js`: the whole game in one readable file (about 8,000 lines). Names match the originals wherever the
  code matched `src/game` and `web3d/src`; short names such as `Bt`, `F`, `Ka` mark code that only existed
  in the published build (the tutorial, growth panel, sound, shop interiors). Rename them freely as you read.
  It includes four embedded base64 sound effects near the top of the sound section.
- `template.html`: the page markup and CSS (HUD, panels, the tutorial coach box).
- `failsafe.html`: the "3D game couldn't start" fallback.
- `../build-live.mjs`: assembles them, plus the mentor button, into `web3d/dist/bizsim3d.html`.

```
npm run build:live                                   # mentor asks Claude directly (published claude.ai page)
MENTOR_URL=http://localhost:8787 npm run build:live  # mentor asks your server (npm run server)
```

`web3d/src/` and `web3d/build.mjs` are the older Oct 10 source. Until the two are merged, `web3d/live/` is the
one that matches what players see.

How it was verified: the recovered `game.js`, minified, is the same program as the published game
(same tokens, every variable binding identical), and the page `build-live.mjs` produces matches the
published page the same way.
