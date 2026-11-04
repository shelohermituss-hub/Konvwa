# Package C (Round 3) foot-slide test: walks that start and stop (idle -> walk -> idle), a 90 deg corner, a 135 deg corner,
# a walk given its arrival time (slower), a carry walk, both bodies. run.py --check prints CZ FOOTSLIDE lines (nothing = clean).
# blender -b --factory-startup -P templates/blender/engine/run.py -- templates/blender/tests/humans/t_walk.py --check
import bpy, time, os
from mathutils import Vector
import cz, mega as M
import human as H

F0, F1 = 1, 240


def cam(loc, at, lens=35):
    c = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); bpy.context.scene.collection.objects.link(c)
    c.location = loc; c.data.lens = lens
    c.rotation_euler = (Vector(at) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler(); bpy.context.scene.camera = c; return c


def build(ctx):
    sc = M.setup(F1, sun_elev=45, sun_rot=150, samples=8, mb=0)
    sc.render.resolution_x, sc.render.resolution_y = 1600, 900
    import bmesh
    floor = bpy.data.objects.new('floor', bpy.data.meshes.new('floor')); sc.collection.objects.link(floor)
    bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=14); bm.to_mesh(floor.data); bm.free()
    floor.data.materials.append(M.pbr('t_floor', '#6d6a64', rough=0.8))
    t = time.time()
    a = H.figure('main', at=(-3, 2, 0), face=0)                     # straight: start + stop
    a.play('Idle_Loop', 0, 1.0).walk([(-3, -1.0)], 1.0)
    b = H.figure('engineer', at=(-1, 2, 0), face=0)                 # a 90 deg corner
    b.play('Idle_Talking_Loop', 0, 0.8).walk([(-1, 0.2), (1.2, 0.2)], 0.8)
    c = H.figure('worker', at=(2, 2, 0), face=0)                    # a 135 deg corner, given its arrival time
    c.play('Idle_Loop', 0, 0.5).walk([(2, 0.0), (3.2, 1.2)], 0.5, 5.6)
    d = H.figure('witness', at=(4.5, 2.5, 0), face=180)             # a start facing away: turns into the path while starting
    d.play('Idle_Loop', 0, 0.6).walk([(4.5, 0.0)], 0.6, clip_name='Walk_Carry_Loop')
    print(f'CZ WALKTEST built in {time.time() - t:.2f}s', {f.name: f.walk_info for f in (a, b, c, d)})
    if os.environ.get("CZ_PLANT", "1") == "1": H.plant()
    tf = time.time(); H.foot_slide(); print(f"CZ WALKTEST footslide {time.time() - tf:.2f}s")
    cam((0.5, -8.5, 3.0), (0.5, 0.8, 0.8), 30)
    return F0, F1
