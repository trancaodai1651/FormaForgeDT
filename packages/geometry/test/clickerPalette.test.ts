import { describe, expect, it } from 'vitest';
import { quantize, retainVisiblePaletteColors } from '../../../apps/web/src/clicker/image/quantize';

describe('Clicker artwork palette', () => {
  it('keeps black outlines separate from grey fill amid cyan gradients', () => {
    const colors = [[0,0,0], [52,52,52], [255,255,255], [95,205,236], [113,221,252]];
    const counts = [1600,3500,3100,1100,700];
    const data = new Uint8ClampedArray(10000 * 4);
    let pixel = 0;
    colors.forEach((rgb, i) => {
      for (let j = 0; j < counts[i]; j++) data.set([...rgb,255], pixel++ * 4);
    });
    const result = retainVisiblePaletteColors(quantize({data,width:100,height:100},6));
    expect(result.palette).toHaveLength(4);
    expect(result.indices[0]).not.toBe(result.indices[1600]);
    expect(result.indices[8200]).toBe(result.indices[9500]);
    expect(result.palette[result.indices[0]].rgb.every(value => value < 10)).toBe(true);
    expect(result.palette[result.indices[1600]].rgb[0]).toBeGreaterThan(40);
    expect([...result.indices].every(index => index >= 0)).toBe(true);
  });
});
