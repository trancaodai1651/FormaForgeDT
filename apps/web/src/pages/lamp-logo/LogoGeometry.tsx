import { useEffect } from 'react';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';
import type { LogoConfig } from './LogoTypes';

export function LampLogoDecal({ logo, position }: { logo: LogoConfig; position: [number, number, number] }) {
  const texture = useLoader(THREE.TextureLoader, logo.source);
  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
  }, [texture]);
  return <mesh position={position} rotation={[0, 0, 0]} renderOrder={3}>
    <planeGeometry args={[logo.width, logo.height]} />
    <meshStandardMaterial map={texture} transparent alphaTest={.05} roughness={.52} metalness={.08} polygonOffset polygonOffsetFactor={-4} side={THREE.DoubleSide} />
  </mesh>;
}

export function createLogoReliefGroup(logo: LogoConfig | null, surfaceRadius: number, centerY: number) {
  const group = new THREE.Group();
  if (!logo?.enabled || !logo.mask) return group;
  const { width, height, alpha } = logo.mask;
  const cellWidth = logo.width / width;
  const cellHeight = logo.height / height;
  const material = new THREE.MeshStandardMaterial({ color: '#f4c95d', roughness: .58, metalness: .08 });
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      if ((alpha[row * width + column] ?? 0) < .22) continue;
      const geometry = new THREE.BoxGeometry(cellWidth * .94, cellHeight * .94, Math.max(.2, logo.depth));
      const cell = new THREE.Mesh(geometry, material);
      cell.position.set((column + .5 - width / 2) * cellWidth, centerY + (height / 2 - row - .5) * cellHeight, surfaceRadius + Math.max(.1, logo.depth / 2));
      group.add(cell);
    }
  }
  return group;
}
