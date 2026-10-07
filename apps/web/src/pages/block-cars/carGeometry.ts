import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import Module, { type Manifold, type ManifoldToplevel, type Mesh } from 'manifold-3d';
import wasmUrl from 'manifold-3d/manifold.wasm?url';

export type ModuleKind = 'tray' | 'tanker' | 'cage' | 'recycle' | 'crate' | 'sedan' | 'crane' | 'loader' | 'hook' | 'fire' | 'mixer' | 'sport' | 'pickup' | 'dump' | 'van';
export type CarModel = { id: string; page: number; en: string; vi: string; kind: ModuleKind; cab: string; body: string; wheels: 4 | 6; beds?: 1 | 2 | 3; partCount: number; category: string };
export type CarPart = { name: string; mesh: THREE.Mesh };
export type CarAssembly = { group: THREE.Group; parts: CarPart[]; tools: CarPart[]; bounds: THREE.Box3; clearance: number; width: number };
export type CarOptions = { width?: number; cabType?: 'flat' | 'hood' | 'car'; frontTool?: 'none' | 'bucket' | 'roller' };
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
export function buildCar(model: CarModel, scale: number, clearance = 0.25, options: CarOptions = {}): CarAssembly {
  const width = options.width ?? 42;
  const lateral = width / 34;
  const wheelCenter = 13 + 3.8 / lateral;
  const wheelScrewCenter = 13 + 7.6 / lateral;
  const axleHeight = 8;
  let panelWidth = lateral;
  const key = `${model.id}:${clearance.toFixed(2)}:${width}:${options.cabType ?? 'reference'}:${options.frontTool ?? 'reference'}`;
  if (!cache.has(key)) {
    const garbage: Manifold[] = [];
    const hold = (m: Manifold) => { garbage.push(m); return m; };
    const M = api.Manifold;
    const common = (name: string, make: () => Manifold) => {
      const id = `${name}:${clearance}:${width}`;
      if (!shared.has(id)) shared.set(id, make().getMesh());
      return hold(new M(shared.get(id)!));
    };
    const shift = (m: Manifold, x = 0, y = 0, z = 0) => hold(m.translate([x, y, z * panelWidth]));
    const turn = (m: Manifold, x = 0, y = 0, z = 0) => hold(m.rotate([x, y, z]));
    const union = (...m: Manifold[]) => hold(M.union(m));
    const cut = (a: Manifold, ...b: Manifold[]) => hold(a.subtract(union(...b)));
    const box = (x: number, y: number, z: number, at: number[] = [0, 0, 0], radius = 0.55) => {
      z *= panelWidth;
      if (radius === 0) return shift(hold(M.cube([x, y, z], true)), ...at as [number, number, number]);
      const r = Math.min(radius, x / 3, y / 3, z / 3);
      // Build normals on a unit cube: the upstream geometry derives its normals
      // from dimensioned positions, which shrinks thin faces unevenly.
      const g = new RoundedBoxGeometry(1, 1, 1, 4, 0.1);
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
    const cyl = (r: number, h: number, at: number[] = [0, 0, 0], axis: 'x' | 'y' | 'z' = 'y', rTop = r) => shift(turn(hold(M.cylinder(axis === 'z' ? h * panelWidth : h, r, rTop, 64, true)), axis === 'y' ? 90 : 0, axis === 'x' ? 90 : 0), ...at as [number, number, number]);
    const sphere = (r: number, at: number[]) => shift(hold(M.sphere(r, 32)), ...at as [number, number, number]);
    const profile = (points: [number, number][], width: number, bevel = 0.5, cornerRadius = 0) => {
      width *= panelWidth;
      let s = new THREE.Shape(points.map(p => new THREE.Vector2(...p)));
      if (cornerRadius) {
        // Round the silhouette as well as the extrusion edges. Inset the
        // outline before beveling so the finished module keeps its envelope.
        const rounded = new THREE.Shape();
        points.forEach((p, i) => {
          const prev = new THREE.Vector2(...points[(i + points.length - 1) % points.length]);
          const next = new THREE.Vector2(...points[(i + 1) % points.length]);
          const vertex = new THREE.Vector2(...p);
          const distance = Math.min(cornerRadius, prev.distanceTo(vertex) * 0.3, next.distanceTo(vertex) * 0.3);
          const entry = vertex.clone().add(prev.sub(vertex).normalize().multiplyScalar(distance));
          const exit = vertex.clone().add(next.sub(vertex).normalize().multiplyScalar(distance));
          if (i === 0) rounded.moveTo(entry.x, entry.y); else rounded.lineTo(entry.x, entry.y);
          rounded.quadraticCurveTo(vertex.x, vertex.y, exit.x, exit.y);
        });
        rounded.closePath();
        const outline = rounded.getPoints(8);
        // ExtrudeGeometry accepts either winding, whereas a Manifold inset
        // needs a positive outer contour (boom/bucket silhouettes run clockwise).
        if (THREE.ShapeUtils.area(outline) < 0) outline.reverse();
        const section = new api.CrossSection([outline.map(p => [p.x, p.y] as [number, number])]);
        const inset = section.offset(-bevel, 'Round', 2, 24);
        s = new THREE.Shape(inset.toPolygons()[0].map(p => new THREE.Vector2(...p)));
        inset.delete(); section.delete();
      }
      const g = new THREE.ExtrudeGeometry(s, { depth: width - bevel * 2, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 6, curveSegments: 24, steps: 1 });
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
      records.push({ name, geometry: shaded, color, at: [at[0], at[1], at[2] * lateral], rotation });
    };
    const beige = '#dabb92'; const black = '#202125'; const red = '#ea183b'; const yellow = '#f2ce05';
    const revolvedY = (points: [number, number][]) => {
      const section = new api.CrossSection([points]);
      const solid = hold(section.revolve(96).rotate([-90, 0, 0]));
      section.delete(); return solid;
    };
    // Photo of the dismantled kit: a spool stud catches three flexible petals.
    // Running clearance is capped at the throat to preserve its retaining lip.
    // All cuts stop below the floor; the cargo interior stays closed.
    const socket = (solid: Manifold) => {
      const throat = 3.3 + Math.min(clearance, 0.35);
      let s = union(cut(solid, box(200, 20, 200, [0, -10, 0], 0)), box(31.5 - clearance * 2, 1.6, 29.8 - clearance * 2, [0, -0.55, 0], 0.9));
      s = cut(s, revolvedY([[0, -2], [4.2 + clearance, -2], [4.2 + clearance, -0.75], [throat, -0.4], [throat, 0.35], [4 + clearance, 0.6], [4 + clearance, 2.35], [0, 2.35]]));
      for (let petal = 0; petal < 3; petal++) {
        const start = petal * 120 + 10;
        const arc: [number, number][] = [];
        for (let i = 0; i <= 24; i++) { const angle = (start + i * 98 / 24) * Math.PI / 180; arc.push([5.9 * Math.cos(angle), 5.9 * Math.sin(angle)]); }
        for (let i = 24; i >= 0; i--) { const angle = (start + i * 98 / 24) * Math.PI / 180; arc.push([5.25 * Math.cos(angle), 5.25 * Math.sin(angle)]); }
        const section = new api.CrossSection([arc]);
        const slit = hold(section.extrude(4.2).rotate([-90, 0, 0]).translate([0, -1.6, 0]));
        section.delete();
        // Join one end of the arc to the throat, leaving the other end as a hinge.
        const branch = hold(M.cube([3.2, 4.2, 0.65], true).translate([4.4, 0.5, 0]).rotate([0, start, 0]));
        s = cut(s, slit, branch);
      }
      return s;
    };
    const snapStud = () => revolvedY([[0, 19.45], [4.2, 19.45], [4.2, 19.65], [3.3, 20.25], [3.3, 21.55], [4, 21.75], [4, 22.55], [3.8, 22.9], [0, 22.9]]);
    // A plan envelope adds the wide diagonal nose corners visible in the photos.
    const noseEnvelope = (halfWidth: number) => {
      const points: [number, number][] = [[-17.5, -halfWidth + 3], [-14.5, -halfWidth], [18, -halfWidth], [18, halfWidth], [-14.5, halfWidth], [-17.5, halfWidth - 3]];
      return shift(turn(profile(points, 100 / panelWidth, 0.65, 1.2), 90, 0, 0), 0, 30);
    };
    // One X/Z section drives BOTH halves. The PDF's tall rail has two
    // retaining shoulders and a shallow central relief down its outer face.
    const railSection = () => new api.CrossSection([[
      [17, -5.8], [19.2, -5.8], [19.2, -7.5], [19.4, -7.7],
      [21, -7.7], [21.2, -7.5], [21.2, -0.55], [20.8, -0.55],
      [20.8, 0.55], [21.2, 0.55], [21.2, 7.5], [21, 7.7],
      [19.4, 7.7], [19.2, 7.5], [19.2, 5.8], [17, 5.8],
    ].map(([x, z]) => [x, z * panelWidth] as [number, number])]);
    const slide = (female: boolean) => {
      const section = railSection();
      const contour = female ? section.offset(clearance, 'Round', 2, 16) : section;
      const solid = hold(contour.extrude(female ? 17.25 + clearance : 14, 0, 0, [1, 1], true));
      const result = hold(solid.rotate([90, 0, 0]).translate([female ? -36 : 0, female ? (16 + clearance - 1.25) / 2 : 9, 0]));
      if (female) contour.delete(); section.delete();
      return result;
    };
    const rail = () => slide(false);
    const railSocket = (s: Manifold) => cut(s, slide(true));
    // Single-start right-hand helix, rather than stacked circular ridges.
    // The female tool keeps the full section beyond the tapered male runout,
    // so unscrewing follows the same lead without hitting the end of a groove.
    const thread = (female = false) => {
      const segments = 96, rows = female ? 260 : 136;
      const start = female ? -16 : -13.4, end = female ? -3 : -6.6;
      const points: number[] = [], triangles: number[] = [];
      for (let j = 0; j <= rows; j++) {
        const z = start + (end - start) * j / rows;
        const runout = female ? 1 : Math.min(1, (z - start) / 0.7, (end - z) / 0.5);
        for (let i = 0; i < segments; i++) {
          const angle = i * 2 * Math.PI / segments;
          const phase = ((z / 2.2 - angle / (2 * Math.PI)) % 1 + 1) % 1;
          const distance = Math.min(phase, 1 - phase);
          const crest = Math.max(0, Math.min(1, (0.39 - distance) / 0.28));
          const radius = 2.2 + (female ? clearance / 2 : 0) + 0.5 * crest * runout;
          points.push(radius * Math.cos(angle), radius * Math.sin(angle), z);
        }
      }
      for (let j = 0; j < rows; j++) for (let i = 0; i < segments; i++) {
        const a = j * segments + i, b = j * segments + (i + 1) % segments, c = a + segments, d = b + segments;
        triangles.push(a, b, d, a, d, c);
      }
      const bottom = points.length / 3; points.push(0, 0, start);
      const top = points.length / 3; points.push(0, 0, end);
      for (let i = 0; i < segments; i++) {
        const next = (i + 1) % segments;
        triangles.push(bottom, next, i, top, rows * segments + i, rows * segments + next);
      }
      return hold(new M(new api.Mesh({ numProp: 3, vertProperties: new Float32Array(points), triVerts: new Uint32Array(triangles) })));
    };
    const threadedBore = (x: number, y: number, z: number, rotation: [number, number, number] = [0, 0, 0]) =>
      hold(common('female-wheel-thread', () => thread(true)).rotate(rotation).translate([x, y, z]));
    const chassis = (front: boolean, axle: boolean, tongue: boolean, pocket: boolean) => {
      let s = box(35.7, 21, 34, [0, 10.5, 0], 2.1);
      if (front) {
        // Lower nose corners sweep upward, rather than ending in a square box.
        s = cut(s, profile([[-30, -10], [-30, 4], [-17.85, 3], [-14.85, 0], [-14.85, -10]], 100, 0));
      }
      s = cut(s, box(31.5, 4, 29.8, [0, 21.5, 0], 0.25));
      s = union(s, snapStud());
      if (axle) {
        for (const side of [-1, 1]) {
          s = cut(s, cyl(11.25, 6, [0, axleHeight, side * 16], 'z'), box(22.5, 10, 6, [0, axleHeight - 5, side * 16]));
          const archSection = new api.CrossSection([[[11.25, -0.85 * panelWidth], [12.2, -0.85 * panelWidth], [12.65, -0.5 * panelWidth], [12.75, 0], [12.65, 0.5 * panelWidth], [12.2, 0.85 * panelWidth], [11.25, 0.85 * panelWidth]]]);
          const archRing = shift(hold(archSection.revolve(128)), 0, axleHeight, side * 16.25);
          archSection.delete();
          const arch = cut(archRing, box(30, 25, 4, [0, axleHeight - 12.5, side * 16.25]), box(30, 20, 4, [0, 31, side * 16.25], 0));
          s = union(s, arch);
          s = cut(s, cyl(2.2 + clearance / 2, 17, [0, axleHeight, side * 8.5], 'z'));
          s = cut(s, threadedBore(0, axleHeight, side * wheelScrewCenter * lateral, [0, side < 0 ? 180 : 0, 0]));
        }
      }
      if (tongue) s = union(s, rail());
      if (pocket) s = railSocket(s);
      if (front && !pocket) {
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
        const phase = ((i * 32 / segments + Math.abs(z) * 0.12) % 1 + 1) % 1;
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
    const driveOutline: [number, number][] = Array.from({ length: 96 }, (_, i) => {
      const angle = i * Math.PI * 2 / 96;
      const radius = 2.45 + 0.7 * Math.cos(angle * 4);
      return [radius * Math.cos(angle), radius * Math.sin(angle)];
    });
    const screw = () => {
      // Low rounded head seats on the recessed hub, nearly flush with the
      // tyre sidewall. Keep the bearing shoulder and threaded shaft separate.
      const headSection = new api.CrossSection([[[0, -1.4], [4.25, -1.4], [4.6, -1.25], [4.75, -0.95], [4.75, -0.5], [4.6, -0.18], [4.25, 0], [0, 0]]]);
      const head = hold(headSection.revolve(96)); headSection.delete();
      let s = union(head, hold(cyl(2.2, 12.8, [0, 0, -7], 'z').scale([1, 1, 1 / lateral])));
      const recess = hold(shift(profile(driveOutline, 1.8, 0.1), 0, 0, -0.1).scale([1, 1, 1 / lateral]));
      return union(cut(s, recess), thread());
    };
    const tray = (height = 8) => {
      let s = box(35.5, height, 33.8, [0, height / 2, 0], 1.8);
      s = cut(s, box(30.5, height + 1, 28.8, [0, height / 2 + 3.8, 0], 0.9));
      for (const z of [-16.75, 16.75]) s = union(s, box(25, 1.25, 0.9, [0, 3.5, z]));
      return socket(s);
    };
    const cabin = (kind: 'flat' | 'hood' | 'car') => {
      const points: [number, number][] = kind === 'flat' ? [[-17.5, 0], [17.5, 0], [17.5, 27], [-8, 27], [-17.5, 2]] : kind === 'hood' ? [[-17.5, 0], [17.5, 0], [17.5, 27], [-4.5, 27], [-9, 11], [-12.5, 11], [-17.5, 6.5]] : [[-17.5, 0], [17.5, 0], [17.5, 23], [5, 23], [-8, 10], [-16, 8]];
      let s = profile(points, 33.5, 1.1, 2.2);
      if (kind === 'hood') s = hold(s.intersect(noseEnvelope(33.5 * panelWidth / 2)));
      const roofY = kind === 'car' ? 23 : 27;
      const windowX = kind === 'flat' ? 3 : kind === 'hood' ? 6 : 9;
      const windowWidth = kind === 'car' ? 14 : 17;
      for (const side of [-1, 1]) {
        const window = kind === 'hood' ? shift(profile([[-6.3, 11.7], [14, 11.7], [14, 24], [-2.9, 24]], 2, 0.3, 0.65), 0, 0, side * 16.65) : box(windowWidth, kind === 'car' ? 10 : 14, 2, [windowX, roofY - 10, side * 16.65], 0.65);
        s = cut(s, window);
        s = union(s, box(1.8, 4.5, 1.4, [kind === 'hood' ? -7.2 : windowX - windowWidth / 2 - 1.8, 11, side * 17.1], 0.6), shift(sphere(1.1, [0, 0, 0]), 12.7, 5.5, side * 16.7));
      }
      const angle = kind === 'flat' ? -21 : kind === 'hood' ? -15.7 : -45;
      const windshieldX = kind === 'flat' ? -13.7 : kind === 'hood' ? -7.2 : -2.2;
      const windshieldY = kind === 'flat' ? 14.8 : kind === 'hood' ? 19 : 16.5;
      s = cut(s, shift(turn(box(3.6, kind === 'car' ? 14 : kind === 'hood' ? 13 : 18, 25, [0, 0, 0], 0.55), 0, 0, angle), windshieldX, windshieldY, 0));
      for (const z of [-7, 7]) {
        s = union(s, shift(turn(box(0.95, 5.5, 0.8, [0, 0, 0], 0.3), 0, 0, angle - 15), windshieldX - 2.1, windshieldY - 5.9, z), cyl(0.95, 1.5, [windshieldX - 3, windshieldY - 8, z + 0.7], 'x'));
      }
      if (kind === 'flat') for (const z of [-8, 0, 8]) {
        s = cut(s, box(12, 2.1, 0.65, [3, roofY + 0.4, z - 2], 0.25), box(12, 2.1, 0.65, [3, roofY + 0.4, z + 2], 0.25), box(0.65, 2.1, 4.65, [9, roofY + 0.4, z], 0.25));
      }
      if (kind === 'hood') {
        s = union(s, box(4.8, 0.65, 27, [-10.3, 11.15, 0], 0.3));
        for (const side of [-1, 1]) s = union(s, cyl(1.5, 27, [16.3, 14, side * 16.1]), cyl(0.55, 3, [16.3, 28.2, side * 16.1], 'y', 1.5), sphere(0.55, [16.3, 29.5, side * 16.1]));
        s = union(s, box(21.2, 0.8, 28, [6.4, 27.2, 0], 0.4));
      }
      // Extrusion bevels extend beyond the outline: leave a real module seam.
      s = cut(s, box(40, 100, 80, [37.75, 30, 0], 0));
      return socket(s);
    };
    const frontTool = options.frontTool ?? (model.kind === 'loader' ? 'bucket' : model.kind === 'crate' ? 'roller' : 'none');
    const long = model.beds === 2 || model.beds === 3;
    const moduleXs = model.beds === 3 ? [-18, 18, 54, 90] : model.beds === 2 ? [-18, 18, 54] : [-18, 18];
    for (const [i, x] of moduleXs.entries()) {
      const axle = !(long && i === moduleXs.length - 2 && i > 0);
      const pocket = i > 0 || frontTool !== 'none';
      part(i === 0 ? (pocket ? 'Front chassis with tool slide socket' : 'Front chassis with grille') : `Chassis ${i + 1}`, common(`chassis:${i === 0}:${axle}:${i < moduleXs.length - 1}:${pocket}`, () => chassis(i === 0, axle, i < moduleXs.length - 1, pocket)), beige, [x, 0, 0]);
    }
    const tyreSolid = common('tyre', tyre); const screwSolid = common('screw', screw);
    let wheelIndex = 0;
    for (const [i, x] of moduleXs.entries()) if (!(long && i === moduleXs.length - 2 && i > 0)) for (const side of [-1, 1]) {
      part(`Tyre ${++wheelIndex}`, tyreSolid, black, [x, axleHeight, side * wheelCenter]);
      part(`Cross socket wheel screw ${wheelIndex}`, screwSolid, beige, [x, axleHeight, side * wheelScrewCenter], [0, side < 0 ? Math.PI : 0, 0]);
    }
    const addRoller = () => {
      let roller = union(box(7, 13, 34, [14, 9.5, 0], 0.6), box(23, 5, 3, [2, 8.4, -16]), box(23, 5, 3, [2, 8.4, 16]), rail());
      roller = cut(union(roller, cyl(4.5, 3, [-7, 8.4, -16], 'z'), cyl(4.5, 3, [-7, 8.4, 16], 'z')), cyl(2.55 + clearance, 40, [-7, 8.4, 0], 'z'));
      const rollerScrewCenter = 17.5 + 1.5 / lateral;
      let drum = cut(cyl(8.4, 28, [0, 0, 0], 'z'), cyl(2.2 + clearance / 2, 32, [0, 0, 0], 'z'));
      for (const side of [-1, 1]) drum = cut(drum, threadedBore(0, 0, side * rollerScrewCenter * lateral, [0, side < 0 ? 180 : 0, 0]));
      part('Road roller fork', roller, red, [-54, 0, 0]); part('Road roller drum', drum, yellow, [-61, 8.4, 0]);
      for (const side of [-1, 1]) part(`Roller screw ${side}`, screwSolid, beige, [-61, 8.4, side * rollerScrewCenter], [0, side < 0 ? Math.PI : 0, 0]);
    };
    const addFrontBucket = () => {
      const arc = (a: [number, number], b: [number, number], c: [number, number]): [number, number][] => Array.from({ length: 16 }, (_, i) => {
        const t = (i + 1) / 16, u = 1 - t;
        return [u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1]];
      });
      let bucket = profile([[-17, 0], [9, 0], [9, 16], [5, 16], ...arc([5, 16], [3, 4], [-17, 3])], 33, 0.5);
      bucket = cut(bucket, profile([[-18, 3], [5, 3], [5, 19], [0, 19], ...arc([0, 19], [-1, 6], [-18, 4.5])], 28, 0));
      for (let i = 0; i < 8; i++) bucket = union(bucket, box(4, 1.8, 2.2, [-18, 1, -13 + i * 3.7], 0.35));
      bucket = union(shift(bucket, 8.3), box(8.6, 10, 12, [13.5, 9.5, 0], 0.45), rail()); part('Front loader scoop with eight teeth', bucket, red, [-54, 0, 0]);
    };
    const cabType = options.cabType ?? (['sedan', 'sport', 'pickup'].includes(model.kind) ? 'car' : ['tanker', 'cage', 'recycle', 'crane', 'loader', 'hook', 'mixer'].includes(model.kind) ? 'hood' : 'flat');
    part('Cabin with recessed windows and wipers', common(`cab:${cabType}`, () => cabin(cabType)), model.cab, [-18, 21, 0]);
    const at: [number, number, number] = [18, 21, 0];
    const body = (name: string, s: Manifold, color = model.body) => part(name, socket(s), color, at);
    const shell = (height = 26) => box(35.5, height, 33.8, [0, height / 2, 0], 1.8);
    const sideRibs = (s: Manifold, count: number, start = 5, gap = 3.2) => {
      const ribs: Manifold[] = [];
      for (const z of [-17, 17]) for (let i = 0; i < count; i++) ribs.push(box(28, 1.3, 1, [0, start + i * gap, z], 0.4));
      return union(s, ...ribs);
    };
    switch (model.kind) {
      case 'tray': for (let i = 0; i < (model.beds ?? 1); i++) part(`Cargo tray ${i + 1}`, tray(), model.body, [18 + i * 36, 21, 0]); break;
      case 'tanker': {
        let tank = union(shell(3.5), hold(cyl(14.8, 32, [0, 16, 0], 'x').scale([1, 1, lateral])));
        tank = cut(tank, box(45, 20, 40, [0, -10, 0]));
        for (const x of [-10.5, 10.5]) tank = union(tank, cut(hold(cyl(15.4, 1.2, [x, 16, 0], 'x').scale([1, 1, lateral])), box(45, 20, 40, [0, -10, 0])));
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
        let s = profile([[-17, 0], [17, 0], [15, 27], [-12, 27]], 33.5, 1, 1.8);
        s = cut(s, box(34, 21, 28, [4, 13, 0], 0.8)); s = sideRibs(s, 4);
        s = cut(s, box(24, 1.5, 0.8, [-1, 27.5, -11]), box(24, 1.5, 0.8, [-1, 27.5, 11]), box(0.8, 1.5, 22, [-13, 27.5, 0]));
        // Raised triangular recycling arrows, fused into both side panels.
        for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
          const arrow = profile([[-3, -1], [1, -1], [1, -2.6], [4.3, 0], [1, 2.6], [1, 1], [-3, 1]], 0.9, 0);
          s = union(s, shift(turn(arrow, 0, 0, i * 120), Math.cos(i * 2 * Math.PI / 3) * 3, 18 + Math.sin(i * 2 * Math.PI / 3) * 3, side * 16.7));
        }
        for (const side of [-1, 1]) s = union(s, cyl(2.8, 4, [16.5, 25.5, side * 12], 'z'));
        s = cut(s, cyl(1.8 + clearance, 34, [16.5, 25.5, 0], 'z'));
        body('Recycling hopper with embossed arrows', s);
        let lid = box(1.8, 21, 24, [0.6, 0, 0], 0.7); lid = union(lid, cyl(1.8, 28, [0, 11.5, 0], 'z'));
        for (const side of [-1, 1]) lid = cut(lid, box(4, 2.5, 5, [0, 8.95, side * 12], 0.1));
        part('Hinged recycling rear door', lid, '#c8c9cc', [34.5, 35, 0]); break;
      }
      case 'crate': {
        part('Cargo tray', tray(), model.body, at);
        let crate = box(27, 25, 27, [0, 12.5, 0], 0.4);
        const seams: Manifold[] = [];
        for (let i = 1; i < 6; i++) for (const side of [-1, 1]) seams.push(box(24, 0.55, 1, [0, i * 4, side * 13.5], 0), box(1, 0.55, 24, [side * 13.5, i * 4, 0], 0));
        for (let i = 0; i < 6; i++) seams.push(box(0.6, 1, 24, [-10 + i * 4, 25, 0], 0));
        crate = cut(crate, ...seams); part('Wood crate with plank grooves', crate, '#c5a176', [18, 28, 0]);
        break;
      }
      case 'sedan': {
        let s = profile([[-17.4, 0], [17.4, 0], [17.4, 8], [10, 9], [3.5, 23], [-17.4, 23]], 33.5, 1, 1.8);
        for (const side of [-1, 1]) s = cut(s, box(15.5, 11, 2, [-6, 15, side * 16.7], 0.7));
        s = union(s, box(4, 4, 9, [-12, 24, 0], 0.6));
        s = cut(s, box(40, 100, 80, [-37.75, 30, 0], 0));
        body('City car rear cabin', s); break;
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
          s = union(s, cyl(4.3, 1.2, [17.95, 14, 0], 'x'));
          s = cut(s, threadedBore(25.1, 14, 0, [0, 90, 0]), cyl(2.2 + clearance / 2, 20, [16, 14, 0], 'x'));
        }
        body(model.kind === 'sport' ? 'SUV rear body with roof rack' : 'Van body with recessed panels', s);
        if (model.kind === 'sport') { part('Rear spare tyre', tyreSolid, black, [39.3, 35, 0], [0, Math.PI / 2, 0]); part('Spare wheel screw', screwSolid, beige, [43.1, 35, 0], [0, Math.PI / 2, 0]); } break;
      }
      case 'dump': {
        // Return the canopy to the FRONT WALL before closing the outline.
        // Closing straight from the canopy tip to the floor filled the cabin
        // space with a large diagonal wedge.
        let s = profile([[-17, 0], [17, 0], [17, 28], [-13, 28], [-17, 32], [-28, 35], [-33, 35], [-25, 30], [-17, 30]], 34, 0.8, 1.2);
        s = cut(s, box(29, 37, 29, [0, 21, 0], 0.65), box(17, 20, 29, [-24, 38, 0], 0.5));
        s = sideRibs(s, 6, 5, 3.5); for (const side of [-1, 1]) s = union(s, shift(turn(box(1.6, 28, 1.1, [0, 0, 0], 0.45), 0, 0, -44), 3, 15, side * 17));
        body('Open ribbed dump hopper and front canopy', s); break;
      }
      case 'crane':
      case 'loader':
      case 'hook': {
        let base = union(shell(8), box(31, 1.8, 31, [0, 8.8, 0], 0.6), box(25, 3, 25, [0, 11, 0], 0.65), cyl(9, 2.4, [0, 13.5, 0]), cyl(6.8, 2, [0, 15, 0]), cyl(2.6, 5, [0, 18, 0]));
        base = sideRibs(base, 1, 6); for (const side of [-1, 1]) for (let i = 0; i < 5; i++) base = union(base, box(2.8, 2, 0.9, [-12 + i * 6, 2.4, side * 17], 0.3));
        body('Stepped rotating machinery base', base, yellow);
        // The round turret, pin and clevis share a fixed standard. Changing
        // the chassis width must not erase the cheeks around the round dome.
        panelWidth = 1;
        // The photographed pivot is a shallow cylinder and low hemisphere.
        let turret = union(cyl(7.7, 6, [0, 3, 0]), sphere(7.7, [0, 6, 0]));
        turret = cut(turret, box(40, 20, 40, [0, -10, 0], 0), cyl(2.6 + clearance, 8, [0, 1, 0]), cyl(2 + clearance, 19, [4, 10, 0], 'z'), box(10, 14, (model.kind === 'hook' ? 8 : 6) + clearance * 2, [6, 12, 0]));
        part('Dome pivot with boom axle bore', turret, yellow, [18, 37, 0]);
        // Keep the elevated underside above the dome behind the main hinge.
        let boom = profile([[-36, -1], [-36, 6], [-3, 9], [8, 3], [8, -4], [1, -4], [-3, 7], [-5, 7]], 6, 0.55, 0.8);
        for (const side of [-1, 1]) for (const [left, right] of [[-29, -21], [-19, -12], [-10, -6]]) {
          const lower = (x: number) => -1 + (x + 36) * 8 / 31 + 0.55;
          const upper = (x: number) => 6 + (x + 36) / 11 - 0.55;
          boom = cut(boom, shift(profile([[left, lower(left)], [right, lower(right)], [right, upper(right)], [left, upper(left)]], 1, 0.18, 0.3), 0, 0, side * 3));
        }
        if (model.kind === 'hook') boom = cut(union(box(32, 7, 8, [-12, 9, 0], 0.7), box(6, 15, 6, [1, 3.5, 0], 0.4), cyl(2.9, 6, [0, 0, 0], 'z')), box(25, 4 + clearance * 2, 4.5 + clearance * 2, [-18, 9, 0], 0.25));
        boom = union(boom, cyl(2.0, 13, [0, 0, 0], 'z'));
        if (model.kind !== 'hook') {
          // The real boom owns the female fork; the bucket's narrow tongue
          // and transverse pivots snap between its rounded retaining cheeks.
          boom = union(boom, cyl(4.4, 8, [-36, 2, 0], 'z'), box(7, 8, 8, [-32.5, 2, 0], 0.7));
          boom = cut(boom, box(12, 12, 4 + clearance * 2, [-36, 2, 0], 0), cyl(1.8 + clearance, 10, [-36, 2, 0], 'z'), box(3.2, 5, 10, [-36, -0.5, 0], 0.3));
          // Small transverse ribs remain on the inner bridge behind the slot.
          for (const y of [-0.4, 1.6, 3.6]) boom = union(boom, box(0.7, 0.8, 4, [-29.8, y, 0], 0.25));
        }
        const boomAngle = model.kind === 'hook' ? 0 : -0.25;
        const tipX = 22 - 36 * Math.cos(boomAngle) - 2 * Math.sin(boomAngle);
        const tipY = 47 - 36 * Math.sin(boomAngle) + 2 * Math.cos(boomAngle);
        part('Detailed hinged boom', boom, red, [22, 47, 0], [0, 0, boomAngle]);
        if (model.kind === 'hook') {
          let hook = union(box(24, 3.7, 4.3, [-1, 0, 0], 0.4), cut(cyl(4.8, 3, [-16, 0, 0], 'z'), cyl(2.7, 5, [-16, 0, 0], 'z'), box(5, 6, 6, [-20, 0, 0])));
          for (let i = 0; i < 5; i++) hook = union(hook, box(0.6, 4, 4.5, [-8 - i, 0, 0], 0.2));
          part('Sliding lift fork with open hook', hook, red, [-4, 56, 0]);
        } else {
          let bucket = profile([[-14, -3], [-8, 9], [0, 9], [2, 5], [2, -1], [-5, -6]], 15, 0.65, 1.1);
          bucket = cut(bucket, profile([[-18, -4], [-10, 7], [-1, 7], [0, 4], [0, -1], [-5, -4]], 12, 0.3, 0.7));
          bucket = union(bucket, profile([[-1, 0], [7, 0], [7, 4], [-1, 8]], 4, 0.35, 0.65), cyl(1.8, 8 - clearance * 2, [7, 2, 0], 'z'));
          for (let i = 0; i < 5; i++) bucket = union(bucket, box(3, 2, 1.5, [-11, -3.5, -6 + i * 3], 0.3));
          part('Upper excavator scoop with teeth', bucket, red, [tipX - 7, tipY - 2, 0]);
        }

        panelWidth = lateral;
        break;
      }
      case 'fire': {
        let s = shell(25); for (const side of [-1, 1]) { s = cut(s, box(19, 16, 1.7, [3, 12, side * 16.8], 0.6)); s = union(s, box(1.8, 22, 1, [-11, 13, side * 17], 0.3), box(1.8, 22, 1, [-4, 13, side * 17], 0.3)); for (let i = 0; i < 9; i++) s = union(s, box(7, 0.8, 1.2, [-7.5, 4 + i * 2.2, side * 17], 0.2)); }
        s = union(s, cyl(4.5, 3, [1, 26, 0]), cyl(2.4, 4, [1, 29, 0])); body('Fire equipment body with side ladders', s, red);
        let cradle = union(box(12, 3, 17, [0, 0, 0]), box(10, 6, 2, [0, 3, -7.5]), box(10, 6, 2, [0, 3, 7.5])); cradle = cut(cradle, cyl(2.4 + clearance, 8, [0, 0, 0]), cyl(4.5 + clearance, 3, [0, -1.5, 0]), cyl(1.6 + clearance, 19, [0, 4, 0], 'z'));
        part('Ladder rotation cradle', cradle, yellow, [19, 49, 0]);
        let ladder = union(box(50, 3, 2, [-19, 0, -5]), box(50, 3, 2, [-19, 0, 5])); for (let i = 0; i < 12; i++) ladder = union(ladder, box(1.4, 1.5, 10, [-42 + i * 4, 0, 0], 0.35));
        ladder = union(ladder, cyl(1.6, 16, [0, 0, 0], 'z')); part('Extending fire ladder', ladder, red, [19, 53, 0], [0, 0, -0.13]);
        let extension = union(box(26, 2, 1.2, [-13, 0, -3.2]), box(26, 2, 1.2, [-13, 0, 3.2])); for (let i = 0; i < 6; i++) extension = union(extension, box(1, 1.2, 6.4, [-24 + i * 4.5, 0, 0], 0.25));
        part('Silver telescopic ladder insert', extension, '#a9adb2', [-23, 60.3, 0], [0, 0, -0.13]); break;
      }
      case 'mixer': {
        const mixerAngle = 0.35;
        const mixerTilt = (s: Manifold) => shift(turn(s, 0, 0, mixerAngle * 180 / Math.PI), 0, 20.7, 0);
        let support = union(shell(4), box(20, 4, 27, [17.5, 2, 0], 0.3), mixerTilt(box(3, 20, 27, [-17.5, -7, 0], 0.65)), mixerTilt(box(3, 28, 27, [18, -11, 0], 0.65)));
        support = cut(support, mixerTilt(cyl(2.55 + clearance, 9, [18, 0, 0], 'x')));
        support = union(support, mixerTilt(cyl(2.3, 10, [-16, 0, 0], 'x')));
        support = cut(support, box(40, 100, 80, [-37.75, 30, 0], 0));
        body('Mixer cradle', support, yellow);
        let drum = union(cyl(12.8, 18, [0, 0, 0], 'x'), cyl(9.3, 7, [12, 0, 0], 'x', 12.8), cyl(12.8, 4, [-11, 0, 0], 'x', 10.6));
        drum = cut(drum, cyl(7, 9, [15, 0, 0], 'x'));
        for (let i = 0; i < 6; i++) drum = cut(drum, turn(box(11, 1.4, 3.8, [0, 12.6, 0], 0.6), i * 60, 0, 0));
        drum = cut(drum, cyl(2.2 + clearance / 2, 40, [0, 0, 0], 'x'), cyl(2.55 + clearance, 12, [-14, 0, 0], 'x'), threadedBore(22, 0, 0, [0, 90, 0]));
        part('Tapered mixer drum with open mouth', drum, red, [18, 41.7, 0], [0, 0, mixerAngle]);
        const screwEuler = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeRotationZ(mixerAngle).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2)));
        part('Mixer retaining screw', screwSolid, beige, [18 + 22 * Math.cos(mixerAngle), 41.7 + 22 * Math.sin(mixerAngle), 0], [screwEuler.x, screwEuler.y, screwEuler.z]); break;
      }
    }
    if (frontTool === 'roller') addRoller();
    if (frontTool === 'bucket') addFrontBucket();
    const driver = common('screwdriver', () => {
      let s = union(cyl(4.2, 23, [0, 0, 13], 'z', 2.8), cyl(2.4, 8, [0, 0, -1.5], 'z'));
      s = union(s, shift(profile(driveOutline.map(([x, y]) => [x * 0.87, y * 0.87]), 5, 0.1), 0, 0, -7));
      const grooves: Manifold[] = [];
      for (let i = 0; i < 6; i++) grooves.push(turn(box(1.1, 2.1, 16, [0, 4, 13], 0.4), 0, 0, i * 60));
      return hold(cut(s, ...grooves).scale([1, 1, 1 / lateral]));
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
  return { group, parts, tools, bounds: new THREE.Box3().setFromObject(group, true), clearance, width };
}
