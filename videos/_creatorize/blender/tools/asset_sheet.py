# asset_sheet.py - a contact sheet of free assets in the mega look, so a build checks an asset BEFORE using it
# (upright? real size? textures there? leaves cut out? too heavy?). One row per asset, `views` turntable angles each,
# a label in every tile (id, size, triangles, licence, load time) and a scale reference (a 1.75 m figure, or a
# 10 cm cube for small props). Textures show as a 3 x 3 m patch + a ball, HDRIs as the sky + a chrome and a grey ball.
#   blender -b -P tools/asset_sheet.py -- ph:tree_small_02 "red car" acg:Ground054 ph:kloofendal_48d_partly_cloudy_puresky
#        [--out sheet.png] [--views 3] [--tile 480] [--look orig|tone|clay] [--res 2k] [--samples 16]
# A word query picks the best index match (printed). Read the PNG it writes; the legend is printed as CZ SHEET lines.
import bpy, sys, os, math, time, json
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'engine'))
import cz, mega as M, assets as A
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
opt = {}; ids = []
i = 0
while i < len(argv):
    if argv[i].startswith('--'): opt[argv[i][2:]] = argv[i + 1]; i += 2
    else: ids.append(argv[i]); i += 1
out = os.path.abspath(opt.get('out', 'asset_sheet.png'))
views, tile, look, res = int(opt.get('views', 3)), int(opt.get('tile', 480)), opt.get('look', 'orig'), opt.get('res', '2k')
cz.reset()
sc = M.setup(10, sun_elev=34, sun_rot=150, samples=int(opt.get('samples', 16)), mb=0, res=(tile, tile), sun_disc=False)
sc.render.resolution_percentage = 100
sky_world = sc.world
cam_d = bpy.data.cameras.new('sheetcam'); cam_d.lens = 40; cam_d.sensor_fit = 'VERTICAL'; cam_d.sensor_height = 24; cam_d.clip_end = 20000
cam = bpy.data.objects.new('sheetcam', cam_d); sc.collection.objects.link(cam); sc.camera = cam
grey = M.pbr('sheet_ground', '#6d6a64', rough=0.85, noise=0.15)
fig_m = M.pbr('sheet_fig', '#d8d2c6', rough=0.6)
lab_m = M.emit('sheet_label', '#ffffff', 3.0)
tiles_dir = os.path.join(os.path.dirname(out), os.path.splitext(os.path.basename(out))[0] + '_tiles'); os.makedirs(tiles_dir, exist_ok=True)


def label(text, dist):
    """White text at the bottom of the frame (parented to the camera, just past the near clip: nothing hides it)."""
    for o in [o for o in bpy.data.objects if o.name.startswith('sheet_lab')]: bpy.data.objects.remove(o, do_unlink=True)
    dist = cam_d.clip_start * 3
    h = 2 * dist * math.tan(math.atan(12 / cam_d.lens))         # visible height at that distance
    t = cz.text('sheet_lab', text, size=h * 0.03, loc=(0, 0, 0), mat=lab_m, rot=(0, 0, 0), extrude=0)
    t.parent = cam; t.location = (0, -h * (0.43 if '\n' in text else 0.45), -dist)
    try: t.visible_shadow = False
    except Exception: pass
    return t


def frame(center, radius, az, el=16):
    fov = 2 * math.atan(12 / cam_d.lens)
    dist = radius / math.sin(fov / 2) * 1.05
    a, e = math.radians(az), math.radians(el)
    eye = center + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * dist
    cam.location = eye; cam.rotation_euler = (center - eye).to_track_quat('-Z', 'Y').to_euler()
    cam_d.clip_start = max(0.005, dist * 0.01)
    return dist


rows, legend = [], []
X0 = 0.0
for n, key in enumerate(ids):
    kind = 'model'
    try:
        hits = [h for h in A.X.search(key, None, 1)] if not A.X.get(key) else [A.X.get(key)]
        kind = (A.X.get(key) or (hits[0] if hits else {})).get('kind', 'model')
        if kind == 'pack': kind = 'model'
    except Exception: pass
    t0 = time.time(); objs = []
    try:
        if kind == 'model':
            root = A.model(key, base=(X0, 0, 0), look=look, res=res)
            dims = Vector(root['cz_dims']); first = time.time() - t0
            # warm load from the cache for the timing column (memory cache cleared, .blend appended again)
            A._MASTER.clear(); t1 = time.time(); r2 = A.model(key, base=(X0, 0, -10000), look=look, res=res); cached = time.time() - t1
            for o in [r2] + list(r2.children): o.hide_render = True
            center = Vector((X0, 0, dims.z / 2)); radius = max(0.15, dims.length / 2)
            g = cz.box(f'g{n}', (max(dims.x, dims.y) * 3 + 4, max(dims.x, dims.y) * 3 + 4, 0.02), (X0, 0, -0.01), grey, bevel=0, ol=0, origin='top')
            small = max(dims) < 0.8
            if small: ref = cz.box(f'ref{n}', (0.1, 0.1, 0.1), (X0 + dims.x / 2 + 0.12, 0, 0), fig_m, bevel=0.003, ol=0, origin='bottom'); reftxt = '10 cm cube'
            else: ref = cz.capsule(f'ref{n}', 0.22, 1.75, (X0 + dims.x / 2 + 0.7, 0, 0), fig_m, ol=0); reftxt = '1.75 m figure'
            radius = max(radius, (Vector((dims.x / 2 + (0.2 if small else 0.9), 0, 0))).length * 0.9)
            r = A._MASTER and next(iter(A._MASTER.values()))
            e = A.X.get(root['cz_id']) or {}
            txt = (f"{root['cz_id'][:40]}  {e.get('license', '')[:22]}\n{dims.x:.2f} x {dims.y:.2f} x {dims.z:.2f} m  "
                   f"{root['cz_tris'] / 1000:.0f}k tris  load {first:.1f}s / {cached:.2f}s  ref {reftxt}")
            legend.append({'id': root['cz_id'], 'kind': 'model', 'dims': list(dims), 'tris': root['cz_tris'], 'license': e.get('license'),
                           'author': e.get('author'), 'first_s': round(first, 2), 'cached_s': round(cached, 2)})
            shots = [(center, radius, 35 + v * 360 / views, 16 if v % 2 == 0 else 30) for v in range(views)]
            world = sky_world
        elif kind == 'texture':
            m = A.pbr_from(key, res=res); dt = time.time() - t0
            p = cz.box(f'tp{n}', (3, 3, 0.02), (X0, 0, -0.01), m, bevel=0, ol=0, origin='top')
            s = cz.sphere(f'ts{n}', 0.5, (X0 + 0.6, 0.4, 0.5), m, ol=0)
            ts = A.texture_set(key, res)
            e = A.X.get(key) or {}
            txt = f"{key[:40]}  {e.get('license', '')}\nmaps {','.join(k for k in ts if k != 'size_m')}  tile {ts.get('size_m', 2.0)} m  {dt:.1f}s"
            legend.append({'id': key, 'kind': 'texture', 'maps': sorted(k for k in ts if k != 'size_m'), 'secs': round(dt, 2)})
            shots = [(Vector((X0, 0, 0.3)), 1.9, 35 + v * 360 / views, 35 if v == 0 else 60 if v == 1 else 12) for v in range(views)]
            world = sky_world
        else:
            p = A.hdri(key, res); dt = time.time() - t0
            wsave = sc.world; A.world(key, 1.0, res=res); world = sc.world; world.name = f'hdri{n}'
            sky_copy = None
            sc.world = wsave if wsave != world else sky_world
            chrome = M.pbr(f'chrome{n}', '#ffffff', rough=0.02, metal=1.0); gm = M.pbr(f'grey{n}', '#9a9a9a', rough=0.5)
            cz.sphere(f'hc{n}', 0.5, (X0 - 0.6, 0, 0.5), chrome, ol=0); cz.sphere(f'hg{n}', 0.5, (X0 + 0.6, 0, 0.5), gm, ol=0)
            txt = f"{key[:40]}\nHDRI {os.path.basename(p)[:40]}  {os.path.getsize(p) / 1e6:.1f} MB  {dt:.1f}s"
            legend.append({'id': key, 'kind': 'hdri', 'file': p, 'secs': round(dt, 2)})
            shots = [(Vector((X0, 0, 0.5)), 1.6, 0 + v * 360 / views, 8) for v in range(views)]
        row = []
        for v, (c, rad, az, el) in enumerate(shots):
            dist = frame(c, rad, az, el); label(txt if v == 0 else f'view {v + 1}', dist)
            sc.world = world
            sun = bpy.data.objects.get('sun')
            if sun: sun.hide_render = kind == 'hdri'
            fp = os.path.join(tiles_dir, f'{n:02d}_{v}.png'); sc.render.filepath = fp
            bpy.ops.render.render(write_still=True); row.append(fp)
        sc.world = sky_world
        rows.append(row)
        print('CZ SHEET', json.dumps(legend[-1]))
    except Exception as ex:
        import traceback; traceback.print_exc()
        print('CZ SHEET FAILED', key, repr(ex)[:300]); rows.append([]); legend.append({'id': key, 'error': repr(ex)[:300]})
    X0 += 5000.0       # every asset in its own place (one scene, no re-imports)

# compose the sheet (numpy on Blender's images: no Pillow needed)
import numpy as np
R, C = len(rows), max(1, views)
sheet = np.zeros((R * tile, C * tile, 4), np.float32); sheet[..., 3] = 1
for r, row in enumerate(rows):
    for c, fp in enumerate(row):
        im = bpy.data.images.load(fp); px = np.array(im.pixels[:], np.float32).reshape(im.size[1], im.size[0], 4)
        y0 = (R - 1 - r) * tile
        sheet[y0:y0 + px.shape[0], c * tile:c * tile + px.shape[1]] = px
        bpy.data.images.remove(im)
img = bpy.data.images.new('sheet', C * tile, R * tile, alpha=False)
img.pixels.foreach_set(sheet.ravel()); img.filepath_raw = out; img.file_format = 'PNG'; img.save()
json.dump(legend, open(os.path.splitext(out)[0] + '.json', 'w', encoding='utf-8'), indent=1)
print(f'CZ SHEET wrote {out} ({R} assets x {C} views)')
