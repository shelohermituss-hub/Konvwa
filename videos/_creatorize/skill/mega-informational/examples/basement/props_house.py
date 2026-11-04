# props_house.py - the film's one house: a small front-gable cottage (8 x 7 m, white lap siding, grey shingles,
# white trim, slate shutters, a red door). Its front facade sits ON the section plane (y = YC) so the camera sees the
# facade above ground and the basement below. Built around a root empty (the shots move the root: lower, sink, tilt).
# Local z = 0 is the bottom of the floor deck (it sits on the basement walls at world z = 0.3).
import bpy, math, random
import cz, mega as M
import common as C

HW, HD = 4.0, 3.5          # half width (x), half depth (y)
DECK = 0.25                # floor deck (joists + subfloor) height
WH = 2.65                  # wall height above the deck
WTK = 0.15                 # wall thickness
PITCH = 32.0
RISE = HW * math.tan(math.radians(PITCH))
OV = 0.42                  # eave overhang
Z0 = DECK                  # wall bottom (local)
ZE = DECK + WH             # eave line (local)


def _wall(name, axis, pos, length, holes, mt, root, z0=Z0, z1=ZE, t=WTK):
    """A wall along axis 'x' (constant y=pos) or 'y' (constant x=pos) with rectangular holes (u, w, zb, zt)."""
    parts = []
    cur = -length / 2
    for (uc, w, zb, zt) in sorted(holes):
        a, b = uc - w / 2, uc + w / 2
        if a > cur: parts.append((cur, a, z0, z1))
        if zb > z0: parts.append((a, b, z0, zb))
        if zt < z1: parts.append((a, b, zt, z1))
        cur = b
    parts.append((cur, length / 2, z0, z1))
    obs = []
    for i, (a, b, za, zb) in enumerate(parts):
        if b - a < 1e-3 or zb - za < 1e-3: continue
        if axis == 'x': bb = (a, b, pos, pos + t, za, zb)
        else: bb = (pos, pos + t, a, b, za, zb)
        obs.append(C.bx(f'{name}{i}', bb, mt['siding'], parent=root))
    return obs


def _window(name, axis, face, u, w, zb, zt, mt, root, out=-1, shutters=True, lit=None):
    """Window unit on an outer wall face: frame, sash, muntins, sill, glass, a warm room glow behind, shutters."""
    P = []
    def B(nm, du, dn, dz, sx, sn, sz, mat):
        # du along the wall, dn outward from the face, dz up
        if axis == 'x': P.append(cz.box(nm, (sx, sn, sz), (u + du, face + out * dn, dz), mat, bevel=min(0.01, sx / 4, sz / 4), ol=0, parent=root))
        else: P.append(cz.box(nm, (sn, sx, sz), (face + out * dn, u + du, dz), mat, bevel=min(0.01, sx / 4, sz / 4), ol=0, parent=root))
    zc = (zb + zt) / 2; h = zt - zb
    B(name + '_ft', 0, 0.03, zt + 0.05, w + 0.22, 0.08, 0.1, mt['trim'])
    B(name + '_fb', 0, 0.06, zb - 0.04, w + 0.3, 0.14, 0.07, mt['trim'])
    B(name + '_fl', -w / 2 - 0.05, 0.03, zc, 0.1, 0.08, h + 0.12, mt['trim'])
    B(name + '_fr', w / 2 + 0.05, 0.03, zc, 0.1, 0.08, h + 0.12, mt['trim'])
    B(name + '_rail', 0, 0.02, zc, w, 0.05, 0.05, mt['trim'])
    for k in (-1, 1):
        B(f'{name}_m{k}', k * w / 4, 0.015, zc, 0.025, 0.035, h, mt['trim'])
    B(name + '_mh', 0, 0.015, zc + h / 4, w, 0.035, 0.025, mt['trim'])
    B(name + '_ml', 0, 0.015, zc - h / 4, w, 0.035, 0.025, mt['trim'])
    B(name + '_gl', 0, -0.06, zc, w, 0.01, h, mt['glass'])
    if lit is not None:
        B(name + '_room', 0, -0.4, zc - 0.1, w + 0.1, 0.02, h + 0.2, lit)
    if shutters:
        for k in (-1, 1):
            B(f'{name}_sh{k}', k * (w / 2 + 0.36), 0.04, zc, 0.5, 0.04, h + 0.05, mt['shutter'])
            for j in range(6):
                B(f'{name}_sl{k}{j}', k * (w / 2 + 0.36), 0.065, zb + 0.15 + j * (h - 0.25) / 5, 0.44, 0.012, 0.035, mt['shutter'])
    return P


def build(mt, root_loc=(0, 0, 0.3), lights=True):
    """Returns dict(root, parts, lights=[glow materials], gutter=[...], downspout, body=[...])."""
    root = cz.empty('house', root_loc)
    y0 = C.YC                                       # facade face
    P = dict(root=root)
    glow = M.pbr('bs_room', '#ffd9a8', rough=0.9, emit='#ffcf90', emit_strength=1.1) if lights else M.pbr('bs_room_off', '#3a3430', rough=0.9)
    P['glow'] = glow
    body = []
    # ---- floor deck: rim joists, floor joists (the basement ceiling), subfloor
    jm = mt['wood']
    body.append(C.bx('rimF', (-HW, HW, y0, y0 + 0.05, 0, DECK), mt['wood_dark'], parent=root))
    body.append(C.bx('rimB', (-HW, HW, HD - 0.05, HD, 0, DECK), mt['wood_dark'], parent=root))
    body.append(C.bx('rimL', (-HW, -HW + 0.05, y0 + 0.05, HD - 0.05, 0, DECK), mt['wood_dark'], parent=root))
    body.append(C.bx('rimR', (HW - 0.05, HW, y0 + 0.05, HD - 0.05, 0, DECK), mt['wood_dark'], parent=root))
    joists = []
    y = y0 + 0.35
    while y < HD - 0.2:
        joists.append(cz.box(f'joist{y:.2f}', (2 * HW - 0.1, 0.05, 0.2), (0, y, 0.1), jm, bevel=0.004, ol=0, parent=root))
        y += 0.4
    body.append(C.bx('subfloor', (-HW + 0.05, HW - 0.05, y0 + 0.05, HD - 0.05, 0.2, DECK), mt['wood'], parent=root))
    P['joists'] = joists
    # ---- walls with door + window holes
    door = (-1.7, 0.95, Z0, Z0 + 2.1)
    fwin = (1.6, 1.5, Z0 + 0.95, Z0 + 2.2)
    body += _wall('wF', 'x', y0, 2 * HW, [door, fwin], mt, root)
    body += _wall('wB', 'x', HD - WTK, 2 * HW, [(0.0, 1.2, Z0 + 1.0, Z0 + 2.1)], mt, root)
    for sx, nm in ((-1, 'wL'), (1, 'wR')):
        x = -HW if sx < 0 else HW - WTK
        body += _wall(nm, 'y', x, 2 * HD - 2 * WTK, [(-1.2, 1.1, Z0 + 1.0, Z0 + 2.15), (1.6, 1.1, Z0 + 1.0, Z0 + 2.15)], mt, root)
    # ---- gables (front + back), siding triangles
    for yy, nm in ((y0, 'gF'), (HD - WTK, 'gB')):
        vs = [(-HW, yy, ZE), (HW, yy, ZE), (0, yy, ZE + RISE), (-HW, yy + WTK, ZE), (HW, yy + WTK, ZE), (0, yy + WTK, ZE + RISE)]
        fs = [(0, 2, 1), (3, 4, 5), (0, 1, 4, 3), (1, 2, 5, 4), (2, 0, 3, 5)]
        g = C.mesh(nm, vs, fs, mt['siding'], parent=root); body.append(g)
    # attic vent (louvres) on the front gable
    for j in range(6):
        body.append(cz.box(f'vent{j}', (0.62, 0.05, 0.03), (0, y0 - 0.03, ZE + 1.0 + j * 0.09), mt['trim'], rot=(-25, 0, 0), bevel=0.004, ol=0, parent=root))
    body.append(cz.box('ventf', (0.78, 0.04, 0.66), (0, y0 - 0.005, ZE + 1.22), mt['dark'], bevel=0.01, ol=0, parent=root))
    # ---- roof: two shingle slabs, ridge cap, fascia, rake boards, gutters + downspout, brick chimney
    L = (HW + OV) / math.cos(math.radians(PITCH))
    roof = []
    for s in (-1, 1):
        cx = s * (HW + OV) / 2; cz_ = ZE + RISE - (HW + OV) / 2 * math.tan(math.radians(PITCH)) + 0.1
        roof.append(cz.box(f'roof{s}', (L, 2 * HD + 0.6, 0.12), (cx, 0.0, cz_), mt['shingle'], rot=(0, s * PITCH, 0), bevel=0.01, ol=0, parent=root))
        # shingle course lines (thin strips) for real relief
        for k in range(1, 16):
            u = k / 16
            px = s * (HW + OV) * u; pz = ZE + RISE - (HW + OV) * u * math.tan(math.radians(PITCH)) + 0.1 + 0.065 / math.cos(math.radians(PITCH))
            roof.append(cz.box(f'course{s}{k}', (0.03, 2 * HD + 0.6, 0.02), (px, 0.0, pz), mt['shingle'], rot=(0, s * PITCH, 0), bevel=0, ol=0, parent=root))
        # fascia board along the eave
        ex = s * (HW + OV); ez = ZE + RISE - (HW + OV) * math.tan(math.radians(PITCH)) + 0.02
        roof.append(cz.box(f'fascia{s}', (0.04, 2 * HD + 0.6, 0.2), (ex, 0.0, ez), mt['trim'], bevel=0.008, ol=0, parent=root))
        # rake boards on the gables
        for yy in (y0 - 0.3, HD + 0.3):
            roof.append(cz.box(f'rake{s}{yy:.1f}', (L, 0.05, 0.2), (cx, yy, cz_ - 0.02), mt['trim'], rot=(0, s * PITCH, 0), bevel=0.008, ol=0, parent=root))
    roof.append(cz.box('ridge', (0.28, 2 * HD + 0.64, 0.08), (0, 0, ZE + RISE + 0.2), mt['dark'], bevel=0.02, ol=0, parent=root))
    P['roof'] = roof
    gut = []
    for s in (-1, 1):
        ex = s * (HW + OV + 0.08); ez = ZE + RISE - (HW + OV) * math.tan(math.radians(PITCH)) - 0.04
        g = cz.cyl(f'gutter{s}', 0.075, 2 * HD + 0.6, (ex, -HD - 0.3, ez), mt['trim'], rot=(-90, 0, 0), verts=20, ol=0, parent=root)
        gut.append(g)
    ds = []
    dx = -(HW + OV + 0.08); dz = ZE + RISE - (HW + OV) * math.tan(math.radians(PITCH)) - 0.06
    ds.append(cz.box('dsp_top', (0.08, 0.08, 0.3), (dx, y0 + 0.25, dz - 0.15), mt['trim'], bevel=0.01, ol=0, parent=root))
    ds.append(cz.box('dsp_off', (0.4, 0.08, 0.08), (dx + 0.2, y0 + 0.25, dz - 0.32), mt['trim'], rot=(0, -35, 0), bevel=0.01, ol=0, parent=root))
    ds.append(cz.box('dsp', (0.08, 0.08, dz - 0.4 + 0.25), (-HW - 0.06, y0 + 0.25, (dz - 0.4 - 0.25) / 2), mt['trim'], bevel=0.01, ol=0, parent=root))
    ds.append(cz.box('dsp_shoe', (0.08, 0.35, 0.08), (-HW - 0.06, y0 + 0.4, -0.25), mt['trim'], bevel=0.01, ol=0, parent=root))
    P['gutter'] = gut; P['downspout'] = ds
    ch = []
    chx, chy = -1.9, 1.6
    zr = ZE + RISE - abs(chx) * math.tan(math.radians(PITCH))
    ch.append(cz.box('chimney', (0.7, 0.7, ZE + RISE + 0.9 - zr + 0.6), (chx, chy, zr - 0.6 + (ZE + RISE + 0.9 - zr + 0.6) / 2), mt['brick'], bevel=0.01, ol=0, parent=root))
    ch.append(cz.box('chcap', (0.82, 0.82, 0.08), (chx, chy, ZE + RISE + 0.94), mt['concrete'], bevel=0.01, ol=0, parent=root))
    ch.append(cz.cyl('flue', 0.1, 0.25, (chx, chy, ZE + RISE + 0.98), mt['dark'], verts=14, ol=0, parent=root))
    P['chimney'] = ch
    # ---- trim, windows, door, porch light
    tr = []
    for x in (-HW + 0.06, HW - 0.06):
        for yy in (y0 - 0.02, HD + 0.02):
            tr.append(cz.box(f'corner{x}{yy}', (0.14, 0.06, WH + 0.05), (x, yy, Z0 + WH / 2), mt['trim'], bevel=0.008, ol=0, parent=root))
    tr.append(cz.box('skirtF', (2 * HW + 0.02, 0.06, 0.2), (0, y0 - 0.02, Z0 + 0.06), mt['trim'], bevel=0.006, ol=0, parent=root))
    for s in (-1, 1):
        tr.append(cz.box(f'skirt{s}', (0.06, 2 * HD, 0.2), (s * (HW + 0.02), 0, Z0 + 0.06), mt['trim'], bevel=0.006, ol=0, parent=root))
    P['lit'] = glow
    tr += _window('winF', 'x', y0, fwin[0], fwin[1], fwin[2], fwin[3], mt, root, out=-1, lit=glow)
    tr += _window('winB', 'x', HD, 0.0, 1.2, Z0 + 1.0, Z0 + 2.1, mt, root, out=1, shutters=False, lit=glow)
    for sx in (-1, 1):
        for u in (-1.2, 1.6):
            tr += _window(f'winS{sx}{u}', 'y', sx * HW, u, 1.1, Z0 + 1.0, Z0 + 2.15, mt, root, out=sx, shutters=False, lit=glow)
    # the door: panels, frame, knob, glass lite, porch light, a little roof over it
    dx0, dw = door[0], door[1]
    tr.append(cz.box('door', (dw, 0.05, 2.08), (dx0, y0 + 0.06, Z0 + 1.04), mt['door'], bevel=0.008, ol=0, parent=root))
    for i, (pz, ph) in enumerate(((Z0 + 0.45, 0.6), (Z0 + 1.25, 0.6))):
        for k in (-1, 1):
            tr.append(cz.box(f'dpan{i}{k}', (dw * 0.36, 0.02, ph), (dx0 + k * dw * 0.22, y0 + 0.03, pz), mt['door'], bevel=0.012, ol=0, parent=root))
    tr.append(cz.box('dlite', (dw * 0.7, 0.02, 0.35), (dx0, y0 + 0.03, Z0 + 1.8), mt['glass'], bevel=0.005, ol=0, parent=root))
    for k, (sx, sz, ox, oz) in enumerate(((0.1, 2.2, -dw / 2 - 0.05, Z0 + 1.1), (0.1, 2.2, dw / 2 + 0.05, Z0 + 1.1), (dw + 0.3, 0.12, 0, Z0 + 2.145))):   # (the lintel 1.5 cm below the opening's top: its underside was coplanar with wF1's)
        tr.append(cz.box(f'dfr{k}', (sx, 0.09, sz), (dx0 + ox, y0 - 0.025, oz), mt['trim'], bevel=0.01, ol=0, parent=root))
    tr.append(cz.sphere('knob', 0.035, (dx0 + dw * 0.36, y0 - 0.0, Z0 + 1.0), mt['chrome'], ol=0, segs=12, rings=8, parent=root))
    tr.append(cz.box('canopy', (dw + 0.7, 0.55, 0.06), (dx0, y0 - 0.27, Z0 + 2.45), mt['shingle'], rot=(-12, 0, 0), bevel=0.01, ol=0, parent=root))
    for k in (-1, 1):
        tr.append(cz.box(f'brace{k}', (0.06, 0.45, 0.06), (dx0 + k * (dw / 2 + 0.25), y0 - 0.2, Z0 + 2.3), mt['trim'], rot=(35, 0, 0), bevel=0.008, ol=0, parent=root))
    lamp_m = M.pbr('bs_lamp', '#fff0d0', rough=0.3, emit='#ffd8a0', emit_strength=2.0 if lights else 0.0)
    P['lamp'] = lamp_m
    tr.append(cz.box('lampbox', (0.14, 0.1, 0.24), (dx0 + dw / 2 + 0.38, y0 - 0.06, Z0 + 1.9), lamp_m, bevel=0.02, ol=0, parent=root))
    tr.append(cz.box('lampcap', (0.18, 0.13, 0.04), (dx0 + dw / 2 + 0.38, y0 - 0.06, Z0 + 2.04), mt['dark'], bevel=0.01, ol=0, parent=root))
    tr.append(cz.cyl('house_no', 0.1, 0.02, (dx0 + dw / 2 + 0.38, y0 - 0.02, Z0 + 1.5), mt['dark'], rot=(90, 0, 0), verts=16, ol=0, parent=root))
    P['body'] = body; P['trim'] = tr
    return P


def all_parts(P):
    out = []
    for k in ('body', 'trim', 'roof', 'gutter', 'downspout', 'chimney', 'joists'):
        out += [o for o in P.get(k, []) if o is not None and o.type == 'MESH']
    return out
