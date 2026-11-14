import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Regenerate icons after changing public/favicon.svg: `npm run icons`
export default defineConfig({
  preset: { ...minimal2023Preset, maskable: { ...minimal2023Preset.maskable, padding: 0 }, apple: { ...minimal2023Preset.apple, padding: 0 } },
  images: ['public/favicon.svg'],
})
