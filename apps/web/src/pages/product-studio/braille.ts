import type { ProductBuilder } from "./geometryContext";
// BANA uncontracted English alphabet; dot columns are 1/2/3 and 4/5/6.
const ALPHABET: Record<string, string> = {
  a: "1",
  b: "12",
  c: "14",
  d: "145",
  e: "15",
  f: "124",
  g: "1245",
  h: "125",
  i: "24",
  j: "245",
  k: "13",
  l: "123",
  m: "134",
  n: "1345",
  o: "135",
  p: "1234",
  q: "12345",
  r: "1235",
  s: "234",
  t: "2345",
  u: "136",
  v: "1236",
  w: "2456",
  x: "1346",
  y: "13456",
  z: "1356",
  " ": "",
  ",": "2",
  ";": "23",
  ":": "25",
  ".": "256",
  "!": "235",
  "?": "236",
  "-": "36",
  "'": "3",
};
export function brailleCells(text: string): string[] {
  const cells: string[] = [];
  let numeric = false;
  for (const ch of text) {
    if (/[0-9]/.test(ch)) {
      if (!numeric) cells.push("3456");
      cells.push(ALPHABET["jabcdefghi"[Number(ch)]]);
      numeric = true;
      continue;
    }
    if (numeric && /[a-j]/i.test(ch)) cells.push("56");
    numeric = false;
    if (ch !== ch.toLowerCase()) cells.push("6");
    const cell = ALPHABET[ch.toLowerCase()];
    if (cell === undefined) throw new Error("BRAILLE_UNSUPPORTED");
    cells.push(cell);
  }
  return cells;
}
export async function brailleProduct(b: ProductBuilder) {
  const lines = b.design.lines.filter((l) => l.text.trim()),
    cells = lines.map((l) => brailleCells(l.text)),
    pitch = b.n("cellPitch"),
    dot = b.n("dotPitch"),
    z = b.n("baseHeight"),
    w = Math.max(
      b.n("width"),
      Math.max(...cells.map((c) => c.length), 1) * pitch + 8,
    ),
    h = Math.max(
      b.n("height"),
      cells.length * 12 + (b.b("printedLabel") ? lines.length * 10 + 8 : 0),
    );
  b.add("Base", b.at(b.outline(w, h), z), b.s("baseColor"));
  for (let row = 0; row < cells.length; row++)
    for (let i = 0; i < cells[row].length; i++)
      for (const n of cells[row][i]) {
        const index = Number(n) - 1,
          x =
            (i - (cells[row].length - 1) / 2) * pitch +
            (index >= 3 ? dot / 2 : -dot / 2),
          y =
            (cells.length - 1 - row) * 12 - h / 2 + 7 + (1 - (index % 3)) * dot;
        const radius = b.n("dotDiameter") / 2,
          height = b.n("dotHeight"),
          sphere = b.track(b.api.Manifold.sphere(radius, 24));
        let cap = b.track(sphere.scale([1, 1, height / radius]));
        cap = b.transform(cap, x, y, z);
        cap = b.track(
          cap.intersect(
            b.at(b.move(b.circle(radius + 1), x, y), height + 0.05, z - 0.05),
          ),
        );
        b.add("Braille dot", cap, b.s("decorationColor"));
      }
  if (b.b("printedLabel"))
    for (const [row, l] of lines.entries()) {
      const label = await b.text({
        ...l,
        size: Math.min(l.size, 8),
        x: 0,
        y: h / 2 - 8 - row * 10,
      });
      b.decorate(label, z, "raised", 0.6, 0.5, l.color, "Printed label");
    }
}
