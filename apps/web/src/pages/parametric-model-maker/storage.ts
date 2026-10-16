import type { AssetFile, MakerProject } from "./model";
export type StoredProject = {
  project: MakerProject;
  files: AssetFile[];
  history: MakerProject[];
};
let pending: Promise<IDBDatabase> | undefined;
function database() {
  return (pending ??= new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("formaforge-parametric-maker", 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore("projects", { keyPath: "project.id" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}
export async function saveProject(record: StoredProject) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const t = db.transaction("projects", "readwrite");
    t.objectStore("projects").put(record);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
export async function listProjects() {
  const db = await database();
  return new Promise<StoredProject[]>((resolve, reject) => {
    const r = db.transaction("projects").objectStore("projects").getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export function encodeAssets(files: AssetFile[]) {
  return files.map((f) => {
    let binary = "";
    for (let i = 0; i < f.data.length; i += 32768)
      binary += String.fromCharCode(...f.data.subarray(i, i + 32768));
    return { name: f.name, data: btoa(binary) };
  });
}
export function decodeAssets(files: MakerProject["assets"]): AssetFile[] {
  if (files !== undefined && !Array.isArray(files))
    throw new Error("Danh sách file không hợp lệ.");
  for (const f of files ?? []) {
    if (
      typeof f.name !== "string" ||
      typeof f.data !== "string" ||
      f.data.length > 42 * 1024 * 1024 ||
      f.name.startsWith("/") ||
      f.name.replace(/\\/g, "/").split("/").includes("..")
    )
      throw new Error("File dự án không hợp lệ hoặc vượt 30 MB.");
  }
  return (files ?? []).map((f) => ({
    name: f.name,
    data: Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0)),
  }));
}
