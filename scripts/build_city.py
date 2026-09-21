#!/usr/bin/env python3
"""Build the city ground plate from Kenney's CC0 isometric tiles.

The point of this script is that the ground and everything standing on it come
out of ONE grid. Previously the roads existed only as pixels in a painted JPEG
while placements were hand-typed coordinates, so the two drifted apart and
props ended up sitting in the middle of the road. Here a cell is either road,
pavement, grass or a building plot, and both the image and the layout JSON are
derived from that same table -- a prop cannot land on a road because the plot
list never contains a road cell.

Tiles: kenney isometric-tiles-city / isometric-tiles-landscape (CC0).
Geometry: 132x66 top face, 2:1 isometric, 34px skirt below the diamond.
"""
import io
import json
import os
import sys
from PIL import Image

# The source tiles are vendored into the repo so the generator works on a
# fresh clone. Override with KENNEY_DIR if you keep them elsewhere.
KENNEY = os.environ.get(
    'KENNEY_DIR',
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'vendor', 'kenney'),
)
OUT_IMG = 'assets/art/world/city-ground.jpg'
OUT_JSON = 'src/game/cityLayout.json'
OUT_BLD = 'assets/art/world/kenney'

TW, TH, SKIRT = 132, 66, 34          # tile width, top-face height, skirt depth
GRID = 96                            # cells per axis (8 blocks of 12)
WORLD_W, WORLD_H = 5120, 2880        # the rectangle we crop out of the diamond

CITY = KENNEY + '/isometric-tiles-city/PNG/cityTiles_%03d.png'
LAND = KENNEY + '/isometric-tiles-landscape/PNG/landscapeTiles_%03d.png'

PAVE, ASPHALT, CROSSING, TREE = 72, 80, 64, 67
GRASS, WATER = 15, 35

# A 9-cell block left only a 3x3 interior once roads (2) and the two-deep
# pavement (2 per side) were taken out, so blocks held a tiny huddle of
# buildings adrift in empty paving. 12 gives a 6x6 interior: proper street
# frontage all the way round with a courtyard behind.
BLOCK = 12       # road every BLOCK cells
ROAD_W = 2       # road is this many cells wide

BUILDINGS = KENNEY + '/isometric-tiles-buildings/PNG/buildingTiles_%03d.png'
DETAILS = KENNEY + '/isometric-tiles-city/Details/cityDetails_%03d.png'
CARS = KENNEY + '/isometric-tiles-vehicles/PNG/Civilian/%s/Sedan 1/car%s2_%03d.png'

STOREY = 36          # measured: the vertical wall band of a building tile
TREE, LAMP_A, LAMP_B = 10, 5, 6

# Cars: 16 renders per colour, and TWO awkward facts about them.
#
# 1. The rotation spacing is NOT uniform -- the two end-on views (the car
#    foreshortened to a ~17px slab) sit 10 frames apart, not 8 -- so the four
#    isometric headings are NOT {F, F+4, F+8, F+12}. Each heading is picked
#    independently by ROTATING CALIPERS: the direction of a frame's maximum
#    silhouette extent is its length axis (second moments are useless, the body
#    is too chunky), and the winner is the frame nearest that road's screen
#    angle -- 26.57 deg for se/nw, 153.43 for sw/ne. All four land within 6.6
#    deg; an earlier sw pick was 15.6 deg out and read as driving sideways.
# 2. Each COLOUR starts at a different angle, so one shared map is only right
#    for the colour it was calibrated on. endon_frame() measures the phase.
# ONE frame per ROAD AXIS: everything on the se/nw axis shares a sprite, and
# everything on the sw/ne axis shares the other.
# Every frame here must be a genuine 3/4 ISOMETRIC view -- one that shows the
# roof. Several frames in the pack are flat SIDE ELEVATIONS (wheels in a line,
# no roof, like a 2D platformer car) and look wrong in an isometric city however
# well their angle matches. The tell is silhouette height/width: a 3/4 view is
# ~0.91-0.97, a side elevation ~0.74, a degenerate end-on view 1.29. Exactly
# four frames qualify -- 0, 2, 6, 12 -- which is one per heading.
#
# Which of a pair faces which way is not measurable (front vs rear differs by
# 121 vs 107 glass pixels, i.e. noise); both pairs were settled by observation:
# sharing frame 2 across se/nw left se looking reversed, so 2 faces nw and 0
# faces se. Likewise 6 faces ne and 12 faces sw.
# Axis decided by measuring the silhouette's extent along ONLY the two road
# directions and taking the longer -- no max-extent search, which reports the
# silhouette's diagonal instead of the car's length. Frames 0 and 2 lie along
# se/nw (ratios 1.34, 1.30); 12 and 6 lie along sw/ne (1.33, 1.32).
# Facing within each pair came from observation: frame 2 reads as nw, 6 as ne.
# Settled by RENDERING all four candidate frames onto a real road and looking:
# on the se road (descending to the right) frames 6 and 12 lie along it and
# 0/2 sit across it; on the sw road it is the reverse. Every automated angle
# test I tried got this backwards -- a boxy car's silhouette is wider ACROSS
# than along once projected, so extent-based measures point 90 degrees out.
CAR_FRAMES = {'se': 0, 'nw': 2, 'sw': 12, 'ne': 6}   # measured on Blue
CAR_REFERENCE_ENDON = 4                              # Blue's first end-on frame
CAR_COLOURS = [('Blue', 'Blue'), ('Red', 'Red'), ('Silver', 'Silver'), ('Black', 'Black')]

# WHERE YOUR SHOP STANDS depends on the location you picked at setup, so
# choosing "Suburb" actually puts you in the suburbs rather than dropping every
# player on the same downtown corner. One cluster per location: your shop, the
# bank you'd walk to, a vacant unit and the local rival.
#
# Cells for ALL THREE clusters are reserved, because the city is generated once
# and serves every save. The two clusters you aren't using read as vacant lots.
# Each cluster sits on a block with real clearance from the map edge. The
# suburb used to be on the far grid corner, which lands at the bottom tip of
# the isometric diamond -- only 251px of world below it, so the camera could
# not scroll far enough to show the shop properly.
LANDMARK_SETS = {
    'high':    {  # Downtown        block (3, 3), centre (2626, 1210)
        'enter': (40, 40), 'bankdoor': (45, 40),
        'expand': (40, 45), 'rival': (45, 45),
    },
    'average': {  # Suburb          block (4, 4), centre (2626, 2002)
        'enter': (52, 52), 'bankdoor': (57, 52),
        'expand': (52, 57), 'rival': (57, 57),
    },
    'low':     {  # Quiet Town      block (3, 4), centre (1834, 1606)
        'enter': (40, 52), 'bankdoor': (45, 52),
        'expand': (40, 57), 'rival': (45, 57),
    },
}

# The other trades, spread over the remaining well-clear frontage.
SHARED_LANDMARKS = {
    'expand2': (54, 40),
    'biz-a': (52, 40),
    'biz-b': (57, 45),
    'biz-c': (43, 40),
    'biz-d': (52, 55),
}

# Namespaced, because all three clusters use the same key names. A plain
# .update() let each location overwrite the last, so only ONE cluster ended up
# in RESERVED / LANDMARK_BLOCKS / validate_landmarks -- the other two were
# unreserved (generated buildings landed on them), unvalidated, and free to
# have a park dropped on top.
LANDMARKS = dict(SHARED_LANDMARKS)
for _loc, _cells in LANDMARK_SETS.items():
    for _name, _cell in _cells.items():
        LANDMARKS['%s:%s' % (_loc, _name)] = _cell
LANDMARK_BLOCKS = {(c // BLOCK, r // BLOCK) for c, r in LANDMARKS.values()}
RESERVED = set(LANDMARKS.values())


def validate_landmarks():
    for name, (c, r) in LANDMARKS.items():
        cb, rb = c % BLOCK, r % BLOCK
        problems = []
        if is_road(c, r):
            problems.append('on a road')
        if is_pavement(c, r):
            problems.append('on the pavement')
        if in_park(c, r):
            problems.append('in a park')
        if not (cb in FRONTAGE or rb in FRONTAGE):
            problems.append('not on a block frontage')
        if problems:
            raise SystemExit(
                'LANDMARKS[%r] = (%d, %d) [mod (%d, %d)] is %s. '
                'Move it to a frontage cell: mod values %s with the other axis in 4..6.'
                % (name, c, r, cb, rb, ' and '.join(problems), FRONTAGE)
            )

# Each district draws from one set, so a block reads as built together instead
# of a row of unrelated styles. Indices picked off the pack's contact sheet.
# One recipe per district: a ground floor, the floor module stacked above it,
# and a roof cap -- so every building on a block is built from the same kit
# pieces and reads as one family.
DISTRICT_RECIPES = {
    #              ground        module     roof     floors
    'commercial':  ([4, 12, 20, 26], [0, 8],  [57, 59], (1, 3)),
    'financial':   ([2, 3, 9, 17],   [0, 8],  [57, 59], (6, 14)),
    'residential': ([22, 29, 30, 37], [15, 16], [59, 61], (1, 4)),
    'suburbs':     ([40, 46],        [15],    [61, 63], (0, 0)),   # small houses
}

REMOVE_CARS = False   # set True to strip all traffic out of the city

_cache = {}


def block_of(c, r):
    return c // BLOCK, r // BLOCK


def is_park_block(bc, br):
    """Parks are spread over the whole map, not gathered in one corner."""
    if (bc, br) in LANDMARK_BLOCKS:
        return False                    # a park here would put a shop on grass
    if (bc, br) in {(4, 4), (4, 5)}:
        return True                     # the big central park
    # A suburb is mostly green: roughly one block in three is a park out here,
    # against one in seven in the built-up districts.
    if bc >= 4 and br >= 4:
        return (bc * 3 + br * 5) % 3 == 0
    return (bc * 3 + br * 5) % 7 == 0


def is_road(c, r):
    return (c % BLOCK) < ROAD_W or (r % BLOCK) < ROAD_W


def is_junction(c, r):
    return (c % BLOCK) < ROAD_W and (r % BLOCK) < ROAD_W


PAVE_CELLS = (ROAD_W, ROAD_W + 1, BLOCK - 2, BLOCK - 1)   # 2, 3, 10, 11
FRONTAGE = (ROAD_W + 2, BLOCK - 3)                        # 4, 9


def is_pavement(c, r):
    """The footpath: TWO cells deep between the road and the building line.

    A one-cell pavement put pedestrians hard against the buildings, where a
    132px-wide facade reaches the next cell's centre and swallows them. Two
    cells give people a lane of their own with daylight either side.
    """
    if is_road(c, r):
        return False
    return (c % BLOCK) in PAVE_CELLS or (r % BLOCK) in PAVE_CELLS


def in_park(c, r):
    """A park fills a block interior, with the streets running around it."""
    if is_road(c, r):
        return False
    return is_park_block(*block_of(c, r))


def tile(path, n):
    key = (path, n)
    if key not in _cache:
        _cache[key] = Image.open(path % n).convert('RGBA')
    return _cache[key]


def cell_art(c, r):
    """(source, index) for a cell's ground tile."""
    if in_park(c, r):
        if is_pavement(c, r):
            return CITY, PAVE           # a path around the edge of the park
        bc, br = block_of(c, r)
        if (bc, br) == (5, 5) and (c % BLOCK) in (4, 5) and (r % BLOCK) in (4, 5):
            return LAND, WATER          # pond in the big park
        return LAND, GRASS
    # Out in the suburbs the inner half of the footpath is a green verge, so
    # houses sit behind gardens rather than flush against the pavement.
    if (not is_road(c, r) and block_of(c, r)[0] >= 5 and block_of(c, r)[1] >= 5
            and ((c % BLOCK) in (ROAD_W + 1, BLOCK - 2) or (r % BLOCK) in (ROAD_W + 1, BLOCK - 2))):
        return LAND, GRASS
    if is_road(c, r):
        # Solid asphalt for the carriageway. The pack's dashed tiles are narrow
        # strips that read as railway track at city scale, so the road body is
        # plain and crossings mark the approach to each junction.
        if not is_junction(c, r) and (is_junction(c + 1, r) or is_junction(c - 1, r)
                                      or is_junction(c, r + 1) or is_junction(c, r - 1)):
            return CITY, CROSSING
        return CITY, ASPHALT
    return CITY, PAVE


def district(c, r):
    """Which quarter of the VISIBLE MAP a cell falls in.

    Grid quadrants are the wrong basis: in an isometric projection the far
    grid corner maps to the bottom tip of the diamond, which is off the
    rectangle we crop. Using screen position instead means every district
    actually sits somewhere you can look at.
    """
    ox = WORLD_W // 2
    oy = WORLD_H // 2 - (GRID - 1) * (TH // 2)
    sx, sy = iso(c, r)
    x, y = ox + sx + TW // 2, oy + sy + TH + SKIRT
    west, north = x < WORLD_W / 2, y < WORLD_H / 2
    if west and north:
        return 'commercial'
    if not west and north:
        return 'financial'
    if west and not north:
        return 'residential'
    return 'suburbs'


# HOW THE KIT FITS TOGETHER
#
# isometric-tiles-buildings is a modular kit, not a set of finished buildings,
# and its three parts are identifiable by footprint:
#   132x127  ground floor -- a shopfront box standing on a wide plinth
#   99x85    floor module -- a plain storey, no plinth
#   99x54-63 roof cap
# A building is ground + N modules + roof. The earlier attempt repeated the
# GROUND tile's wall band instead, which copied its awning up every floor and
# produced the striped, sliced look.
import numpy as _np


def _widths(im):
    alpha = _np.asarray(im)[..., 3] > 8
    return [int(alpha[y].sum()) for y in range(im.height)]


def _widest_band(im):
    """(firstRow, lastRow) of the silhouette's widest run -- a box's corners."""
    w = _widths(im)
    mx = max(w)
    rows = [y for y, v in enumerate(w) if v >= mx - 1]
    return rows[0], rows[-1]


def ground_top(im):
    """Row where a ground tile's BOX top face ends -- where a floor sits."""
    w = _widths(im)
    plinth = next((y for y, v in enumerate(w) if v >= im.width - 2), len(w))
    upper = w[:max(1, plinth - 10)]        # exclude the plinth's own slope
    mx = max(upper)
    return max(y for y, v in enumerate(upper) if v >= mx - 1)


def kit_parts():
    """Classify every tile in the pack by footprint."""
    grounds, modules, roofs = [], [], []
    for n in range(129):
        try:
            im = tile(BUILDINGS, n)
        except FileNotFoundError:
            continue
        w, h = im.size
        if w >= 130 and h >= 125:
            grounds.append(n)
        elif 99 <= w <= 100 and 80 <= h <= 90:
            modules.append(n)
        elif 99 <= w <= 100 and 50 <= h <= 65:
            roofs.append(n)
    return grounds, modules, roofs


def compose(ground, module, roof, floors):
    """Assemble one building the way the kit intends."""
    g = tile(BUILDINGS, ground)
    m = tile(BUILDINGS, module)
    r = tile(BUILDINGS, roof)
    m_top, m_base = _widest_band(m)
    wall = m_base - m_top                  # one storey
    r_base = _widest_band(r)[1]
    g_top = ground_top(g)

    width = max(g.width, m.width, r.width)
    height = g.height + floors * wall + r.height + 40
    out = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    gy = height - g.height
    out.alpha_composite(g, ((width - g.width) // 2, gy))
    top = gy + g_top                       # the ground box's top face
    for i in range(floors):
        out.alpha_composite(m, ((width - m.width) // 2, top - m_base - i * wall))
    out.alpha_composite(r, ((width - r.width) // 2, top - r_base - floors * wall))

    bbox = out.getbbox()
    return out.crop((0, bbox[1], width, height))


def iso(c, r):
    """Cell -> screen position of the tile's top-face top corner."""
    return (c - r) * (TW // 2), (c + r) * (TH // 2)


def main():
    validate_landmarks()
    if not os.path.isdir(KENNEY):
        sys.exit('Kenney tiles not found at %s (set KENNEY_DIR)' % KENNEY)

    # centre the crop window on the diamond
    cx = 0
    cy = (GRID - 1) * (TH // 2)
    ox = WORLD_W // 2 - cx
    oy = WORLD_H // 2 - cy

    ground = Image.new('RGBA', (WORLD_W, WORLD_H), (150, 160, 150, 255))

    # painter's algorithm: back to front by (c + r)
    for s in range(2 * GRID - 1):
        for c in range(GRID):
            r = s - c
            if r < 0 or r >= GRID:
                continue
            src, idx = cell_art(c, r)
            im = tile(src, idx)
            sx, sy = iso(c, r)
            x = ox + sx
            y = oy + sy - (im.height - (TH + SKIRT))
            if x > WORLD_W or y > WORLD_H or x + im.width < 0 or y + im.height < 0:
                continue
            ground.alpha_composite(im, (x, y))

    os.makedirs(os.path.dirname(OUT_IMG), exist_ok=True)
    ground.convert('RGB').save(OUT_IMG, quality=88, optimize=True)

    # Every buildable plot, in world coordinates. Anything placed on the map is
    # chosen from this list, which is why nothing can end up in a road.
    plots = []
    for c in range(GRID):
        for r in range(GRID):
            if is_road(c, r) or is_pavement(c, r) or in_park(c, r):
                continue
            sx, sy = iso(c, r)
            x, y = ox + sx + TW // 2, oy + sy + TH  # centre of the cell's floor
            if not (60 <= x <= WORLD_W - 60 and 60 <= y <= WORLD_H - 60):
                continue
            plots.append({'c': c, 'r': r, 'x': x, 'y': y})

    # Buildings, chosen from the plot list, so a building can never sit in a
    # road. A few plots are deliberately left empty as yards and car parks.
    if os.path.isdir(OUT_BLD):
        for f in os.listdir(OUT_BLD):
            os.remove(os.path.join(OUT_BLD, f))
    os.makedirs(OUT_BLD, exist_ok=True)
    used = {}

    def emit(key, im):
        # The FILENAME carries a hash of the image bytes. Without this a sprite
        # keeps the same URL when its content changes, so a browser (and Metro)
        # can serve the old picture forever -- which silently defeats every art
        # fix and makes it look like the change never took effect.
        import hashlib
        buf = io.BytesIO()
        im.save(buf, format='PNG')
        data = buf.getvalue()
        digest = hashlib.md5(data).hexdigest()[:8]
        fname = '%s.%s.png' % (key, digest)
        with open(os.path.join(OUT_BLD, fname), 'wb') as fh:
            fh.write(data)
        used[key] = {'w': im.width, 'h': im.height, 'file': fname}

    buildings = []
    for i, plot in enumerate(plots):
        c, r = plot['c'], plot['r']
        # Buildings line the edge of each block facing the street; the middle
        # of a block is a yard. Filling every cell makes a block one solid
        # mass of roof with no streetscape.
        cb, rb = c % BLOCK, r % BLOCK
        on_frontage = cb in FRONTAGE or rb in FRONTAGE
        if not on_frontage:
            continue
        if (c, r) in RESERVED:
            continue                       # the game places its own building here
        if (c * 7 + r * 13) % 13 == 0:
            continue                       # occasional gap: yard / parking
        d = district(c, r)
        grounds, modules, roofs, (lo, hi) = DISTRICT_RECIPES[d]
        g = grounds[(c * 3 + r * 5) % len(grounds)]
        m = modules[(c + r) % len(modules)]
        rf = roofs[(c * 5 + r) % len(roofs)]
        floors = lo + ((c * 5 + r * 7) % max(1, hi - lo + 1))
        key = 'kb%03d_%03d_%03d_%02d' % (g, m, rf, floors)
        if key not in used:
            emit(key, compose(g, m, rf, floors))
        sx, sy = iso(c, r)
        buildings.append({
            'key': key,
            'district': d,
            # origin (0.5, 1): bottom-centre of the sprite, on the cell floor
            'x': ox + sx + TW // 2,
            'y': oy + sy + TH + SKIRT,
            'h': used[key]['h'],
        })

    landmarks_by_location = {}
    for loc, cells in LANDMARK_SETS.items():
        d = {}
        for name, (c, r) in cells.items():
            sx, sy = iso(c, r)
            d[name] = {'c': c, 'r': r,
                       'x': ox + sx + TW // 2, 'y': oy + sy + TH + SKIRT}
        landmarks_by_location[loc] = d

    landmarks = {}
    for name, (c, r) in SHARED_LANDMARKS.items():
        sx, sy = iso(c, r)
        landmarks[name] = {
            'c': c, 'r': r,
            'x': ox + sx + TW // 2,
            'y': oy + sy + TH + SKIRT,
        }

    # Pavement cell centres. Ambient pedestrians are placed on these, so they
    # walk on footpaths instead of through building fronts.
    walkways = []
    for c in range(4, GRID - 4):
        for r in range(4, GRID - 4):
            if not is_pavement(c, r):
                continue
            if (c * 5 + r * 3) % 23:
                continue                   # thin them out
            sx, sy = iso(c, r)
            x, y = ox + sx + TW // 2, oy + sy + TH
            if 200 <= x <= WORLD_W - 200 and 200 <= y <= WORLD_H - 200:
                walkways.append({'x': x, 'y': y})

    # Street furniture on pavement cells. Same rule as buildings: chosen from
    # cells the grid says are pavement, so nothing lands in a carriageway.
    props = []
    for g, m, rf in ((4, 0, 57), (12, 0, 57), (20, 0, 57), (26, 0, 57),
                     (29, 15, 59), (34, 0, 57), (2, 0, 57), (9, 0, 59)):
        k = 'lm%03d' % g
        if k not in used:
            emit(k, compose(g, m, rf, 0))
    for name, idx in (('tree', TREE), ('lampA', LAMP_A), ('lampB', LAMP_B)):
        im = tile(DETAILS, idx)
        emit('kp_%s' % name, im)
    for c in range(4, GRID - 4):
        for r in range(4, GRID - 4):
            if not is_pavement(c, r):
                continue
            m = (c * 11 + r * 5) % 13
            if m == 0:
                key = 'kp_tree'
            elif m == 3:
                key = 'kp_lampA' if (c + r) % 2 else 'kp_lampB'
            else:
                continue
            sx, sy = iso(c, r)
    # A sprite STANDING on a cell has its feet at the middle of that cell's top
    # face (sy + TH/2). The building anchor (sy + TH + SKIRT) is the bottom of
    # the tile's sprite including its skirt -- a full tile lower down-screen,
    # which is what put pedestrians, trees and lamps out in the carriageway.
            x, y = ox + sx + TW // 2, oy + sy + TH // 2
            if 120 <= x <= WORLD_W - 120 and 120 <= y <= WORLD_H - 120:
                props.append({'key': key, 'x': x, 'y': y, 'h': used[key]['h']})

    # Car sprites, four headings per colour.
    def endon_frame(folder, tag):
        """First frame where the car is seen end-on, i.e. at its narrowest."""
        widths = []
        for f in range(16):
            im = Image.open(CARS % (folder, tag, f)).convert('RGBA')
            cols = _np.nonzero((_np.asarray(im)[..., 3] > 8).any(0))[0]
            widths.append(int(cols.max() - cols.min() + 1))
        return min(range(16), key=lambda i: widths[i])

    for folder, tag in ([] if REMOVE_CARS else CAR_COLOURS):
        # rotate this colour's sequence onto the same footing as Blue's
        shift = endon_frame(folder, tag) - CAR_REFERENCE_ENDON
        for head, frame in CAR_FRAMES.items():
            im = Image.open(CARS % (folder, tag, (frame + shift) % 16)).convert('RGBA')
            emit('kc_%s_%s' % (tag.lower(), head), im)

    # Traffic lanes down the middle of every street, as a start point plus a
    # per-step delta in world space. Streets run along the isometric axes, so
    # a lane is one cell axis held fixed while the other advances.
    lanes = []

    def clip_lane(x0, y0, dx, dy, steps, head):
        """Trim a lane to the part that is actually on the map.

        A street runs the full diagonal of the isometric grid, most of which
        falls outside the rectangle we cropped the ground to. Left unclipped,
        a car spends most of its loop off-screen and only flicks across the
        visible area, which reads as broken motion.
        """
        on = [t for t in range(steps)
              if 40 <= x0 + dx * t <= WORLD_W - 40 and 40 <= y0 + dy * t <= WORLD_H - 40]
        if len(on) < 20:
            return None   # a stub in the map's corner, not a street
        t0, t1 = on[0], on[-1]
        return {'x': x0 + dx * t0, 'y': y0 + dy * t0,
                'dx': dx, 'dy': dy, 'steps': t1 - t0, 'head': head}

    for k in ([] if REMOVE_CARS else range(1, GRID // BLOCK)):
        base = k * BLOCK
        for lane, head in ((0, 'sw'), (1, 'ne')):
            sx, sy = iso(base + lane, 4)
            ln = clip_lane(ox + sx + TW // 2, oy + sy + TH // 2,
                           -TW // 2, TH // 2, GRID - 8, head)
            if ln:
                lanes.append(ln)
        for lane, head in ((0, 'se'), (1, 'nw')):
            sx, sy = iso(4, base + lane)
            ln = clip_lane(ox + sx + TW // 2, oy + sy + TH // 2,
                           TW // 2, TH // 2, GRID - 8, head)
            if ln:
                lanes.append(ln)

    # Pedestrian routes. Each is the pavement ring around one block, as a
    # closed loop of world points. Walking a ring keeps people on the footpath
    # instead of drifting across the carriageway.
    routes = []
    for bc in range(1, GRID // BLOCK):
        for br in range(1, GRID // BLOCK):
            c0, r0 = bc * BLOCK, br * BLOCK
            lo, hi = ROAD_W, BLOCK - 1     # the outer footpath, beside the kerb
            ring = ([(c0 + i, r0 + lo) for i in range(lo, hi + 1)]
                    + [(c0 + hi, r0 + i) for i in range(lo + 1, hi + 1)]
                    + [(c0 + i, r0 + hi) for i in range(hi - 1, lo - 1, -1)]
                    + [(c0 + lo, r0 + i) for i in range(hi - 1, lo, -1)])
            pts, ok = [], True
            for c, r in ring:
                sx, sy = iso(c, r)
                x, y = ox + sx + TW // 2, oy + sy + TH // 2
                if not (80 <= x <= WORLD_W - 80 and 80 <= y <= WORLD_H - 80):
                    ok = False
                    break
                pts.append({'x': x, 'y': y})
            if ok and len(pts) >= 8:
                routes.append(pts)

    layout = {
        'buildings': buildings,
        'sprites': used,
        'routes': routes,
        'props': props,
        'lanes': lanes,
        'walkways': walkways,
        'landmarks': landmarks,
        'landmarksByLocation': landmarks_by_location,
        'sprites': used,
        'tile': {'w': TW, 'h': TH, 'skirt': SKIRT},
        'grid': GRID,
        'block': BLOCK,
        'roadWidth': ROAD_W,
        'world': {'w': WORLD_W, 'h': WORLD_H},
        'origin': {'x': ox, 'y': oy},
        'plots': plots,
    }
    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, 'w') as fh:
        json.dump(layout, fh)

    # a generated TS module so the sprites reach Phaser's manifest without
    # 26 hand-written require() lines in art.ts
    with open('src/game/cityArt.ts', 'w') as fh:
        fh.write('// GENERATED by scripts/build_city.py - do not edit by hand.\n')
        fh.write('// Kenney isometric city tiles (CC0).\n')
        fh.write('export const CITY_ART: Record<string, number> = {\n')
        for k in sorted(used):
            fh.write("  '%s': require('../../assets/art/world/kenney/%s'),\n" % (k, used[k]['file']))
        fh.write('};\n')

    print('sprites ->', OUT_BLD, len(used), 'building tiles')
    print('placed  ->', len(buildings), 'buildings')
    print('props   ->', len(props), 'street props')
    print('lanes   ->', len(lanes), 'traffic lanes')
    print('routes  ->', len(routes), 'pavement routes')
    print('ground  ->', OUT_IMG, ground.size)
    print('layout  ->', OUT_JSON, len(plots), 'buildable plots')


if __name__ == '__main__':
    main()
