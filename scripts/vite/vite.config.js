import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import replace from '@rollup/plugin-replace'
import { resolvePkgPath } from '../rollup/utils'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    replace({
      __DEV__: true,
      preventAssignment: true,
    })
  ],
  resolve: {
    alias: [
      {
        find: 'react/jsx-dev-runtime',
        replacement: path.join(resolvePkgPath('react'), 'src/jsx.ts')
      },
      {
        find: 'react-dom/client',
        replacement: path.join(resolvePkgPath('react-dom'), 'index.ts')
      },
      {
        find: 'react',
        replacement: resolvePkgPath('react')
      },
      {
        find: 'react-dom',
        replacement: resolvePkgPath('react-dom')
      },
      {
        find: 'hostConfig',
        replacement: path.join(resolvePkgPath('react-dom'), 'src/hostConfig.ts')
      },
    ]
  }
})
