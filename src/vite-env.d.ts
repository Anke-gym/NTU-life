/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface Window {
  __NTU_LIFE_UPDATE_SW__?: (reloadPage?: boolean) => Promise<void>
}
