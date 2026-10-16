import type { Parameter, ParameterValue } from "./model";

function split(value: string, separator: string): string[] {
  const result: string[] = [];
  let start = 0,
    depth = 0,
    quote = false,
    escape = false;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\" && quote) {
      escape = true;
      continue;
    }
    if (c === '"') {
      quote = !quote;
      continue;
    }
    if (quote) continue;
    if (c === "[" || c === "(") depth++;
    if (c === "]" || c === ")") depth--;
    if (c === separator && depth === 0) {
      result.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  result.push(value.slice(start).trim());
  return result;
}
export function parseScadLiteral(source: string): ParameterValue | undefined {
  const s = source.trim();
  if (/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s)) return Number(s);
  if (s === "true" || s === "false") return s === "true";
  if (/^"(?:[^"\\]|\\.)*"$/.test(s)) {
    try {
      return JSON.parse(s) as string;
    } catch {
      return undefined;
    }
  }
  if (s.startsWith("[") && s.endsWith("]")) {
    const a = split(s.slice(1, -1), ",").map(parseScadLiteral);
    if (a.length && a.every((v) => typeof v === "number" && Number.isFinite(v)))
      return a as number[];
  }
  return undefined;
}
export function parseCustomizer(source: string): Parameter[] {
  const fields: Parameter[] = [];
  let group = "Tham số",
    description = "",
    depth = 0,
    inBlock = false;
  for (const raw of source.split(/\r?\n/)) {
    const header = raw.match(/^\s*\/\*\s*\[([^\]]+)\]\s*\*\//);
    if (header && depth === 0) {
      group = header[1].trim();
      description = "";
      continue;
    }
    // Remove comments while respecting strings, so braces or // in a filename do not change scope.
    let clean = "",
      trailing = "",
      quote = false,
      escape = false;
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i],
        next = raw[i + 1];
      if (inBlock) {
        if (c === "*" && next === "/") {
          inBlock = false;
          i++;
        }
        continue;
      }
      if (escape) {
        clean += c;
        escape = false;
        continue;
      }
      if (c === "\\" && quote) {
        clean += c;
        escape = true;
        continue;
      }
      if (c === '"') {
        quote = !quote;
        clean += c;
        continue;
      }
      if (!quote && c === "/" && next === "*") {
        inBlock = true;
        i++;
        continue;
      }
      if (!quote && c === "/" && next === "/") {
        trailing = raw.slice(i + 2).trim();
        break;
      }
      clean += c;
    }
    if (!clean.trim()) {
      if (trailing) description = trailing;
      continue;
    }
    const declaration =
      depth === 0
        ? clean.match(/^\s*([A-Za-z_][\w$]*)\s*=\s*(.*?)\s*;\s*$/)
        : null;
    if (declaration && group.toLowerCase() !== "hidden") {
      const [, key, literal] = declaration;
      const initial = parseScadLiteral(literal);
      if (initial !== undefined && !fields.some((p) => p.key === key)) {
        const p: Parameter = {
          key,
          label: key.replace(/_/g, " "),
          group,
          initial,
          type: Array.isArray(initial)
            ? "vector"
            : typeof initial === "boolean"
              ? "boolean"
              : typeof initial === "number"
                ? "number"
                : "text",
          description,
        };
        const spec = trailing.match(/^\[(.*)\]/)?.[1];
        if (spec) {
          const limits = split(spec, ":").map(Number);
          if (
            !spec.includes(",") &&
            limits.length >= 1 &&
            limits.length <= 3 &&
            limits.every(Number.isFinite) &&
            (typeof initial === "number" || Array.isArray(initial))
          ) {
            p.min = limits.length === 1 ? 0 : limits[0];
            p.max = limits[limits.length - 1];
            p.step = limits.length === 3 ? limits[1] : 1;
          } else {
            p.options = split(spec, ",").map((item) => {
              const [value, ...label] = split(item, ":");
              const parsed = parseScadLiteral(value);
              return {
                value:
                  typeof parsed === "number"
                    ? parsed
                    : typeof parsed === "string"
                      ? parsed
                      : value,
                label:
                  label.join(":").replace(/^"|"$/g, "") ||
                  value.replace(/^"|"$/g, ""),
              };
            });
            p.type = "select";
          }
        }
        if (!spec && p.type === "number" && /^\.?\d+(?:\.\d+)?$/.test(trailing))
          p.step = Number(trailing);
        if (typeof initial === "string") {
          if (/\.(png|svg|stl)$/i.test(initial)) p.type = "file";
          if (/^#[0-9a-f]{6}$/i.test(initial) || /\bcolor\b/i.test(trailing))
            p.type = "color";
          if (/\bfont\b/i.test(trailing) || /(^|_)font$/.test(key))
            p.type = "font";
        }
        fields.push(p);
      }
    }
    quote = false;
    escape = false;
    for (const c of clean) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\" && quote) {
        escape = true;
        continue;
      }
      if (c === '"') {
        quote = !quote;
        continue;
      }
      if (!quote) {
        if (c === "{") depth++;
        if (c === "}") depth = Math.max(0, depth - 1);
      }
    }
    description = "";
  }
  return fields;
}
export function applyParameters(
  source: string,
  values: Record<string, ParameterValue>,
): string {
  const keys = new Set(parseCustomizer(source).map((p) => p.key));
  const declarations = Object.entries(values)
    .filter(([key]) => keys.has(key))
    .map(([key, value]) => {
      if (typeof value === "number" && !Number.isFinite(value))
        throw new Error(`Giá trị không hợp lệ: ${key}`);
      if (Array.isArray(value) && value.some((v) => !Number.isFinite(v)))
        throw new Error(`Vector không hợp lệ: ${key}`);
      return `${key} = ${JSON.stringify(value)};`;
    });
  return `${source}\n// FormaForgeDT customizer overrides\n${declarations.join("\n")}\n`;
}
