import { defineConfig } from 'vite'

// base 使用相对路径，保证部署到任意子目录（GitHub Pages / 对象存储）都能正确加载资源
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 4096,
  },
  server: {
    host: true,
    port: 5173,
  },
})
