import type { BuildContext } from '../buildContext';
import { edgePointAt } from './sectionUtils';

/** Shared Image keyring: round loop, long connecting bridge and through-hole. */
export function imageKeyringProfile(ctx: BuildContext, plate: any, holeDiameter: number, angle = 90, offset = 0) {
  const { p, dir } = edgePointAt(plate, angle);
  const anchor: [number, number] = [p[0] - dir[1] * offset, p[1] + dir[0] * offset];
  const holeRadius = Math.max(1.5, holeDiameter / 2);
  const radius = Math.max(3.2, holeRadius + 1.8);
  const loop = ctx.track(ctx.wasm.CrossSection.circle(radius, 64).translate([0, radius]));
  const bridge = ctx.track(ctx.wasm.CrossSection.square([radius * 2, radius * 4.5], true)
    .translate([0, radius - radius * 4.5 / 2]));
  let footprint = ctx.track(loop.add(bridge));
  if (Math.abs(angle - 90) > 0.001) footprint = ctx.track(footprint.rotate(angle - 90));
  footprint = ctx.track(footprint.translate(anchor));
  const radians = (angle - 90) * Math.PI / 180;
  const holeCenter: [number, number] = [anchor[0] - radius * Math.sin(radians), anchor[1] + radius * Math.cos(radians)];
  const bore = ctx.track(ctx.wasm.CrossSection.circle(holeRadius, 48).translate(holeCenter));
  return { footprint, bore };
}
