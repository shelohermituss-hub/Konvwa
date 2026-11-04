# Test fixture for H.import_mixamo when no Mixamo FBX is on the PC: a CC0 UAL clip on the female body, its bones renamed
# to Mixamo's (mixamorig:Hips, LeftForeArm, LeftHandIndex1 ...), exported as FBX into the scratch folder.
# blender -b --factory-startup -P templates/blender/tests/humans/make_fbx.py -- <out.fbx> [clip]
import bpy, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'engine'))
import human as H
out = sys.argv[sys.argv.index('--') + 1]; clip = sys.argv[sys.argv.index('--') + 2] if len(sys.argv) > sys.argv.index('--') + 2 else 'G_Point_Forward'
bpy.context.scene.render.fps = H.FPS
f = H.figure('female', name='src')
act = H.clip(clip, 'female'); f.ad.action = act
try: f.ad.action_slot = act.slots[0]
except Exception: pass
for tr in list(f.ad.nla_tracks): f.ad.nla_tracks.remove(tr)
M = {'pelvis': 'Hips', 'spine_01': 'Spine', 'spine_02': 'Spine1', 'spine_03': 'Spine2', 'neck_01': 'Neck', 'Head': 'Head'}
for s, S in (('l', 'Left'), ('r', 'Right')):
    M.update({f'clavicle_{s}': f'{S}Shoulder', f'upperarm_{s}': f'{S}Arm', f'lowerarm_{s}': f'{S}ForeArm', f'hand_{s}': f'{S}Hand',
              f'thigh_{s}': f'{S}UpLeg', f'calf_{s}': f'{S}Leg', f'foot_{s}': f'{S}Foot', f'ball_{s}': f'{S}ToeBase'})
    for fn, F in (('thumb', 'Thumb'), ('index', 'Index'), ('middle', 'Middle'), ('ring', 'Ring'), ('pinky', 'Pinky')):
        for k in (1, 2, 3): M[f'{fn}_0{k}_{s}'] = f'{S}Hand{F}{k}'
arm = f.arm; arm.data = arm.data.copy()
for b in arm.data.bones:
    if b.name in M: b.name = 'mixamorig:' + M[b.name]
a2 = act.copy()
for s_, fc in H._fcurves(a2):
    for k, v in M.items(): fc.data_path = fc.data_path.replace(f'"{k}"', f'"mixamorig:{v}"')
f.ad.action = a2
try: f.ad.action_slot = a2.slots[0]
except Exception: pass
bpy.context.scene.frame_start, bpy.context.scene.frame_end = 1, int(a2.frame_range[1])
for o in bpy.data.objects: o.select_set(o in (arm, f.mesh))
bpy.ops.export_scene.fbx(filepath=out, use_selection=True, add_leaf_bones=False, bake_anim=True, bake_anim_use_all_actions=False, bake_anim_use_nla_strips=False)
print('CZ FBX written', out, os.path.getsize(out))
