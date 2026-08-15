import { useEffect, useState, type SetStateAction } from 'react';

export function useProjectHistory<T>(storageKey: string, initial: T) {
  const [past, setPast] = useState<T[]>([]);
  const [present, setPresent] = useState<T>(() => { try { const saved = localStorage.getItem(storageKey); return saved ? JSON.parse(saved) as T : initial; } catch { return initial; } });
  const [future, setFuture] = useState<T[]>([]);
  const set = (value: SetStateAction<T>) => setPresent((current) => { const next = typeof value === 'function' ? (value as (previous: T) => T)(current) : value; setPast((items) => [...items.slice(-49), current]); setFuture([]); return next; });
  const undo = () => { setPast((items) => { const previous = items.at(-1); if (previous === undefined) return items; setFuture((itemsAhead) => [present, ...itemsAhead]); setPresent(previous); return items.slice(0, -1); }); };
  const redo = () => { setFuture((items) => { const next = items[0]; if (next === undefined) return items; setPast((itemsBehind) => [...itemsBehind, present]); setPresent(next); return items.slice(1); }); };
  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(present)); }, [present, storageKey]);
  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if (!(event.ctrlKey || event.metaKey)) return; if (event.key.toLowerCase() === 'z' && event.shiftKey) { event.preventDefault(); redo(); } else if (event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); } }; window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown); });
  return { state: present, setState: set, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 };
}
