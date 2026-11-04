# fetch_asset.py - download one free asset from the index into the shared cache, verified, with its credit.
#   python tools/fetch_asset.py <id> [--res 1k|2k|4k|8k] [--max-mb 300] [--allow-sa] [--force]
#   python tools/fetch_asset.py --query "pine tree" [--kind model|texture|hdri] [--style real] [--res 2k]
# ids come from asset_index.py search (ph:tree_small_02, acg:Ground054, pp:<id>, si:<uuid>, nasa:<folder>, kh:<name>,
# kenney:<pack>[/<model>], sf:<uid>). Licence gate (like recon's fetch_model.py): only CC0 / public domain / CC-BY; NC,
# ND, editorial and unclear terms are refused (ShareAlike only with --allow-sa). Every file is checked (md5 where the
# source gives one, magic bytes, glTF references, zip integrity). Resolution = the textures' size: 1k is fast, 2k the
# default (a 1080x1920 frame rarely shows more), 4k / 8k for hero close-ups. Writes <asset dir>/meta.json and the
# cache-wide CREDITS.json; engine/assets.py records what a film used in <project>/assets/CREDITS.json.
# Sketchfab downloads need the user's own API token in env SKETCHFAB_TOKEN (sketchfab.com -> Settings -> Password &
# API); it is read from the environment only, never printed or written.
import hashlib, json, os, re, shutil, sys, time, zipfile, urllib.parse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import asset_index as X

RES = ['1k', '2k', '4k', '8k']
MODEL_EXT = ['.glb', '.gltf', '.fbx', '.obj', '.blend', '.usdz', '.usdc', '.usd', '.usda', '.stl', '.ply']


class FetchError(Exception): pass


def slug(s): return re.sub(r'[^A-Za-z0-9_.-]+', '_', s).strip('_')[:80] or 'asset'


def pick_res(avail, want):
    """The wanted resolution, else the nearest smaller one, else the smallest bigger one."""
    av = [r.lower() for r in avail]
    if want.lower() in av: return avail[av.index(want.lower())]
    order = {r: i for i, r in enumerate(RES)}
    w = order.get(want.lower(), 1)
    known = sorted([a for a in avail if a.lower() in order], key=lambda a: order[a.lower()])
    lower = [a for a in known if order[a.lower()] <= w]
    return (lower[-1] if lower else known[0]) if known else avail[0]


# ---------------------------------------------------------------- download + verify
def _md5(p):
    h = hashlib.md5()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''): h.update(b)
    return h.hexdigest()


def dl(url, dest, md5=None, headers=None, timeout=60):
    """timeout: per socket read (a stalled server), not the whole file."""
    dest = Path(dest); dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0 and (not md5 or _md5(dest) == md5): return dest.stat().st_size
    import urllib.request
    h = dict(X.UA); h.update(headers or {})
    tmp = dest.with_name(dest.name + f'.{os.getpid()}.part')      # never two writers on one .part
    for k in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=timeout) as r, open(tmp, 'wb') as f:
                shutil.copyfileobj(r, f, 1 << 20)
            if md5 and _md5(tmp) != md5: raise FetchError(f'md5 mismatch {dest.name}')
            os.replace(tmp, dest); return dest.stat().st_size
        except FetchError:
            _rm(tmp); raise
        except Exception as e:
            if getattr(e, 'code', 0) in (401, 403, 404) or k == 2: _rm(tmp); raise FetchError(f'download failed {url[:120]}: {e}')
            time.sleep(1 + k)


def _rm(p):
    try: Path(p).unlink()
    except OSError: pass


MAGIC = {'.glb': [b'glTF'], '.jpg': [b'\xff\xd8\xff'], '.jpeg': [b'\xff\xd8\xff'], '.png': [b'\x89PNG'], '.hdr': [b'#?'],
         '.exr': [b'\x76\x2f\x31\x01'], '.blend': [b'BLENDER', b'\x28\xb5\x2f\xfd', b'\x1f\x8b'], '.zip': [b'PK'],
         '.fbx': [b'Kaydara FBX Binary', b'; FBX'], '.webp': [b'RIFF'], '.usdz': [b'PK'], '.usdc': [b'PXR-USDC']}


def verify(p):
    """Magic bytes + structure. Raises FetchError (a web page saved as .glb, a broken zip, a gltf missing its textures)."""
    p = Path(p); ext = p.suffix.lower()
    if not p.exists() or p.stat().st_size == 0: raise FetchError(f'missing or empty: {p.name}')
    head = open(p, 'rb').read(32)
    if ext in MAGIC and not any(head.startswith(m) for m in MAGIC[ext]):
        if ext == '.fbx' and head[:1].isascii(): return
        raise FetchError(f'{p.name} is not a real {ext} (first bytes {head[:12]!r})')
    if ext == '.gltf':
        g = json.loads(p.read_text(encoding='utf-8'))
        for it in (g.get('buffers', []) + g.get('images', [])):
            u = it.get('uri')
            if u and not u.startswith('data:') and not (p.parent / urllib.parse.unquote(u)).exists():
                raise FetchError(f'{p.name} references a missing file: {u}')
    if ext == '.zip':
        with zipfile.ZipFile(p) as z:
            bad = z.testzip()
            if bad: raise FetchError(f'broken zip member {bad}')


def unzip(zp, out):
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zp) as z:
        for m in z.infolist():
            tgt = (out / m.filename).resolve()
            if not str(tgt).startswith(str(out.resolve())): raise FetchError('unsafe path in zip: ' + m.filename)
        z.extractall(out)
    return out


def best_model(d, prefer=None):
    files = [p for p in Path(d).rglob('*') if p.is_file() and p.suffix.lower() in MODEL_EXT and '__MACOSX' not in p.parts]
    if prefer: files = [p for p in files if prefer.lower() in p.stem.lower()] or files
    if not files: return None
    rank = lambda p: (MODEL_EXT.index(p.suffix.lower()), any(w in p.stem.lower() for w in ('collision', 'collider', 'lod1', 'lod2', 'lod3', 'proxy')), -p.stat().st_size)
    return sorted(files, key=rank)[0]


def gltf_deps(gltf_url, dest_dir, name):
    """A .gltf at a URL + every buffer / image it names (relative URIs)."""
    gp = Path(dest_dir) / name; dl(gltf_url, gp)
    g = json.loads(gp.read_text(encoding='utf-8'))
    base = gltf_url.rsplit('/', 1)[0] + '/'
    for it in g.get('buffers', []) + g.get('images', []):
        u = it.get('uri')
        if u and not u.startswith('data:'): dl(base + urllib.parse.quote(urllib.parse.unquote(u)), gp.parent / urllib.parse.unquote(u))
    return gp


# ---------------------------------------------------------------- per source
def _ph(e, res, d):
    f = X.http('https://api.polyhaven.com/files/' + e['id'][3:])
    if e['kind'] == 'model':
        fmt = next((k for k in ('gltf', 'fbx', 'blend') if k in f), None)
        if not fmt: raise FetchError('no gltf / fbx / blend download')
        r = pick_res(list(f[fmt]), res); g = f[fmt][r][fmt]
        tot = g.get('size', 0) + sum(i.get('size', 0) for i in (g.get('include') or {}).values())
        yield ('size', tot)
        rd = d / r
        jobs = [(g['url'], rd / g['url'].rsplit('/', 1)[-1], g.get('md5'))] + [(i['url'], rd / rel, i.get('md5')) for rel, i in (g.get('include') or {}).items()]
        with ThreadPoolExecutor(8) as ex: list(ex.map(lambda j: dl(*j), jobs))
        yield ('main', rd / g['url'].rsplit('/', 1)[-1]); yield ('res', r)
    elif e['kind'] == 'texture':
        want = {'color': ['diffuse', 'diff', 'col'], 'normal': ['nor_gl'], 'rough': ['rough'], 'ao': ['ao'], 'disp': ['displacement', 'disp'],
                'arm': ['arm'], 'metal': ['metal', 'metallic'], 'opacity': ['alpha', 'opacity'], 'spec': ['spec', 'specular']}
        low = {k.lower(): k for k in f}
        maps, jobs, r = {}, [], None
        for role, keys in want.items():
            k = next((low[x] for x in keys if x in low), None)
            if not k or not isinstance(f[k], dict): continue
            r = pick_res(list(f[k]), res); v = f[k][r]
            fm = v.get('jpg') or v.get('png') or next(iter(v.values()))
            p = d / r / fm['url'].rsplit('/', 1)[-1]; jobs.append((fm['url'], p, fm.get('md5'))); maps[role] = p
        if 'color' not in maps: raise FetchError('no colour map')
        yield ('size', sum(0 for _ in jobs))
        with ThreadPoolExecutor(8) as ex: list(ex.map(lambda j: dl(*j), jobs))
        yield ('maps', maps); yield ('res', r)
    else:
        r = pick_res(list(f['hdri']), res); v = f['hdri'][r]; v = v.get('hdr') or v.get('exr')
        yield ('size', v.get('size', 0))
        p = d / v['url'].rsplit('/', 1)[-1]; dl(v['url'], p, v.get('md5')); yield ('main', p); yield ('res', r)


ACG_ROLE = [('color', ['_color', '_basecolor', '_albedo', '_diffuse']), ('normal', ['_normalgl', '_normal']), ('rough', ['_roughness']),
            ('ao', ['_ambientocclusion', '_ao']), ('disp', ['_displacement', '_height']), ('metal', ['_metalness', '_metallic']),
            ('opacity', ['_opacity', '_alpha'])]


def _acg(e, res, d):
    var = e.get('variants') or []
    R = res.upper()
    if e['kind'] == 'texture': cands = [f'{R}-JPG', f'{R}-PNG'] + [v for v in var if v.endswith('-JPG')]
    elif e['kind'] == 'hdri': cands = [R, f'{R}-HDR', f'{R}-EXR'] + var
    else: cands = [f'SQ-{R}-JPG', f'LQ-{R}-JPG', f'HQ-{R}-JPG'] + [v for v in var if 'JPG' in v]
    attr = next((c for c in cands if c in var), None)
    if not attr:   # nearest resolution
        rs = [v for v in var if re.search(r'\d+K', v)]
        if not rs: raise FetchError('no downloads listed')
        attr = min(rs, key=lambda v: abs(int(re.search(r'(\d+)K', v).group(1)) - int(re.sub(r'\D', '', R) or 2)))
    yield ('size', int((e.get('sizes') or {}).get(attr, 0) * 1e6))
    r = (re.search(r'(\d+K)', attr).group(1).lower() if re.search(r'(\d+K)', attr) else res)
    rd = d / r; zp = rd / f'{e["id"][4:]}_{attr}.zip'
    dl(f'https://ambientcg.com/get?file={e["id"][4:]}_{attr}.zip', zp); verify(zp); unzip(zp, rd); zp.unlink()
    files = [p for p in rd.rglob('*') if p.is_file()]
    if e['kind'] == 'texture':
        maps = {}
        for role, keys in ACG_ROLE:
            hit = [p for p in files if p.suffix.lower() in ('.jpg', '.png', '.jpeg') and any(k in p.stem.lower() for k in keys)]
            if role == 'normal': hit = [p for p in hit if 'normaldx' not in p.stem.lower()] or hit
            if hit: maps[role] = hit[0]
        if 'color' not in maps: raise FetchError('no colour map in the zip')
        yield ('maps', maps)
    elif e['kind'] == 'hdri':
        h = [p for p in files if p.suffix.lower() in ('.hdr', '.exr')]
        if not h: raise FetchError('no .hdr / .exr in the zip')
        yield ('main', h[0])
    else:
        m = best_model(rd)
        if not m: raise FetchError('no model file in the zip')
        yield ('main', m)
    yield ('res', r)


def _kh(e, res, d):
    base = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/' + e['id'][3:] + '/'
    meta = X.http(base + 'metadata.json')
    lics = [l.get('spdx') or l.get('license') for l in meta.get('legal', [])]
    if not lics or not all(X.licence_ok(l) for l in lics): raise FetchError('licence not allowed: ' + ', '.join(map(str, lics)))
    idx = X.http('https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/model-index.json')
    m = next(x for x in idx if x['name'] == e['id'][3:]); v = m.get('variants', {})
    if 'glTF-Binary' in v:
        p = d / v['glTF-Binary']; dl(base + 'glTF-Binary/' + urllib.parse.quote(v['glTF-Binary']), p)
    else:
        k = 'glTF' if 'glTF' in v else next(iter(v)); p = gltf_deps(base + k + '/' + urllib.parse.quote(v[k]), d, v[k])
    yield ('main', p); yield ('res', 'orig')


def _nasa(e, res, d):
    files = e.get('files')
    if not files:
        t = X.http('https://api.github.com/repos/nasa/NASA-3D-Resources/git/trees/master?recursive=1')
        files = [x['path'] for x in t['tree'] if x['type'] == 'blob' and x['path'].startswith('3D Models/' + e['id'][5:] + '/')]
    raw = lambda p: 'https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/' + urllib.parse.quote(p)
    by = {}
    for p in files: by.setdefault(Path(p).suffix.lower(), []).append(p)
    for ext in ('.glb', '.gltf', '.fbx', '.obj', '.blend', '.usdz', '.stl'):
        if ext in by:
            main = sorted(by[ext], key=len)[0]; break
    else: raise FetchError('no importable model file (only ' + ', '.join(sorted(by)) + ')')
    deps = [main]
    if ext in ('.obj', '.fbx', '.gltf'):     # textures / mtl / bin next to it
        folder = main.rsplit('/', 1)[0]
        deps += [p for p in files if p.rsplit('/', 1)[0] == folder and Path(p).suffix.lower() in ('.mtl', '.bin', '.png', '.jpg', '.jpeg', '.tif', '.tga')]
    for p in deps:
        out = d / Path(p).name
        try: dl(raw(p), out); verify(out)
        except FetchError:
            dl('https://media.githubusercontent.com/media/nasa/NASA-3D-Resources/master/' + urllib.parse.quote(p), out)
    yield ('main', d / Path(main).name); yield ('res', 'orig')


def _pp(e, res, d):
    h = X.http(e['page'], js=False).decode('utf-8', 'replace')
    m = re.findall(r'https://static\.poly\.pizza/[0-9a-f\-]+\.glb', h)
    if not m: raise FetchError('no .glb link on the Poly Pizza page')
    lic = re.findall(r'(CC0[^<"]{0,8}|CC[- ]BY[^<"]{0,8}|Public Domain)', h)
    if lic and not any(X.licence_ok(l) for l in lic): raise FetchError('licence on the page is not allowed: ' + lic[0])
    p = d / (slug(e['name']) + '.glb'); dl(m[0], p); yield ('main', p); yield ('res', 'orig')


def _si(e, res, d):
    f = e.get('files') or {}
    order = {'1k': ['Web3D/Low', 'Web3D/Medium', 'Web3D/Thumb'], '2k': ['Web3D/Medium', 'Web3D/High', 'App3D/AR', 'Web3D/Low'],
             '4k': ['Web3D/High', 'Download3D/Low_Resolution', 'Web3D/Medium'], '8k': ['Web3D/High', 'Download3D/Low_Resolution', 'Web3D/Medium']}
    k = next((k for k in order.get(res, order['2k']) if k in f), None) or next(iter(f))
    urls = f[k] if isinstance(f[k], list) else [f[k]]
    parts = []
    for i, u0 in enumerate(urls):       # a model in several parts (wings, engine ...): every part, imported together
        p = d / k.replace('/', '_') / (slug(u0.rsplit('/', 1)[-1]) or f'part{i}.glb')
        cands = [u0] + (['https://' + u0.rsplit('https://', 1)[1]] if u0.count('https://') > 1 else [])
        for j, u in enumerate(cands):
            try: dl(u, p); break
            except FetchError:
                if j == len(cands) - 1: raise FetchError('Smithsonian file not served (an old package with a broken link): pick another result')
        parts.append(p)
    yield ('main', parts[0]); yield ('parts', parts); yield ('res', k)


def _kenney(e, res, d):
    pack, _, model = e['id'][7:].partition('/')
    pd = X.cache_root() / 'models' / 'kenney' / slug(pack) / 'pack'
    if not any(pd.rglob('*.glb')) and not any(pd.rglob('*.fbx')) and not any(pd.rglob('*.obj')):
        # the site hands out a fresh signed link per session (cookie from the pack page + referer), like its own button
        import http.cookiejar, urllib.request
        op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        page = 'https://kenney.nl/assets/' + pack
        op.open(urllib.request.Request(page, headers=X.UA), timeout=60).read()
        j = json.loads(op.open(urllib.request.Request('https://kenney.nl/download-link/' + ('assets/' + pack).encode().hex(),
                                                      headers=dict(X.UA, Referer=page)), timeout=60).read())
        if not j.get('url'): raise FetchError('Kenney gave no download link')
        zp = pd.parent / f'{pack}.zip'; pd.parent.mkdir(parents=True, exist_ok=True)
        with op.open(urllib.request.Request(j['url'], headers=dict(X.UA, Referer=page)), timeout=300) as r, open(zp, 'wb') as fo:
            shutil.copyfileobj(r, fo, 1 << 20)
        verify(zp); unzip(zp, pd); zp.unlink()
    files = [p for p in pd.rglob('*') if p.suffix.lower() in ('.glb', '.gltf', '.fbx', '.obj')]
    best = {}
    for p in files:   # one entry per model name, best format (GLB) first
        k = p.stem.lower()
        if k not in best or MODEL_EXT.index(p.suffix.lower()) < MODEL_EXT.index(best[k].suffix.lower()): best[k] = p
    pe = X.get('kenney:' + pack) or e
    X.add_entries([X.E(f'kenney:{pack}/{k}', 'kenney', 'model', f'{k} ({pack})', X.words(k) + pe.get('tags', []), ['kenney', pack],
                       'CC0 1.0', 'Kenney (kenney.nl)', 'https://kenney.nl/assets/' + pack,
                       local={'main': _rel(p, X.cache_root()), 'res': 'orig'}) for k, p in best.items()])
    if model:
        p = best.get(model.lower()) or next((v for k, v in best.items() if model.lower() in k), None)
        if not p: raise FetchError(f'no model "{model}" in kenney pack {pack} ({len(best)} models: ' + ', '.join(sorted(best)[:30]) + ')')
        yield ('main', p)
    else:
        yield ('main', None); yield ('pack', sorted(best))
    yield ('res', 'orig')


def _sf(e, res, d):
    tok = os.environ.get('SKETCHFAB_TOKEN')
    if not tok:
        raise FetchError('Sketchfab downloads need your own API token: put it in the user environment variable '
                         'SKETCHFAB_TOKEN (sketchfab.com -> Settings -> Password & API). Until then pick another source.')
    j = X.http(f'https://api.sketchfab.com/v3/models/{e["id"][3:]}/download', headers={'Authorization': 'Token ' + tok})
    m = X.http(f'https://api.sketchfab.com/v3/models/{e["id"][3:]}')
    lab = (m.get('license') or {}).get('label', '')
    lic = {'CC Attribution': 'CC-BY 4.0', 'CC0 Public Domain': 'CC0 1.0'}.get(lab, lab)
    if not X.licence_ok(lic): raise FetchError('licence not allowed: ' + lab)
    yield ('license', lic)
    if j.get('glb'):
        p = d / 'model.glb'; dl(j['glb']['url'], p); yield ('main', p)
    else:
        zp = d / 'model.zip'; dl(j['gltf']['url'], zp); verify(zp); unzip(zp, d / 'gltf'); zp.unlink(); yield ('main', best_model(d / 'gltf'))
    yield ('res', 'orig')


HANDLERS = {'polyhaven': _ph, 'ambientcg': _acg, 'khronos': _kh, 'nasa': _nasa, 'polypizza': _pp, 'smithsonian': _si,
            'kenney': _kenney, 'sketchfab': _sf}


def asset_dir(e):
    kind = {'model': 'models', 'pack': 'models', 'texture': 'textures', 'hdri': 'hdris'}[e['kind']]
    key = e['id'].split(':', 1)[1].replace('/', '__')
    return X.cache_root() / kind / e['src'] / slug(key)


# ---------------------------------------------------------------- the one call
def _entry(id):
    e = X.get(id)
    if e is None and id.startswith('kenney:') and '/' in id and X.get(id.split('/', 1)[0]):   # a model inside a pack not yet downloaded
        e = dict(X.get(id.split('/', 1)[0]), id=id, kind='model', name=id.split('/', 1)[1])
    return e


def _rel(p, d):
    """A path inside the asset folder as written into meta.json: relative, forward slashes (a cache copied between
    Windows and the Mac must resolve on both)."""
    return os.path.relpath(p, d).replace(os.sep, '/')


def _read_meta(mp):
    """meta.json, with Windows relpaths ('2k\\\\x.jpg', written before 2026-10-30) repaired to '2k/x.jpg' in the file."""
    if not mp.exists(): return None
    try: meta = X._read_json(mp, None)
    except Exception: return None
    if not isinstance(meta, dict): return None
    fixed = False
    def fx(v):
        nonlocal fixed
        if isinstance(v, str) and '\\' in v: fixed = True; return v.replace('\\', '/')
        return v
    for rec in (meta.get('variants') or {}).values():
        if not isinstance(rec, dict): continue
        rec['main'] = fx(rec.get('main'))
        if rec.get('maps'): rec['maps'] = {k: fx(v) for k, v in rec['maps'].items()}
        if rec.get('parts'): rec['parts'] = [fx(v) for v in rec['parts']]
    if fixed:
        try: _write_meta(mp, meta)
        except OSError: pass
    return meta


def _write_meta(mp, meta):
    tmp = mp.with_name(mp.name + f'.{os.getpid()}.tmp')
    tmp.write_text(json.dumps(meta, indent=1, ensure_ascii=False), encoding='utf-8')
    for k in range(40):
        try: os.replace(tmp, mp); return
        except PermissionError: time.sleep(0.05 * (k + 1))
    raise OSError('cannot write ' + str(mp))


def _cached(id, e, d, res, any_res=False):
    """The cached files of this asset at res (any_res: else any resolution on disk), or None. Marks it local when the
    mark is missing (caches fetched before the marks existed)."""
    meta = _read_meta(d / 'meta.json')
    if not meta: return None
    vs = meta.get('variants') or {}
    order = [res] + ([r for r in RES if r != res and r in vs] + [r for r in vs if r not in RES and r != res] if any_res else [])
    for r in order:
        if r not in vs: continue
        out = _resolve(d, vs[r])
        if not out: continue
        ix = X.get(id)
        if ix is not None and not ix.get('local'):
            try: X.set_local(id, {'res': list(vs), 'dir': d.as_posix()})
            except Exception: pass
        return dict(out, id=id, kind=e['kind'], dir=str(d), title=e['name'], author=e.get('author'),
                    license=meta.get('license', e.get('license')), page=e.get('page'), cached=True)
    return None


def cached(id, res='2k', any_res=True):
    """The cached asset or None, never a download (the engine's offline mode)."""
    e = _entry(id)
    return _cached(id, e, asset_dir(e), res, any_res) if e else None


def fetch(id, res='2k', allow_sa=False, max_mb=300, force=False, log=print, offline=False):
    """-> {'id','kind','main' (model/hdri path) | 'maps' {role: path} (texture), 'res','dir','title','author','license','page'}
    offline=True: only the cache (any resolution on disk), else FetchError. Downloads of one asset are serialised across
    processes (a lock per asset): a second Blender waiting for the same id gets the first one's files."""
    e = _entry(id)
    if e is None: raise FetchError(f'{id} is not in the index (asset_index.py search / refresh)')
    if not X.licence_ok(e.get('license', ''), allow_sa): raise FetchError(f'licence "{e.get("license")}" is not allowed (CC0 / PD / CC-BY only)')
    d = asset_dir(e)
    if not force:
        hit = _cached(id, e, d, res, any_res=offline)
        if hit: return hit
    if offline:
        raise FetchError(f'{id} is not in the cache and downloads are off here (CZ_ASSETS_OFFLINE=1): '
                         f'fetch it first: tools/fetch_asset.py {id} --res {res}')
    lock = 'dl_' + slug((e['id'].split('/', 1)[0] if e['src'] == 'kenney' else e['id']).replace(':', '_'))
    with X._FileLock(lock, wait=1800, stale=90, beat=True):
        if not force:
            hit = _cached(id, e, d, res)            # fetched by another process while this one waited
            if hit: log(f'CZ FETCH {id} was fetched by another process'); return hit
        d.mkdir(parents=True, exist_ok=True)
        mp = d / 'meta.json'
        meta = _read_meta(mp) or {'entry': e, 'variants': {}}
        meta.setdefault('variants', {})
        t0 = time.time(); info = {}
        for k, v in HANDLERS[e['src']](e, res, d):
            if k == 'size' and v and v > max_mb * 1e6: raise FetchError(f'{v / 1e6:.0f} MB is over the {max_mb} MB limit (--max-mb, or a lower --res)')
            info[k] = v
        paths = [info['main']] if info.get('main') else list((info.get('maps') or {}).values())
        for p in paths: verify(p)
        if e['kind'] == 'model' and info.get('main') and Path(info['main']).suffix.lower() == '.gltf': verify(info['main'])
        nbytes = sum(p.stat().st_size for p in d.rglob('*') if p.is_file())
        rec = {'res': info.get('res', res), 'main': _rel(info['main'], d) if info.get('main') else None,
               'maps': {k: _rel(v, d) for k, v in (info.get('maps') or {}).items()} or None,
               'bytes': nbytes, 'secs': round(time.time() - t0, 1), 'date': time.strftime('%Y-%m-%d %H:%M')}
        if info.get('pack'): rec['pack'] = info['pack']
        if info.get('parts') and len(info['parts']) > 1: rec['parts'] = [_rel(p, d) for p in info['parts']]
        meta['variants'][res] = rec; meta['entry'] = e
        if info.get('license'): meta['license'] = info['license']
        _write_meta(mp, meta)
        credit(e, meta.get('license'))
        X.set_local(id, {'res': list(meta['variants']), 'dir': d.as_posix()})
    log(f'CZ FETCH ok {id} {rec["res"]} {nbytes / 1e6:.1f} MB in {rec["secs"]}s -> {d}')
    out = _resolve(d, rec)
    return dict(out, id=id, kind=e['kind'], dir=str(d), title=e['name'], author=e.get('author'), license=meta.get('license', e.get('license')), page=e.get('page'), cached=False)


def _resolve(d, rec):
    P = lambda v: d / str(v).replace('\\', '/')
    if rec.get('maps'):
        maps = {k: str(P(v)) for k, v in rec['maps'].items()}
        return {'maps': maps, 'res': rec['res']} if all(os.path.exists(v) for v in maps.values()) else None
    if rec.get('main'):
        p = P(rec['main'])
        if not p.exists(): return None
        out = {'main': str(p), 'res': rec['res']}
        if rec.get('parts'): out['parts'] = [str(P(x)) for x in rec['parts']]
        return out
    if rec.get('pack') is not None: return {'main': None, 'pack': rec['pack'], 'res': rec['res']}
    return None


def credit(e, lic=None):
    cf = X.cache_root() / 'CREDITS.json'
    c = {'id': e['id'], 'title': e['name'], 'author': e.get('author', ''), 'license': lic or e.get('license', ''),
         'source_url': e.get('page', ''), 'source': e['src'], 'kind': e['kind']}
    with X._FileLock('credits'):
        cr = X._read_json(cf, [])
        X._write_json(cf, [x for x in cr if x.get('id') != e['id']] + [c])
    return c


def main(a):
    if not a or a[0] in ('-h', '--help'): print(open(__file__, encoding='utf-8').read().split('\nimport')[0]); return 0
    opt = lambda k, d=None: a[a.index(k) + 1] if k in a else d
    res = opt('--res', '2k')
    if a[0] == '--repair':      # the whole cache: Windows relpaths -> '/', missing local marks set (before copying it to a Mac)
        n = m = 0
        for mp in X.cache_root().glob('*/*/*/meta.json'):
            meta = _read_meta(mp); n += 1
            e = (meta or {}).get('entry') or {}
            if e.get('id') and X.get(e['id']) is not None and _cached(e['id'], e, mp.parent, '2k', any_res=True): m += 1
        print(f'CZ FETCH repair: {n} meta.json checked, {m} assets on disk and marked local'); return 0
    if '--query' in a:
        hits = X.search(opt('--query'), opt('--kind', 'model'), 20, opt('--style'))
        hits = [h for h in hits if not (h.get('needs_token') and not os.environ.get('SKETCHFAB_TOKEN'))]
        if not hits: print('CZ FETCH no match'); return 1
        id = hits[0]['id']; print('CZ FETCH best match', X._fmt(hits[0]))
    else: id = a[0]
    try:
        r = fetch(id, res, '--allow-sa' in a, float(opt('--max-mb', '300')), '--force' in a)
        print(json.dumps(r, indent=1, ensure_ascii=False)); return 0
    except FetchError as ex:
        print('CZ FETCH FAILED', id, ex); return 2


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
