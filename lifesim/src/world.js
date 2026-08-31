// Every decision gets its own level, and every level gets its own 3D scene.
// These builders assemble a level out of low-poly parts, seeded so the same
// decision always looks the same.

import * as THREE from '../vendor/three.module.js';
import {
  makePerson, makeBigToy, makeBall, makeTree, makeBuilding, makeGoal,
  makeSpeaker, makeMonitor, makeMic, makeBed,
  makeSofa, makeArmchair, makeMattress, makeTv, makeLowTable, makeCrate, makeRug,
  makeBulb, makeShadeLamp, makeChandelier, makeFloorLamp, makePiano, makeFireplace,
  makeArt, makePicture, makePlant, makeIndoorTree, makeBookshelf, makeStairs,
  makeSculpture, makeClutter, makeBucket, makeDampPatches,
} from './actors.js';
import { homeStyle, DEFAULT_STYLE } from './content/homes.js';

const M = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });

function groundPlane(colour, size = 90) {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 1, 1), M(colour));
  g.rotation.x = -Math.PI / 2;
  g.receiveShadow = true;
  return g;
}

// A dollhouse room: four walls whose normals point inward, so the wall between
// you and the room is back-face culled and you always get to look in.
function floorRoom(rng, { floor = 0xb08a5f, wall = 0xe8e2d6, w = 9, d = 9, h = 3.2, hole = null } = {}) {
  const g = new THREE.Group();

  const skirt = new THREE.Mesh(new THREE.PlaneGeometry(w + 3, d + 3), M(0x1e222b));
  skirt.rotation.x = -Math.PI / 2;
  skirt.position.y = hole ? -(hole.depth || 1.6) - 0.4 : -0.05;
  g.add(skirt);

  // A hole means a real hole: the floor is triangulated round it, rather than
  // something being laid on top and fighting it for the same plane.
  let floorGeo;
  if (hole) {
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, -d / 2);
    shape.lineTo(w / 2, -d / 2);
    shape.lineTo(w / 2, d / 2);
    shape.lineTo(-w / 2, d / 2);
    shape.closePath();
    // Laying the shape flat maps shape Y to world -Z, and the hole is wound
    // the opposite way round to the outline.
    const hx = hole.x || 0;
    const hy = -(hole.z || 0);
    const cut = new THREE.Path();
    cut.moveTo(hx - hole.w / 2, hy - hole.d / 2);
    cut.lineTo(hx - hole.w / 2, hy + hole.d / 2);
    cut.lineTo(hx + hole.w / 2, hy + hole.d / 2);
    cut.lineTo(hx + hole.w / 2, hy - hole.d / 2);
    cut.closePath();
    shape.holes.push(cut);
    floorGeo = new THREE.ShapeGeometry(shape);
  } else {
    floorGeo = new THREE.PlaneGeometry(w, d);
  }
  const f = new THREE.Mesh(floorGeo, M(floor));
  f.rotation.x = -Math.PI / 2;
  f.receiveShadow = true;
  g.add(f);

  const wallMat = M(wall);
  const walls = [
    { geo: [w, h], pos: [0, h / 2, -d / 2], rot: 0 },
    { geo: [w, h], pos: [0, h / 2, d / 2], rot: Math.PI },
    { geo: [d, h], pos: [-w / 2, h / 2, 0], rot: Math.PI / 2 },
    { geo: [d, h], pos: [w / 2, h / 2, 0], rot: -Math.PI / 2 },
  ];
  for (const cfg of walls) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(cfg.geo[0], cfg.geo[1]), wallMat);
    m.position.set(...cfg.pos);
    m.rotation.y = cfg.rot;
    m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

function scatterTrees(g, rng, n, radius, inner = 8) {
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const r = inner + rng() * (radius - inner);
    const t = makeTree(rng, 0.8 + rng() * 0.7);
    t.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    g.add(t);
  }
}

// Footprints people must not stand inside: [centreX, centreZ, halfW, halfD].
function blocked(x, z, boxes) {
  return boxes.some(([bx, bz, hw, hd]) => Math.abs(x - bx) < hw && Math.abs(z - bz) < hd);
}

function crowd(g, rng, people, opts = {}) {
  const { radius = 4, y = 0, spread = Math.PI * 2, offset = 0, avoid = [], bounds = null } = opts;
  people.forEach((p, i) => {
    const baseA = offset + (i / Math.max(1, people.length)) * spread + (rng() - 0.5) * 0.3;
    const baseR = radius * (0.75 + rng() * 0.5);

    // Walk round and out from the intended spot until clear of the furniture
    // and still inside the room. Without this people end up inside the sofa
    // with only their heads showing.
    let x = Math.cos(baseA) * baseR;
    let z = Math.sin(baseA) * baseR;
    for (let k = 1; k <= 18; k++) {
      const inRoom = !bounds || (Math.abs(x) < bounds[0] && Math.abs(z) < bounds[1]);
      if (inRoom && !blocked(x, z, avoid)) break;
      const a = baseA + k * 0.4;
      const r = baseR * (1 + (k % 4) * 0.16);
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
    }

    const person = makePerson({ colour: p.colour, height: p.height || 1.7 });
    person.position.set(x, y, z);
    person.userData.baseY = y;
    // Face roughly into the middle of the scene.
    person.rotation.y = Math.atan2(-x, -z);
    g.add(person);
  });
}

// ---------------------------------------------------------------------------

const BUILDERS = {
  nursery(g, rng, ctx) {
    const st = homeStyle(ctx.homeTier || DEFAULT_STYLE);
    const w = Math.min(st.room.w * 0.78, 10);
    const d = Math.min(st.room.d * 0.8, 9);
    const h = st.room.h;
    const rough = st.extras.includes('damp');
    g.add(floorRoom(rng, { floor: st.floor, wall: rough ? st.wall : 0xf2e6ef, w, d, h }));

    if (rough) {
      // A drawer out of a chest, on the floor, with a blanket in it.
      const box = new THREE.Mesh(new THREE.BoxGeometry(1, 0.34, 0.62), M(0x8a7350));
      box.position.set(-w * 0.2, 0.17, -d * 0.2);
      box.castShadow = true;
      g.add(box);
      const blanket = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.1, 0.5), M(0x6b5f7a));
      blanket.position.set(-w * 0.2, 0.35, -d * 0.2);
      g.add(blanket);
      const patches = makeDampPatches(rng, { w, h, n: 6 });
      patches.position.set(0, 0, -d / 2 + 0.03);
      g.add(patches);
      const junk = makeClutter(rng, 5);
      junk.position.set(w * 0.18, 0, d * 0.12);
      g.add(junk);
      const bulb = makeBulb();
      bulb.position.set(0, h, 0);
      g.add(bulb);
    } else {
      const cot = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.7, 0.9), M(0xf7f3ea));
      cot.position.set(-w * 0.15, 0.35, -d * 0.2);
      cot.castShadow = true;
      g.add(cot);
      for (let i = 0; i < 8; i++) {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), M(0xe4dccb));
        bar.position.set(-w * 0.15 - 0.65 + i * 0.19, 0.95, -d * 0.2 + 0.42);
        g.add(bar);
      }
      if (st.extras.includes('chandelier')) {
        const ch = makeChandelier();
        ch.position.set(0, h, 0);
        g.add(ch);
      }
    }

    // Dad's speakers are in every version of this room.
    const sp = makeSpeaker(1.1);
    sp.position.set(w * 0.3, 0, -d * 0.3);
    g.add(sp);
    const sp2 = makeSpeaker(1.1);
    sp2.position.set(-w * 0.4, 0, d * 0.05);
    g.add(sp2);

    for (let i = 0; i < 12; i++) {
      const note = new THREE.Mesh(new THREE.TetrahedronGeometry(0.1),
        new THREE.MeshBasicMaterial({ color: 0xa78bfa }));
      note.position.set((rng() - 0.5) * (w - 2), 1 + rng() * (h - 1.2), (rng() - 0.5) * (d - 2));
      g.add(note);
    }

    const back = Math.max(5.2, w * 0.7);
    return {
      camera: [back, Math.max(3.6, h * 1.2), back * 1.2],
      target: [-0.3, Math.min(0.9, h * 0.28), -d * 0.1],
      interior: true,
      ambient: st.ambient,
    };
  },

  home(g, rng, ctx) {
    const st = homeStyle(ctx.homeTier || DEFAULT_STYLE);
    const { w, d, h } = st.room;
    g.add(floorRoom(rng, { floor: st.floor, wall: st.wall, w, d, h }));

    const avoid = [];
    const backZ = -d / 2;
    const put = (obj, x, z, ry = 0, box = null) => {
      obj.position.set(x, obj.position.y || 0, z);
      obj.rotation.y = ry;
      g.add(obj);
      if (box) avoid.push([x, z, box[0], box[1]]);
      return obj;
    };

    // ------------------------------------------------------------ seating
    const seat = st.seat;
    if (seat.kind === 'mattress') {
      put(makeMattress(seat.colour), -w * 0.2, backZ + 1.1, 0.15, [1.2, 0.9]);
    } else {
      const sofa = makeSofa({
        w: seat.w, colour: seat.colour, worn: seat.worn, sectional: seat.kind === 'sectional',
      });
      put(sofa, 0, backZ + 1.2, 0, [seat.w / 2 + 0.35, 1.1]);
      if (seat.armchair) {
        put(makeArmchair(seat.colour), -seat.w / 2 - 1.2, backZ + 2.6, 0.9, [0.75, 0.75]);
        put(makeArmchair(seat.colour), seat.w / 2 + 1.2, backZ + 2.6, -0.9, [0.75, 0.75]);
      }
      if (seat.second) {
        put(makeSofa({ w: seat.w * 0.7, colour: seat.colour }), -w * 0.26, 2.2, Math.PI,
          [seat.w * 0.4, 1.1]);
      }
    }

    // ---------------------------------------------------------------- tv
    if (st.tv) {
      const tv = makeTv({ w: st.tv.w, wall: st.tv.w > 2.4 });
      if (st.tv.w > 2.4) tv.position.y = 1.9;
      put(tv, 0, backZ + 0.25, 0, [st.tv.w / 2, 0.5]);
    }

    // ------------------------------------------------------------- table
    if (st.table) {
      if (st.table.kind === 'crate') {
        put(makeCrate(st.table.colour), -w * 0.2, backZ + 2.4, 0.3, [0.45, 0.4]);
      } else {
        put(makeLowTable({ w: st.table.w, colour: st.table.colour }), 0, backZ + 3, 0,
          [st.table.w / 2 + 0.2, st.table.w * 0.35]);
      }
    }

    // ------------------------------------------------------------ extras
    let artCount = 0;
    let plantCount = 0;
    let chandelierCount = 0;
    for (const extra of st.extras) {
      switch (extra) {
        case 'damp': {
          const patches = makeDampPatches(rng, { w, h });
          patches.position.set(0, 0, backZ + 0.03);
          g.add(patches);
          const side = makeDampPatches(rng, { w: d, h, n: 4 });
          side.position.set(-w / 2 + 0.03, 0, 0);
          side.rotation.y = Math.PI / 2;
          g.add(side);
          break;
        }
        case 'clutter': {
          const junk = makeClutter(rng, 6);
          junk.position.set((rng() - 0.5) * w * 0.4, 0, 1 + rng() * 1.5);
          g.add(junk);
          break;
        }
        case 'bucket':
          put(makeBucket(), w * 0.28, backZ + 1.6, 0, [0.25, 0.25]);
          break;
        case 'bulb': {
          const bulb = makeBulb();
          bulb.position.set(0, h, 0);
          g.add(bulb);
          break;
        }
        case 'shade':
          put(makeShadeLamp(), -w / 2 + 0.8, backZ + 1.4, 0, [0.4, 0.4]);
          break;
        case 'floorlamp':
          put(makeFloorLamp(), w / 2 - 1, backZ + 1.6, 0, [0.35, 0.35]);
          break;
        case 'chandelier': {
          const ch = makeChandelier();
          ch.position.set(chandelierCount === 0 ? -w * 0.12 : w * 0.22, h, chandelierCount === 0 ? -d * 0.1 : 2.2);
          g.add(ch);
          chandelierCount++;
          break;
        }
        case 'rug': {
          const rug = makeRug(rng, {
            w: Math.min(w - 2, 4.5), d: Math.min(d - 3, 3), colour: 0x7a4a3c,
          });
          rug.position.set(0, 0.015, backZ + 3);
          g.add(rug);
          break;
        }
        case 'speaker':
          put(makeSpeaker(1), w / 2 - 0.9, backZ + 0.7, 0, [0.4, 0.4]);
          break;
        case 'picture': {
          const pic = makePicture(rng);
          pic.position.set(-w * 0.3 + artCount * 0.9, h * 0.62, backZ + 0.06);
          g.add(pic);
          artCount++;
          break;
        }
        case 'art': {
          const art = makeArt(rng, { w: 1.3, h: 1 });
          art.position.set(-w * 0.32 + artCount * 1.9, h * 0.6, backZ + 0.06);
          g.add(art);
          artCount++;
          break;
        }
        case 'plant':
          put(makePlant(1), plantCount === 0 ? -w / 2 + 0.7 : w / 2 - 0.7, backZ + 0.9 + plantCount * 1.4,
            0, [0.35, 0.35]);
          plantCount++;
          break;
        case 'tree':
          put(makeIndoorTree(), -w / 2 + 1.4, 2.2, 0, [0.9, 0.9]);
          break;
        case 'bookshelf':
          put(makeBookshelf(), -w / 2 + 0.9, backZ + 2.6, Math.PI / 2, [0.5, 0.8]);
          break;
        case 'fireplace': {
          const fp = makeFireplace();
          put(fp, -w * 0.32, backZ + 0.2, 0, [1.3, 0.4]);
          break;
        }
        case 'piano':
          put(makePiano(), w * 0.3, 1.9, -0.5, [1.5, 2]);
          break;
        case 'stairs':
          put(makeStairs(), -w / 2 + 1.5, d / 2 - 3.6, Math.PI / 2, [1.9, 1.1]);
          break;
        case 'sculpture':
          put(makeSculpture(rng), -w * 0.34, 2.6, 0, [0.45, 0.45]);
          break;
        case 'glass': {
          const glass = new THREE.Mesh(new THREE.PlaneGeometry(w - 2, h - 0.6),
            new THREE.MeshLambertMaterial({ color: 0x9fd0e8, transparent: true, opacity: 0.32 }));
          glass.position.set(0, h / 2, d / 2 - 0.04);
          glass.rotation.y = Math.PI;
          g.add(glass);
          break;
        }
        default:
          break;
      }
    }

    crowd(g, rng, ctx.people.slice(0, 5), {
      radius: Math.min(w, d) * 0.32,
      spread: Math.PI * 0.9,
      offset: Math.PI * 0.15,
      avoid,
      bounds: [w / 2 - 0.7, d / 2 - 0.7],
    });

    const back = Math.max(6.4, w * 0.62);
    return {
      camera: [back, Math.max(4.2, h * 1.25), back * 1.12],
      target: [0, Math.min(1.4, h * 0.3), -d * 0.12],
      interior: true,
      ambient: st.ambient,
    };
  },

  bedroom(g, rng, ctx) {
    const st = homeStyle(ctx.homeTier || DEFAULT_STYLE);
    const w = Math.min(st.room.w * 0.7, 11);
    const d = Math.min(st.room.d * 0.72, 9);
    const h = st.room.h;
    g.add(floorRoom(rng, { floor: st.floor, wall: st.wall, w, d, h }));

    const poor = st.extras.includes('damp') || st.seat.kind === 'mattress';
    if (poor) {
      const mattress = makeMattress(0x8a8175);
      mattress.position.set(-w / 4, 0, -d / 4);
      mattress.rotation.y = Math.PI / 2;
      g.add(mattress);
      const patches = makeDampPatches(rng, { w, h, n: 5 });
      patches.position.set(0, 0, -d / 2 + 0.03);
      g.add(patches);
      const junk = makeClutter(rng, 5);
      junk.position.set(w * 0.15, 0, d * 0.1);
      g.add(junk);
      const bulb = makeBulb();
      bulb.position.set(0, h, 0);
      g.add(bulb);
    } else {
      const bed = makeBed();
      bed.position.set(-w / 4, 0, -d / 5);
      bed.rotation.y = Math.PI / 2;
      g.add(bed);
      const desk = makeMonitor();
      desk.position.set(w / 2 - 1.4, 0, -d / 2 + 1.4);
      desk.rotation.y = -0.35;
      g.add(desk);
    }

    if (st.extras.includes('art')) {
      const art = makeArt(rng, { w: 1, h: 0.8 });
      art.position.set(w * 0.15, h * 0.6, -d / 2 + 0.06);
      g.add(art);
    } else if (!poor) {
      const poster = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.4), M(0x2b2b3a));
      poster.position.set(w * 0.1, h * 0.6, -d / 2 + 0.05);
      g.add(poster);
    }
    if (st.extras.includes('chandelier')) {
      const ch = makeChandelier();
      ch.position.set(0, h, 0);
      g.add(ch);
    }

    const f = ctx.flags || {};
    if (f.mario_friend || f.mario_teammate || f.mario_audience) {
      if (!f.mario_loft || f.mario_returns || f.mario_forever || f.mario_moves_in) {
        const toy = makeBigToy(1);
        toy.position.set(w / 2 - 1.2, 0, d / 2 - 1.6);
        toy.rotation.y = -0.9;
        g.add(toy);
      }
    }

    const back = Math.max(5, w * 0.72);
    return {
      camera: [back, Math.max(3.4, h * 1.1), back * 1.15],
      target: [0, Math.min(1, h * 0.28), -d * 0.1],
      interior: true,
      ambient: st.ambient,
    };
  },

  loft(g, rng, ctx) {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), M(0x6a5540));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    g.add(floor);

    // Rafters overhead, high enough to frame the space without hiding it.
    for (let i = -3; i <= 3; i++) {
      if (i === 0 || i === 1) continue; // leave a clear window over him
      const rafter = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 8.6), M(0x4a3c2b));
      rafter.position.set(i * 1.5, 4.1 - Math.abs(i) * 0.16, 0);
      g.add(rafter);
    }
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.18, 0.18), M(0x4a3c2b));
    ridge.position.set(0, 4.4, 0);
    g.add(ridge);

    // Boxes pushed out to the edges so the middle stays clear.
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rng() * 0.4;
      const r = 3 + rng() * 1.6;
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.7 + rng() * 0.5, 0.5 + rng() * 0.45, 0.6 + rng() * 0.4),
        M(rng() < 0.5 ? 0xb08a5f : 0x9c7a4e));
      box.position.set(Math.cos(a) * r, 0.3, Math.sin(a) * r);
      box.rotation.y = rng() * 0.8;
      box.castShadow = true;
      g.add(box);
    }

    const toy = makeBigToy(1.15);
    toy.position.set(0, 0, -0.2);
    toy.rotation.y = 0.35;
    g.add(toy);

    // The torch beam: a spotlight plus a visible cone, aimed at him.
    const aim = new THREE.Object3D();
    aim.position.set(0, 0.6, -0.2);
    g.add(aim);
    const beam = new THREE.SpotLight(0xfff0c4, 90, 18, 0.34, 0.55, 1.4);
    beam.position.set(-2.6, 3.1, 3.4);
    beam.target = aim;
    beam.castShadow = true;
    g.add(beam);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.85, 4.6, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff0c4, transparent: true, opacity: 0.045, side: THREE.DoubleSide }));
    cone.position.set(-1.3, 1.85, 1.6);
    cone.lookAt(0, 0.6, -0.2);
    cone.rotateX(Math.PI / 2);
    g.add(cone);

    // A little warm bounce so he is never a silhouette.
    const bounce = new THREE.PointLight(0xffd9a0, 14, 7, 2);
    bounce.position.set(0.6, 1.5, 1);
    g.add(bounce);

    return {
      camera: [4.4, 4.4, 6.2], target: [0, 0.75, -0.2],
      dark: true, sky: 0x14141e, fog: 0x14141e, interior: true,
    };
  },

  garden(g, rng, ctx) {
    const st = homeStyle(ctx.homeTier || DEFAULT_STYLE);
    const out = st.outside;
    g.add(groundPlane(0x6fa858));
    scatterTrees(g, rng, 9, 22, 6);
    const house = makeBuilding(rng, {
      w: out.w, d: out.d, h: out.h, wall: out.wall, roof: out.roof, pitched: out.pitched,
    });
    house.position.set(0, 0, -11 - out.d * 0.25);
    g.add(house);
    dressOutside(g, rng, out, -11 - out.d * 0.25);
    const ball = makeBall();
    ball.position.set(1.4, 0.12, 1.2);
    ball.userData.baseY = 0.12;
    g.add(ball);
    // A slide the right way up: ladder and platform at the back, the chute
    // sloping down to meet the grass at the front.
    const slide = new THREE.Group();
    const topY = 1.5;
    const platform = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.7), M(0xe0c44a));
    platform.position.set(0, topY, -1.25);
    platform.castShadow = true;
    slide.add(platform);
    for (const x of [-0.38, 0.38]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, topY, 6), M(0x3f7fb5));
      leg.position.set(x, topY / 2, -1.25);
      slide.add(leg);
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, topY * 0.8, 6), M(0x3f7fb5));
      rail.position.set(x, topY + 0.4, -1.6);
      slide.add(rail);
    }
    for (let i = 0; i < 4; i++) {
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.76, 6), M(0xe0c44a));
      rung.rotation.z = Math.PI / 2;
      rung.position.set(0, 0.32 + i * 0.36, -1.62);
      slide.add(rung);
    }
    // Chute from the platform lip down to the ground.
    const run = 2.4;
    const chute = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.07, Math.hypot(run, topY)), M(0xd94f4f));
    chute.position.set(0, topY / 2, -0.9 + run / 2);
    chute.rotation.x = Math.atan2(topY, run);
    chute.castShadow = true;
    slide.add(chute);
    for (const x of [-0.42, 0.42]) {
      const kerb = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, Math.hypot(run, topY)), M(0xb83f3f));
      kerb.position.set(x, topY / 2 + 0.09, -0.9 + run / 2);
      kerb.rotation.x = Math.atan2(topY, run);
      slide.add(kerb);
    }
    slide.position.set(-3.6, 0, -1.8);
    slide.rotation.y = 0.35;
    g.add(slide);
    crowd(g, rng, ctx.people.slice(0, 5), {
      radius: 4.5, spread: Math.PI * 1.2, offset: Math.PI * 0.9,
      avoid: [[-3.4, -1.5, 1.1, 1.9], [0, -11, 4, 3.4]],
    });
    return { camera: [6, 3.6, 7.5], target: [-0.5, 1, -1] };
  },

  village(g, rng, ctx) {
    g.add(groundPlane(0x6fa858, 140));
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rng() * 0.3;
      const r = 14 + rng() * 12;
      const b = makeBuilding(rng, { wall: rng() < 0.5 ? 0xdcd2bf : 0xc9b89d, roof: 0x7d4235 });
      b.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      b.rotation.y = rng() * Math.PI;
      g.add(b);
    }
    const church = new THREE.Group();
    const nave = makeBuilding(rng, { w: 6, d: 10, h: 5, wall: 0xcfc6b4, roof: 0x5c5750, windows: false });
    church.add(nave);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(3, 11, 3), M(0xc4bba9));
    tower.position.set(0, 5.5, -5.5);
    tower.castShadow = true;
    church.add(tower);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(2.2, 3.4, 4), M(0x5c5750));
    spire.position.set(0, 12.6, -5.5);
    spire.rotation.y = Math.PI / 4;
    church.add(spire);
    church.position.set(-6, 0, -22);
    g.add(church);
    scatterTrees(g, rng, 16, 44, 10);
    crowd(g, rng, ctx.people.slice(0, 4), { radius: 5 });
    return { camera: [9, 5, 12], target: [-2, 2, -6] };
  },

  town(g, rng, ctx) {
    g.add(groundPlane(0x8a8f88, 140));
    const road = new THREE.Mesh(new THREE.PlaneGeometry(7, 120), M(0x3a3d41));
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.01;
    g.add(road);
    for (let i = 0; i < 14; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const b = makeBuilding(rng, {
        w: 4 + rng() * 2, d: 5 + rng() * 3, h: 5 + rng() * 5,
        wall: [0xd6c7b0, 0xbfa98d, 0xc9c2b4][Math.floor(rng() * 3)],
        roof: 0x6b4038, pitched: rng() < 0.6,
      });
      b.position.set(side * (6.5 + rng() * 3), 0, -30 + i * 5 + rng() * 2);
      g.add(b);
    }
    scatterTrees(g, rng, 8, 26, 12);
    crowd(g, rng, ctx.people.slice(0, 5), { radius: 4.2, spread: Math.PI, offset: 0.4 });
    return { camera: [7.5, 4.2, 11], target: [0, 1.6, -4] };
  },

  school_lower(g, rng, ctx) { return schoolScene(g, rng, ctx, 0.85, 0xf0c14b); },
  school_mid(g, rng, ctx) { return schoolScene(g, rng, ctx, 1, 0x4f9de0); },
  school_high(g, rng, ctx) { return schoolScene(g, rng, ctx, 1.15, 0x6ec06a); },

  pitch(g, rng, ctx) {
    g.add(groundPlane(0x4f9e46, 160));
    const stripes = new THREE.Group();
    for (let i = -6; i <= 6; i++) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(5, 70), M(i % 2 === 0 ? 0x56a84c : 0x4b9743));
      s.rotation.x = -Math.PI / 2;
      s.position.set(i * 5, 0.02, 0);
      stripes.add(s);
    }
    g.add(stripes);
    const line = new THREE.Mesh(new THREE.RingGeometry(4.4, 4.6, 48), M(0xffffff));
    line.rotation.x = -Math.PI / 2;
    line.position.y = 0.03;
    g.add(line);
    const goal = makeGoal(7.4);
    goal.position.set(0, 0, -24);
    g.add(goal);
    const goal2 = makeGoal(7.4);
    goal2.position.set(0, 0, 24);
    goal2.rotation.y = Math.PI;
    g.add(goal2);
    const ball = makeBall(0.16);
    ball.position.set(0.6, 0.16, 1.4);
    ball.userData.baseY = 0.16;
    g.add(ball);
    crowd(g, rng, ctx.people.slice(0, 6), { radius: 7, spread: Math.PI * 1.4, offset: Math.PI * 0.8 });
    scatterTrees(g, rng, 10, 55, 32);
    return { camera: [8.5, 4.5, 12], target: [0, 1.2, -3] };
  },

  pool(g, rng, ctx) {
    const w = 20;
    const d = 16;
    const poolW = 12;
    const poolD = 8;
    const poolZ = -1;
    const depth = 1.6;

    g.add(floorRoom(rng, {
      floor: 0xcfd6dd, wall: 0xdfe9f2, w, d, h: 5,
      hole: { x: 0, z: poolZ, w: poolW, d: poolD, depth },
    }));

    // Tank walls and floor, built below the deck so nothing shares a plane.
    const tile = M(0xa9bccb);
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(poolW, 0.2, poolD), tile);
    bottom.position.set(0, -depth, poolZ);
    bottom.receiveShadow = true;
    g.add(bottom);
    const t = 0.24;
    for (const [sx, sz, bw, bd] of [
      [0, -poolD / 2 - t / 2, poolW + t * 2, t],
      [0, poolD / 2 + t / 2, poolW + t * 2, t],
      [-poolW / 2 - t / 2, 0, t, poolD],
      [poolW / 2 + t / 2, 0, t, poolD],
    ]) {
      // Stop the wall tops just under the deck. Ending them exactly at floor
      // level puts two surfaces on the same plane and they flicker against
      // each other as the camera moves.
      const sideH = depth - 0.03;
      const side = new THREE.Mesh(new THREE.BoxGeometry(bw, sideH, bd), tile);
      side.position.set(sx, -0.03 - sideH / 2, poolZ + sz);
      g.add(side);
    }

    // Water surface sits below the deck, where water in a pool goes.
    const surfaceY = -0.22;
    const water = new THREE.Mesh(new THREE.BoxGeometry(poolW - 0.02, depth - 0.3, poolD - 0.02),
      new THREE.MeshLambertMaterial({ color: 0x2f9ed4, transparent: true, opacity: 0.86 }));
    water.position.set(0, surfaceY - (depth - 0.3) / 2, poolZ);
    g.add(water);

    for (let i = -2; i <= 2; i++) {
      const lane = new THREE.Mesh(new THREE.BoxGeometry(poolW - 0.2, 0.05, 0.09), M(0xe8e34a));
      lane.position.set(0, surfaceY + 0.03, poolZ + i * 1.6);
      g.add(lane);
    }

    for (let i = -2; i <= 2; i++) {
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.6), M(0xe8e8ee));
      block.position.set(-poolW / 2 - 0.55, 0.22, poolZ + i * 1.6);
      block.castShadow = true;
      g.add(block);
    }

    crowd(g, rng, ctx.people.slice(0, 3), {
      radius: 7.4, spread: Math.PI * 0.6, offset: Math.PI * 1.3,
      avoid: [[0, poolZ, poolW / 2 + 0.9, poolD / 2 + 0.9], [-poolW / 2 - 0.55, poolZ, 0.7, 3.6]],
      bounds: [w / 2 - 0.8, d / 2 - 0.8],
    });

    return { camera: [11, 6.2, 12], target: [0, 0.4, poolZ], interior: true };
  },

  ring(g, rng, ctx) {
    g.add(groundPlane(0x24242e, 70));
    const apron = new THREE.Mesh(new THREE.BoxGeometry(9, 1, 9), M(0x2f3140));
    apron.position.y = 0.5;
    apron.castShadow = true;
    g.add(apron);
    const canvas = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.08, 8.6), M(0xe4e6ee));
    canvas.position.y = 1.02;
    g.add(canvas);
    const postMat = M(0xd93b3b);
    for (const [x, z] of [[-4.2, -4.2], [4.2, -4.2], [-4.2, 4.2], [4.2, 4.2]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.4, 10), postMat);
      post.position.set(x, 2.2, z);
      post.castShadow = true;
      g.add(post);
    }
    // Ropes run flat along each side: X-aligned pairs, then Z-aligned pairs.
    const ropeGeo = new THREE.CylinderGeometry(0.05, 0.05, 8.4, 6);
    const ropeMat = M(0xe8e8f0);
    for (let r = 0; r < 3; r++) {
      const y = 1.5 + r * 0.55;
      for (const z of [-4.2, 4.2]) {
        const rope = new THREE.Mesh(ropeGeo, ropeMat);
        rope.rotation.z = Math.PI / 2;
        rope.position.set(0, y, z);
        g.add(rope);
      }
      for (const x of [-4.2, 4.2]) {
        const rope = new THREE.Mesh(ropeGeo, ropeMat);
        rope.rotation.x = Math.PI / 2;
        rope.position.set(x, y, 0);
        g.add(rope);
      }
    }
    const spot = new THREE.SpotLight(0xffffff, 900, 40, 0.62, 0.5, 1.6);
    spot.position.set(0, 13, 0);
    spot.castShadow = true;
    g.add(spot);
    const rim = new THREE.PointLight(0xff9d6b, 220, 26, 2);
    rim.position.set(-7, 6, 7);
    g.add(rim);
    crowd(g, rng, ctx.people.slice(0, 6), { radius: 11, y: 0, spread: Math.PI * 2 });
    return { camera: [8, 5.5, 10], target: [0, 1.8, 0], dark: true, sky: 0x14141c, fog: 0x14141c, interior: true };
  },

  studio(g, rng, ctx) {
    g.add(floorRoom(rng, { floor: 0x3d3a44, wall: 0x2c2a34, w: 9, d: 9, h: 3.4 }));
    for (let i = 0; i < 24; i++) {
      const foam = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.1), M(0x4a4654));
      foam.position.set(-4 + (i % 6) * 0.75, 1 + Math.floor(i / 6) * 0.7, -4.4);
      foam.rotation.z = Math.PI / 4;
      g.add(foam);
    }
    const mic = makeMic();
    mic.position.set(-0.6, 0, -1.2);
    g.add(mic);
    const desk = makeMonitor();
    desk.position.set(2.3, 0, -2.6);
    desk.rotation.y = -0.5;
    g.add(desk);
    const sp = makeSpeaker(0.8);
    sp.position.set(3.4, 0.68, -2);
    g.add(sp);
    crowd(g, rng, ctx.people.slice(0, 2), {
      radius: 3.1, spread: Math.PI * 0.5, offset: Math.PI * 1.2,
      avoid: [[-0.6, -1.2, 0.5, 0.5], [2.3, -2.6, 1.2, 0.8]],
      bounds: [4.2, 4.2],
    });
    return { camera: [5.6, 3.6, 6.4], target: [0.2, 1.1, -1.2], dark: true, sky: 0x1a1822, fog: 0x1a1822, interior: true };
  },

  stage(g, rng, ctx) {
    g.add(groundPlane(0x1b1b26, 90));
    const deck = new THREE.Mesh(new THREE.BoxGeometry(12, 1.2, 7), M(0x33313d));
    deck.position.set(0, 0.6, -3);
    deck.castShadow = true;
    g.add(deck);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(12, 7), M(0x171722));
    back.position.set(0, 4.5, -6.4);
    g.add(back);
    const mic = makeMic();
    mic.position.set(0, 1.2, -1.6);
    g.add(mic);
    const star = makePerson({ colour: 0xf0c14b, height: 1.75 });
    star.position.set(0, 1.2, -2.3);
    star.userData.baseY = 1.2;
    g.add(star);
    for (const [x, colour] of [[-4.5, 0xff4d6d], [-1.5, 0x4dd2ff], [1.5, 0xffd24d], [4.5, 0x9b6bff]]) {
      const l = new THREE.SpotLight(colour, 420, 30, 0.35, 0.4, 1.4);
      l.position.set(x, 8, -1);
      l.target.position.set(x * 0.3, 1.2, -3);
      g.add(l.target);
      g.add(l);
      const beam = new THREE.Mesh(new THREE.ConeGeometry(1.4, 7, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.09, side: THREE.DoubleSide }));
      beam.position.set(x * 0.6, 4.6, -2);
      g.add(beam);
    }
    crowd(g, rng, ctx.people, { radius: 6.5, spread: Math.PI, offset: 0.2 });
    for (let i = 0; i < 26; i++) {
      const p = makePerson({ colour: 0x3a3a4a, height: 1.6 + rng() * 0.25 });
      p.position.set((rng() - 0.5) * 16, 0, 2 + rng() * 9);
      p.userData.baseY = 0;
      g.add(p);
    }
    return { camera: [5.5, 4.2, 9], target: [0, 2, -2.5], dark: true, sky: 0x101018, fog: 0x101018, interior: true };
  },

  city(g, rng, ctx) {
    g.add(groundPlane(0x4a4d55, 200));
    for (let i = 0; i < 30; i++) {
      const a = rng() * Math.PI * 2;
      const r = 16 + rng() * 46;
      const h = 8 + rng() * 34;
      const b = makeBuilding(rng, {
        w: 4 + rng() * 5, d: 4 + rng() * 5, h,
        wall: [0x6b7280, 0x565d68, 0x7b8390][Math.floor(rng() * 3)],
        roof: 0x3f434b, pitched: false,
      });
      b.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      g.add(b);
    }
    const road = new THREE.Mesh(new THREE.PlaneGeometry(9, 200), M(0x2f3238));
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.01;
    g.add(road);
    crowd(g, rng, ctx.people.slice(0, 5), { radius: 5, spread: Math.PI * 1.6 });
    return { camera: [10, 6.5, 14], target: [0, 3, -4], sky: 0x8fa4bd };
  },

  office(g, rng, ctx) {
    g.add(floorRoom(rng, { floor: 0x5f6570, wall: 0xdfe4ea, w: 13, d: 11, h: 3.4 }));
    for (let i = 0; i < 5; i++) {
      const d = makeMonitor();
      d.position.set(-4.5 + i * 2.3, 0, -3 + (i % 2) * 2.2);
      d.rotation.y = (rng() - 0.5) * 0.5;
      g.add(d);
    }
    const board = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.4), M(0xf7f7f2));
    board.position.set(0, 2, -5.4);
    g.add(board);
    for (let i = 0; i < 5; i++) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4 + rng() * 1.4), M(0x4ade80));
      bar.position.set(-1.6 + i * 0.8, 1.3 + (0.4 + rng() * 1.4) / 2 - 0.6, -5.38);
      g.add(bar);
    }
    crowd(g, rng, ctx.people.slice(0, 5), {
      radius: 4.4, spread: Math.PI * 1.1, offset: Math.PI * 0.55,
      avoid: [0, 1, 2, 3, 4].map((i) => [-4.5 + i * 2.3, -3 + (i % 2) * 2.2, 1.1, 0.7]),
      bounds: [6, 5],
    });
    return { camera: [8.5, 5.4, 9.5], target: [0, 1.2, -1.6], interior: true };
  },

  workshop(g, rng, ctx) {
    g.add(floorRoom(rng, { floor: 0x6b6b73, wall: 0x9aa0a8, w: 12, d: 10, h: 4.4 }));
    const bench = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.16, 1.2), M(0x8a6a45));
    bench.position.set(0, 0.9, -3);
    bench.castShadow = true;
    g.add(bench);
    for (const x of [-2, 2]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.9, 1.1), M(0x5a4a35));
      leg.position.set(x, 0.45, -3);
      g.add(leg);
    }
    for (let i = 0; i < 12; i++) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), M(rng() < 0.5 ? 0xc08b4a : 0xa2743c));
      crate.position.set(-5 + rng() * 10, 0.4 + Math.floor(rng() * 2) * 0.8, -4.4 + rng() * 2);
      crate.rotation.y = rng() * 0.5;
      crate.castShadow = true;
      g.add(crate);
    }
    const d = makeMonitor();
    d.position.set(3, 0, -1.2);
    d.rotation.y = -0.7;
    g.add(d);
    crowd(g, rng, ctx.people.slice(0, 3), {
      radius: 3.4, spread: Math.PI * 0.8, offset: Math.PI * 1.25,
      avoid: [[0, -3, 2.5, 0.9], [3, -1.2, 1.2, 0.8]],
      bounds: [5.6, 4.6],
    });
    return { camera: [7.8, 5, 8.8], target: [0, 1.2, -1.6], interior: true };
  },

  home_modern(g, rng, ctx) {
    const st = homeStyle(ctx.homeTier || DEFAULT_STYLE);
    const out = st.outside;
    g.add(groundPlane(0x6d9f59, 140));
    const houseZ = -8 - out.d * 0.5;
    const house = makeBuilding(rng, {
      w: out.w, d: out.d, h: out.h, wall: out.wall, roof: out.roof, pitched: out.pitched,
    });
    house.position.set(0, 0, houseZ);
    g.add(house);

    const glass = new THREE.Mesh(new THREE.PlaneGeometry(out.w * 0.62, Math.min(3.6, out.h * 0.5)),
      new THREE.MeshLambertMaterial({ color: 0x9fd0e8, transparent: true, opacity: 0.55 }));
    glass.position.set(0, Math.min(2.2, out.h * 0.32), houseZ + out.d / 2 + 0.05);
    g.add(glass);

    const patio = new THREE.Mesh(new THREE.PlaneGeometry(out.w * 1.1, 6), M(0xb9b3a6));
    patio.rotation.x = -Math.PI / 2;
    patio.position.set(0, 0.02, houseZ + out.d / 2 + 3);
    g.add(patio);

    dressOutside(g, rng, out, houseZ);
    scatterTrees(g, rng, 7, 34, 16);
    crowd(g, rng, ctx.people, {
      radius: Math.max(4.6, out.w * 0.4), spread: Math.PI * 1.5, offset: Math.PI * 0.7,
      avoid: [[0, houseZ, out.w / 2 + 0.6, out.d / 2 + 0.6]],
    });
    // Work out the distance the building's own height needs at this field of
    // view, rather than guessing — a sixteen-metre tower and a bungalow want
    // very different camera positions.
    const fitHeight = (out.h * 0.78) / Math.tan((46 * Math.PI / 180) / 2);
    const back = Math.max(9, out.w * 0.55, fitHeight / 1.56);
    return {
      camera: [back, Math.max(4.5, out.h * 0.45 + 3), back * 1.2],
      target: [0, Math.min(3.5, out.h * 0.28), houseZ * 0.45],
    };
  },

  stadium(g, rng, ctx) {
    g.add(groundPlane(0x4f9e46, 200));
    for (let i = -8; i <= 8; i++) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(5, 90), M(i % 2 === 0 ? 0x56a84c : 0x4b9743));
      s.rotation.x = -Math.PI / 2;
      s.position.set(i * 5, 0.02, 0);
      g.add(s);
    }
    const goal = makeGoal(7.4);
    goal.position.set(0, 0, -30);
    g.add(goal);
    for (const side of [-1, 1]) {
      const stand = new THREE.Mesh(new THREE.BoxGeometry(6, 9, 74), M(0x8a3b3b));
      stand.position.set(side * 30, 4.5, 0);
      stand.castShadow = true;
      g.add(stand);
      for (let r = 0; r < 5; r++) {
        const row = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 72), M(0xd0d6dd));
        row.position.set(side * (26.5 + r * 0.6), 2 + r * 1.5, 0);
        g.add(row);
      }
      for (const z of [-28, 28]) {
        const pylon = new THREE.Mesh(new THREE.BoxGeometry(1, 22, 1), M(0x9aa0a8));
        pylon.position.set(side * 34, 11, z);
        g.add(pylon);
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(5, 2.4, 0.6), new THREE.MeshBasicMaterial({ color: 0xfff3cf }));
        lamp.position.set(side * 34, 22, z);
        g.add(lamp);
      }
    }
    const ball = makeBall(0.16);
    ball.position.set(0, 0.16, 0);
    ball.userData.baseY = 0.16;
    g.add(ball);
    crowd(g, rng, ctx.people.slice(0, 6), { radius: 9, spread: Math.PI * 1.5 });
    return { camera: [13, 7, 18], target: [0, 2, -6], sky: 0x7f9dc0 };
  },
};

// The stuff around the house that gives its standing away.
function dressOutside(g, rng, out, houseZ) {
  if (out.fence === 'broken' || out.fence === 'low') {
    const broken = out.fence === 'broken';
    for (let i = -6; i <= 6; i++) {
      if (broken && rng() < 0.35) continue;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, broken ? 0.7 : 1, 0.1), M(0x7a6a52));
      post.position.set(i * 0.7, (broken ? 0.7 : 1) / 2, houseZ + out.d / 2 + 4.5);
      post.rotation.z = broken ? (rng() - 0.5) * 0.4 : 0;
      g.add(post);
    }
  }
  if (out.kind === 'tower') {
    // Bins and a skip where a garden would be.
    for (let i = 0; i < 4; i++) {
      const bin = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1, 0.6), M(i % 2 ? 0x3f4a3a : 0x4a4a52));
      bin.position.set(-4 + i * 1.1, 0.5, houseZ + out.d / 2 + 2.4);
      bin.castShadow = true;
      g.add(bin);
    }
  }
  if (out.drive) {
    const drive = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(9, out.w * 0.55), 9), M(0x555a5f));
    drive.rotation.x = -Math.PI / 2;
    drive.position.set(out.w * 0.36, 0.02, houseZ + out.d / 2 + 5);
    g.add(drive);
    for (let i = 0; i < (out.kind === 'estate' ? 3 : 1); i++) {
      const car = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 3.8),
        M([0x1b1b22, 0xb4b8bd, 0x7a2028][i % 3]));
      car.position.set(out.w * 0.36 - 1.9 + i * 1.9, 0.4, houseZ + out.d / 2 + 4 + i * 0.5);
      car.castShadow = true;
      g.add(car);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.45, 1.8), M(0x2a3038));
      cabin.position.set(car.position.x, 0.85, car.position.z - 0.2);
      g.add(cabin);
    }
  }
  if (out.pool) {
    const water = new THREE.Mesh(new THREE.BoxGeometry(7, 0.3, 4),
      new THREE.MeshLambertMaterial({ color: 0x2f9ed4, transparent: true, opacity: 0.85 }));
    water.position.set(-out.w * 0.42 - 2, 0.15, houseZ + out.d / 2 + 3.5);
    g.add(water);
    const surround = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 5.4), M(0xd8d2c4));
    surround.rotation.x = -Math.PI / 2;
    surround.position.set(-out.w * 0.42 - 2, 0.01, houseZ + out.d / 2 + 3.5);
    g.add(surround);
  }
  if (out.gate) {
    // Right out at the end of the drive, or it sits in front of the camera and
    // hides the house it is guarding.
    const gz = houseZ + out.d / 2 + 30;
    for (const x of [-3.4, 3.4]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3.4, 0.8), M(0xe8e2d4));
      pillar.position.set(x, 1.7, gz);
      pillar.castShadow = true;
      g.add(pillar);
    }
    const bars = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 0.1), M(0x2a2a30));
    bars.position.set(0, 1.3, gz);
    g.add(bars);
  }
}

function schoolScene(g, rng, ctx, scale, accent) {
  g.add(groundPlane(0x7ba85f, 140));
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(26, 20), M(0x8d8f92));
  yard.rotation.x = -Math.PI / 2;
  yard.position.set(0, 0.02, 2);
  g.add(yard);
  const block = makeBuilding(rng, {
    w: 18 * scale, d: 8, h: 4 + scale * 2.5, wall: 0xd8d2c4, roof: 0x5f5a52, pitched: scale < 1.1,
  });
  block.position.set(0, 0, -12);
  g.add(block);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 0.12), M(accent));
  door.position.set(0, 1.2, -8.05);
  g.add(door);
  const frame = new THREE.Group();
  const barMat = M(accent);
  for (const x of [-1.4, 1.4]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 8), barMat);
    post.position.set(x, 1.2, 0);
    frame.add(post);
  }
  for (let i = 0; i < 5; i++) {
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.9, 8), barMat);
    rung.rotation.z = Math.PI / 2;
    rung.position.set(0, 0.5 + i * 0.55, 0);
    frame.add(rung);
  }
  for (const z of [-0.55, 0.55]) {
    const side = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 8), barMat);
    side.position.set(1.4, 1.2, z);
    frame.add(side);
    const side2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 8), barMat);
    side2.position.set(-1.4, 1.2, z);
    frame.add(side2);
  }
  frame.position.set(-7, 0, 4);
  g.add(frame);
  const ball = makeBall(0.14);
  ball.position.set(3.2, 0.14, 3);
  ball.userData.baseY = 0.14;
  g.add(ball);
  scatterTrees(g, rng, 8, 40, 18);
  crowd(g, rng, ctx.people, { radius: 5.5, spread: Math.PI * 1.7, offset: Math.PI * 0.6 });
  return { camera: [8, 4.6, 11], target: [-1, 1.4, -3] };
}

export function buildLevel(sceneId, ctx, rng) {
  const group = new THREE.Group();
  const builder = BUILDERS[sceneId] || BUILDERS.home;
  const info = builder(group, rng, ctx) || {};
  return {
    group,
    camera: info.camera || [7, 4, 9],
    target: info.target || [0, 1.2, 0],
    sky: info.sky !== undefined ? info.sky : (ctx.place ? ctx.place.sky : 0x9ecbf0),
    fog: info.fog !== undefined ? info.fog : (info.sky !== undefined ? info.sky : (ctx.place ? ctx.place.sky : 0x9ecbf0)),
    dark: !!info.dark,
    interior: !!info.interior,
    ambient: info.ambient || null,
  };
}

export const SCENE_IDS = Object.keys(BUILDERS);
