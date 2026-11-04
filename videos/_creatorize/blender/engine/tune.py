# tune.py - the render tuner's Blender side (2026-10-30; gruss: "render settings should be always adjusted before the
# render starts ... claude would automatically pick the best render settings for the given machine to minimize render
# time without big perceivable quality loss ... damn near realtime"). tools/render_tune.py decides (code, not a prompt);
# this file
#   apply(settings)        puts a plan's settings on a built scene (run.py --plan render_plan.json). Every knob is a CAP:
#                          it only ever makes a shot cheaper than it was built (a shot that already chose 2 samples keeps 2)
#   probe(request)         run.py --tuneprobe req.json: build once, render the probe frames at the shot's own settings
#                          (the reference), optionally with one feature off at a time (what the frame's cost is made of),
#                          then each candidate setting on top of the accepted ones; a candidate is kept only when every
#                          probe frame passes the quality bar against the reference (tunemetric.BAR) and it is faster
#                          (or saves memory). Writes the result JSON the tool reads.
# The knobs (EEVEE, Blender 5.2): references/render.md has what each costs and saves on the two test films.
import bpy, json, math, os, sys, time, ctypes
import tunemetric as TM
import scenepass as SP          # the scene pass (GN instances, LOD by screen size, static joins): knobs scene_*

try:
    import numpy as np
except Exception:
    if os.environ.get('CZ_PYLIB') and os.environ['CZ_PYLIB'] not in sys.path: sys.path.append(os.environ['CZ_PYLIB'])
    import numpy as np

TEX_LIMITS = {0: 'CLAMP_OFF', 8192: 'CLAMP_8192', 4096: 'CLAMP_4096', 2048: 'CLAMP_2048', 1024: 'CLAMP_1024', 512: 'CLAMP_512'}


def _ee(): return bpy.context.scene.eevee


# knob -> (read, write, cheaper): cheaper(a, b) is the cheaper of two values (the cap rule)
def _set_tex(v):
    bpy.context.preferences.system.gl_texture_limit = TEX_LIMITS.get(int(v), 'CLAMP_OFF')


def _get_tex():
    s = bpy.context.preferences.system.gl_texture_limit
    return next((k for k, n in TEX_LIMITS.items() if n == s), 0)


def _shadow_lights(local=True):
    return [o for o in bpy.context.scene.objects if o.type == 'LIGHT' and o.data.use_shadow and (o.data.type != 'SUN') == local]


RANGE = [None]          # (f0, f1) of the shot: run.py sets it after the build
SP.RANGE = RANGE        # (the scene pass samples the same camera range)
_LR = {}                # light -> its own shadow texel before any tuning


def _get_light_res():
    return round(_LR.get('_v') or min((o.data.shadow_maximum_resolution for o in _shadow_lights()), default=0.001), 4)


def _set_light_res(v):
    """The fill / bounce / rim lights' shadow texel (m): coarser = fewer shadow pages to render (the sun keeps its own).
    A value at or below the lights' own restores them."""
    for o in _shadow_lights():
        own = _LR.setdefault(o.name, o.data.shadow_maximum_resolution)
        o.data.shadow_maximum_resolution = max(own, float(v))
    _LR['_v'] = float(v)


_FAR = {'d': 0, 'swap': {}}


def _cam_path(n=12):
    sc = bpy.context.scene; cam = sc.camera; keep = sc.frame_current; P = []
    if cam is None: return P
    f0, f1 = RANGE[0] or (sc.frame_start, sc.frame_end)
    for f in sorted({int(f0 + (f1 - f0) * i / max(1, n - 1)) for i in range(n)}):
        sc.frame_set(f); P.append(cam.matrix_world.translation.copy())
    sc.frame_set(keep)
    return P


def _set_far_casters(v):
    """Library models (collection instances) farther than v m from every camera position of the shot cast no shadow:
    their instance points at a twin collection whose objects share the meshes but have visible_shadow off. 0 = all cast."""
    sc = bpy.context.scene
    for root, col in _FAR['swap'].items():      # undo the last setting first
        try: root.instance_collection = col
        except ReferenceError: pass
    _FAR['swap'] = {}; _FAR['d'] = int(v)
    P = _cam_path() if v else []
    n = SP.far_casters(int(v), P)      # (the scene pass's GN instancers: far points pick a no-shadow twin)
    if n: print(f'CZ SCENE far casters {v} m: {n} instanced placements cast no shadow', flush=True)
    if not v or not P: return
    twins = {}
    for o in sc.objects:
        if o.instance_type != 'COLLECTION' or o.instance_collection is None or not o.get('cz_id') or o.hide_render: continue
        dims = o.get('cz_dims') or (1, 1, 1); r = 0.5 * math.sqrt(sum(float(d) ** 2 for d in dims))
        c = o.matrix_world.translation; d = min((c - p).length for p in P) - r
        if d <= v: continue
        col = o.instance_collection
        if col.name not in twins:
            t = bpy.data.collections.new(col.name + '_noshadow')
            for ob in col.all_objects:
                cp = ob.copy(); t.objects.link(cp)
                try: cp.visible_shadow = False
                except Exception: pass
            twins[col.name] = t
        _FAR['swap'][o] = col; o.instance_collection = twins[col.name]


_LS = {}                # light name -> its own use_shadow


def _light_shadows(kind):
    def get():
        ls = [o for o in bpy.context.scene.objects if o.type == 'LIGHT' and o.data.type == kind]
        return 1 if any(o.data.use_shadow for o in ls) else 0
    def put(v):
        for o in bpy.context.scene.objects:
            if o.type == 'LIGHT' and o.data.type == kind:
                own = _LS.setdefault(o.name, o.data.use_shadow)
                o.data.use_shadow = own and bool(int(v))
    return get, put


_PROXY = {'r': 0.0, 'made': {}}


def _set_shadow_proxy(v):
    """The library models' shadows from a decimated twin (Decimate ratio v of the instanced master meshes): the master
    keeps its look for the camera and stops casting; the twin (camera-invisible) casts. Cu Chi: 177 instanced plants were
    nearly the whole frame (hidden: 8-10 -> 0.44 s/frame on the mini). 0 = the masters cast their own shadows again."""
    sc = bpy.context.scene; v = float(v)
    # undo the last setting: the twins go (a live Decimate modifier, even hidden, was re-evaluated on every frame change
    # and made every later probe render 4x slower on the Basement: the twins are plain decimated meshes, made once)
    for name, px in list(_PROXY['made'].items()):
        ob = bpy.data.objects.get(name)
        if ob is not None: ob.visible_shadow = True
        try: me = px.data; bpy.data.objects.remove(px, do_unlink=True); bpy.data.meshes.remove(me)
        except Exception: pass
    _PROXY['made'] = {}; _PROXY['r'] = 0.0
    if v <= 0: return
    masters = {o.instance_collection for o in sc.objects if o.instance_type == 'COLLECTION' and o.instance_collection is not None and o.get('cz_id')}
    for col in masters:
        for ob in [o for o in col.all_objects if o.type == 'MESH' and not o.get('cz_shadow_proxy')]:
            tmp = ob.copy(); sc.collection.objects.link(tmp)            # (evaluated once in the scene, then baked)
            m = tmp.modifiers.new('cz_shadow_lod', 'DECIMATE'); m.ratio = v
            dg = bpy.context.evaluated_depsgraph_get(); dg.update()
            me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg)); bpy.data.objects.remove(tmp, do_unlink=True)
            px = bpy.data.objects.new(ob.name[:40] + '_shlod', me); px['cz_shadow_proxy'] = 1
            px.parent = ob.parent; px.matrix_parent_inverse = ob.matrix_parent_inverse.copy(); px.matrix_basis = ob.matrix_basis.copy()
            for c in ob.users_collection: c.objects.link(px)
            for a in ('visible_camera', 'visible_diffuse', 'visible_glossy', 'visible_transmission', 'visible_volume_scatter'):
                try: setattr(px, a, False)
                except Exception: pass
            ob.visible_shadow = False; _PROXY['made'][ob.name] = px
    _PROXY['r'] = v


_lo = lambda a, b: min(a, b)
_hi_str = lambda a, b: str(max(int(a), int(b)))
_tex_cheaper = lambda a, b: (min(a, b) if a and b else (a or b))


def _scene(get, put):
    """A scene-pass change happens with the shadow knobs that follow the instanced placements (far casters, shadow
    proxies) taken off first and put back after, on the new structure. No change: nothing is touched."""
    def p(v):
        if float(get()) == float(v): return
        far, px = _FAR['d'], _PROXY['r']
        if far: _set_far_casters(0)
        if px: _set_shadow_proxy(0)
        put(v)
        if px: _set_shadow_proxy(px)
        if far: _set_far_casters(far)
    return p


KNOBS = {
    # the scene pass (engine/scenepass.py; first, so every setting below is judged on the optimized scene):
    # 1 = library placements as GN point instances; k > 0 = LOD by screen size (k triangles per pixel; smaller = cheaper);
    # 1 = static joins
    'scene_gn': (SP.get_gn, _scene(SP.get_gn, SP.put_gn), lambda a, b: max(a, b)),
    'scene_lod': (SP.get_lod, _scene(SP.get_lod, SP.put_lod), _tex_cheaper),
    'scene_join': (SP.get_join, _scene(SP.get_join, SP.put_join), lambda a, b: max(a, b)),
    'samples': (lambda: _ee().taa_render_samples, lambda v: setattr(_ee(), 'taa_render_samples', int(v)), _lo),
    'shadow_scale': (lambda: round(_ee().shadow_resolution_scale, 3), lambda v: setattr(_ee(), 'shadow_resolution_scale', float(v)), _lo),
    'shadow_steps': (lambda: _ee().shadow_step_count, lambda v: setattr(_ee(), 'shadow_step_count', int(v)), _lo),
    'shadow_rays': (lambda: _ee().shadow_ray_count, lambda v: setattr(_ee(), 'shadow_ray_count', int(v)), _lo),
    'shadow_pool': (lambda: int(_ee().shadow_pool_size), lambda v: setattr(_ee(), 'shadow_pool_size', str(int(v))), _lo),
    'vol_tile': (lambda: int(_ee().volumetric_tile_size), lambda v: setattr(_ee(), 'volumetric_tile_size', str(int(v))), lambda a, b: max(a, b)),
    'vol_samples': (lambda: _ee().volumetric_samples, lambda v: setattr(_ee(), 'volumetric_samples', int(v)), _lo),
    'vol_shadow_samples': (lambda: _ee().volumetric_shadow_samples, lambda v: setattr(_ee(), 'volumetric_shadow_samples', int(v)), _lo),
    'gi_res': (lambda: int(_ee().fast_gi_resolution), lambda v: setattr(_ee(), 'fast_gi_resolution', str(int(v))), lambda a, b: max(a, b)),
    'rt_res': (lambda: int(_ee().ray_tracing_options.resolution_scale), lambda v: setattr(_ee().ray_tracing_options, 'resolution_scale', str(int(v))), lambda a, b: max(a, b)),
    'gi_steps': (lambda: _ee().fast_gi_step_count, lambda v: setattr(_ee(), 'fast_gi_step_count', int(v)), _lo),
    'tex_limit': (_get_tex, _set_tex, _tex_cheaper),
    'mb_steps': (lambda: _ee().motion_blur_steps, lambda v: setattr(_ee(), 'motion_blur_steps', int(v)), _lo),
    'bokeh_max': (lambda: round(_ee().bokeh_max_size, 1), lambda v: setattr(_ee(), 'bokeh_max_size', float(v)), _lo),
    'light_res': (_get_light_res, _set_light_res, lambda a, b: max(a, b)),
    # a local light's reach ends where it adds less than this: a higher threshold = smaller reach = fewer casters drawn
    # into its shadow maps (Cu Chi: the local lights' shadows were 49 % of a frame)
    'light_threshold': (lambda: round(_ee().light_threshold, 4), lambda v: setattr(_ee(), 'light_threshold', float(v)), lambda a, b: max(a, b)),
    'far_casters': (lambda: _FAR['d'], _set_far_casters, _tex_cheaper),
    # 1 / 0: the fill / bounce AREA lights' shadows (D.corners('both') turns them on; on Cu Chi the 'fill' light's shadow
    # map of every plant was ~half the frame on the mini) and the POINT lamps' (oil lamps, stoves)
    'area_shadows': _light_shadows('AREA') + (_lo,),
    'point_shadows': _light_shadows('POINT') + (_lo,),
    'shadow_proxy': (lambda: _PROXY['r'], _set_shadow_proxy, _tex_cheaper),
}


def state():
    out = {}
    for k, (get, _, _c) in KNOBS.items():
        try: out[k] = get()
        except Exception: pass
    return out


def _put(settings):
    for k, v in _ordered(settings):
        if k not in KNOBS: continue
        try: KNOBS[k][1](v)
        except Exception as e: print(f'CZ TUNE knob {k}={v} failed: {e}')


def _ordered(settings):
    """The scene pass first (geometry), then the render settings (some follow the geometry: far casters, proxies)."""
    s = settings or {}
    return [(k, s[k]) for k in KNOBS if k in s] + [(k, v) for k, v in s.items() if k not in KNOBS]


def apply(settings, cap=True, quiet=False):
    """A plan's settings on the built scene. cap=True: each value only where it is cheaper than the shot's own."""
    done = {}
    for k, v in _ordered(settings):
        if k not in KNOBS or v is None: continue
        get, put, cheaper = KNOBS[k]
        try:
            cur = get(); new = cheaper(cur, type(cur)(v)) if cap else v
            if new != cur: put(new); done[k] = [cur, new]
        except Exception as e: print(f'CZ TUNE knob {k}={v} failed: {e}')
    if not quiet: print('CZ TUNE applied ' + (json.dumps(done) if done else 'nothing (the shot is already as cheap)'), flush=True)
    return done


# ---------------------------------------------------------------- what a scene has (which knobs can matter)
def _has_volume(m):
    try:
        if not (m and m.use_nodes): return False
        return any(n.type == 'OUTPUT_MATERIAL' and n.inputs['Volume'].is_linked for n in m.node_tree.nodes)
    except Exception: return False


def scene_info():
    sc = bpy.context.scene; ee = sc.eevee
    vis = [o for o in sc.objects if not o.hide_render]
    vol = [o.name for o in vis if o.type == 'MESH' and any(_has_volume(s.material) for s in o.material_slots)]
    wvol = bool(sc.world and _has_volume_world(sc.world))
    tris = 0
    for o in vis:
        try: tris += int(o.get('cz_tris', 0)) if o.get('cz_id') else 0
        except Exception: pass
    big = sum(1 for im in bpy.data.images if im.size[0] * im.size[1] > 2048 * 2048)
    tex = sum(1 for im in bpy.data.images if im.size[0] * im.size[1] > 0)
    cam = sc.camera
    return dict(objects=len(vis), lights=sum(1 for o in vis if o.type == 'LIGHT'), volumes=vol[:6], n_volumes=len(vol), world_volume=wvol,
                vol_shadows=bool(ee.use_volumetric_shadows), raytracing=bool(ee.use_raytracing), fast_gi=bool(ee.use_fast_gi),
                motion_blur=bool(sc.render.use_motion_blur), dof=bool(cam and cam.data.dof.use_dof), samples=ee.taa_render_samples,
                images=tex, images_over_2k=big, library_tris=tris, materials=len(bpy.data.materials))


def _has_volume_world(w):
    try: return w.use_nodes and any(n.type == 'OUTPUT_WORLD' and n.inputs['Volume'].is_linked for n in w.node_tree.nodes)
    except Exception: return False


# ---------------------------------------------------------------- one feature off (diagnostic only: what a frame costs)
def _hide(pred):
    sc = bpy.context.scene; hid = []
    for o in sc.objects:
        if not o.hide_render and pred(o): o.hide_render = True; hid.append(o)
    return lambda: [setattr(o, 'hide_render', False) for o in hid]


def _asset_root(o):
    p = o
    while p is not None:
        if p.get('cz_id'): return True
        p = p.parent
    return False


def _flag(obj, attr, val):
    old = getattr(obj, attr); setattr(obj, attr, val)
    return lambda: setattr(obj, attr, old)


def _ablate(name):
    """Switch ONE feature off; returns the undo. Never used for the film: only to measure what each part costs."""
    sc = bpy.context.scene; ee = sc.eevee
    if name == 'no_volumes': return _hide(lambda o: o.type == 'MESH' and any(_has_volume(s.material) for s in o.material_slots))
    if name == 'no_volume_shadows': return _flag(ee, 'use_volumetric_shadows', False)
    if name == 'no_library_models': return _hide(_asset_root)
    if name == 'no_scatter': return _hide(lambda o: o.get('cz_points') is not None or o.name.startswith(('cz_d_scatter', 'cz_d_debris', 'cz_d_pebbles')))
    if name == 'no_shadows': return _flag(ee, 'use_shadows', False)
    if name in ('no_local_shadows', 'no_sun_shadows'):
        ls = _shadow_lights(local=name == 'no_local_shadows')
        for o in ls: o.data.use_shadow = False
        return lambda: [setattr(o.data, 'use_shadow', True) for o in ls]
    if name == 'no_raytracing':
        u1, u2 = _flag(ee, 'use_raytracing', False), _flag(ee, 'use_fast_gi', False)
        return lambda: (u1(), u2())
    if name == 'no_dof':
        cam = sc.camera
        return _flag(cam.data.dof, 'use_dof', False) if cam else (lambda: None)
    if name == 'no_motion_blur': return _flag(sc.render, 'use_motion_blur', False)
    if name == 'samples_1': return _flag(ee, 'taa_render_samples', 1)
    if name == 'no_people':        # rigged figures (human.py / char.py): their armatures and every mesh they deform
        rigs = {o for o in sc.objects if o.type == 'ARMATURE'}
        return _hide(lambda o: o in rigs or (o.parent in rigs) or any(m.type == 'ARMATURE' for m in getattr(o, 'modifiers', [])))
    raise KeyError(name)


# ---------------------------------------------------------------- measuring
def mem():
    """(current, peak) bytes of this Blender's own memory (working set on Windows; peak RSS elsewhere). GPU memory is
    measured from outside (render_tune.py: nvidia-smi / the Mac's GPU allocation)."""
    try:
        if sys.platform == 'win32':
            from ctypes import wintypes as W
            class PMC(ctypes.Structure):
                _fields_ = [('cb', W.DWORD), ('PageFaultCount', W.DWORD), ('PeakWorkingSetSize', ctypes.c_size_t),
                            ('WorkingSetSize', ctypes.c_size_t), ('a', ctypes.c_size_t), ('b', ctypes.c_size_t), ('c', ctypes.c_size_t),
                            ('d', ctypes.c_size_t), ('PagefileUsage', ctypes.c_size_t), ('PeakPagefileUsage', ctypes.c_size_t)]
            c = PMC(); c.cb = ctypes.sizeof(c)
            k32, ps = ctypes.windll.kernel32, ctypes.windll.psapi
            k32.GetCurrentProcess.restype = ctypes.c_void_p
            ps.GetProcessMemoryInfo.argtypes = [ctypes.c_void_p, ctypes.c_void_p, W.DWORD]
            ps.GetProcessMemoryInfo(k32.GetCurrentProcess(), ctypes.byref(c), c.cb)
            return int(c.WorkingSetSize), int(c.PeakWorkingSetSize)
        import resource
        pk = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        return None, int(pk if sys.platform == 'darwin' else pk * 1024)
    except Exception:
        return None, None


def _free_gpu_images():
    for im in bpy.data.images:
        try: im.gl_free()
        except Exception: pass


LAST_SET = [0.0]


def _render(f, path=None):
    sc = bpy.context.scene
    t, c = time.perf_counter(), time.process_time()
    sc.frame_set(f); LAST_SET[0] = time.perf_counter() - t          # (the scene's own per-frame work: rigs, drivers, handlers)
    bpy.ops.render.render(write_still=False)
    dt, dc = time.perf_counter() - t, time.process_time() - c
    if path: bpy.data.images['Render Result'].save_render(path)
    return dt, dc


def _pixels(path):
    im = bpy.data.images.load(path, check_existing=False)
    # the PNG's own sRGB values, as a viewer sees them (Blender would hand back LINEAR values, which hide differences in
    # the darks: a shadow change measured 0.908 linear vs 0.896 in sRGB on Cu Chi e29); tools/tune_sheet.py reads the same
    try: im.colorspace_settings.name = 'Non-Color'
    except Exception: pass
    try:
        w, h = im.size; a = np.empty(w * h * im.channels, np.float32); im.pixels.foreach_get(a)
        return a.reshape(h, w, im.channels)[::-1, :, :3]          # (Blender's rows run bottom-up; top-down like the PNG)
    finally:
        bpy.data.images.remove(im)


def _pass(frames, out, tag, save=True, warm=False):
    """Render every probe frame; returns {secs: [..], cpu: [..], first: s or None, paths}"""
    os.makedirs(os.path.join(out, tag), exist_ok=True)
    first = None
    if warm: first = _render(frames[0])[0]          # (shader compile / texture upload after a change: not the frame's cost)
    secs, cpu, paths, sets = [], [], [], []
    for f in frames:
        p = os.path.join(out, tag, f'{f:04d}.png') if save else None
        dt, dc = _render(f, p); secs.append(round(dt, 3)); cpu.append(round(dc, 3)); paths.append(p); sets.append(round(LAST_SET[0], 3))
    return dict(secs=secs, cpu=cpu, set=sets, first=round(first, 2) if first else None, paths=paths, t=round(float(np.median(secs)), 3))


def _try(name, changes, accepted, best_t, ref, refpx, frames, out, res, gain_min, force=False):
    """One candidate on top of the accepted set: render, judge against the reference, keep or undo.
    -> (kept, accepted, best_t). force: keep on quality alone (a set already proven faster on another shot)."""
    trial = dict(accepted); trial.update(changes)
    before = state(); applied = apply(trial, cap=True, quiet=True)
    if not applied:
        res['steps'].append(dict(kind='candidate', name=name, changes=changes, skipped='no effect on this shot (already as cheap, or no such feature)'))
        return False, accepted, best_t
    tex = 'tex_limit' in applied
    if tex: _free_gpu_images()
    try: r = _pass(frames, out, name, warm=tex)
    except Exception as e:
        res['steps'].append(dict(kind='candidate', name=name, changes=changes, error=str(e))); _put(before)
        return False, accepted, best_t
    q = [TM.compare(a, _pixels(p)) for a, p in zip(refpx, r['paths'])]
    w = TM.worst(q); ok_q = TM.passes(w); faster = r['t'] <= best_t * (1 - gain_min)
    # (texture limit / shadow pool: kept for the memory they free when they cost no time; the tool measures the memory)
    mem_knob = set(changes) <= {'tex_limit', 'shadow_pool'} and r['t'] <= best_t * 1.02
    # (GN instancing: the structure LOD and the shadow knobs build on; kept when invisible and not slower. It draws the
    # same instances: measured 0.98-1.02x on Cu Chi + Basement, so the tolerance is the probe's own noise, 4 %)
    struct = set(changes) <= {'scene_gn'} and r['t'] <= best_t * 1.04
    keep = ok_q and (faster or force or mem_knob or struct)
    why = 'kept' if keep else (('quality: ' + ', '.join(f'{k} {w[k]} < {TM.BAR[k]}' for k in ('ssim', 'block', 'psnr') if w[k] < TM.BAR[k]))
                               if not ok_q else f'not faster ({r["t"]:.3f} vs {best_t:.3f} s)')
    res['steps'].append(dict(kind='candidate', name=name, changes=changes, applied=applied, t=r['t'], secs=r['secs'], first=r['first'],
                             vs_ref=round(r['t'] / ref['t'], 3), quality=w, per_frame=q, kept=keep, why=why))
    if any(k.startswith('scene_') for k in applied):        # what the scene pass did (counts, tiers, triangles)
        res['steps'][-1]['scene'] = json.loads(json.dumps(SP.REPORT, default=str))
    print(f'CZ TUNE {name} {json.dumps(changes)}: {r["t"]:.3f} s/frame ({r["t"] / ref["t"]:.2f}x ref) ssim {w["ssim"]} block {w["block"]} psnr {w["psnr"]} -> {why}', flush=True)
    if keep: return True, trial, min(best_t, r['t'])
    _put(before)
    if tex: _free_gpu_images()
    return False, accepted, best_t


def _plan_merge(path, shot, rec):
    """render_plan.json scene.shots[shot] = rec (locked + atomic: 2 render Blenders may finish together)."""
    if not path or not shot: return
    lock = path + '.lock'; t0 = time.time(); fd = None
    while time.time() - t0 < 15:
        try: fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY); break
        except FileExistsError:
            try:
                if time.time() - os.path.getmtime(lock) > 60: os.remove(lock)
            except OSError: pass
            time.sleep(0.1)
    try:
        p = json.load(open(path, encoding='utf-8-sig'))
        p.setdefault('scene', {}).setdefault('shots', {})[shot] = rec
        tmp = path + f'.{os.getpid()}.tmp'; json.dump(p, open(tmp, 'w', encoding='utf-8'), indent=1); os.replace(tmp, path)
    except Exception as e: print(f'CZ TUNE plan not updated ({type(e).__name__}: {e})', flush=True)
    finally:
        if fd is not None:
            os.close(fd)
            try: os.remove(lock)
            except OSError: pass


def _shot_record(res, ref_t, t, acc, inv0, how):
    steps = [dict({k: st.get(k) for k in ('name', 'changes', 't', 'vs_ref', 'quality', 'kept', 'why', 'skipped', 'error', 'scene') if st.get(k) is not None})
             for st in res.get('steps', [])]
    for st in steps:
        if st.get('quality'): st['quality'] = {k: st['quality'][k] for k in ('ssim', 'block', 'psnr') if k in st['quality']}
    return dict(how=how, s_per_frame_before=ref_t, s_per_frame_after=t, kept=acc, inventory_before=inv0, inventory_after=SP.inventory(),
                steps=steps, made=time.strftime('%Y-%m-%dT%H:%M:%S'))


def shot_plan(plan, frames, shot=None, plan_path=None):
    """In the render's own Blender, after the build (run.py --plan): the film's candidates judged on THIS shot. Shots
    differ (Cu Chi on the PC: half-res shadows and plant shadow LODs were invisible on e29, 0.34x its time, but changed
    e07's contact shadows: block 0.71), so a film-wide set is either too timid or wrong somewhere. 2 of the frames this
    Blender renders, at the shot's own settings (reference) and with the whole candidate set; if that fails the gate,
    knob by knob. No second build: ~4 extra renders per shot. CZ_TUNE_PER_SHOT=0 / few frames: the film's safe set."""
    cands = plan.get('shot_candidates') or []
    fr = sorted(set(int(f) for f in frames))
    inv0 = SP.inventory()
    if not cands or len(fr) < 8 or os.environ.get('CZ_TUNE_PER_SHOT', '1') == '0':
        done = apply(plan.get('settings') or {})
        _plan_merge(plan_path, shot, _shot_record(dict(steps=[]), None, None, done, inv0, 'the film\'s safe set, not re-checked (few frames or per-shot off)'))
        return done
    import tempfile, shutil
    sc = bpy.context.scene
    sc.render.use_persistent_data = True; sc.render.image_settings.compression = 0
    pick = [fr[int(len(fr) * 0.3)], fr[int(len(fr) * 0.75)]]
    work = tempfile.mkdtemp(prefix='cz_tune_'); t0 = time.time()
    res = dict(steps=[])
    try:
        ref = _pass(pick, work, 'ref', warm=True)
        refpx = [_pixels(p) for p in ref['paths']]
        whole = {}
        for _, c in cands: whole.update(c)
        ok, acc, t = _try('film_set', whole, {}, ref['t'], ref, refpx, pick, work, res, 0.03)
        if not ok:
            for name, c in cands: _, acc, t = _try(name, c, acc, t, ref, refpx, pick, work, res, 0.03)
        print(f'CZ TUNE shot kept {json.dumps(acc)}: {ref["t"]:.3f} -> {t:.3f} s/frame on frames {pick} '
              f'({len(res["steps"])} tries, {time.time() - t0:.0f} s)', flush=True)
        _plan_merge(plan_path, shot, dict(_shot_record(res, ref['t'], t, acc, inv0, f'checked on frames {pick}'), seconds=round(time.time() - t0, 1)))
        return acc
    except Exception as e:
        print(f'CZ TUNE shot check failed ({type(e).__name__}: {e}): the film\'s safe set', flush=True)
        return apply(plan.get('settings') or {})
    finally:
        shutil.rmtree(work, ignore_errors=True)


def probe(req_path):
    """run.py --tuneprobe <req.json>. req: {frames, out, result, ablate: [...], candidates: [[name, {knob: v}], ...],
    verify: {knob: v} or null, gain: 0.03}. Writes req['result']."""
    req = json.load(open(req_path, encoding='utf-8-sig'))
    sc = bpy.context.scene
    sc.render.use_persistent_data = True          # (the export renders with --anim: persistent data, like here)
    sc.render.image_settings.compression = 0
    frames, out = [int(f) for f in req['frames']], req['out']
    gain_min = float(req.get('gain', 0.03))
    t0 = time.time()
    res = dict(info=scene_info(), base=state(), frames=frames, steps=[])
    print('CZ TUNE scene ' + json.dumps(res['info']), flush=True)
    save = lambda: json.dump(res, open(req['result'], 'w', encoding='utf-8'), indent=1)
    ref = _pass(frames, out, 'ref', warm=True)
    # timed twice, the faster pass counts: the first one after the build ran slow on e07 (1.56 vs ~1.30 s later: the GPU
    # still clocking up / caches filling), which flattered every candidate
    ref2 = _pass(frames, out, 'ref')
    if ref2['t'] < ref['t']: ref = ref2
    _, pk = mem()
    # the render alone (no frame change: the same frame again) = the GPU's part; the rest is the scene's per-frame work
    still = _render(frames[-1])[0]
    res['ref'] = dict(t=ref['t'], secs=ref['secs'], cpu=ref['cpu'], set=ref['set'], first=ref['first'], peak_rss=pk, same_frame=round(still, 3))
    print(f'CZ TUNE ref {ref["t"]:.3f} s/frame (first {ref["first"]} s, frame change {np.median(ref["set"]):.3f} s, same frame again {still:.3f} s, '
          f'cpu {sum(ref["cpu"]) / max(1e-6, sum(ref["secs"])):.2f})', flush=True)
    refpx = [_pixels(p) for p in ref['paths']]
    save()
    # what the frame is made of: one feature off at a time (diagnostic, never used for the film)
    for name in req.get('ablate') or []:
        try: undo = _ablate(name)
        except Exception as e: res['steps'].append(dict(kind='ablate', name=name, error=str(e))); continue
        try:
            r = _pass(frames, out, 'ab_' + name, save=False)
            res['steps'].append(dict(kind='ablate', name=name, t=r['t'], share=round(1 - r['t'] / ref['t'], 3)))
            print(f'CZ TUNE ablate {name}: {r["t"]:.3f} s/frame ({100 * (1 - r["t"] / ref["t"]):.0f} % of the frame)', flush=True)
        finally:
            undo()
        save()
    # candidates on top of the accepted ones, each judged against the reference frames
    accepted, best_t = {}, ref['t']
    cands = list(req.get('candidates') or [])
    # a set another probe shot accepted: tried whole first; if it fails here, its knobs one by one (cands then)
    if req.get('verify'):
        ok_v, accepted, best_t = _try('verify', req['verify'], accepted, best_t, ref, refpx, frames, out, res, gain_min, force=True)
        if ok_v: cands = []
        else: cands = [[f'v_{k}', {k: v}] for k, v in req['verify'].items()] + cands
        save()
    for name, changes in cands:
        _, accepted, best_t = _try(name, changes, accepted, best_t, ref, refpx, frames, out, res, gain_min)
        save()
    _, pk = mem()
    res.update(accepted=accepted, t=best_t, speedup=round(ref['t'] / best_t, 2), peak_rss=pk, seconds=round(time.time() - t0, 1), final=state())
    save()
    print(f'CZ TUNE done {ref["t"]:.3f} -> {best_t:.3f} s/frame accepted {json.dumps(accepted)} in {time.time() - t0:.0f}s', flush=True)
    return res
