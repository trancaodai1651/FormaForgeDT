import { useEffect, useState, useRef } from "react";
import { ArrowRight, Loader2, Search } from "lucide-react";
import { MAKER_FONTS, type AssetFile } from "./model";
import { assetBase, registerMakerFont } from "./wavyGeometry";
type Catalog = {
  commit: string;
  fonts: { path: string; label: string; sha: string }[];
};
export function FontLibrary({
  onSelect,
  onImport,
  customFonts,
}: {
  onSelect: (value: string, label: string, files?: AssetFile[]) => void;
  onImport: () => void;
  customFonts: { value: string; label: string }[];
}) {
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [query, setQuery] = useState(""),
    [pending, setPending] = useState(""),
    [error, setError] = useState("");
  const downloading = useRef<AbortController | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    fetch(`${assetBase()}font-catalog.json`, { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Không tải được danh mục phông.");
        return r.json();
      })
      .then(setCatalog)
      .catch((e) => {
        if (!abort.signal.aborted) setError(String(e));
      });
    return () => {
      abort.abort();
      downloading.current?.abort();
    };
  }, []);
  const filtered =
    catalog?.fonts.filter((f) =>
      f.label.toLowerCase().includes(query.toLowerCase()),
    ) ?? [];
  const load = async (f: Catalog["fonts"][number]) => {
    if (!catalog) return;
    setPending(f.path);
    setError("");
    const abort = new AbortController();
    downloading.current = abort;
    try {
      const url = `https://raw.githubusercontent.com/google/fonts/${catalog.commit}/${f.path}`;
      const response = await fetch(url, { signal: abort.signal });
      if (!response.ok)
        throw new Error(
          "Không tải được phông. Bạn có thể nhập file TTF từ máy.",
        );
      const data = new Uint8Array(await response.arrayBuffer()),
        name = f.path.split("/").pop()!;
      const family = registerMakerFont(`custom:${name}`, data);
      const licensePath =
        f.path.slice(0, f.path.lastIndexOf("/")) +
        (f.path.startsWith("ofl/") ? "/OFL.txt" : "/LICENSE.txt");
      const license = await fetch(
        `https://raw.githubusercontent.com/google/fonts/${catalog.commit}/${licensePath}`,
        { signal: abort.signal },
      );
      if (!license.ok)
        throw new Error(
          "Không tải được giấy phép của phông. Hãy nhập phông và giấy phép từ máy.",
        );
      onSelect(`custom:${name}`, family, [
        { name, data },
        {
          name: `${name}-LICENSE.txt`,
          data: new Uint8Array(await license.arrayBuffer()),
        },
      ]);
    } catch (e) {
      if (!abort.signal.aborted)
        setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (!abort.signal.aborted) setPending("");
    }
  };
  return (
    <>
      <p className="pmm-note">
        Bảy phông kèm sẵn · {catalog?.fonts.length.toLocaleString() ?? "…"} file
        phông Google Fonts có thể tải khi chọn. Phông đã chọn được lưu cùng dự
        án.
      </p>
      <label className="pmm-search">
        <Search size={18} />
        <input
          aria-label="Tìm phông chữ"
          placeholder="Tìm phông chữ…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {error && (
        <p className="pmm-error pmm-alert" role="alert">
          {error}
        </p>
      )}
      <h3 className="pmm-font-section">Kèm sẵn và đã nhập</h3>
      {[
        ...MAKER_FONTS.map(([value, label]) => ({ value, label })),
        ...customFonts,
      ]
        .filter((f) => f.label.toLowerCase().includes(query.toLowerCase()))
        .map((f) => (
          <button
            className="pmm-font-choice"
            key={f.value}
            onClick={() => onSelect(f.value, f.label)}
          >
            <span style={{ fontFamily: `'PMM-${f.label}',sans-serif` }}>
              {f.label}
            </span>
            <span>
              Aa 123 <ArrowRight size={17} />
            </span>
          </button>
        ))}
      <h3 className="pmm-font-section">
        Google Fonts · {filtered.length} kết quả
      </h3>
      <div className="pmm-online-fonts">
        {filtered.slice(0, 80).map((f) => (
          <button
            key={f.path}
            disabled={!!pending}
            className="pmm-online-font"
            onClick={() => void load(f)}
          >
            <span>{f.label}</span>
            {pending === f.path ? (
              <Loader2 className="pmm-spin" size={17} />
            ) : (
              <span>
                Tải & chọn <ArrowRight size={15} />
              </span>
            )}
          </button>
        ))}
      </div>
      {filtered.length > 80 && (
        <p className="pmm-note">
          Hiển thị 80 kết quả đầu tiên. Nhập tên để thu hẹp tìm kiếm.
        </p>
      )}
      <button className="pmm-full-button" onClick={onImport}>
        Nhập TTF/OTF từ máy tính
      </button>
    </>
  );
}
