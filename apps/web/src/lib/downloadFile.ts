type DesktopInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export function getDesktopInvoke(): DesktopInvoke | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as Window & { __TAURI_INTERNALS__?: { invoke?: DesktopInvoke } }).__TAURI_INTERNALS__?.invoke;
}

/** A cancelled native dialog returns false; failures propagate to the export UI. */
export async function downloadFile(blob: Blob, fileName: string, doc: Pick<Document, 'createElement' | 'body'> = document): Promise<boolean> {
  const invoke = getDesktopInvoke();
  if (invoke) {
    const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
    const path = await invoke<string | null>('save_export_file', { fileName, bytes });
    return path !== null;
  }
  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
