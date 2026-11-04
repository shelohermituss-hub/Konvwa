# common.py - the shared kit of "How a Hole Becomes a Basement" (world, materials, the cut soil block, the yard,
# x-ray, gas / water / arrows helpers and the camera). 1 unit = 1 m. The world is CUT at y = YC (the house's front
# facade plane): in front of it is air, so the camera (at -y) looks at the soil's cut face and into the basement.
import bpy, bmesh, math, os, random, sys
import numpy as np
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cz, mega as M
import contact as K     # the overlap gate's declarations (references/contact.md)

FPS = 30
T = lambda f: (f - 1) / FPS                      # frame -> seconds
F = lambda t: round(t * FPS) + 1                 # seconds -> frame
YC = -3.5                                        # the section plane (house facade)
TEX = lambda n: os.path.join(cz.LAB, 'assets', 'mega', n)

# basement geometry (shared by every shot)
WX = 4.0            # wall outer x (walls x in [3.75, 4.0] both sides)
WT = 0.25           # wall thickness
WB = 3.5            # back wall outer y (back wall y in [3.25, 3.5])
WZ0, WZ1 = -2.7, 0.3     # wall bottom / top
FZ0 = -3.0          # footing bottom (footing z in [-3.0, -2.7])
FW = 0.8            # footing width
SZ = -2.55          # slab top
HOLE_SMALL = (-3.6, 3.6, YC, 3.1, -2.6, 0.0)
HOLE_BIG = (-4.6, 4.6, YC, 4.1, -3.0, 0.0)
PIT = (3.2, 0.3, -3.4)    # sump pit centre x, outer radius, bottom z (cut in half by the section plane)


def ss(x): x = max(0.0, min(1.0, x)); return x * x * (3 - 2 * x)
def ramp(t, a, b): return ss((t - a) / max(1e-6, b - a))
def fr(f, a, b): return ss((f - a) / max(1e-6, b - a))     # same on frames


# ---------------------------------------------------------------- mesh helpers
def mesh(name, verts, faces, mat=None, loc=(0, 0, 0), parent=None, smooth=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(map(float, v)) for v in verts], [], [tuple(int(i) for i in f) for f in faces])
    me.update()
    if smooth: me.shade_smooth()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    if parent: ob.parent = parent
    if mat: me.materials.append(mat)
    return ob


def bx(name, b, mat, bevel=0.0, parent=None, origin='center'):
    """Box from bounds (x0, x1, y0, y1, z0, z1)."""
    x0, x1, y0, y1, z0, z1 = b
    if origin == 'bottom':
        return cz.box(name, (x1 - x0, y1 - y0, z1 - z0), ((x0 + x1) / 2, (y0 + y1) / 2, z0), mat, bevel=bevel, ol=0, parent=parent, origin='bottom')
    if origin == 'top':
        return cz.box(name, (x1 - x0, y1 - y0, z1 - z0), ((x0 + x1) / 2, (y0 + y1) / 2, z1), mat, bevel=bevel, ol=0, parent=parent, origin='top')
    return cz.box(name, (x1 - x0, y1 - y0, z1 - z0), ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), mat, bevel=bevel, ol=0, parent=parent)


def box_minus(b, notches):
    """Axis-aligned box b minus a list of axis-aligned notch boxes -> list of box bounds (no overlaps)."""
    out = [tuple(b)]
    for n in notches:
        nxt = []
        for p in out:
            x0, x1, y0, y1, z0, z1 = p
            a = (max(x0, n[0]), min(x1, n[1]), max(y0, n[2]), min(y1, n[3]), max(z0, n[4]), min(z1, n[5]))
            if a[0] >= a[1] - 1e-6 or a[2] >= a[3] - 1e-6 or a[4] >= a[5] - 1e-6:
                nxt.append(p); continue
            if a[0] > x0: nxt.append((x0, a[0], y0, y1, z0, z1))
            if a[1] < x1: nxt.append((a[1], x1, y0, y1, z0, z1))
            if a[2] > y0: nxt.append((a[0], a[1], y0, a[2], z0, z1))
            if a[3] < y1: nxt.append((a[0], a[1], a[3], y1, z0, z1))
            if a[4] > z0: nxt.append((a[0], a[1], a[2], a[3], z0, a[4]))
            if a[5] < z1: nxt.append((a[0], a[1], a[2], a[3], a[5], z1))
        out = nxt
    return out


def boxes(name, b, notches, mat, parent=None):
    obs = [bx(f'{name}{i}', p, mat, parent=parent) for i, p in enumerate(box_minus(b, notches))]
    return M.join(name, obs) if len(obs) > 1 else obs[0]


def tube(name, r_out, r_in, p0, p1, mat, verts=32, mat_in=None, half=False):
    """An open pipe from p0 to p1 (walls with thickness, ring ends). half=True: only the +y half (cut by the section)."""
    p0, p1 = Vector(p0), Vector(p1)
    ax = (p1 - p0); L = ax.length
    n = verts
    vs, fs = [], []
    a0, a1 = (0.0, math.pi) if half else (0.0, 2 * math.pi)
    segs = n if not half else n // 2
    ring = [(math.cos(a0 + (a1 - a0) * i / segs), math.sin(a0 + (a1 - a0) * i / segs)) for i in range(segs + (1 if half else 0))]
    m = len(ring)
    for z in (0.0, L):
        for (c, s) in ring: vs.append((r_out * c, r_out * s, z))
        for (c, s) in ring: vs.append((r_in * c, r_in * s, z))
    O0, I0, O1, I1 = 0, m, 2 * m, 3 * m
    rng = range(m) if not half else range(m - 1)
    for i in rng:
        j = (i + 1) % m
        fs.append((O0 + i, O0 + j, O1 + j, O1 + i))
        fs.append((I0 + j, I0 + i, I1 + i, I1 + j))
        fs.append((O0 + j, O0 + i, I0 + i, I0 + j))
        fs.append((O1 + i, O1 + j, I1 + j, I1 + i))
    if half:   # the two cut edges along the length
        for i in (0, m - 1):
            fs.append((O0 + i, I0 + i, I1 + i, O1 + i))
    ob = mesh(name, vs, fs, mat, smooth=True)
    if mat_in:
        ob.data.materials.append(mat_in)
        for k, p in enumerate(ob.data.polygons):
            if k % 4 == 1 and k < len(rng) * 4: p.material_index = 1
    q = Vector((0, 0, 1)).rotation_difference(ax.normalized())
    ob.rotation_mode = 'QUATERNION'; ob.rotation_quaternion = q; ob.location = p0
    return ob


def rod(name, r, p0, p1, mat, verts=16):
    """A solid cylinder from p0 to p1."""
    p0, p1 = Vector(p0), Vector(p1); ax = p1 - p0
    o = cz.cyl(name, r, ax.length, (0, 0, 0), mat, verts=verts, ol=0)
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(ax.normalized()); o.location = p0
    return o


def no_shadow(ob):
    try: ob.visible_shadow = False
    except Exception: pass


def bake_mods(ob):
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    ob.modifiers.clear(); ob.data = me


def show(objs, t0, t1, f0, f1):
    for o in (objs if isinstance(objs, (list, tuple)) else [objs]):
        if o is not None: M.visible(o, [(t0, t1)], f0, f1)


# ---------------------------------------------------------------- materials
def _mat(name):
    m = bpy.data.materials.get(name)
    if m: return m, None
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    return m, (nt, nt.nodes.new('ShaderNodeOutputMaterial'))


def _math(nt, op, a, b=None, v=None):
    n = nt.nodes.new('ShaderNodeMath'); n.operation = op
    for k, s in enumerate((a, b)):
        if s is None: continue
        if isinstance(s, (int, float)): n.inputs[k].default_value = s
        else: nt.links.new(s, n.inputs[k])
    return n.outputs[0]


def _mix(nt, fac, a, b, blend='MIX'):
    n = nt.nodes.new('ShaderNodeMix'); n.data_type = 'RGBA'; n.blend_type = blend
    if isinstance(fac, (int, float)): n.inputs[0].default_value = fac
    else: nt.links.new(fac, n.inputs[0])
    for k, s in ((6, a), (7, b)):
        if isinstance(s, (tuple, list)): n.inputs[k].default_value = s
        elif isinstance(s, str): n.inputs[k].default_value = cz.col(s)
        else: nt.links.new(s, n.inputs[k])
    return n.outputs[2]


def soil_mat(name='bs_soil', wet=False, fill=False, tint=None):
    """The cut earth: lumpy clods first, faint wavy strata (dark topsoil, brown loam, ochre clay, grey-brown gravel deep),
    the Flow dirt texture for grain, pebble bump; grass on up-facing faces at the surface. World coords: every soil
    box matches its neighbours. fill=True: mixed backfill (no strata). wet=True: darker and glossier."""
    m, n = _mat(name)
    if n is None: return m
    nt, o = n
    p = nt.nodes.new('ShaderNodeBsdfPrincipled')
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Position'], sep.inputs[0])
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 0.45; nz.inputs['Detail'].default_value = 5
    nt.links.new(geo.outputs['Position'], nz.inputs[0])
    zz = _math(nt, 'ADD', sep.outputs[2], _math(nt, 'MULTIPLY', _math(nt, 'SUBTRACT', nz.outputs['Fac'], 0.5), 1.4))
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs[1].default_value = -9.0; mr.inputs[2].default_value = 0.0
    nt.links.new(zz, mr.inputs[0])
    cr = nt.nodes.new('ShaderNodeValToRGB'); el = cr.color_ramp.elements
    stops = [(0.0, '#4c443d'), (0.33, '#665240'), (0.5, '#9c6c3a'), (0.66, '#87593a'), (0.82, '#6a4930'), (0.93, '#3a281c'), (1.0, '#2a1d15')]
    if fill: stops = [(0.0, '#5e4430'), (1.0, '#5e4430')]
    el[0].position, el[0].color = stops[0][0], cz.col(stops[0][1]); el[1].position, el[1].color = stops[-1][0], cz.col(stops[-1][1])
    for pos, c in stops[1:-1]:
        e = el.new(pos); e.color = cz.col(c)
    nt.links.new(mr.outputs[0], cr.inputs[0])
    col = cr.outputs[0]
    # clods: voronoi cells with darker cracks between them + mottled noise
    vo = nt.nodes.new('ShaderNodeTexVoronoi'); vo.feature = 'DISTANCE_TO_EDGE'; vo.inputs['Scale'].default_value = 2.4
    wn = nt.nodes.new('ShaderNodeTexNoise'); wn.inputs['Scale'].default_value = 1.3; wn.inputs['Detail'].default_value = 3
    nt.links.new(geo.outputs['Position'], wn.inputs[0])
    wv = nt.nodes.new('ShaderNodeVectorMath'); wv.operation = 'MULTIPLY_ADD'; wv.inputs[1].default_value = (0.35, 0.35, 0.35)
    nt.links.new(wn.outputs['Color'], wv.inputs[0]); nt.links.new(geo.outputs['Position'], wv.inputs[2])
    nt.links.new(wv.outputs[0], vo.inputs['Vector'])
    ed = nt.nodes.new('ShaderNodeMapRange'); ed.inputs[1].default_value = 0.0; ed.inputs[2].default_value = 0.12
    ed.inputs[3].default_value = 0.87; ed.inputs[4].default_value = 1.0
    nt.links.new(vo.outputs['Distance'], ed.inputs[0])
    mo = nt.nodes.new('ShaderNodeTexNoise'); mo.inputs['Scale'].default_value = 2.5; mo.inputs['Detail'].default_value = 8
    nt.links.new(geo.outputs['Position'], mo.inputs[0])
    mo2 = nt.nodes.new('ShaderNodeMapRange'); mo2.inputs[3].default_value = 0.72; mo2.inputs[4].default_value = 1.18
    nt.links.new(mo.outputs['Fac'], mo2.inputs[0])
    shade = _math(nt, 'MULTIPLY', ed.outputs[0], mo2.outputs[0])
    col = _mix(nt, 1.0, col, (1, 1, 1, 1), 'MULTIPLY')
    cm = nt.nodes.new('ShaderNodeCombineColor'); nt.links.new(shade, cm.inputs[0]); nt.links.new(shade, cm.inputs[1]); nt.links.new(shade, cm.inputs[2])
    col = _mix(nt, 1.0, col, cm.outputs[0], 'MULTIPLY')
    # Flow dirt grain (box projection in world coords)
    if os.path.exists(TEX('dirt_dark.png')):
        mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (0.55, 0.55, 0.55)
        nt.links.new(geo.outputs['Position'], mp.inputs[0])
        ti = nt.nodes.new('ShaderNodeTexImage'); ti.image = cz.image(TEX('dirt_dark.png')); ti.projection = 'BOX'; ti.projection_blend = 0.3
        nt.links.new(mp.outputs[0], ti.inputs[0])
        col = _mix(nt, 0.45, col, ti.outputs[0], 'OVERLAY')
    if wet: col = _mix(nt, 1.0, col, (0.62, 0.6, 0.62, 1), 'MULTIPLY')
    if tint: col = _mix(nt, 0.85, col, tint, 'COLOR')
    # grass on up-facing faces at the surface
    nzc = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Normal'], nzc.inputs[0])
    up = _math(nt, 'GREATER_THAN', nzc.outputs[2], 0.6)
    top = _math(nt, 'GREATER_THAN', sep.outputs[2], -0.06)
    gk = _math(nt, 'MULTIPLY', up, top)
    if os.path.exists(TEX('r1_grass.png')):
        mpg = nt.nodes.new('ShaderNodeMapping'); mpg.inputs['Scale'].default_value = (0.3, 0.3, 0.3)
        nt.links.new(geo.outputs['Position'], mpg.inputs[0])
        tg = nt.nodes.new('ShaderNodeTexImage'); tg.image = cz.image(TEX('r1_grass.png')); tg.projection = 'BOX'
        nt.links.new(mpg.outputs[0], tg.inputs[0])
        gcol = _mix(nt, 1.0, tg.outputs[0], '#a8c890', 'MULTIPLY')
    else:
        gcol = cz.col('#4f7d32')
    col = _mix(nt, gk, col, gcol)
    nt.links.new(col, p.inputs['Base Color'])
    p.inputs['Roughness'].default_value = 0.5 if wet else 0.93
    try: p.inputs['Specular IOR Level'].default_value = 0.45 if wet else 0.25
    except Exception: pass
    # bump: clod edges + fine grain + pebbles
    vb = nt.nodes.new('ShaderNodeTexVoronoi'); vb.inputs['Scale'].default_value = 14
    nt.links.new(geo.outputs['Position'], vb.inputs['Vector'])
    hb = _math(nt, 'ADD', _math(nt, 'MULTIPLY', ed.outputs[0], 0.6), _math(nt, 'MULTIPLY', mo.outputs['Fac'], 0.5))
    hb = _math(nt, 'SUBTRACT', hb, _math(nt, 'MULTIPLY', vb.outputs['Distance'], 0.25))
    b = nt.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value = 0.55; b.inputs['Distance'].default_value = 0.05
    nt.links.new(hb, b.inputs['Height']); nt.links.new(b.outputs[0], p.inputs['Normal'])
    nt.links.new(p.outputs[0], o.inputs[0])
    return m


def siding_mat(name='bs_siding', color='#ece8df', board=0.2):
    """Painted lap siding: each board darker in the shadow line under the lap, bump slopes each board."""
    m, n = _mat(name)
    if n is None: return m
    nt, o = n
    p = nt.nodes.new('ShaderNodeBsdfPrincipled'); p.inputs['Roughness'].default_value = 0.55
    geo = nt.nodes.new('ShaderNodeNewGeometry'); sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(geo.outputs['Position'], sep.inputs[0])
    fz = _math(nt, 'FRACT', _math(nt, 'DIVIDE', sep.outputs[2], board))
    sh = nt.nodes.new('ShaderNodeMapRange'); sh.inputs[1].default_value = 0.0; sh.inputs[2].default_value = 0.14
    sh.inputs[3].default_value = 0.55; sh.inputs[4].default_value = 1.0
    nt.links.new(fz, sh.inputs[0])
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 6; nz.inputs['Detail'].default_value = 6
    nt.links.new(geo.outputs['Position'], nz.inputs[0])
    gr = nt.nodes.new('ShaderNodeMapRange'); gr.inputs[3].default_value = 0.88; gr.inputs[4].default_value = 1.04
    nt.links.new(nz.outputs['Fac'], gr.inputs[0])
    k = _math(nt, 'MULTIPLY', sh.outputs[0], gr.outputs[0])
    cm = nt.nodes.new('ShaderNodeCombineColor')
    for i in range(3): nt.links.new(k, cm.inputs[i])
    nt.links.new(_mix(nt, 1.0, color, cm.outputs[0], 'MULTIPLY'), p.inputs['Base Color'])
    b = nt.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value = 0.5; b.inputs['Distance'].default_value = 0.02
    nt.links.new(fz, b.inputs['Height']); nt.links.new(b.outputs[0], p.inputs['Normal'])
    nt.links.new(p.outputs[0], o.inputs[0])
    return m


def brick_mat(name='bs_brick'):
    m, n = _mat(name)
    if n is None: return m
    nt, o = n
    p = nt.nodes.new('ShaderNodeBsdfPrincipled'); p.inputs['Roughness'].default_value = 0.85
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    br = nt.nodes.new('ShaderNodeTexBrick'); br.inputs['Scale'].default_value = 4.0
    br.inputs['Color1'].default_value = cz.col('#8a3e2c'); br.inputs['Color2'].default_value = cz.col('#6e2f22')
    br.inputs['Mortar'].default_value = cz.col('#b8b0a4'); br.inputs['Mortar Size'].default_value = 0.012
    br.inputs['Brick Width'].default_value = 0.5; br.inputs['Row Height'].default_value = 0.18
    nt.links.new(geo.outputs['Position'], br.inputs['Vector'])
    nt.links.new(br.outputs['Color'], p.inputs['Base Color'])
    b = nt.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value = 0.4
    nt.links.new(br.outputs['Fac'], b.inputs['Height']); nt.links.new(b.outputs[0], p.inputs['Normal'])
    nt.links.new(p.outputs[0], o.inputs[0])
    return m


def gravel_mat(name='bs_gravel'):
    """Washed stone: voronoi cells shaded as rounded grey-tan stones with dark gaps."""
    m, n = _mat(name)
    if n is None: return m
    nt, o = n
    p = nt.nodes.new('ShaderNodeBsdfPrincipled'); p.inputs['Roughness'].default_value = 0.7
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    vo = nt.nodes.new('ShaderNodeTexVoronoi'); vo.inputs['Scale'].default_value = 22
    nt.links.new(geo.outputs['Position'], vo.inputs['Vector'])
    vd = nt.nodes.new('ShaderNodeTexVoronoi'); vd.feature = 'DISTANCE_TO_EDGE'; vd.inputs['Scale'].default_value = 22
    nt.links.new(geo.outputs['Position'], vd.inputs['Vector'])
    ed = nt.nodes.new('ShaderNodeMapRange'); ed.inputs[2].default_value = 0.18; ed.inputs[3].default_value = 0.15; ed.inputs[4].default_value = 1.0
    nt.links.new(vd.outputs['Distance'], ed.inputs[0])
    cr = nt.nodes.new('ShaderNodeValToRGB')
    cr.color_ramp.elements[0].color = cz.col('#6d6a64'); cr.color_ramp.elements[1].color = cz.col('#b9b2a4')
    nt.links.new(vo.outputs['Color'], cr.inputs[0])
    cm = nt.nodes.new('ShaderNodeCombineColor')
    for i in range(3): nt.links.new(ed.outputs[0], cm.inputs[i])
    nt.links.new(_mix(nt, 1.0, cr.outputs[0], cm.outputs[0], 'MULTIPLY'), p.inputs['Base Color'])
    b = nt.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value = 0.9; b.inputs['Distance'].default_value = 0.03
    nt.links.new(ed.outputs[0], b.inputs['Height']); nt.links.new(b.outputs[0], p.inputs['Normal'])
    nt.links.new(p.outputs[0], o.inputs[0])
    return m


def glass_water(name='bs_water', color='#1f6fe8', alpha=0.55, strength=0.18, rough=0.06, spec=0.9, method='BLENDED'):
    """Blue water that reads in a section: translucent, glossy, a little glow so it stays blue in shade."""
    m, n = _mat(name)
    if n is None: return m
    nt, o = n
    m.surface_render_method = method
    p = nt.nodes.new('ShaderNodeBsdfPrincipled')
    p.inputs['Base Color'].default_value = cz.col(color); p.inputs['Roughness'].default_value = rough
    p.inputs['Emission Color'].default_value = cz.col(color); p.inputs['Emission Strength'].default_value = strength
    try: p.inputs['Specular IOR Level'].default_value = spec
    except Exception: pass
    tc = nt.nodes.new('ShaderNodeTexCoord'); nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 7
    nt.links.new(tc.outputs['Object'], nz.inputs[0])
    b = nt.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value = 0.15
    nt.links.new(nz.outputs['Fac'], b.inputs['Height']); nt.links.new(b.outputs[0], p.inputs['Normal'])
    g = nt.nodes.new('ShaderNodeValue'); g.name = 'gate'; g.outputs[0].default_value = alpha
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(g.outputs[0], mx.inputs[0]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(p.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], o.inputs[0])
    return m


def soft_mat(name, color, alpha=0.5, strength=0.6):
    """A soft see-through puff (gas, breath): emissive colour, alpha falls off toward the silhouette."""
    m, n = _mat(name)
    if n is None: return m
    nt, o = n
    m.surface_render_method = 'BLENDED'
    try: m.use_transparency_overlap = False
    except Exception: pass
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs[0].default_value = cz.col(color); em.inputs[1].default_value = strength
    lw = nt.nodes.new('ShaderNodeLayerWeight'); lw.inputs[0].default_value = 0.5
    fa = _math(nt, 'POWER', _math(nt, 'SUBTRACT', 1.0, lw.outputs['Facing']), 1.6)
    g = nt.nodes.new('ShaderNodeValue'); g.name = 'gate'; g.outputs[0].default_value = alpha
    k = _math(nt, 'MULTIPLY', fa, g.outputs[0])
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(k, mx.inputs[0]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], o.inputs[0])
    return m


def flow_mat(name, f0, f1, speed=2.0, axis='Z', color='#3a90ea', alpha=0.85, sign=1, strength=0.35, stretch=(30, 30, 2.0)):
    """Flowing water in a pipe / a stream: streaky noise scrolling along `axis` (object coords)."""
    m, n = _mat(name)
    if n is None: return m
    nt, o = n
    m.surface_render_method = 'BLENDED'
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping')
    sc = {'X': (stretch[2], stretch[0], stretch[1]), 'Y': (stretch[0], stretch[2], stretch[1]), 'Z': stretch}[axis]
    mp.inputs['Scale'].default_value = sc
    nt.links.new(tc.outputs['Object'], mp.inputs[0])
    idx = 'XYZ'.index(axis)
    for f in (f0 - 2, f1 + 2):
        v = [0, 0, 0]; v[idx] = -sign * speed * (f - f0) / FPS
        mp.inputs['Location'].default_value = v; mp.inputs['Location'].keyframe_insert('default_value', frame=f)
    M._linear(m.node_tree)
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 1.0; nz.inputs['Detail'].default_value = 4
    nt.links.new(mp.outputs[0], nz.inputs[0])
    cr = nt.nodes.new('ShaderNodeMapRange'); cr.inputs[1].default_value = 0.4; cr.inputs[2].default_value = 0.68
    cr.inputs[3].default_value = 0.55; cr.inputs[4].default_value = 1.0
    nt.links.new(nz.outputs['Fac'], cr.inputs[0])
    g = nt.nodes.new('ShaderNodeValue'); g.name = 'gate'; g.outputs[0].default_value = alpha
    k = _math(nt, 'MULTIPLY', cr.outputs[0], g.outputs[0])
    p = nt.nodes.new('ShaderNodeBsdfPrincipled'); p.inputs['Roughness'].default_value = 0.05
    p.inputs['Base Color'].default_value = cz.col(color)
    p.inputs['Emission Color'].default_value = cz.col(color); p.inputs['Emission Strength'].default_value = strength
    lt = _mix(nt, cr.outputs[0], '#ffffff', color)
    nt.links.new(lt, p.inputs['Base Color'])
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(k, mx.inputs[0]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(p.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], o.inputs[0])
    return m


def gate_keys(mat, keys):
    g = mat.node_tree.nodes['gate']
    for t, v in keys:
        g.outputs[0].default_value = v; g.outputs[0].keyframe_insert('default_value', frame=F(t))


def emit_keys(mat, keys, node='Emission Strength'):
    """Key a Principled material's emission strength [(t, v)]."""
    p = next(n for n in mat.node_tree.nodes if n.type in ('BSDF_PRINCIPLED', 'EMISSION'))
    s = p.inputs[node] if node in p.inputs else p.inputs[1]
    for t, v in keys:
        s.default_value = v; s.keyframe_insert('default_value', frame=F(t))


def mats():
    """The film's materials (made once per shot build)."""
    return dict(
        soil=soil_mat('bs_soil'),
        fill=soil_mat('bs_fill', fill=True),
        wetfill=soil_mat('bs_wetfill', fill=True, wet=True),
        wetsoil=soil_mat('bs_wetsoil', wet=True),
        concrete=M.pbr('bs_concrete', '#aaa69d', rough=0.82, bump=0.22, bump_scale=28, noise=0.35),
        concrete_wet=M.pbr('bs_concrete_wet', '#6f6c66', rough=0.45, bump=0.22, bump_scale=28, noise=0.4),
        fresh=M.pbr('bs_fresh', '#8d8a84', rough=0.35, bump=0.35, bump_scale=9, noise=0.3, spec=0.6),
        siding=siding_mat('bs_siding'),
        trim=M.pbr('bs_trim', '#f4f2ec', rough=0.45),
        shutter=M.pbr('bs_shutter', '#33465a', rough=0.5),
        door=M.pbr('bs_door', '#7a2a22', rough=0.4, coat=0.3),
        shingle=M.pbr('bs_shingle', '#5a5c62', rough=0.85, img=TEX('r1_shingle.png') if os.path.exists(TEX('r1_shingle.png')) else None,
                      scale=0.5, tint='#a8a8b0', bump=0.35, bump_scale=40),
        wood=M.pbr('bs_wood', '#b08456', rough=0.6, img=TEX('r1_wood.png') if os.path.exists(TEX('r1_wood.png')) else None, scale=0.8, bump=0.1, bump_scale=30),
        wood_dark=M.pbr('bs_wood_dark', '#6b4a30', rough=0.6, img=TEX('r1_wood.png') if os.path.exists(TEX('r1_wood.png')) else None, scale=0.8, tint='#7a5a40'),
        form=M.pbr('bs_form', '#c49a62', rough=0.6, img=TEX('r1_wood.png') if os.path.exists(TEX('r1_wood.png')) else None, scale=1.2, tint='#e8c8a0'),
        glass=M.pbr('bs_glass', '#1c2a36', rough=0.04, spec=1.0),
        brick=brick_mat('bs_brick'),
        metal=M.steel('bs_metal', color='#c4c8cc', rough=0.3),
        dark=M.pbr('bs_dark', '#1a1b1e', rough=0.5, metal=0.3),
        black=M.pbr('bs_black', '#141414', rough=0.55, bump=0.3, bump_scale=60),
        pvc=M.pbr('bs_pvc', '#f2f2ee', rough=0.3, spec=0.6),
        tar=M.pbr('bs_tar', '#0d0d0f', rough=0.18, spec=0.8, bump=0.5, bump_scale=14),
        gravel=gravel_mat('bs_gravel'),
        pebble=M.pbr('bs_pebble', '#756a5c', rough=0.7, noise=0.6, bump=0.5),
        rebar=M.pbr('bs_rebar', '#6e4a36', rough=0.55, metal=0.7, bump=0.6, bump_scale=50, noise=0.4),
        water=glass_water('bs_water'),
        yellow=M.pbr('bs_yellow', '#e9a81e', rough=0.42, metal=0.15, noise=0.12),
        rubber=M.pbr('bs_rubber', '#1b1b1d', rough=0.8, bump=0.3, bump_scale=30),
        chrome=M.steel('bs_chrome', color='#e8eaee', rough=0.12),
        warm=M.emit('bs_warm', '#ffd8a0', 1.2),
        xray=M.xray('bs_xray'),
        arrow=M.pbr('bs_arrow', '#f0a030', rough=0.4, emit='#f0a030', emit_strength=0.6),
        blue_arrow=M.pbr('bs_barrow', '#3a8ef0', rough=0.3, emit='#3a8ef0', emit_strength=0.8),
    )


# ---------------------------------------------------------------- world
def world(f1, mood='day', sun_elev=24, sun_rot=300, storm=None, **kw):
    """M.setup in the film's look: a low warm sun from the front-left rakes the cut face. mood 'golden' for the end.
    storm=[(t, 0..1)]: the sky darkens + greys, the sun dims, a cloud deck fades in."""
    kw.setdefault('samples', 16); kw.setdefault('sky_sat', 1.8); kw.setdefault('sun_power', 4.0)
    kw.setdefault('light_k', 1.15); kw.setdefault('exposure', -0.25); kw.setdefault('haze', 0.15); kw.setdefault('mb', 0.4)
    if storm: kw['sun_disc'] = False
    if mood == 'golden': sun_elev = min(sun_elev, 14)
    sc = M.setup(f1 + 2, sun_elev=sun_elev, sun_rot=sun_rot, **kw)
    sun = bpy.data.objects['sun'].data
    sun.color = (1.0, 0.76, 0.5) if mood == 'golden' else (1.0, 0.92, 0.8)
    if storm:
        nt = sc.world.node_tree
        bgs = [n for n in nt.nodes if n.type == 'BACKGROUND']
        hss = [n for n in nt.nodes if n.type == 'HUE_SAT']
        b0 = [b.inputs[1].default_value for b in bgs]; h0 = [h.inputs['Saturation'].default_value for h in hss]
        e0 = sun.energy
        deck = cloud_deck()
        gate = deck.data.materials[0].node_tree.nodes['gate']
        for t, s in storm:
            f = F(t)
            for b, v in zip(bgs, b0):
                b.inputs[1].default_value = v * (1 - 0.7 * s); b.inputs[1].keyframe_insert('default_value', frame=f)
            for h, v in zip(hss, h0):
                h.inputs['Saturation'].default_value = v * (1 - 0.75 * s); h.inputs['Saturation'].keyframe_insert('default_value', frame=f)
            sun.energy = e0 * (1 - 0.82 * s); sun.keyframe_insert('energy', frame=f)
            gate.outputs[0].default_value = s; gate.outputs[0].keyframe_insert('default_value', frame=f)
    # a soft camera-side fill so the basement interior never goes black (library: fill-and-bounce-for-dark-faces)
    fl = cz.light('fill', 'AREA', loc=(0, -14, 2), rot=(80, 0, 0), color='#dfe8ff', power=700, size=14, shadow=False)
    fl.data.energy = 700 * (0.6 if storm else 1.0)
    # the cut, declared once for the overlap gate: the soil block in front of y = YC is open (the camera side); the house
    # standing on the ground is not part of the cut (box = the soil and the basement, below the ground line)
    K.section((0, YC, 0), (0, -1, 0), 'section', box=(-30, 30, YC - 20, 70, -16, 0.0))
    return sc


def cloud_deck(z=60, size=2200):
    m, n = _mat('bs_clouds')
    if n:
        nt, o = n
        m.surface_render_method = 'BLENDED'
        tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (0.012, 0.02, 0.012)
        nt.links.new(tc.outputs['Object'], mp.inputs[0])
        nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 3.0; nz.inputs['Detail'].default_value = 10; nz.inputs['Roughness'].default_value = 0.62
        nt.links.new(mp.outputs[0], nz.inputs[0])
        cr = nt.nodes.new('ShaderNodeValToRGB'); cr.color_ramp.elements[0].position = 0.35; cr.color_ramp.elements[1].position = 0.7
        cr.color_ramp.elements[0].color = (0.04, 0.045, 0.055, 1); cr.color_ramp.elements[1].color = (0.2, 0.22, 0.26, 1)
        nt.links.new(nz.outputs['Fac'], cr.inputs[0])
        al = nt.nodes.new('ShaderNodeMapRange'); al.inputs[1].default_value = 0.3; al.inputs[2].default_value = 0.55
        nt.links.new(nz.outputs['Fac'], al.inputs[0])
        g = nt.nodes.new('ShaderNodeValue'); g.name = 'gate'; g.outputs[0].default_value = 0
        mul = _math(nt, 'MULTIPLY', al.outputs[0], g.outputs[0])
        em = nt.nodes.new('ShaderNodeEmission'); nt.links.new(cr.outputs[0], em.inputs[0]); em.inputs[1].default_value = 1.0
        tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
        nt.links.new(mul, mx.inputs[0]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2])
        nt.links.new(mx.outputs[0], o.inputs[0])
    ob = M.heightfield('clouds', 2 * size, 64, lambda X, Y: -((X * X + Y * Y) / (size * size)) * (z + 260), mat=m, loc=(0, 0, z), smooth=True)
    no_shadow(ob)
    return ob


# ---------------------------------------------------------------- the soil block + yard
def soil(mt, hole='big', pit=False, dig=None):
    """The cut earth block (x +-30, y YC..70, z -16..0) minus the hole (and the sump pit notch).
    dig=(f0, f1, fa, fb): a fill box inside the hole whose top lowers from the grass to the hole floor between fa..fb."""
    H = HOLE_BIG if hole == 'big' else HOLE_SMALL if hole == 'small' else None
    notches = [H] if H else []
    if pit:
        px, pr, pz = PIT
        notches.append((px - pr, px + pr, YC, YC + pr + 0.02, pz, 0.0))
    # the soil around the hole, the deep layers in one block
    out = dict(blocks=boxes('soil', (-30, 30, YC, 70, -16, 0), notches, mt['soil']))
    if dig and H:
        f0, f1, fa, fb = dig
        x0, x1, y0, y1, z0, z1 = H
        fill = bx('digfill', (x0 + 0.002, x1 - 0.002, y0, y1 - 0.002, z0 + 0.002, z1), mt['soil'], origin='bottom')
        M.bake_path(fill, f0, f1, scale=lambda t: (1, 1, max(0.002, 1 - ss((F(t) - fa) / (fb - fa)))))
        out['fill'] = fill
    pebbles(mt, H, pit)
    return out


def pebbles(mt, hole, pit, n=240, seed=7):
    """Stones half-buried in the cut face (real relief) + a few roots in the topsoil."""
    r = random.Random(seed); obs = []
    for i in range(n):
        x = r.uniform(-14, 14); z = -r.uniform(0.25, 11) ** 1.0
        if hole and hole[0] - 0.15 < x < hole[1] + 0.15 and z > hole[4] - 0.15: continue
        if abs(x) < 4.4 and z > FZ0 - 0.3: continue
        s = r.uniform(0.025, 0.09) ** 1.0 * (1.5 if z < -5 else 1.0) * (1.8 if r.random() < 0.1 else 1.0)
        o = cz.sphere(f'peb{i}', 1.0, (x, YC + s * 0.15, z), mt['pebble'], scale=(s * r.uniform(1.0, 1.6), s * 0.6, s * r.uniform(0.6, 1.0)), ol=0, segs=8, rings=5)
        o.rotation_euler = (0, r.uniform(-0.5, 0.5), 0); obs.append(o)
    root = M.pbr('bs_root', '#7a5a3e', rough=0.8, noise=0.3)
    for i in range(46):
        x = r.uniform(-14, 14)
        if hole and hole[0] - 0.1 < x < hole[1] + 0.1: continue
        z0 = -r.uniform(0.05, 0.25); L = r.uniform(0.15, 0.6); a = r.uniform(-50, 50)
        p0 = (x, YC + 0.004, z0); p1 = (x + L * math.sin(math.radians(a)), YC + 0.004, z0 - L * math.cos(math.radians(a)))
        obs.append(rod(f'root{i}', r.uniform(0.004, 0.012), p0, p1, root, verts=6))
    j = M.join('pebbles', obs)
    if j is not None: j['cz_section_ok'] = True      # half-proud of the cut face on purpose (the soil's relief)
    return j


def grass_blades(n=26000, seed=3, area=(-14, 14, YC, 9.0), avoid=()):
    """Thin blades on the yard (one joined mesh); dense along the cut lip so the edge has a real silhouette."""
    rng = np.random.default_rng(seed)
    N = n * 2
    X = rng.uniform(area[0], area[1], N)
    Y = area[2] + (area[3] - area[2]) * rng.uniform(0, 1, N) ** 2.2
    keep = np.ones(N, bool)
    for (x0, x1, y0, y1) in avoid: keep &= ~((X > x0) & (X < x1) & (Y > y0) & (Y < y1))
    keep &= Y > YC + 0.01
    X, Y = X[keep][:n], Y[keep][:n]; n = len(X)
    h = rng.uniform(0.07, 0.2, n); wdt = rng.uniform(0.008, 0.016, n); th = rng.uniform(0, 2 * np.pi, n)
    lean = rng.uniform(-0.05, 0.05, (n, 2))
    lean[:, 1] += np.where(Y < YC + 0.15, -0.06, 0)          # the lip blades lean out over the edge
    c, s = np.cos(th), np.sin(th)
    v = np.zeros((n, 3, 3))
    v[:, 0] = np.stack([X - c * wdt, Y - s * wdt, np.zeros(n)], 1)
    v[:, 1] = np.stack([X + c * wdt, Y + s * wdt, np.zeros(n)], 1)
    v[:, 2] = np.stack([X + lean[:, 0], Y + lean[:, 1], h], 1)
    gm = M.pbr('bs_blade', '#4a7a2a', rough=0.65, noise=0.6, bump=0.2)
    return mesh('grass_blades', v.reshape(-1, 3), np.arange(n * 3).reshape(n, 3), gm)


_TREE = {}


def tree(name, loc, h, seed=1):
    if not _TREE:
        _TREE['bark'] = M.pbr('bs_bark', '#4a3626', rough=0.85, bump=0.6, bump_scale=14, noise=0.4)
        _TREE['leaf'] = M.pbr('bs_leaf', '#3a6a26', rough=0.6, img=TEX('r1_leaves.png') if os.path.exists(TEX('r1_leaves.png')) else None,
                              scale=0.55, bump=0.7, bump_scale=14, tint='#c8d8b0')
    r = random.Random(seed); parts = []
    parts.append(cz.cyl(name + '_trunk', 0.16 * h / 6, h * 0.55, loc, _TREE['bark'], verts=12, ol=0, r2=0.1 * h / 6))
    for k in range(4):
        a = k * 1.57 + r.uniform(-0.3, 0.3)
        parts.append(cz.cyl(f'{name}_br{k}', 0.045 * h / 6, h * 0.25, (loc[0], loc[1], loc[2] + h * 0.35), _TREE['bark'], rot=(55, 0, math.degrees(a)), verts=8, ol=0))
    for k in range(14):
        a = r.uniform(0, 6.283); d = r.uniform(0, h * 0.18); z = r.uniform(0, h * 0.4)
        s = r.uniform(0.16, 0.27) * h * (1 - z / (h * 0.95))
        b = cz.sphere(f'{name}_b{k}', 1.0, (loc[0] + d * math.cos(a), loc[1] + d * math.sin(a), loc[2] + h * 0.5 + z), _TREE['leaf'], scale=(s, s, s * 0.85), ol=0, segs=14, rings=8)
        M.displace(b, strength=s * 0.35, scale=0.6 / max(0.3, s)); bake_mods(b)
        parts.append(b)
    return M.join(name, parts)


def fence(mt, y=13.0, x0=-13, x1=13):
    parts = []
    n = int((x1 - x0) / 0.16)
    for i in range(n):
        x = x0 + i * 0.16
        parts.append(cz.box(f'pk{i}', (0.09, 0.025, 1.0), (x, y, 0.5), mt['trim'], bevel=0.008, ol=0))
    for z in (0.3, 0.8):
        parts.append(cz.box(f'rail{z}', (x1 - x0, 0.05, 0.08), ((x0 + x1) / 2, y + 0.04, z), mt['trim'], bevel=0.01, ol=0))
    for i in range(int((x1 - x0) / 2.4) + 1):
        parts.append(cz.box(f'fpost{i}', (0.1, 0.1, 1.15), (x0 + i * 2.4, y + 0.06, 0.575), mt['trim'], bevel=0.01, ol=0))
    return M.join('fence', parts)


def yard(mt, hole='big', house=True, seed=3):
    """Grass blades, trees, the back fence, bushes along the facade, far hills, fair-weather clouds."""
    av = [(-4.05, 4.05, YC, 3.55)] if house else []
    H = HOLE_BIG if hole == 'big' else HOLE_SMALL if hole == 'small' else None
    if H: av.append((H[0] - 0.02, H[1] + 0.02, YC, H[3] + 0.02))
    grass_blades(avoid=av, seed=seed)
    for i, (x, y, h) in enumerate([(-9.5, 7.5, 7.0), (10.5, 9.0, 7.6), (-13, 16, 8.0), (6.5, 18, 6.6), (14.5, 3.0, 6.2), (-15, 2.5, 6.8), (0.5, 22, 7.5)]):
        tree(f'tree{i}', (x, y, 0), h, seed=seed + i)
    fence(mt)
    bush = M.pbr('bs_bush', '#33602a', rough=0.6, img=TEX('r1_leaves.png') if os.path.exists(TEX('r1_leaves.png')) else None, scale=0.8, bump=0.6, bump_scale=16, tint='#b0c8a0')
    r = random.Random(seed); bs = []
    for i in range(10):
        x = r.choice((-1, 1)) * r.uniform(5.2, 9.0); y = r.uniform(4.6, 11)
        s = r.uniform(0.45, 0.8)
        b = cz.sphere(f'bush{i}', 1.0, (x, y, s * 0.5), bush, scale=(s * 1.3, s, s * 0.8), ol=0, segs=16, rings=10)
        M.displace(b, strength=0.14, scale=0.6); bake_mods(b); bs.append(b)
    M.join('bushes', bs)
    dress_yard(mt, hole, seed=seed)
    hills = M.range_fn(height=16, scale=60, seed=4, ridged=False)
    M.heightfield('farhills', (420, 300), (140, 100), lambda X, Y: np.maximum(0, hills(X, Y) + 2) * np.clip((Y + 150 - 20) / 80, 0, 1) - 0.3,
                  mat=M.pbr('bs_hillgrass', '#4d7a34', rough=0.9, img=TEX('r1_grass.png') if os.path.exists(TEX('r1_grass.png')) else None, scale=0.05, tint='#a8c090'),
                  loc=(0, 220, 0))
    cm = M.cloud_mat('bs_cloud', TEX('clouds.png'), strength=1.3)
    for i in range(8):
        a = math.radians(r.uniform(40, 140)); d = r.uniform(160, 300)
        p = cz.plane(f'cloudc{i}', r.uniform(90, 160), r.uniform(30, 50), (d * math.cos(a), d * math.sin(a), r.uniform(45, 85)), cm, rot=(90, 0, math.degrees(a) - 90))
        no_shadow(p)


def dress_yard(mt, hole, seed=5):
    """Enrich: flower beds with mulch along the house sides, a stepping-stone path, a garden shed, a hose reel."""
    r = random.Random(seed)
    mulch = M.pbr('bs_mulch', '#4a2e1c', rough=0.95, bump=0.8, bump_scale=30, noise=0.5)
    edge = M.pbr('bs_edge', '#9a9488', rough=0.8, bump=0.3, bump_scale=20, noise=0.3)
    P = []
    x0 = 4.75 if hole == 'big' else 4.7
    for s in (-1, 1):
        if s > 0: continue                    # the right side keeps the open lawn (discharge pipe, puddle)
        xa, xb = sorted((s * x0, s * (x0 + 0.9)))
        P.append(bx(f'bed{s}', (xa, xb, YC + 0.6, 3.4, 0.0, 0.06), mulch))
        for k in range(14):
            P.append(cz.box(f'edge{s}{k}', (0.06, 0.2, 0.1), (s * (x0 + 0.93), YC + 0.7 + k * 0.2, 0.05), edge, bevel=0.01, ol=0))
    M.join('beds', P)
    cols = ['#d83a5a', '#f2c230', '#f0f0f0', '#9a5ad8', '#e8743a']
    fl = []
    leafm = M.pbr('bs_bedleaf', '#2f6a26', rough=0.6, bump=0.6, bump_scale=18)
    for i in range(26):
        x = -(x0 + r.uniform(0.15, 0.75)); y = r.uniform(YC + 0.8, 3.2)
        s_ = r.uniform(0.12, 0.2)
        b = cz.sphere(f'plant{i}', 1.0, (x, y, 0.06 + s_ * 0.6), leafm, scale=(s_, s_, s_ * 0.8), ol=0, segs=10, rings=6)
        fl.append(b)
        for j in range(3):
            fl.append(cz.sphere(f'flw{i}{j}', 0.035, (x + r.uniform(-s_, s_) * 0.7, y + r.uniform(-s_, s_) * 0.7, 0.06 + s_ * 1.25),
                                M.pbr('bs_flw' + str(i % 5), cols[i % 5], rough=0.5), ol=0, segs=8, rings=5))
    M.join('plants', fl)
    # stepping stones across the right lawn toward the back
    ps = []
    for k in range(9):
        ps.append(cz.cyl(f'step{k}', r.uniform(0.24, 0.3), 0.06, (6.6 + 0.25 * math.sin(k), 5.0 + k * 0.85, -0.02), edge, verts=14, ol=0))
    M.join('steps', ps)
    # a small timber garden shed at the back left
    sh = []
    sw = M.pbr('bs_shedwall', '#6a8a7a', rough=0.6, img=TEX('r1_wood.png') if os.path.exists(TEX('r1_wood.png')) else None, scale=1.0, tint='#9ab8a8')
    sx, sy = -9.5, 10.5
    sh.append(cz.box('shed', (2.6, 2.0, 2.0), (sx, sy, 1.0), sw, bevel=0.02, ol=0))
    for k in (-1, 1):
        sh.append(cz.box(f'shedroof{k}', (1.5, 2.3, 0.08), (sx + k * 0.65, sy, 2.3), mt['shingle'], rot=(0, k * 25, 0), bevel=0.01, ol=0))
    sh.append(cz.box('sheddoor', (0.9, 0.04, 1.7), (sx + 0.5, sy - 1.01, 0.85), mt['trim'], bevel=0.01, ol=0))
    sh.append(cz.box('shedwin', (0.6, 0.04, 0.45), (sx - 0.6, sy - 1.01, 1.35), mt['glass'], bevel=0.01, ol=0))
    sh.append(cz.box('shedwinf', (0.7, 0.03, 0.55), (sx - 0.6, sy - 1.0, 1.35), mt['trim'], bevel=0.01, ol=0))
    M.join('shed', sh)
    # a green hose reel on the right side of the house
    hr = []
    hm = M.pbr('bs_hose', '#2a8a3a', rough=0.45)
    hr.append(cz.cyl('reel', 0.28, 0.22, (5.6, 2.2, 0.32), hm, rot=(0, 90, 0), verts=24, ol=0))
    for k in (-1, 1):
        hr.append(cz.cyl(f'reelside{k}', 0.34, 0.03, (5.6 + k * 0.13, 2.2, 0.32), mt['dark'], rot=(0, 90, 0), verts=24, ol=0))
    hr.append(cz.box('reelleg', (0.3, 0.3, 0.3), (5.6, 2.2, 0.15), mt['dark'], bevel=0.02, ol=0))
    M.join('hosereel', hr)


# ---------------------------------------------------------------- x-ray, arrows, puffs
def xray_over(objs, mat, grow=1.0, name='xr'):
    """Linked copies of objs with the x-ray material, parented to each original (they follow its animation)."""
    out = []
    for o in objs:
        if o is None or o.type != 'MESH': continue
        c = bpy.data.objects.new(f'{name}_{o.name}', o.data); bpy.context.scene.collection.objects.link(c)
        for sl in c.material_slots: sl.link = 'OBJECT'; sl.material = mat
        c.parent = o; c.matrix_parent_inverse = Matrix.Identity(4)
        c.scale = (grow, grow, grow); no_shadow(c)
        out.append(c)
    return out


def flash(objs, t, name, hold=0.7, down=0.45, peak=1.0, grow=1.03, end=None, alpha=0.55, strength=0.9):
    """Green x-ray on objs from the word at t: rises in 0.1 s, holds, eases out (or holds to end)."""
    xm = M.xray(name, alpha=alpha, strength=strength)
    xray_over(objs if isinstance(objs, (list, tuple)) else [objs], xm, grow=grow, name=name)
    keys = [(0, 0), (t - 0.1, 0), (t + 0.04, peak), (t + hold, peak * 0.85)]
    keys += [(end, peak * 0.8)] if end else [(t + hold + down, 0.0)]
    M.xray_fade(xm, keys)
    return xm


def volume(name, b, t, hold=0.7, down=0.45, end=None, peak=0.55):
    """A green x-ray volume filling the bounds b on the word at t (the hole, the room, the soft dirt)."""
    o = bx(name, b, None); o.data.materials.append(M.xray(name + '_m'))
    no_shadow(o)
    keys = [(0, 0), (t - 0.1, 0), (t + 0.04, peak), (t + hold, peak * 0.85)] + ([(end, peak * 0.8)] if end else [(t + hold + down, 0.0)])
    M.xray_fade(o.data.materials[0], keys)
    return o


def arrow(name, p0, p1, mat, r=0.06, head=2.6):
    """A 3D arrow from p0 to p1 (shaft + cone head), one object with its origin at p0."""
    p0, p1 = Vector(p0), Vector(p1); ax = p1 - p0; L = ax.length
    hl = min(L * 0.4, r * 4.5)
    sh = cz.cyl(name + '_s', r, L - hl, (0, 0, 0), mat, verts=16, ol=0)
    hd = cz.cyl(name + '_h', r * head, hl, (0, 0, L - hl), mat, verts=20, ol=0, r2=0.0)
    o = M.join(name, [sh, hd])
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(ax.normalized()); o.location = p0
    return o


def grow_in(o, f0, f1, ta, tb, axis=None):
    """Scale an object in from 0 between ta..tb (seconds); axis 'z' grows only along local z."""
    def sc(t):
        k = max(0.001, ss((t - ta) / max(1e-6, tb - ta)))
        return (1, 1, k) if axis == 'z' else (k, k, k)
    M.bake_path(o, f0, f1, scale=sc)


def puffs(name, mat, f0, f1, n, spawn, vel, size=(0.08, 0.18), life=1.6, seed=1, t_on=None, t_off=None, wobble=0.25):
    """Soft rising puffs (gas, breath): spawn(r) -> (x, y, z) start, vel(r) -> (vx, vy, vz). Each puff is born at a
    random time, grows, drifts and fades (scale to 0). Linked copies of one sphere."""
    r = random.Random(seed)
    base = cz.sphere(name + '_base', 1.0, (0, 0, -50), mat, ol=0, segs=16, rings=8)
    base.hide_render = True; base.hide_viewport = True
    t0, t1 = T(f0), T(f1)
    a = t_on if t_on is not None else t0 - life
    b = t_off if t_off is not None else t1
    obs = []
    for i in range(n):
        ob = bpy.data.objects.new(f'{name}{i}', base.data); bpy.context.scene.collection.objects.link(ob)
        no_shadow(ob)
        p0 = Vector(spawn(r)); v = Vector(vel(r)); s = r.uniform(*size); tb = r.uniform(a, b); ph = r.uniform(0, 6.28)
        def pos(t, p0=p0, v=v, tb=tb, ph=ph):
            k = max(0.0, t - tb)
            return (p0.x + v.x * k + wobble * 0.3 * math.sin(k * 3 + ph), p0.y + v.y * k, p0.z + v.z * k)
        def sc(t, s=s, tb=tb):
            k = (t - tb) / life
            if k < 0 or k > 1: return 0.0005
            return max(0.0005, s * (0.5 + 1.1 * k) * min(1.0, k / 0.15) * min(1.0, (1 - k) / 0.35))
        M.bake_path(ob, f0, f1, pos=pos, scale=sc)
        obs.append(ob)
    return obs


def hide(objs, f0, f1):
    for o in (objs if isinstance(objs, (list, tuple)) else [objs]):
        if o is not None: M.visible(o, [], f0, f1)


def rain(name, f0, f1, n=5000, speed=11.0, size=(30, 24), center=(0, 9.0), top=12.0, seed=1, width=0.009, length=0.7,
         hole=(-4.6, 4.6, YC - 1, 3.9)):
    """Thin streak cards (crossed pairs) in a column falling the whole shot, only behind the section plane and not
    over the house (streaks below the grass hide in the soil)."""
    rng = np.random.default_rng(seed)
    dur = (f1 - f0 + 4) / FPS
    hz = top + speed * dur
    X = rng.uniform(center[0] - size[0] / 2, center[0] + size[0] / 2, n)
    Y = rng.uniform(max(YC + 0.2, center[1] - size[1] / 2), center[1] + size[1] / 2, n)
    Z = rng.uniform(0, hz, n); L = length * rng.uniform(0.6, 1.3, n)
    verts, faces = [], []
    for i in range(n):
        if hole[0] < X[i] < hole[1] and hole[2] < Y[i] < hole[3]: continue
        p = np.array([X[i], Y[i], Z[i]]); q = p + np.array([0.0, 0.0, -L[i]])
        k = len(verts)
        verts += [p + (width, 0, 0), p - (width, 0, 0), q - (width, 0, 0), q + (width, 0, 0),
                  p + (0, width, 0), p - (0, width, 0), q - (0, width, 0), q + (0, width, 0)]
        faces += [(k, k + 1, k + 2, k + 3), (k + 4, k + 5, k + 6, k + 7)]
    m, nn = _mat('bs_rain')
    if nn:
        nt, o = nn
        m.surface_render_method = 'BLENDED'
        em = nt.nodes.new('ShaderNodeEmission'); em.inputs[0].default_value = (0.8, 0.86, 0.95, 1); em.inputs[1].default_value = 1.4
        tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader'); mx.inputs[0].default_value = 0.5
        nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], o.inputs[0])
    ob = mesh(name, verts, faces, m); no_shadow(ob)
    t0 = T(f0)
    M.bake_path(ob, f0, f1, pos=lambda t: (0, 0, -speed * (t - t0)))
    return ob


# ---------------------------------------------------------------- camera
def cam(F0, F1, keys, **kw):
    """ONE calm move: keys [(frame, eye, target, lens)] -> M.Flight on seconds (2-3 keys)."""
    K = [(T(k[0]),) + tuple(k[1:]) for k in keys]
    fl = M.Flight(K, **kw)
    fl.bake(F0, F1)
    return fl.obj
