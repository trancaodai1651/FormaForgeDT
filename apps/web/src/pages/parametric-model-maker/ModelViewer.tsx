import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { PartMesh } from "./model";
type ViewerHandle = {
  setParts: (p: PartMesh[]) => void;
  view: (preset: string) => void;
  floor: (grid: boolean, size: number) => void;
  wire: (enabled: boolean) => void;
};
export function ModelViewer({
  parts,
  grid,
  bed,
  wire,
  onSelect,
  orthographic = false,
}: {
  parts: PartMesh[];
  grid: boolean;
  bed: number;
  wire: boolean;
  onSelect: (role: string) => void;
  orthographic?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null),
    handle = useRef<ViewerHandle | null>(null),
    select = useRef(onSelect);
  select.current = onSelect;
  useEffect(() => {
    if (!host.current) return;
    const root = host.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      root.textContent =
        "Không khởi tạo được WebGL. Hãy bật tăng tốc đồ họa của trình duyệt.";
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor("#0b1120");
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    root.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = orthographic
      ? new THREE.OrthographicCamera(-30, 30, 30, -30, 0.01, 10000)
      : new THREE.PerspectiveCamera(38, 1, 0.01, 10000);
    let viewHeight = 60;
    const projection = () => {
      const { width, height } = root.getBoundingClientRect();
      const aspect = width / Math.max(1, height);
      if (camera instanceof THREE.OrthographicCamera) {
        camera.left = (-viewHeight * aspect) / 2;
        camera.right = (viewHeight * aspect) / 2;
        camera.top = viewHeight / 2;
        camera.bottom = -viewHeight / 2;
      } else camera.aspect = aspect;
      camera.updateProjectionMatrix();
    };
    camera.up.set(0, 0, 1);
    camera.position.set(58, -74, 90);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 0.5;
    controls.maxDistance = 3000;
    controls.minZoom = 0.05;
    controls.maxZoom = 100;
    scene.add(new THREE.HemisphereLight("#ffffff", "#667799", 2.5));
    const light = new THREE.DirectionalLight("#fff", 3);
    light.position.set(-40, -50, 100);
    scene.add(light);
    const meshes = new THREE.Group(),
      plate = new THREE.Group();
    scene.add(meshes, plate);
    let framed = false;
    let currentBounds = new THREE.Box3(
      new THREE.Vector3(-20, -20, 0),
      new THREE.Vector3(20, 20, 5),
    );
    const dispose = (group: THREE.Group) => {
      for (const o of [...group.children]) {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
          o.geometry.dispose();
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          ms.forEach((m) => m.dispose());
        }
        group.remove(o);
      }
    };
    const frame = (preset: string) => {
      const center = currentBounds.getCenter(new THREE.Vector3());
      const size = currentBounds.getSize(new THREE.Vector3());
      const distance = Math.max(size.length() * 1.5, 25);
      if (camera instanceof THREE.OrthographicCamera) {
        const aspect = root.clientWidth / Math.max(1, root.clientHeight);
        viewHeight = Math.max(size.y, size.x / aspect, size.z, 5) * 1.3;
        camera.zoom = 1;
        projection();
      }
      const direction =
        preset === "top"
          ? new THREE.Vector3(0, -0.001, 1)
          : preset === "front"
            ? new THREE.Vector3(0, -1, 0.03)
            : new THREE.Vector3(0.48, -0.68, 0.9).normalize();
      controls.target.copy(center);
      camera.position.copy(center).addScaledVector(direction, distance);
      controls.update();
    };
    handle.current = {
      setParts(list) {
        dispose(meshes);
        for (const p of list) {
          const g = new THREE.BufferGeometry();
          g.setAttribute("position", new THREE.BufferAttribute(p.vertices, 3));
          g.setIndex(new THREE.BufferAttribute(p.indices, 1));
          const display = toCreasedNormals(g, Math.PI / 5);
          g.dispose();
          const material = new THREE.MeshStandardMaterial({
            color: p.color,
            metalness: 0.03,
            roughness: 0.5,
            wireframe: wire,
          });
          const mesh = new THREE.Mesh(display, material);
          mesh.userData.role = p.role;
          meshes.add(mesh);
        }
        if (list.length) {
          currentBounds = new THREE.Box3().setFromObject(meshes);
          if (!framed) {
            frame(orthographic ? "top" : "iso");
            framed = true;
          }
        }
      },
      view: frame,
      floor(show, size) {
        dispose(plate);
        if (!show) return;
        const grid = new THREE.GridHelper(size, 20, "#60728c", "#263449");
        grid.rotateX(Math.PI / 2);
        grid.position.z = -0.05;
        plate.add(grid);
      },
      wire(enabled) {
        meshes.children.forEach((o) => {
          if (o instanceof THREE.Mesh)
            (o.material as THREE.MeshStandardMaterial).wireframe = enabled;
        });
      },
    };
    const resize = new ResizeObserver(() => {
      const { width, height } = root.getBoundingClientRect();
      renderer.setSize(Math.max(1, width), Math.max(1, height), false);
      projection();
    });
    resize.observe(root);
    let down: [number, number] = [0, 0];
    const pointerDown = (e: PointerEvent) => {
      down = [e.clientX, e.clientY];
    };
    const pointerUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      const r = root.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          (-(e.clientY - r.top) / r.height) * 2 + 1,
        ),
        camera,
      );
      const hit = ray.intersectObjects(meshes.children)[0];
      if (hit) select.current(String(hit.object.userData.role));
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(scene, camera);
    });
    return () => {
      resize.disconnect();
      renderer.setAnimationLoop(null);
      controls.dispose();
      dispose(meshes);
      dispose(plate);
      renderer.dispose();
      renderer.domElement.remove();
      handle.current = null;
    };
  }, [orthographic]);
  useEffect(() => {
    handle.current?.setParts(parts);
  }, [parts, orthographic]);
  useEffect(() => {
    handle.current?.floor(grid, bed);
  }, [grid, bed, orthographic]);
  useEffect(() => {
    handle.current?.wire(wire);
  }, [wire, parts, orthographic]);
  return (
    <div className="pmm-viewer-wrap">
      <div
        ref={host}
        className="pmm-canvas"
        aria-label="Khung xem mô hình 3D"
      />
      <div className="pmm-camera-controls">
        {[
          ["iso", "Phối cảnh"],
          ["top", "Trên"],
          ["front", "Trước"],
        ].map(([key, label]) => (
          <button key={key} onClick={() => handle.current?.view(key)}>
            {label}
          </button>
        ))}
        <button
          onClick={() => handle.current?.view("iso")}
          title="Căn mô hình vào màn hình"
        >
          Vừa khung
        </button>
      </div>
      <p className="pmm-orbit-hint">
        Kéo để xoay · chuột phải để di chuyển · cuộn để phóng to
      </p>
    </div>
  );
}
