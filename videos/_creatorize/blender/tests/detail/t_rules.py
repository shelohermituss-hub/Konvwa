# detail.py rules test (fix round 2026-10-30, after the Fable review): word matching of material names (B5), the
# contact tags on detail objects (B6), corners/finish order (M5), relief clear over the shot's frames + the rotated-face
# warning (M6), loud scan failures (M7). Prints one `CZ DETAILTEST ok|FAIL <what>` line per check and a summary.
#   blender -b --factory-startup -P engine/run.py -- tests/detail/t_rules.py --check
F0, F1 = 1, 40


def build(ctx):
    import bpy, numpy as np
    import cz, mega as M, detail as D
    M.setup(F1 + 2, samples=4)
    res = []

    def ok(cond, what): res.append(bool(cond)); print(f"CZ DETAILTEST {'ok' if cond else 'FAIL'} {what}")
    # B5: names that a substring rule got wrong -> (skipped?, scan key)
    cases = {'terrain': (False, None), 'textured_concrete': (False, 'concrete'), 'drain_pipe': (False, None),
             'box_wall': (False, None), 'sunk_slab': (False, 'slab'), 'narrow_beam': (False, None), 'gasket': (False, None),
             'clamp_steel': (False, None), 'softwood': (False, None), 'firebrick': (False, 'brick'), 'proof_panel': (False, None),
             'mortar': (False, None), 'lightgrey_wall': (False, None), 'light_grey_wall': (False, None),
             'soil2_dark': (False, 'soil'), 'concretewall': (False, 'concrete'), 'hillgrass': (False, 'hillgrass'),
             'steel_beam': (False, None), 'xray_wall': (True, None), 'cz_d_fog': (True, None), 'rain_drops': (True, None),
             'glass_pane': (True, None), 'arrow_red': (True, None), 'Label.001': (True, None), 'bark_dark': (False, 'bark')}
    for n, (sk, key) in cases.items():
        m = M.pbr(n, color='#9a9a9a')
        got_sk = D.skip_material(m); got_key = D._word_key(n, D.SCANS, compound=True)
        ok(got_sk == sk and got_key == key, f'name {n}: skip={got_sk} scan={got_key} (want {sk}, {key})')
    ok(D._kind(M.pbr('terrain_m', color='#777777'), None) == 'organic', 'terrain is organic (word)')
    # M7: a mapping id that is not a texture -> loud WARN, no crash
    tw = cz.box('trunk_t', (0.4, 0.4, 2), (8, 8, 1), M.pbr('treebark', color='#6b4a32'), bevel=0, ol=0)
    done = D.scan_all({'treebark': 'ph:pine_roots'})
    ok('treebark' not in done and 'ph:pine_roots' in D._SCANFAIL, f'model id as scan: no scan + reason ({D._SCANFAIL.get("ph:pine_roots", "")[:60]})')
    # M6: relief clear over the frames: an arrow that grows from 1 cm to 3 m in front of the face
    soil = cz.box('soil_cut', (6, 2, 2), (0, -3, 1), M.pbr('soil_cut', color='#6b4a32'), bevel=0, ol=0)
    rot = cz.box('soil_rot', (3, 2, 2), (6, -3, 1), M.pbr('soil_rot2', color='#6b4a32'), bevel=0, ol=0, rot=(0, 0, 30))
    far = cz.box('far_prop', (0.3, 0.3, 0.3), (0, -6, 1), M.pbr('far_m', color='#888888'), bevel=0, ol=0)   # 2 m in front: no clearing
    arrow = cz.box('arrow_x', (0.05, 0.05, 0.05), (-2, -4.12, 1), M.pbr('arrowmat', color='#ff0000'), bevel=0, ol=0)
    arrow.scale = (0.2, 1, 1); arrow.keyframe_insert('scale', frame=F0)
    arrow.scale = (60, 1, 1); arrow.keyframe_insert('scale', frame=F1)
    M.Flight([(0, (4.5, -12, 2.2), (0, -2, 0.8), 28), ((F1 - 1) / 30, (3.2, -11, 1.9), (0, -2, 0.8), 28)]).bake(F0, F1)
    bpy.context.scene.frame_set(F0)
    skins = D.relief([soil, rot], normal=(0, -1, 0), clear=[arrow, far], amount=0.2)
    ok(len(skins) == 1, f'relief: 1 skin (rotated + far prop warned), got {len(skins)}')
    if skins:
        sk = skins[0]; V = np.array([tuple(v.co) for v in sk.data.vertices])
        # under the grown arrow (x -3.5 .. -0.5 at full length, z ~1): the lumps must be flat (<= base + 1 mm)
        under = (V[:, 0] > -3.4) & (V[:, 0] < -0.6) & (np.abs(V[:, 2] - 1.0) < 0.05)
        lump = float((-4.0 - V[under, 1]).max()) if under.any() else -1
        ok(0 <= lump <= 0.006, f'relief clear: lumps under the grown arrow {lump * 100:.1f} cm (want <= 0.6 cm)')
        away = (V[:, 0] > 1.0) & (V[:, 0] < 2.8)
        ok(float((-4.0 - V[away, 1]).max()) > 0.05, 'relief: lumps elsewhere (> 5 cm)')
        ok(sk.get('cz_section_ok') and 'relief_soil_cut' in str(sk.get('cz_group')) and 'relief_soil_cut' in str(soil.get('cz_group')),
           'relief skin: section_ok + grouped with its block only')
    # B6: detail objects carry the contact tags
    fg = D.fog(density=0.002); mo = D.motes((0, -5, 1), size=(1, 1, 1), n=10)
    rt = D.roots(-4.0, 'y', span=(-2, 2), top=2.0, depth=1.0, n=4)
    sc_ = D.scatter('pebbles', area=((-1, -6), (1, -5)), density=20, seed=2)
    ok(all(o.get('cz_nocontact') for o in (fg, mo, rt, sc_)), 'fog / motes / roots / scatter: cz_nocontact')
    ok(bpy.data.materials['cz_d_motes_m'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value == 0, 'motes default glow 0')
    # M5: corners before finish keeps the horizon-scan GI
    D.corners('gi'); D.finish(level='film', ground=0.0)
    ee = bpy.context.scene.eevee
    ok(ee.fast_gi_method == 'GLOBAL_ILLUMINATION' and ee.use_raytracing, f'corners then finish: GI kept ({ee.fast_gi_method})')
    print(f'CZ DETAILTEST {"PASS" if all(res) else "FAIL"} {sum(res)}/{len(res)}')
    return F0, F1
