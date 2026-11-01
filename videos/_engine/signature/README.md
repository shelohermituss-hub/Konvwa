# Signature « Godzy » dans le décor

Demande du client, sur le modèle de Zack D. Films : le nom **Godzy** apparaît **dans le monde de la vidéo**, sur des objets du décor. Ce n'est pas un filigrane posé par-dessus l'image : on ne peut ni le recadrer ni le flouter sans abîmer la vidéo.

## Règles

- **2 à 4 apparitions par vidéo**, sur des objets différents, lisibles mais discrètes. Jamais au centre de l'action, jamais sur les sous-titres.
- **Le nom seul** : `GODZY` ou `Godzy`. Pas de slogan, pas de lien, pas de QR code, pas de logo d'une autre plateforme (règles TikTok).
- **La signature suit l'objet** : perspective, lumière et mouvement de caméra, comme une vraie inscription.
- **Styles concernés** : STUDIO, 3D, ANIMÉ et couvertures.
  - Pas le style RÉEL (photos d'histoire), qui reste « sans logo ni nom » tant que le client ne dit pas le contraire.
- Les vidéos déjà livrées ne sont pas modifiées, sauf si le client le demande.

## Idées d'emplacements

| Style | Où |
|---|---|
| STUDIO / 3D (Three.js) | flanc d'une machine ou d'une nacelle, affiche au mur, carton, plaque d'immatriculation, maillot d'une figurine, écran de téléphone, panneau de terrain, étiquette d'un objet |
| ANIMÉ (SVG) | enseigne de boutique, titre d'un journal, tranche d'un livre, drapeau, t-shirt, tableau noir, caisse en bois, voile de bateau |
| Couverture | étiquette ou affiche dans l'image (posée en HTML sur la surface, en perspective) |

## Three.js : un décalque sur une surface

```js
// texture « GODZY » (fond transparent) à poser sur une face d'objet
function godzyTex({ color = '#ffffff', bg = null, font = '800 150px Inter, sans-serif', w = 1024, h = 256 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h) }
  g.fillStyle = color; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('GODZY', w / 2, h / 2 + 8)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t
}
// décalque : un plan juste devant la surface (0,01 au-dessus), qui reçoit la lumière
const decal = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.5), new THREE.MeshStandardMaterial({ map: godzyTex(), transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }))
```

Attendre `document.fonts.ready` avant de dessiner la texture, sinon la police de secours est utilisée.

## SVG (style ANIMÉ)

```html
<g transform="translate(x y) rotate(-3)">
  <rect width="220" height="60" rx="6" fill="#2b1d12" />
  <text x="110" y="42" text-anchor="middle" font-family="Bebas Neue" font-size="40" fill="#f3c33c">GODZY</text>
</g>
```
