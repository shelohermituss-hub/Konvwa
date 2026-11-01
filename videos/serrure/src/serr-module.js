      import * as THREE from "three";
      import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
      import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
      import { Line2 } from "three/addons/lines/Line2.js";
      import { LineMaterial } from "three/addons/lines/LineMaterial.js";
      import { LineGeometry } from "three/addons/lines/LineGeometry.js";

      const END = __END__
      const RAW = __RAW__
      const T = RAW.map((t) => Math.round((0.2 + t) * 100) / 100)

      // ---------- maths ----------
      const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
      const win = (t, a, b) => clamp((t - a) / (b - a))
      const eio = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
      const eo = (x) => 1 - Math.pow(1 - x, 3)
      const eob = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2) }
      const popS = (t, t0, d = 0.4) => (t < t0 ? 0 : eob(win(t, t0, t0 + d)))
      const lerp = (a, b, u) => a + (b - a) * u
      const L3 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)]
      const P = (x, y, z) => new THREE.Vector3(x, y, z)
      const sz = (o, s) => { o.visible = s > 0.002; o.scale.setScalar(Math.max(0.001, s)) }

      // ---------- renderer: studio look (units: millimetres) ----------
      const canvas = document.getElementById("three")
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
      renderer.setSize(1080, 1920, false); renderer.setPixelRatio(1)
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap
      renderer.localClippingEnabled = true
      const scene = new THREE.Scene()
      const pm = new THREE.PMREMGenerator(renderer)
      scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture
      scene.environmentIntensity = 0.7
      const DARK = new THREE.Color(0x0f1011), WARM = new THREE.Color(0x16110c)
      scene.background = DARK.clone()
      scene.fog = new THREE.Fog(0x0f1011, 200, 2000)
      const camera = new THREE.PerspectiveCamera(35, 1080 / 1920, 0.5, 20000)
      const hemi = new THREE.HemisphereLight(0xdfe8f0, 0x15171a, 0.7); scene.add(hemi)
      const key = new THREE.DirectionalLight(0xfff6ea, 2.4); key.castShadow = true
      key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02
      scene.add(key); scene.add(key.target)
      const rim = new THREE.DirectionalLight(0xbcd4ff, 1.2); scene.add(rim); scene.add(rim.target)

      // ---------- materials ----------
      const std = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.45, metalness: 0.0 }, o))
      const M = {
        brass: std(0xd4a24a, { roughness: 0.28, metalness: 1 }), brassD: std(0xb8862f, { roughness: 0.35, metalness: 1 }),
        steel: std(0xb7bec6, { roughness: 0.25, metalness: 1 }), nickel: std(0xd9dde2, { roughness: 0.2, metalness: 1 }),
        dark: std(0x24272b, { roughness: 0.5, metalness: 0.3 }), white: std(0xf1f0ec, { roughness: 0.35 }),
        wood: std(0x9a6a3c, { roughness: 0.7 }), woodL: std(0xc49563, { roughness: 0.7 }), door: std(0x2c3a4a, { roughness: 0.5 }),
        red: std(0xe5483a, { emissive: 0xe5483a, emissiveIntensity: 0.35 }), green: std(0x35c46a, { emissive: 0x35c46a, emissiveIntensity: 0.35 }),
      }
      const mesh = (g, m, x = 0, y = 0, z = 0, cast = true) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = cast; o.receiveShadow = true; return o }
      const rx = (o) => { o.rotation.x = Math.PI / 2; return o }
      const fatLine = (color, width, n, parent, dashed = false) => { const g = new LineGeometry(); g.setPositions(new Float32Array(n * 3)); const m = new LineMaterial({ color, linewidth: width, transparent: true, depthWrite: false, dashed, dashSize: 2, gapSize: 1.4 }); m.resolution.set(1080, 1920); const l = new Line2(g, m); l.frustumCulled = false; l.buf = new Float32Array(n * 3); l.n = n; (parent || scene).add(l); return l }
      const setPath = (l, pts) => { for (let i = 0; i < l.n; i++) { const p = pts[Math.min(i, pts.length - 1)]; l.buf[i * 3] = p.x; l.buf[i * 3 + 1] = p.y; l.buf[i * 3 + 2] = p.z } l.geometry.setPositions(l.buf); l.computeLineDistances() }

      // ---------- floor with a fine grid ----------
      const gridTex = (base, line) => { const c = document.createElement("canvas"); c.width = c.height = 512; const g = c.getContext("2d"); g.fillStyle = base; g.fillRect(0, 0, 512, 512); g.strokeStyle = line; g.lineWidth = 2; for (let i = 0; i <= 512; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke() } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t }
      const floorM = std(0xffffff, { map: gridTex("#151719", "#1f2225"), roughness: 0.85 })
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), floorM); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor)
      const setFloor = (cell) => { const r = 40000 / (cell * 8); floorM.map.repeat.set(r, r) }

      // ---------- the « GODZY » signature (stamped / printed on real objects) ----------
      const SIGS = []
      function godzyTex({ color = "#ffffff", bg = null, font = "800 150px Inter, sans-serif", w = 1024, h = 256, border = null } = {}) {
        const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d")
        const draw = () => { g.clearRect(0, 0, w, h); if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h) } if (border) { g.strokeStyle = border; g.lineWidth = 10; g.strokeRect(14, 14, w - 28, h - 28) } g.fillStyle = color; g.font = font; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("GODZY", w / 2, h / 2 + 8) }
        draw(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; SIGS.push(() => { draw(); t.needsUpdate = true }); return t
      }
      const decal = (w, h, tex, o = {}) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), std(0xffffff, Object.assign({ map: tex, transparent: true, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 }, o)))

      // ---------- the pin tumbler lock (mm). Plug axis = z, keyway opens at z = +20 (front). ----------
      const PZ = [-14, -7, 0, 7, 14] // pin chambers along the plug
      const L = [6.5, 4.6, 8.2, 5.4, 7.3] // key pin lengths
      const SHEAR = 7, REST = -3.2, DRV = 6, TOPY = 31
      const H_OK = L.map((l) => SHEAR - l) // tooth heights of the right key
      const H_BAD = H_OK.map((h, i) => (i === 2 ? h + 0.9 : i === 4 ? h - 0.8 : h)) // neighbour's key: pin 3 too high, pin 5 too low
      const cutX = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0)
      const LOCK = new THREE.Group(); scene.add(LOCK)
      // housing: a bored body with a tower of pin chambers (cut in half on the cutaway shots)
      const houseShape = new THREE.Shape(); houseShape.moveTo(-11, -11); houseShape.lineTo(11, -11); houseShape.lineTo(11, 8); houseShape.lineTo(5.5, 13); houseShape.lineTo(5.5, 34); houseShape.lineTo(-5.5, 34); houseShape.lineTo(-5.5, 13); houseShape.lineTo(-11, 8); houseShape.closePath()
      const hole = new THREE.Path(); hole.absarc(0, 0, 8.6, 0, Math.PI * 2, true); houseShape.holes.push(hole)
      const houseG = new THREE.ExtrudeGeometry(houseShape, { depth: 40, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.6, bevelSegments: 2, curveSegments: 48 }); houseG.translate(0, 0, -20)
      const houseM = std(0xc9ced4, { roughness: 0.32, metalness: 1, side: THREE.DoubleSide })
      const houseCutM = houseM.clone(); houseCutM.clippingPlanes = [cutX]
      const housing = mesh(houseG, houseM); LOCK.add(housing)
      // dark inside of the pin chambers (visible through the cut)
      const chamberM = std(0x2a2d31, { roughness: 0.6, metalness: 0.4, side: THREE.BackSide, clippingPlanes: [cutX] })
      PZ.forEach((z) => LOCK.add(mesh(new THREE.CylinderGeometry(1.75, 1.75, 26, 24, 1, true), chamberM, 0, 21, z, false)))
      // face plate with the signature
      const face = mesh(new THREE.CylinderGeometry(10.5, 10.5, 1.6, 64), std(0xd8b25e, { roughness: 0.25, metalness: 1 }), 0, 0, 20.8); rx(face); LOCK.add(face)
      const faceSig = decal(9, 2.25, godzyTex({ color: "#3a2a0e", font: "800 170px Inter, sans-serif" }), { metalness: 0.6, roughness: 0.4 }); faceSig.position.set(0, 6.3, 21.62); LOCK.add(faceSig)
      // the plug (turns with the key): brass cylinder with a keyway
      const PLUG = new THREE.Group(); LOCK.add(PLUG)
      const plugM = std(0xd4a24a, { roughness: 0.28, metalness: 1, side: THREE.DoubleSide, clippingPlanes: [cutX] })
      const plug = mesh(new THREE.CylinderGeometry(8.4, 8.4, 41, 64, 1, true), plugM); rx(plug); PLUG.add(plug)
      const plugFront = mesh(new THREE.CircleGeometry(8.4, 64), std(0xd4a24a, { roughness: 0.28, metalness: 1 }), 0, 0, 21.7); PLUG.add(plugFront)
      const keyway = mesh(new THREE.PlaneGeometry(2.6, 9), std(0x050505, { roughness: 1 }), 0, -0.5, 21.72, false); PLUG.add(keyway)
      const cam = mesh(new THREE.BoxGeometry(3, 12, 4), M.brassD, 0, -8, -22); PLUG.add(cam)
      // shear line (the « frontière »)
      const shear = fatLine(0x3fd6f0, 8, 2, LOCK, true); setPath(shear, [P(0.2, SHEAR, -24), P(0.2, SHEAR, 24)])
      // pin stacks
      const pinG = (len) => { const g = new THREE.CylinderGeometry(1.45, 1.45, len - 1, 24); g.translate(0, (len - 1) / 2 + 1, 0); const tip = new THREE.ConeGeometry(1.45, 1, 24); tip.rotateX(Math.PI); tip.translate(0, 0.5, 0); return [g, tip] }
      class Coil extends THREE.Curve { constructor(r, turns) { super(); this.r = r; this.turns = turns } getPoint(u, o = new THREE.Vector3()) { const a = u * this.turns * Math.PI * 2; return o.set(Math.cos(a) * this.r, u, Math.sin(a) * this.r) } }
      const springG = new THREE.TubeGeometry(new Coil(1.25, 9), 300, 0.22, 6)
      const STACKS = PZ.map((z, i) => {
        const keyPin = new THREE.Group(); const kpM = std(0xd8a84e, { roughness: 0.25, metalness: 1, emissive: 0x000000 }); pinG(L[i]).forEach((g) => keyPin.add(mesh(g, kpM))); keyPin.position.z = z
        const drv = mesh(new THREE.CylinderGeometry(1.45, 1.45, DRV, 24), std(0xc3cad2, { roughness: 0.22, metalness: 1, emissive: 0x000000 })); drv.geometry.translate(0, DRV / 2, 0); drv.position.z = z
        const spring = mesh(springG, M.steel); spring.position.z = z
        LOCK.add(drv); LOCK.add(spring); PLUG.add(keyPin) // key pins turn with the plug
        return { z, keyPin, drv, spring, kpM, drvM: drv.material }
      })
      // keys: blade profile = a top edge with V cuts at the pin positions
      function keyGeo(H, { depthZ = 0 } = {}) {
        const s = new THREE.Shape(); const z0 = -22, z1 = 22
        const top = (z) => { let y = 3.6; H.forEach((h, i) => (y = Math.min(y, h + Math.abs(z - PZ[i]) * 0.95))); if (z < z0 + 4) y = Math.min(y, -3.6 + (z - z0) * 1.6); return y }
        s.moveTo(z0, -4.8); for (let z = z0; z <= z1; z += 0.25) s.lineTo(z, top(z)); s.lineTo(z1, 4.2); s.lineTo(z1 + 1, 4.2); s.lineTo(z1 + 1, -4.8); s.closePath()
        const g = new THREE.ExtrudeGeometry(s, { depth: 2, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 1 }); g.translate(0, 0, -1); g.rotateY(-Math.PI / 2); return { g, top }
      }
      function makeKey(H, color = 0xd9dde2) {
        const grp = new THREE.Group(); const km = std(color, { roughness: 0.2, metalness: 1 })
        const { g, top } = keyGeo(H); grp.add(mesh(g, km)); grp.top = top
        // the bow (head) with the stamped signature
        const bs = new THREE.Shape(); bs.absarc(0, 0, 12, 0, Math.PI * 2, false); const bh = new THREE.Path(); bh.absarc(0, 7, 2.6, 0, Math.PI * 2, true); bs.holes.push(bh)
        const bow = mesh(new THREE.ExtrudeGeometry(bs, { depth: 2.4, bevelEnabled: true, bevelThickness: 0.4, bevelSize: 0.5, bevelSegments: 2, curveSegments: 48 }), km); bow.rotation.y = -Math.PI / 2; bow.position.set(1.2, 0.5, 34); grp.add(bow)
        const sig = decal(13, 3.2, godzyTex({ color: "#4b4f55", font: "800 160px Inter, sans-serif" }), { metalness: 0.5, roughness: 0.35 }); sig.rotation.y = Math.PI / 2; sig.position.set(1.75, -2.2, 34); grp.add(sig)
        grp.add(mesh(new THREE.BoxGeometry(2, 9, 3), km, 0, -0.3, 23.5))
        return grp
      }
      const KEY_OK = makeKey(H_OK), KEY_BAD = makeKey(H_BAD, 0xc9b27a)
      PLUG.add(KEY_OK); PLUG.add(KEY_BAD)
      // the bolt (pêne) pulled by the cam
      const BOLT = new THREE.Group(); BOLT.position.set(0, -20, -24); LOCK.add(BOLT)
      BOLT.add(mesh(new RoundedBoxGeometry(46, 9, 8, 3, 1.2), M.nickel, 22, 0, 0))
      // lock state: key insertion (0..1 → z offset), per-pin heights, plug angle
      const KEYIN = 52 // key starts 52 mm out of the lock
      function pinHeights(keyObj, zOff, active) {
        return PZ.map((z) => { if (!active) return REST; const zk = z - zOff; if (zk < -22 || zk > 22) return REST; return Math.max(REST, keyObj.top(zk)) })
      }
      function setLock({ keyOk = 0, keyBad = 0, zOk = KEYIN, zBad = KEYIN, angle = 0, cut = false, glow = 0, bad = 0, wobble = 0 }) {
        KEY_OK.visible = keyOk > 0; KEY_BAD.visible = keyBad > 0
        KEY_OK.position.z = zOk; KEY_BAD.position.z = zBad
        const ys = keyBad > 0 ? pinHeights(KEY_BAD, zBad, true) : pinHeights(KEY_OK, zOk, keyOk > 0)
        STACKS.forEach((s, i) => {
          const yb = ys[i]; s.keyPin.position.y = yb
          let dTop = yb + L[i]; const dBot = Math.max(dTop, angle > 0.02 ? SHEAR : dTop) // when turning, drivers stay above the shear line
          s.drv.position.y = dBot; const top = dBot + DRV; s.spring.position.y = top; s.spring.scale.y = Math.max(1, TOPY - top)
          const off = Math.abs(dTop - SHEAR) > 0.15
          s.kpM.emissive.setHex(bad && off ? 0xe5483a : glow && !off ? 0x35c46a : 0x000000); s.kpM.emissiveIntensity = (bad && off ? 0.9 : glow && !off ? 0.5 * glow : 0)
        })
        PLUG.rotation.z = -angle + wobble
        BOLT.position.x = -Math.min(1, angle / 1.2) * 18
        housing.material = cut ? houseCutM : houseM; chamberM.visible = cut
        plug.material.clippingPlanes = cut ? [cutX] : []; plug.material.needsUpdate = true
      }

      // ---------- set: a door with the lock (studio) ----------
      const DOOR = new THREE.Group(); scene.add(DOOR)
      DOOR.add(mesh(new RoundedBoxGeometry(820, 2040, 44, 4, 6), M.door, 0, 1020, 0))
      DOOR.add(mesh(new THREE.BoxGeometry(900, 2100, 30), M.white, 0, 1050, -40))
      const plate = decal(170, 48, godzyTex({ color: "#1b1d20", bg: "#d4a24a", font: "800 150px Inter, sans-serif", border: "#7a5a1e" }), { metalness: 0.8, roughness: 0.3 }); plate.position.set(330, 1110, 23); DOOR.add(plate)
      const handle = new THREE.Group(); handle.position.set(330, 1000, 30); DOOR.add(handle)
      handle.add(rx(mesh(new THREE.CylinderGeometry(24, 24, 14, 32), M.nickel, 0, 0, 0))); const lever = mesh(new RoundedBoxGeometry(150, 22, 22, 3, 8), M.nickel, -62, 0, 26); handle.add(lever)
      const doorCyl = rx(mesh(new THREE.CylinderGeometry(17, 17, 10, 48), M.brass, 330, 880, 26)); DOOR.add(doorCyl)
      DOOR.add(mesh(new THREE.BoxGeometry(3, 12, 1), std(0x050505), 330, 880, 31.6, false))
      const doorKey = makeKey(H_OK); doorKey.scale.setScalar(1); DOOR.add(doorKey)
      const doorBolt = mesh(new RoundedBoxGeometry(60, 26, 18, 3, 3), M.nickel, 420, 880, 0); DOOR.add(doorBolt)

      // ---------- set: two keys on the floor ----------
      const KEYS2 = new THREE.Group(); scene.add(KEYS2)
      const k2a = makeKey(H_OK), k2b = makeKey(H_BAD, 0xc9b27a)
      ;[k2a, k2b].forEach((k, i) => { k.rotation.z = Math.PI / 2; k.rotation.y = 0; k.position.set(i ? 16 : -16, 1.2, 0); KEYS2.add(k) })

      // ---------- set: an ancient Egyptian wooden lock ----------
      const EGY = new THREE.Group(); scene.add(EGY)
      EGY.add(mesh(new THREE.BoxGeometry(260, 360, 30), std(0x8a6a48, { roughness: 0.9 }), 0, 180, -40)) // the door planks
      const eBody = mesh(new THREE.BoxGeometry(70, 120, 46), std(0x9a6a3c, { roughness: 0.7, side: THREE.DoubleSide, clippingPlanes: [new THREE.Plane(new THREE.Vector3(0, 0, -1), 8)] }), 0, 200, 0); EGY.add(eBody)
      const eBolt = mesh(new THREE.BoxGeometry(230, 28, 30), M.woodL, -40, 200, 16); EGY.add(eBolt)
      const ePins = [0, 1, 2].map((i) => { const p = mesh(new THREE.CylinderGeometry(5, 5, 40, 16), M.woodL, -18 + i * 18, 222, 16); EGY.add(p); return p })
      const eKey = new THREE.Group(); EGY.add(eKey); eKey.add(mesh(new THREE.BoxGeometry(160, 14, 16), M.woodL, 40, 0, 0)); ;[0, 1, 2].forEach((i) => eKey.add(mesh(new THREE.CylinderGeometry(4, 4, 12, 12), M.woodL, -18 + i * 18 - 40 + 40, 10, 0)))

      // ---------- labels ----------
      const labs = document.getElementById("labs")
      const mk = (cls, html) => { const e = document.createElement("div"); e.className = cls; e.innerHTML = html; labs.appendChild(e); return e }
      const v = new THREE.Vector3()
      const place = (el, wp, op, dx = 0, dy = 0) => { if (op <= 0.01) { el.style.opacity = 0; return } v.copy(wp).project(camera); if (v.z > 1) { el.style.opacity = 0; return } el.style.opacity = op; el.style.transform = `translate(${((v.x + 1) / 2) * 1080 + dx}px, ${((1 - v.y) / 2) * 1920 + dy}px) translate(-50%, -50%)` }
      const LB = {
        mine: mk("lab", "TA CLÉ"), his: mk("lab", "CELLE DU VOISIN"), ok: mk("big sm good", "✓"), no: mk("big sm warm", "✕"),
        cyl: mk("lab", "CYLINDRE"), pins: mk("lab", "GOUPILLES"), bas: mk("lab", "EN BAS"), haut: mk("lab", "EN HAUT"), ress: mk("lab", "RESSORT"),
        front: mk("lab", "LA FRONTIÈRE"), block: mk("big warm", "BLOQUÉ"), dents: mk("lab", "DES DENTS DIFFÉRENTES"), align: mk("big good", "ALIGNÉES"),
        pene: mk("lab", "PÊNE"), mm: mk("big sm warm", "0,3 MM"), egy: mk("lab", "ÉGYPTE · GOUPILLES EN BOIS"), years: mk("big", "≈ 4 000 ANS"), aligne: mk("big sm", "ELLE ALIGNE"),
      }
      const SEL = mk("sel", "<i></i><i></i>")
      const box3 = new THREE.Box3(), corners = Array.from({ length: 8 }, () => new THREE.Vector3())
      function selAround(obj, op, pad = 18) {
        if (op <= 0.01) { SEL.style.opacity = 0; return }
        box3.setFromObject(obj); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
        for (let i = 0; i < 8; i++) { corners[i].set(i & 1 ? box3.max.x : box3.min.x, i & 2 ? box3.max.y : box3.min.y, i & 4 ? box3.max.z : box3.min.z).project(camera); const sx = ((corners[i].x + 1) / 2) * 1080, sy = ((1 - corners[i].y) / 2) * 1920; x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy) }
        SEL.style.opacity = op; SEL.style.left = x0 - pad + "px"; SEL.style.top = y0 - pad + "px"; SEL.style.width = x1 - x0 + 2 * pad + "px"; SEL.style.height = y1 - y0 + 2 * pad + "px"
      }

      // ---------- shots ----------
      const groups = [LOCK, DOOR, KEYS2, EGY]
      // side cutaway camera (looking at the cut face, from +x)
      const side = (u, a, b, f = 34) => ({ p: L3(a[0], b[0], eio(u)), l: L3(a[1], b[1], eio(u)), f })
      const SH = [
        { k: 0, g: [KEYS2], S: 160, fy: 0, cam: (u) => ({ p: L3([0, 190, 120], [0, 172, 104], eio(u)), l: [0, 0, 2], f: 40 }) },
        { k: 10, g: [DOOR], S: 900, fy: 0, cam: (u) => ({ p: L3([560, 1180, 900], [500, 1150, 780], eio(u)), l: [310, 1060, 0], f: 40 }) },
        { k: 20, g: [LOCK], S: 160, fy: -11.6, cam: (u) => ({ p: L3([34, 22, 150], [26, 16, 112], eio(u)), l: [0, 3, 18], f: 36 }), st: { key: "in0" } },
        { k: 27, g: [LOCK], S: 160, fy: -11.6, cam: (u) => ({ p: L3([120, 70, 90], [110, 60, 80], eio(u)), l: [0, 10, 0], f: 36 }), st: { split: 1 } },
        { k: 34, g: [LOCK], S: 160, fy: -11.6, cam: (u) => side(u, [[150, 30, 40], [0, 10, 0]], [[136, 26, 34], [0, 10, 0]]), st: { cut: true, rock: 1 } },
        { k: 45, g: [LOCK], S: 160, fy: -11.6, cam: (u) => side(u, [[140, 34, 8], [0, 16, 0]], [[128, 30, 6], [0, 16, 0]]), st: { cut: true } },
        { k: 57, g: [LOCK], S: 80, fy: -11.6, cam: (u) => side(u, [[74, 22, 4], [0, 16, 0]], [[66, 20, 3], [0, 16, 0]], 36), st: { cut: true, one: 1 } },
        { k: 80, g: [LOCK], S: 160, fy: -11.6, cam: (u) => side(u, [[130, 20, 12], [0, 12, 0]], [[120, 18, 10], [0, 12, 0]]), st: { cut: true, shear: 1, tryTurn: 1 } },
        { k: 98, g: [LOCK], S: 160, fy: -11.6, cam: (u) => side(u, [[110, 6, 22], [0, 6, 6]], [[100, 6, 16], [0, 6, 2]]), st: { cut: true, insert: 1 } },
        { k: 114, g: [LOCK], S: 160, fy: -11.6, cam: (u) => side(u, [[86, 12, 6], [0, 7, 0]], [[76, 10, 4], [0, 7, 0]]), st: { cut: true, keyIn: 1, shear: 1, glow: 1 } },
        { k: 133, g: [LOCK], S: 160, fy: -30, cam: (u) => ({ p: L3([95, 30, 120], [84, 26, 104], eio(u)), l: [8, -6, 8], f: 40 }), st: { keyIn: 1, turn: 1 } },
        { k: 140, g: [DOOR], S: 900, fy: 0, cam: (u) => ({ p: L3([760, 1000, 260], [720, 980, 220], eio(u)), l: [420, 890, 0], f: 36 }), st: { doorOpen: 1 } },
        { k: 148, g: [LOCK], S: 160, fy: -11.6, cam: (u) => side(u, [[100, 10, 14], [0, 7, 0]], [[90, 9, 10], [0, 7, 0]]), st: { cut: true, badKey: 1, shear: 1 } },
        { k: 161, g: [LOCK], S: 80, fy: -11.6, cam: (u) => side(u, [[40, 9, 4], [0, 8, 0]], [[34, 9, 2], [0, 8, 0]], 36), st: { cut: true, badKey: 2, shear: 1 } },
        { k: 171, g: [EGY], S: 900, fy: 0, warm: true, cam: (u) => ({ p: L3([150, 250, 600], [130, 240, 520], eio(u)), l: [20, 170, 0], f: 40 }) },
        { k: 188, g: [LOCK], S: 160, fy: -11.6, cam: (u) => side(u, [[96, 12, 30], [0, 6, 4]], [[86, 10, 24], [0, 6, 2]]), st: { cut: true, keyIn: 1, shear: 1, glow: 1 } },
        { k: 199, g: [DOOR], S: 900, fy: 0, phone: true, cam: (u) => ({ p: L3([560, 1000, 820], [520, 990, 740], u), l: [310, 900, 0], f: 40 }), st: { doorOpen: 2 } },
      ]
      SH.forEach((s, i) => { s.t0 = i === 0 ? 0 : T[s.k] - 0.06; s.t1 = i < SH.length - 1 ? T[SH[i + 1].k] - 0.06 : END + 1 })
      const shotAt = (t) => SH.find((s) => t >= s.t0 && t < s.t1) || SH[SH.length - 1]

      function frame(t) {
        const s = shotAt(t), u = clamp((t - s.t0) / (s.t1 - s.t0)), lt = t - s.t0, st = s.st || {}
        groups.forEach((g) => (g.visible = s.g.includes(g)))
        scene.background.copy(s.warm ? WARM : DARK); scene.fog.color.copy(scene.background); scene.fog.near = s.S * 3; scene.fog.far = s.S * 14
        floor.position.y = s.fy; setFloor(s.S > 1000 ? 200 : s.S > 300 ? 40 : 10)
        const c = s.cam(u, t); camera.position.set(...c.p); camera.fov = c.f; camera.near = s.S / 400; camera.far = s.S * 40; camera.lookAt(...c.l); camera.updateProjectionMatrix(); camera.updateMatrixWorld()
        const tg = P(...c.l); key.target.position.copy(tg); key.position.copy(tg).add(P(0.5, 1.0, 0.8).multiplyScalar(s.S)); const sc = key.shadow.camera; sc.left = sc.bottom = -s.S * 0.6; sc.right = sc.top = s.S * 0.6; sc.near = s.S * 0.01; sc.far = s.S * 4; sc.updateProjectionMatrix()
        rim.target.position.copy(tg); rim.position.copy(tg).add(P(-1, 0.6, -0.8).multiplyScalar(s.S))
        key.color.setHex(s.warm ? 0xffd9a0 : 0xfff6ea)
        Object.values(LB).forEach((e) => (e.style.opacity = 0)); SEL.style.opacity = 0

        // ---- lock state ----
        if (s.g.includes(LOCK)) {
          const o = { cut: !!st.cut }
          if (st.key === "in0") { o.keyOk = 1; o.zOk = KEYIN - 24 * eio(win(t, T[22], T[26] + 0.3)) }
          if (st.split) { o.cut = t > T[29] + 0.1 }
          if (st.rock) o.wobble = 0
          if (st.tryTurn) { const a = win(t, T[95] - 0.1, T[97] + 0.4); o.wobble = -Math.sin(a * Math.PI * 4) * 0.025 * (a > 0 && a < 1 ? 1 : 0) }
          if (st.insert) { o.keyOk = 1; o.zOk = KEYIN * (1 - eio(win(t, T[99] - 0.1, T[101] + 0.9))) }
          if (st.keyIn) { o.keyOk = 1; o.zOk = 0 }
          if (st.glow) o.glow = win(t, T[127], T[128] + 0.2) || (s.k === 188 ? 1 : 0)
          if (st.turn) { o.keyOk = 1; o.zOk = 0; o.angle = eio(win(t, T[137] + 0.1, T[139] + 0.4)) * 1.4 }
          if (st.badKey === 1) { o.keyBad = 1; o.zBad = KEYIN * (1 - eio(win(t, T[148], T[151] + 0.3))); o.bad = t > T[155] ? 1 : 0 }
          if (st.badKey === 2) { o.keyBad = 1; o.zBad = 0; o.bad = 1; const a = win(t, T[167], T[170] + 0.5); o.wobble = -Math.sin(a * Math.PI * 4) * 0.025 * (a > 0 && a < 1 ? 1 : 0) }
          setLock(o)
          shear.visible = !!st.shear || (st.one && false); shear.material.opacity = st.shear ? 0.9 : 0
          LOCK.updateMatrixWorld(true)
          // labels per shot
          if (s.k === 20) place(LB.cyl, P(0, -14, 22), 0)
          if (s.k === 34) { selAround(plug, win(t, T[39] - 0.1, T[39] + 0.15)); place(LB.cyl, P(0, -14, 0), win(t, T[39] - 0.1, T[39] + 0.2)) }
          if (s.k === 45) { place(LB.pins, P(0, 27, 0), win(t, T[56] - 0.1, T[56] + 0.2)); STACKS.forEach((p, i) => { p.kpM.emissive.setHex(0x3fd6f0); p.kpM.emissiveIntensity = 0.35 * win(t, T[56] - 0.1 + i * 0.06, T[56] + 0.2 + i * 0.06) }) }
          if (s.k === 57) { const sp = STACKS[2]; place(LB.bas, P(0, sp.keyPin.position.y + L[2] / 2, 2.5), win(t, T[63], T[64] + 0.1), -120); place(LB.haut, P(0, sp.drv.position.y + 3, 2.5), win(t, T[67], T[68] + 0.1), -120); place(LB.ress, P(0, sp.spring.position.y + 6, 2.5), win(t, T[72], T[73] + 0.1), -120)
            // the spring pushes down: a little press-and-release
            const k = win(t, T[75], T[79]); sp.spring.scale.y *= 1 - 0.18 * Math.sin(k * Math.PI)
            STACKS.forEach((q, i) => { if (i !== 2) { q.kpM.emissive.setHex(0x000000) } }) }
          if (s.k === 80) { place(LB.front, P(0, SHEAR, -8), win(t, T[87], T[88] + 0.1), 0, -46); place(LB.block, P(0, -2, 0), popS(t, T[95] - 0.05, 0.35)) }
          if (s.k === 98) place(LB.dents, P(0, -10, 6), win(t, T[103], T[104] + 0.1))
          if (s.k === 114) place(LB.align, P(0, -9, 0), popS(t, T[128] - 0.05, 0.35))
          if (s.k === 133) place(LB.pene, P(BOLT.position.x + 34, -20, -24), win(t, T[143] - 0.1, T[143] + 0.2), 0, 60)
          if (s.k === 148) place(LB.no, P(0, -12, 0), popS(t, T[155] - 0.05, 0.3))
          if (s.k === 161) { place(LB.mm, P(0, SHEAR + 3, 0), popS(t, T[164] - 0.05, 0.35), 0, -50); place(LB.block, P(0, -3, 0), popS(t, T[169] - 0.05, 0.35)) }
          if (s.k === 188) place(LB.aligne, P(0, -10, 2), popS(t, T[196] - 0.05, 0.35))
        }
        // ---- the two keys ----
        if (s.g.includes(KEYS2)) { place(LB.mine, P(-16, 2, 54), win(t, T[1] - 0.1, T[1] + 0.2)); place(LB.his, P(16, 2, 54), win(t, T[5] - 0.1, T[6] + 0.2)) }
        // ---- the door ----
        if (s.g.includes(DOOR)) {
          const turn = st.doorOpen ? eio(win(t, T[st.doorOpen === 1 ? 141 : 199] - 0.2, T[st.doorOpen === 1 ? 143 : 200] + 0.3)) : eio(win(t, T[13] - 0.2, T[14] + 0.2))
          doorKey.position.set(330, 880, 30); doorKey.rotation.set(0, 0, 0); doorKey.rotation.z = -turn * 1.4; doorKey.scale.setScalar(st.doorOpen === 2 ? 1 : 1)
          doorBolt.position.x = 420 - turn * 46
          DOOR.children[0].rotation.y = 0
          if (s.k === 10) { place(LB.ok, P(330, 880, 40), popS(t, T[14] - 0.05, 0.3), -150); place(LB.no, P(330, 880, 40), popS(t, T[17] - 0.05, 0.3), 150) }
          if (s.k === 140) place(LB.pene, P(440, 880, 0), win(t, T[143] - 0.1, T[143] + 0.2), 0, -90)
        }
        // ---- Egypt ----
        if (s.g.includes(EGY)) {
          const kin = eio(win(t, T[179], T[181])), lift = eio(win(t, T[181], T[183])), slide = eio(win(t, T[185], T[187]))
          eKey.position.set(220 * (1 - kin) - slide * 60, 186 + lift * 12, 16)
          ePins.forEach((p) => (p.position.y = 222 + lift * 14))
          eBolt.position.x = -40 - slide * 60
          place(LB.years, P(20, 200, 40), popS(t, T[176] - 0.05, 0.35), 0, -330); place(LB.egy, P(20, 120, 40), win(t, T[180], T[181] + 0.1), 0, 60)
        }
        renderer.render(scene, camera)
      }
      window.__SHOTS = SH.map((s) => [s.t0, false, !!s.phone])
      window.addEventListener("hf-seek", (e) => frame(e.detail.time))
      document.fonts.load("800 150px Inter").then(() => { SIGS.forEach((f) => f()); frame(window.__hfThreeTime || 0) })
      frame(window.__hfThreeTime || 0)
