import { afterEach, describe, expect, it, vi } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { downloadFile } from '../../../apps/web/src/lib/downloadFile';
import { buildThreeMF } from '../../../apps/web/src/clicker/export/threemfExport';
import { buildSTLPart } from '../../../apps/web/src/clicker/export/stlExport';
import type { ClickerPart } from '../../../apps/web/src/clicker/types';

const part: ClickerPart = {
  kind: 'body', group: 'top', name: 'pink-inlay', colorRgb: [255, 192, 220], numProp: 3,
  vertProperties: new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 3]),
  triVerts: new Uint32Array([0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3]),
};
const unusedDocument = {} as Document;
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('desktop native exports', () => {
  it.each(['3mf', 'stl'] as const)('preserves every generated %s byte in the native save command', async (extension) => {
    const bytes = extension === '3mf' ? buildThreeMF([part]) : buildSTLPart([part], 'top');
    const invoke = vi.fn(async () => `C:/exports/model.${extension}`);
    vi.stubGlobal('window', { __TAURI_INTERNALS__: { invoke } });
    expect(await downloadFile(new Blob([bytes]), `model.${extension}`, unusedDocument)).toBe(true);
    const [command, args] = invoke.mock.calls[0] as unknown as [string, { fileName: string; bytes: number[] }];
    expect(command).toBe('save_export_file');
    expect(args.fileName).toBe(`model.${extension}`);
    const saved = new Uint8Array(args.bytes);
    expect(saved).toEqual(bytes);
    if (extension === '3mf') {
      const files = unzipSync(saved);
      expect(strFromU8(files['3D/3dmodel.model']).toUpperCase()).toContain('#FFC0DC');
    } else {
      expect(new DataView(saved.buffer).getUint32(80, true)).toBe(4);
      expect(saved.length).toBe(84 + 4 * 50);
    }
  });

  it('handles cancellation and propagates native write errors without browser fallback', async () => {
    const invoke = vi.fn().mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('disk full'));
    vi.stubGlobal('window', { __TAURI_INTERNALS__: { invoke } });
    expect(await downloadFile(new Blob(['data']), 'test.stl', unusedDocument)).toBe(false);
    await expect(downloadFile(new Blob(['data']), 'test.stl', unusedDocument)).rejects.toThrow('disk full');
  });

  it('retains ordinary browser downloads outside Tauri and cleans up the object URL', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', {});
    const anchor = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
    const doc = { createElement: vi.fn(() => anchor), body: { appendChild: vi.fn() } } as unknown as Document;
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    expect(await downloadFile(new Blob(['test']), 'model.stl', doc)).toBe(true);
    expect(create).toHaveBeenCalledOnce();
    expect(anchor.download).toBe('model.stl');
    expect(anchor.click).toHaveBeenCalledOnce();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:test');
  });
});
