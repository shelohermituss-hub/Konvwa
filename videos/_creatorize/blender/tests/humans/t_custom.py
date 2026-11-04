# Package C (Round 3): custom:<model> figures - any rigged humanoid plays the clip library. A CC0 Quaternius base character
# from the library (its own skeleton names) and a Mixamo-named FBX (make_fbx.py: mixamorig:* bones), both walking, pointing,
# sitting, next to a mannequin playing the same clips. CZ_TEST_FBX = the FBX; CZ_CUSTOM2 = a second GLB / FBX (optional).
# blender -b --factory-startup -P templates/blender/engine/run.py -- templates/blender/tests/humans/t_custom.py --frames 20,60,110 --scale .5
import bpy, os, time
from mathutils import Vector
import cz, mega as M
import human as H

F0, F1 = 1, 150
HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.normpath(os.path.join(HERE, '..', '..', '..', 'lowpoly', 'library', 'characters'))


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
    t = time.time(); figs = []
    srcs = [os.path.join(LIB, 'base_m_grey.glb')] + [p for p in (os.environ.get('CZ_TEST_FBX'), os.environ.get('CZ_CUSTOM2')) if p and os.path.exists(p)]
    ref = H.figure('main', at=(-1.6, 0, 0), face=0)
    ref.play('Idle_Loop', 0, 1.0).play('G_Point_Forward', 1.0, 2.6).walk([(-1.6, -1.2)], 2.6)
    figs.append(ref)
    for i, src in enumerate(srcs):
        f = H.figure('custom:' + src, at=(-0.4 + 1.2 * i, 0, 0), face=0)
        f.play('Idle_Loop', 0, 1.0).play('G_Point_Forward', 1.0, 2.6).walk([(-0.4 + 1.2 * i, -1.2)], 2.6)
        figs.append(f)
    print(f'CZ CUSTOMTEST built {len(figs)} figures in {time.time() - t:.2f}s', [getattr(f, 'custom', {}).get('mapped') for f in figs])
    H.plant(); H.foot_slide()
    cam((0.2, -6.5, 1.6), (0.2, -0.4, 0.95), 35)
    return F0, F1
