# Package C test shot: both mannequins - idle, gesture, walk (stride-matched), sit on a box, an X-ray figure, look_at.
# blender -b -P templates/blender/engine/run.py -- templates/blender/tests/humans/t_humans.py --frames 1,40,75,110,150 --scale .5
import bpy, math, time
from mathutils import Vector
import cz, mega as M
import human as H

F0, F1 = 1, 180


def cam(loc, at, lens=35):
    c = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); bpy.context.scene.collection.objects.link(c)
    c.location = loc; c.data.lens = lens
    d = Vector(at) - Vector(loc); c.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.camera = c; return c


def build(ctx):
    sc = M.setup(F1, sun_elev=40, sun_rot=150, samples=8, mb=0)
    sc.render.resolution_x, sc.render.resolution_y = 1600, 900
    floor = bpy.data.objects.new('floor', bpy.data.meshes.new('floor')); sc.collection.objects.link(floor)
    import bmesh; bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=12); bm.to_mesh(floor.data); bm.free()
    floor.data.materials.append(M.pbr('t_floor', '#6d6a64', rough=0.8))
    box = bpy.data.objects.new('seatbox', bpy.data.meshes.new('seatbox')); sc.collection.objects.link(box)
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1); bm.to_mesh(box.data); bm.free()
    box.scale = (0.45, 0.45, 0.45); box.location = (2.2, 0.6, 0.225); box.data.materials.append(M.pbr('t_box', '#8a5a34', rough=0.7))
    t = time.time()
    a = H.figure('main', at=(-1.2, 0, 0), face=0)
    a.play('Idle_Loop', 0, 1.2).play('G_Point_Forward', 1.2, 3.0).walk([(-1.2, -1.5), (0.6, -2.2)], 3.0, None)
    b = H.figure('engineer', at=(0.4, 0.8, 0), face=-20)
    b.play('Idle_Talking_Loop', 0, 2.0).walk([(1.6, 0.0), (2.2, 0.0)], 2.0, None, end_clip=None)
    b.turn(b.walk_info['t1'], 180, 0.4)
    b.sit(box, b.walk_info['t1'] + 0.3, 6.0)
    x = H.figure('female', at=(-2.6, 1.2, 0), face=30, xray=True, color='#9aa3ad')
    x.play('G_Shrug', 0, 3).play('Idle_Loop', 3, 6.0)
    x.xray([(1.0, 0.0), (1.8, 1.0)])
    a.look_at(b.root, 0.3, 1.2)
    print(f'CZ HUMANTEST figures built in {time.time() - t:.2f}s', H.report(), 'walk', a.walk_info)
    H.plant()
    tf = time.time(); H.foot_slide(); print(f'CZ HUMANTEST footslide check {time.time() - tf:.2f}s')
    cam((0.5, -7.5, 2.2), (0, 0, 0.9), 30)
    return F0, F1
