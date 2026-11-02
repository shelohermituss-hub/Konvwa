// La jarre de Zhang Heng (d'après le Livre des Han postérieurs) : un vase de bronze de près de 2 m, couvercle bombé,
// huit dragons tournés vers les huit directions, une bille dans la gueule, et sous chacun un crapaud la bouche ouverte.
// Dedans, une lourde colonne (le mécanisme est perdu : on montre l'hypothèse du pendule, vue en transparence).
// Tout est en volumes simples, peinture mate, que la passe d'encre cerne de noir.
import * as THREE from "three";
import { ctex } from "./paint";

const mat = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, ...o });
const INK = "#1a1418";
/** ceintures décorées du bronze : or, frises de nuages et de spirales à l'encre, patine verte */
const bronzeTex = () => ctex("bronzeJar", 1024, 512, (g) => {
  g.fillStyle = "#d29a3c"; g.fillRect(0, 0, 1024, 512);
  for (const [y, h, c] of [[60, 40, "#3f9c8a"], [200, 26, "#b9792c"], [330, 50, "#3f9c8a"], [440, 24, "#b9792c"]] as const) {
    g.fillStyle = c; g.fillRect(0, y, 1024, h);
    g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.moveTo(0, y + h); g.lineTo(1024, y + h); g.stroke();
  }
  // frises de spirales (motif « nuage » des bronzes Han)
  g.strokeStyle = INK; g.lineWidth = 4;
  for (let x = 0; x < 1024; x += 64) for (const y of [80, 355]) { g.beginPath(); for (let a = 0; a < 9; a += 0.25) { const r = 3 + a * 1.6; g.lineTo(x + 32 + r * Math.cos(a), y + r * Math.sin(a)); } g.stroke(); }
  g.fillStyle = "rgba(255,240,200,0.25)"; g.fillRect(0, 120, 1024, 30);
});
const lidTex = () => ctex("lidJar", 512, 256, (g) => {
  g.fillStyle = "#c98f36"; g.fillRect(0, 0, 512, 256);
  g.strokeStyle = INK; g.lineWidth = 4;
  for (let x = 0; x < 512; x += 64) { g.beginPath(); g.moveTo(x, 256); g.quadraticCurveTo(x + 32, 120, x + 64, 256); g.stroke(); }
  g.fillStyle = "#3f9c8a"; g.fillRect(0, 0, 512, 40); g.strokeRect(0, 0, 512, 40);
});

export type JarState = {
  /** temps (s) où la bille du dragon k touche le fond du crapaud (null = elle reste dans la gueule) */
  land: (number | null)[];
  /** secousse (m) */
  shake: number;
  /** 0 = bronze plein, 1 = vu en transparence (on voit la colonne) */
  xray: number;
  /** inclinaison de la colonne (radians) vers l'angle colDir (degrés, 0 = sud) */
  colTilt: number; colDir: number;
};

const FALL = 0.36; // s : durée de la chute de la bille
export const BALL_R = 1.22, BALL_Y = 1.13, TOAD_R = 1.22, TOAD_Y = 0.36;

export class Jar {
  root = new THREE.Group();
  private body: THREE.Mesh; private bodyMat: THREE.MeshStandardMaterial; private lidMat: THREE.MeshStandardMaterial;
  private balls: THREE.Mesh[] = []; private jaws: THREE.Object3D[] = [];
  private col: THREE.Group;
  constructor(scale = 1) {
    const R = this.root;
    // le vase : profil tourné (socle, panse, épaule, col), couvercle bombé et son bouton
    const prof = [[0, 0.24], [0.62, 0.24], [0.76, 0.34], [0.92, 0.62], [0.99, 0.95], [0.97, 1.28], [0.86, 1.52], [0.74, 1.66], [0.77, 1.7]].map(([r, y]) => new THREE.Vector2(r, y));
    this.bodyMat = mat({ map: bronzeTex(), side: THREE.DoubleSide, transparent: true, metalness: 0.55, roughness: 0.42 });
    this.body = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), this.bodyMat); this.body.castShadow = true; this.body.receiveShadow = true; R.add(this.body);
    const lprof = [[0.8, 1.7], [0.74, 1.82], [0.58, 1.95], [0.36, 2.04], [0.16, 2.08], [0, 2.09]].map(([r, y]) => new THREE.Vector2(r, y));
    this.lidMat = mat({ map: lidTex(), transparent: true, metalness: 0.55, roughness: 0.42 });
    const lid = new THREE.Mesh(new THREE.LatheGeometry(lprof, 64), this.lidMat); lid.castShadow = true; R.add(lid);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 14), mat({ color: "#e8b84a" })); knob.position.y = 2.16; R.add(knob);
    // le socle : un disque bas, et le plateau où sont assis les crapauds
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.62, 1.7, 0.12, 64), mat({ color: "#8a4f2a" })); plinth.position.y = 0.06; plinth.receiveShadow = true; R.add(plinth);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.72, 0.14, 48), mat({ color: "#b9792c" })); foot.position.y = 0.19; R.add(foot);
    const dragonM = mat({ color: "#3a9a78", metalness: 0.35, roughness: 0.5 }), bellyM = mat({ color: "#d9b25a", metalness: 0.6, roughness: 0.35 }), hornM = mat({ color: "#f2e6c4" }), eyeW = mat({ color: "#fffdf4" }), eyeK = mat({ color: INK });
    const ballM = mat({ color: "#f3c84a", metalness: 0.85, roughness: 0.22, emissive: new THREE.Color("#5a3a00"), emissiveIntensity: 0.2 });
    const toadM = mat({ color: "#5f9e64", metalness: 0.35, roughness: 0.5 }), toadD = mat({ color: "#45784a", metalness: 0.35, roughness: 0.55 }), mouthM = mat({ color: "#5a1a22" });
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4, s = Math.sin(a), c = Math.cos(a);
      const g = new THREE.Group(); g.rotation.y = a; R.add(g); // dans g : +z = vers l'extérieur
      // le corps du dragon : un tube qui part du couvercle, descend le long de l'épaule et finit en tête
      const path = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 1.98, 0.42), new THREE.Vector3(0.08, 1.84, 0.78), new THREE.Vector3(-0.06, 1.6, 0.92), new THREE.Vector3(0.04, 1.4, 1.0), new THREE.Vector3(0, 1.27, 1.02)]);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(path, 24, 0.075, 10), dragonM); tube.castShadow = true; g.add(tube);
      // la tête, tournée vers l'extérieur et un peu vers le bas
      const head = new THREE.Group(); head.position.set(0, 1.24, 1.03); head.rotation.x = 0.35; g.add(head);
      const skull = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.2), dragonM); head.add(skull);
      const snout = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.16), dragonM); snout.position.set(0, 0.02, 0.15); head.add(snout);
      const jaw = new THREE.Group(); jaw.position.set(0, -0.06, 0.06); head.add(jaw);
      const jm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.2), bellyM); jm.position.set(0, -0.01, 0.1); jaw.add(jm);
      this.jaws.push(jaw);
      for (const sd of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.16, 8), hornM); horn.position.set(sd * 0.06, 0.13, -0.06); horn.rotation.x = -0.6; head.add(horn);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), eyeW); eye.position.set(sd * 0.085, 0.06, 0.04); head.add(eye);
        const pu = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), eyeK); pu.position.set(sd * 0.11, 0.065, 0.06); head.add(pu);
        const wh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(sd * 0.07, 0.0, 0.2), new THREE.Vector3(sd * 0.16, 0.02, 0.24), new THREE.Vector3(sd * 0.22, -0.06, 0.2)]), 8, 0.008, 5), hornM); head.add(wh);
      }
      // la bille, dans la gueule
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.06, 18, 14), ballM); ball.castShadow = true; R.add(ball);
      ball.position.set(BALL_R * s, BALL_Y, BALL_R * c); this.balls.push(ball);
      // le crapaud, accroupi sur le socle, la bouche grande ouverte vers le haut
      const t = new THREE.Group(); t.position.set(TOAD_R * s, 0.12, TOAD_R * c); t.rotation.y = a; R.add(t);
      const tb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), toadM); tb.scale.set(1, 0.62, 1.1); tb.position.y = 0.11; tb.castShadow = true; t.add(tb);
      for (const sd of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), toadD); leg.scale.set(1, 0.6, 1.4); leg.position.set(sd * 0.17, 0.05, 0.02); t.add(leg);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), eyeW); eye.position.set(sd * 0.09, 0.27, 0.07); t.add(eye);
        const pu = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), eyeK); pu.position.set(sd * 0.1, 0.29, 0.11); t.add(pu);
      }
      const mouth = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.05, 20), mouthM); mouth.position.set(0, 0.23, -0.01); t.add(mouth);
      const lip = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 8, 24), toadM); lip.rotation.x = Math.PI / 2; lip.position.set(0, 0.255, -0.01); t.add(lip);
    }
    // dedans : la lourde colonne (pendule) et ses huit glissières, visibles seulement en transparence
    this.col = new THREE.Group(); this.col.position.y = 0.3; R.add(this.col);
    const colM = mat({ color: "#d8352f" });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 1.15, 20), colM); shaft.position.y = 0.6; this.col.add(shaft);
    const weight = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 16), colM); weight.position.y = 1.18; this.col.add(weight);
    for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.7), mat({ color: "#f2e6c4" })); rail.position.set(0.5 * Math.sin(a), 1.12, 0.5 * Math.cos(a)); rail.rotation.y = a; R.add(rail); rail.userData.xray = true; }
    this.col.visible = false;
    R.scale.setScalar(scale);
  }
  /** pose la jarre au temps t */
  update(t: number, s: JarState) {
    const shake = s.shake;
    this.root.rotation.z = shake ? shake * Math.sin(t * 61) : 0;
    this.root.rotation.x = shake ? shake * Math.sin(t * 53 + 1) : 0;
    // transparence : le bronze devient une coque claire, la colonne apparaît
    const x = s.xray;
    this.bodyMat.opacity = 1 - 0.78 * x; this.lidMat.opacity = 1 - 0.7 * x;
    this.bodyMat.depthWrite = x < 0.05; this.lidMat.depthWrite = x < 0.05;
    this.col.visible = x > 0.05;
    this.root.traverse((o) => { if (o.userData.xray) o.visible = x > 0.05; });
    const d = (s.colDir * Math.PI) / 180;
    this.col.rotation.set(s.colTilt * Math.cos(d), 0, -s.colTilt * Math.sin(d));
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4, sn = Math.sin(a), cs = Math.cos(a), b = this.balls[k], L = s.land[k];
      let y = BALL_Y, r = BALL_R, open = 0;
      if (L !== null && t > L - FALL - 0.12) {
        open = Math.min(1, (t - (L - FALL - 0.12)) / 0.12);
        const u = Math.max(0, t - (L - FALL));
        if (t < L) { y = BALL_Y - (BALL_Y - TOAD_Y) * (u / FALL) ** 2; r = BALL_R; }
        else { // rebond dans la gueule du crapaud, puis repos
          const v = t - L; y = TOAD_Y + 0.06 * Math.abs(Math.sin(v * 14)) * Math.exp(-v * 7); r = TOAD_R;
        }
      }
      b.position.set(r * sn, y, r * cs);
      this.jaws[k].rotation.x = 0.55 * open;
    }
  }
}
