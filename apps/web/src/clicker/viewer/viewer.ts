import { getClickerDocument } from '../runtime';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { type ClickerPart, type MeshData, type RGB, type SwitchPlacement, type ViewMode } from '../types';

export type SectionAxis = 'x' | 'y' | 'z';

export interface ImportedModelInfo {
  name: string;
  format: 'STL' | '3MF';
  meshCount: number;
  triangleCount: number;
}

export interface Viewer {
  setParts(parts: ClickerPart[], preserveCamera?: boolean): void;
  setView(mode: ViewMode): void;
  setSection(axis: SectionAxis, pos: number): void;
  setSwitch(mesh: MeshData | null): void;
  showSwitch(on: boolean): void;
  /** Place one preview switch mesh per (clamped) placement the geometry was built with. */
  setSwitchPlacements(placements: SwitchPlacement[]): void;
  importModel(file: File): Promise<ImportedModelInfo>;
  setImportedModelColor(hex: string): void;
  setPreviewSource(source: 'generated' | 'imported'): void;
  clearImportedModel(): void;
  setImportedModelRotation(axis: 'x' | 'y' | 'z', degrees: number): void;
  resetImportedModelTransform(): void;
  /** Separate modular units like the reference preview when a base module is clicked. */
  setModularSplit(on: boolean, vertical?: boolean): void;
  renderToPng(): Promise<Blob | null>;
  setTheme(theme: string): void;
  /** Register a callback fired when the user clicks a colored part of the model, or null if clicking empty space. */
  onPartPick(cb: (index: number | null, clientX: number, clientY: number, shiftKey: boolean) => void): void;
  /** Live-recolor a single part's material (no rebuild â€” geometry is unchanged). */
  setPartColor(index: number, rgb: RGB): void;
  /** Mark a part as the active selection (highlight), or null to clear. */
  highlightPart(index: number | null): void;
  /** Mark multiple parts as active selection. */
  highlightParts(indices: number[]): void;
  /** Clear hover + selection highlights. */
  clearHighlight(): void;
  dispose(): void;
}

// The grid sits a hair BELOW the model's bottom face (which lands at z = 0) so the
// solid bottom occludes it cleanly â€” coplanar at z = 0 causes z-fighting that bleeds
// grid lines up through the lower body.
const GRID_GAP = 1.0;
const MODULAR_SPLIT_EXTRA = 9;

function partToGeometry(p: ClickerPart): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
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
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(new THREE.BufferAttribute(p.triVerts, 1));
  // Crease-split normals: keep the domed top / round walls smooth while keeping
  // hard edges crisp (preview shading only â€” matches the keycap generator).
  const creased = toCreasedNormals(geo, (35 * Math.PI) / 180);
  geo.dispose();
  return creased;
}

function color(rgb: RGB): THREE.Color {
  return new THREE.Color().setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace);
}

export function createViewer(container: HTMLElement): Viewer {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.localClippingEnabled = true;
  container.appendChild(renderer.domElement);

  // Section view: a single clipping plane swept along an axis.
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  const materials: THREE.Material[] = [];
  // Parallel to `materials`/parts: the pickable meshes, each tagged with its part
  // index in userData so a raycast hit maps straight back to the part/material.
  const partMeshes: THREE.Mesh[] = [];
  const bounds = new THREE.Vector3(40, 40, 40);
  let sectionAxis: SectionAxis = 'y';
  let sectionPos = 0;

  const scene = new THREE.Scene();
  const currentTheme = getClickerDocument().documentElement.getAttribute('data-theme') || 'dark';
  scene.background = new THREE.Color(currentTheme === 'dark' ? 0x15171c : 0xf3f4f6);

  const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    5000,
  );
  camera.up.set(0, 0, 1); // Z up (CAD)
  camera.position.set(60, -60, 45);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(40, -30, 70);
  scene.add(key);
  scene.add(new THREE.AmbientLight(0xffffff, 0.2));

  let gridZ = -20;
  let grid: THREE.GridHelper | null = null;
  function rebuildGrid(theme: string, z: number) {
    if (grid) scene.remove(grid);
    gridZ = z;
    const accentColor = theme === 'dark' ? 0x5b9dff : 0x2563eb;
    const gridColor = theme === 'dark' ? 0x2d3139 : 0xd1d5db;
    grid = new THREE.GridHelper(300, 30, accentColor, gridColor);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = gridZ;
    // Prevent grid lines from bleeding through model body:
    // draw the grid first and skip depth-writes so opaque geometry always wins.
    grid.renderOrder = -1;
    if (Array.isArray(grid.material)) {
      grid.material.forEach(m => { m.depthWrite = false; });
    } else {
      grid.material.depthWrite = false;
    }
    scene.add(grid);
  }

  rebuildGrid(currentTheme, gridZ);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.zoomToCursor = false;

  // Root group is recentered for viewing; children keep relative positions.
  const root = new THREE.Group();
  scene.add(root);
  const importedRoot = new THREE.Group();
  importedRoot.visible = false;
  scene.add(importedRoot);
  const capGroup = new THREE.Group();
  const bodyGroup = new THREE.Group();
  const switchGroup = new THREE.Group(); // the real MX switch â€” display-only, toggleable
  switchGroup.visible = false;
  root.add(capGroup, bodyGroup, switchGroup);

  const importedMaterials = new Set<THREE.MeshStandardMaterial>();
  let previewSource: 'generated' | 'imported' = 'generated';
  const importedBounds = new THREE.Vector3(1, 1, 1);
  const importedRotation = { x: 0, y: 0, z: 0 };

  let placeholder: THREE.Group | null = null;
  framePlaceholder();

  let viewMode: ViewMode = 'assembled';
  let explodeOffset = 0;
  let switchMaterial: THREE.MeshStandardMaterial | null = null;
  // The switch mesh (shared across placements) and where to seat copies of it.
  let switchGeometry: THREE.BufferGeometry | null = null;
  let switchPlacements: SwitchPlacement[] = [{ x: 0, y: 0, rotation: 0 }];
  // The imported MX asset is normalized with its seating face at z=0, but the
  // printed base can have any height. Keep the switch inside that base instead
  // of assuming z=0 is the socket plane.
  let switchSeatZ = 0;
  const switchRecessMm = 0.8;
  const switchBottomClearanceMm = 0.2;
  const switchExplodedLift = 6;
  let modularSplit = false;
  let modularVertical = false;
  let modularCount = 0;

  // ---- Part picking / hover / selection ----
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const HILITE = new THREE.Color(0x3b82f6);
  let hoveredIndex: number | null = null;
  let selectedIndices: number[] = [];
  let pickCb: ((index: number | null, clientX: number, clientY: number, shiftKey: boolean) => void) | null = null;
  let downX = 0;
  let downY = 0;
  let downT = 0;

  let outlineMesh: THREE.LineSegments | null = null;
  const outlineMaterial = new THREE.LineBasicMaterial({
    color: 0x3b82f6,
    depthTest: true,
    depthWrite: false,
    transparent: true,
    opacity: 0.9,
  });

  function framePlaceholder() {
    root.position.set(0, 0, 0);
    const radius = 40 * 2.2 + 15;
    camera.position.set(radius, -radius, radius * 0.75);
    controls.target.set(0, 0, 11);
    controls.update();
  }

  function frameCenteredSize(
    size: THREE.Vector3,
    preserveCamera: boolean,
    previousOffset?: THREE.Vector3,
    previousPan?: THREE.Vector3,
  ) {
    const target = new THREE.Vector3(0, 0, Math.max(0, size.z / 2));
    // Rebuilds recenter the generated geometry. Preserve the user's pan delta
    // relative to the old model center so changing a slider never teleports a
    // deliberately panned model back to an arbitrary screen position.
    if (preserveCamera && previousPan) target.add(previousPan);
    const offset = previousOffset?.clone() ?? camera.position.clone().sub(controls.target);
    const previousDistance = offset.length();
    const direction = offset.lengthSq() > 0.0001
      ? offset.normalize()
      : new THREE.Vector3(1, -1, 0.75).normalize();
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(camera.aspect, 0.1));
    const limitingFov = Math.max(0.2, Math.min(verticalFov, horizontalFov));
    // Fit against the largest projected dimension instead of Vector3.length().
    // This keeps long Image + Blocks products at a useful scale and prevents a
    // rebuild from making them look artificially flattened or tiny.
    const halfExtent = Math.max(size.x, size.y, size.z) / 2;
    const fittedDistance = Math.max(1, halfExtent / Math.tan(limitingFov / 2) * 1.22);
    const distance = preserveCamera ? Math.max(previousDistance, fittedDistance) : fittedDistance;
    controls.target.copy(target);
    camera.position.copy(target).add(direction.multiplyScalar(distance));
    camera.near = Math.max(0.05, distance / 1000);
    camera.far = Math.max(5000, distance * 20);
    camera.updateProjectionMatrix();
    controls.update();
  }

  function clearPlaceholder() {
    if (!placeholder) return;
    root.remove(placeholder);
    for (const child of placeholder.children) {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }
    placeholder = null;
  }

  function bodyLocalBounds() {
    // Measure the body in the root's local coordinates. setFromObject() also
    // includes root.position, which is the camera-centering offset and caused
    // the preview switch to receive that offset a second time.
    const bodyBounds = new THREE.Box3();
    for (const child of bodyGroup.children) {
      if (!(child instanceof THREE.Mesh)) continue;
      child.geometry.computeBoundingBox();
      if (!child.geometry.boundingBox) continue;
      const childBounds = child.geometry.boundingBox.clone().applyMatrix4(child.matrix);
      bodyBounds.union(childBounds);
    }
    return bodyBounds;
  }

  function updateSwitchSeat() {
    if (!switchGeometry || bodyGroup.children.length === 0) {
      switchSeatZ = 0;
      return;
    }
    switchGeometry.computeBoundingBox();
    const switchBounds = switchGeometry.boundingBox;
    if (!switchBounds) {
      switchSeatZ = 0;
      return;
    }
    const bodyBounds = bodyLocalBounds();
    if (bodyBounds.isEmpty()) {
      switchSeatZ = 0;
      return;
    }
    const switchHeight = switchBounds.max.z - switchBounds.min.z;
    const desiredTop = bodyBounds.max.z - switchRecessMm;
    const lowestSafeTop = bodyBounds.min.z + switchHeight + switchBottomClearanceMm;
    switchSeatZ = Math.max(desiredTop, lowestSafeTop) - switchBounds.max.z;
  }

  function clearGroup(g: THREE.Group) {
    for (const child of [...g.children]) {
      g.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }
  }

  function setParts(parts: ClickerPart[], preserveCamera = false) {
    const previousCamera = camera.position.clone();
    const previousOffset = previousCamera.sub(controls.target);
    const previousCenter = new THREE.Vector3(0, 0, Math.max(0, bounds.z / 2));
    const previousPan = controls.target.clone().sub(previousCenter);
    clearPlaceholder();
    clearGroup(capGroup);
    clearGroup(bodyGroup);
    materials.length = 0;
    partMeshes.length = 0;
    hoveredIndex = null;
    selectedIndices = [];
    modularCount = parts.filter((part) => part.kind === 'body' && /^flex-module-\d+$/.test(part.name)).length;

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const mat = new THREE.MeshStandardMaterial({
        color: color(p.colorRgb),
        metalness: 0.0,
        roughness: 0.5,
        side: THREE.DoubleSide, // so the interior shows in section view
      });
      materials.push(mat);
      const mesh = new THREE.Mesh(partToGeometry(p), mat);
      mesh.userData.partIndex = i; // raycast hit -> part/material index
      mesh.userData.partName = p.name; // essential for live preview and syncing heights
      const moduleMatch = /^(?:flex-module|keycap)-(\d+)/.exec(p.name);
      if (moduleMatch) mesh.userData.moduleIndex = Number(moduleMatch[1]) - 1;
      partMeshes.push(mesh);
      (p.kind === 'body' ? bodyGroup : capGroup).add(mesh);
    }

    // Center X/Y, but place the bottom of the assembly at z = 0 so it sits on the grid.
    root.position.set(0, 0, 0);
    capGroup.position.set(0, 0, 0);
    const box = new THREE.Box3().expandByObject(capGroup).expandByObject(bodyGroup);
    const center = box.getCenter(new THREE.Vector3());
    // Shift X and Y to center, but shift Z so the bottom of the model lands at 0.
    root.position.set(-center.x, -center.y, -box.min.z);

    const size = box.getSize(new THREE.Vector3());
    bounds.copy(size);
    explodeOffset = size.z * 0.8 + 10;
    updateSwitchSeat();
    applyView();

    // Drop the grid just under the model's bottom (which lands at z = 0) so the
    // solid base occludes it instead of z-fighting with the coplanar bottom face.
    const activeTheme = getClickerDocument().documentElement.getAttribute('data-theme') || 'dark';
    rebuildGrid(activeTheme, -GRID_GAP);

    if (previewSource === 'generated') frameCenteredSize(size, preserveCamera, previousOffset, previousPan);

  }

  function updateClipPlane() {
    const n =
      sectionAxis === 'x'
        ? new THREE.Vector3(-1, 0, 0)
        : sectionAxis === 'z'
          ? new THREE.Vector3(0, 0, -1)
          : new THREE.Vector3(0, -1, 0);
    const half = (sectionAxis === 'x' ? bounds.x : sectionAxis === 'z' ? bounds.z : bounds.y) / 2;
    clipPlane.normal.copy(n);
    clipPlane.constant = sectionPos * half;
  }

  function applyView() {
    capGroup.position.z = viewMode === 'exploded' ? explodeOffset : 0;
    for (const mesh of partMeshes) {
      const index = (mesh.userData as { moduleIndex?: number }).moduleIndex;
      const split = modularSplit && modularCount > 1 && typeof index === 'number'
        ? (index - (modularCount - 1) / 2) * MODULAR_SPLIT_EXTRA
        : 0;
      mesh.position.x = modularVertical ? 0 : split;
      mesh.position.y = modularVertical ? split : 0;
    }
    // Keep switches seated under the caps in assembled mode. In exploded
    // mode lift the full-height MX mesh clear of the base underside as well.
    const hasExplicitSeat = switchPlacements.some((placement) =>
      Number.isFinite(placement.seatZ) || Number.isFinite(placement.topZ),
    );
    switchGroup.position.z = switchSeatZ
      + (viewMode === 'exploded' && !hasExplicitSeat ? switchExplodedLift : 0);
    const section = viewMode === 'section';
    if (section) updateClipPlane();
    for (const m of materials) (m as THREE.MeshStandardMaterial).clippingPlanes = section ? [clipPlane] : [];
    if (switchMaterial) switchMaterial.clippingPlanes = section ? [clipPlane] : [];
  }

  function setView(mode: ViewMode) {
    viewMode = mode;
    applyView();
  }

  // Remove the switch meshes from the group WITHOUT disposing the geometry/material â€”
  // every placement shares one BufferGeometry + material, freed once in setSwitch/dispose.
  function clearSwitchMeshes() {
    for (const child of [...switchGroup.children]) switchGroup.remove(child);
  }

  // Seat one mesh per placement, all sharing the (dense) switch geometry + material.
  function rebuildSwitchMeshes() {
    clearSwitchMeshes();
    if (!switchGeometry || !switchMaterial) return;
    for (const p of switchPlacements) {
      const m = new THREE.Mesh(switchGeometry, switchMaterial);
      const index = switchPlacements.indexOf(p);
      const split = modularSplit && modularCount > 1
        ? (index - (modularCount - 1) / 2) * MODULAR_SPLIT_EXTRA
        : 0;
      m.position.set(modularVertical ? p.x : p.x + split, modularVertical ? p.y + split : p.y, 0);
      m.rotation.z = (p.rotation * Math.PI) / 180; // match the geometry's socket/stem rotation
      switchGroup.add(m);
    }
    applyView(); // pick up section clipping if it's active
  }

  // The real MX switch, already placed in the assembly frame (display only). Smooth
  // shading and no crease-splitting â€” the mesh is dense (~hundreds of k tris).
  function setSwitch(mesh: MeshData | null) {
    clearSwitchMeshes();
    switchGeometry?.dispose();
    switchGeometry = null;
    switchMaterial?.dispose();
    switchMaterial = null;
    if (!mesh) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(mesh.vertProperties, 3)); // numProp = 3
    geo.setIndex(new THREE.BufferAttribute(mesh.triVerts, 1));
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    switchGeometry = geo;
    switchMaterial = new THREE.MeshStandardMaterial({
      // Match the reference site's neutral printed/MX preview color.
      color: new THREE.Color(0x8b8f97),
      metalness: 0.15,
      roughness: 0.5,
      side: THREE.DoubleSide,
    });
    updateSwitchSeat();
    rebuildSwitchMeshes();
  }

  function showSwitch(on: boolean) {
    switchGroup.visible = on;
  }

  function setSwitchPlacements(placements: SwitchPlacement[]) {
    switchPlacements = placements.length ? placements : [{ x: 0, y: 0, rotation: 0 }];
    const explicitTop = switchPlacements.find((placement) => Number.isFinite(placement.topZ))?.topZ;
    if (Number.isFinite(explicitTop) && switchGeometry) {
      switchGeometry.computeBoundingBox();
      const switchBounds = switchGeometry.boundingBox;
      const bodyBounds = bodyLocalBounds();
      if (switchBounds && !bodyBounds.isEmpty()) {
        const switchHeight = switchBounds.max.z - switchBounds.min.z;
        const lowestSafeTop = bodyBounds.min.z + switchHeight + switchBottomClearanceMm;
        const resolvedTop = Math.max(explicitTop as number, lowestSafeTop);
        switchSeatZ = resolvedTop - switchBounds.max.z;
      }
    } else {
      const explicitSeat = switchPlacements.find((placement) => Number.isFinite(placement.seatZ))?.seatZ;
      if (Number.isFinite(explicitSeat)) switchSeatZ = explicitSeat as number;
    }
    rebuildSwitchMeshes();
    applyView();
  }

  function applyImportedRotation() {
    importedRoot.rotation.set(
      THREE.MathUtils.degToRad(importedRotation.x),
      THREE.MathUtils.degToRad(importedRotation.y),
      THREE.MathUtils.degToRad(importedRotation.z),
    );
  }

  function setImportedModelRotation(axis: 'x' | 'y' | 'z', degrees: number) {
    if (!Number.isFinite(degrees)) return;
    importedRotation[axis] = THREE.MathUtils.euclideanModulo(degrees, 360);
    applyImportedRotation();
  }

  function resetImportedModelTransform() {
    importedRotation.x = 0;
    importedRotation.y = 0;
    importedRotation.z = 0;
    importedRoot.position.set(0, 0, 0);
    applyImportedRotation();
  }

  function clearImportedModel() {
    const geometries = new Set<THREE.BufferGeometry>();
    const sourceMaterials = new Set<THREE.Material>();
    importedRoot.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      geometries.add(child.geometry);
      const list = Array.isArray(child.material) ? child.material : [child.material];
      list.forEach((material) => { if (material) sourceMaterials.add(material); });
    });
    importedRoot.clear();
    geometries.forEach((geometry) => geometry.dispose());
    sourceMaterials.forEach((material) => material.dispose());
    importedMaterials.clear();
    importedRoot.visible = false;
    root.visible = true;
    previewSource = 'generated';
    resetImportedModelTransform();
    frameCenteredSize(bounds, false, camera.position.clone().sub(controls.target));
  }

  function setImportedModelColor(hex: string) {
    const nextColor = new THREE.Color(hex);
    importedMaterials.forEach((material) => {
      material.color.copy(nextColor);
      material.vertexColors = false;
      material.map = null;
      material.needsUpdate = true;
    });
  }

  function setPreviewSource(source: 'generated' | 'imported') {
    previewSource = source === 'imported' && importedRoot.children.length > 0 ? 'imported' : 'generated';
    const imported = previewSource === 'imported';
    importedRoot.visible = imported;
    root.visible = !imported;
    frameCenteredSize(imported ? importedBounds : bounds, false, camera.position.clone().sub(controls.target));
  }

  async function importModel(file: File): Promise<ImportedModelInfo> {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'stl' && extension !== '3mf') throw new Error('Only STL and 3MF files are supported.');
    const data = await file.arrayBuffer();
    clearImportedModel();
    const object: THREE.Object3D = extension === 'stl'
      ? new THREE.Mesh(new STLLoader().parse(data))
      : new ThreeMFLoader().parse(data);
    const sourceMaterials = new Set<THREE.Material>();
    let meshCount = 0;
    let triangleCount = 0;
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      meshCount += 1;
      const list = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
      list.forEach((material) => sourceMaterials.add(material));
      const material = new THREE.MeshStandardMaterial({
        color: 0xf0b967,
        roughness: 0.52,
        metalness: 0,
        side: THREE.DoubleSide,
        vertexColors: false,
      });
      importedMaterials.add(material);
      child.material = material;
      const position = child.geometry.getAttribute('position');
      triangleCount += child.geometry.index ? child.geometry.index.count / 3 : (position?.count ?? 0) / 3;
      if (!child.geometry.getAttribute('normal')) child.geometry.computeVertexNormals();
    });
    sourceMaterials.forEach((material) => material.dispose());
    if (meshCount === 0) {
      importedMaterials.forEach((material) => material.dispose());
      importedMaterials.clear();
      throw new Error('The file does not contain a printable mesh.');
    }
    importedRoot.add(object);
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) {
      clearImportedModel();
      throw new Error('The file has invalid or empty bounds.');
    }
    const center = box.getCenter(new THREE.Vector3());
    object.position.add(new THREE.Vector3(-center.x, -center.y, -box.min.z));
    object.updateMatrixWorld(true);
    new THREE.Box3().setFromObject(object).getSize(importedBounds);
    resetImportedModelTransform();
    setPreviewSource('imported');
    return {
      name: file.name,
      format: extension.toUpperCase() as 'STL' | '3MF',
      meshCount,
      triangleCount: Math.round(triangleCount),
    };
  }

  function setModularSplit(on: boolean, vertical = modularVertical) {
    modularSplit = on;
    modularVertical = vertical;
    applyView();
    rebuildSwitchMeshes();
  }

  function setSection(axis: SectionAxis, pos: number) {
    sectionAxis = axis;
    sectionPos = pos;
    if (viewMode === 'section') updateClipPlane();
  }

  async function renderToPng(): Promise<Blob | null> {
    // Render one frame at 2Ã— into an offscreen-sized target, then capture.
    const w = container.clientWidth;
    const h = container.clientHeight;
    const prevRatio = renderer.getPixelRatio();
    renderer.setPixelRatio(Math.min(prevRatio * 2, 4));
    renderer.render(scene, camera);
    const blob = await new Promise<Blob | null>((res) =>
      renderer.domElement.toBlob((b) => res(b), 'image/png'),
    );
    renderer.setPixelRatio(prevRatio);
    renderer.setSize(w, h);
    return blob;
  }

  function onResize() {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize);
  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onResize);
  resizeObserver?.observe(container);

  let raf = 0;
  (function animate() {
    raf = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  })();

  // Paint hover/selection glow via emissive (keeps each part's true base color).
  // Image/SVG parts can contain tens of thousands of triangulation edges. Drawing
  // EdgesGeometry for those parts turns selection into a blue wireframe and makes
  // a clean top image look broken, even though the printable mesh is valid. Keep
  // the outline for simple mechanical parts and use the emissive highlight for
  // dense image meshes.
  function createSelectionOutline(mesh: THREE.Mesh): THREE.LineSegments | null {
    const partName = String((mesh.userData as { partName?: string }).partName ?? '');
    // The generated image/base meshes are triangulated silhouettes. Even when
    // their vertex count is small, their coplanar triangulation produces a
    // noisy edge overlay (white/blue speckles) when the user selects them.
    // Keep image selection feedback on the material only.
    if (
      partName === 'top-base'
      || /^(?:top-color|bottom-color|hybrid-image|keycap-image)-/.test(partName)
    ) return null;

    const positionCount = mesh.geometry.getAttribute('position')?.count ?? 0;
    const indexCount = mesh.geometry.index?.count ?? 0;
    if (Math.max(positionCount, indexCount) > 6000) return null;

    const edges = new THREE.EdgesGeometry(mesh.geometry, 42);
    const outline = new THREE.LineSegments(edges, outlineMaterial);
    outline.position.copy(mesh.position);
    outline.quaternion.copy(mesh.quaternion);
    outline.scale.copy(mesh.scale);
    return outline;
  }

  function applyHighlight() {
    if (outlineMesh) {
      outlineMesh.removeFromParent();
      outlineMesh.traverse((child: any) => {
        if (child.geometry) child.geometry.dispose();
      });
      outlineMesh = null;
    }
    for (let i = 0; i < partMeshes.length; i++) {
      const isSelected = selectedIndices.includes(i);
      const isHovered = hoveredIndex === i;
      const m = materials[i] as THREE.MeshStandardMaterial;
      if (m) {
        if (isSelected || isHovered) {
          m.emissive.copy(HILITE);
          m.emissiveIntensity = isHovered ? 0.4 : 0.2;
        } else {
          m.emissiveIntensity = 0;
        }
      }
    }

    if (selectedIndices.length > 0) {
      const outlineGroup = new THREE.Group();
      for (const idx of selectedIndices) {
        const mesh = partMeshes[idx];
        if (mesh) {
          const subOutline = createSelectionOutline(mesh);
          if (subOutline) outlineGroup.add(subOutline);
        }
      }
      const anchor = selectedIndices
        .map((idx) => partMeshes[idx])
        .find((mesh): mesh is THREE.Mesh => Boolean(mesh));
      if (outlineGroup.children.length > 0 && anchor) {
        outlineMesh = outlineGroup as any;
        outlineMesh!.renderOrder = 999;
        anchor.parent?.add(outlineMesh!);
      }
    } else if (hoveredIndex !== null && partMeshes[hoveredIndex]) {
      const mesh = partMeshes[hoveredIndex];
      const outline = createSelectionOutline(mesh);
      if (outline) {
        outlineMesh = outline;
        outlineMesh!.renderOrder = 999;
        mesh.parent?.add(outlineMesh!);
      }
    }
  }

  function pickIndexAt(clientX: number, clientY: number): number | null {
    if (partMeshes.length === 0) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(partMeshes, false);
    for (const h of hits) {
      const idx = (h.object.userData as { partIndex?: number }).partIndex;
      if (typeof idx === 'number') return idx;
    }
    return null;
  }

  const onPointerMove = (e: PointerEvent) => {
    if (e.buttons !== 0) return; // mid orbit/pan â€” don't fight the controls

    const idx = pickIndexAt(e.clientX, e.clientY);
    renderer.domElement.style.cursor = idx === null ? '' : 'pointer';
    if (idx !== hoveredIndex) {
      hoveredIndex = idx;
      applyHighlight();
    }
  };
  const onPointerLeave = () => {
    if (hoveredIndex !== null) {
      hoveredIndex = null;
      applyHighlight();
    }
  };
  const onPointerDown = (e: PointerEvent) => {
    downX = e.clientX;
    downY = e.clientY;
    downT = performance.now();
  };
  const onPointerUp = (e: PointerEvent) => {
    // Only a tap (not an orbit drag) counts as a part click.
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return;
    if (performance.now() - downT > 500) return;
    const idx = pickIndexAt(e.clientX, e.clientY);

    // Empty space clears the selection (all modes).
    if (idx === null) {
      selectedIndices = [];
      applyHighlight();
      pickCb?.(null, e.clientX, e.clientY, e.shiftKey);
      return;
    }

    // Shift-click toggles multi-selection in every mode; plain click selects one.
    if (e.shiftKey) {
      selectedIndices = selectedIndices.includes(idx)
        ? selectedIndices.filter(i => i !== idx)
        : [...selectedIndices, idx];
    } else {
      selectedIndices = [idx];
    }
    applyHighlight();
    pickCb?.(idx, e.clientX, e.clientY, e.shiftKey);
  };
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerleave', onPointerLeave);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointerup', onPointerUp);

  function onPartPick(cb: (index: number | null, clientX: number, clientY: number, shiftKey: boolean) => void) {
    pickCb = cb;
  }
  function setPartColor(index: number, rgb: RGB) {
    const m = materials[index] as THREE.MeshStandardMaterial | undefined;
    if (m) m.color = color(rgb);
  }
  function highlightPart(index: number | null) {
    selectedIndices = index !== null ? [index] : [];
    applyHighlight();
  }
  function highlightParts(indices: number[]) {
    selectedIndices = indices;
    applyHighlight();
  }
  function clearHighlight() {
    selectedIndices = [];
    hoveredIndex = null;
    applyHighlight();
  }

  function dispose() {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
    resizeObserver?.disconnect();
    renderer.domElement.removeEventListener('pointermove', onPointerMove);
    renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
    renderer.domElement.removeEventListener('pointerdown', onPointerDown);
    renderer.domElement.removeEventListener('pointerup', onPointerUp);
    clearGroup(capGroup);
    clearGroup(bodyGroup);
    clearSwitchMeshes();
    clearImportedModel();
    switchGeometry?.dispose();
    switchMaterial?.dispose();
    controls.dispose();
    pmrem.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  }
  function setTheme(theme: string) {
    const bgColor = theme === 'dark' ? 0x15171c : 0xf3f4f6;
    scene.background = new THREE.Color(bgColor);
    rebuildGrid(theme, gridZ);
  }

  return {
    setParts,
    setView,
    setSection,
    setSwitch,
    showSwitch,
    setSwitchPlacements,
    importModel,
    setImportedModelColor,
    setPreviewSource,
    clearImportedModel,
    setImportedModelRotation,
    resetImportedModelTransform,
    setModularSplit,
    renderToPng,
    setTheme,
    onPartPick,
    setPartColor,
    highlightPart,
    highlightParts,
    clearHighlight,
    dispose,
  };
}



