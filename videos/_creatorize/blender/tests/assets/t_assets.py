# Package A test shot: free assets in the mega look through run.py (the real build path).
#   blender -b -P engine/run.py -- tests/assets/t_assets.py --frames 1 --scale 0.5 --out <dir>
# A forest-ground PBR yard, a hero Poly Haven tree + 12 far trees (lod 0.25, instanced), 400 instanced grass tufts,
# a rock set, a low-poly car calmed with look='tone', a Kenney house in 'clay', a wrench on a crate, a Smithsonian chair.
F0, F1 = 1, 30


def build(ctx):
    import bpy, os, sys, time, math
    import cz, mega as M, assets as A
    M.setup(F1 + 2, sun_elev=30, sun_rot=140, exposure=-0.3)
    t = time.time()
    g = cz.box('ground', (60, 60, 0.2), (0, 0, 0), A.pbr_from('ph:forrest_ground_01'), bevel=0, ol=0, origin='top')
    A.model('ph:tree_small_02', height=6.5, base=(-3.5, 4, 0), rot=20)
    far = A.scatter('ph:tree_small_02', 12, ((-25, 14), (25, 28)), seed=3, height=(5, 8), lod=0.25)
    A.scatter('ph:grass_bermuda_01', 400, ((-9, -6), (9, 9)), seed=5, size=(0.6, 1.1),
              avoid=lambda x, y: abs(x - 1.5) < 2.6 and abs(y + 0.5) < 1.6)
    A.model('ph:rock_moss_set_01', width=4.0, base=(5.5, 6, 0), rot=-30)
    A.model('red car', width=4.4, base=(1.5, -0.5, 0), rot=200, look='tone')
    A.model('kenney:city-kit-suburban/building-type-a', height=7.5, base=(7, 13, 0), rot=190, look='clay', tint='#c9c2b4')
    cz.box('crate', (0.6, 0.6, 0.5), (-1.6, -2.2, 0), M.pbr('crate_m', '#6b5137', rough=0.7), bevel=0.02, ol=0, origin='bottom')
    A.model('ph:pipe_wrench', size=0.4, base=(-1.6, -2.2, 0.5), rot=(90, 0, 35))
    A.model('si:ff607e3c-3d88-4422-a246-3976aa4839dc', height=0.95, base=(-3.0, -1.6, 0), rot=150)
    print(f'CZ TEST assets placed in {time.time() - t:.2f}s; asset load total {A.STATS["secs"]:.2f}s over {A.STATS["calls"]} masters')
    ch = bpy.data.objects.get('CZA_si_ff607e3c-3d88-4422-a246-3976aa4839dc')
    for m in (ch.data.materials if ch else []):
        print('CZ TEST si material', m.name, [n.bl_idname for n in m.node_tree.nodes][:8],
              [(n.image.name, n.image.size[:]) for n in m.node_tree.nodes if n.bl_idname == 'ShaderNodeTexImage'])
    cam = M.Flight([(0, (-1.0, -11.5, 2.1), (0.8, 2.5, 1.4), 26), (1, (-0.6, -11.3, 2.1), (0.9, 2.5, 1.4), 26)])
    cam.bake(F0, F1)
    print('CZ TEST credits', len(A.credits()))
    return F0, F1
