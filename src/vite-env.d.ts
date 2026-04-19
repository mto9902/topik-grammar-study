/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GRAMMAR_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
