/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID: string
  readonly VITE_ZG_NETWORK: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
