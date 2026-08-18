import type { MeshData } from '@hometown/types';
import type { FlexLampConfig, FlexLampPattern } from './geometry';

const ASSET_BASE = `${import.meta.env.BASE_URL}flex-lamp-assets/`;

const METRICS = {
  socketOuterRadius: 35.0559,
  socketInnerRadius: 33.5708,
  threadMinorRadius: 31.4184,
  threadMajorRadius: 33.0816,
  threadStartZ: 0,
  threadTopZ: 7,
  shortSocketHeight: 10.5364,
  capTopZ: 104.8991,
  cutterRadius: 34.9059,
} as const;

const FAMILY: Record<FlexLampPattern, string> = {
  circle: 'circles',
  hexagon: 'hexagons',
  vertical: 'slots',
  diamond: 'diamond',
  wave: 'wave',
};

type WorkerMesh = {
  positions: Float32Array;
  indices: Uint32Array;
};

type ShadeCommit = {
  ok: boolean;
  tris: number;
  volume: number;
  bodies: number;
  ms: number;
  mesh?: WorkerMesh;
  error?: string;
};

export type ReferenceShadeResult = {
  mesh: MeshData;
  triangles: number;
  volume: number;
  generationTime: number;
};

type RpcResponse = {
  id?: string;
  type?: 'RAW' | 'HANDLER';
  name?: string;
  value?: unknown;
};

type PendingCall = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
};

let worker: Worker | null = null;
let initialization: Promise<void> | null = null;
let callSequence = 0;
const pending = new Map<string, PendingCall>();

function rpc<T>(method: string, ...args: unknown[]): Promise<T> {
  if (!worker) throw new Error('Flex Lamp geometry worker is not ready.');
  const id = `flex-lamp-${Date.now()}-${callSequence += 1}`;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
    worker?.postMessage({
      id,
      type: 'APPLY',
      path: [method],
      argumentList: args.map((value) => ({ type: 'RAW', value })),
    });
  });
}

function handleWorkerMessage(event: MessageEvent<RpcResponse>) {
  const id = event.data?.id;
  if (!id) return;
  const call = pending.get(id);
  if (!call) return;
  pending.delete(id);
  if (event.data.type === 'HANDLER' && event.data.name === 'throw') {
    const payload = event.data.value as { isError?: boolean; value?: { message?: string } } | undefined;
    call.reject(new Error(payload?.value?.message ?? 'Flex Lamp geometry worker failed.'));
    return;
  }
  call.resolve(event.data.value);
}

async function ensureWorker() {
  if (initialization) return initialization;
  initialization = (async () => {
    worker = new Worker(`${ASSET_BASE}geometry.worker.js`, { type: 'module' });
    worker.addEventListener('message', handleWorkerMessage);
    worker.addEventListener('error', (event) => {
      const error = new Error(event.message || 'Flex Lamp geometry worker failed.');
      pending.forEach((call) => call.reject(error));
      pending.clear();
    });
    const [solidSubtract, finishLedLamp, finishShortLedLamp, solidSubtractShort] = await Promise.all([
      fetch(`${ASSET_BASE}solidsubtract.glb`).then((response) => response.arrayBuffer()),
      fetch(`${ASSET_BASE}finishledlamp.glb`).then((response) => response.arrayBuffer()),
      fetch(`${ASSET_BASE}finishshortledlamp.glb`).then((response) => response.arrayBuffer()),
      fetch(`${ASSET_BASE}solidsubtractshort.glb`).then((response) => response.arrayBuffer()),
    ]);
    await rpc('init', { solidSubtract, finishLedLamp, finishShortLedLamp, solidSubtractShort, metrics: METRICS });
  })();
  return initialization;
}

function meshMetadata(positions: Float32Array) {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let index = 0; index < positions.length; index += 3) {
    minX = Math.min(minX, positions[index]);
    minY = Math.min(minY, positions[index + 1]);
    minZ = Math.min(minZ, positions[index + 2]);
    maxX = Math.max(maxX, positions[index]);
    maxY = Math.max(maxY, positions[index + 1]);
    maxZ = Math.max(maxZ, positions[index + 2]);
  }
  return {
    width: maxX - minX,
    height: maxZ - minZ,
    depth: maxY - minY,
    wallThickness: 1.6,
    shape: 'pattern' as const,
  };
}

export async function buildReferenceShade(config: FlexLampConfig): Promise<ReferenceShadeResult> {
  await ensureWorker();
  const result = await rpc<ShadeCommit>('commitShade', {
    family: FAMILY[config.pattern],
    angularCount: Math.round(config.around),
    verticalCount: Math.round(config.rows),
    cellSize: config.cellSize,
    rotation: config.rotation,
  });
  if (!result.ok || !result.mesh) throw new Error(result.error ?? 'Could not generate the Flex Lamp shade.');
  return {
    mesh: {
      vertices: Array.from(result.mesh.positions),
      indices: Array.from(result.mesh.indices),
      metadata: meshMetadata(result.mesh.positions),
    },
    triangles: result.tris,
    volume: result.volume / 1000,
    generationTime: Math.round(result.ms),
  };
}

