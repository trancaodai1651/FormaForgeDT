export type CsvRow = Record<string, string>;
export function parseCsv(text: string): string[][] {
  const delimiter = text.split("\n")[0].includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((s) => s.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("CSV_QUOTES");
  row.push(cell);
  if (row.some((s) => s.trim())) rows.push(row);
  return rows;
}
const normalize = (s: string) => s.trim().toLowerCase().replace(/[ -]+/g, "_");
export type CsvMode = "auto" | "header" | "names";
export function batchRows(text: string, mode: CsvMode = "auto"): CsvRow[] {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const first = rows[0].map(normalize);
  const header =
    mode === "header" ||
    (mode !== "names" &&
      first.some((x) =>
        [
          "name",
          "line1",
          "text",
          "quantity",
          "qty",
          "order_number",
          "personalisation",
          "personalization",
        ].includes(x),
      ));
  if (!header)
    return rows
      .flatMap((r) => r.map((name) => ({ name: name.trim(), quantity: "1" })))
      .filter((r) => r.name);
  return rows
    .slice(1)
    .map((r) =>
      Object.fromEntries(first.map((key, i) => [key, r[i]?.trim() ?? ""])),
    )
    .filter((r) => Object.values(r).some(Boolean));
}
export function csvText(rows: (string | number)[][]) {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((v) => {
            let s = String(v);
            if (/^[=+@\-]/.test(s)) s = "'" + s;
            return '"' + s.replace(/"/g, '""') + '"';
          })
          .join(","),
      )
      .join("\r\n")
  );
}
export const templateCsv = (width: number, height: number) =>
  csvText([
    [
      "name",
      "line2",
      "line3",
      "quantity",
      "base_color",
      "text_color",
      "width",
      "height",
      "order_number",
      "image",
    ],
    ["Alice", "", "", "1", "#356CD1", "#FFFFFF", width, height, "1001", ""],
  ]);
