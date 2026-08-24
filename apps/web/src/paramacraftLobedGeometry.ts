import * as THREE from 'three';

export interface LobedPillarParams {
  radius: number;
  lobeCount: number;
  lobeAmplitude: number;
  twistRate: number;
  height: number;
  wall: number;
  floorThickness: number;
  rimHeight: number;
  patternLineWidth: number;
  patternSpacing: number;
  bodyColor: string;
  accentColor: string;
}

type Point = { x: number; y: number; z: number };

function outerRadius(angle: number, y: number, params: LobedPillarParams) {
  const phase = (params.twistRate * y * Math.PI) / 180;
  const lobes = Math.max(3, Math.round(params.lobeCount));
  const amplitude = Math.max(0, params.lobeAmplitude);
  return Math.max(params.wall * 2 + 2, params.radius + amplitude * Math.cos(lobes * (angle - phase)));
}

function surfaceNormal(angle: number, y: number, params: LobedPillarParams) {
  const radius = outerRadius(angle, y, params);
  const phase = (params.twistRate * y * Math.PI) / 180;
  const lobes = Math.max(3, Math.round(params.lobeCount));
  const amplitude = Math.max(0, params.lobeAmplitude);
  const theta = lobes * (angle - phase);
  const dRadiusDAngle = -amplitude * lobes * Math.sin(theta);
  const dRadiusDY = amplitude * lobes * (params.twistRate * Math.PI / 180) * Math.sin(theta);
  const dxDAngle = dRadiusDAngle * Math.cos(angle) - radius * Math.sin(angle);
  const dzDAngle = dRadiusDAngle * Math.sin(angle) + radius * Math.cos(angle);
  const dxDY = dRadiusDY * Math.cos(angle);
  const dzDY = dRadiusDY * Math.sin(angle);
  let nx = dzDAngle;
  let ny = -(dzDAngle * dxDY - dxDAngle * dzDY);
  let nz = -dxDAngle;
  const length = Math.hypot(nx, ny, nz) || 1;
  return new THREE.Vector3(nx / length, ny / length, nz / length);
}

function pointOnSurface(
  angle: number,
  y: number,
  params: LobedPillarParams,
  offset = 0,
  normalDirection = 1,
  radialRelief = false,
): Point {
  const radius = outerRadius(angle, y, params);
  const point = new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
  if (offset !== 0) {
    // Relief must follow the actual twisted surface normal. A radial offset
    // cuts across concave lobes and is the source of the crossing bars and
    // slicer artifacts seen in the previous implementation.
    // `offset` is signed relative to the outer shell: positive is outside,
    // negative is inside. `normalDirection` only controls the orientation of
    // the ribbon's top/side normals and must not invert the position again.
    if (radialRelief) {
      // Keep most of the offset radial so the relief stays level around the
      // shell, while adding a normal component so it cannot sink into a steep
      // lobe valley and disappear behind the body.
      point.add(new THREE.Vector3(Math.cos(angle) * offset * 0.35, 0, Math.sin(angle) * offset * 0.35));
      point.addScaledVector(surfaceNormal(angle, y, params), offset * 0.65);
    } else {
      point.addScaledVector(surfaceNormal(angle, y, params), offset);
    }
  }
  return { x: point.x, y: point.y, z: point.z };
}

function makeLobedBodyGeometry(params: LobedPillarParams) {
  const segments = 192;
  const outerYs = [0, Math.min(params.height - 0.1, Math.max(0.5, params.floorThickness)), params.height];
  const innerBottom = Math.min(params.height - 0.2, Math.max(0.5, params.floorThickness));
  const innerYs = [innerBottom, params.height];
  const positions: number[] = [];
  const indices: number[] = [];

  const ring = (y: number, inner: boolean) => {
    const result: number[] = [];
    for (let i = 0; i < segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      const outer = pointOnSurface(angle, y, params);
      const radius = Math.max(2, Math.hypot(outer.x, outer.z) - (inner ? Math.max(0.6, params.wall) : 0));
      result.push(positions.length / 3);
      positions.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    }
    return result;
  };

  const connectRings = (a: number[], b: number[], reverse = false) => {
    for (let i = 0; i < segments; i += 1) {
      const next = (i + 1) % segments;
      if (reverse) {
        indices.push(a[i], b[next], b[i], a[i], a[next], b[next]);
      } else {
        indices.push(a[i], b[i], b[next], a[i], b[next], a[next]);
      }
    }
  };

  const outerRings = outerYs.map((y) => ring(y, false));
  const innerRings = innerYs.map((y) => ring(y, true));
  connectRings(outerRings[0], outerRings[1]);
  connectRings(outerRings[1], outerRings[2]);
  connectRings(innerRings[0], innerRings[1], true);
  // Close the horizontal floor annulus between the outer shell and the inner wall.
  // Leaving this ring open produces a non-manifold seam that slicers often fill as
  // a random skin or a row of pinholes.
  connectRings(outerRings[1], innerRings[0], true);
  connectRings(outerRings[2], innerRings[1], true);

  const centerBottom = positions.length / 3;
  positions.push(0, 0, 0);
  const centerFloor = positions.length / 3;
  positions.push(0, innerBottom, 0);
  for (let i = 0; i < segments; i += 1) {
    const next = (i + 1) % segments;
    indices.push(centerBottom, outerRings[0][next], outerRings[0][i]);
    indices.push(centerFloor, innerRings[0][i], innerRings[0][next]);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function makeRimGeometry(params: LobedPillarParams) {
  const segments = 192;
  const bottom = params.height - 0.02;
  const top = params.height + Math.max(0.35, Math.min(params.rimHeight, 2.2));
  const positions: number[] = [];
  const indices: number[] = [];
  const addRing = (y: number, inner: boolean) => {
    const ring: number[] = [];
    for (let i = 0; i < segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      const r = outerRadius(angle, params.height, params) + (inner ? -Math.max(0.6, params.wall) : 0) + (inner ? 0 : 0.45);
      ring.push(positions.length / 3);
      positions.push(Math.cos(angle) * Math.max(2, r), y, Math.sin(angle) * Math.max(2, r));
    }
    return ring;
  };
  const outerBottom = addRing(bottom, false);
  const innerBottom = addRing(bottom, true);
  const outerTop = addRing(top, false);
  const innerTop = addRing(top, true);
  const connect = (a: number[], b: number[], reverse = false) => {
    for (let i = 0; i < segments; i += 1) {
      const next = (i + 1) % segments;
      if (reverse) indices.push(a[i], b[next], b[i], a[i], a[next], b[next]);
      else indices.push(a[i], b[i], b[next], a[i], b[next], a[next]);
    }
  };
  connect(outerBottom, outerTop);
  connect(innerBottom, innerTop, true);
  connect(outerTop, innerTop);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function addKumiko(
  parent: THREE.Group,
  params: LobedPillarParams,
  accentMaterial: THREE.Material,
  surfaceOffset = 0.25,
  normalDirection = 1,
) {
  // Build the whole lattice as one closed ribbon mesh. The previous version
  // created almost one TubeGeometry per line; it was expensive during slider
  // edits and produced z-fighting/gaps on concave lobes. A small prism ribbon
  // stays printable, follows the real surface normal, and updates as one mesh.
  const circumference = Math.PI * 2 * Math.max(8, params.radius);
  // Paramacraft's lobe pattern is intentionally dense: this control behaves
  // like motif scale, rather than the distance between a few large ribs.
  // Keep an effective pitch bounded so the default shell stays readable and
  // still responds smoothly to the spacing control.
  const spacing = Math.max(7, Math.min(12, params.patternSpacing * 0.55));
  // Paramacraft's default surface is a repeating star/kumiko field: one
  // motif per edge-length cell, not a set of long helical rails.  Keeping the
  // grid in unwrapped (angle, height) space also makes it stable over the
  // concave valleys of a twisted lobed body.
  const columns = Math.max(12, Math.min(36, Math.ceil(circumference / spacing)));
  const startY = Math.min(params.height - 4, Math.max(params.floorThickness + 0.5, 0.5));
  const endY = Math.max(startY + 4, params.height - Math.max(0.5, params.rimHeight) - 0.5);
  const rows = Math.max(8, Math.min(18, Math.ceil((endY - startY) / spacing)));
  const stepU = (Math.PI * 2) / columns;
  const stepY = (endY - startY) / rows;
  // Paramacraft's kumiko is a shallow surface relief, not a lattice of thick
  // rods. Keeping the ribbon narrow and close to the shell prevents adjacent
  // cells from merging at lobe valleys and preserves the small star motifs.
  const facetHeight = Math.max(0.45, Math.min(1.8, params.patternLineWidth * 0.42));
  // Keep the whole triangular facet above the shell.  A very low edge used
  // to let the body occlude the relief on the concave/front lobes, leaving
  // large blank panels in the preview and broken-looking islands in slicers.
  const edgeHeight = Math.max(0.42, facetHeight * 0.84);
  const positions: number[] = [];
  const indices: number[] = [];

  const pushFacet = (
    points: [Point, Point, Point],
    normals: [THREE.Vector3, THREE.Vector3, THREE.Vector3],
  ) => {
    const bases = points.map((point) => new THREE.Vector3(point.x, point.y, point.z));
    const heights = [facetHeight, edgeHeight, edgeHeight];
    const tops = bases.map((base, index) => base.clone().add(normals[index].clone().multiplyScalar(heights[index])));
    const base = positions.length / 3;
    [...bases, ...tops].forEach((vertex) => positions.push(vertex.x, vertex.y, vertex.z));
    indices.push(
      base, base + 2, base + 1,
      base + 3, base + 4, base + 5,
      base, base + 1, base + 4, base, base + 4, base + 3,
      base + 1, base + 2, base + 5, base + 1, base + 5, base + 4,
      base + 2, base, base + 3, base + 2, base + 3, base + 5,
    );
  };

  const addFacet = (center: [number, number], first: [number, number], second: [number, number]) => {
    // Follow the curved/twisted surface instead of spanning a whole wedge
    // with one planar triangle. That planar shortcut is what left the lobe
    // peaks blank: its chord passed through the shell. A small triangular
    // subdivision keeps every relief cell seated on the sampled surface.
    const subdivisions = 3;
    const sample = (i: number, j: number): [number, number] => {
      const a = 1 - (i + j) / subdivisions;
      const b = i / subdivisions;
      const c = j / subdivisions;
      return [
        center[0] * a + first[0] * b + second[0] * c,
        center[1] * a + first[1] * b + second[1] * c,
      ];
    };
    const addTriangle = (a: [number, number], b: [number, number], c: [number, number]) => {
      const triangle: [[number, number], [number, number], [number, number]] = [a, b, c];
      const points = triangle.map(([angle, y]) => pointOnSurface(angle, y, params, surfaceOffset, normalDirection, true)) as [Point, Point, Point];
      const normals = triangle.map(([angle, y]) => surfaceNormal(angle, y, params).multiplyScalar(normalDirection)) as [THREE.Vector3, THREE.Vector3, THREE.Vector3];
      pushFacet(points, normals);
    };
    for (let i = 0; i < subdivisions; i += 1) {
      for (let j = 0; j < subdivisions - i; j += 1) {
        addTriangle(sample(i, j), sample(i + 1, j), sample(i, j + 1));
        if (i + j < subdivisions - 1) {
          addTriangle(sample(i + 1, j), sample(i + 1, j + 1), sample(i, j + 1));
        }
      }
    }
  };

  for (let row = 0; row < rows; row += 1) {
    const y = startY + (row + 0.5) * stepY;
    const halfY = stepY * 0.46;
    for (let column = 0; column < columns; column += 1) {
      const angle = column * stepU;
      const halfU = stepU * 0.5;
      const center: [number, number] = [angle, y];
      const points: [number, number][] = [
        [angle - halfU, y - halfY],
        [angle, y - halfY],
        [angle + halfU, y - halfY],
        [angle + halfU, y],
        [angle + halfU, y + halfY],
        [angle, y + halfY],
        [angle - halfU, y + halfY],
        [angle - halfU, y],
      ];

      // Tile the cell with shallow triangular facets. This keeps every motif
      // bounded to one repeat cell, matching Paramacraft's dense star/flower
      // surface instead of producing long rails across the wall.
      for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
        addFacet(center, points[pointIndex], points[(pointIndex + 1) % points.length]);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, accentMaterial);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
}

export function buildLobedPillarModel(params: LobedPillarParams) {
  const root = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: params.bodyColor, roughness: 0.72, metalness: 0.02, side: THREE.DoubleSide });
  const accentMaterial = new THREE.MeshStandardMaterial({ color: params.accentColor, roughness: 0.55, metalness: 0.02, side: THREE.DoubleSide });
  const body = new THREE.Mesh(makeLobedBodyGeometry(params), bodyMaterial);
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);
  const rim = new THREE.Mesh(makeRimGeometry(params), accentMaterial);
  rim.castShadow = true;
  rim.receiveShadow = true;
  root.add(rim);
  // Keep a second copy on the inner wall so the open top still reads as a
  // patterned shell when the camera is orbiting inside. It uses a smaller
  // offset and the opposite normal so it never competes with the outside
  // relief at the rim or leaks through the wall.
  // Keep relief clear of the concave valleys as well as the bulges. The
  // offset is still shallow compared with the 5 mm wall, but prevents the
  // shell from hiding the pattern when the lobe twists toward the camera.
  addKumiko(root, params, accentMaterial, 3, 1);
  addKumiko(root, params, accentMaterial, -Math.max(0.7, params.wall - 0.6), -1);
  return root;
}
