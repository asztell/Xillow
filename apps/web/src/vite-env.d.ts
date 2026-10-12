/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional absolute API origin for production builds; empty in dev (Vite proxies /api). */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
