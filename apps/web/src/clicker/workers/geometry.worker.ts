// Geometry worker: owns the Manifold WASM kernel and the validated MX assets.
// All CSG happens here so the UI thread never blocks. See DEV_PLAN.md §1, §6.
import Module from 'manifold-3d';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import { parse3MF } from '../geometry/threemfImport';
import { buildClicker } from '../geometry/buildClicker';
import { buildBlocks, prepareBlockAssets, type KeycapAsset, type PreparedBlockAssets } from '../geometry/buildBlocks';
import { buildHybridClicker } from '../geometry/buildHybridClicker';
import { buildFlexKeychain } from '../geometry/buildFlexKeychain';
import type { GeometryRequest, GeometryResponse, ClickerPart } from '../types';

type Wasm = Awaited<ReturnType<typeof Module>>;

let modulePromise: Promise<Wasm> | null = null;
let socket: any = null; // cached MX socket (negative), in mm
let stem: any = null; // cached MX stem (positive), in mm
let blockAssets: PreparedBlockAssets | null = null;
let keycapAsset: KeycapAsset | null = null;

async function getModule(): Promise<Wasm> {
  if (!modulePromise) {
    modulePromise = (async () => {
      const wasm = await Module({ locateFile: () => wasmUrl });
      wasm.setup();
      return wasm;
    })();
  }
  return modulePromise;
}

function status(message: string) {
  post({ type: 'status', message });
}

function post(msg: GeometryResponse, transfer: Transferable[] = []) {
  (self as unknown as Worker).postMessage(msg, transfer);
}

function assetToSolid(wasm: any, buf: ArrayBuffer): { solid: any; info: string } {
  const raw = parse3MF(buf);
  const mesh = new wasm.Mesh({
    numProp: 3,
    vertProperties: raw.vertProperties,
    triVerts: raw.triVerts,
  });
  mesh.merge();
  const solid = wasm.Manifold.ofMesh(mesh);
  const bb = solid.boundingBox();
  const size = [bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]];
  const status = typeof solid.status === 'function' ? solid.status() : 'ok';
  const info = `${size.map((v: number) => v.toFixed(2)).join('×')} mm, Z[${bb.min[2].toFixed(
    2,
  )},${bb.max[2].toFixed(2)}], status=${status}`;
  return { solid, info };
}

self.onmessage = async (e: MessageEvent<GeometryRequest>) => {
  const msg = e.data;
  try {
    status(`Geometry worker: received ${msg.type}`);
    const wasm = await getModule();
    status('Geometry worker: WASM ready');

    if (msg.type === 'ping') {
      post({ type: 'ready' });
      return;
    }

    if (msg.type === 'init') {
      socket?.delete?.();
      stem?.delete?.();
      for (const solid of blockAssets?.owned ?? []) solid?.delete?.();
      blockAssets = null;
      keycapAsset = null;
      status('Geometry worker: parsing socket');
      const a = assetToSolid(wasm, msg.socket);
      status('Geometry worker: parsing stem');
      const b = assetToSolid(wasm, msg.stem);
      
      const sbb = a.solid.boundingBox();
      const scx = (sbb.min[0] + sbb.max[0]) / 2;
      const scy = (sbb.min[1] + sbb.max[1]) / 2;
      socket = a.solid.translate([-scx, -scy, -sbb.max[2]]);

      const tbb = b.solid.boundingBox();
      const tcx = (tbb.min[0] + tbb.max[0]) / 2;
      const tcy = (tbb.min[1] + tbb.max[1]) / 2;
      stem = b.solid.translate([-tcx, -tcy, 0]);

      a.solid.delete();
      b.solid.delete();

      if (msg.blockNoSides && msg.blockSouth && msg.blockNorthSouth && msg.blockNorthWest && msg.blockNorthSouthWest && msg.blockAllSides && msg.keycapJson) {
        status('Geometry worker: preparing block assets');
        blockAssets = prepareBlockAssets(wasm, socket, {
          noSides: msg.blockNoSides,
          south: msg.blockSouth,
          northSouth: msg.blockNorthSouth,
          northWest: msg.blockNorthWest,
          northSouthWest: msg.blockNorthSouthWest,
          allSides: msg.blockAllSides,
          keycapJson: msg.keycapJson,
        });
        keycapAsset = {
          shell: { positions: msg.keycapJson.positions, indices: msg.keycapJson.indices },
          stem: msg.keycapJson.stem ?? null,
          meta: msg.keycapJson.meta,
        };
      }

      status('Geometry worker: parsing switch');
      const sw = parse3MF(msg.switch);
      const v = sw.vertProperties;
      let maxExtent = 0;
      for (let i = 0; i < v.length; i += 3) {
        v[i] -= tcx;
        v[i + 1] -= tcy;
        const ext = Math.max(Math.abs(v[i]), Math.abs(v[i + 1]));
        if (ext > maxExtent) maxExtent = ext;
      }
      const wide = maxExtent * 0.96;
      let seatZ = Infinity;
      for (let i = 0; i < v.length; i += 3) {
        if (Math.max(Math.abs(v[i]), Math.abs(v[i + 1])) >= wide && v[i + 2] < seatZ) {
          seatZ = v[i + 2];
        }
      }
      let zmin = Infinity;
      let zmax = -Infinity;
      for (let i = 0; i < v.length; i += 3) {
        v[i + 2] -= seatZ;
        if (v[i + 2] < zmin) zmin = v[i + 2];
        if (v[i + 2] > zmax) zmax = v[i + 2];
      }
      const switchMesh = { vertProperties: v, triVerts: sw.triVerts, numProp: 3 as const };
      const switchInfo = `${(sw.triVerts.length / 3) | 0} tris, seated +${(-seatZ).toFixed(
        2,
      )}mm, Z[${zmin.toFixed(2)},${zmax.toFixed(2)}]`;
      
      post({ type: 'initDone', socketInfo: a.info, stemInfo: b.info, switchInfo, switchMesh }, [
        switchMesh.vertProperties.buffer,
        switchMesh.triVerts.buffer,
      ]);
      return;
    }

    if (msg.type === 'buildClicker') {
      if (!socket || !stem) throw new Error('Assets not initialized');
      
      const { regions, outline, params } = msg;
      const bottomOutline = (msg as any).bottomOutline;

      const { parts, switchPlacements, warnings } = buildClicker(
        wasm,
        socket,
        stem,
        regions,
        outline,
        params,
        bottomOutline,
      );

      const transfer: Transferable[] = [];
      for (const p of parts as ClickerPart[]) {
        transfer.push(p.vertProperties.buffer, p.triVerts.buffer);
      }

      // Post parts and include any non-fatal build warnings collected in buildClicker
      post({ type: 'parts', requestId: msg.requestId, parts, switchPlacements, warnings }, transfer);
      return;
    }

    if (msg.type === 'buildBlocks') {
      if (!blockAssets || !keycapAsset) throw new Error('Block assets not initialized');
      const { parts, switchPlacements, warnings } = buildBlocks(wasm, blockAssets, keycapAsset, msg.params, socket);
      const transfer: Transferable[] = [];
      for (const p of parts as ClickerPart[]) transfer.push(p.vertProperties.buffer, p.triVerts.buffer);
      post({ type: 'parts', requestId: msg.params.requestId, parts, switchPlacements, warnings }, transfer);
      return;
    }

    if (msg.type === 'buildHybridClicker') {
      if (!blockAssets || !keycapAsset) throw new Error('Block assets not initialized');
      const { parts, switchPlacements, warnings } = buildHybridClicker(
        wasm,
        blockAssets,
        keycapAsset,
        socket,
        msg.regions,
        msg.outline,
        msg.params,
        msg.blockParams,
      );
      const transfer: Transferable[] = [];
      for (const p of parts as ClickerPart[]) transfer.push(p.vertProperties.buffer, p.triVerts.buffer);
      post({ type: 'parts', parts, switchPlacements, warnings }, transfer);
      return;
    }

    if (msg.type === 'buildFlexKeychain') {
      if (!blockAssets || !keycapAsset) throw new Error('Assets not initialized');
      const { parts, switchPlacements, warnings } = buildFlexKeychain(
        wasm,
        blockAssets,
        keycapAsset,
        socket,
        msg.params,
      );
      const transfer: Transferable[] = [];
      for (const p of parts as ClickerPart[]) transfer.push(p.vertProperties.buffer, p.triVerts.buffer);
      post({ type: 'parts', requestId: msg.params.requestId, parts, switchPlacements, warnings }, transfer);
      return;
    }
  } catch (err) {
    const ctx: any = { msgType: msg?.type };
    try {
      if (msg && (msg as any).params) ctx.params = { topProfile: (msg as any).params.topProfile, topProfileHeight: (msg as any).params.topProfileHeight, extrudeChamfer: (msg as any).params.extrudeChamfer };
    } catch (e) {
      /* ignore */
    }
    const baseMsg = err instanceof Error ? (err.stack ?? err.message) : String(err);
    const ctxStr = JSON.stringify(ctx);
    post({
      type: 'error',
      message: `${baseMsg} | context=${ctxStr}`,
    } as any);
  }
};

// Let the host attach its message handler before the initial handshake. This
// matters when the worker is booted from a nested Shadow DOM runtime where the
// host module may finish evaluating a few ticks after the worker module.
setTimeout(() => post({ type: 'ready' }), 0);
