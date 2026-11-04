# props_base.py - the basement, built in stages across the film, plus the site machines and props.
# Stages (cumulative): hole (small dirt hole, house on the rim) -> footing -> walls -> backfill (house back on top)
# -> drain (drain tile + gravel) -> slab -> pump (sump pit, pump, float, discharge, cord) -> battery -> tar -> radon
# (sub-slab pipe, riser, exterior white pipe, fan) -> finish (window, stairs, washer, lamp).
# scene(F0, F1, stage, ...) builds the world, the soil, the yard, the house and every part of that stage and returns
# a dict of the parts so a shot can animate / x-ray them.
import bpy, math, os, random
from mathutils import Vector, Matrix
import cz, mega as M
import common as C
import props_house as PH

LEVELS = ['hole', 'footing', 'walls', 'backfill', 'drain', 'slab', 'pump', 'battery', 'tar', 'radon', 'finish']
LV = {k: i for i, k in enumerate(LEVELS)}
YC, WX, WT, WB, WZ0, WZ1, FZ0, FW, SZ = C.YC, C.WX, C.WT, C.WB, C.WZ0, C.WZ1, C.FZ0, C.FW, C.SZ
PX, PR, PZ = 3.1, 0.3, -3.4          # sump pit centre x, outer radius, bottom
FIN = WX - WT                        # wall inner x (3.75)
FC = WX - WT / 2                     # wall centre x
YB_IN = WB - WT                      # back wall inner y (3.25)


def corrugated_mat(name='bs_corr', holes=True):
    """Black corrugated drain pipe: ribs along the pipe (wave bump on local z) + punched holes."""
    m, n = C._mat(name)
    if n is None: return m
    nt, o = n
    p = nt.nodes.new('ShaderNodeBsdfPrincipled'); p.inputs['Roughness'].default_value = 0.45
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Object'], sep.inputs[0])
    rib = C._math(nt, 'SINE', C._math(nt, 'MULTIPLY', sep.outputs[2], 2 * math.pi / 0.045))
    col = C._mix(nt, 0.0, '#141416', '#141416')
    if holes:
        vo = nt.nodes.new('ShaderNodeTexVoronoi'); vo.inputs['Scale'].default_value = 16
        nt.links.new(tc.outputs['Object'], vo.inputs['Vector'])
        hk = C._math(nt, 'LESS_THAN', vo.outputs['Distance'], 0.12)
        col = C._mix(nt, hk, '#1e1f22', '#000000')
    nt.links.new(col, p.inputs['Base Color'])
    b = nt.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value = 0.6; b.inputs['Distance'].default_value = 0.01
    nt.links.new(rib, b.inputs['Height']); nt.links.new(b.outputs[0], p.inputs['Normal'])
    nt.links.new(p.outputs[0], o.inputs[0])
    return m


def holes_mat(name='bs_pvc_holes', color='#f2f2ee'):
    """White PVC with drilled holes (the sub-slab radon pipe)."""
    m, n = C._mat(name)
    if n is None: return m
    nt, o = n
    p = nt.nodes.new('ShaderNodeBsdfPrincipled'); p.inputs['Roughness'].default_value = 0.3
    tc = nt.nodes.new('ShaderNodeTexCoord')
    vo = nt.nodes.new('ShaderNodeTexVoronoi'); vo.inputs['Scale'].default_value = 12
    nt.links.new(tc.outputs['Object'], vo.inputs['Vector'])
    hk = C._math(nt, 'LESS_THAN', vo.outputs['Distance'], 0.1)
    nt.links.new(C._mix(nt, hk, color, '#101010'), p.inputs['Base Color'])
    nt.links.new(p.outputs[0], o.inputs[0])
    return m


def cable(name, pts, r, mat):
    """A cable / cord through points (a bevelled poly curve, smooth)."""
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = r; cu.bevel_resolution = 3
    sp = cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = p; bp.handle_left_type = bp.handle_right_type = 'AUTO'
    ob = bpy.data.objects.new(name, cu); bpy.context.scene.collection.objects.link(ob)
    cu.materials.append(mat)
    return ob


# ---------------------------------------------------------------- concrete
def footings(mt, mat=None):
    m = mat or mt['concrete']
    L = C.bx('footL', (-(FC + FW / 2), -(FC - FW / 2), YC, WB + 0.275, FZ0, WZ0), m, origin='bottom')
    R = C.bx('footR', (FC - FW / 2, FC + FW / 2, YC, WB + 0.275, FZ0, WZ0), m, origin='bottom')
    B = C.bx('footB', (-(FC - FW / 2), FC - FW / 2, WB - WT / 2 - FW / 2, WB + 0.275, FZ0, WZ0), m, origin='bottom')
    return dict(L=L, R=R, B=B)


def forms(mt):
    """Timber footing forms: boards both sides of each footing strip + stakes."""
    P = []
    for s in (-1, 1):
        for x in (s * (FC - FW / 2 - 0.02), s * (WX + 0.295)):
            P.append(C.bx(f'form{s}{x:.2f}', (x - 0.02, x + 0.02, YC, WB + 0.3, FZ0, WZ0 + 0.12), mt['form']))
            for k in range(6):
                y = YC + 0.4 + k * 1.3
                xs = x + (0.05 if x * s > FC else -0.05) * s
                P.append(cz.box(f'stake{s}{x:.1f}{k}', (0.05, 0.05, 0.55), (xs, y, FZ0 + 0.15), mt['form'], bevel=0.008, ol=0))
    return M.join('forms', P)


def walls(mt, mat=None, marks=True):
    m = mat or mt['concrete']
    L = C.bx('wallL', (-WX, -FIN, YC, WB, WZ0, WZ1), m, origin='bottom')
    R = C.bx('wallR', (FIN, WX, YC, WB, WZ0, WZ1), m, origin='bottom')
    B = C.bx('wallB', (-FIN, FIN, YB_IN, WB, WZ0, WZ1), m, origin='bottom')
    C.K.allow(R, group='wallpass')       # the sump discharge and the pump cord go through the right wall (pump())
    out = dict(L=L, R=R, B=B)
    if marks:   # form-tie snap holes + panel seams on the inner faces (real relief)
        tie = M.pbr('bs_tie', '#4a4844', rough=0.6, metal=0.3)
        P = []
        for s in (-1, 1):
            for y in [YC + 0.45 + i * 0.6 for i in range(12)]:
                for z in (-2.25, -1.65, -1.05, -0.45):
                    P.append(cz.cyl(f'tie{s}{y:.1f}{z}', 0.016, 0.012, (s * (FIN - 0.004), y, z), tie, rot=(0, s * 90, 0), verts=10, ol=0))
            for y in [YC + 1.2 * i for i in range(1, 6)]:
                P.append(cz.box(f'seam{s}{y:.1f}', (0.012, 0.016, WZ1 - WZ0 - 0.05), (s * (FIN - 0.003), y, (WZ0 + WZ1) / 2), mt['concrete_wet'], bevel=0, ol=0))
        for x in [-3.0 + 0.6 * i for i in range(11)]:
            for z in (-2.25, -1.65, -1.05, -0.45):
                P.append(cz.cyl(f'tieB{x:.1f}{z}', 0.016, 0.012, (x, YB_IN - 0.004, z), tie, rot=(90, 0, 0), verts=10, ol=0))
        for x in (-2.4, -1.2, 0.0, 1.2, 2.4):
            P.append(cz.box(f'seamB{x}', (0.016, 0.012, WZ1 - WZ0 - 0.05), (x, YB_IN - 0.003, (WZ0 + WZ1) / 2), mt['concrete_wet'], bevel=0, ol=0))
        out['marks'] = M.join('wallmarks', P)
    return out


def rebar(mt, side=1):
    """A rebar mat inside the side wall (vertical + horizontal bars, ends showing in the cut face)."""
    # Both layers hug the wall centre (verticals 1.5 cm inside, horizontals 1.5 cm outside of it) and every bar ends
    # >= 0.2 m under the wall top, so nothing pokes out of the concrete or up into the house.
    P = []
    x = side * FC
    ztop = WZ1 - 0.22
    for y in [YC + 0.2 + i * 0.3 for i in range(23)]:
        P.append(C.rod(f'rv{y:.2f}', 0.014, (x - 0.015 * side, y, WZ0 + 0.06), (x - 0.015 * side, y, ztop), mt['rebar'], verts=8))
    for z in [WZ0 + 0.15 + i * 0.29 for i in range(10)]:
        P.append(C.rod(f'rh{z:.2f}', 0.014, (x + 0.015 * side, YC + 0.02, z), (x + 0.015 * side, WB - 0.08, z), mt['rebar'], verts=8))
    for y in [YC + 0.2 + i * 0.3 for i in range(23)]:   # dowels down into the footing
        P.append(C.rod(f'rd{y:.2f}', 0.012, (x - 0.04 * side, y, FZ0 + 0.08), (x - 0.04 * side, y, WZ0 + 0.5), mt['rebar'], verts=8))
    ob = M.join(f'rebar{side}', P)
    # origin at the mat's own centre, so a grown x-ray copy swells evenly instead of sliding out of the wall
    vs = [v.co for v in ob.data.vertices]
    c = Vector([(min(v[i] for v in vs) + max(v[i] for v in vs)) / 2 for i in range(3)])
    ob.data.transform(Matrix.Translation(-c))
    ob.location = ob.location + ob.matrix_world.to_3x3() @ c
    return ob


# ---------------------------------------------------------------- backfill, drain, slab
def backfill(mt, drain=False, tar=False, wet=False, sides=('L', 'R', 'B')):
    """Earth back against the walls (mixed fill, no strata). With drain: gravel bed + drain tile zone below z -2.2."""
    m = mt['wetfill'] if wet else mt['fill']
    xi = WX + (0.06 if tar else 0.0)
    zb = -2.2 if drain else WZ0
    out = {}
    if 'R' in sides:
        out['R'] = C.bx('fillR', (xi, 4.6, YC, 4.1, zb, 0.0), m, origin='bottom')
        if not drain: out['Rlow'] = C.bx('fillRlow', (WX + 0.275, 4.6, YC, 4.1, FZ0, WZ0), m)
    if 'L' in sides:
        out['L'] = C.bx('fillL', (-4.6, -xi, YC, 4.1, zb, 0.0), m, origin='bottom')
        if not drain: out['Llow'] = C.bx('fillLlow', (-4.6, -WX - 0.275, YC, 4.1, FZ0, WZ0), m)
    if 'B' in sides:
        yi = WB + (0.06 if tar else 0.0)
        out['B'] = C.bx('fillB', (-xi, xi, yi, 4.1, zb, 0.0), m, origin='bottom')
    return out


def drain(mt):
    """Black perforated drain tile beside the footings (both sides + back) in a gravel bed, gravel up to -2.2."""
    cm = corrugated_mat()
    pin = M.pbr('bs_corr_in', '#050505', rough=0.8)
    P = {}
    P['R'] = C.tube('drainR', 0.1, 0.085, (4.44, YC, -2.85), (4.44, 3.94, -2.85), cm, mat_in=pin)
    P['L'] = C.tube('drainL', 0.1, 0.085, (-4.44, YC, -2.85), (-4.44, 3.94, -2.85), cm, mat_in=pin)
    P['B'] = C.tube('drainB', 0.1, 0.085, (-4.34, 3.94, -2.85), (4.34, 3.94, -2.85), cm, mat_in=pin)
    C.K.allow(*P.values(), group='drain')   # the drain tile lies IN its gravel bed (gravel())
    return P


def gravel(mt, tar=False):
    """The gravel zone around the drain tile (boxes notched around the pipe ends) + stones on the cut face."""
    xi = WX + (0.06 if tar else 0.0)
    out = []
    for s in (-1, 1):
        nt = (min(s * 4.34, s * 4.54), max(s * 4.34, s * 4.54), YC, 4.2, -2.95, -2.75)
        lo = (min(s * (WX + 0.275), s * 4.6), max(s * (WX + 0.275), s * 4.6), YC, 4.1, FZ0, WZ0)
        up = (min(s * xi, s * 4.6), max(s * xi, s * 4.6), YC, 4.1, WZ0, -2.2)
        out.append(C.boxes(f'grav{s}', lo, [nt], mt['gravel']))
        out.append(C.boxes(f'gravu{s}', up, [nt], mt['gravel']))
    out.append(C.bx('gravB', (-xi, xi, WB + (0.06 if tar else 0.0), 4.1, WZ0, -2.2), mt['gravel']))
    out.append(C.bx('gravBlo', (-(WX + 0.275), WX + 0.275, WB + 0.275, 4.1, FZ0, WZ0), mt['gravel']))
    C.K.allow(*out, group='drain')       # the gravel holds the drain tile (drain())
    out.append(stones('gstones', [(s * (xi + 0.02), s * 4.58) for s in (-1, 1)], (FZ0 + 0.02, -2.22), mt, n=260))
    return out


def stones(name, xr, zr, mt, n=200, seed=4, y=None, mat=None):
    """Washed stones half-proud of the cut face in x ranges xr [(x0, x1)], z range zr."""
    r = random.Random(seed); P = []
    for i in range(n):
        a, b = xr[i % len(xr)]
        x = r.uniform(min(a, b), max(a, b)); z = r.uniform(*zr)
        if 4.32 < abs(x) < 4.56 and -2.97 < z < -2.73: continue
        s = r.uniform(0.018, 0.04)
        o = cz.sphere(f'{name}{i}', 1.0, (x, (YC if y is None else y) + s * 0.1, z), mat or mt['pebble'], scale=(s * r.uniform(1, 1.5), s * 0.7, s * r.uniform(0.7, 1.1)), ol=0, segs=8, rings=5)
        o.rotation_euler = (0, r.uniform(0, 3), 0); P.append(o)
    j = M.join(name, P)
    if j is not None: j['cz_section_ok'] = True      # stones proud of the cut face on purpose (overlap gate opt-out)
    return j


def underslab(mt, pit=False, slab=True):
    """Gravel layer under the floor + the 15 cm floor slab (notched for the sump pit)."""
    notch = [(PX - PR, PX + PR, YC, YC + PR + 0.02, -9, 9)] if pit else []
    g = C.boxes('subgrav', (-(FC - FW / 2), FC - FW / 2, YC, WB - WT / 2 - FW / 2, FZ0, WZ0), notch, mt['gravel'])
    s = C.boxes('slab', (-FIN, FIN, YC, YB_IN, WZ0, SZ), notch, mt['concrete']) if slab else None
    st = stones('sstones', [(-3.4, 2.7 if pit else 3.4)], (FZ0 + 0.02, WZ0 - 0.02), mt, n=150, seed=9)
    return dict(gravel=g, slab=s, stones=st)


# ---------------------------------------------------------------- the sump pit + pump
def pit(mt, f0=None, f1=None):
    liner = C.tube('pitliner', PR, PR - 0.025, (PX, YC, PZ), (PX, YC, SZ + 0.01), M.pbr('bs_liner', '#2a2b2e', rough=0.5), half=True, verts=40)
    # half-tube made around z: rotate the half (+y side) - tube() builds its half on +local-y already (axis is +z)
    bot = cz.cyl('pitbot', PR - 0.01, 0.03, (PX, YC, PZ), M.pbr('bs_liner2', '#202124', rough=0.6), verts=40, ol=0)
    half_cut(bot)
    return dict(liner=liner, bottom=bot)


def half_cut(ob):
    """Delete the vertices of a mesh in front of the section plane (world y < YC) - for round things on the cut."""
    import bmesh
    bpy.context.view_layer.update()
    mw = ob.matrix_world; inv = mw.inverted()
    bm = bmesh.new(); bm.from_mesh(ob.data)
    co = inv @ Vector((0, YC, 0)); no = (inv.to_3x3() @ Vector((0, 1, 0))).normalized()
    res = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co, plane_no=no, clear_inner=True)
    cut = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
    try: bmesh.ops.holes_fill(bm, edges=cut, sides=0)
    except Exception: pass
    bm.to_mesh(ob.data); bm.free()


def pump(mt):
    """A submersible sump pump in the pit: cast body with ribs, motor cap, handle, float switch on a hinged rod,
    the PVC discharge up and out through the right wall to the lawn, a check valve, the power cord to an outlet."""
    root = cz.empty('pump', (PX, YC + 0.13, PZ + 0.03))
    body_m = M.pbr('bs_pumpbody', '#2f4a3a', rough=0.45, metal=0.5, noise=0.2)
    P = []
    P.append(cz.cyl('pbase', 0.12, 0.06, (0, 0, 0), mt['dark'], verts=24, ol=0, parent=root))
    P.append(cz.cyl('pbody', 0.105, 0.24, (0, 0, 0.06), body_m, verts=28, bevel=0.01, ol=0, parent=root))
    for k in range(5):
        P.append(cz.cyl(f'prib{k}', 0.112, 0.012, (0, 0, 0.09 + k * 0.04), body_m, verts=28, ol=0, parent=root))
    P.append(cz.cyl('pcap', 0.09, 0.05, (0, 0, 0.3), body_m, verts=24, ol=0, r2=0.06, parent=root))
    P.append(cz.box('phandle', (0.16, 0.02, 0.06), (0, 0, 0.38), mt['dark'], bevel=0.008, ol=0, parent=root))
    for k in range(6):
        a = k * math.pi / 3
        P.append(cz.cyl(f'pbolt{k}', 0.008, 0.015, (0.095 * math.cos(a), 0.095 * math.sin(a), 0.3), mt['chrome'], verts=8, ol=0, parent=root))
    P.append(cz.cyl('pinlet', 0.125, 0.02, (0, 0, 0.02), mt['chrome'], verts=24, ol=0, parent=root))   # (its top lay in pbase's top: z-fight)
    pumpbody = M.join('pumpbody', P)
    pumpbody.parent = root
    # float switch: a hinged rod + a ball, pivot on the pump's side
    hinge = cz.empty('fhinge', (-0.1, 0.0, 0.2), parent=root)
    rodo = C.rod('frod', 0.007, (0, 0, 0), (-0.1, 0, 0), mt['dark'])
    rodo.parent = hinge
    ball = cz.sphere('fball', 0.035, (-0.12, 0, 0), M.pbr('bs_float', '#f2c230', rough=0.35), ol=0, segs=16, rings=10, parent=hinge)
    # discharge: up the pit, a check valve, along the ceiling, through the wall, down, out across the lawn
    pv = mt['pvc']
    dx, dy = PX, YC + 0.13
    dis = []
    dis.append(C.rod('dis_up', 0.035, (dx, dy, PZ + 0.4), (dx, dy, 0.15), pv))
    dis.append(cz.cyl('dis_valve', 0.055, 0.16, (dx, dy, -2.05), M.pbr('bs_valve', '#e8e8e2', rough=0.25), verts=20, ol=0))
    for k in (0, 1):
        dis.append(cz.cyl(f'dis_band{k}', 0.06, 0.03, (dx, dy, -2.04 + k * 0.11), mt['chrome'], verts=20, ol=0))   # 1 cm in from the valve's ends (z-fight)
    dis.append(cz.sphere('dis_elb1', 0.042, (dx, dy, 0.15), pv, ol=0, segs=16, rings=8))
    dis.append(C.rod('dis_run', 0.035, (dx, dy, 0.15), (4.42, dy, 0.15), pv))
    dis.append(cz.sphere('dis_elb2', 0.042, (4.42, dy, 0.15), pv, ol=0, segs=16, rings=8))
    dis.append(C.rod('dis_lawn', 0.035, (4.42, dy, 0.15), (6.6, dy, 0.15), pv))
    for k, xx in enumerate((5.2, 6.2)):
        dis.append(cz.box(f'dis_stake{k}', (0.04, 0.04, 0.2), (xx, dy, 0.07), mt['wood_dark'], bevel=0.005, ol=0))
    dis.append(cz.cyl('dis_mouth', 0.05, 0.08, (6.6, dy, 0.15), pv, rot=(0, 90, 0), verts=20, ol=0))
    # the power cord from the pump cap up the pit and the wall to an outlet
    cord_m = M.pbr('bs_cord', '#151515', rough=0.5)
    cord = cable('cord', [(PX + 0.06, YC + 0.13, PZ + 0.38), (PX + 0.2, YC + 0.18, PZ + 0.62), (PX + 0.25, YC + 0.3, SZ + 0.03),
                          (FIN - 0.05, YC + 0.45, SZ + 0.04), (FIN - 0.02, YC + 0.55, -1.75), (FIN - 0.02, YC + 0.6, -1.62)], 0.009, cord_m)
    outl = []
    outl.append(cz.box('outlet', (0.03, 0.1, 0.16), (FIN - 0.015, YC + 0.6, -1.55), mt['trim'], bevel=0.006, ol=0))
    for k in (-1, 1):
        outl.append(cz.box(f'slot{k}', (0.008, 0.012, 0.025), (FIN - 0.032, YC + 0.6 + k * 0.02, -1.52), mt['dark'], bevel=0, ol=0))
    outl.append(cz.box('plug', (0.05, 0.05, 0.05), (FIN - 0.05, YC + 0.6, -1.6), mt['dark'], bevel=0.01, ol=0))
    led = M.pbr('bs_led', '#30ff60', emit='#30ff60', emit_strength=3.0)
    outl.append(cz.sphere('led', 0.008, (FIN - 0.032, YC + 0.6, -1.48), led, ol=0, segs=8, rings=6))
    C.K.allow(*[o for o in dis if o.name.startswith('dis_run')], cord, group='wallpass')   # through the right wall on purpose
    return dict(root=root, body=pumpbody, hinge=hinge, rod=rodo, ball=ball, discharge=dis, cord=cord, outlet=M.join('outletp', outl), led=led)


def pit_water(mt, level):
    """Blue water in the half pit: a half cylinder whose top follows level(t) (via its z scale)."""
    w = cz.cyl('pitwater', PR - 0.03, 1.0, (PX, YC, PZ + 0.03), mt['water'], verts=40, ol=0)
    half_cut(w)
    return w


def battery(mt):
    P = []
    case = M.pbr('bs_batt', '#1d1e22', rough=0.4)
    lid = M.pbr('bs_battlid', '#3a3d44', rough=0.4)
    bx_, by_ = 2.15, YC + 0.45
    P.append(cz.box('bcase', (0.36, 0.2, 0.22), (bx_, by_, SZ + 0.11), case, bevel=0.012, ol=0))
    P.append(cz.box('blid', (0.37, 0.21, 0.04), (bx_, by_, SZ + 0.24), lid, bevel=0.01, ol=0))
    P.append(cz.box('blabel', (0.24, 0.005, 0.07), (bx_, by_ - 0.102, SZ + 0.12), M.pbr('bs_blabel', '#e8b020', rough=0.4), bevel=0, ol=0))
    P.append(cz.cyl('bterm_p', 0.018, 0.04, (bx_ + 0.11, by_, SZ + 0.26), M.pbr('bs_red', '#c42a20', rough=0.4), verts=12, ol=0))
    P.append(cz.cyl('bterm_n', 0.018, 0.04, (bx_ - 0.11, by_, SZ + 0.26), mt['dark'], verts=12, ol=0))
    P.append(cz.box('bhandle', (0.2, 0.03, 0.02), (bx_, by_, SZ + 0.28), mt['dark'], bevel=0.006, ol=0))
    # the backup controller box mounted on the wall
    P.append(cz.box('ctrl', (0.06, 0.24, 0.3), (FIN - 0.03, YC + 0.95, -1.7), mt['trim'], bevel=0.015, ol=0))
    led = M.pbr('bs_led2', '#30ff60', emit='#30ff60', emit_strength=3.0)
    P.append(cz.box('ctrl_led', (0.01, 0.03, 0.015), (FIN - 0.062, YC + 0.95, -1.6), led, bevel=0, ol=0))
    body = M.join('battery', P)
    red = M.pbr('bs_redw', '#b8221a', rough=0.45)
    w1 = cable('bwire', [(bx_ + 0.11, by_, SZ + 0.28), (bx_ + 0.4, by_ + 0.1, SZ + 0.2), (FIN - 0.06, YC + 0.9, SZ + 0.05), (FIN - 0.06, YC + 0.95, -1.85)], 0.012, red)
    w2 = cable('bwire2', [(FIN - 0.06, YC + 0.85, -1.85), (FIN - 0.1, YC + 0.6, SZ + 0.05), (PX + 0.2, YC + 0.3, SZ + 0.03), (PX + 0.05, YC + 0.15, PZ + 0.4)], 0.01, mt['dark'])
    return dict(body=body, wires=[w1, w2])


def tar(mt):
    """The tar coat on the outside faces of the walls (6 cm drawn, so it reads in the section)."""
    R = C.bx('tarR', (WX, WX + 0.06, YC, WB + 0.06, WZ0, 0.0), mt['tar'], origin='top')
    L = C.bx('tarL', (-WX - 0.06, -WX, YC, WB + 0.06, WZ0, 0.0), mt['tar'], origin='top')
    B = C.bx('tarB', (-WX, WX, WB, WB + 0.06, WZ0, 0.0), mt['tar'], origin='top')
    return dict(R=R, L=L, B=B)


# ---------------------------------------------------------------- radon mitigation
RX_RISE, RX_OUT = -3.2, -4.72      # riser x (inside the basement), exterior pipe x (left of the house)
RZ_RUN, RZ_TOP = 0.12, 4.35


def radon(mt):
    """Sub-slab perforated pipe in the gravel (on the cut), the riser, the run out through the left wall, the white
    exterior pipe up the side of the house with standoff brackets, the inline fan and the rain cap above the roof edge."""
    pv = mt['pvc']; r = 0.055
    y = YC + 0.0
    P = {}
    P['sub'] = C.rod('rd_sub', r, (2.5, y, -2.86), (RX_RISE, y, -2.86), holes_mat())
    P['riser'] = [C.rod('rd_riser', r, (RX_RISE, y, -2.86), (RX_RISE, y, RZ_RUN), pv),
                  cz.sphere('rd_e1', r * 1.25, (RX_RISE, y, -2.86), pv, ol=0, segs=16, rings=8),
                  cz.cyl('rd_collar', r * 1.6, 0.04, (RX_RISE, y, SZ), pv, verts=20, ol=0)]
    # the buried part sits ON the section plane: cut it there (half pipes on the cut face, overlap gate: cutaway)
    for o in [P['sub']] + P['riser']: half_cut(o)
    P['run'] = [cz.sphere('rd_e2', r * 1.25, (RX_RISE, y, RZ_RUN), pv, ol=0, segs=16, rings=8),
                C.rod('rd_run', r, (RX_RISE, y, RZ_RUN), (RX_OUT, y, RZ_RUN), pv),
                cz.sphere('rd_e3', r * 1.25, (RX_OUT, y, RZ_RUN), pv, ol=0, segs=16, rings=8)]
    P['up'] = [C.rod('rd_up', r, (RX_OUT, y, RZ_RUN), (RX_OUT, y, RZ_TOP), pv)]
    for k, z in enumerate((0.9, 2.3, 2.95)):      # (the top bracket at 3.2 ran 6 cm into the eave: overlap gate)
        P['up'].append(cz.box(f'rd_brk{k}', (abs(RX_OUT) - PH.HW, 0.04, 0.05), ((RX_OUT - PH.HW) / 2, y + 0.06, z), mt['metal'], bevel=0.006, ol=0))
        P['up'].append(cz.cyl(f'rd_clamp{k}', r * 1.25, 0.05, (RX_OUT, y, z - 0.025), mt['metal'], verts=16, ol=0))
    # rain cap
    P['cap'] = [cz.cyl('rd_cap', r * 2.2, 0.05, (RX_OUT, y, RZ_TOP + 0.12), pv, verts=20, ol=0, r2=r * 0.6),
                cz.cyl('rd_capst', r * 0.4, 0.12, (RX_OUT, y, RZ_TOP), pv, verts=10, ol=0)]
    # the fan: housing + rubber couplings + a label + its power box
    fz = 1.45
    fan = []
    fan.append(cz.cyl('fan_h', 0.16, 0.3, (RX_OUT, y, fz), M.pbr('bs_fanbody', '#dcdcd6', rough=0.35), verts=32, bevel=0.02, ol=0))
    fan.append(cz.cyl('fan_r', 0.165, 0.03, (RX_OUT, y, fz + 0.135), mt['metal'], verts=32, ol=0))
    for z in (fz - 0.12, fz + 0.3):
        fan.append(cz.cyl(f'fan_c{z:.2f}', r * 1.4, 0.12, (RX_OUT, y, z), mt['rubber'], verts=20, ol=0))
        fan.append(cz.cyl(f'fan_cb{z:.2f}', r * 1.45, 0.015, (RX_OUT, y, z + 0.05), mt['chrome'], verts=20, ol=0))
    fan.append(cz.box('fan_lbl', (0.16, 0.005, 0.1), (RX_OUT, y - 0.16, fz + 0.16), M.pbr('bs_fanlbl', '#2a6ad0', rough=0.4), bevel=0, ol=0))
    fan.append(cz.box('fan_box', (0.12, 0.08, 0.16), (-PH.HW - 0.05, y + 0.3, fz), mt['trim'], bevel=0.01, ol=0))
    P['fan'] = fan
    C.K.allow(*P['up'][:1], *fan, group='radonfan')   # the inline fan sits ON the pipe run (the pipe passes through it)
    P['fan_cord'] = cable('fan_cord', [(RX_OUT + 0.1, y, fz + 0.05), (RX_OUT + 0.3, y + 0.2, fz - 0.05), (-PH.HW - 0.1, y + 0.3, fz - 0.05)], 0.008, mt['dark'])
    return P


def radon_all(P):
    out = [P['sub']] + P['riser'] + P['run'] + P['up'] + P['cap'] + P['fan']
    return [o for o in out if o is not None]


# ---------------------------------------------------------------- finish: window, stairs, washer, lamp
def window(mt):
    P = []
    x0, w, zb, zt = 0.3, 0.95, -0.72, -0.12
    y = YB_IN
    P.append(cz.box('bw_frame_t', (w + 0.12, 0.08, 0.06), (x0, y - 0.04, zt + 0.03), mt['trim'], bevel=0.01, ol=0))
    P.append(cz.box('bw_frame_b', (w + 0.16, 0.14, 0.06), (x0, y - 0.07, zb - 0.03), mt['trim'], bevel=0.01, ol=0))
    for k in (-1, 1):
        P.append(cz.box(f'bw_frame{k}', (0.06, 0.08, zt - zb + 0.12), (x0 + k * (w / 2 + 0.03), y - 0.04, (zb + zt) / 2), mt['trim'], bevel=0.01, ol=0))
    P.append(cz.box('bw_mull', (0.04, 0.05, zt - zb), (x0, y - 0.03, (zb + zt) / 2), mt['trim'], bevel=0.006, ol=0))
    sky = M.pbr('bs_winsky', '#cfe4ff', rough=0.2, emit='#d8ebff', emit_strength=1.4)
    P.append(cz.box('bw_glass', (w, 0.01, zt - zb), (x0, y - 0.012, (zb + zt) / 2), sky, bevel=0, ol=0))
    return M.join('bwindow', P)


def stairs(mt):
    """A timber stair along the back wall: 14 treads + risers, two stringers, a handrail on posts with balusters."""
    P = []
    n = 14; rise = (WZ1 - 0.05 - SZ) / (n + 1); run = 0.24
    xb = -0.4; y0, y1 = YB_IN - 0.9, YB_IN - 0.02
    tread = mt['wood']
    for i in range(n):
        x = xb - i * run; z = SZ + rise * (i + 1)
        P.append(cz.box(f'tread{i}', (run + 0.03, y1 - y0, 0.04), (x - run / 2, (y0 + y1) / 2, z), tread, bevel=0.006, ol=0))
        P.append(cz.box(f'riser{i}', (0.02, y1 - y0 - 0.04, rise - 0.04), (x + 0.005, (y0 + y1) / 2, z - rise / 2), mt['trim'], bevel=0.003, ol=0))
    L = math.hypot(n * run, n * rise); ang = math.degrees(math.atan2(n * rise, n * run))
    xc = xb - n * run / 2; zc = SZ + n * rise / 2 - 0.05
    for yy in (y0 + 0.03, y1 - 0.03):
        P.append(cz.box(f'stringer{yy:.1f}', (L, 0.045, 0.26), (xc, yy, zc), mt['wood_dark'], rot=(0, ang, 0), bevel=0.008, ol=0))
    # handrail on the open side
    hz = 0.9
    P.append(cz.box('hrail', (L + 0.1, 0.06, 0.06), (xc, y0 + 0.02, zc + hz + 0.1), mt['wood_dark'], rot=(0, ang, 0), bevel=0.012, ol=0))
    for i in range(0, n, 1):
        x = xb - i * run - run / 2; z = SZ + rise * (i + 1)
        P.append(cz.box(f'bal{i}', (0.025, 0.025, hz + 0.05), (x, y0 + 0.02, z + (hz + 0.05) / 2), mt['trim'], bevel=0.004, ol=0))
    P.append(cz.box('npost', (0.09, 0.09, hz + 0.15), (xb + 0.02, y0 + 0.02, SZ + (hz + 0.15) / 2), mt['wood_dark'], bevel=0.012, ol=0))
    return M.join('stairs', P)


def washer(mt):
    """A front-loading washing machine: white cabinet, round glass door with a chrome ring, a control panel with a
    dial, buttons and a little display, feet, a hose to the wall, and a laundry basket beside it."""
    P = []
    x0, y0 = 1.55, YB_IN - 0.36
    W, D, H = 0.6, 0.6, 0.85
    white = M.pbr('bs_washer', '#f4f5f6', rough=0.25, coat=0.4)
    P.append(cz.box('wcab', (W, D, H), (x0, y0, SZ + 0.02 + H / 2), white, bevel=0.025, ol=0))
    P.append(cz.box('wtop', (W + 0.01, D + 0.01, 0.025), (x0, y0, SZ + 0.02 + H), white, bevel=0.01, ol=0))
    yf = y0 - D / 2
    P.append(cz.cyl('wring', 0.2, 0.04, (x0, yf, SZ + 0.42), mt['chrome'], rot=(90, 0, 0), verts=40, ol=0))
    P.append(cz.cyl('wglass', 0.16, 0.045, (x0, yf - 0.002, SZ + 0.42), M.pbr('bs_wglass', '#3a4a5a', rough=0.05, spec=1.0), rot=(90, 0, 0), verts=40, ol=0))
    P.append(cz.cyl('wdrum', 0.15, 0.02, (x0, yf + 0.03, SZ + 0.42), mt['metal'], rot=(90, 0, 0), verts=32, ol=0))
    P.append(cz.box('whandle', (0.04, 0.03, 0.12), (x0 + 0.2, yf - 0.025, SZ + 0.42), mt['chrome'], bevel=0.01, ol=0))
    P.append(cz.box('wpanel', (W - 0.04, 0.02, 0.12), (x0, yf - 0.005, SZ + H - 0.07), M.pbr('bs_wpanel', '#d8dadc', rough=0.3), bevel=0.008, ol=0))
    P.append(cz.cyl('wdial', 0.04, 0.03, (x0 + 0.16, yf - 0.01, SZ + H - 0.07), mt['chrome'], rot=(90, 0, 0), verts=24, ol=0))
    disp = M.pbr('bs_wdisp', '#5ad0ff', emit='#5ad0ff', emit_strength=1.4)
    P.append(cz.box('wdisp', (0.1, 0.012, 0.035), (x0 - 0.02, yf - 0.012, SZ + H - 0.07), disp, bevel=0, ol=0))
    for k in range(3):
        P.append(cz.cyl(f'wbtn{k}', 0.012, 0.012, (x0 - 0.2 + k * 0.045, yf - 0.012, SZ + H - 0.07), mt['dark'], rot=(90, 0, 0), verts=12, ol=0))
    P.append(cz.box('wdrawer', (0.16, 0.015, 0.07), (x0 - 0.18, yf - 0.006, SZ + H - 0.07), white, bevel=0.006, ol=0))
    for kx in (-1, 1):
        for ky in (-1, 1):
            P.append(cz.cyl(f'wfoot{kx}{ky}', 0.025, 0.02, (x0 + kx * 0.25, y0 + ky * 0.25, SZ), mt['dark'], verts=12, ol=0))
    body = M.join('washer', P)
    hose = cable('whose', [(x0 + 0.2, y0 + D / 2, SZ + 0.6), (x0 + 0.25, YB_IN - 0.03, SZ + 0.75), (x0 + 0.25, YB_IN - 0.03, SZ + 1.1)], 0.012, mt['dark'])
    tap = []
    tap.append(cz.box('wbox', (0.3, 0.04, 0.2), (x0 + 0.25, YB_IN - 0.02, SZ + 1.15), mt['trim'], bevel=0.01, ol=0))
    for k in (-1, 1):
        tap.append(cz.cyl(f'wtap{k}', 0.02, 0.05, (x0 + 0.25 + k * 0.08, YB_IN - 0.05, SZ + 1.15), M.pbr('bs_tap' + ('r' if k > 0 else 'b'), '#c42a20' if k > 0 else '#2a5ac4', rough=0.4), rot=(90, 0, 0), verts=12, ol=0))
    M.join('wtaps', tap)
    # a laundry basket with clothes
    bk = []
    bm = M.pbr('bs_basket', '#6a8aa8', rough=0.5)
    bk.append(cz.cyl('basket', 0.22, 0.32, (x0 - 0.75, y0 - 0.1, SZ), bm, verts=24, ol=0, r2=0.25))
    for k, c in enumerate(('#c84a3a', '#e8e0d0', '#3a5a8a')):
        bk.append(cz.sphere(f'cloth{k}', 0.12, (x0 - 0.75 + (k - 1) * 0.08, y0 - 0.1 + 0.03 * k, SZ + 0.33), M.pbr(f'bs_cloth{k}', c, rough=0.9, bump=0.5, bump_scale=30), scale=(1.1, 0.9, 0.5), ol=0, segs=12, rings=8))
    basket = M.join('basket', bk)
    return dict(body=body, hose=hose, basket=basket)


def lamp(mt, on=True):
    P = [cz.cyl('lamp_base', 0.06, 0.03, (0.4, 0.4, 0.27), mt['trim'], verts=16, ol=0), cz.cyl('lamp_cord', 0.008, 0.06, (0.4, 0.4, 0.22), mt['dark'], verts=8, ol=0)]
    P.append(cz.sphere('bulb', 0.05, (0.4, 0.4, 0.18), M.pbr('bs_bulb', '#fff2d8', emit='#ffe0b0', emit_strength=6.0 if on else 0.0), ol=0, segs=16, rings=8))
    o = M.join('lamp', P)
    li = cz.light('lamp_light', 'POINT', loc=(0.4, 0.4, 0.05), color='#ffd9a8', power=140 if on else 0, size=0.1, shadow=True)
    return dict(lamp=o, light=li)


def basement_dress(mt):
    """Enrich: a lived-in basement - a water heater, a steel shelf with storage boxes, a rug, the electrical panel,
    a conduit and a second lamp."""
    P = []
    wh = M.pbr('bs_heater', '#e9e7e2', rough=0.35, coat=0.3)
    P.append(cz.cyl('heater', 0.28, 1.45, (2.85, 2.75, SZ), wh, verts=32, ol=0))
    P.append(cz.cyl('heatertop', 0.26, 0.06, (2.85, 2.75, SZ + 1.45), mt['metal'], verts=32, ol=0))
    P.append(C.rod('heaterflue', 0.06, (2.85, 2.75, SZ + 1.5), (2.85, 2.75, 0.25), mt['metal']))
    P.append(cz.box('heaterlbl', (0.18, 0.005, 0.24), (2.85, 2.47, SZ + 0.9), M.pbr('bs_hlbl', '#e8b020', rough=0.4), bevel=0, ol=0))
    for k in (-1, 1):
        P.append(C.rod(f'heaterpipe{k}', 0.018, (2.85 + k * 0.12, 2.75, SZ + 1.5), (2.85 + k * 0.12, 2.75, 0.25), M.pbr('bs_copper', '#c8743a', rough=0.3, metal=1.0)))
    # steel shelf with boxes along the left wall
    sx0 = -3.55
    for z in (SZ + 0.05, SZ + 0.6, SZ + 1.15, SZ + 1.7):
        P.append(cz.box(f'shelf{z:.2f}', (0.45, 1.2, 0.03), (sx0 + 0.22, 0.4, z), mt['metal'], bevel=0.005, ol=0))
    for dy in (-0.58, 0.58):
        for dx in (0.0, 0.42):
            P.append(cz.box(f'upr{dx}{dy}', (0.03, 0.03, 1.75), (sx0 + 0.01 + dx, 0.4 + dy, SZ + 0.875), mt['dark'], bevel=0.004, ol=0))
    r = random.Random(3)
    bxm = [M.pbr('bs_box1', '#b08a5a', rough=0.8, noise=0.2), M.pbr('bs_box2', '#4a6a9a', rough=0.5), M.pbr('bs_box3', '#c8c2b0', rough=0.6)]
    for z in (SZ + 0.065, SZ + 0.615, SZ + 1.165):
        y = -0.15
        while y < 0.95:
            w = r.uniform(0.25, 0.4); h = r.uniform(0.2, 0.4)
            P.append(cz.box(f'sbox{z:.2f}{y:.2f}', (0.38, w - 0.03, h), (sx0 + 0.22, y + w / 2, z + 0.015 + h / 2), r.choice(bxm), bevel=0.01, ol=0))
            y += w
    # rug in the middle of the floor
    P.append(cz.box('rug', (2.4, 1.6, 0.012), (-0.6, 0.6, SZ + 0.006), M.pbr('bs_rug', '#8a3a32', rough=0.95, bump=0.6, bump_scale=40, noise=0.3), bevel=0.004, ol=0))
    P.append(cz.box('rugb', (2.2, 1.4, 0.013), (-0.6, 0.6, SZ + 0.007), M.pbr('bs_rug2', '#c8a070', rough=0.95, bump=0.6, bump_scale=40), bevel=0.004, ol=0))
    # electrical panel + conduit on the back wall
    P.append(cz.box('panel', (0.45, 0.1, 0.7), (-1.3, YB_IN - 0.05, -1.0), mt['metal'], bevel=0.01, ol=0))
    P.append(cz.box('panelline', (0.4, 0.005, 0.003), (-1.3, YB_IN - 0.101, -0.85), mt['dark'], bevel=0, ol=0))
    P.append(C.rod('conduit', 0.016, (-1.3, YB_IN - 0.03, -0.65), (-1.3, YB_IN - 0.03, 0.28), mt['metal']))
    return M.join('bdress', P)


# ---------------------------------------------------------------- site machines + props
def excavator(mt, loc, rotz=180):
    """A yellow mini excavator: rubber tracks with rollers, dozer blade, slewing upper with engine cover and
    counterweight, ROPS cab with glass and seat, boom / stick / bucket with chrome rams. Faces +x before rotz.
    Returns dict(root, boom, stick, bucket) - empties to rotate (degrees about local y)."""
    root = cz.empty('excavator', loc); root.rotation_euler = (0, 0, math.radians(rotz))
    Y, D, R = mt['yellow'], mt['dark'], mt['rubber']
    P = []
    for s in (-1, 1):
        y = s * 0.62
        P.append(cz.box(f'trk{s}', (2.0, 0.34, 0.42), (0, y, 0.21), R, bevel=0.14, ol=0, parent=root))
        for k in range(18):
            P.append(cz.box(f'pad{s}{k}', (0.04, 0.36, 0.03), (-0.85 + k * 0.1, y, 0.015), R, bevel=0.005, ol=0, parent=root))
        for k in range(4):
            P.append(cz.cyl(f'rol{s}{k}', 0.09, 0.05, (-0.6 + k * 0.4, y + s * 0.17, 0.2), D, rot=(90, 0, 0), verts=16, ol=0, parent=root))
        P.append(cz.cyl(f'spr{s}', 0.17, 0.05, (-0.85, y + s * 0.17, 0.22), D, rot=(90, 0, 0), verts=20, ol=0, parent=root))
        P.append(cz.box(f'frm{s}', (1.6, 0.12, 0.16), (0, y - s * 0.2, 0.3), D, bevel=0.02, ol=0, parent=root))
    P.append(cz.box('blade', (0.1, 1.6, 0.36), (1.25, 0, 0.2), Y, rot=(0, -12, 0), bevel=0.02, ol=0, parent=root))
    P.append(cz.box('bladearm', (0.4, 0.8, 0.08), (1.05, 0, 0.32), D, bevel=0.02, ol=0, parent=root))
    P.append(cz.cyl('slew', 0.55, 0.12, (0, 0, 0.42), D, verts=32, ol=0, parent=root))
    P.append(cz.box('upper', (1.6, 1.3, 0.5), (-0.1, 0, 0.8), Y, bevel=0.06, ol=0, parent=root))
    P.append(cz.cyl('cwt', 0.62, 0.5, (-0.45, 0, 0.55), Y, verts=40, ol=0, parent=root))
    P.append(cz.box('engcov', (0.9, 0.7, 0.18), (-0.45, -0.25, 1.12), Y, bevel=0.05, ol=0, parent=root))
    for k in range(6):
        P.append(cz.box(f'grill{k}', (0.5, 0.02, 0.012), (-0.45, -0.61, 0.75 + k * 0.05), D, bevel=0, ol=0, parent=root))
    P.append(cz.cyl('exhaust', 0.03, 0.4, (-0.75, -0.45, 1.1), mt['chrome'], verts=12, ol=0, parent=root))
    # cab: floor, seat, posts, glass, roof
    cx, cy = 0.2, 0.25
    P.append(cz.box('seat', (0.4, 0.45, 0.12), (cx - 0.15, cy, 1.15), D, bevel=0.04, ol=0, parent=root))
    P.append(cz.box('seatb', (0.1, 0.45, 0.5), (cx - 0.36, cy, 1.4), D, bevel=0.04, ol=0, parent=root))
    for k in range(2):
        P.append(cz.box(f'lever{k}', (0.03, 0.03, 0.25), (cx + 0.12, cy + (k - 0.5) * 0.35, 1.25), D, rot=(0, -15, 0), bevel=0.008, ol=0, parent=root))
    for px in (cx - 0.45, cx + 0.4):
        for py in (cy - 0.33, cy + 0.33):
            P.append(cz.box(f'post{px:.1f}{py:.1f}', (0.05, 0.05, 1.15), (px, py, 1.6), D, bevel=0.01, ol=0, parent=root))
    P.append(cz.box('cabroof', (1.0, 0.82, 0.07), (cx - 0.02, cy, 2.2), Y, bevel=0.03, ol=0, parent=root))
    gl = M.pbr('bs_cabglass', '#24323c', rough=0.05, spec=1.0)
    for (sx, sy, x, y) in ((0.01, 0.62, cx + 0.42, cy), (0.85, 0.01, cx - 0.02, cy + 0.35), (0.85, 0.01, cx - 0.02, cy - 0.35)):
        g = cz.box(f'glass{x:.2f}{y:.2f}', (sx, sy, 0.95), (x, y, 1.6), gl, bevel=0, ol=0, parent=root)
        P.append(g)
    P.append(cz.box('decal', (0.5, 0.005, 0.07), (-0.2, -0.652, 0.9), D, bevel=0, ol=0, parent=root))
    P.append(cz.cyl('beacon', 0.05, 0.08, (cx - 0.3, cy - 0.3, 2.24), M.pbr('bs_beacon', '#ff9a20', emit='#ff8a10', emit_strength=1.5), verts=12, ol=0, parent=root))
    # boom (2-piece), stick, bucket on pivots
    bp = cz.empty('boom', (0.8, -0.2, 0.75), parent=root)
    P2 = []
    P2.append(cz.box('boom1', (1.25, 0.18, 0.22), (0.62, 0, 0.3), Y, rot=(0, -28, 0), bevel=0.04, ol=0, parent=bp))
    P2.append(cz.box('boom2', (1.1, 0.17, 0.2), (1.65, 0, 0.42), Y, rot=(0, 18, 0), bevel=0.04, ol=0, parent=bp))
    P2.append(C.rod('bram', 0.05, (0.1, 0, -0.1), (0.95, 0, 0.62), D)); P2[-1].parent = bp
    P2.append(C.rod('bramr', 0.03, (0.95, 0, 0.62), (1.25, 0, 0.75), mt['chrome'])); P2[-1].parent = bp
    sp = cz.empty('stick', (2.15, 0, 0.22), parent=bp)
    P3 = [cz.box('stick1', (0.16, 0.14, 1.25), (0.05, 0, -0.55), Y, rot=(0, 8, 0), bevel=0.04, ol=0, parent=sp)]
    P3.append(C.rod('sram', 0.04, (-0.2, 0, 0.3), (-0.1, 0, -0.6), D)); P3[-1].parent = sp
    P3.append(C.rod('sramr', 0.025, (-0.1, 0, -0.6), (-0.05, 0, -0.95), mt['chrome'])); P3[-1].parent = sp
    kp = cz.empty('bucket', (0.12, 0, -1.15), parent=sp)
    P4 = [cz.box('bk_back', (0.05, 0.42, 0.38), (-0.1, 0, -0.15), D, rot=(0, 20, 0), bevel=0.01, ol=0, parent=kp),
          cz.box('bk_bot', (0.36, 0.42, 0.05), (0.06, 0, -0.32), D, rot=(0, -10, 0), bevel=0.01, ol=0, parent=kp)]
    for s in (-1, 1):
        P4.append(cz.box(f'bk_side{s}', (0.36, 0.03, 0.34), (0.04, s * 0.2, -0.17), D, bevel=0.008, ol=0, parent=kp))
    for k in range(5):
        P4.append(cz.box(f'tooth{k}', (0.1, 0.035, 0.03), (0.27, -0.16 + k * 0.08, -0.34), mt['metal'], bevel=0.006, ol=0, parent=kp))
    load = cz.sphere('bk_load', 0.17, (0.05, 0, -0.18), mt['fill'], scale=(1.1, 1.1, 0.7), ol=0, segs=12, rings=8, parent=kp)
    return dict(root=root, boom=bp, stick=sp, bucket=kp, load=load)


def car(name, mat, loc, scale=0.33, flip=False):
    """A simple sedan (body, cabin, wheels, windows) in one material (the green ghost cars)."""
    P = []
    P.append(cz.box(name + '_b', (4.3, 1.8, 0.62), (0, 0, 0.6), mat, bevel=0.18, ol=0))
    P.append(cz.box(name + '_c', (2.2, 1.6, 0.58), (-0.2, 0, 1.15), mat, bevel=0.22, ol=0))
    for x in (-1.35, 1.35):
        for y in (-0.82, 0.82):
            P.append(cz.cyl(f'{name}_w{x}{y}', 0.36, 0.24, (x, 1.0 if y > 0 else -0.76, 0.36), mat, rot=(90, 0, 0), verts=20, ol=0))
    o = M.join(name, P, apply=True)
    o.location = loc; o.scale = (scale, scale, scale)
    if flip: o.rotation_euler = (0, 0, math.pi)
    return o


def crack_mesh(name, pts, width, mat, normal_axis='x', off=0.0):
    """A jagged crack strip through pts (2D in the face plane), width tapering at the ends.
    normal_axis 'x': pts are (y, z) on a face of constant x=off; 'z': (x, y) on a face of constant z=off."""
    vs, fs = [], []
    n = len(pts)
    for i, (a, b) in enumerate(pts):
        if i < n - 1: da, db = pts[i + 1][0] - a, pts[i + 1][1] - b
        else: da, db = a - pts[i - 1][0], b - pts[i - 1][1]
        L = math.hypot(da, db) or 1; na, nb = -db / L, da / L
        w = width * math.sin(math.pi * (i + 0.5) / n) ** 0.6
        for s in (-1, 1):
            u, v = a + s * na * w, b + s * nb * w
            vs.append((off, u, v) if normal_axis == 'x' else (u, v, off))
    for i in range(n - 1):
        fs.append((2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2))
    return C.mesh(name, vs, fs, mat)


def jag(p0, p1, n, amp, seed):
    r = random.Random(seed); out = []
    for i in range(n + 1):
        k = i / n
        a = p0[0] + (p1[0] - p0[0]) * k; b = p0[1] + (p1[1] - p0[1]) * k
        if 0 < i < n: a += r.uniform(-amp, amp); b += r.uniform(-amp, amp)
        out.append((a, b))
    return out


# ---------------------------------------------------------------- the composer
def scene(F0, F1, stage, house=None, lights=True, mood='day', storm=None, sun_elev=24, sun_rot=325, wet=False,
          dig=None, forms_on=False, yard=True, **kw):
    """Build the world for a shot at `stage`; returns dict S of the parts (S['house'], S['walls'], ...)."""
    C.world(F1, mood=mood, storm=storm, sun_elev=sun_elev, sun_rot=sun_rot, **kw)
    mt = C.mats()
    lv = LV[stage]
    S = dict(mt=mt, lv=lv)
    hole = 'small' if lv == 0 else 'big'
    S['soil'] = C.soil(mt, hole, pit=lv >= LV['pump'], dig=dig)
    if house is None: house = lv == 0 or lv >= LV['backfill']
    if yard: C.yard(mt, hole, house=True)
    if house:
        S['house'] = PH.build(mt, root_loc=(0, 0, -0.25 if lv == 0 else WZ1), lights=lights)
    if lv >= LV['footing']:
        S['foot'] = footings(mt)
        if forms_on: S['forms'] = forms(mt)
    if lv >= LV['walls']:
        S['walls'] = walls(mt)
    if lv >= LV['backfill']:
        S['fill'] = backfill(mt, drain=lv >= LV['drain'], tar=lv >= LV['tar'], wet=wet)
    if lv >= LV['drain']:
        S['drain'] = drain(mt)
        S['gravel'] = gravel(mt, tar=lv >= LV['tar'])
    if lv >= LV['slab']:
        S['under'] = underslab(mt, pit=lv >= LV['pump'])
    if lv >= LV['pump']:
        S['pit'] = pit(mt)
        S['pump'] = pump(mt)
        S['hinge'] = S['pump']['hinge']
    if lv >= LV['battery']:
        S['battery'] = battery(mt)
    if lv >= LV['tar']:
        S['tar'] = tar(mt)
    if lv >= LV['radon']:
        S['radon'] = radon(mt)
    if lv >= LV['finish']:
        S['window'] = window(mt); S['stairs'] = stairs(mt); S['washer'] = washer(mt); S['lamp'] = lamp(mt)
        S['dress'] = basement_dress(mt)
    return S


def float_angle(S, level_fn, f0, f1):
    """Tilt the float rod with the water level: low water hangs down (-35), high floats up (+30)."""
    M.bake_path(S['pump']['hinge'], f0, f1, rot=lambda t: (0, -35 + 65 * level_fn(t), 0))
