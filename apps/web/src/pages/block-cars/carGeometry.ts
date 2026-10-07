import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import Module, { type Manifold, type ManifoldToplevel, type Mesh } from 'manifold-3d';
import wasmUrl from 'manifold-3d/manifold.wasm?url';

export type ModuleKind = 'tray' | 'tanker' | 'cage' | 'recycle' | 'crate' | 'sedan' | 'crane' | 'loader' | 'hook' | 'fire' | 'mixer' | 'sport' | 'pickup' | 'dump' | 'van';
export type CarModel = { id: string; page: number; en: string; vi: string; kind: ModuleKind; cab: string; body: string; wheels: 4 | 6; beds?: 1 | 2 | 3; partCount: number; category: string };
export type CarPart = { name: string; mesh: THREE.Mesh };
export type CarAssembly = { group: THREE.Group; parts: CarPart[]; tools: CarPart[]; bounds: THREE.Box3 };
let api: ManifoldToplevel;
let loading: Promise<void> | undefined;
export function initCarGeometry() {
  return loading ??= Module({ locateFile: () => wasmUrl }).then(m => { api = m; m.setup(); });
}
export const isCarGeometryReady = () => Boolean(api);
const cache = new Map<string, { name: string; geometry: THREE.BufferGeometry; color: string; at: [number, number, number]; rotation: [number, number, number] }[]>();
const shared = new Map<string, Mesh>();

// X runs front to rear, Y is height, Z is width. All measurements below are
// estimates in mm from the supplied renders, not measurements of original CAD.
export function buildCar(model: CarModel, scale: number, clearance = 0.25): CarAssembly {
  const key = `${model.id}:${clearance.toFixed(2)}`;
  if (!cache.has(key)) {
    const garbage: Manifold[] = [];
    const hold = (m: Manifold) => { garbage.push(m); return m; };
    const M = api.Manifold;
    const common = (name: string, make: () => Manifold) => {
      const id = `${name}:${clearance}`;
      if (!shared.has(id)) shared.set(id, make().getMesh());
      return hold(new M(shared.get(id)!));
    };
    const shift = (m: Manifold, x = 0, y = 0, z = 0) => hold(m.translate([x, y, z]));
    const turn = (m: Manifold, x = 0, y = 0, z = 0) => hold(m.rotate([x, y, z]));
    const union = (...m: Manifold[]) => hold(M.union(m));
    const cut = (a: Manifold, ...b: Manifold[]) => hold(a.subtract(union(...b)));
    const box = (x: number, y: number, z: number, at: number[] = [0, 0, 0], radius = 0.55) => {
      if (radius === 0) return shift(hold(M.cube([x, y, z], true)), ...at as [number, number, number]);
      const r = Math.min(radius, x / 3, y / 3, z / 3);
      // Build normals on a unit cube: the upstream geometry derives its normals
      // from dimensioned positions, which shrinks thin faces unevenly.
      const g = new RoundedBoxGeometry(1, 1, 1, 2, 0.1);
      const p = g.getAttribute('position');
      const normals = g.getAttribute('normal');
      for (let i = 0; i < p.count; i++) p.setXYZ(i,
        Math.sign(p.getX(i)) * (x / 2 - r) + normals.getX(i) * r,
        Math.sign(p.getY(i)) * (y / 2 - r) + normals.getY(i) * r,
        Math.sign(p.getZ(i)) * (z / 2 - r) + normals.getZ(i) * r);
      const mesh = new api.Mesh({ numProp: 3, vertProperties: new Float32Array(p.array), triVerts: new Uint32Array(Array.from({ length: p.count }, (_, i) => i)) });
      mesh.merge();
      const solid = hold(new M(mesh)); g.dispose();
      return shift(solid, ...at as [number, number, number]);
    };
    const cyl = (r: number, h: number, at: number[] = [0, 0, 0], axis: 'x' | 'y' | 'z' = 'y', rTop = r) => shift(turn(hold(M.cylinder(h, r, rTop, 48, true)), axis === 'y' ? 90 : 0, axis === 'x' ? 90 : 0), ...at as [number, number, number]);
    const sphere = (r: number, at: number[]) => shift(hold(M.sphere(r, 32)), ...at as [number, number, number]);
    const profile = (points: [number, number][], width: number, bevel = 0.5) => {
      const s = new THREE.Shape(points.map(p => new THREE.Vector2(...p)));
      const g = new THREE.ExtrudeGeometry(s, { depth: width - bevel * 2, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 20, steps: 1 });
      g.translate(0, 0, -width / 2 + bevel);
      const p = g.getAttribute('position');
      const mesh = new api.Mesh({ numProp: 3, vertProperties: new Float32Array(p.array), triVerts: new Uint32Array(Array.from({ length: p.count }, (_, i) => i)) }); mesh.merge();
      const solid = hold(new M(mesh)); g.dispose(); return solid;
    };
    const records: NonNullable<ReturnType<typeof cache.get>> = [];
    const part = (name: string, solid: Manifold, color: string, at: [number, number, number] = [0, 0, 0], rotation: [number, number, number] = [0, 0, 0]) => {
      if (solid.isEmpty()) throw new Error(`Empty module: ${name}`);
      // Remove Boolean sliver faces well below printable detail size before
      // reducing the result to STL's float coordinates.
      const mesh = hold(solid.setTolerance(0.005)).getMesh(); const vertices: number[] = [];
      for (let i = 0; i < mesh.vertProperties.length; i += mesh.numProp) vertices.push(...mesh.vertProperties.slice(i, i + 3));
      const indices: number[] = [];
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      for (let i = 0; i < mesh.triVerts.length; i += 3) {
        const ia = mesh.triVerts[i], ib = mesh.triVerts[i + 1], ic = mesh.triVerts[i + 2];
        a.fromArray(vertices, ia * 3); b.fromArray(vertices, ib * 3); c.fromArray(vertices, ic * 3);
        // Float STL vertices can collapse a tiny Boolean triangle to a line.
        // Drop only those zero-area faces; the export validator checks closure.
        if (!a.equals(b) && !b.equals(c) && !c.equals(a)) indices.push(ia, ib, ic);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); g.setIndex(indices);
      const shaded = toCreasedNormals(g, Math.PI / 5);
      shaded.setIndex(new THREE.BufferAttribute(Uint32Array.from({ length: shaded.getAttribute('position').count }, (_, i) => i), 1));
      g.dispose();
      records.push({ name, geometry: shaded, color, at, rotation });
    };
    const beige = '#dabb92'; const black = '#202125'; const red = '#ea183b'; const yellow = '#f2ce05';
    const socket = (solid: Manifold) => cut(solid, cyl(2.8 + clearance, 6, [0, -0.5, 0]), box(31.5 + clearance, 5, 30 + clearance, [0, -1.2, 0]));
    const chassis = (front: boolean, axle: boolean, tongue: boolean, pocket: boolean) => {
      let s = box(35.7, 21, 34, [0, 10.5, 0], 1.7);
      s = cut(s, box(31.5, 4, 29.8, [0, 21.5, 0], 1.1));
      s = union(s, cyl(2.8, 4, [0, 21.2, 0]));
      if (axle) {
        for (const side of [-1, 1]) {
          s = cut(s, cyl(11.25, 6, [0, 9.8, side * 16], 'z'), box(22.5, 10, 6, [0, 4.3, side * 16]));
          const arch = cut(cyl(12, 1.2, [0, 9.8, side * 16.35], 'z'), cyl(11.25, 2, [0, 9.8, side * 16.35], 'z'), box(30, 25, 4, [0, -3, side * 16.35]));
          s = union(s, arch);
          s = cut(s, cyl(2.35, 17, [0, 9.8, side * 8.5], 'z'));
        }
      }
      if (tongue) s = union(s, box(3.3, 8, 12, [18.7, 9.5, 0], 0.45), box(2.6, 10, 15, [20.2, 9.5, 0], 0.35));
      if (pocket) s = cut(s, box(5.8, 10 + clearance * 2, 15 + clearance * 2, [-16.5, 9.5, 0], 0.45));
      if (front) {
        for (const z of [-11, 11]) s = union(s, cyl(3.2, 1.8, [-18.2, 12, z], 'x'));
        for (const y of [8.8, 11.9, 15]) s = union(s, box(1.4, 1.6, 13.4, [-18.15, y, 0], 0.65));
      } else if (!tongue) {
        s = union(s, box(1.2, 3, 20, [18, 8.3, 0]));
        for (const z of [-11, 11]) s = union(s, box(1.3, 3, 4, [18, 14, z]));
      }
      return s;
    };
    const tyre = () => {
      // A closed annular section with recessed hubs, sidewall grooves and
      // 32 staggered tread cuts. Shared rings avoid coincident CSG cap faces.
      const section = [[2.8, -2.4], [5.1, -2.4], [5.1, -3.4], [6.8, -3.4], [7, -3.1], [7.7, -3.1], [7.9, -3.4], [9, -3.4], [9.65, -2.8], [10, -2.4], [10, 0], [10, 2.4], [9.65, 2.8], [9, 3.4], [7.9, 3.4], [7.7, 3.1], [7, 3.1], [6.8, 3.4], [5.1, 3.4], [5.1, 2.4], [2.8, 2.4]];
      const segments = 256; const positions: number[] = []; const indices: number[] = [];
      for (const [radius, z] of section) for (let i = 0; i < segments; i++) {
        const angle = i * Math.PI * 2 / segments;
        const phase = ((i * 32 / segments + z * 0.035) % 1 + 1) % 1;
        const notch = phase > 0.18 && phase < 0.48 ? Math.sin((phase - 0.18) / 0.3 * Math.PI) : 0;
        const r = radius - (radius >= 9 ? notch * 0.55 : 0);
        positions.push(Math.cos(angle) * r, Math.sin(angle) * r, z);
      }
      for (let j = 0; j < section.length; j++) for (let i = 0; i < segments; i++) {
        const a = j * segments + i, b = j * segments + (i + 1) % segments;
        const c = ((j + 1) % section.length) * segments + i, d = ((j + 1) % section.length) * segments + (i + 1) % segments;
        indices.push(a, b, d, a, d, c);
      }
      return hold(new M(new api.Mesh({ numProp: 3, vertProperties: new Float32Array(positions), triVerts: new Uint32Array(indices) })));
    };
    const screw = () => {
      let s = union(cyl(4.75, 2.8, [0, 0, 0], 'z', 4.45), cyl(2.2, 12.8, [0, 0, -7], 'z'));
      for (const z of [-7.3, -9.5, -11.7]) s = union(s, cyl(2.55, 1.1, [0, 0, z], 'z', 2.25));
      return cut(s, box(6.8, 1.55, 2.2, [0, 0, 1.0], 0.5), box(1.55, 6.8, 2.2, [0, 0, 1.0], 0.5));
    };
    const tray = (height = 8) => {
      let s = box(35.5, height, 33.8, [0, height / 2, 0], 1.2);
      s = cut(s, box(30.5, height + 1, 28.8, [0, height / 2 + 3.8, 0], 0.9));
      for (const z of [-16.75, 16.75]) s = union(s, box(25, 1.25, 0.9, [0, 3.5, z]));
      return socket(s);
    };
    const cabin = (kind: 'flat' | 'hood' | 'car') => {
      const points: [number, number][] = kind === 'flat' ? [[-17.5, 0], [17.5, 0], [17.5, 27], [-8, 27], [-17.5, 2]] : kind === 'hood' ? [[-17.5, 0], [17.5, 0], [17.5, 27], [-4.5, 27], [-9, 11], [-15.5, 11], [-17.5, 8]] : [[-17.5, 0], [17.5, 0], [17.5, 23], [5, 23], [-8, 10], [-16, 8]];
      let s = profile(points, 33.5, 1);
      const roofY = kind === 'car' ? 23 : 27;
      const windowX = kind === 'flat' ? 3 : kind === 'hood' ? 6 : 9;
      const windowWidth = kind === 'car' ? 14 : 17;
      for (const side of [-1, 1]) {
        s = cut(s, box(windowWidth, kind === 'car' ? 10 : 14, 2, [windowX, roofY - 10, side * 16.65], 0.65));
        s = union(s, box(1.8, 4.5, 1.4, [windowX - windowWidth / 2 - 1.8, 11, side * 17.1], 0.6), shift(sphere(1.1, [0, 0, 0]), 12.7, 5.5, side * 16.7));
      }
      const angle = kind === 'flat' ? -21 : kind === 'hood' ? -15.7 : -45;
      const windshieldX = kind === 'flat' ? -13.7 : kind === 'hood' ? -7.7 : -2.2;
      const windshieldY = kind === 'flat' ? 14.8 : kind === 'hood' ? 19 : 16.5;
      s = cut(s, shift(turn(box(3.6, kind === 'car' ? 14 : 18, 25, [0, 0, 0], 0.55), 0, 0, angle), windshieldX, windshieldY, 0));
      for (const z of [-7, 7]) {
        s = union(s, shift(turn(box(0.95, 5.5, 0.8, [0, 0, 0], 0.3), 0, 0, angle - 15), windshieldX - 2.1, windshieldY - 5.9, z), cyl(0.95, 1.5, [windshieldX - 3, windshieldY - 8, z + 0.7], 'x'));
      }
      if (kind === 'flat') for (const z of [-8, 0, 8]) {
        s = cut(s, box(12, 1.3, 0.65, [3, roofY + 0.5, z - 2], 0.25), box(12, 1.3, 0.65, [3, roofY + 0.5, z + 2], 0.25), box(0.65, 1.3, 4.65, [9, roofY + 0.5, z], 0.25));
      }
      if (kind === 'hood') for (const side of [-1, 1]) s = union(s, box(2.4, 29, 2.8, [16.5, 15, side * 14.5], 1.1), box(25, 0.8, 28, [3, 27.8, 0], 0.3));
      return socket(s);
    };
    const long = model.beds === 2 || model.beds === 3;
    const moduleXs = model.beds === 3 ? [-18, 18, 54, 90] : model.beds === 2 ? [-18, 18, 54] : [-18, 18];
    for (const [i, x] of moduleXs.entries()) {
      const axle = !(long && i === moduleXs.length - 2 && i > 0);
      part(i === 0 ? 'Front chassis with grille' : `Chassis ${i + 1}`, common(`chassis:${i === 0}:${axle}:${i < moduleXs.length - 1}:${i > 0}`, () => chassis(i === 0, axle, i < moduleXs.length - 1, i > 0)), beige, [x, 0, 0]);
    }
    const tyreSolid = common('tyre', tyre); const screwSolid = common('screw', screw);
    let wheelIndex = 0;
    for (const [i, x] of moduleXs.entries()) if (!(long && i === moduleXs.length - 2 && i > 0)) for (const side of [-1, 1]) {
      part(`Tyre ${++wheelIndex}`, tyreSolid, black, [x, 9.8, side * 17.2]);
      part(`Cross socket wheel screw ${wheelIndex}`, screwSolid, beige, [x, 9.8, side * 20.5], [0, side < 0 ? Math.PI : 0, 0]);
    }
    const cabType = ['sedan', 'sport', 'pickup'].includes(model.kind) ? 'car' : ['tanker', 'cage', 'recycle', 'crane', 'loader', 'hook', 'mixer'].includes(model.kind) ? 'hood' : 'flat';
    part('Cabin with recessed windows and wipers', common(`cab:${cabType}`, () => cabin(cabType)), model.cab, [-18, 21, 0]);
    const at: [number, number, number] = [18, 21, 0];
    const body = (name: string, s: Manifold, color = model.body) => part(name, socket(s), color, at);
    const shell = (height = 26) => box(35.5, height, 33.8, [0, height / 2, 0], 1.25);
    const sideRibs = (s: Manifold, count: number, start = 5, gap = 3.2) => {
      const ribs: Manifold[] = [];
      for (const z of [-17, 17]) for (let i = 0; i < count; i++) ribs.push(box(28, 1.3, 1, [0, start + i * gap, z], 0.4));
      return union(s, ...ribs);
    };
    switch (model.kind) {
      case 'tray': for (let i = 0; i < (model.beds ?? 1); i++) part(`Cargo tray ${i + 1}`, tray(), model.body, [18 + i * 36, 21, 0]); break;
      case 'tanker': {
        let tank = union(shell(3.5), cyl(14.8, 32, [0, 16, 0], 'x'));
        tank = cut(tank, box(45, 20, 40, [0, -8.5, 0]));
        for (const x of [-10.5, 10.5]) tank = union(tank, cut(cyl(15.4, 1.2, [x, 16, 0], 'x'), box(45, 20, 40, [0, -8.5, 0])));
        tank = union(tank, box(7, 2.4, 7, [2, 31, 0], 0.65));
        tank = cut(tank, box(4.2, 3, 4.2, [2, 32, 0], 0.3));
        for (const z of [-14, 14]) tank = union(tank, box(27, 2, 2, [0, 4, z], 0.9));
        body('Tank with straps and filler hatch', tank); break;
      }
      case 'cage': {
        let s = shell(3.5); const bars: Manifold[] = [];
        for (const z of [-16, 16]) {
          for (const x of [-16, -5.3, 5.3, 16]) bars.push(box(1.6, 25, 1.7, [x, 15, z]));
          for (let i = 0; i < 8; i++) bars.push(box(33, 1.6, 1.7, [0, 4.5 + i * 3.3, z]));
        }
        for (const x of [-16, 16]) for (let i = 0; i < 8; i++) bars.push(box(1.7, 1.6, 33, [x, 4.5 + i * 3.3, 0]));
        s = union(s, ...bars); body('Open cargo cage', s); break;
      }
      case 'recycle': {
        let s = profile([[-17, 0], [17, 0], [15, 27], [-12, 27]], 33.5, 1);
        s = cut(s, box(34, 21, 28, [4, 13, 0], 0.8)); s = sideRibs(s, 4);
        s = cut(s, box(24, 1.5, 0.8, [-1, 27.5, -11]), box(24, 1.5, 0.8, [-1, 27.5, 11]), box(0.8, 1.5, 22, [-13, 27.5, 0]));
        // Raised triangular recycling arrows, fused into both side panels.
        for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
          const arrow = profile([[-3, -1], [1, -1], [1, -2.6], [4.3, 0], [1, 2.6], [1, 1], [-3, 1]], 0.9, 0);
          s = union(s, shift(turn(arrow, 0, 0, i * 120), Math.cos(i * 2 * Math.PI / 3) * 3, 18 + Math.sin(i * 2 * Math.PI / 3) * 3, side * 16.7));
        }
        body('Recycling hopper with embossed arrows', s);
        let lid = box(1.8, 23, 28, [0, 0, 0], 0.7); lid = union(lid, cyl(1.8, 28, [0, 11.5, 0], 'z'));
        part('Hinged recycling rear door', lid, '#c8c9cc', [34.5, 35, 0]); break;
      }
      case 'crate': {
        part('Cargo tray', tray(), model.body, at);
        let crate = box(27, 25, 27, [0, 12.5, 0], 0.4);
        const seams: Manifold[] = [];
        for (let i = 1; i < 6; i++) for (const side of [-1, 1]) seams.push(box(24, 0.55, 1, [0, i * 4, side * 13.5], 0), box(1, 0.55, 24, [side * 13.5, i * 4, 0], 0));
        for (let i = 0; i < 6; i++) seams.push(box(0.6, 1, 24, [-10 + i * 4, 25, 0], 0));
        crate = cut(crate, ...seams); part('Wood crate with plank grooves', crate, '#c5a176', [18, 28, 0]);
        let roller = union(box(7, 13, 34, [0, 5, 0], 0.6), box(19, 5, 3, [-8, 0, -16]), box(19, 5, 3, [-8, 0, 16]));
        roller = union(roller, cyl(2.3, 5, [-8, 4, -16], 'z'), cyl(2.3, 5, [-8, 4, 16], 'z'));
        part('Road roller fork', roller, red, [-45, 6, 0]); part('Road roller drum', cyl(8.4, 28, [0, 0, 0], 'z'), yellow, [-53, 8.4, 0]);
        for (const side of [-1, 1]) part(`Roller screw ${side}`, screwSolid, beige, [-53, 8.4, side * 16.8], [0, side < 0 ? Math.PI : 0, 0]); break;
      }
      case 'sedan': {
        let s = profile([[-17.4, 0], [17.4, 0], [17.4, 8], [10, 9], [3.5, 23], [-17.4, 23]], 33.5, 1);
        for (const side of [-1, 1]) s = cut(s, box(15.5, 11, 2, [-6, 15, side * 16.7], 0.7));
        s = union(s, box(4, 4, 9, [-12, 24, 0], 0.6)); body('City car rear cabin', s); break;
      }
      case 'pickup': {
        let s = union(tray(), box(11, 24, 33.5, [-12, 12, 0], 1));
        for (const side of [-1, 1]) s = cut(s, box(7, 13, 2, [-12, 15, side * 16.7], 0.6));
        for (const z of [-11, -7, -3, 1, 5, 9, 13]) s = cut(s, box(1, 14, 0.65, [-6, 14, z], 0.15));
        for (const z of [-9, -3, 3, 9]) s = cut(s, box(8, 1, 0.65, [-12, 24, z], 0.15));
        body('Extended pickup cab and open bed', s); break;
      }
      case 'sport':
      case 'van': {
        let s = shell(26); for (const side of [-1, 1]) for (const x of [-8.2, 8.2]) s = cut(s, box(13, 12, 2, [x, 17.5, side * 16.8], 0.8));
        if (model.kind === 'van') s = sideRibs(s, 2, 6, 3.5);
        else {
          for (const z of [-9, -3, 3, 9]) s = union(s, box(29, 0.9, 1, [0, 26.4, z], 0.45));
          for (const z of [-13, 13]) { let rail = box(31, 3, 1.8, [0, 28.1, z], 0.8); rail = cut(rail, box(24, 1.2, 3, [0, 28.3, z], 0.2)); s = union(s, rail, box(2, 2.5, 1.8, [-13, 26.5, z], 0.35), box(2, 2.5, 1.8, [13, 26.5, z], 0.35)); }
          s = union(s, cyl(2.35, 6, [19, 14, 0], 'x'));
        }
        body(model.kind === 'sport' ? 'SUV rear body with roof rack' : 'Van body with recessed panels', s);
        if (model.kind === 'sport') { part('Rear spare tyre', tyreSolid, black, [38.6, 35, 0], [0, Math.PI / 2, 0]); part('Spare wheel screw', screwSolid, beige, [42, 35, 0], [0, Math.PI / 2, 0]); } break;
      }
      case 'dump': {
        let s = profile([[-17, 0], [17, 0], [17, 28], [-17, 28], [-28, 34], [-33, 34], [-25, 23]], 34, 0.8);
        s = cut(s, box(29, 37, 29, [0, 21, 0], 0.65), box(17, 20, 29, [-24, 38, 0], 0.5));
        s = sideRibs(s, 6, 5, 3.5); for (const side of [-1, 1]) s = union(s, shift(turn(box(1.6, 28, 1.1, [0, 0, 0], 0.45), 0, 0, -44), 3, 15, side * 17));
        body('Open ribbed dump hopper and front canopy', s); break;
      }
      case 'crane':
      case 'loader':
      case 'hook': {
        let base = union(shell(8), box(31, 1.8, 31, [0, 8.8, 0], 0.6), box(25, 3, 25, [0, 11, 0], 0.65), cyl(9, 2.4, [0, 13.5, 0]), cyl(6.8, 2, [0, 15.4, 0]), cyl(2.6, 5, [0, 18, 0]));
        base = sideRibs(base, 1, 6); for (const side of [-1, 1]) for (let i = 0; i < 5; i++) base = union(base, box(2.8, 2, 0.9, [-12 + i * 6, 2.4, side * 17], 0.3));
        body('Stepped rotating machinery base', base, yellow);
        let turret = union(cyl(7.7, 7.8, [0, 3.9, 0]), sphere(7.7, [0, 7.5, 0]));
        turret = cut(turret, cyl(2.6 + clearance, 8, [0, 1, 0]), cyl(2.2, 19, [0, 10, 0], 'z'), box(8, 9, 20, [-4, 12.5, 0]));
        part('Dome pivot with boom axle bore', turret, yellow, [18, 37, 0]);
        let boom = profile([[-32, -1], [-32, 6], [-3, 9], [8, 3], [8, -4], [1, -4], [-5, 3]], 6, 0.55);
        for (const side of [-1, 1]) boom = cut(boom, box(22, 3, 1, [-15, 5, side * 3], 0.4));
        boom = union(boom, cyl(2.0, 13, [0, 0, 0], 'z'), cyl(2, 8, [-32, 2, 0], 'z'));
        part('Detailed hinged boom', boom, red, [18, 49, 0]);
        if (model.kind === 'hook') {
          let hook = union(box(13, 5.2, 5.5, [-6.5, 0, 0], 0.4), cut(cyl(4.8, 3, [-16, 0, 0], 'z'), cyl(2.7, 5, [-16, 0, 0], 'z'), box(5, 6, 6, [-20, 0, 0])));
          for (let i = 0; i < 8; i++) hook = union(hook, box(0.6, 5.8, 5.8, [-1 - i * 1.4, 0, 0], 0.2));
          part('Sliding lift fork with open hook', hook, red, [-14, 54, 0]);
        } else {
          let bucket = profile([[-14, -3], [-8, 9], [3, 9], [9, 5], [9, -1], [-5, -6]], 15, 0.65);
          bucket = cut(bucket, cyl(2.2, 18, [7, 2, 0], 'z'));
          for (let i = 0; i < 5; i++) bucket = union(bucket, box(3, 2, 1.5, [-11, -3.5, -6 + i * 3], 0.3));
          part('Upper excavator scoop with teeth', bucket, red, [-21, 52, 0]);
        }
        if (model.kind === 'loader') {
          let bucket = profile([[-17, 0], [9, 0], [9, 16], [5, 16], [0, 8], [-17, 3]], 33, 0.5);
          bucket = cut(bucket, profile([[-18, 3], [5, 3], [5, 19], [0, 19], [-3, 9], [-18, 4.5]], 28, 0));
          for (let i = 0; i < 8; i++) bucket = union(bucket, box(4, 1.8, 2.2, [-18, 1, -13 + i * 3.7], 0.35));
          bucket = union(bucket, box(4, 5, 12, [10, 8, 0], 0.45)); part('Front loader scoop with eight teeth', bucket, red, [-45, 3, 0]);
        }
        break;
      }
      case 'fire': {
        let s = shell(25); for (const side of [-1, 1]) { s = cut(s, box(19, 16, 1.7, [3, 12, side * 16.8], 0.6)); s = union(s, box(1.8, 22, 1, [-11, 13, side * 17], 0.3), box(1.8, 22, 1, [-4, 13, side * 17], 0.3)); for (let i = 0; i < 9; i++) s = union(s, box(7, 0.8, 1.2, [-7.5, 4 + i * 2.2, side * 17], 0.2)); }
        s = union(s, cyl(4.5, 3, [1, 26, 0]), cyl(2.4, 4, [1, 29, 0])); body('Fire equipment body with side ladders', s, red);
        let cradle = union(box(12, 3, 13, [0, 0, 0]), box(10, 6, 2, [0, 3, -5.5]), box(10, 6, 2, [0, 3, 5.5])); cradle = cut(cradle, cyl(2.4 + clearance, 6, [0, -1, 0]), cyl(1.8, 15, [0, 4, 0], 'z'));
        part('Ladder rotation cradle', cradle, yellow, [19, 49, 0]);
        let ladder = union(box(50, 3, 2, [-19, 0, -5]), box(50, 3, 2, [-19, 0, 5])); for (let i = 0; i < 12; i++) ladder = union(ladder, box(1.4, 1.5, 10, [-42 + i * 4, 0, 0], 0.35));
        ladder = union(ladder, cyl(1.6, 16, [0, 0, 0], 'z')); part('Extending fire ladder', ladder, red, [19, 53, 0], [0, 0, -0.13]);
        let extension = union(box(26, 2, 1.4, [-13, 0, -3.5]), box(26, 2, 1.4, [-13, 0, 3.5])); for (let i = 0; i < 6; i++) extension = union(extension, box(1, 1.2, 7, [-24 + i * 4.5, 0, 0], 0.25));
        part('Silver telescopic ladder insert', extension, '#a9adb2', [-23, 58.5, 0], [0, 0, -0.13]); break;
      }
      case 'mixer': {
        let support = union(shell(4), box(7, 16, 27, [-11, 9, 0], 0.8), box(7, 9, 27, [11, 6, 0], 0.8)); support = cut(support, cyl(2.2, 40, [0, 16, 0], 'x'));
        body('Mixer cradle', support, yellow);
        let drum = union(cyl(12.8, 18, [0, 0, 0], 'x'), cyl(9.3, 7, [12, 0, 0], 'x', 12.8), cyl(12.8, 4, [-11, 0, 0], 'x', 10.6));
        drum = cut(drum, cyl(7, 9, [15, 0, 0], 'x'));
        for (let i = 0; i < 6; i++) drum = cut(drum, turn(box(11, 1.4, 3.8, [0, 12.6, 0], 0.6), i * 60, 0, 0));
        drum = union(drum, cyl(2, 36, [0, 0, 0], 'x')); part('Tapered mixer drum with open mouth', drum, red, [18, 40, 0], [0, 0, 0.35]);
        part('Mixer retaining screw', turn(turn(screwSolid, 0, 90), 0, 0, 20), beige, [35.1, 46.2, 0]); break;
      }
    }
    const driver = common('screwdriver', () => {
      let s = union(cyl(4.2, 23, [0, 0, 13], 'z', 2.8), cyl(2.4, 8, [0, 0, -1.5], 'z'));
      s = union(s, box(1.3, 4.6, 5, [0, 0, -7]), box(4.6, 1.3, 5, [0, 0, -7]));
      const grooves: Manifold[] = [];
      for (let i = 0; i < 6; i++) grooves.push(turn(box(1.1, 2.1, 16, [0, 4, 13], 0.4), 0, 0, i * 60));
      return cut(s, ...grooves);
    });
    part('Printed cross screwdriver', driver, red);
    cache.set(key, records);
    for (const m of garbage) m.delete();
  }
  const group = new THREE.Group(); const parts: CarPart[] = []; const tools: CarPart[] = [];
  for (const record of cache.get(key)!) {
    const mesh = new THREE.Mesh(record.geometry, new THREE.MeshStandardMaterial({ color: record.color, roughness: 0.44 }));
    mesh.position.set(...record.at); mesh.rotation.set(...record.rotation); mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.partName = record.name;
    if (record.name === 'Printed cross screwdriver') tools.push({ name: record.name, mesh });
    else { group.add(mesh); parts.push({ name: record.name, mesh }); }
  }
  group.scale.setScalar(scale); group.updateMatrixWorld(true);
  return { group, parts, tools, bounds: new THREE.Box3().setFromObject(group, true) };
}
