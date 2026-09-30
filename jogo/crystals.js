// The boss crystals (the player knows them as diamonds: "Diamante de Gelo"...; the golden "cristais"
// of the game are the treasures): each boss leaves one the first time he's beaten, floating round his prize.
// Owning one is read from the save like the boss hearts (save.ice / save.mint / save.fire .wins > 0),
// so a crystal is never lost. They chain the bosses (the Peppermint Butler only asks a hero with the
// Ice Crystal, Flame Princess one with the Night Crystal) and all three open the Temple of the
// Enchiridion (temple.js).
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { toon } from "./toon.js";

// id = the save key of the boss's quest; in the order the bosses are fought
export const CRYSTALS = [
  { id: "ice", color: 0x8fe8ff, emissive: 0x1a5a8a },
  { id: "mint", color: 0xc98cff, emissive: 0x4a1a8a },
  { id: "fire", color: 0xff8a3a, emissive: 0x9a2a00 },
];
export const hasCrystal = (save, id) => (save[id]?.wins || 0) > 0;
export const crystalCount = (save) => CRYSTALS.filter((c) => hasCrystal(save, c.id)).length;

let geo = null;
/** A cut diamond: a flat-topped crown over a pointed pavilion (about 0.8 tall, centred). */
function crystalGeo() {
  if (geo) return geo;
  const crown = new THREE.CylinderGeometry(0.24, 0.4, 0.2, 8).translate(0, 0.2, 0);
  const pavilion = new THREE.ConeGeometry(0.4, 0.55, 8).rotateX(Math.PI).translate(0, -0.175, 0);
  geo = mergeGeometries([crown, pavilion]);
  geo.computeVertexNormals();
  return geo;
}
/** A crystal (one mesh, one material per kind). */
export function makeCrystal(id) {
  const c = CRYSTALS.find((k) => k.id === id);
  return new THREE.Mesh(crystalGeo(), toon(c.color, { emissive: c.emissive, flat: true, thick: 0.004 }));
}
/** Circling a boss's prize floating at (x, y, z). */
export function orbitCrystal(m, x, y, z, t, r = 1.3) {
  m.position.set(x + Math.sin(t * 1.4) * r, y + 0.35 + Math.sin(t * 3.1) * 0.15, z + Math.cos(t * 1.4) * r);
  m.rotation.y = -t * 2.4;
}
