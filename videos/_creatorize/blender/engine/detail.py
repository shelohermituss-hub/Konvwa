# detail.py - the DETAIL pass of the 3D Informational look (mega-v2 package E, 2026-10-30; the owner after the night's 3
# shorts: "detail is still lacking, could be a lot better"). Additive and cheap: every call works on a finished shot.
#   import detail as D
#   ... the shot builds its set, its motion and its camera (M.Flight(...).bake) ...
#   D.finish(level='film')                 # ONE call: surface breakup, grime / AO, dirt line, dust, edge wear, bevels, AO
# Extras a shot asks for by name (each measured in references/detail.md):
#   D.pbr(id_or_kind)            triplanar PBR (package A's texture library, else a procedural fallback), detail built in
#   D.scatter(kind, ...)         pebbles / gravel / grass / debris / leaves / rocks instanced over an area or a surface,
#                                camera-aware (only where the camera looks, denser near it)
#   D.roots(...)                 thin roots hanging in a soil cut face
#   D.greebles(obj, face) D.bolts(obj, face) D.label(text, ...) D.hazard(...)   kitbash + decals for machines / interiors
#   D.light(preset)              rim / kicker, crisper contact shadows, HDRI ambient (package A) on top of M.setup's sky
#   D.fog(...) D.motes(...)      height fog / light shafts (EEVEE volume), drifting dust motes (secondary motion)
#   D.dof(...)                   depth of field that reads on a phone at 9:16 (blur sized in pixels of the 1080 frame)
# The look stays the clean X-ray explainer: every amount is small on purpose (variation ~10-15 %, never noise).
# Exclusions: X-ray, emission, glass, water, gas, clouds, sky, text and every BLENDED material are never touched; a
# material or object with the custom property cz_detail = 0 is skipped (mat['cz_detail'] = 0).
import bpy, bmesh, math, os, random, re, sys, time
from mathutils import Vector, Matrix, Euler
import cz
from cz import FPS

try:
    import numpy as np
except Exception:                     # (Blender without numpy: mega.py appends CZ_PYLIB first)
    if os.environ.get('CZ_PYLIB') and os.environ['CZ_PYLIB'] not in sys.path: sys.path.append(os.environ['CZ_PYLIB'])
    import numpy as np

TEX = os.path.join(cz.LAB, 'assets', 'mega')
# Material names are matched by WORD (fix round B5, 2026-10-30): 'terrain' is not 'rain', 'textured_concrete' not 'text',
# 'proof_panel' not 'roof', 'mortar' not 'tar', 'clamp_steel' not 'lamp'. A name splits at _ - . space and digits
# ('soil2_dark' -> soil, dark); a word matches a key exactly or as its plural. The material checks in skip_material
# (BLENDED, alpha, transmission, emission, no Principled) already catch M.xray / M.emit / glass / clouds by what they are.
SKIP_NAMES = ('xray', 'xr', 'glass', 'water', 'sky', 'cloud', 'sun', 'gas', 'puff', 'smoke', 'fire', 'flame', 'ghost',
              'emit', 'glow', 'text', 'label', 'caption', 'screen', 'flow', 'rain', 'spark',
              'highlight', 'arrow', 'radon', 'steam', 'mist', 'fog', 'motes', 'hologram')
# ('light' / 'lamp' / 'beam' are not skip words: light_grey_wall, lamp_post, steel_beam are surfaces; a glowing lamp or
# light beam is caught by its emission / BLENDED material)
ORGANIC = ('soil', 'dirt', 'mud', 'clay', 'grass', 'leaf', 'leaves', 'bark', 'tree', 'rock', 'stone', 'gravel', 'sand',
           'snow', 'ice', 'pebble', 'fill', 'earth', 'moss', 'foliage', 'bush', 'hedge', 'terrain', 'ground', 'lawn')


def _words(name):
    """'Soil2_dark.001' -> ['soil', 'dark']; 'xRay' stays one word ('xray')."""
    return [w for w in re.split(r'[^a-z]+', str(name).lower()) if w]


def _word_key(name, keys, compound=False):
    """The first key (longest first) that is one of the name's words (or its plural). compound=True also takes a long
    key (5+ letters) at the start or end of a word ('concretewall', 'firebrick', 'hillgrass'), for the scan map."""
    ws = _words(name)
    for k in sorted(keys, key=len, reverse=True):
        for w in ws:
            if w == k or w == k + 's' or w == k + 'es': return k
            if compound and len(k) >= 5 and len(w) > len(k) and (w.startswith(k) or w.endswith(k)): return k
    return None


def _skip_name(name):
    n = str(name).lower()
    return n.startswith(('cz_d_', 'xray', 'x_ray')) or _word_key(n, SKIP_NAMES) is not None

# what each level does (measured in references/detail.md; the film is rendered at 4 samples, full size)
LEVELS = {
    'draft': dict(breakup=0.8, grime=0.8, dirt=0.0, dust=0.0, wear=0.0, bump=0.6, bevel=False, shadow_scale=0.5, fast_gi=False),
    'film': dict(breakup=1.0, grime=1.0, dirt=1.0, dust=1.0, wear=0.0, bump=1.0, bevel=True, shadow_scale=0.75, fast_gi=True),
}
# wear (edge wear on bevelled outer edges) is opt-in: D.finish(wear=1) for machine / hard-surface hero shots. On a set of
# panels (a poured wall, siding) the panel seams are bevels too, and v1 lit every seam up as a white line.


# ---------------------------------------------------------------- small node helpers
def _node(nt, typ, **kw):
    n = nt.nodes.new(typ)
    for k, v in kw.items():
        try: setattr(n, k, v)
        except Exception as e: print('CZ DETAIL node', typ, k, e)
    return n


def _set(nt, sock, v):
    """Link a socket, or set a constant (float / colour tuple / '#hex')."""
    if v is None: return
    if isinstance(v, bpy.types.NodeSocket): nt.links.new(v, sock)
    elif isinstance(v, str): sock.default_value = cz.col(v)
    else:
        try: sock.default_value = v
        except Exception:
            sock.default_value = tuple(v) + (1.0,) if len(v) == 3 else v


def _math(nt, op, a, b=None, c=None, clamp=False):
    n = _node(nt, 'ShaderNodeMath', operation=op, use_clamp=clamp)
    for i, s in enumerate((a, b, c)):
        if s is not None: _set(nt, n.inputs[i], s)
    return n.outputs[0]


def _range(nt, v, a, b, c=0.0, d=1.0, smooth=False):
    n = _node(nt, 'ShaderNodeMapRange')
    if smooth: n.interpolation_type = 'SMOOTHSTEP'
    _set(nt, n.inputs['Value'], v)
    n.inputs['From Min'].default_value, n.inputs['From Max'].default_value = a, b
    n.inputs['To Min'].default_value, n.inputs['To Max'].default_value = c, d
    return n.outputs[0]


def _mix(nt, fac, a, b, blend='MIX'):
    n = _node(nt, 'ShaderNodeMix', data_type='RGBA', blend_type=blend)
    _set(nt, n.inputs[0], fac); _set(nt, n.inputs[6], a); _set(nt, n.inputs[7], b)
    return n.outputs[2]


def _noise(nt, vec, scale, detail=4.0, rough=0.55, out='Fac'):
    n = _node(nt, 'ShaderNodeTexNoise')
    _set(nt, n.inputs['Vector'], vec)
    n.inputs['Scale'].default_value = scale; n.inputs['Detail'].default_value = detail; n.inputs['Roughness'].default_value = rough
    return n.outputs[out]


# ---------------------------------------------------------------- the detail shader group (shared by every material)
def _detail_group(feats='bg'):
    """cz_detail: colour + roughness in -> enriched colour, roughness and a height for the bump out.
    Breakup (multi-scale colour / roughness variation), Grime (AO-driven darkening in crevices and contact corners),
    Dirt (a broken dirty band up from GroundZ on walls), Dust (lighter dusty tops), Wear (lighter bevelled edges from the
    'cz_edge' attribute the edge-wear modifier writes). Object coordinates: the stains ride along with moving parts."""
    feats = ''.join(sorted(feats))
    gname = 'cz_detail_' + feats
    ng = bpy.data.node_groups.get(gname)
    if ng: return ng
    ng = bpy.data.node_groups.new(gname, 'ShaderNodeTree')
    io = ng.interface
    for name, typ, dv in (('Color', 'NodeSocketColor', (0.5, 0.5, 0.5, 1)), ('Roughness', 'NodeSocketFloat', 0.6),
                          ('Breakup', 'NodeSocketFloat', 1.0), ('Grime', 'NodeSocketFloat', 1.0), ('Dirt', 'NodeSocketFloat', 0.0),
                          ('Dust', 'NodeSocketFloat', 0.0), ('Wear', 'NodeSocketFloat', 0.0), ('GroundZ', 'NodeSocketFloat', -1e4),
                          ('DirtHeight', 'NodeSocketFloat', 0.6), ('Scale', 'NodeSocketFloat', 1.0), ('AODistance', 'NodeSocketFloat', 0.5)):
        s = io.new_socket(name, in_out='INPUT', socket_type=typ)
        try: s.default_value = dv
        except Exception: pass
    for name, typ in (('Color', 'NodeSocketColor'), ('Roughness', 'NodeSocketFloat'), ('Height', 'NodeSocketFloat')):
        io.new_socket(name, in_out='OUTPUT', socket_type=typ)
    nt = ng
    gi = _node(nt, 'NodeGroupInput'); go = _node(nt, 'NodeGroupOutput')
    I = gi.outputs
    tc = _node(nt, 'ShaderNodeTexCoord'); geo = _node(nt, 'ShaderNodeNewGeometry')
    vs = _node(nt, 'ShaderNodeVectorMath', operation='SCALE'); _set(nt, vs.inputs[0], tc.outputs['Object']); _set(nt, vs.inputs['Scale'], I['Scale'])
    P = vs.outputs[0]
    # noise Fac sits around 0.5 with a narrow spread: stretch it to -1..1 before using it (v1 used it raw: invisible)
    nL = _range(nt, _noise(nt, P, 0.45, 3.0, 0.5), 0.32, 0.68, -1.0, 1.0)        # big stains (~2 m)
    nM = _range(nt, _noise(nt, P, 2.6, 5.0, 0.55), 0.3, 0.7, -1.0, 1.0)          # mottling (~40 cm)
    vo = _node(nt, 'ShaderNodeTexVoronoi'); vo.inputs['Scale'].default_value = 45.0; _set(nt, vo.inputs['Vector'], P)
    pores = _range(nt, vo.outputs['Distance'], 0.0, 0.16, 1.0, 0.0)               # small pits (~2 cm cells)
    var = _math(nt, 'ADD', _math(nt, 'MULTIPLY', nL, 0.55), _math(nt, 'MULTIPLY', nM, 0.35))
    k = _math(nt, 'MULTIPLY_ADD', var, _math(nt, 'MULTIPLY', I['Breakup'], 0.16), 1.0)
    k = _math(nt, 'SUBTRACT', k, _math(nt, 'MULTIPLY', pores, _math(nt, 'MULTIPLY', I['Breakup'], 0.22)))
    c1 = _node(nt, 'ShaderNodeVectorMath', operation='SCALE'); _set(nt, c1.inputs[0], I['Color']); _set(nt, c1.inputs['Scale'], k)
    col = c1.outputs[0]
    gm = du = wm = 0.0
    nM01 = _range(nt, nM, -1.0, 1.0, 0.0, 1.0)
    if 'd' in feats or 'u' in feats or 'g' in feats:
        sn = _node(nt, 'ShaderNodeSeparateXYZ'); _set(nt, sn.inputs[0], geo.outputs['Normal'])
    if 'g' in feats:
        # grime: weathering streaks running DOWN vertical faces (rain / seepage), in patches. (The AO node was tried
        # first: in EEVEE 5.2 without ray tracing it returns ~1 everywhere, measured 2026-10-30, so no AO grime.)
        st = _node(nt, 'ShaderNodeVectorMath', operation='MULTIPLY'); _set(nt, st.inputs[0], P); st.inputs[1].default_value = (7.0, 7.0, 0.45)
        streak = _range(nt, _noise(nt, st.outputs[0], 1.0, 3.0, 0.5), 0.52, 0.68, 0.0, 1.0, smooth=True)
        vert = _range(nt, sn.outputs['Z'], 0.5, 0.2, 0.0, 1.0)
        gm = _math(nt, 'MULTIPLY', _math(nt, 'MULTIPLY', streak, vert),
                   _math(nt, 'MULTIPLY', _range(nt, nL, -0.6, 0.6, 0.15, 1.0), I['Grime']), clamp=True)
        col = _mix(nt, _math(nt, 'MULTIPLY', gm, 0.45), col, _mix(nt, 1.0, col, (0.55, 0.5, 0.44, 1), 'MULTIPLY'))
    if 'd' in feats:
        # dirt line: up from the ground on faces that are not tops, its edge broken by the mottling
        sep = _node(nt, 'ShaderNodeSeparateXYZ'); _set(nt, sep.inputs[0], geo.outputs['Position'])
        h = _math(nt, 'DIVIDE', _math(nt, 'SUBTRACT', sep.outputs['Z'], I['GroundZ']), I['DirtHeight'])
        h = _math(nt, 'ADD', h, _math(nt, 'MULTIPLY', nM, 0.3))
        band = _math(nt, 'MULTIPLY', _range(nt, h, 1.0, 0.0, 0.0, 1.0, smooth=True), _range(nt, h, -0.7, -0.25, 0.0, 1.0))  # (not below ground: a cutaway's cellar walls stay clean)
        side = _range(nt, sn.outputs['Z'], 0.75, 0.45, 0.0, 1.0, smooth=True)
        dm = _math(nt, 'MULTIPLY', _math(nt, 'MULTIPLY', band, side), _math(nt, 'MULTIPLY', I['Dirt'], 0.6), clamp=True)
        col = _mix(nt, dm, col, _mix(nt, 1.0, col, (0.52, 0.42, 0.32, 1), 'MULTIPLY'))
    if 'u' in feats:
        # dust: up-facing faces a little lighter and rougher, in patches
        up = _range(nt, sn.outputs['Z'], 0.7, 0.95, 0.0, 1.0, smooth=True)
        patch = _range(nt, nL, -0.3, 0.5, 0.2, 1.0, smooth=True)
        du = _math(nt, 'MULTIPLY', _math(nt, 'MULTIPLY', up, patch), _math(nt, 'MULTIPLY', I['Dust'], 0.25), clamp=True)
        col = _mix(nt, du, col, (0.6, 0.58, 0.54, 1))
    if 'w' in feats:
        # edge wear: bevelled OUTER edges (attribute from the cz_edgewear modifier) a little lighter, in chips; gated by
        # the AO so a seam between two panels (a groove) never lights up
        at = _node(nt, 'ShaderNodeAttribute', attribute_type='GEOMETRY', attribute_name='cz_edge')
        em = _range(nt, at.outputs['Fac'], 0.12, 0.45, 0.0, 1.0, smooth=True)
        chips = _range(nt, pores, 0.0, 0.5, 1.0, 0.4)
        wm = _math(nt, 'MULTIPLY', _math(nt, 'MULTIPLY', em, chips), _math(nt, 'MULTIPLY', I['Wear'], 0.6), clamp=True)
        lift = _node(nt, 'ShaderNodeVectorMath', operation='SCALE'); _set(nt, lift.inputs[0], col); lift.inputs['Scale'].default_value = 1.35
        col = _mix(nt, wm, col, lift.outputs[0])
    _set(nt, go.inputs['Color'], col)
    # roughness: varies with the mottling, rougher in grime and dust, smoother on worn edges
    r = _math(nt, 'MULTIPLY_ADD', nM, _math(nt, 'MULTIPLY', I['Breakup'], 0.08), I['Roughness'])
    if 'g' in feats or 'u' in feats: r = _math(nt, 'ADD', r, _math(nt, 'MULTIPLY', _math(nt, 'ADD', gm, du), 0.12))
    if 'w' in feats: r = _math(nt, 'SUBTRACT', r, _math(nt, 'MULTIPLY', wm, 0.18))
    r = _math(nt, 'MAXIMUM', _math(nt, 'MINIMUM', r, 1.0), 0.02)
    _set(nt, go.inputs['Roughness'], r)
    _set(nt, go.inputs['Height'], _math(nt, 'MULTIPLY_ADD', pores, -0.7, _math(nt, 'MULTIPLY', nM01, 0.3)))
    return ng


def _principled(mat):
    if not mat or not mat.use_nodes or not mat.node_tree: return []
    return [n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED']


def _kind(mat, p):
    if _word_key(mat.name, ORGANIC, compound=True): return 'organic'
    try:
        if not p.inputs['Metallic'].is_linked and p.inputs['Metallic'].default_value > 0.5: return 'metal'
    except Exception: pass
    return 'paint'


KIND_AMOUNTS = {     # breakup, grime, dirt, dust, wear (x the level's amounts)
    'paint': (1.0, 1.0, 1.0, 1.0, 1.0),
    'metal': (0.55, 0.9, 0.6, 0.5, 1.0),
    'organic': (0.35, 0.8, 0.0, 0.0, 0.25),
}


def skip_material(mat):
    """True for the materials the detail pass never touches (X-ray, emission, glass, water, gas, text, BLENDED ...)."""
    if mat is None or mat.get('cz_detail', 1) == 0 or mat.get('cz_detailed'): return True
    if _skip_name(mat.name): return True
    try:
        if mat.surface_render_method == 'BLENDED': return True
    except Exception: pass
    ps = _principled(mat)
    if not ps: return True
    for p in ps:
        try:
            if p.inputs['Alpha'].is_linked or p.inputs['Alpha'].default_value < 0.99: return True
            if p.inputs['Transmission Weight'].default_value > 0.3: return True
            es = p.inputs['Emission Strength']
            if es.is_linked or es.default_value > 0.05:
                ec = p.inputs['Emission Color']
                if ec.is_linked or max(ec.default_value[:3]) > 0.01: return True
        except Exception: pass
    return False


def enrich(mat, breakup=1.0, grime=1.0, dirt=0.0, dust=0.0, wear=0.0, bump=1.0, ground=None, dirt_height=0.6, scale=1.0,
           ao_distance=0.5, kind=None):
    """Put the cz_detail group between a material's colour / roughness and its Principled BSDF(s), plus a fine bump.
    Amounts 0..1 (x the material kind's own: metal and organic get less). ground: the z of the ground the dirt line
    rises from (None = no dirt line). Returns True when the material was changed."""
    if skip_material(mat): return False
    nt = mat.node_tree
    for p in _principled(mat):
        kd = kind or _kind(mat, p)
        kb, kg, kdirt, kdust, kw = KIND_AMOUNTS.get(kd, KIND_AMOUNTS['paint'])
        feats = 'b' + ('g' if grime * kg > 0 else '') + ('d' if dirt * kdirt > 0 and ground is not None else '') + \
                ('u' if dust * kdust > 0 else '') + ('w' if wear * kw > 0 else '')
        gn = nt.nodes.new('ShaderNodeGroup'); gn.node_tree = _detail_group(feats); gn.label = 'cz_detail'
        bc = p.inputs['Base Color']
        if bc.is_linked:
            src = bc.links[0].from_socket; nt.links.remove(bc.links[0]); nt.links.new(src, gn.inputs['Color'])
        else: gn.inputs['Color'].default_value = bc.default_value
        nt.links.new(gn.outputs['Color'], bc)
        rs = p.inputs['Roughness']
        if rs.is_linked:
            src = rs.links[0].from_socket; nt.links.remove(rs.links[0]); nt.links.new(src, gn.inputs['Roughness'])
        else: gn.inputs['Roughness'].default_value = rs.default_value
        nt.links.new(gn.outputs['Roughness'], rs)
        gn.inputs['Breakup'].default_value = breakup * kb
        gn.inputs['Grime'].default_value = grime * kg
        gn.inputs['Dirt'].default_value = (dirt * kdirt) if ground is not None else 0.0
        gn.inputs['Dust'].default_value = dust * kdust
        gn.inputs['Wear'].default_value = wear * kw
        gn.inputs['GroundZ'].default_value = ground if ground is not None else -1e4
        gn.inputs['DirtHeight'].default_value = dirt_height
        gn.inputs['Scale'].default_value = scale
        gn.inputs['AODistance'].default_value = ao_distance
        if bump > 0:
            b = nt.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value = 0.1 * bump * kb
            b.inputs['Distance'].default_value = 0.004
            nt.links.new(gn.outputs['Height'], b.inputs['Height'])
            ns = p.inputs['Normal']
            if ns.is_linked:
                src = ns.links[0].from_socket; nt.links.remove(ns.links[0]); nt.links.new(src, b.inputs['Normal'])
            nt.links.new(b.outputs[0], ns)
    mat['cz_detailed'] = 1
    return True


# ---------------------------------------------------------------- edge wear: a face attribute on bevelled edges
def _edge_group():
    """Geometry nodes cz_edgewear: per face, 'cz_edge' = how much the face is a narrow bevel strip on a convex edge
    (power-mean of its edges' convex angles 20-40 deg, times narrowness area / mean-edge-length^2). Cylinder sides
    (9-22 deg) and big faces stay 0. EEVEE has no bevel / pointiness node: this is the cheap hard-surface edge mask."""
    ng = bpy.data.node_groups.get('cz_edgewear')
    if ng: return ng
    ng = bpy.data.node_groups.new('cz_edgewear', 'GeometryNodeTree')
    ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
    ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    nt = ng
    gi = _node(nt, 'NodeGroupInput'); go = _node(nt, 'NodeGroupOutput')
    ea = _node(nt, 'GeometryNodeInputMeshEdgeAngle')
    a = _range(nt, ea.outputs['Signed Angle'], 0.35, 0.7, 0.0, 1.0)         # 20 deg -> 0, 40 deg -> 1 (clamped)
    a2 = _math(nt, 'MULTIPLY', a, a)
    fa = _node(nt, 'GeometryNodeFieldOnDomain', domain='EDGE', data_type='FLOAT'); _set(nt, fa.inputs[0], a2)
    ev = _node(nt, 'GeometryNodeInputMeshEdgeVertices')
    dl = _node(nt, 'ShaderNodeVectorMath', operation='DISTANCE'); _set(nt, dl.inputs[0], ev.outputs['Position 1']); _set(nt, dl.inputs[1], ev.outputs['Position 2'])
    fl = _node(nt, 'GeometryNodeFieldOnDomain', domain='EDGE', data_type='FLOAT'); _set(nt, fl.inputs[0], dl.outputs['Value'])
    area = _node(nt, 'GeometryNodeInputMeshFaceArea')
    ratio = _math(nt, 'DIVIDE', area.outputs['Area'], _math(nt, 'MAXIMUM', _math(nt, 'MULTIPLY', fl.outputs[0], fl.outputs[0]), 1e-12))
    narrow = _range(nt, ratio, 0.3, 0.12, 0.0, 1.0)
    val = _math(nt, 'MULTIPLY', _math(nt, 'SQRT', fa.outputs[0]), narrow)
    st = _node(nt, 'GeometryNodeStoreNamedAttribute', data_type='FLOAT', domain='FACE')
    _set(nt, st.inputs['Geometry'], gi.outputs[0]); st.inputs['Name'].default_value = 'cz_edge'; _set(nt, st.inputs['Value'], val)
    _set(nt, go.inputs[0], st.outputs[0])
    return ng


def edge_wear(objs=None, max_faces=60000):
    """Add the cz_edgewear modifier (last in the stack) to mesh objects: their bevel strips get the 'cz_edge' mask the
    detail group lightens. Objects without bevels are unchanged (no narrow convex faces). Returns the count."""
    g = _edge_group(); n = 0
    for o in (objs or bpy.context.scene.objects):
        if o.type != 'MESH' or o.get('cz_detail', 1) == 0 or len(o.data.polygons) > max_faces: continue
        if any(m.type == 'NODES' for m in o.modifiers) or o.data.users > 1: continue      # (shared mesh: an X-ray overlay copy)
        if not any(ms.material and ms.material.get('cz_detailed') for ms in o.material_slots): continue
        md = o.modifiers.new('cz_edgewear', 'NODES'); md.node_group = g; n += 1
    return n


def bevel_sharp(objs=None, max_faces=400, frac=0.025, width=0.025, segments=2):
    """Bevel the sharp low-poly meshes that have none (a razor edge reads as CG): width = min(width, frac x the
    object's smallest dimension), angle-limited, hardened normals. Skips anything with a bevel / nodes modifier."""
    n = 0
    for o in (objs or bpy.context.scene.objects):
        if o.type != 'MESH' or o.get('cz_detail', 1) == 0 or not o.data.polygons or len(o.data.polygons) > max_faces: continue
        if any(m.type in ('BEVEL', 'NODES', 'OCEAN', 'DISPLACE', 'SUBSURF') for m in o.modifiers): continue
        if o.data.users > 1: continue          # a linked copy (C.flash's X-ray overlay shares the mesh): both must stay identical
        if not any(ms.material and ms.material.get('cz_detailed') for ms in o.material_slots): continue
        dims = [d / max(1e-6, s) for d, s in zip(o.dimensions, o.scale)] if all(o.scale) else list(o.dimensions)
        dims = sorted(d for d in dims if d > 1e-4)
        if len(dims) < 3: continue                       # flat cards and planes stay flat
        w = min(width, frac * dims[0])
        if w < 0.002: continue
        b = o.modifiers.new('cz_bevel', 'BEVEL'); b.width = w; b.segments = segments; b.limit_method = 'ANGLE'
        b.angle_limit = math.radians(40)
        try: b.harden_normals = True
        except Exception: pass
        n += 1
    return n


# ---------------------------------------------------------------- the one call
def _is_asset(o):
    """A part of a package-A library model (its root carries cz_id)."""
    p = o
    while p is not None:
        if p.get('cz_id'): return True
        p = p.parent
    return False


def _nocontact(ob, section_ok=False, group=None, partner=None):
    """Tag a detail object for the overlap gate (contact.py, fix round B6): effects and decoration never block a film.
    group + partner: may overlap that object only (a relief skin on its own cut face), still checked against the rest."""
    if ob is None: return ob
    if group is None: ob['cz_nocontact'] = True
    else:
        for o in (ob, partner):
            if o is None: continue
            g = [x for x in str(o.get('cz_group', '')).split(',') if x]
            if group not in g: g.append(group)
            o['cz_group'] = ','.join(g)
    if section_ok: ob['cz_section_ok'] = True
    return ob


def _fast_compile():
    """EEVEE compiles every material before the first frame; let it use worker subprocesses (CZ_SHADER_WORKERS, default
    half the cores up to 8). 0 = Blender's default."""
    try:
        n = int(os.environ.get('CZ_SHADER_WORKERS', '0'))
        if n > 0:
            s = bpy.context.preferences.system
            s.shader_compilation_method = 'SUBPROCESS'; s.gpu_shader_workers = n
    except Exception as e: print('CZ DETAIL compile workers', e)


def finish(scene=None, level='film', ground=None, dirt_height=0.6, skip=(), objs=None, ao_distance=0.5, quiet=False, **amounts):
    """Raise the detail of a built shot in one call: every eligible material gets the detail group (breakup, grime/AO,
    dirt line from `ground`, dust, edge wear), sharp low-poly meshes get a bevel, bevelled meshes the edge-wear mask,
    and the render gets fast-GI ambient occlusion and crisper shadows. level 'film' | 'draft' (cheaper, no wear).
    skip: name substrings of materials / objects to leave alone. Call it LAST in build(ctx), after the camera.
    Prints `CZ DETAIL ...` (counts + build seconds)."""
    t0 = time.time()
    sc = scene or bpy.context.scene
    L = dict(LEVELS.get(level, LEVELS['film'])); L.update(amounts)
    L['edge_gn'] = L['wear'] > 0
    skip = tuple(s.lower() for s in skip)
    _fast_compile()
    obs = [o for o in (objs or sc.objects) if not any(s in o.name.lower() for s in skip)]
    # a material is left alone when ANY object using it says so (cz_detail = 0, or a library model from package A: its
    # scanned look is already the real thing, and the master on disk would differ from the film's copy)
    keep_out = set()
    for o in sc.objects:
        if o.get('cz_detail', 1) == 0 or _is_asset(o):
            keep_out |= {ms.material.name for ms in getattr(o, 'material_slots', []) if ms.material}
    mats = []
    for o in obs:
        if o.get('cz_detail', 1) == 0 or _is_asset(o): continue
        for ms in getattr(o, 'material_slots', []):
            m = ms.material
            if m and m not in mats and m.name not in keep_out and not any(s in m.name.lower() for s in skip): mats.append(m)
    nm = sum(1 for m in mats if enrich(m, L['breakup'], L['grime'], L['dirt'], L['dust'], L['wear'], L['bump'], ground,
                                       dirt_height, ao_distance=ao_distance))
    nb = bevel_sharp(obs) if L['bevel'] else 0
    ne = edge_wear(obs) if L['edge_gn'] else 0
    ee = sc.eevee
    for k, v in (('shadow_resolution_scale', L['shadow_scale']),):
        try: setattr(ee, k, max(getattr(ee, k), v))
        except Exception as e: print('CZ DETAIL', k, e)
    # (fix round M5: D.corners('gi') before or after finish both work: finish never downgrades corners' horizon-scan GI)
    if L['fast_gi'] and not sc.get('cz_corners_gi'):
        try:
            ee.use_fast_gi = True; ee.fast_gi_method = 'AMBIENT_OCCLUSION_ONLY'; ee.fast_gi_distance = max(ao_distance * 3, 1.0)
            ee.fast_gi_ray_count = 2; ee.fast_gi_step_count = 6; ee.fast_gi_resolution = '2'
        except Exception as e: print('CZ DETAIL fastgi', e)
    sc['cz_detail_level'] = level
    if not quiet:
        print(f'CZ DETAIL level={level} materials={nm}/{len(mats)} bevels={nb} edgewear={ne} in {time.time() - t0:.2f}s')
    return dict(materials=nm, bevels=nb, edgewear=ne, seconds=time.time() - t0)


# ---------------------------------------------------------------- materials: triplanar PBR (package A) + fallbacks
def _assets():
    try:
        import assets as A
        return A
    except Exception:
        return None


FALLBACK = {     # kind -> (colour, roughness, metal, texture in assets/mega or None, texture scale, bump)
    'concrete': ('#a7a39b', 0.85, 0.0, None, 1.0, 0.25),
    'plaster': ('#e6e2da', 0.8, 0.0, None, 1.0, 0.12),
    'paint': ('#d8d4cc', 0.5, 0.0, None, 1.0, 0.05),
    'soil': ('#6b4a32', 0.95, 0.0, 'dirt_dark.png', 0.5, 0.5),
    'dirt': ('#6b4a32', 0.95, 0.0, 'dirt_dark.png', 0.5, 0.5),
    'rock': ('#77736c', 0.85, 0.0, 'mountain_rock.png', 0.35, 0.6),
    'stone': ('#8a857c', 0.8, 0.0, 'r1_stone.png', 0.6, 0.4),
    'basalt': ('#4a4b50', 0.85, 0.0, 'basalt.png', 0.4, 0.6),
    'snow': ('#f2f5fa', 0.6, 0.0, 'snow.png', 0.3, 0.3),
    'wood': ('#a77a50', 0.6, 0.0, 'r1_wood.png', 0.8, 0.15),
    'grass': ('#5f8a3a', 0.9, 0.0, 'r1_grass.png', 0.3, 0.3),
    'steel': ('#b8bcc4', 0.3, 1.0, 'steel_panels.png', 0.5, 0.1),
    'metal': ('#a8acb2', 0.35, 1.0, None, 1.0, 0.08),
    'rust': ('#7a4a32', 0.75, 0.3, None, 1.0, 0.3),
    'rubber': ('#1c1c1e', 0.85, 0.0, None, 1.0, 0.15),
    'plastic': ('#d0d0cc', 0.35, 0.0, None, 1.0, 0.03),
    'asphalt': ('#3a3a3c', 0.9, 0.0, None, 1.0, 0.4),
    'brick': ('#8a3e2c', 0.85, 0.0, None, 1.0, 0.3),
    'sand': ('#c8b088', 0.95, 0.0, None, 1.0, 0.35),
}


def triplanar(name, tex, scale=1.0, tint=None, rough=0.6, metal=0.0, bump=0.5, coord='Object', blend=0.3):
    """A PBR material from a texture set {'color', 'rough', 'ao', 'disp', 'normal', 'metal'} box-projected (triplanar)
    in object coordinates x scale: no UVs needed. The height comes from 'disp' (else the colour's luminance) through a
    bump (tangent normal maps need UVs, which our primitives lack). The detail group is applied on top."""
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    o = _node(nt, 'ShaderNodeOutputMaterial'); p = _node(nt, 'ShaderNodeBsdfPrincipled')
    tc = _node(nt, 'ShaderNodeTexCoord'); mp = _node(nt, 'ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (scale, scale, scale); nt.links.new(tc.outputs[coord], mp.inputs[0])

    def img(key, cs):
        pth = tex.get(key)
        if not pth or not os.path.exists(pth): return None
        t = _node(nt, 'ShaderNodeTexImage'); t.image = cz.image(pth, cs); t.projection = 'BOX'; t.projection_blend = blend
        nt.links.new(mp.outputs[0], t.inputs[0])
        return t.outputs[0]
    c = img('color', 'sRGB') or img('albedo', 'sRGB') or img('diffuse', 'sRGB')
    if c is not None:
        if tint: c = _mix(nt, 1.0, c, tint, 'MULTIPLY')
        a = img('ao', 'Non-Color')
        if a is not None: c = _mix(nt, 0.8, c, a, 'MULTIPLY')
        nt.links.new(c, p.inputs['Base Color'])
    else: p.inputs['Base Color'].default_value = cz.col(tint or '#888888')
    r = img('rough', 'Non-Color') or img('roughness', 'Non-Color')
    if r is not None:
        bw = _node(nt, 'ShaderNodeRGBToBW'); nt.links.new(r, bw.inputs[0]); nt.links.new(bw.outputs[0], p.inputs['Roughness'])
    else: p.inputs['Roughness'].default_value = rough
    mt = img('metal', 'Non-Color') or img('metallic', 'Non-Color')
    if mt is not None:
        bw = _node(nt, 'ShaderNodeRGBToBW'); nt.links.new(mt, bw.inputs[0]); nt.links.new(bw.outputs[0], p.inputs['Metallic'])
    else: p.inputs['Metallic'].default_value = metal
    hgt = img('disp', 'Non-Color') or img('height', 'Non-Color')
    if hgt is None and c is not None:
        bw = _node(nt, 'ShaderNodeRGBToBW'); nt.links.new(c, bw.inputs[0]); hgt = bw.outputs[0]
    if hgt is not None and bump:
        b = _node(nt, 'ShaderNodeBump'); b.inputs['Strength'].default_value = bump; b.inputs['Distance'].default_value = 0.02
        nt.links.new(hgt, b.inputs['Height']); nt.links.new(b.outputs[0], p.inputs['Normal'])
    nt.links.new(p.outputs[0], o.inputs[0])
    m['cz_source'] = str(tex.get('id', ''))
    return m


def pbr(id_or_kind, scale=1.0, tint=None, name=None, detail=True, ground=None, **kw):
    """THE material call for a big surface: package A's texture `id` (A.pbr_from, else A.texture_set -> triplanar),
    else a procedural fallback by kind ('concrete', 'soil', 'rock', 'wood', 'steel', 'plaster', 'brick', 'asphalt' ...,
    with the kit's Flow textures where one fits). detail=True puts the detail group on it right away (finish() would
    anyway). kw: breakup / grime / dirt / dust / wear amounts for enrich()."""
    name = name or f'cz_pbr_{id_or_kind}'.replace('/', '_')[:60]
    m = bpy.data.materials.get(name)
    if m: return m
    A = _assets()
    if A is not None:
        for fn in ('pbr_from', 'texture_set'):
            try:
                if fn == 'pbr_from' and tint is None:
                    m = A.pbr_from(id_or_kind, scale=scale)
                else:
                    ts = A.texture_set(id_or_kind)
                    if ts: m = triplanar(name, dict(ts, id=id_or_kind), scale=scale, tint=tint)
                if m: break
            except Exception as e:
                print('CZ DETAIL assets', fn, id_or_kind, repr(e)[:160]); m = None
    if m is None:
        key = _word_key(id_or_kind, FALLBACK, compound=True) or 'concrete'
        colr, rough, metal, img, sc2, bump = FALLBACK[key]
        tex = {'color': os.path.join(TEX, img)} if img else {}
        if tex and os.path.exists(tex['color']):
            m = triplanar(name, tex, scale=scale * sc2, tint=tint, rough=rough, metal=metal, bump=bump)
            if tint is None and key in ('soil', 'dirt', 'rock', 'stone', 'wood', 'grass', 'snow', 'basalt', 'steel'): pass
        else:
            m = _proc(name, tint or colr, rough, metal, bump, scale)
        m['cz_source'] = 'fallback:' + key
    if detail:
        ka = dict(breakup=1.0, grime=1.0, dirt=1.0, dust=0.6, wear=0.0, ground=ground)
        ka.update(kw); enrich(m, **ka)
    return m


def _proc(name, color, rough, metal, bump, scale):
    """Procedural surface (no texture): base colour + pores (fine voronoi pits) + bump."""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    o = _node(nt, 'ShaderNodeOutputMaterial'); p = _node(nt, 'ShaderNodeBsdfPrincipled')
    tc = _node(nt, 'ShaderNodeTexCoord'); mp = _node(nt, 'ShaderNodeMapping'); mp.inputs['Scale'].default_value = (scale,) * 3
    nt.links.new(tc.outputs['Object'], mp.inputs[0])
    vo = _node(nt, 'ShaderNodeTexVoronoi'); vo.inputs['Scale'].default_value = 60.0; nt.links.new(mp.outputs[0], vo.inputs['Vector'])
    pits = _range(nt, vo.outputs['Distance'], 0.0, 0.18, 0.0, 1.0)
    c = _mix(nt, _range(nt, pits, 0.0, 1.0, 0.35, 0.0), color, _mix(nt, 1.0, color, (0.55, 0.55, 0.55, 1), 'MULTIPLY'))
    nt.links.new(c, p.inputs['Base Color'])
    p.inputs['Roughness'].default_value = rough; p.inputs['Metallic'].default_value = metal
    if bump:
        b = _node(nt, 'ShaderNodeBump'); b.inputs['Strength'].default_value = bump * 0.6; b.inputs['Distance'].default_value = 0.01
        nt.links.new(pits, b.inputs['Height']); nt.links.new(b.outputs[0], p.inputs['Normal'])
    nt.links.new(p.outputs[0], o.inputs[0])
    return m


# ---------------------------------------------------------------- scatter (instanced, camera-aware)
def _mesh_from(name, verts, faces):
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(map(float, v)) for v in verts], [], [tuple(f) for f in faces])
    me.update(); return me


def _variant_meshes(kind, n=6, seed=1):
    """Small procedural meshes for one scatter kind, origin at the base, about 1 unit big (scaled per instance)."""
    rnd = random.Random(seed); out = []
    for i in range(n):
        bm = bmesh.new()
        if kind in ('pebbles', 'gravel', 'rocks'):
            bmesh.ops.create_icosphere(bm, subdivisions=2, radius=0.5)
            ph = [rnd.uniform(0, 6.28) for _ in range(6)]
            fl = rnd.uniform(0.45, 0.7) if kind != 'rocks' else rnd.uniform(0.6, 0.9)
            ang = 0.25 if kind != 'rocks' else 0.45
            for v in bm.verts:
                d = v.co.normalized()
                k = 1 + ang * 0.5 * (math.sin(d.x * 3 + ph[0]) * math.sin(d.y * 2.7 + ph[1]) + 0.6 * math.sin(d.z * 4.1 + ph[2]))
                if kind == 'rocks': k *= 1 - 0.18 * max(0.0, math.sin(d.x * 5 + ph[3]) * math.cos(d.y * 5 + ph[4]))
                v.co = Vector((d.x * k * rnd.uniform(0.95, 1.05), d.y * k, d.z * k * fl))
            for v in bm.verts: v.co.z += 0.5 * fl * 0.6        # sit a little sunk
            me = bmesh_to_mesh(bm, f'cz_d_{kind}{i}', smooth=True)
        elif kind == 'grass':
            for b in range(rnd.randint(6, 10)):
                a = rnd.uniform(0, 6.28); r0 = rnd.uniform(0, 0.12); h = rnd.uniform(0.6, 1.0); lean = rnd.uniform(0.15, 0.45)
                w = rnd.uniform(0.025, 0.045)
                base = Vector((math.cos(a) * r0, math.sin(a) * r0, 0)); dirv = Vector((math.cos(a), math.sin(a), 0))
                side = Vector((-dirv.y, dirv.x, 0))
                vs = []
                for s in range(4):
                    t = s / 3; c = base + dirv * (lean * h * t * t) + Vector((0, 0, h * t)); ww = w * (1 - t) + 0.002
                    vs += [bm.verts.new(c - side * ww), bm.verts.new(c + side * ww)]
                for s in range(3): bm.faces.new((vs[2 * s], vs[2 * s + 1], vs[2 * s + 3], vs[2 * s + 2]))
            me = bmesh_to_mesh(bm, f'cz_d_grass{i}', smooth=True)
        elif kind == 'debris':
            if i % 2 == 0:                           # a twig: a thin bent stick with a side branch
                L = rnd.uniform(0.7, 1.0)
                _tube(bm, Vector((-L / 2, 0, 0.02)), Vector((L / 2, rnd.uniform(-0.08, 0.08), 0.02)), 0.02, 6)
                _tube(bm, Vector((rnd.uniform(-0.1, 0.2), 0, 0.02)), Vector((rnd.uniform(0.1, 0.3), rnd.uniform(0.15, 0.25), 0.02)), 0.012, 5)
            else:                                    # a leaf / bark chip: a bent diamond
                L, W = rnd.uniform(0.6, 0.9), rnd.uniform(0.25, 0.4)
                vs = [bm.verts.new(p) for p in ((-L / 2, 0, 0.02), (0, -W / 2, 0.06), (L / 2, 0, 0.0), (0, W / 2, 0.06), (0, 0, 0.0))]
                for a_, b_ in ((0, 1), (1, 2), (2, 3), (3, 0)): bm.faces.new((vs[a_], vs[b_], vs[4]))
            me = bmesh_to_mesh(bm, f'cz_d_debris{i}', smooth=True)
        else:
            raise ValueError('scatter kind: pebbles | gravel | rocks | grass | debris')
        out.append(me)
    return out


def bmesh_to_mesh(bm, name, smooth=True):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    if smooth: me.shade_smooth()
    return me


def _tube(bm, a, b, r, n=6):
    d = (b - a); L = d.length
    if L < 1e-6: return
    q = d.normalized().to_track_quat('Z', 'Y')
    rings = []
    for t in (0.0, 1.0):
        rr = r * (1 - 0.5 * t)
        rings.append([bm.verts.new(a + d * t + q @ Vector((math.cos(k * 6.2832 / n) * rr, math.sin(k * 6.2832 / n) * rr, 0))) for k in range(n)])
    for k in range(n):
        bm.faces.new((rings[0][k], rings[0][(k + 1) % n], rings[1][(k + 1) % n], rings[1][k]))


SCATTER_LOOK = {    # kind -> (colour a, colour b, roughness, size range in m)
    'pebbles': ('#4d4843', '#857d71', 0.65, (0.025, 0.07)),
    'gravel': ('#57524b', '#91897c', 0.7, (0.01, 0.025)),
    'rocks': ('#45423e', '#76716a', 0.8, (0.15, 0.45)),
    'grass': ('#2c4a1a', '#6c9440', 0.6, (0.06, 0.15)),
    'debris': ('#4a3424', '#8a6a40', 0.8, (0.06, 0.16)),
}


def _scatter_mat(kind, colors=None):
    a, b, rough, _ = SCATTER_LOOK[kind]
    if colors: a, b = colors
    name = f'cz_d_{kind}_m_{a}_{b}'
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    o = _node(nt, 'ShaderNodeOutputMaterial'); p = _node(nt, 'ShaderNodeBsdfPrincipled')
    oi = _node(nt, 'ShaderNodeObjectInfo')
    fac = oi.outputs['Random']
    if kind == 'grass':        # dark base -> light tip, per tuft hue jitter
        tc = _node(nt, 'ShaderNodeTexCoord'); sx = _node(nt, 'ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Object'], sx.inputs[0])
        fac = _math(nt, 'ADD', _math(nt, 'MULTIPLY', sx.outputs['Z'], 0.9), _math(nt, 'MULTIPLY', oi.outputs['Random'], 0.25), clamp=True)
        try: p.inputs['Subsurface Weight'].default_value = 0.0
        except Exception: pass
    c = _mix(nt, fac, a, b)
    nt.links.new(c, p.inputs['Base Color']); p.inputs['Roughness'].default_value = rough
    if kind in ('pebbles', 'gravel', 'rocks'):
        n = _noise(nt, None, 18.0, 4.0)
        b2 = _node(nt, 'ShaderNodeBump'); b2.inputs['Strength'].default_value = 0.3; nt.links.new(n, b2.inputs['Height'])
        nt.links.new(b2.outputs[0], p.inputs['Normal'])
    nt.links.new(p.outputs[0], o.inputs[0])
    m['cz_detail'] = 0
    return m


def _cam_frames(cam, frames):
    sc = bpy.context.scene; keep = sc.frame_current; out = []
    for f in frames:
        sc.frame_set(f); out.append((cam.matrix_world.copy(), cam.data.lens, cam.data.sensor_height))
    sc.frame_set(keep)
    return out


def cam_filter(P, frames=None, margin=0.15, near_full=None, min_keep=0.08, seed=1):
    """Keep the points the camera sees at any of `frames` (frustum + margin), thinned with distance: full density up to
    near_full (default: the nearest quarter of the visible points), then ~(near_full / d)^2, never below min_keep."""
    sc = bpy.context.scene; cam = sc.camera
    if cam is None or len(P) == 0: return np.ones(len(P), bool)
    if not frames:     # every 10 frames of the shot (fix round M6: 3 samples missed ground a 3-key Flight looks at)
        a, b = sc.frame_start, sc.frame_end
        try:           # the shot's own range = the baked camera's keys (a film's scene starts at 1, the shot at F0)
            fr = cam.animation_data.action.frame_range; a, b = int(fr[0]), int(fr[1])
        except Exception: pass
        frames = list(range(a, b + 1, 10)) + ([b] if (b - a) % 10 else [])
        if len(frames) > 48: frames = [frames[int(i * (len(frames) - 1) / 47)] for i in range(48)]
    aspect = sc.render.resolution_x / sc.render.resolution_y
    vis = np.zeros(len(P), bool); dist = np.full(len(P), np.inf)
    for mw, lens, sh in _cam_frames(cam, frames):
        inv = np.array(mw.inverted())
        Q = P @ inv[:3, :3].T + inv[:3, 3]
        z = -Q[:, 2]
        ty = (sh / 2) / lens * (1 + margin); tx = ty * aspect
        ok = (z > 0.05) & (np.abs(Q[:, 0]) < z * tx) & (np.abs(Q[:, 1]) < z * ty)
        vis |= ok
        dist = np.minimum(dist, np.where(ok, np.linalg.norm(Q, axis=1), np.inf))
    if not vis.any(): return vis
    d = dist[vis]
    nf = near_full or float(np.percentile(d, 25))
    w = np.clip((nf / np.maximum(dist, 1e-3)) ** 2, min_keep, 1.0)
    rng = np.random.default_rng(seed)
    return vis & (rng.random(len(P)) < w)


def _surface_points(obj, density, facing, seed):
    """Area-weighted random points on an object's evaluated faces whose normal matches `facing` ('up', 'any', or a
    vector the normal must point along within ~45 deg). Returns (P, N) world arrays."""
    dg = bpy.context.evaluated_depsgraph_get(); ev = obj.evaluated_get(dg); me = ev.to_mesh()
    me.calc_loop_triangles()
    V = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get('co', V); V = V.reshape(-1, 3)
    T = np.empty(len(me.loop_triangles) * 3, np.int32); me.loop_triangles.foreach_get('vertices', T); T = T.reshape(-1, 3)
    ev.to_mesh_clear()
    mw = np.array(obj.matrix_world); V = V @ mw[:3, :3].T + mw[:3, 3]
    a, b, c = V[T[:, 0]], V[T[:, 1]], V[T[:, 2]]
    cr = np.cross(b - a, c - a); ar = np.linalg.norm(cr, axis=1) / 2; N = cr / np.maximum(ar[:, None] * 2, 1e-12)
    if facing == 'up': sel = N[:, 2] > 0.6
    elif facing == 'any': sel = np.ones(len(N), bool)
    else:
        fv = np.array(facing, float); fv /= np.linalg.norm(fv); sel = N @ fv > 0.7
    a, b, c, ar, N = a[sel], b[sel], c[sel], ar[sel], N[sel]
    if not len(ar): return np.zeros((0, 3)), np.zeros((0, 3))
    rng = np.random.default_rng(seed)
    n = min(400000, int(ar.sum() * density))
    idx = rng.choice(len(ar), n, p=ar / ar.sum())
    u, v = rng.random(n), rng.random(n); flip = u + v > 1; u[flip], v[flip] = 1 - u[flip], 1 - v[flip]
    P = a[idx] + (b[idx] - a[idx]) * u[:, None] + (c[idx] - a[idx]) * v[:, None]
    return P, N[idx]


def scatter(kind, area=None, surface=None, density=40.0, z=0.0, facing='up', seed=1, size=None, colors=None, camera=True,
            frames=None, avoid=None, max_points=60000, embed=0.3, name=None, align=True):
    """Instance small detail over the ground: kind 'pebbles' | 'gravel' | 'rocks' | 'grass' | 'debris' (twigs + leaves).
    area=((x0, y0), (x1, y1)) with z (a number or z(x, y)), or surface=<object> (its faces matching `facing`: 'up', 'any'
    or a normal vector such as (0, -1, 0) for a cut face). density: per m2 before the camera thinning. camera=True keeps
    only what the shot's camera sees (call it AFTER the camera bake) and thins it with distance. avoid(x, y) -> True
    skips. embed: how much of each piece sinks into the surface. One object, GN-instanced (cheap in EEVEE).
    Returns the scatter object (its point count in ['cz_points'])."""
    t0 = time.time()
    rng = np.random.default_rng(seed)
    if surface is not None:
        P, N = _surface_points(surface, density, facing, seed)
    else:
        (x0, y0), (x1, y1) = area
        n = min(400000, int(abs((x1 - x0) * (y1 - y0)) * density))
        X = rng.uniform(x0, x1, n); Y = rng.uniform(y0, y1, n)
        Z = np.array([z(x, y) for x, y in zip(X, Y)]) if callable(z) else np.full(n, float(z))
        P = np.stack([X, Y, Z], 1); N = np.tile([0.0, 0.0, 1.0], (n, 1))
    if avoid is not None and len(P):
        keep = np.array([not avoid(x, y) for x, y in P[:, :2]], bool); P, N = P[keep], N[keep]
    if camera and len(P):
        keep = cam_filter(P, frames, seed=seed); P, N = P[keep], N[keep]
    if len(P) > max_points:
        sel = rng.choice(len(P), max_points, replace=False); P, N = P[sel], N[sel]
    n = len(P)
    lo, hi = size or SCATTER_LOOK[kind][3]
    S = np.exp(rng.uniform(math.log(lo), math.log(hi), n))     # log-uniform: many small, few big
    S = S * np.where(rng.random(n) < 0.08, 1.8, 1.0) if kind in ('pebbles', 'rocks') else S
    # rotation: random yaw, tilted onto the surface normal (align) for stones on slopes / cut faces
    yaw = rng.uniform(0, 2 * math.pi, n)
    R = np.zeros((n, 3))
    if align:          # Euler XYZ taking +Z onto the normal: (cos a sin b, -sin a, cos a cos b) = N
        R[:, 0] = np.arcsin(np.clip(-N[:, 1], -1, 1)); R[:, 1] = np.arctan2(N[:, 0], N[:, 2])
    R[:, 2] = np.where(N[:, 2] > 0.9, yaw, yaw * 0.15)     # (a world-Z yaw after the tilt would tip side-facing pieces)
    if kind in ('debris',): R[:, 0] += rng.uniform(-0.25, 0.25, n); R[:, 1] += rng.uniform(-0.25, 0.25, n)
    P = P - N * (S[:, None] * embed * (0.6 if kind in ('pebbles', 'gravel', 'rocks') else 0.0))
    var = rng.integers(0, 6, n)
    # the points object
    nm = name or f'cz_d_scatter_{kind}_{seed}'
    me = bpy.data.meshes.new(nm); me.vertices.add(n); me.vertices.foreach_set('co', P.astype(np.float32).ravel())
    for an, typ, dat in (('cz_rot', 'FLOAT_VECTOR', R), ('cz_scale', 'FLOAT', S), ('cz_var', 'INT', var)):
        at = me.attributes.new(an, typ, 'POINT')
        at.data.foreach_set('vector' if typ == 'FLOAT_VECTOR' else 'value', dat.astype(np.int32 if typ == 'INT' else np.float32).ravel())
    me.update()
    ob = bpy.data.objects.new(nm, me); bpy.context.scene.collection.objects.link(ob)
    # the variants (a collection the scene does not show; the instancer references it)
    col = bpy.data.collections.get(f'cz_d_{kind}_variants')
    if col is None:
        col = bpy.data.collections.new(f'cz_d_{kind}_variants')
        mat = _scatter_mat(kind, colors)
        for i, vm in enumerate(_variant_meshes(kind, 6, seed=7)):
            vm.materials.append(mat)
            vo = bpy.data.objects.new(f'cz_d_{kind}_v{i}', vm); col.objects.link(vo)
    md = ob.modifiers.new('cz_scatter', 'NODES'); md.node_group = _instancer_group(col)
    ob['cz_points'] = n; ob['cz_detail'] = 0
    _nocontact(ob, section_ok=True)      # small pieces sunk in the ground by design: never an overlap finding (B6)
    print(f'CZ DETAIL scatter {kind} {n} pieces in {time.time() - t0:.2f}s')
    return ob


def _instancer_group(col):
    """One instancer node group per variant collection (a collection socket on the modifier can't be set from Python
    in 5.2: 'id properties not supported'), so the Collection Info node holds it directly."""
    gname = 'cz_inst_' + col.name
    ng = bpy.data.node_groups.get(gname)
    if ng: return ng
    ng = bpy.data.node_groups.new(gname, 'GeometryNodeTree')
    ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
    ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    nt = ng
    gi = _node(nt, 'NodeGroupInput'); go = _node(nt, 'NodeGroupOutput')
    ci = _node(nt, 'GeometryNodeCollectionInfo'); ci.transform_space = 'ORIGINAL'
    ci.inputs['Collection'].default_value = col
    ci.inputs['Separate Children'].default_value = True; ci.inputs['Reset Children'].default_value = True
    def attr(nm, typ):
        a = _node(nt, 'GeometryNodeInputNamedAttribute', data_type=typ); a.inputs['Name'].default_value = nm
        return a.outputs['Attribute']
    ip = _node(nt, 'GeometryNodeInstanceOnPoints')
    _set(nt, ip.inputs['Points'], gi.outputs['Geometry']); _set(nt, ip.inputs['Instance'], ci.outputs[0])
    ip.inputs['Pick Instance'].default_value = True
    _set(nt, ip.inputs['Instance Index'], attr('cz_var', 'INT'))
    er = _node(nt, 'FunctionNodeEulerToRotation'); _set(nt, er.inputs[0], attr('cz_rot', 'FLOAT_VECTOR'))
    _set(nt, ip.inputs['Rotation'], er.outputs[0])
    _set(nt, ip.inputs['Scale'], attr('cz_scale', 'FLOAT'))
    _set(nt, go.inputs['Geometry'], ip.outputs['Instances'])
    return ng


def roots(at, axis='y', span=(-5, 5), top=0.0, depth=2.5, n=24, seed=3, r=(0.006, 0.02), color='#5a3f2c', sign=-1, name='cz_d_roots',
          avoid=None):
    """Thin roots hanging down a soil cut face (the plane axis = at, e.g. y = -3.5): random walks from the surface
    downward, tapering, lying a few mm proud of the face (sign: which side of the plane is the air, -1 = toward -axis).
    One mesh object."""
    rnd = random.Random(seed); bm = bmesh.new()
    for i in range(n):
        u = rnd.uniform(*span); z = top - rnd.uniform(0.0, 0.25); rr = rnd.uniform(*r)
        if avoid and avoid(u): continue           # (e.g. the hole / the wall in the section)
        L = rnd.uniform(0.3, 1.0) * depth; steps = max(4, int(L / 0.08)); du = rnd.uniform(-0.2, 0.2)
        pts = []
        for s in range(steps):
            pts.append((u, z)); du += rnd.uniform(-0.08, 0.08); du = max(-0.35, min(0.35, du))
            u += du * 0.08; z -= 0.08 * rnd.uniform(0.7, 1.0)
        for s in range(len(pts) - 1):
            t = s / (len(pts) - 1)
            a = _plane_pt(axis, at, sign * rr * 0.4, pts[s]); b = _plane_pt(axis, at, sign * rr * 0.4, pts[s + 1])
            _tube(bm, a, b, rr * (1 - 0.85 * t), 5)
            if rnd.random() < 0.12:           # a side rootlet
                c = (pts[s][0] + rnd.uniform(-0.25, 0.25), pts[s][1] - rnd.uniform(0.1, 0.3))
                _tube(bm, a, _plane_pt(axis, at, sign * rr * 0.3, c), rr * 0.45, 4)
    me = bmesh_to_mesh(bm, name)
    m = bpy.data.materials.get('cz_d_roots_m') or _proc('cz_d_roots_m', color, 0.85, 0.0, 0.3, 4.0)
    m['cz_detail'] = 0; me.materials.append(m)
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob); ob['cz_detail'] = 0
    _nocontact(ob, section_ok=True)      # lying in the cut face by design (B6)
    return ob


def _plane_pt(axis, at, off, uv):
    u, z = uv
    return Vector((at + off, u, z)) if axis == 'x' else Vector((u, at + off, z))


# ---------------------------------------------------------------- kitbash: greebles, bolts, labels, hazard decals
def _face_frame(obj, face):
    """World AABB face of an object: (centre, normal, u axis, v axis, half sizes (hu, hv))."""
    dg = bpy.context.evaluated_depsgraph_get(); ev = obj.evaluated_get(dg)
    cs = [ev.matrix_world @ Vector(c) for c in ev.bound_box]
    lo = Vector([min(c[i] for c in cs) for i in range(3)]); hi = Vector([max(c[i] for c in cs) for i in range(3)])
    ax = 'xyz'.index(face[1]); s = 1 if face[0] == '+' else -1
    n = Vector((0, 0, 0)); n[ax] = s
    c = (lo + hi) / 2; c[ax] = hi[ax] if s > 0 else lo[ax]
    others = [i for i in range(3) if i != ax]
    if ax != 2: others = [o for o in others if o != 2] + [2]          # vertical faces: u horizontal, v up
    u = Vector((0, 0, 0)); u[others[0]] = 1; v = Vector((0, 0, 0)); v[others[1]] = 1
    return c, n, u, v, ((hi - lo)[others[0]] / 2, (hi - lo)[others[1]] / 2)


def greebles(obj, face='-y', n=24, seed=1, kinds=('panel', 'box', 'bolt', 'vent', 'pipe'), mat=None, margin=0.08, depth=None,
             name=None):
    """Kitbash detail on one AABB face of a machine / wall ('+x', '-y', '+z' ...): access panels, small boxes, bolt rows,
    vent slats and pipe runs, sized from the face, joined into one mesh parented to obj. mat: default = obj's first
    material darkened. Returns the object."""
    rnd = random.Random(seed)
    c, nrm, u, v, (hu, hv) = _face_frame(obj, face)
    s = min(hu, hv); depth = depth or s * 0.04
    bm = bmesh.new()

    def box_at(cu, cv, wu, wv, d):
        o = c + u * cu + v * cv + nrm * (d / 2)
        m = bmesh.ops.create_cube(bm, size=1.0)['verts']
        R = Matrix((u, v, nrm)).transposed()
        for vt in m: vt.co = o + R @ Vector((vt.co.x * wu, vt.co.y * wv, vt.co.z * d))
    for i in range(n):
        k = kinds[i % len(kinds)]
        cu, cv = rnd.uniform(-hu * (1 - margin), hu * (1 - margin)), rnd.uniform(-hv * (1 - margin), hv * (1 - margin))
        if k == 'panel': box_at(cu, cv, rnd.uniform(0.15, 0.35) * s, rnd.uniform(0.12, 0.3) * s, depth * 0.35)
        elif k == 'box': box_at(cu, cv, rnd.uniform(0.05, 0.14) * s, rnd.uniform(0.05, 0.12) * s, depth * rnd.uniform(1.0, 2.5))
        elif k == 'bolt':
            for j in range(4): box_at(cu + j * 0.035 * s, cv, 0.014 * s, 0.014 * s, depth * 0.5)
        elif k == 'vent':
            for j in range(5): box_at(cu, cv + j * 0.025 * s, 0.16 * s, 0.008 * s, depth * 0.6)
        elif k == 'pipe':
            L = rnd.uniform(0.3, 0.8) * s; a = c + u * (cu - L / 2) + v * cv + nrm * depth * 1.2
            _tube(bm, a, a + u * L, depth * 0.5, 8)
    me = bmesh_to_mesh(bm, name or f'{obj.name}_greebles', smooth=False)
    if mat is None:
        base = obj.material_slots[0].material if obj.material_slots else None
        mat = _darker(base, 0.78) if base else pbr('metal', detail=False)
    me.materials.append(mat)
    ob = bpy.data.objects.new(me.name, me); bpy.context.scene.collection.objects.link(ob)
    b = ob.modifiers.new('cz_bevel', 'BEVEL'); b.width = depth * 0.15; b.segments = 2; b.limit_method = 'ANGLE'
    ob.parent = obj; ob.matrix_parent_inverse = obj.matrix_world.inverted()
    return ob


def _darker(mat, k):
    nm = mat.name + f'_d{int(k * 100)}'
    m = bpy.data.materials.get(nm)
    if m: return m
    m = mat.copy(); m.name = nm
    for p in _principled(m):
        bc = p.inputs['Base Color']
        if not bc.is_linked: bc.default_value = tuple(x * k for x in bc.default_value[:3]) + (1,)
    return m


def bolts(obj, face='-y', rows=2, cols=8, r=None, inset=0.06, mat=None):
    """Bolt heads in rows along the edges of an AABB face (flanges, steel plates, hatches)."""
    c, nrm, u, v, (hu, hv) = _face_frame(obj, face)
    r = r or min(hu, hv) * 0.025
    bm = bmesh.new()
    for rv in range(rows):
        vv = -hv + inset * 2 * hv + rv * (2 * hv * (1 - 2 * inset)) / max(1, rows - 1)
        for cu_ in range(cols):
            uu = -hu + inset * 2 * hu + cu_ * (2 * hu * (1 - 2 * inset)) / max(1, cols - 1)
            p = c + u * uu + v * vv
            _tube(bm, p - nrm * r * 0.2, p + nrm * r * 0.7, r, 6)
    me = bmesh_to_mesh(bm, f'{obj.name}_bolts', smooth=True)
    me.materials.append(mat or pbr('steel', detail=False))
    ob = bpy.data.objects.new(me.name, me); bpy.context.scene.collection.objects.link(ob)
    ob.parent = obj; ob.matrix_parent_inverse = obj.matrix_world.inverted()
    return ob


def label(text, loc, rot=(90, 0, 0), size=0.12, plate='#f2f0ea', ink='#18191b', pad=0.35, depth=0.006, parent=None):
    """A printed label / sign: a thin bevelled plate with dark text on it (3D, lit like the set; never a 2D overlay)."""
    t = cz.text(f'cz_d_label_{text[:12]}', text, size=size, loc=(0, 0, 0), mat=bpy.data.materials.get('cz_d_label_ink_' + ink) or _proc('cz_d_label_ink_' + ink, ink, 0.5, 0.0, 0.0, 1.0),
                rot=(0, 0, 0), extrude=0.0)
    bpy.context.view_layer.update()
    w = max(t.dimensions.x, size) + size * pad * 2; h = max(t.dimensions.y, size * 0.8) + size * pad * 2
    pl = cz.box(f'cz_d_plate_{text[:12]}', (w, h, depth), loc, _proc('cz_d_plate_' + plate, plate, 0.45, 0.0, 0.05, 30.0), rot=rot,
                bevel=depth * 0.4, ol=0, parent=parent)
    t.parent = pl; t.location = (0, 0, depth / 2 + 0.0008)
    return pl


def hazard(w, h, loc, rot=(90, 0, 0), stripe=0.12, a='#e8b21c', b='#151515', parent=None):
    """Hazard stripes (yellow / black diagonal) on a thin plate - for machine edges, pits, barriers."""
    m = bpy.data.materials.get('cz_d_hazard_' + a)
    if m is None:
        m = bpy.data.materials.new('cz_d_hazard_' + a); m.use_nodes = True
        nt = m.node_tree; nt.nodes.clear()
        o = _node(nt, 'ShaderNodeOutputMaterial'); p = _node(nt, 'ShaderNodeBsdfPrincipled')
        tc = _node(nt, 'ShaderNodeTexCoord'); sx = _node(nt, 'ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Object'], sx.inputs[0])
        d = _math(nt, 'ADD', sx.outputs['X'], sx.outputs['Y'])
        st = _math(nt, 'GREATER_THAN', _math(nt, 'FRACT', _math(nt, 'DIVIDE', d, stripe * 2)), 0.5)
        nt.links.new(_mix(nt, st, a, b), p.inputs['Base Color']); p.inputs['Roughness'].default_value = 0.5
        nt.links.new(p.outputs[0], o.inputs[0])
    return cz.box('cz_d_hazard', (w, h, 0.006), loc, m, rot=rot, bevel=0.002, ol=0, parent=parent)


# ---------------------------------------------------------------- light, atmosphere, motes, depth of field
def light(preset='day', rim=None, hdri=None, hdri_strength=1.0, contact=True):
    """On top of M.setup: preset 'day' | 'golden' | 'overcast' | 'interior' | 'night'. rim: a kicker sun from behind
    (fraction of the key; default per preset; it casts shadows, so a cutaway's walls still shade the inside) that
    outlines silhouettes; contact: full-res sun shadows
    (crisper contact shadows under props). hdri: a package-A HDRI id lighting the scene (reflections + ambient) while
    the camera still sees M.setup's sky. Returns the rim lamp (or None)."""
    sc = bpy.context.scene
    sun = bpy.data.objects.get('sun')
    rims = {'day': 0.45, 'golden': 0.6, 'overcast': 0.25, 'interior': 0.3, 'night': 0.5}
    rim = rims.get(preset, 0.4) if rim is None else rim
    if contact:
        try: sc.eevee.shadow_resolution_scale = 1.0
        except Exception: pass
    if sun and preset == 'overcast':
        sun.data.energy *= 0.4; sun.data.angle = math.radians(12)
    if sun and preset == 'golden':
        sun.data.color = (1.0, 0.78, 0.55)
    if sun and preset == 'night':
        sun.data.energy *= 0.15; sun.data.color = (0.6, 0.7, 1.0)
    lamp = None
    if rim > 0 and sun:
        d = sun.matrix_world.to_quaternion() @ Vector((0, 0, 1))           # toward the sun
        back = Vector((-d.x, -d.y, 0)).normalized() if Vector((d.x, d.y, 0)).length > 1e-3 else Vector((0, 1, 0))
        back.z = math.tan(math.radians(22)); back.normalize()
        ld = bpy.data.lights.new('cz_d_rim', 'SUN'); ld.energy = sun.data.energy * rim; ld.angle = math.radians(3)
        ld.color = (0.86, 0.92, 1.0) if preset in ('day', 'golden') else (1.0, 0.95, 0.88)
        ld.use_shadow = True          # (fix round M6: a shadowless rim passed through cutaway walls and lit interiors)
        lamp = bpy.data.objects.new('cz_d_rim', ld); sc.collection.objects.link(lamp)
        lamp.rotation_euler = (-back).to_track_quat('-Z', 'Y').to_euler()
    if preset == 'interior':
        cz.light('cz_d_bounce', 'AREA', loc=(0, 0, 6), rot=(180, 0, 0), color='#ffe9d0', power=300, size=8, shadow=False)
    if hdri:
        A = _assets(); pth = None
        try: pth = A.hdri(hdri) if A else None
        except Exception as e: print('CZ DETAIL hdri', repr(e)[:120])
        if pth and os.path.exists(pth): _world_hdri(sc, pth, hdri_strength)
        else: print('CZ DETAIL hdri missing', hdri)
    return lamp


def _world_hdri(sc, path, strength):
    """Swap the LIGHTING branch of M.setup's world (what non-camera rays see) for an HDRI; the camera keeps the sky."""
    nt = sc.world.node_tree
    mx = next((n for n in nt.nodes if n.type == 'MIX_SHADER'), None)
    if mx is None or not mx.inputs[1].is_linked: print('CZ DETAIL hdri: world is not M.setup\'s'); return
    bl = mx.inputs[1].links[0].from_node
    env = _node(nt, 'ShaderNodeTexEnvironment'); env.image = cz.image(path, 'Linear Rec.709')
    try: env.image.colorspace_settings.name = 'Linear Rec.709'
    except Exception: pass
    for l in list(bl.inputs[0].links): nt.links.remove(l)
    nt.links.new(env.outputs[0], bl.inputs[0]); bl.inputs[1].default_value = strength


def fog(density=0.002, height=12.0, z0=0.0, color='#d6dde6', center=None, size=600.0, shafts=False, tile='8', end=220.0,
        anisotropy=0.35):
    """Height fog / aerial haze as an EEVEE volume box: thick at z0, thinning with `height` (exp falloff). The sky
    stays clean (the box ends at `end` from the camera). shafts=True: volumetric shadows (light shafts through gaps;
    costs more). density ~0.005 (a hint of air) .. 0.05 (a misty valley); interiors: 0.02-0.08 with shafts."""
    sc = bpy.context.scene; ee = sc.eevee
    for k, v in (('volumetric_tile_size', tile), ('volumetric_samples', 32), ('volumetric_end', end), ('volumetric_start', 0.1),
                 ('use_volumetric_shadows', shafts), ('volumetric_shadow_samples', 8), ('volumetric_sample_distribution', 0.8)):
        try: setattr(ee, k, v)
        except Exception as e: print('CZ DETAIL fog', k, e)
    m = bpy.data.materials.new('cz_d_fog'); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    o = _node(nt, 'ShaderNodeOutputMaterial'); pv = _node(nt, 'ShaderNodeVolumePrincipled')
    pv.inputs['Color'].default_value = cz.col(color); pv.inputs['Anisotropy'].default_value = anisotropy
    geo = _node(nt, 'ShaderNodeNewGeometry'); sz = _node(nt, 'ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Position'], sz.inputs[0])
    hz = _math(nt, 'DIVIDE', _math(nt, 'SUBTRACT', sz.outputs['Z'], z0), height)
    dens = _math(nt, 'MULTIPLY', _math(nt, 'EXPONENT', _math(nt, 'MULTIPLY', _math(nt, 'MAXIMUM', hz, 0.0), -1.0)), density)
    nt.links.new(dens, pv.inputs['Density']); nt.links.new(pv.outputs[0], o.inputs['Volume'])
    cam = sc.camera
    c = Vector(center) if center else (cam.matrix_world.translation.copy() if cam else Vector((0, 0, 0)))
    bpy.ops.mesh.primitive_cube_add(size=1, location=(c.x, c.y, z0 + size * 0.25))
    ob = bpy.context.object; ob.name = 'cz_d_fog'; ob.scale = (size, size, size * 0.5)
    ob.data.materials.append(m); ob['cz_detail'] = 0
    _nocontact(ob, section_ok=True)      # a volume, not a solid: the camera flies inside it (B6)
    try: ob.visible_shadow = False
    except Exception: pass
    return ob


def motes(center, size=(4, 4, 3), n=160, f0=1, f1=300, color='#fff1d8', r=(0.0015, 0.004), drift=(0.03, 0.0, 0.02),
          swirl=0.12, glow=0.0, seed=5):
    """Dust motes floating in the light (secondary motion that makes a still interior / a beam feel alive): n tiny
    specks in a box, drifting + swirling with the scene time (geometry nodes, no keyframes). glow: emission so they
    read in shade; keep <= 1. Returns the object."""
    rng = np.random.default_rng(seed)
    P = (rng.random((n, 3)) - 0.5) * np.array(size) + np.array(center)
    me = bpy.data.meshes.new('cz_d_motes'); me.vertices.add(n); me.vertices.foreach_set('co', P.astype(np.float32).ravel())
    S = rng.uniform(*r, n).astype(np.float32)
    at = me.attributes.new('cz_scale', 'FLOAT', 'POINT'); at.data.foreach_set('value', S); me.update()
    ob = bpy.data.objects.new('cz_d_motes', me); bpy.context.scene.collection.objects.link(ob); ob['cz_detail'] = 0
    _nocontact(ob, section_ok=True)
    ng = bpy.data.node_groups.new('cz_motes', 'GeometryNodeTree')
    ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
    ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    nt = ng; gi = _node(nt, 'NodeGroupInput'); go = _node(nt, 'NodeGroupOutput')
    tm = _node(nt, 'GeometryNodeInputSceneTime'); pos = _node(nt, 'GeometryNodeInputPosition')
    tv = _node(nt, 'ShaderNodeCombineXYZ'); _set(nt, tv.inputs[0], _math(nt, 'MULTIPLY', tm.outputs['Seconds'], 0.15))
    sw = _node(nt, 'ShaderNodeVectorMath', operation='ADD'); _set(nt, sw.inputs[0], pos.outputs[0]); _set(nt, sw.inputs[1], tv.outputs[0])
    nz = _node(nt, 'ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 0.6; _set(nt, nz.inputs['Vector'], sw.outputs[0])
    off = _node(nt, 'ShaderNodeVectorMath', operation='MULTIPLY_ADD'); _set(nt, off.inputs[0], nz.outputs['Color'])
    off.inputs[1].default_value = (2 * swirl,) * 3; off.inputs[2].default_value = (-swirl,) * 3
    dv = _node(nt, 'ShaderNodeVectorMath', operation='SCALE'); dv.inputs[0].default_value = drift
    _set(nt, dv.inputs['Scale'], tm.outputs['Seconds'])
    tot = _node(nt, 'ShaderNodeVectorMath', operation='ADD'); _set(nt, tot.inputs[0], off.outputs[0]); _set(nt, tot.inputs[1], dv.outputs[0])
    sp = _node(nt, 'GeometryNodeSetPosition'); _set(nt, sp.inputs['Geometry'], gi.outputs[0]); _set(nt, sp.inputs['Offset'], tot.outputs[0])
    ico = _node(nt, 'GeometryNodeMeshIcoSphere'); ico.inputs['Radius'].default_value = 1.0; ico.inputs['Subdivisions'].default_value = 1
    ip = _node(nt, 'GeometryNodeInstanceOnPoints'); _set(nt, ip.inputs['Points'], sp.outputs[0]); _set(nt, ip.inputs['Instance'], ico.outputs[0])
    sa = _node(nt, 'GeometryNodeInputNamedAttribute', data_type='FLOAT'); sa.inputs['Name'].default_value = 'cz_scale'
    _set(nt, ip.inputs['Scale'], sa.outputs['Attribute'])
    sm = _node(nt, 'GeometryNodeSetMaterial'); _set(nt, sm.inputs['Geometry'], ip.outputs[0])
    m = bpy.data.materials.new('cz_d_motes_m'); m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = cz.col(color); p.inputs['Emission Color'].default_value = cz.col(color)
    p.inputs['Emission Strength'].default_value = glow; p.inputs['Roughness'].default_value = 0.6
    sm.inputs['Material'].default_value = m
    _set(nt, go.inputs[0], sm.outputs[0])
    md = ob.modifiers.new('cz_motes', 'NODES'); md.node_group = ng
    try: ob.visible_shadow = False
    except Exception: pass
    return ob


DOF = {'off': 0, 'subtle': 5, 'medium': 9, 'macro': 16}      # background blur in px of the 1080-wide frame


def dof(focus=None, blur='subtle', f0=None, f1=None, step=6):
    """Depth of field sized for a phone at 9:16: `blur` = how many pixels (of the 1080-wide frame) a far background
    smears ('subtle' 5, 'medium' 9, 'macro' 16, or a number), the f-stop solved per frame from the focus distance and
    the lens. focus: an object, a point, or None = what the camera centre looks at (ray cast every `step` frames,
    smoothed). Post-process DOF (cheap). Call AFTER the camera bake."""
    sc = bpy.context.scene; cam = sc.camera
    if cam is None: return None
    px = DOF.get(blur, blur) if isinstance(blur, str) else blur
    if not px: cam.data.dof.use_dof = False; return None
    f0 = f0 or sc.frame_start; f1 = f1 or sc.frame_end
    cd = cam.data; cd.dof.use_dof = True
    try: sc.eevee.bokeh_max_size = 40.0
    except Exception: pass
    frames = list(range(f0, f1 + 1, step)) + ([f1] if (f1 - f0) % step else [])
    keep = sc.frame_current; D_ = []
    for f in frames:
        sc.frame_set(f); mw = cam.matrix_world; eye = mw.translation; fwd = (mw.to_quaternion() @ Vector((0, 0, -1))).normalized()
        if focus is None:
            hit, loc, *_ = sc.ray_cast(bpy.context.evaluated_depsgraph_get(), eye + fwd * 0.05, fwd)
            d = (loc - eye).length if hit else 30.0
        elif hasattr(focus, 'matrix_world'): d = max(0.1, (focus.matrix_world.translation - eye).dot(fwd))
        else: d = max(0.1, (Vector(focus) - eye).dot(fwd))
        D_.append(d)
    sc.frame_set(keep)
    # smooth the focus pull (a ray hitting a passing prop must not snap it)
    Ds = [sum(D_[max(0, i - 1):i + 2]) / len(D_[max(0, i - 1):i + 2]) for i in range(len(D_))]
    res_x = sc.render.resolution_x
    for f, d in zip(frames, Ds):
        sc.frame_set(f)
        lens = cd.lens; sh = cd.sensor_height
        coc_mm = px / res_x * (sh * res_x / sc.render.resolution_y)        # px on the frame -> mm on the sensor (vertical fit)
        s = d * 1000.0
        N = max(0.35, lens * lens / max(1e-6, coc_mm * max(1.0, s - lens)))
        cd.dof.focus_distance = d; cd.dof.keyframe_insert('focus_distance', frame=f)
        cd.dof.aperture_fstop = N; cd.dof.keyframe_insert('aperture_fstop', frame=f)
    sc.frame_set(keep)
    return Ds


# ---------------------------------------------------------------- round 2: scanned detail, relief, corner light, real models
# What the night's films lacked most next to the originals (round 1 measured it: procedural breakup alone stays
# invisible at phone size): photo-scanned surfaces, real relief on cut faces, dark corners, real vegetation.
SCANS = {    # material-name keyword -> package A texture id (Poly Haven / ambientCG, CC0), tried in this order
    'concrete': 'ph:concrete_wall_003', 'cement': 'ph:concrete_wall_003', 'footing': 'ph:concrete_wall_003', 'slab': 'ph:concrete_wall_003',
    'fresh': 'ph:concrete_wall_003',
    'soil': 'ph:red_laterite_soil_stones', 'fill': 'ph:red_laterite_soil_stones', 'spoil': 'ph:red_laterite_soil_stones',
    'mound': 'ph:red_laterite_soil_stones', 'dirt': 'ph:red_laterite_soil_stones', 'mud': 'ph:brown_mud_03', 'earth': 'ph:red_laterite_soil_stones',
    'gallery': 'ph:red_laterite_soil_stones', 'farfloor': 'ph:forrest_ground_01', 'litter': 'ph:forrest_ground_01',
    'brick': 'ph:brick_wall_001', 'chimney': 'ph:brick_wall_001',
    'shingle': 'ph:roof_slates_03', 'roof': 'ph:roof_slates_03',
    'gravel': 'ph:sandy_gravel_02', 'pebble': 'ph:coast_sand_rocks_02', 'rock': 'ph:coast_sand_rocks_02', 'stone': 'ph:coast_sand_rocks_02',
    'hillgrass': 'ph:grass_ground', 'lawn': 'ph:grass_ground', 'mulch': 'ph:forrest_ground_01',
    'siding': 'acg:Paint006', 'trim': 'acg:Paint006', 'paint': 'acg:Paint006',
    'bark': 'ph:bark_brown_02', 'root': 'ph:bark_brown_02', 'trunk': 'ph:bark_brown_02', 'tar': 'ph:concrete_floor_worn_001', 'hearth': 'ph:coast_sand_rocks_02',
}
_MEAN = {}
_SCANFAIL = {}             # texture id -> why it could not be laid in (scan_all prints them)
SCAN_AMOUNT = {'concrete': 0.6, 'cement': 0.6, 'footing': 0.6, 'slab': 0.6, 'fresh': 0.5, 'siding': 0.5, 'trim': 0.4, 'paint': 0.45}   # (else 0.9)


def _img_mean(img, srgb=True):
    """Mean colour of an image as the SHADER sees it (cached): the scan is applied RELATIVE to it, so the film's own
    colour design stays. image.pixels of an 8-bit sRGB image are the encoded values: linearise per pixel first (v1 of
    this divided linear samples by an sRGB mean and darkened everything ~2.5x)."""
    k = (img.name, srgb)
    if k in _MEAN: return _MEAN[k]
    w, h = img.size
    tmp = None
    if w * h > 512 * 512:      # (a 4k map is 256 MB as float pixels: average a 256 px copy instead)
        try: tmp = img.copy(); tmp.scale(256, max(1, int(256 * h / max(w, 1)))); src = tmp
        except Exception: tmp = None; src = img
    else: src = img
    w2, h2 = src.size
    a = np.empty(w2 * h2 * 4, np.float32); src.pixels.foreach_get(a)
    if tmp is not None: bpy.data.images.remove(tmp)
    a = a.reshape(-1, 4)[:, :3]
    if srgb and not img.is_float:
        a = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    _MEAN[k] = tuple(float(x) for x in a.mean(0))
    return _MEAN[k]


def scan(mat, tex_id, amount=0.9, hue=0.35, rough=0.6, bump=0.8, scale=None, coord='World', ao=0.9):
    """Detail transfer: a scanned PBR set (package A) laid INTO an existing material - its colour divided by its own mean
    (so a white wall stays white, the film's soil strata stay brown) multiplies the material's colour (amount; hue = how
    much of the scan's own colour variation comes along), its AO darkens crevices, its roughness blends in (rough), its
    height map (else its luminance) drives a bump (bump). coord 'World' (sets built of many boxes match across the
    joins) or 'Object' (moving props). scale = tiles per metre (None = the scan's real size). Returns True when applied."""
    if mat is None or mat.get('cz_scan') or skip_material(mat) and not mat.get('cz_detailed'): return False
    A = _assets()
    if A is None: _SCANFAIL[tex_id] = 'no assets.py'; return False
    try: ts = A.texture_set(tex_id)
    except Exception as e:
        _SCANFAIL[tex_id] = repr(e)[:140]; print('CZ DETAIL scan', tex_id, repr(e)[:140]); return False
    if not ts.get('color') or not os.path.exists(ts['color']): _SCANFAIL[tex_id] = 'no colour map on disk'; return False
    nt = mat.node_tree
    ps = _principled(mat)
    if not ps: return False
    sc = scale or 1.0 / float(ts.get('size_m') or 2.0)
    if coord == 'World':
        src = _node(nt, 'ShaderNodeNewGeometry').outputs['Position']
    else:
        src = _node(nt, 'ShaderNodeTexCoord').outputs['Object']
    mp = _node(nt, 'ShaderNodeMapping'); mp.inputs['Scale'].default_value = (sc, sc, sc); nt.links.new(src, mp.inputs[0])

    def img(key, cs):
        pth = ts.get(key)
        if not pth or not os.path.exists(pth): return None
        t = _node(nt, 'ShaderNodeTexImage'); t.image = cz.image(pth, cs); t.projection = 'BOX'; t.projection_blend = 0.3
        nt.links.new(mp.outputs[0], t.inputs[0])
        return t
    tc = img('color', 'sRGB'); mean = _img_mean(tc.image)
    lum = 0.2126 * mean[0] + 0.7152 * mean[1] + 0.0722 * mean[2]
    # scan / mean: ~1 on average; its luminance (grey detail) and a little of its hue
    inv = _node(nt, 'ShaderNodeVectorMath', operation='DIVIDE'); nt.links.new(tc.outputs[0], inv.inputs[0])
    inv.inputs[1].default_value = tuple(max(1e-3, m) for m in mean)
    bw = _node(nt, 'ShaderNodeRGBToBW'); nt.links.new(tc.outputs[0], bw.inputs[0])
    gl = _math(nt, 'DIVIDE', bw.outputs[0], max(1e-3, lum))
    grey = _node(nt, 'ShaderNodeCombineColor'); [nt.links.new(gl, grey.inputs[i]) for i in range(3)]
    det = _mix(nt, hue, grey.outputs[0], inv.outputs[0])
    a = img('ao', 'Non-Color')
    if a is not None and ao:       # relative too: crevices darker, the average unchanged
        am = _img_mean(a.image, srgb=False)
        an = _node(nt, 'ShaderNodeVectorMath', operation='DIVIDE'); nt.links.new(a.outputs[0], an.inputs[0])
        an.inputs[1].default_value = tuple(max(0.05, x) for x in am)
        det = _mix(nt, ao, det, an.outputs[0], 'MULTIPLY')
    det = _mix(nt, amount, (1, 1, 1, 1), det)
    for p in ps:
        bc = p.inputs['Base Color']
        if bc.is_linked:
            s = bc.links[0].from_socket; nt.links.remove(bc.links[0]); c = _mix(nt, 1.0, s, det, 'MULTIPLY')
        else: c = _mix(nt, 1.0, tuple(bc.default_value), det, 'MULTIPLY')
        nt.links.new(c, bc)
        r = img('rough', 'Non-Color')
        if r is not None and rough:
            rs = p.inputs['Roughness']
            base = rs.links[0].from_socket if rs.is_linked else rs.default_value
            if rs.is_linked: nt.links.remove(rs.links[0])
            rb = _node(nt, 'ShaderNodeRGBToBW'); nt.links.new(r.outputs[0], rb.inputs[0])
            nt.links.new(_mix(nt, rough, (base,) * 3 + (1,) if not isinstance(base, bpy.types.NodeSocket) else base, rb.outputs[0]), rs)
        if bump:
            h = img('disp', 'Non-Color')
            hs = h.outputs[0] if h is not None else bw.outputs[0]
            b = _node(nt, 'ShaderNodeBump'); b.inputs['Strength'].default_value = bump
            b.inputs['Distance'].default_value = 0.03 / max(sc, 0.05) * 0.3
            nt.links.new(hs, b.inputs['Height'])
            ns = p.inputs['Normal']
            if ns.is_linked:
                s = ns.links[0].from_socket; nt.links.remove(ns.links[0]); nt.links.new(s, b.inputs['Normal'])
            nt.links.new(b.outputs[0], ns)
    mat['cz_scan'] = tex_id
    return True


def scan_all(mapping=None, coord='World', amount=0.9, quiet=False, **kw):
    """scan() every material of the scene whose NAME contains a keyword of `mapping` (default SCANS: concrete, soil,
    brick, shingle, gravel, rock, siding, bark ...). The film's materials keep their colours; the scans bring real
    pores, grain, stones and crevices. Returns {material: texture id}."""
    mapping = mapping or SCANS; t0 = time.time(); done = {}; failed = {}
    mats = {ms.material for o in bpy.context.scene.objects for ms in getattr(o, 'material_slots', [])
            if ms.material and o.get('cz_detail', 1) != 0 and not _is_asset(o)}
    for m in sorted(mats, key=lambda m: m.name):
        key = _word_key(m.name, mapping, compound=True)          # (by word, longest key first: fix round B5)
        if not key: continue
        _SCANFAIL.pop(mapping[key], None)
        if scan(m, mapping[key], amount=amount * SCAN_AMOUNT.get(key, 1.0), coord=coord, **kw): done[m.name] = mapping[key]
        elif mapping[key] in _SCANFAIL: failed[m.name] = mapping[key]
    if not quiet:
        print(f'CZ DETAIL scan {len(done)} materials in {time.time() - t0:.2f}s: ' + ', '.join(f'{k}={v}' for k, v in done.items()))
        if failed:      # (fix round M7: loud, so a missing cache on the Mac mini is seen, not silently flat)
            ids = sorted(set(failed.values()))
            print(f'CZ DETAIL WARN scan: {len(failed)} materials got NO scan ({", ".join(sorted(failed))}): '
                  + '; '.join(f'{i}: {_SCANFAIL.get(i, "?")}' for i in ids) + ' - fetch the ids into the asset cache')
    return done


def relief(objs, normal=(0, -1, 0), amount=0.2, freq=2.0, res=None, max_verts=250000, seed=7, base=0.004, taper=0.15, name='cz_d_relief',
           clear=None):
    """Real relief on the camera-facing CUT faces of set boxes (the soil section, a rock face): a displaced grid skin
    over each object's AABB face along `normal`, lumps out to `amount` m (world fbm, so neighbouring boxes match), its
    free borders tapered (a hole's edge stays crisp), the object's own material. Budget: max_verts over all skins
    (res = grid step, auto). Static objects only. Returns the skins."""
    t0 = time.time()
    import mega as M
    nv = Vector(normal).normalized(); ax = max(range(3), key=lambda i: abs(nv[i])); sgn = 1 if nv[ax] > 0 else -1
    rects = []
    dg = bpy.context.evaluated_depsgraph_get()
    uo = [i for i in range(3) if i != ax]
    for o in objs:
        if o is None or o.type != 'MESH': continue
        if o.animation_data and o.animation_data.action:
            print(f'CZ DETAIL WARN relief: {o.name} moves (animated): no relief skin on it'); continue
        # the object's own faces that look along `normal` and lie on its outermost plane (a joined block minus a hole is
        # several rectangles: the hole stays open)
        ev = o.evaluated_get(dg); me = ev.data; mw = ev.matrix_world; nm3 = mw.to_3x3().inverted().transposed()
        fl = []
        for p in me.polygons:
            n = (nm3 @ p.normal).normalized()
            if n.dot(nv) < 0.99 or p.area < 1e-4: continue
            vs = [mw @ me.vertices[i].co for i in p.vertices]
            fl.append((sum(v[ax] for v in vs) / len(vs), [v[uo[0]] for v in vs], [v[uo[1]] for v in vs]))
        if not fl:     # (fix round M6: a rotated block's face is not axis-aligned, so it silently got nothing)
            print(f'CZ DETAIL WARN relief: {o.name} has no face looking along {tuple(round(x, 2) for x in nv)} '
                  f'(rotated or not a box): no relief skin; pass the normal its cut face really has'); continue
        plane = max(f[0] for f in fl) if sgn > 0 else min(f[0] for f in fl)
        for c, us, vs in fl:
            if abs(c - plane) < 0.01 and (max(us) - min(us)) > 0.05 and (max(vs) - min(vs)) > 0.05:
                rects.append((o, plane, min(us), max(us), min(vs), max(vs)))
    if not rects: return []
    area = sum((r[3] - r[2]) * (r[5] - r[4]) for r in rects)
    res = res or max(0.025, math.sqrt(area / max_verts))
    # objects near the face (arrows, labels, pipes): the lumps must not swallow them. Their box is the union over the
    # shot's frames while they are shown (fix round M6: an arrow that grows by a scale / hide_render key was measured at
    # build time, tiny, and the lumps swallowed its grown shaft), with its near side along the normal kept
    clear_boxes = []
    sc_ = bpy.context.scene; keep_f = sc_.frame_current
    cam = sc_.camera; fa, fb = sc_.frame_start, sc_.frame_end
    try: fr = cam.animation_data.action.frame_range; fa, fb = int(fr[0]), int(fr[1])
    except Exception: pass
    fs = sorted(set(list(range(fa, fb + 1, 6)) + [fb]))
    if len(fs) > 40: fs = [fs[int(i * (len(fs) - 1) / 39)] for i in range(40)]
    cl = [c for c in (clear or ()) if c is not None]
    acc = {c.name: None for c in cl}
    for f in (fs if cl else []):
        sc_.frame_set(f); dg2 = bpy.context.evaluated_depsgraph_get()
        for c in cl:
            if c.hide_render: continue
            ev = c.evaluated_get(dg2); cs = np.array([tuple(ev.matrix_world @ Vector(k)) for k in ev.bound_box])
            a = acc[c.name]; acc[c.name] = (cs.min(0), cs.max(0)) if a is None else (np.minimum(a[0], cs.min(0)), np.maximum(a[1], cs.max(0)))
    if cl: sc_.frame_set(keep_f)
    for c in cl:
        b = acc[c.name]
        if b is None: continue
        clear_boxes.append((b[0][uo[0]] - 0.05, b[1][uo[0]] + 0.05, b[0][uo[1]] - 0.05, b[1][uo[1]] + 0.05, b[0][ax], b[1][ax]))
    skins = []
    for ri, (o, plane, u0, u1, v0, v1) in enumerate(rects):
        nu = max(2, int((u1 - u0) / res) + 1); nvv = max(2, int((v1 - v0) / res) + 1)
        U, V = np.meshgrid(np.linspace(u0, u1, nu), np.linspace(v0, v1, nvv))
        h = M.fbm(U * freq + 17.3, V * freq * 0.55 + 5.1, seed, 5, ridged=True); h = np.clip((h - 0.15) / 0.6, 0, 1) ** 1.2   # clods, a little taller than wide
        h = h + 0.25 * M.fbm(U * freq * 6 + 3.7, V * freq * 6 + 9.2, seed + 5, 3)
        # taper toward borders no other rect continues (shared borders keep the lumps: the boxes read as one face)
        w = np.ones_like(U)
        for side, coord, lim in (('u0', U, u0), ('u1', U, u1), ('v0', V, v0), ('v1', V, v1)):
            shared = False
            for rj, (o2, p2, a0, a1, b0, b1) in enumerate(rects):
                if rj == ri or abs(p2 - plane) > 0.02: continue
                if side == 'u0' and abs(a1 - u0) < 0.02 and min(b1, v1) - max(b0, v0) > 0.05: shared = True
                if side == 'u1' and abs(a0 - u1) < 0.02 and min(b1, v1) - max(b0, v0) > 0.05: shared = True
                if side == 'v0' and abs(b1 - v0) < 0.02 and min(a1, u1) - max(a0, u0) > 0.05: shared = True
                if side == 'v1' and abs(b0 - v1) < 0.02 and min(a1, u1) - max(a0, u0) > 0.05: shared = True
            if not shared:
                d = np.abs(coord - lim); w *= np.clip(d / taper, 0, 1) ** 0.7
        for (c0, c1, d0, d1, a0, a1) in clear_boxes:    # flat under props that sit on / just in front of the face
            # (only a prop the lumps can reach: its near side within amount + 5 cm in front of this face)
            gap = (a0 - plane) if sgn > 0 else (plane - a1)
            if gap > amount + 0.05 or ((a1 - plane) if sgn > 0 else (plane - a0)) < -0.05: continue
            du = np.maximum(np.maximum(c0 - U, U - c1), 0); dv = np.maximum(np.maximum(d0 - V, V - d1), 0)
            w *= np.clip(np.hypot(du, dv) / 0.12, 0, 1)
        D_ = base + amount * h * w
        P = np.zeros((nvv, nu, 3)); P[..., ax] = plane + sgn * D_; P[..., uo[0]] = U; P[..., uo[1]] = V
        verts = P.reshape(-1, 3)
        i = np.arange(nu * nvv).reshape(nvv, nu)
        q = np.stack([i[:-1, :-1].ravel(), i[:-1, 1:].ravel(), i[1:, 1:].ravel(), i[1:, :-1].ravel()], 1)
        if (sgn > 0) == (ax == 1): q = q[:, ::-1]           # faces point along `normal`
        me = bpy.data.meshes.new(f'{name}_{o.name}_{ri}')
        me.vertices.add(len(verts)); me.vertices.foreach_set('co', verts.astype(np.float32).ravel())
        me.loops.add(q.size); me.loops.foreach_set('vertex_index', q.astype(np.int32).ravel())
        me.polygons.add(len(q)); me.polygons.foreach_set('loop_start', (np.arange(len(q)) * 4).astype(np.int32))
        me.polygons.foreach_set('loop_total', np.full(len(q), 4, np.int32))
        me.update(calc_edges=True); me.shade_smooth()
        if o.material_slots and o.material_slots[0].material: me.materials.append(o.material_slots[0].material)
        sk = bpy.data.objects.new(me.name, me); bpy.context.scene.collection.objects.link(sk); sk['cz_detail'] = 0
        # (B6) the skin lies on its own cut face and stands proud of the section by design: allowed with its block and
        # in front of the cut, but still checked against everything else (a prop the lumps swallow IS a finding)
        _nocontact(sk, section_ok=True, group='relief_' + o.name, partner=o)
        skins.append(sk)
    nverts = sum(len(s.data.vertices) for s in skins)
    print(f'CZ DETAIL relief {len(skins)} skins {nverts} verts step {res * 100:.1f} cm in {time.time() - t0:.2f}s')
    return skins


def corners(mode='both', fill_soft=3.0):
    """Corner / contact darkening (EEVEE 5.2's AO shader node does nothing without ray tracing, measured). mode:
    'gi' = screen-space ray tracing + horizon-scan GI (the world light now occludes in corners), 'fill' = the shot's
    shadowless fill / bounce area lights cast soft shadows, 'both'. Measured in references/detail.md."""
    sc = bpy.context.scene; ee = sc.eevee
    if mode in ('gi', 'both'):
        try:
            ee.use_raytracing = True; ee.ray_tracing_method = 'SCREEN'
            ee.ray_tracing_options.resolution_scale = '2'
            ee.use_fast_gi = True; ee.fast_gi_method = 'GLOBAL_ILLUMINATION'; ee.fast_gi_resolution = '2'
            ee.fast_gi_distance = 3.0; ee.fast_gi_step_count = 8; ee.fast_gi_ray_count = 2
            sc['cz_corners_gi'] = 1                 # (finish() keeps it, whichever comes first)
        except Exception as e: print('CZ DETAIL corners gi', e)
    n = 0
    if mode in ('fill', 'both'):
        for o in sc.objects:
            # (a light made with cz.light(..., shadow=False) keeps no shadow: the film decided; 2026-10-30, render tuner)
            if o.type == 'LIGHT' and o.data.type == 'AREA' and not o.data.use_shadow and not o.get('cz_no_shadow'):
                o.data.use_shadow = True; n += 1
                try: o.data.shadow_jitter = False
                except Exception: pass
    return n


def swap(objs, key, look='orig', seed=3, keep='height', tint=None, instance=True, lod=0.08):
    """Replace Claude-made props (trees, bushes, rocks...) by a real model from package A at the same base and height:
    the original is hidden (render + viewport), the model placed (instanced). Returns the new roots."""
    A = _assets()
    if A is None: return []
    rnd = random.Random(seed); out = []
    dg = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        if o is None: continue
        ev = o.evaluated_get(dg); cs = [ev.matrix_world @ Vector(c) for c in ev.bound_box]
        lo = Vector([min(c[i] for c in cs) for i in range(3)]); hi = Vector([max(c[i] for c in cs) for i in range(3)])
        kw = {'height': hi.z - lo.z} if keep == 'height' else {'width': max(hi.x - lo.x, hi.y - lo.y)}
        try:
            r = A.model(key, base=((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z), rot=rnd.uniform(0, 360), look=look, tint=tint,
                        instance=instance, name=o.name + '_real', lod=lod, **kw)
        except Exception as e:
            print('CZ DETAIL swap', key, repr(e)[:160]); continue
        o.hide_render = True; o.hide_viewport = True
        out.append(r)
    return out


# ---------------------------------------------------------------- measuring
def stats():
    """Counts that drive the frame cost: objects, instanced pieces, materials, materials with detail."""
    sc = bpy.context.scene
    mats = {ms.material for o in sc.objects for ms in getattr(o, 'material_slots', []) if ms.material}
    return dict(objects=len(sc.objects), materials=len(mats), detailed=sum(1 for m in mats if m.get('cz_detailed')),
                scatter=sum(int(o.get('cz_points', 0)) for o in sc.objects))
