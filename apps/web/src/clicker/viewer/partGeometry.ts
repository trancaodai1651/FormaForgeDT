import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ClickerPart } from '../types';

/** Split horizontal image faces from their walls without expanding every triangle. */
function flatImageCaps(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const source = geometry.getAttribute('position');
  const indices = geometry.getIndex()!;
  const positions = Array.from(source.array as ArrayLike<number>);
  const triangles = new Uint32Array(indices.array);
  const up = new Int32Array(source.count).fill(-1);
  const down = new Int32Array(source.count).fill(-1);
  const capVertices: { index: number; sign: number }[] = [];

  for (let i = 0; i < triangles.length; i += 3) {
    const a = indices.getX(i), b = indices.getX(i + 1), c = indices.getX(i + 2);
    const za = source.getZ(a), zb = source.getZ(b), zc = source.getZ(c);
    if (Math.max(za, zb, zc) - Math.min(za, zb, zc) > 1e-5) continue;
    const signedArea = (source.getX(b) - source.getX(a)) * (source.getY(c) - source.getY(a))
      - (source.getY(b) - source.getY(a)) * (source.getX(c) - source.getX(a));
    if (Math.abs(signedArea) < 1e-12) continue;
    const sign = Math.sign(signedArea);
    const map = sign > 0 ? up : down;
    for (let corner = 0; corner < 3; corner++) {
      const original = indices.getX(i + corner);
      if (map[original] < 0) {
        map[original] = positions.length / 3;
        positions.push(source.getX(original), source.getY(original), source.getZ(original));
        capVertices.push({ index: map[original], sign });
      }
      triangles[i + corner] = map[original];
    }
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(triangles, 1));
  geometry.computeVertexNormals();
  const normals = geometry.getAttribute('normal');
  // A planar printed colour face has one normal even at its perimeter.
  // Averaging that normal with vertical walls made dense white reliefs look
  // rounded or dented although all their top vertices have the same Z.
  for (const { index, sign } of capVertices) normals.setXYZ(index, 0, 0, sign);
  return geometry;
}

export function partToGeometry(p: ClickerPart, fastNormals = false): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  let positions: Float32Array;
  if (p.numProp === 3) {
    positions = p.vertProperties;
  } else {
    const count = p.vertProperties.length / p.numProp;
    positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = p.vertProperties[i * p.numProp];
      positions[i * 3 + 1] = p.vertProperties[i * p.numProp + 1];
      positions[i * 3 + 2] = p.vertProperties[i * p.numProp + 2];
    }
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(p.triVerts, 1));
  if (fastNormals || p.triVerts.length > 36_000) {
    if (/^(?:top|bottom)-(?:base|color)|^hybrid-(?:bottom-)?image-/.test(p.name)) {
      return flatImageCaps(geometry);
    }
    geometry.computeVertexNormals();
    return geometry;
  }
  const creased = toCreasedNormals(geometry, (35 * Math.PI) / 180);
  geometry.dispose();
  return creased;
}
