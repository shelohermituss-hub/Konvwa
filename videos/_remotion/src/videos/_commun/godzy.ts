// Signature « Godzy » dans le décor du style ANIMÉ (règle du client, videos/_engine/signature/README.md) :
// une enseigne peinte à la main, dans l'esprit du monde (encre prune, lettres pleines), à poser sur une façade,
// un drapeau, un maillot ou une caisse. 2 à 4 apparitions par vidéo, jamais au centre de l'action.
// Le skill l'a appris à ses dépens : une enseigne éclairée de côté devient grise et illisible, d'où un matériau
// non éclairé (MeshBasicMaterial) pour la face peinte.
import * as THREE from "three";

export type GodzyOpts = { w?: number; h?: number; bg?: string | null; ink?: string; fill?: string; border?: boolean; tilt?: number };

/** texture « GODZY » peinte (Canvas2D) : fond crème, lettres rouges cernées d'encre prune */
export const godzyTexture = ({ w = 1024, h = 320, bg = "#f2d58a", ink = "#241726", fill = "#c8402e", border = true, tilt = -0.02 }: GodzyOpts = {}) => {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h) }
  if (border) { g.lineWidth = h * 0.055; g.strokeStyle = ink; g.strokeRect(h * 0.05, h * 0.05, w - h * 0.1, h - h * 0.1) }
  g.save(); g.translate(w / 2, h / 2 + h * 0.03); g.rotate(tilt)
  g.font = `900 ${Math.round(h * 0.6)}px "Arial Black", "Helvetica Neue", Arial, sans-serif`
  g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round"
  g.lineWidth = h * 0.075; g.strokeStyle = ink; g.strokeText("GODZY", 0, 0)
  g.fillStyle = fill; g.fillText("GODZY", 0, 0)
  g.restore()
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
  return t
}

/** panneau « GODZY » de `widthM` mètres (rapport w/h de la texture), face non éclairée, prêt à placer dans le monde */
export const godzySign = (widthM: number, opts: GodzyOpts = {}) => {
  const w = opts.w ?? 1024, h = opts.h ?? 320
  const tex = godzyTexture(opts)
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: opts.bg === null, toneMapped: false })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(widthM, (widthM * h) / w), mat)
  mesh.name = "godzy"
  return mesh
}

/** à appeler une fois les polices chargées (document.fonts.ready) si la police du panneau vient d'un fichier */
export const redrawGodzy = (mesh: THREE.Mesh, opts: GodzyOpts = {}) => {
  const mat = mesh.material as THREE.MeshBasicMaterial
  mat.map?.dispose(); mat.map = godzyTexture(opts); mat.needsUpdate = true
}
