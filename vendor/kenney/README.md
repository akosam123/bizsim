# Kenney isometric tiles (CC0)

Source art for `scripts/build_city.py`. These are the raw packs the city is
generated FROM; the generated results already live in `assets/art/world/`, so
the game runs without regenerating anything. You only need these if you change
the city layout and re-run the generator.

    python3 scripts/build_city.py

Packs, all CC0 (public domain, no attribution required, commercial use fine),
from https://kenney.nl/assets :

  isometric-tiles-city        ground: roads, pavement, crossings, kerbs
  isometric-tiles-buildings   modular kit: ground floors, floor modules, roofs
  isometric-tiles-landscape   grass and water
  isometric-tiles-vehicles    cars, 16 rotations per colour
  isometric-roads             NOT USED - a different 100px grid that will not
                              line up with the 132px city tiles. Kept only so
                              nobody re-downloads it and tries again.
