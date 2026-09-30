// Assembles the Land of Ooo: terrain, the Tree Fort, the kingdoms, props,
// lava, treasures, enemy spawns and the gradient sky.
import * as THREE from "three";
import { Builder } from "./builder.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { toon, noOutline, lavaTexture } from "./toon.js";
import { setGround } from "./physics.js";
import { buildTerrain, groundHeight, biomeIndexAt, BIOMES, P, LAVA, rng, mushroomTrail, lumpyAt, waterInfo, nearCliff } from "./terrain.js";
import { buildFort } from "./fort.js";
import { buildFire, BRAZIERS } from "./kingdoms.js";
import { buildIce, PENGUINS } from "./ice.js";
import { buildCanyon } from "./marceline.js";
import { buildLumpy } from "./lumpy.js";
import { buildCandy } from "./candy.js";
import { buildLair } from "./lair.js";
import { buildColosseum } from "./colosseum.js";
import { buildProps } from "./props.js";
import { buildWater } from "./water.js";
import { buildTemple } from "./temple.js";
import { buildLichCave } from "./lichcave.js";

export function buildWorld(scene) {
  const terrain = buildTerrain();
  scene.add(terrain);
  setGround(groundHeight);

  const B = new Builder(scene);
  const treasures = [], npcs = [], enemies = [], courses = [], sealed = [], citizens = [], ticks = [];
  const W = {
    ground: groundHeight, scene, P,
    treasure: (id, x, y, z) => treasures.push({ id, x, y: y + 1.1, z }),
    npc: (id, x, z, yaw, o = {}) => npcs.push({ id, x, y: o.y ?? groundHeight(x, z), z, yaw, float: !!o.float }),
    // a platform route for the reachability test (debug/testes.js): start {x,z,y?}, points [{x,z,y}],
    // treasure id; { walk: true } for stairs/walkways (the bot walks instead of jumping point to point)
    course: (name, start, points, treasure, o = {}) => courses.push({ name, start, points, treasure, walk: !!o.walk }),
    // a Candy Person (citizens.js): kind + { ring, arc, a, dir, speed } | { line, t, speed } | { x, z, yaw }
    citizen: (kind, spec) => citizens.push({ kind, ...spec }),
    // something that moves every frame (flames, the floating emblem): fn(time, camPos)
    tick: (fn) => ticks.push(fn),
    // an enclosed place (vertical cylinder): with the camera in it, nothing farther than `view` is
    // drawn (view 0: a room you cannot see out of at all; the terrain goes too)
    sealed: (x, z, r, y0, y1, view = 0) => sealed.push({ x, z, r, y0, y1, view }),
  };
  const fort = buildFort(B, W);
  buildCandy(B, W);
  buildIce(B, W);
  buildFire(B, W);
  buildCanyon(B, W);
  buildLumpy(B, W);
  buildLair(W);
  buildColosseum(W);
  buildTemple(B, W);
  buildLichCave(W);

  const { S0, E } = mushroomTrail();
  const excl = [
    { x: P.fort.x, z: P.fort.z + 6, r: 34 },
    { x: P.candy.x, z: P.candy.z, r: 52 },
    { x: P.cupcake.x, z: P.cupcake.z, r: 14 },
    { x: P.ice.x, z: P.ice.z, r: 40 },
    { x: P.icePillars.x, z: P.icePillars.z - 10, r: 18 },
    { x: P.fire.x, z: P.fire.z, r: 28 },
    { x: P.fire.x + 30, z: P.fire.z + 8, r: 7 },
    { x: P.fire.x - 32, z: P.fire.z + 22, r: 7 },
    { x: P.marcy.x, z: P.marcy.z, r: 28 },
    { x: P.lumpy.x, z: P.lumpy.z, r: 22 },
    { x: P.temple.x, z: P.temple.z, r: 17 },
    ...LAVA.map((p) => ({ x: p.x, z: p.z, r: p.r + 4 })),
    ...PENGUINS.map((p) => ({ x: p.x, z: p.z, r: 3 })),
    ...BRAZIERS.map((p) => ({ x: p.x, z: p.z, r: 3 })),
  ];
  for (let t = 0; t <= 1; t += 0.1) excl.push({ x: S0.x + (E.x - S0.x) * t, z: S0.z + (E.z - S0.z) * t, r: 5 });
  // the Candy Kingdom's orange road and the clearing in front of the gate (the Gumball Guardians)
  const aG = Math.atan2(-P.candy.x, -P.candy.z), ck = (d) => ({ x: P.candy.x + Math.sin(aG) * d, z: P.candy.z + Math.cos(aG) * d });
  excl.push({ ...ck(52), r: 16 });
  for (let d = 60; d <= 72; d += 4) excl.push({ ...ck(d), r: 6 });
  buildWater(B, W);
  buildProps(B, W, excl);

  // enemy spawns
  const COUNTS = [5, 6, 6, 6, 6];
  COUNTS.forEach((n, bi) => {
    const r = rng(100 + bi), b = BIOMES[bi];
    let placed = 0;
    for (let t = 0; t < 600 && placed < n; t++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 140;
      const x = b.x + Math.cos(a) * d, z = b.z + Math.sin(a) * d;
      if (biomeIndexAt(x, z) !== bi || Math.hypot(x, z) > 318 || Math.hypot(x - P.spawn.x, z - P.spawn.z) < 50) continue;
      if (excl.some((e) => (x - e.x) ** 2 + (z - e.z) ** 2 < (e.r + 4) ** 2)) continue;
      if (waterInfo(x, z).d < 4 || nearCliff(x, z, 3)) continue;
      enemies.push({ x, z, biome: b.key });
      placed++;
    }
  });

  const drawCalls = B.build();

  // animated lava
  const lavaTex = lavaTexture();
  lavaTex.colorSpace = THREE.SRGBColorSpace;
  lavaTex.repeat.set(3, 3);
  const lavaMat = noOutline(new THREE.MeshBasicMaterial({ map: lavaTex }));
  scene.add(new THREE.Mesh(mergeGeometries(LAVA.map((p) => new THREE.CircleGeometry(p.r + 0.5, 32).rotateX(-Math.PI / 2).translate(p.x, -1.2, p.z))), lavaMat));

  // treasures: gold gems (no beam points at them: the people of Ooo tell Finn where they are)
  const gemGeo = new THREE.OctahedronGeometry(0.55, 0);
  const gemMat = toon(0xffd23f, { emissive: 0x8a6400, flat: true, thick: 0.004 });
  for (const t of treasures) {
    t.mesh = new THREE.Mesh(gemGeo, gemMat);
    t.mesh.position.set(t.x, t.y, t.z);
    scene.add(t.mesh);
  }

  // gradient sky dome
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(470, 32, 16),
    noOutline(new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x3fb0f0) }, bottom: { value: new THREE.Color(0xc4ecff) } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec3 top;\nuniform vec3 bottom;\nvarying vec3 vP;\nvoid main(){\n  float t = smoothstep(-0.05, 0.55, vP.y);\n  gl_FragColor = vec4(mix(bottom, top, t), 1.0);\n  #include <colorspace_fragment>\n}",
    })),
  );
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);

  function update(time, camPos) {
    for (const t of treasures) {
      if (!t.mesh.visible) continue;
      t.mesh.rotation.y = time * 2;
      t.mesh.position.y = t.y + Math.sin(time * 2.5 + t.x) * 0.15;
    }
    lavaTex.offset.set(Math.sin(time * 0.2) * 0.1, time * 0.03);
    for (const f of ticks) f(time, camPos);
    if (camPos) {
      sky.position.copy(camPos);
      const p = camPos;
      state.view = Infinity;
      for (const s of sealed)
        if (p.y > s.y0 && p.y < s.y1 && (p.x - s.x) ** 2 + (p.z - s.z) ** 2 < s.r * s.r) state.view = Math.min(state.view, s.view);
      // up in Lumpy Space the world below is lost in purple fog: don't draw it
      if (lumpyAt(p) > 0.6) state.view = Math.min(state.view, 140);
      state.sealed = state.view === 0;
      B.cull(camPos, state.view);
      terrain.visible = !state.sealed;
    }
  }
  const state = { sealed: false, view: Infinity };
  return { treasures, npcs, enemies, courses, citizens, update, drawCalls, sky, fort, state };
}
