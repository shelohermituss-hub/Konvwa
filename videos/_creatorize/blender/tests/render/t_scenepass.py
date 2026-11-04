# The scene pass's own checks, inside Blender, on a small made-up scene (no render, a few seconds):
#   blender -b --factory-startup -P tests/render/t_scenepass.py
# -> one `SCENETEST ok|FAIL <what>` line per check + `SCENETEST <n> FAIL` (exit 1 on a failure).
# What it proves: library placements become GN instancers with the exact same matrices (evaluated instances compared),
# animated / referenced / held placements stay as built, LOD tiers follow the camera, far casters pick no-shadow twins,
# joins never merge object-space-textured parts with different matrices nor anything animated, and every knob undoes
# itself (the render tuner tries and drops them).
import os, sys, tempfile, math
import bpy
HERE = os.path.dirname(os.path.abspath(__file__)); KIT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(KIT, 'engine'))
os.environ['CZ_ASSETS3D'] = tempfile.mkdtemp(prefix='cz_sp_test_')          # (the LOD cache goes there, not the real library)
import scenepass as SP
import tune

fails = 0


def check(ok, what):
    global fails
    print(f'SCENETEST {"ok" if ok else "FAIL"} {what}', flush=True); fails += 0 if ok else 1


for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
sc = bpy.context.scene; sc.frame_start, sc.frame_end = 1, 48
sc.render.resolution_x, sc.render.resolution_y = 1080, 1920


def mat(name, objspace=False):
    m = bpy.data.materials.new(name); m.use_nodes = True
    if objspace:
        nt = m.node_tree; tc = nt.nodes.new('ShaderNodeTexCoord'); nz = nt.nodes.new('ShaderNodeTexNoise')
        nt.links.new(tc.outputs['Object'], nz.inputs['Vector']); nt.links.new(nz.outputs['Fac'], nt.nodes['Principled BSDF'].inputs['Base Color'])
    return m


# a library master (20 k tris) in its own collection, like assets._master
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=5, radius=1.0)
ms = bpy.context.object; ms.name = 'CZA_test'; ms.data.materials.append(mat('leaf'))
for c in list(ms.users_collection): c.objects.unlink(ms)
col = bpy.data.collections.new('CZA:test@2k'); col.objects.link(ms); ms['cz_tris'] = 20480; ms['cz_dims'] = [2, 2, 2]


def placed(name, loc, rot=0.0, s=1.0, scale=None):
    e = bpy.data.objects.new(name, None); sc.collection.objects.link(e)
    e.location = loc; e.rotation_euler = (0.2, 0.0, math.radians(rot)); e.scale = scale or (s, s, s)
    e.instance_type = 'COLLECTION'; e.instance_collection = col; e['cz_id'] = 'test:leaf'; e['cz_tris'] = 20480
    return e


near = placed('near', (0, 4, 0), 30, 1.2)
mids = [placed(f'mid{i}', (i * 3 - 6, 30, 0), i * 40, 1.0) for i in range(5)]
far = placed('far', (0, 400, 0), 10, 1.0)
squash = placed('squash', (5, 12, 0), 45, scale=(1.0, 2.0, 0.5))
anim = placed('anim', (-5, 10, 0)); anim.keyframe_insert('location', frame=1); anim.location.z = 2; anim.keyframe_insert('location', frame=40)
held = placed('held', (3, 8, 0)); tgt = bpy.data.objects.new('looker', None); sc.collection.objects.link(tgt)
tc_ = tgt.constraints.new('TRACK_TO'); tc_.target = held
# a linked duplicate (instance=False): root empty + child mesh sharing the master's data, object-level material
root = bpy.data.objects.new('dup_root', None); sc.collection.objects.link(root); root.location = (2, 20, 0); root['cz_id'] = 'test:leaf'
ch = bpy.data.objects.new('dup_root_mesh', ms.data); sc.collection.objects.link(ch); ch.parent = root
ch.material_slots[0].link = 'OBJECT'; ch.material_slots[0].material = mat('leaf_tone')
# the camera: a short push in
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.rotation_euler = (math.radians(90), 0, 0)
cam.location = (0, -6, 1); cam.keyframe_insert('location', frame=1); cam.location = (0, -4, 1); cam.keyframe_insert('location', frame=48)
tune.RANGE[0] = (1, 48)

# ---------------------------------------------------------------- GN instancing
inv0 = SP.inventory()
n = SP.gn_on()
inst = {i.src.name: i for i in SP.INST}
check(n == 2 and 'CZA:test@2k' in inst and len(inst['CZA:test@2k'].placed) == 8, f'gn: 8 placements of one asset + 1 linked duplicate -> 2 instancers ({SP.REPORT["gn"]})')
check(not SP.REPORT['gn']['skipped'], f'gn: every instancer passed the matrix check ({SP.REPORT["gn"]["skipped"]})')
check(not anim.hide_render and not held.hide_render, 'gn: the animated placement and the one a constraint targets stay as built')
check(near.hide_render and squash.hide_render and root.hide_render and ch.hide_render, 'gn: converted placements (incl. a linked duplicate child) are hidden, not deleted')
inv1 = SP.inventory()
check(inv1['drawn_meshes'] == inv0['drawn_meshes'], f'gn: the same number of meshes drawn ({inv0["drawn_meshes"]} -> {inv1["drawn_meshes"]})')

# ---------------------------------------------------------------- LOD by screen size
SP.lod_on(1.0)
L = inst['CZA:test@2k']; order = [p.name for p in L.placed]
tier = dict(zip(order, L.tier.tolist()))
check(tier['near'] == 0 and tier['far'] > 0, f'lod: near stays full, far gets a decimated tier ({tier})')
dg = bpy.context.evaluated_depsgraph_get(); dg.update()
cnt = sum(1 for d in dg.object_instances if d.is_instance and d.parent and d.parent.original == L.ob)
check(cnt == len(order), f'lod: still one instance per placement ({cnt})')
check(len(L.cols) > 1 and all(len(o.data.polygons) < len(ms.data.polygons) for c in L.cols[1:] for o in c.all_objects),
      f'lod: tier meshes are lighter ({[sum(len(o.data.polygons) for o in c.all_objects) for c in L.cols]})')
lod_files = os.listdir(os.path.join(os.environ['CZ_ASSETS3D'], 'lod'))
check(len(lod_files) >= 1, f'lod: decimated meshes cached for the next shot ({len(lod_files)} files)')
SP.lod_off()
check(len(L.cols) == 1 and not L.tier.any(), 'lod off: every placement back at full detail')

# ---------------------------------------------------------------- far casters on the instancers
nfar = SP.far_casters(30, [cam.matrix_world.translation.copy()])
twin = bpy.data.collections.get('CZA:test@2k_noshadow')
check(nfar >= 2 and twin is not None and all(not o.visible_shadow for o in twin.all_objects), f'far casters: {nfar} far placements pick a no-shadow twin')
check(SP.far_casters(0, []) == 0 and not L.far.any() and not L.twins, 'far casters 0: every placement casts again')

# ---------------------------------------------------------------- the tuner's knobs undo themselves
tune.apply({'scene_lod': 1.0}, quiet=True)
check(tune.state()['scene_gn'] == 1 and tune.state()['scene_lod'] == 1.0, f'knobs: scene_lod turns GN instancing on ({tune.state()["scene_gn"]}, {tune.state()["scene_lod"]})')
tune._put({'scene_gn': 0, 'scene_lod': 0.0})
check(not SP.INST and not near.hide_render and not root.hide_render and not ch.hide_render, 'knobs: scene_gn 0 removes the instancers and shows every placement again')
check(not [o for o in bpy.data.objects if o.get('cz_sp')], 'knobs: no instancer object left behind')

# ---------------------------------------------------------------- joins
def cube(name, loc, m, offset=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=0.5, location=(0, 0, 0)); o = bpy.context.object; o.name = name
    o.data.transform(__import__('mathutils').Matrix.Translation(offset)); o.location = loc; o.data.materials.append(m)
    return o


free = mat('flat'); objm = mat('objspace', objspace=True)
fr = [cube(f'free{i}', (i * 0.8, 50, 0), free) for i in range(3)]
ob_diff = [cube(f'objdiff{i}', (i * 0.8, 52, 0), objm) for i in range(2)]
ob_same = [cube(f'objsame{i}', (0, 54, 0), objm, offset=(i * 0.8, 0, 0)) for i in range(2)]
moving = cube('moving', (1.6, 50, 0), free); moving.keyframe_insert('location', frame=1)
SP.join_on()
check(all(o.hide_render for o in fr) and not moving.hide_render, f'join: plain-material parts in one cell joined, the animated one untouched ({SP.REPORT["join"]})')
check(not any(o.hide_render for o in ob_diff), 'join: object-space-textured parts with different matrices are NOT joined')
check(all(o.hide_render for o in ob_same), 'join: object-space-textured parts sharing one matrix are joined')
j = [o for o in bpy.data.objects if o.get('cz_sp_join')]
check(len(j) == 2 and sorted(int(o['cz_sp_join']) for o in j) == [2, 3], f'join: 2 joined objects (3 + 2 parts) ({[(o.name, o.get("cz_sp_join")) for o in j]})')
SP.join_off()
check(not [o for o in bpy.data.objects if o.get('cz_sp_join')] and not any(o.hide_render for o in fr + ob_same), 'join off: the parts are back as built')

print(f'SCENETEST {fails} FAIL', flush=True)
sys.exit(1 if fails else 0)
