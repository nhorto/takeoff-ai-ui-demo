import { create } from "zustand";

export interface PdfDocumentState {
  id: string;
  fileName: string;
  fileSize: number;
  data: ArrayBuffer;
  currentPage: number;
  zoom: number;
}

interface PdfStore {
  openPdfs: Record<string, PdfDocumentState>;
  openPdf: (file: File) => Promise<string>;
  closePdf: (pdfId: string) => void;
  setCurrentPage: (pdfId: string, page: number) => void;
  setZoom: (pdfId: string, zoom: number) => void;
}

function makePdfId(): string {
  return `pdf-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

export const usePdfStore = create<PdfStore>((set) => ({
  openPdfs: {},

  openPdf: async (file) => {
    const data = await file.arrayBuffer();
    const id = makePdfId();
    set((state) => ({
      openPdfs: {
        ...state.openPdfs,
        [id]: {
          id,
          fileName: file.name,
          fileSize: file.size,
          data,
          currentPage: 1,
          zoom: 1,
        },
      },
    }));
    return id;
  },

  closePdf: (pdfId) =>
    set((state) => {
      const next = { ...state.openPdfs };
      delete next[pdfId];
      return { openPdfs: next };
    }),

  setCurrentPage: (pdfId, page) =>
    set((state) => {
      const existing = state.openPdfs[pdfId];
      if (!existing) return state;
      return {
        openPdfs: { ...state.openPdfs, [pdfId]: { ...existing, currentPage: page } },
      };
    }),

  setZoom: (pdfId, zoom) =>
    set((state) => {
      const existing = state.openPdfs[pdfId];
      if (!existing) return state;
      return {
        openPdfs: { ...state.openPdfs, [pdfId]: { ...existing, zoom } },
      };
    }),
}));
