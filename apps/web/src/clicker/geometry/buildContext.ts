export class BuildContext {
  wasm: any;
  trash: { delete(): void }[] = [];

  constructor(wasm: any) {
    this.wasm = wasm;
  }

  // Theo dõi bộ nhớ để dọn dẹp sau khi đúc xong
  track = <T extends { delete(): void }>(o: T): T => {
    this.trash.push(o);
    return o;
  };

  cleanup = () => {
    for (const o of this.trash) {
      try { o.delete(); } catch { /* đã giải phóng */ }
    }
  };

  simp = (s: any, eps = 0.04): any => {
    try { return typeof s.simplify === 'function' ? this.track(s.simplify(eps)) : s; } 
    catch { return s; }
  };

  grow = (sec: any, d: number): any => 
    d <= 0.001 ? sec : this.track(sec.offset(d, 'Round', 2.0, 32));

  shrink = (sec: any, d: number, fb: any, isEmpty: (s: any) => boolean): any => {
    if (d <= 0.01) return sec;
    const r = this.track(sec.offset(-d, 'Round', 2.0, 32));
    return isEmpty(r) ? fb : r;
  };

  extrudeAt = (cs: any, h: number, z: number, isEmpty: (s: any) => boolean): any => {
    const makeEmpty = () => {
      const dummy = this.track(this.track(this.wasm.Manifold.extrude(this.track(this.wasm.CrossSection.circle(0.1, 3)), 0.1)).translate([0, 0, z]));
      return this.track(dummy.subtract(dummy));
    };

    try {
      if (isEmpty(cs)) {
        return makeEmpty();
      }
    } catch (err) {
      // If testing emptiness fails, preserve stability by returning an empty solid.
      // eslint-disable-next-line no-console
      console.warn('BuildContext.extrudeAt: isEmpty check failed', err);
      return makeEmpty();
    }

    try {
      const solid = this.track(this.wasm.Manifold.extrude(cs, Math.max(0.01, h)));
      return this.track(solid.translate([0, 0, z]));
    } catch (err) {
      // If the extrude operation itself fails, return an empty solid rather than crashing.
      // eslint-disable-next-line no-console
      console.warn('BuildContext.extrudeAt: extrude failed', err);
      return makeEmpty();
    }
  };
}