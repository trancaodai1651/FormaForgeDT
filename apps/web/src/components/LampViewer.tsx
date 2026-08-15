import { OrbitControls, PerspectiveCamera, Sparkles } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { Product } from '@hometown/types';
import { generateLampMesh } from '@hometown/geometry';
import * as THREE from 'three';

type ViewerProps = { product: Product; color: string; lightOn?: boolean; brightness?: number; autoRotate?: boolean; compact?: boolean };

function Scene({ product, color, lightOn = true, brightness = 1, autoRotate = true }: ViewerProps) {
  const group = useRef<THREE.Group>(null);
  const mesh = useMemo(() => generateLampMesh({ shape: { type: product.shape, width: product.dimensions.width, height: product.dimensions.height, depth: product.dimensions.depth }, shell: { wallThickness: 1.6, topThickness: 2, bottomThickness: 3 }, pattern: { type: product.shape === 'pattern' ? 'wave' : 'none', density: .4, openingSize: 4, strength: .3 }, hardware: 'BAMBU_LED_KIT_001', connector: { type: 'CORE_BAYONET', lockAngle: 35, clearance: .35, diameter: 52, height: 8 }, printProfile: { printer: 'BAMBU_A1_04', nozzleDiameter: .4, minimumWall: 1.2, minimumFeature: .8, minimumGap: .8, recommendedOverhang: 55 } }), [product]);
  const geometry = useMemo(() => { const buffer = new THREE.BufferGeometry(); buffer.setAttribute('position', new THREE.Float32BufferAttribute(mesh.vertices, 3)); buffer.setIndex(mesh.indices); buffer.computeVertexNormals(); return buffer; }, [mesh]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((_, delta) => { if (autoRotate && group.current) group.current.rotation.y += delta * .16; });
  return <>
    <ambientLight intensity={lightOn ? .45 : .2} color="#fff5dc" />
    <directionalLight position={[3, 5, 4]} intensity={1.8} castShadow color="#fffaf2" />
    {lightOn && <pointLight position={[0, 0, 0]} intensity={brightness * 18} distance={3.3} color="#ffc56b" decay={2} />}
    <group ref={group} position={[0, -.18, 0]} rotation={[0, .22, 0]}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshPhysicalMaterial color={color} roughness={.32} metalness={.05} emissive={lightOn ? '#a94e13' : '#000000'} emissiveIntensity={lightOn ? .24 * brightness : 0} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -product.dimensions.height / 2000 - .08, 0]}>
        <cylinderGeometry args={[.33, .38, .16, 48]} />
        <meshStandardMaterial color="#24282b" metalness={.7} roughness={.28} />
      </mesh>
      <mesh position={[0, product.dimensions.height / 2000 + .01, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[.42, .018, 8, 64]} />
        <meshStandardMaterial color="#c99b58" metalness={.65} roughness={.26} emissive={lightOn ? '#70431b' : '#000'} emissiveIntensity={.35} />
      </mesh>
    </group>
    <Sparkles count={lightOn ? 26 : 8} scale={[3.4, 3.4, 3.4]} size={1.5} speed={.25} color={lightOn ? '#ffd38a' : '#71808a'} opacity={.45} />
    <OrbitControls enablePan={false} minDistance={2.6} maxDistance={6.2} autoRotate={false} makeDefault />
  </>;
}

export function LampViewer(props: ViewerProps) {
  return <div className={`lamp-viewer${props.compact ? ' compact' : ''}`} aria-label={`${props.product.name} interactive 3D preview`}>
    <Canvas shadows dpr={[1, 1.8]} gl={{ antialias: true }}>
      <color attach="background" args={['#111416']} /><PerspectiveCamera makeDefault position={[2.8, 1.3, 3.2]} fov={38} />
      <Scene {...props} />
    </Canvas>
    <div className="viewer-corner"><span className="live-dot" />REALTIME PREVIEW</div>
  </div>;
}
