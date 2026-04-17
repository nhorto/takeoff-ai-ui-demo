import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

// Fabric.js serialized canvas JSON shape — we don't type the internals,
// it's opaque data we hand back to fabric.loadFromJSON.
export type FabricSerialized = Record<string, unknown>;

interface PersistedAnnotations {
  version: 1;
  byPage: Record<string, FabricSerialized>;
}

interface AnnotationStore {
  byPage: Record<string, FabricSerialized>;
  get: (docKey: string, pageNumber: number) => FabricSerialized | null;
  set: (docKey: string, pageNumber: number, data: FabricSerialized) => void;
  clear: (docKey: string, pageNumber: number) => void;
}

const STORAGE_KEY = "takeoffai-annotations-v1";

export function makeDocKey(fileName: string, fileSize: number): string {
  return `${fileName}-${fileSize}`;
}

function pageKey(docKey: string, pageNumber: number): string {
  return `${docKey}:${pageNumber}`;
}

function loadInitial(): Record<string, FabricSerialized> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PersistedAnnotations;
    if (parsed.version === 1 && parsed.byPage) return parsed.byPage;
  } catch {
    /* corrupt data — start fresh */
  }
  return {};
}

export const useAnnotationStore = create<AnnotationStore>()(
  subscribeWithSelector((set, get) => ({
    byPage: loadInitial(),

    get: (docKey, pageNumber) => get().byPage[pageKey(docKey, pageNumber)] ?? null,

    set: (docKey, pageNumber, data) =>
      set((state) => ({
        byPage: { ...state.byPage, [pageKey(docKey, pageNumber)]: data },
      })),

    clear: (docKey, pageNumber) =>
      set((state) => {
        const key = pageKey(docKey, pageNumber);
        if (!(key in state.byPage)) return state;
        const next = { ...state.byPage };
        delete next[key];
        return { byPage: next };
      }),
  })),
);

let hasWarnedQuota = false;

useAnnotationStore.subscribe(
  (state) => state.byPage,
  (byPage) => {
    const payload: PersistedAnnotations = { version: 1, byPage };
    const serialized = JSON.stringify(payload);
    try {
      window.localStorage.setItem(STORAGE_KEY, serialized);
    } catch (err) {
      const isQuota =
        err instanceof DOMException &&
        (err.name === "QuotaExceededError" ||
          err.name === "NS_ERROR_DOM_QUOTA_REACHED");
      console.error("[annotations] failed to persist", err);
      if (isQuota && !hasWarnedQuota) {
        hasWarnedQuota = true;
        const approxMb = (serialized.length / (1024 * 1024)).toFixed(1);
        window.alert(
          `Annotation storage is full (~${approxMb}MB). New annotations won't be saved across reloads until you remove some. Consider clearing older PDFs.`,
        );
      }
    }
  },
);
