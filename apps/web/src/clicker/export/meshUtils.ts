// src/export/meshUtils.ts
import type { ClickerPart, PartGroup } from '../types';

/** 
 * LÁ CHẮN BẢO VỆ: Làm tròn tọa độ Z-fighting và xóa bỏ các tam giác suy biến 
 * (khắc phục dứt điểm lỗi Slicer Acne - bề mặt lồi lõm)
 */
export function sanitizeMesh(part: ClickerPart): ClickerPart {
  const vp = part.vertProperties;
  const tv = part.triVerts;
  const np = part.numProp;

  const newVp: number[] = [];
  const newTv: number[] = [];
  const vertexMap = new Map<string, number>();

  let vertCount = 0;

  // Làm tròn tuyệt đối 3 chữ số thập phân (0.001 mm)
  const r = (val: number) => Math.round(val * 1000) / 1000;

  for (let i = 0; i < tv.length; i += 3) {
    const i1 = tv[i] * np;
    const i2 = tv[i + 1] * np;
    const i3 = tv[i + 2] * np;

    if (i1 >= vp.length || i2 >= vp.length || i3 >= vp.length) continue;

    const v1 = [r(vp[i1]), r(vp[i1 + 1]), r(vp[i1 + 2])];
    const v2 = [r(vp[i2]), r(vp[i2 + 1]), r(vp[i2 + 2])];
    const v3 = [r(vp[i3]), r(vp[i3 + 1]), r(vp[i3 + 2])];

    const key1 = `${v1[0]},${v1[1]},${v1[2]}`;
    const key2 = `${v2[0]},${v2[1]},${v2[2]}`;
    const key3 = `${v3[0]},${v3[1]},${v3[2]}`;

    // Bỏ qua các tam giác lỗi, diện tích bằng 0
    if (key1 === key2 || key2 === key3 || key3 === key1) continue;

    let newIdx1 = vertexMap.get(key1);
    if (newIdx1 === undefined) {
      newIdx1 = vertCount++;
      vertexMap.set(key1, newIdx1);
      newVp.push(v1[0], v1[1], v1[2]);
      for(let p = 3; p < np; p++) newVp.push(vp[i1 + p] || 0);
    }

    let newIdx2 = vertexMap.get(key2);
    if (newIdx2 === undefined) {
      newIdx2 = vertCount++;
      vertexMap.set(key2, newIdx2);
      newVp.push(v2[0], v2[1], v2[2]);
      for(let p = 3; p < np; p++) newVp.push(vp[i2 + p] || 0);
    }

    let newIdx3 = vertexMap.get(key3);
    if (newIdx3 === undefined) {
      newIdx3 = vertCount++;
      vertexMap.set(key3, newIdx3);
      newVp.push(v3[0], v3[1], v3[2]);
      for(let p = 3; p < np; p++) newVp.push(vp[i3 + p] || 0);
    }

    newTv.push(newIdx1, newIdx2, newIdx3);
  }

  return {
    ...part,
    vertProperties: new Float32Array(newVp),
    triVerts: new Uint32Array(newTv)
  };
}

/** Tính toán Bounding Box để lật nắp và đế nằm ngang nhau */
export function groupBBox(
  parts: ClickerPart[],
  groupId: PartGroup,
  minZ: number,
): { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number } {
  let bMinX = Infinity, bMaxX = -Infinity;
  let bMinY = Infinity, bMaxY = -Infinity;
  let bMinZ = Infinity, bMaxZ = -Infinity;
  for (const p of parts) {
    if (p.group !== groupId) continue;
    const np = p.numProp;
    const vp = p.vertProperties;
    for (let i = 0; i < vp.length; i += np) {
      const x = vp[i], y = vp[i + 1], z = vp[i + 2] - minZ;
      if (x < bMinX) bMinX = x;
      if (x > bMaxX) bMaxX = x;
      if (y < bMinY) bMinY = y;
      if (y > bMaxY) bMaxY = y;
      if (z < bMinZ) bMinZ = z;
      if (z > bMaxZ) bMaxZ = z;
    }
  }
  return { minX: bMinX, maxX: bMaxX, minY: bMinY, maxY: bMaxY, minZ: bMinZ, maxZ: bMaxZ };
}