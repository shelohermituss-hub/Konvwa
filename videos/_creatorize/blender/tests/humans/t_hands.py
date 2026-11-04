# Package C test shot: hands. A hammer held + handed over (male -> female), a can held in front of the chest (use 'hold',
# chest IK), a cardboard box carried with both hands while walking (Walk_Carry_Loop), a Mixamo-named FBX retargeted
# (H.import_mixamo) and played on the male, then the HOLD check.
# blender -b -P templates/blender/engine/run.py -- templates/blender/tests/humans/t_hands.py --frames 30,85,95,130 --scale .5
import bpy, os, time
from mathutils import Vector
import cz, mega as M
import human as H, hands as HD

F0, F1 = 1, 150
FBX = os.environ.get('CZ_TEST_FBX', '')


def cam(loc, at, lens=35):
    c = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); bpy.context.scene.collection.objects.link(c)
    c.location = loc; c.data.lens = lens
    c.rotation_euler = (Vector(at) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler(); bpy.context.scene.camera = c; return c


def build(ctx):
    sc = M.setup(F1, sun_elev=45, sun_rot=150, samples=8, mb=0)
    sc.render.resolution_x, sc.render.resolution_y = 1600, 900
    import bmesh
    floor = bpy.data.objects.new('floor', bpy.data.meshes.new('floor')); sc.collection.objects.link(floor)
    bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=12); bm.to_mesh(floor.data); bm.free()
    floor.data.materials.append(M.pbr('t_floor', '#6d6a64', rough=0.8))
    t = time.time()
    # 1. hammer held by the male, handed to the female at 3.0 s
    a = H.figure('main', at=(-0.36, 0, 0), face=90); a.play('Idle_Loop', 0, 5)
    b = H.figure('engineer', at=(0.36, 0, 0), face=-90); b.play('Idle_Loop', 0, 5)
    hammer = HD.kit('hammer')
    HD.handover(a, b, hammer, 'handle', t=3.0, side_a='R', side_b='L')     # (the handover makes both holds)
    # 2. a can held upright in front of the chest (chest IK), talking
    c = H.figure('witness', at=(-2.4, 0.3, 0), face=10); c.play('Idle_Talking_Loop', 0, 5)
    can = HD.kit('can'); HD.hold(c, can, 'wrap', 'R')
    # 3. a cardboard box carried with both hands, walking
    d = H.figure('worker', at=(2.0, 1.0, 0), face=0); d.play('Idle_Loop', 0, 0.5)
    d.walk([(2.0, -1.2)], 0.5, None, clip_name='Walk_Carry_Loop', end_clip='Idle_Loop')
    box = HD.kit('cardboard box'); HD.hold(d, box, 'carry', 'R')
    # 4. the Mixamo-style FBX on a male body
    if FBX and os.path.exists(FBX):
        tm = time.time(); nm = H.import_mixamo(FBX, name='Pointing (mixamo test)')
        e = H.figure('detective', at=(-1.4, 1.8, 0), face=0); e.play('Idle_Loop', 0, 0.6).play(nm, 0.6, 5)
        print(f'CZ HANDTEST mixamo import {time.time() - tm:.2f}s')
    print(f'CZ HANDTEST built in {time.time() - t:.2f}s', H.report())
    H.plant()                                                         # (planted feet held: once, after every play / walk / hold)
    th = time.time(); HD.hold_issues(); print(f'CZ HANDTEST hold check {time.time() - th:.2f}s')
    view = os.environ.get('CZ_TEST_CAM', 'wide')
    if view == 'hammer': cam((0.15, -1.5, 1.3), (0, 0, 1.0), 55)
    elif view == 'can': cam((-2.15, -0.75, 1.35), (-2.4, 0.3, 1.15), 60)
    elif view == 'box': cam((3.4, -2.4, 1.5), (2.0, -0.2, 0.95), 40)
    else: cam((0.0, -6.5, 1.7), (0, 0, 1.05), 32)
    return F0, F1
