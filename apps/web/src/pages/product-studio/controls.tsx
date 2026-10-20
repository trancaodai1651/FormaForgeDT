import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Bilingual, Language } from "./model";
import { tr } from "./model";
export type L = (en: string, vi: string) => string;
export function NumberField({
  label,
  value,
  onChange,
  min = -1000,
  max = 1000,
  step = 0.1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const [draft, setDraft] = useState(String(value)),
    editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setDraft(String(value));
  }, [value]);
  return (
    <label className="ps-field">
      <span>{label}</span>
      <input
        type="number"
        value={draft}
        min={min}
        max={max}
        step={step}
        inputMode="decimal"
        onFocus={() => {
          editing.current = true;
        }}
        onBlur={() => {
          editing.current = false;
          const parsed = Number(draft),
            next =
              draft.trim() && Number.isFinite(parsed)
                ? Math.max(min, Math.min(max, parsed))
                : value;
          setDraft(String(next));
          if (next !== value) onChange(next);
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = e.target.valueAsNumber;
          if (
            e.target.value !== "" &&
            Number.isFinite(n) &&
            n >= min &&
            n <= max
          )
            onChange(n);
        }}
      />
    </label>
  );
}
export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="ps-field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        maxLength={2000}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="ps-toggle">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <label className="ps-field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="ps-field ps-color">
      <span>{label}</span>
      <span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <code>{value.toUpperCase()}</code>
      </span>
    </label>
  );
}
export function Group({
  title,
  children,
  open = false,
}: {
  title: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details className="ps-group" open={open}>
      <summary>{title}</summary>
      <div className="ps-group-content">{children}</div>
    </details>
  );
}
export function Modal({
  title,
  onClose,
  children,
  language,
}: {
  title: Bilingual;
  onClose: () => void;
  children: ReactNode;
  language: Language;
}) {
  const panel = useRef<HTMLElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
      }
      if (e.key === "Tab") {
        const controls = Array.from(
          panel.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea,a[href],[tabindex="0"]',
          ) ?? [],
        ).filter((e) => e.offsetParent !== null);
        const first = controls[0],
          last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    panel.current?.querySelector<HTMLElement>("button")?.focus();
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="ps-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={panel}
        className="ps-modal"
        role="dialog"
        aria-modal="true"
        aria-label={tr(title, language)}
      >
        <header>
          <h2>{tr(title, language)}</h2>
          <button
            onClick={onClose}
            aria-label={language === "vi" ? "Đóng" : "Close"}
          >
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
