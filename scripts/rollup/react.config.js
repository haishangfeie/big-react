import { getPackageJSON, resolvePkgPath, getBaseRollupPlugins } from './utils'
import generatePackageJson from 'rollup-plugin-generate-package-json'

const { name, module } = getPackageJSON('react')
// react包路径&产物路径
const pkgPath = resolvePkgPath(name)
const distPath = resolvePkgPath(name, true)


export default [
  // react
  {
    input: `${pkgPath}/${module}`,
    output: {
      file: `${distPath}/index.js`,
      name: 'React',
      format: 'umd'
    },
    plugins: [...getBaseRollupPlugins(), generatePackageJson({
      inputFolder: pkgPath,
      outputFolder: distPath,
      baseContents: ({
        name,
        description,
        version
      }) => ({
        name,
        description,
        version,
        main: 'index.js'
      })
    })]
  },
  // jsx-runtime
  {
    input: `${pkgPath}/src/jsx.ts`,
    output: [
      // jsx-runtime
      {
        file: `${distPath}/jsx-runtime.js`,
        name: 'jsxRuntime',
        format: 'umd'
      },
      // jsx-dev-runtime
      {
        file: `${distPath}/jsx-dev-runtime.js`,
        name: 'jsxDevRuntime',
        format: 'umd'
      }
    ],
    plugins: getBaseRollupPlugins()
  }
]