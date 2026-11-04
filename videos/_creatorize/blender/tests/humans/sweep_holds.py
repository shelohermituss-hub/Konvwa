# The VERIFIED sweep: every kind|grip of recon's VERIFIED table on each body it lists (its first hand, its first clip), on
# recon's own kit prop geometry; the HOLD check per hold; a close-up tile of each hand, montaged into a contact sheet.
# blender -b -P templates/blender/engine/run.py -- templates/blender/tests/humans/sweep_holds.py --check
# env: CZ_SWEEP_OUT (folder for tiles + sheet.png + sweep.json), CZ_SWEEP_ONLY (comma list of kind|grip to run)
import bpy, json, os, time, math, subprocess, shutil
from mathutils import Vector, Matrix
import cz, mega as M
import human as H, hands as HD

F0, F1 = 1, 60
OUT = os.environ.get('CZ_SWEEP_OUT') or os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')


def build(ctx):
    sc = M.setup(F1, sun_elev=50, sun_rot=150, samples=8, mb=0)
    sc.render.resolution_x = sc.render.resolution_y = 360; sc.render.resolution_percentage = 100
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 50
    only = set(filter(None, os.environ.get('CZ_SWEEP_ONLY', '').split(',')))
    rows = []
    for kg, row in HD.VERIFIED.items():
        if only and kg not in only: continue
        for body, sides in row.items():
            side = 'R' if 'R' in sides else 'L'; short, *full = sides[side].split(' ')
            clips = [HD.CLIP_SHORT[c] for c in short if c in HD.CLIP_SHORT] + full
            rows.append((kg, body, side, clips[0]))
    os.makedirs(OUT, exist_ok=True); res = []; t_all = time.time()
    for i, (kg, body, side, clip) in enumerate(rows):
        kind, grip = kg.split('|'); x, y = (i % 9) * 3.0, (i // 9) * 3.0
        f = H.figure(body, at=(x, y, 0), face=0, name=f's{i}'); f.play(clip, 0, 2.0)
        if kind not in HD.kit_kinds(): res.append({'kg': kg, 'body': body, 'side': side, 'clip': clip, 'error': 'no grips exported for this kind (props.js gives it none headless)'}); continue
        p = HD.kit(kind, at=(x + 1.0, y, 0)); t = time.time()
        try:
            if HD.USES.get(HD.PROPS[kind]['grips'][grip].get('use', 'clip'), {}).get('anchor') == 'scene':
                sc.frame_set(31); g = HD.PROPS[kind]['grips'][grip]; R = HD.rig(f.body)[side.lower()]
                hw = f.arm.matrix_world @ f.arm.pose.bones[f'hand_{side.lower()}'].matrix
                nm, gg, s_, mir = HD.resolve_grip(p, kind, grip, side); G = HD.grip_frame(p, kind, gg, mir)
                p.matrix_world = hw @ R['palm_in_hand'] @ G.inverted(); bpy.context.view_layer.update()
                if kind == 'steering wheel':   # (recon handtest KIND_JOB chestAt [-.04, .4]: 40 cm in front of the posed chest, facing the driver)
                    c = (f.arm.matrix_world @ f.arm.pose.bones['spine_03'].matrix).translation; yaw = f.root.rotation_euler.z
                    fw = Vector((math.sin(yaw), -math.cos(yaw), 0))
                    p.matrix_world = Matrix.Translation(c + fw * .4 + Vector((0, 0, -.04 - .72))) @ Matrix.Rotation(yaw + math.pi, 4, 'Z')
                    bpy.context.view_layer.update()
            h = HD.hold(f, p, grip, side); res.append({'kg': kg, 'body': body, 'side': side, 'clip': clip, 'h': h, 'solve_s': round(time.time() - t, 2)})
        except Exception as e:
            res.append({'kg': kg, 'body': body, 'side': side, 'clip': clip, 'error': str(e)[:200]}); print('CZ SWEEP error', kg, body, e)
    print(f'CZ SWEEP built {len(rows)} holds in {time.time() - t_all:.1f}s')
    lines = HD.hold_issues(frames_per_hold=3, verbose=False)
    for r in res:
        h = r.get('h')
        if not h: r['pass'] = False; continue
        mine = [l for l in lines if f' {h.f.name}: ' in l and 'OK' not in l.split(':')[0]]
        r['pass'] = h.issues == 0; r['issues'] = sorted({l.split(': ', 2)[-1] for l in mine})[:4]
    # close-up tiles (frame 31): the camera in front of the hand, 45 cm off, looking at the palm
    tiles = []
    for i, r in enumerate(res):
        h = r.get('h')
        if not h: continue
        sc.frame_set(31); f = h.f
        hw = f.arm.matrix_world @ f.arm.pose.bones[f'hand_{h.side}'].matrix; pc = (hw @ HD.rig(f.body)[h.side]['palm_in_hand']).translation
        fwd = Vector((math.sin(f.root.rotation_euler.z), -math.cos(f.root.rotation_euler.z), 0))
        sidev = Vector((1 if h.side == 'l' else -1, 0, 0))
        cam.location = pc + fwd * .38 + sidev * .18 + Vector((0, 0, .12)); cam.rotation_euler = (pc - cam.location).to_track_quat('-Z', 'Y').to_euler()
        fp = os.path.join(OUT, f'tile_{len(tiles):03d}.png'); sc.render.filepath = fp
        bpy.ops.render.render(write_still=True); tiles.append(fp); r['tile'] = os.path.basename(fp)
    n_pass = sum(1 for r in res if r.get('pass'))
    # combos covered: every clip of a passing kind|grip|body|hand row counts as its family (recon's 555 = all clips of all rows)
    combos = 0
    for r in res:
        if not r.get('pass'): continue
        short, *full = HD.VERIFIED[r['kg']][r['body']][r['side']].split(' '); combos += len([c for c in short if c in HD.CLIP_SHORT]) + len(full)
    for r in res: r.pop('h', None)
    json.dump({'rows': res, 'pass': n_pass, 'total': len(res), 'combos_in_passing_rows': combos}, open(os.path.join(OUT, 'sweep.json'), 'w'), indent=1)
    print(f'CZ SWEEP {n_pass}/{len(res)} kind|grip|body rows clean; their hand x clip rows hold {combos} of recon\'s 555 combos; tiles {len(tiles)}')
    ff = shutil.which('ffmpeg')
    if ff and tiles:
        cols = 9; rows_n = math.ceil(len(tiles) / cols)
        subprocess.run([ff, '-y', '-loglevel', 'error', '-start_number', '0', '-i', os.path.join(OUT, 'tile_%03d.png'), '-vf',
                        f'scale=200:200,tile={cols}x{rows_n}:padding=4:color=white', '-frames:v', '1', os.path.join(OUT, 'sheet.png')])
        print('CZ SWEEP sheet', os.path.join(OUT, 'sheet.png'))
    return F0, F1
