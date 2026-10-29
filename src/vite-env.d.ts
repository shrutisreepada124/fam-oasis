/// <reference types="vite/client" />

export interface TesseractWorker {
  recognize(image: unknown): Promise<{ data: { text: string } }>;
  terminate(): Promise<void>;
}

export interface TesseractStatic {
  createWorker(lang: string): Promise<TesseractWorker>;
}
