# asset_index.py - the searchable catalog of FREE 3D assets (models, PBR textures, HDRIs) for the 3D Informational
# (mega) engine. Standard library only: runs with any Python 3.9+ and inside Blender (engine/assets.py imports it).
#   python tools/asset_index.py refresh [--sources ph,acg,kh,nasa,kenney,pp,si,sf]     build / refresh the index
#   python tools/asset_index.py search "red sports car" [--kind model|texture|hdri] [--n 10] [--style real|lowpoly] [--live] [--json]
#   python tools/asset_index.py info <id>          one entry (licence, author, page, polys, size, local files)
#   python tools/asset_index.py stats              entries per source / kind, index age
# The index lives in the shared asset cache: env CZ_ASSETS3D, else <Documents>/Creatorize Assets/3d (index.json).
# Every source is public and key-free; Sketchfab search is key-free too, its DOWNLOADS need the user's own token
# (env SKETCHFAB_TOKEN, never written anywhere: see references/assets.md). Licences: only CC0 / public domain / CC-BY
# assets are indexed as usable (NC / ND / editorial are dropped at index time and refused again by fetch_asset.py).
import json, os, re, sys, time, math, urllib.request, urllib.parse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

UA = {'User-Agent': 'CreatorizeSuite/mega-assets (free CC0/CC-BY 3D asset index; contact via skool.com/creatorize)'}


# ---------------------------------------------------------------- the cache
def cache_root():
    """One shared library per machine: CZ_ASSETS3D, else <Documents>/Creatorize Assets/3d (Windows + Mac)."""
    env = os.environ.get('CZ_ASSETS3D')
    if env: p = Path(env)
    else:
        docs = Path.home() / 'Documents'
        if os.name == 'nt':      # a moved Documents folder (OneDrive / another drive): the shell's known folder
            try:
                import ctypes, ctypes.wintypes
                buf = ctypes.create_unicode_buffer(ctypes.wintypes.MAX_PATH)
                if ctypes.windll.shell32.SHGetFolderPathW(None, 5, None, 0, buf) == 0 and buf.value: docs = Path(buf.value)
            except Exception: pass
        p = docs / 'Creatorize Assets' / '3d'
    for sub in ('models', 'textures', 'hdris'): (p / sub).mkdir(parents=True, exist_ok=True)
    return p


def index_path(): return cache_root() / 'index.json'


def http(url, js=True, timeout=60, headers=None, tries=3):
    h = dict(UA); h.update(headers or {})
    err = None
    for k in range(tries):
        try:
            b = urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=timeout).read()
            return json.loads(b) if js else b
        except Exception as e:
            err = e
            if getattr(e, 'code', 0) in (401, 403, 404): break
            time.sleep(0.6 * (k + 1))
    raise err


# ---------------------------------------------------------------- licences
def licence_ok(lic, allow_sa=False):
    """CC0 / public domain / CC-BY only. No NC, no ND, no editorial, no unclear terms. ShareAlike only with allow_sa
    (it can bind the finished video's licence: off by default)."""
    L = (lic or '').upper().replace('-', ' ').replace('_', ' ')
    if not L.strip(): return False
    if any(x in L for x in (' NC', 'NONCOMMERCIAL', 'NON COMMERCIAL', ' ND', 'NODERIV', 'NO DERIV', 'EDITORIAL', 'LEGAL AGREEMENT', 'LICENSEREF')): return False
    if (' SA' in L or 'SHAREALIKE' in L or 'SHARE ALIKE' in L) and not allow_sa: return False
    return any(x in L for x in ('CC0', 'PUBLIC DOMAIN', 'CC BY', 'CC ATTRIBUTION', 'CREATIVE COMMONS ATTRIBUTION', 'NASA'))


# ---------------------------------------------------------------- words + synonyms
SYN = [  # groups: a query word also finds its group (weighted lower than the word itself)
    'car vehicle sedan automobile auto hatchback coupe suv taxi cab jeep van',
    'truck lorry pickup semi trailer tanker dumptruck',
    'bus coach minibus', 'bike bicycle cycle', 'motorbike motorcycle scooter moped',
    'plane airplane aeroplane aircraft jet airliner', 'helicopter chopper', 'boat ship vessel yacht ferry', 'train locomotive railway tram',
    'rocket spacecraft spaceship shuttle capsule', 'satellite probe orbiter',
    'excavator digger backhoe bulldozer loader crane construction',
    'tree oak pine birch fir spruce conifer maple palm willow trunk',
    'bush shrub hedge', 'grass lawn turf weeds meadow tuft', 'plant vegetation foliage flower fern potted', 'leaf leaves foliage',
    'rock stone boulder pebble cliff granite basalt', 'mountain cliff terrain hill',
    'ground soil dirt mud earth gravel sand floor terrain', 'road asphalt tarmac street pavement', 'brick bricks masonry wall',
    'concrete cement', 'wood wooden timber plank planks lumber log', 'metal steel iron aluminium aluminum rusty rust', 'tile tiles tiled',
    'house home cottage cabin villa bungalow shed barn hut', 'building tower apartment skyscraper office warehouse factory',
    'tool tools hammer wrench spanner screwdriver drill saw pliers shovel axe', 'chair seat stool armchair bench sofa couch',
    'table desk', 'lamp light lantern streetlight', 'barrel drum keg', 'box crate container',
    'person human man woman people character figure body', 'dog puppy', 'cat kitten', 'horse pony', 'bird eagle crow pigeon', 'fish shark',
    'skull bone bones skeleton', 'sky hdri environment', 'sunset sunrise dusk dawn evening', 'night moon', 'overcast cloudy clouds',
    'snow ice frozen winter', 'water sea ocean lake river', 'fabric cloth textile', 'glass window', 'food fruit vegetable',
    'gun rifle pistol weapon', 'sword blade knife', 'fence railing gate', 'pipe pipes tube', 'computer laptop pc monitor',
    'phone smartphone mobile', 'bottle jar can', 'helmet hat', 'statue sculpture bust', 'engine motor', 'wheel tire tyre',
]
_SYN = {}
for g in SYN:
    ws = g.split()
    for w in ws: _SYN.setdefault(w, set()).update(x for x in ws if x != w)
STOP = {'a', 'an', 'the', 'of', 'and', 'with', 'for', 'in', 'on', 'to', 'free', 'model', 'models', '3d', 'texture', 'pbr', 'low', 'poly'}


def stem(w):
    if len(w) > 4 and w.endswith('ies'): return w[:-3] + 'y'
    if len(w) > 4 and w.endswith(('ches', 'shes', 'xes', 'sses')): return w[:-2]
    if len(w) > 3 and w.endswith('s') and not w.endswith(('ss', 'us', 'is')): return w[:-1]
    return w


def words(s):
    out = []
    for w in re.findall(r'[a-z0-9]+', (s or '').lower().replace('_', ' ')):
        w = stem(w)
        if w and w not in STOP and not w.isdigit(): out.append(w)
    return out


# ---------------------------------------------------------------- sources
PRIOR = {'polyhaven': 1.0, 'ambientcg': 0.9, 'sketchfab': 0.75, 'smithsonian': 0.7, 'nasa': 0.7, 'khronos': 0.55,
         'polypizza': 0.5, 'kenney': 0.45}
STYLE = {'polyhaven': 'real', 'ambientcg': 'real', 'sketchfab': 'real', 'smithsonian': 'real', 'nasa': 'real',
         'khronos': 'real', 'polypizza': 'lowpoly', 'kenney': 'lowpoly'}


def E(id, src, kind, name, tags=(), cats=(), license='', author='', page='', **kw):
    e = {'id': id, 'src': src, 'kind': kind, 'name': name, 'tags': sorted(set(t.lower() for t in tags if t))[:40],
         'cats': sorted(set(c.lower() for c in cats if c))[:12], 'license': license, 'author': author, 'page': page,
         'style': STYLE.get(src, 'real')}
    e.update({k: v for k, v in kw.items() if v is not None})
    return e


def src_polyhaven():
    out = []
    kinds = {'models': 'model', 'textures': 'texture', 'hdris': 'hdri'}
    for t, kind in kinds.items():
        d = http(f'https://api.polyhaven.com/assets?t={t}')
        for k, v in d.items():
            dims = v.get('dimensions')
            out.append(E('ph:' + k, 'polyhaven', kind, v.get('name', k), v.get('tags', []), [c for c in v.get('categories', []) if not c.startswith('collection')],
                         'CC0 1.0', ', '.join(v.get('authors', {}) or {}), f'https://polyhaven.com/a/{k}',
                         polys=v.get('polycount'), dims_m=[round(x / 1000, 3) for x in dims] if dims and kind != 'hdri' else None,
                         max_res=(v.get('max_resolution') or [None])[0], downloads=v.get('download_count'),
                         desc=(v.get('description') or '')[:200] or None, lods=v.get('lods'),
                         attrs=v.get('attributes') if kind == 'hdri' else None))
    return out


def src_ambientcg():
    out = []
    kinds = {'material': 'texture', 'hdri': 'hdri', '3d-model': 'model', 'decal': 'texture', 'atlas': 'texture'}
    for t, kind in kinds.items():
        off = 0
        while True:
            d = http(f'https://ambientcg.com/api/v3/assets?type={t}&limit=500&offset={off}&include=title,tags,downloads,statistic')
            for a in d.get('assets', []):
                dl = {x['attributes']: x['size'] for x in a.get('downloads', []) if x.get('extension') == 'zip'}
                out.append(E('acg:' + a['id'], 'ambientcg', kind, a.get('title', a['id']), a.get('tags', []), [t, re.sub(r'\d+$', '', a['id'])],
                             'CC0 1.0', 'ambientCG (Lennart Demes)', f'https://ambientcg.com/view?id={a["id"]}',
                             variants=sorted(dl), sizes={k: round(v / 1e6, 1) for k, v in dl.items()} or None,
                             downloads=(a.get('statistic') or {}).get('downloads') if isinstance(a.get('statistic'), dict) else None,
                             acg_type=t))
            off += 500
            if off >= d.get('totalResults', 0) or not d.get('assets'): break
    return out


def src_khronos():
    base = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/'
    idx = http(base + 'model-index.json')
    def meta(m):
        try: return m, http(base + m['name'] + '/metadata.json')
        except Exception: return m, {}
    out = []
    with ThreadPoolExecutor(16) as ex:
        for m, md in ex.map(meta, idx):
            legal = md.get('legal') or []
            lics = sorted(set(l.get('spdx') or l.get('license', '') for l in legal))
            lic = ' + '.join(lics)
            if not lics or not all(licence_ok(l) for l in lics): continue
            if 'testing' in (m.get('tags') or []) and 'showcase' not in (m.get('tags') or []): continue   # test models are not props
            v = m.get('variants', {})
            out.append(E('kh:' + m['name'], 'khronos', 'model', m.get('label', m['name']), (m.get('tags') or []) + words(m.get('label', '')),
                         ['sample'], lic, ', '.join(sorted(set(l.get('artist', '') for l in legal))), f'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/{m["name"]}',
                         desc=(md.get('summary') or '')[:200] or None, variants=sorted(v)))
    return out


def src_nasa():
    t = http('https://api.github.com/repos/nasa/NASA-3D-Resources/git/trees/master?recursive=1')
    folders = {}
    for x in t.get('tree', []):
        p = x['path']
        if not p.startswith('3D Models/') or x['type'] != 'blob': continue
        parts = p.split('/')
        if len(parts) < 3: continue
        f = folders.setdefault(parts[1], {'files': [], 'bytes': 0})
        f['files'].append((p, x.get('size', 0))); f['bytes'] += x.get('size', 0) or 0
    out = []
    for name, f in folders.items():
        exts = sorted(set(p.rsplit('.', 1)[-1].lower() for p, _ in f['files'] if '.' in p.rsplit('/', 1)[-1]))
        if not any(e in exts for e in ('glb', 'gltf', 'obj', 'fbx', 'blend', 'stl', 'usdz')): continue
        out.append(E('nasa:' + name, 'nasa', 'model', name, words(name) + ['space', 'nasa'], ['space'],
                     'Public domain (NASA media usage guidelines; no NASA insignia/logo use)', 'NASA',
                     'https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/' + urllib.parse.quote(name),
                     formats=exts, size_mb=round(f['bytes'] / 1e6, 1),
                     files=[p for p, _ in f['files'] if p.rsplit('.', 1)[-1].lower() in ('glb', 'gltf', 'bin', 'obj', 'mtl', 'fbx', 'blend', 'stl', 'usdz', 'png', 'jpg', 'jpeg', 'tif', 'tga')][:80]))
    return out


def src_kenney():
    out, seen = [], set()
    for page in range(1, 8):
        try: h = http(f'https://kenney.nl/assets/category:3D/page:{page}', js=False).decode('utf-8', 'replace')
        except Exception: break
        slugs = [s for s in re.findall(r'https://kenney\.nl/assets/([a-z0-9\-]+)', h) if s not in ('category', 'series', 'tag', 'page')]
        new = [s for s in dict.fromkeys(slugs) if s not in seen]
        if not new: break
        for s in new:
            seen.add(s)
            out.append(E('kenney:' + s, 'kenney', 'pack', s.replace('-', ' ').title(), words(s.replace('-', ' ')) + ['kit', 'pack', 'lowpoly'],
                         ['pack'], 'CC0 1.0', 'Kenney (kenney.nl)', 'https://kenney.nl/assets/' + s))
    return out


# Seeds for the search-only sources (Poly Pizza, Smithsonian, Sketchfab): the index keeps what these queries return,
# `search --live` asks the sources again for any query and merges the answers.
SEEDS = ('tree pine palm bush grass flower plant rock boulder cliff car truck bus van taxi police ambulance tractor excavator crane '
         'bulldozer forklift train boat ship plane helicopter rocket satellite bicycle motorcycle house building skyscraper barn '
         'shed church castle bridge tower fence wall door window chair table sofa bed desk lamp shelf barrel crate box pallet '
         'hammer wrench screwdriver drill saw shovel axe ladder bucket toolbox helmet gun sword shield knife phone laptop computer '
         'tv camera bottle cup plate food apple bread pizza dog cat horse cow bird fish dinosaur skeleton skull person man woman '
         'soldier robot statue sign street light traffic cone road hydrant bench trash can pipe tank engine generator wheel tire '
         'mountain island volcano planet moon asteroid tent campfire well windmill lighthouse').split()


def src_polypizza(queries=SEEDS):
    def one(q):
        try: return http('https://poly.pizza/api/search/' + urllib.parse.quote(q)).get('results', []), q
        except Exception: return [], q
    out = {}
    with ThreadPoolExecutor(12) as ex:
        for res, q in ex.map(one, queries):
            for r in res:
                if not licence_ok(r.get('licence', '')): continue
                pid = r.get('publicID')
                if not pid: continue
                e = out.get(pid) or E('pp:' + pid, 'polypizza', 'model', r.get('title', pid), words(r.get('title', '')) + [q], [q],
                                      r.get('licence', ''), (r.get('creator') or {}).get('username', ''), 'https://poly.pizza' + r.get('url', '/m/' + pid),
                                      thumb=r.get('previewUrl'))
                e['tags'] = sorted(set(e['tags']) | {q}); out[pid] = e
    return list(out.values())


def src_smithsonian(queries=None):
    """Smithsonian 3D Open Access (CC0). The API lists FILES; one model = one model_url with several qualities."""
    rows = []
    if queries is None:     # the full listing: ~41k file rows, paged
        first = http('https://3d-api.si.edu/api/v1.0/content/file/search?rows=1&start=0')
        tot = int(first.get('rowCount', 0)); step = 1000
        def page(s):
            try: return http(f'https://3d-api.si.edu/api/v1.0/content/file/search?rows={step}&start={s}', timeout=90).get('rows', [])
            except Exception: return []
        with ThreadPoolExecutor(8) as ex:
            for r in ex.map(page, range(0, tot, step)): rows += r
    else:
        def one(q):
            try: return http('https://3d-api.si.edu/api/v1.0/content/file/search?rows=200&q=' + urllib.parse.quote(q)).get('rows', [])
            except Exception: return []
        with ThreadPoolExecutor(8) as ex:
            for r in ex.map(one, queries): rows += r
    models = {}
    for r in rows:
        c = r.get('content') or {}
        mu = c.get('model_url')
        if not mu: continue
        m = models.setdefault(mu, {'title': r.get('title', ''), 'files': {}})
        if (c.get('file_type') or '').lower() == 'glb' and c.get('uri'):     # a model in several parts: one glb per part
            lst = m['files'].setdefault(f"{c.get('usage')}/{c.get('quality')}", [])
            if c['uri'] not in lst: lst.append(c['uri'])
    out = []
    for mu, m in models.items():
        if not m['files']: continue
        uid = mu.split(':', 1)[-1]
        out.append(E('si:' + uid, 'smithsonian', 'model', m['title'] or uid, words(m['title']) + ['museum', 'artifact', 'scan'], ['museum'],
                     'CC0 1.0 (Smithsonian Open Access)', 'Smithsonian Institution', 'https://3d.si.edu/object/3d/' + uid,
                     files=m['files']))
    return out


def src_sketchfab(queries=SEEDS[:60]):
    """Sketchfab: search is key-free (downloadable, CC0 + CC-BY only); downloading needs SKETCHFAB_TOKEN."""
    def one(arg):
        q, lic = arg
        try: return http(f'https://api.sketchfab.com/v3/search?type=models&downloadable=true&license={lic}&count=24&sort_by=-likeCount&q=' + urllib.parse.quote(q)).get('results', []), q
        except Exception: return [], q
    out = {}
    with ThreadPoolExecutor(6) as ex:
        for res, q in ex.map(one, [(q, l) for q in queries for l in ('cc0', 'by')]):
            for r in res:
                lab = (r.get('license') or {}).get('label', '') or ''
                lic = {'CC Attribution': 'CC-BY 4.0', 'CC0 Public Domain': 'CC0 1.0'}.get(lab, lab)
                if not licence_ok(lic): continue
                ar = r.get('archives') or {}
                glb = ar.get('glb') or ar.get('gltf') or {}
                if r.get('isAgeRestricted'): continue
                e = E('sf:' + r['uid'], 'sketchfab', 'model', r.get('name', r['uid']), [t.get('name', '') for t in r.get('tags', [])] + words(r.get('name')) + [q],
                      [c.get('name', '') for c in r.get('categories', [])], lic, (r.get('user') or {}).get('displayName', ''),
                      r.get('viewerUrl', ''), polys=r.get('faceCount'), size_mb=round((glb.get('size') or 0) / 1e6, 1) or None,
                      max_res=glb.get('textureMaxResolution'), likes=r.get('likeCount'), animated=bool(r.get('animationCount')),
                      needs_token=True)
                out[r['uid']] = e
    return list(out.values())


SOURCES = {'ph': src_polyhaven, 'acg': src_ambientcg, 'kh': src_khronos, 'nasa': src_nasa, 'kenney': src_kenney,
           'pp': src_polypizza, 'si': src_smithsonian, 'sf': src_sketchfab}


# ---------------------------------------------------------------- the index file
# index.json = the catalog (written by refresh / live search); local.json = what is in the cache + entries made from
# downloaded packs (written by fetch_asset). Both are written under a cross-process lock (several Blenders and fetches
# run at once on a render night) and replaced atomically; readers retry while a writer swaps the file.
import threading
_LOCK = threading.RLock()
_IDX = None
_TLOCKS, _HELD, _TL_GUARD = {}, {}, threading.Lock()


class _FileLock:
    """A cross-process lock file `.<name>.lock` in `folder` (default: the cache root), re-entrant within one thread.
    beat=True refreshes the file every 10 s while held (a long download is never taken for a crashed holder); a lock
    file not refreshed for `stale` seconds is a crashed holder's and is taken over. Waits up to `wait` seconds."""
    def __init__(self, name='index', folder=None, wait=120, stale=60, beat=False):
        self.p = Path(folder or cache_root()) / f'.{name}.lock'; self.fd = None; self.k = str(self.p)
        self.wait, self.stale, self.beat, self.nested, self._stop = wait, stale, beat, False, None
        with _TL_GUARD: self.tl = _TLOCKS.setdefault(self.k, threading.RLock())
    def __enter__(self):
        self.tl.acquire()
        h = _HELD.get(self.k)
        if h and h[0] == threading.get_ident(): h[1] += 1; self.nested = True; return self
        t0 = time.time()
        try:
            self.p.parent.mkdir(parents=True, exist_ok=True)
            while True:
                try: self.fd = os.open(self.k, os.O_CREAT | os.O_EXCL | os.O_WRONLY); break
                except FileExistsError:
                    try:
                        if time.time() - self.p.stat().st_mtime > self.stale: self.p.unlink()     # a crashed holder's lock
                    except OSError: pass
                    if time.time() - t0 > self.wait: raise TimeoutError('asset lock busy: ' + self.k)
                    time.sleep(0.05 if self.wait <= 120 else 0.3)
        except BaseException:
            self.tl.release(); raise
        _HELD[self.k] = [threading.get_ident(), 1]
        if self.beat:
            self._stop = threading.Event()
            def beat(stop=self._stop, p=self.k):
                while not stop.wait(10):
                    try: os.utime(p, None)
                    except OSError: pass
            threading.Thread(target=beat, daemon=True).start()
        return self
    def __exit__(self, *a):
        try:
            if self.nested: _HELD[self.k][1] -= 1; return
            if self._stop: self._stop.set()
            _HELD.pop(self.k, None)
            try: os.close(self.fd); self.p.unlink()
            except OSError: pass
        finally: self.tl.release()


def _read_json(p, default):
    txt = None
    for k in range(30):
        try:
            if not p.exists(): return default
            txt = p.read_text(encoding='utf-8'); return json.loads(txt)
        except (ValueError, PermissionError, OSError):
            time.sleep(0.03 * (k + 1))
    if txt:     # a file cut / doubled by an old crash: keep its first valid document
        try: return json.JSONDecoder().raw_decode(txt.lstrip())[0]
        except ValueError: pass
    raise RuntimeError('cannot read ' + str(p))


def _write_json(p, d):
    tmp = p.with_name(p.name + f'.{os.getpid()}.{threading.get_ident()}.tmp')
    tmp.write_text(json.dumps(d, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    for k in range(40):
        try: os.replace(tmp, p); return
        except PermissionError: time.sleep(0.05 * (k + 1))
    raise RuntimeError('cannot write ' + str(p))


def local_path(): return cache_root() / 'local.json'


def load():
    global _IDX
    with _LOCK:
        p, lp = index_path(), local_path()
        mt = (p.stat().st_mtime if p.exists() else 0, lp.stat().st_mtime if lp.exists() else 0)
        if _IDX is None or _IDX.get('_mtime') != mt:
            if _IDX is None or _IDX.get('_mtime', (None,))[0] != mt[0]:
                base = _read_json(p, {'entries': {}, 'sources': {}})
            else:
                base = {k: v for k, v in _IDX.items() if not k.startswith('_')}
                base['entries'] = {k: v for k, v in _IDX['entries'].items() if not v.get('_extra')}
            loc = _read_json(lp, {'local': {}, 'extra': {}})
            for k, e in loc.get('extra', {}).items(): base['entries'][k] = dict(e, _extra=True)
            for k, v in base['entries'].items(): v.pop('local', None)
            for k, v in loc.get('local', {}).items():
                if k in base['entries']: base['entries'][k]['local'] = v
            base['_mtime'] = mt; _IDX = base
        return _IDX


def save(idx):
    """Write the catalog (refresh / live search). Local marks and pack entries live in local.json."""
    with _FileLock():
        d = {k: v for k, v in idx.items() if not k.startswith('_')}
        d['entries'] = {k: {kk: vv for kk, vv in v.items() if kk not in ('local', '_extra')} for k, v in idx['entries'].items() if not v.get('_extra')}
        _write_json(index_path(), d)
    global _IDX; _IDX = None


def _local_update(fn):
    with _FileLock('local'):
        lp = local_path(); loc = _read_json(lp, {'local': {}, 'extra': {}})
        fn(loc); _write_json(lp, loc)
    global _IDX; _IDX = None


def merge(idx, entries, src_key=None, replace=False):
    ent = idx.setdefault('entries', {})
    if replace and src_key:
        pre = src_key + ':'
        for k in [k for k in ent if k.startswith(pre) and not ent[k].get('local')]: del ent[k]
    for e in entries:
        old = ent.get(e['id'])
        if old and old.get('tags'): e['tags'] = sorted(set(old['tags']) | set(e['tags']))[:60]
        if old and old.get('local'): e['local'] = old['local']
        ent[e['id']] = e
    return len(entries)


def refresh(sources=None, log=print):
    idx = load(); sources = sources or list(SOURCES)
    t0 = time.time(); rep = {}
    def run(k):
        ts = time.time()
        try: es = SOURCES[k](); return k, es, time.time() - ts, None
        except Exception as ex: return k, [], time.time() - ts, repr(ex)[:200]
    with ThreadPoolExecutor(len(sources)) as ex:
        for k, es, dt, err in ex.map(run, sources):
            if err: log(f'CZ INDEX {k}: FAILED {err} ({dt:.1f}s)'); rep[k] = {'error': err}; continue
            merge(idx, es, k, replace=True)
            idx.setdefault('sources', {})[k] = {'n': len(es), 'secs': round(dt, 1), 'date': time.strftime('%Y-%m-%d %H:%M')}
            rep[k] = len(es); log(f'CZ INDEX {k}: {len(es)} entries in {dt:.1f}s')
    idx['refreshed'] = time.strftime('%Y-%m-%d %H:%M'); save(idx)
    n = len(load()['entries'])
    log(f'CZ INDEX total {n} entries, refresh {time.time() - t0:.1f}s -> {index_path()}')
    return rep


def ensure_index(log=print):
    """A machine's first search finds an EMPTY index (a member's new install): refresh it once, by itself (~25 s, network).
    Offline (CZ_ASSETS_OFFLINE=1), or within 10 min of a refresh that found nothing, it does not try. True = entries now."""
    if load().get('entries'): return True
    if os.environ.get('CZ_ASSETS_OFFLINE') == '1': return False
    mark = cache_root() / '.refresh_failed'
    try:
        if time.time() - mark.stat().st_mtime < 600: return False
    except OSError: pass
    with _FileLock('refresh', wait=600, stale=90, beat=True):
        if load().get('entries'): return True          # another process refreshed while this one waited
        log('CZ INDEX empty on this machine: refreshing it once (~25 s)')
        try: refresh(log=log)
        except Exception as ex: log(f'CZ INDEX refresh failed: {ex!r}'[:200])
        ok = bool(load().get('entries'))
        if ok:
            try: mark.unlink()
            except OSError: pass
        else:
            mark.write_text(time.strftime('%Y-%m-%d %H:%M'), encoding='utf-8')
            log('CZ INDEX still empty (no network?): model the things in Python at models.md\'s bar, note it in storyboard.md, carry on')
        return ok


# ---------------------------------------------------------------- search
def _tokens(e):
    T = {}
    def add(ws, w):
        for x in ws: T[x] = max(T.get(x, 0), w)
    add(words(e.get('name')), 3.0); add([stem(t) for t in e.get('tags', []) for t in words(t)], 2.0)
    add([w for c in e.get('cats', []) for w in words(c)], 1.5); add(words(e.get('desc')), 0.6)
    return T


def search(query, kind='model', n=10, style=None, live=False, src=None, local_first=True):
    """Ranked entries for a query. kind: model | texture | hdri | pack | None (all). style: 'real' / 'lowpoly' filters.
    live: also ask the search-only sources (Poly Pizza, Smithsonian, Sketchfab) for this query and merge them in."""
    if live:
        idx = load(); q = ' '.join(words(query)) or query
        for k, fn in (('pp', src_polypizza), ('si', src_smithsonian), ('sf', src_sketchfab)):
            try: merge(idx, fn([q]))
            except Exception as ex: print('CZ INDEX live', k, repr(ex)[:120])
        save(idx)
    idx = load()
    if not idx.get('entries') and ensure_index(): idx = load()
    if '_tok' not in idx: idx['_tok'] = {k: _tokens(e) for k, e in idx.get('entries', {}).items()}
    Q = words(query)
    if not Q: return []
    res = []
    for k, e in idx['entries'].items():
        if kind and e.get('kind') != kind: continue
        if style and e.get('style') != style: continue
        if src and e.get('src') != src: continue
        T = idx['_tok'][k]
        s, hit = 0.0, 0
        for q in Q:
            best = T.get(q, 0.0)
            if not best and len(q) >= 4:
                best = max((w * 0.45 for t, w in T.items() if len(t) >= 4 and (t.startswith(q) or q.startswith(t))), default=0.0)
            if not best:
                best = max((T.get(sy, 0.0) * 0.6 for sy in _SYN.get(q, ())), default=0.0)
            if best: hit += 1
            s += best
        if not hit: continue
        s *= (hit / len(Q)) ** 2
        s *= 0.55 + 0.45 * PRIOR.get(e.get('src'), 0.5)
        if e.get('downloads'): s *= 1 + 0.04 * math.log10(1 + e['downloads'])
        if e.get('likes'): s *= 1 + 0.03 * math.log10(1 + e['likes'])
        if local_first and e.get('local'): s *= 1.25
        if e.get('needs_token') and not os.environ.get('SKETCHFAB_TOKEN'): s *= 0.55     # can't be fetched here yet
        res.append((s, e))
    res.sort(key=lambda x: -x[0])
    return [dict(e, score=round(s, 3)) for s, e in res[:n]]


def get(id):
    return load().get('entries', {}).get(id)


def set_local(id, info):
    """fetch_asset.py marks an entry as in the cache (the search prefers it)."""
    _local_update(lambda loc: loc.setdefault('local', {}).__setitem__(id, info))


def add_entries(es):
    """Entries made on this machine (a downloaded pack's models): kept in local.json, survive a refresh."""
    def f(loc):
        ex = loc.setdefault('extra', {})
        for e in es:
            if e.get('local'): loc.setdefault('local', {})[e['id']] = e.pop('local')
            ex[e['id']] = {k: v for k, v in e.items() if k != '_extra'}
    _local_update(f)


# ---------------------------------------------------------------- CLI
def _fmt(e):
    bits = [e['id'], e['kind'], f"\"{e['name']}\"", e.get('license', ''), 'by ' + (e.get('author') or '?')]
    if e.get('polys'): bits.append(f"{e['polys'] / 1000:.0f}k polys")
    if e.get('dims_m'): bits.append('dims ' + 'x'.join(f'{d:g}' for d in e['dims_m']) + ' m')
    if e.get('size_mb'): bits.append(f"{e['size_mb']} MB")
    if e.get('max_res'): bits.append(f"tex {e['max_res']}")
    if e.get('needs_token'): bits.append('needs SKETCHFAB_TOKEN')
    if e.get('local'): bits.append('LOCAL')
    if 'score' in e: bits.insert(0, f"{e['score']:6.2f}")
    return '  '.join(str(b) for b in bits)


def main(a):
    if not a or a[0] in ('-h', '--help'): print(__doc__ or open(__file__, encoding='utf-8').read().split('\nimport')[0]); return
    cmd = a[0]; opt = lambda k, d=None: a[a.index(k) + 1] if k in a else d
    if cmd == 'refresh':
        refresh(opt('--sources', ','.join(SOURCES)).split(','))
    elif cmd == 'search':
        kind = opt('--kind', 'model'); kind = None if kind == 'any' else kind
        r = search(a[1], kind, int(opt('--n', '10')), opt('--style'), '--live' in a, opt('--src'))
        if '--json' in a: print(json.dumps(r, indent=1, ensure_ascii=False))
        else:
            for e in r: print(_fmt(e))
            if not r: print('CZ INDEX no match (try --live, --kind any, or other words)')
    elif cmd == 'info':
        print(json.dumps(get(a[1]), indent=1, ensure_ascii=False))
    elif cmd == 'stats':
        idx = load(); from collections import Counter
        c = Counter((e['src'], e['kind']) for e in idx.get('entries', {}).values())
        for (s, k), v in sorted(c.items()): print(f'{s:12s} {k:8s} {v}')
        print('total', sum(c.values()), 'refreshed', idx.get('refreshed'), 'local', sum(1 for e in idx['entries'].values() if e.get('local')))
        for k, v in idx.get('sources', {}).items(): print(' ', k, v)
    else: print('unknown command', cmd)


if __name__ == '__main__':
    main(sys.argv[1:])
