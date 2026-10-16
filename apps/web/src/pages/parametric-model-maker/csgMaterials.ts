// OpenSCAD's CSG export has evaluated loops, modules and expressions already.
// Partition only this compiler output; never evaluate user code as JavaScript.
type Node = { call: string; name: string; children: Node[] };
function nodes(source: string): Node[] {
  let at = 0;
  function read(): Node[] {
    const result: Node[] = [];
    while (at < source.length) {
      while (/[\s;]/.test(source[at] ?? "") && at < source.length) at++;
      if (source[at] === "}") {
        at++;
        break;
      }
      if (at >= source.length) break;
      const start = at;
      let quote = false,
        escape = false,
        depth = 0;
      while (at < source.length) {
        const c = source[at];
        if (escape) {
          escape = false;
          at++;
          continue;
        }
        if (c === "\\" && quote) {
          escape = true;
          at++;
          continue;
        }
        if (c === '"') quote = !quote;
        if (!quote) {
          if (c === "(" || c === "[") depth++;
          if (c === ")" || c === "]") depth--;
          if (!depth && (c === "{" || c === ";")) break;
        }
        at++;
      }
      const call = source.slice(start, at).trim(),
        name = call.match(/^\w+/)?.[0] ?? "";
      const block = source[at++] === "{";
      if (call) result.push({ call, name, children: block ? read() : [] });
    }
    return result;
  }
  return read();
}
const emit = (node: Node): string =>
  node.children.length
    ? `${node.call}{${node.children.map(emit).join("\n")}}`
    : `${node.call};`;
const union = (children: string[]) =>
  children.length === 1 ? children[0] : `union(){${children.join("\n")}}`;
function colorOf(n: Node, fallback: string) {
  if (n.name !== "color") return fallback;
  const numbers = n.call
    .match(/\[([^\]]+)\]/)?.[1]
    .split(",")
    .map(Number);
  return numbers && numbers.length >= 3 && numbers.every(Number.isFinite)
    ? `#${numbers
        .slice(0, 3)
        .map((x) =>
          Math.round(Math.max(0, Math.min(1, x)) * 255)
            .toString(16)
            .padStart(2, "0"),
        )
        .join("")}`
    : fallback;
}
export function partitionCsg(
  source: string,
): { color: string; source: string }[] {
  function collect(node: Node, inherited: string): Map<string, string[]> {
    const color = colorOf(node, inherited),
      parts = new Map<string, string[]>();
    const add = (c: string, s: string) =>
      parts.set(c, [...(parts.get(c) ?? []), s]);
    if (!node.children.length) {
      if (!["group", "union", "color"].includes(node.name))
        add(color, emit(node));
      return parts;
    }
    // The first operand supplies the visible material for subtraction/intersection.
    if (node.name === "difference" || node.name === "intersection") {
      for (const [c, items] of collect(node.children[0], color))
        add(
          c,
          `${node.name}(){${union(items)}\n${node.children.slice(1).map(emit).join("\n")}}`,
        );
      return parts;
    }
    // Hull/minkowski create new surfaces; OpenSCAD does not define a material interpolation.
    if (node.name === "hull" || node.name === "minkowski") {
      const first =
        collect(node.children[0], color).keys().next().value ?? color;
      add(first, emit(node));
      return parts;
    }
    for (const child of node.children)
      for (const [c, items] of collect(child, color)) {
        for (const item of items)
          add(
            c,
            ["color", "group", "union"].includes(node.name)
              ? item
              : `${node.call}{${item}}`,
          );
      }
    return parts;
  }
  const result = collect(
    { name: "union", call: "union()", children: nodes(source) },
    "#ef4444",
  );
  // Earlier material wins where volumes overlap. Every material is a closed solid.
  const earlier: string[] = [];
  return [...result].map(([color, items]) => {
    const raw = union(items);
    const source = earlier.length
      ? `difference(){${raw}\n${union(earlier)}}`
      : raw;
    earlier.push(raw);
    return { color, source };
  });
}
export function parseOff(source: string): {
  vertices: Float32Array;
  indices: Uint32Array;
} {
  const tokens = source
    .replace(/#[^\n]*/g, "")
    .trim()
    .split(/\s+/);
  let at = 0;
  if (tokens[at++] !== "OFF")
    throw new Error("OpenSCAD không trả về lưới OFF hợp lệ.");
  const nv = Number(tokens[at++]),
    nf = Number(tokens[at++]);
  at++;
  if (
    !Number.isInteger(nv) ||
    nv < 0 ||
    nv > 5e6 ||
    !Number.isInteger(nf) ||
    nf < 0 ||
    nf > 1e7
  )
    throw new Error("Lưới vượt giới hạn hoặc không hợp lệ.");
  const vertices = Float32Array.from({ length: nv * 3 }, () =>
    Number(tokens[at++]),
  );
  if (vertices.some((v) => !Number.isFinite(v)))
    throw new Error("Lưới chứa tọa độ không hợp lệ.");
  const triangles: number[] = [];
  for (let f = 0; f < nf; f++) {
    const count = Number(tokens[at++]);
    if (!Number.isInteger(count) || count < 3 || count > 100000)
      throw new Error("Mặt lưới không hợp lệ.");
    const face = Array.from({ length: count }, () => Number(tokens[at++]));
    if (face.some((i) => !Number.isInteger(i) || i < 0 || i >= nv))
      throw new Error("Chỉ số đỉnh không hợp lệ.");
    for (let i = 1; i < count - 1; i++)
      triangles.push(face[0], face[i], face[i + 1]);
  }
  return { vertices, indices: new Uint32Array(triangles) };
}
