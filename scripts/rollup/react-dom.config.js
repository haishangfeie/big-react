import { getPackageJSON, resolvePkgPath, getBaseRollupPlugins } from './utils'
import generatePackageJson from 'rollup-plugin-generate-package-json'
import alias from '@rollup/plugin-alias'

const { name, module, peerDependencies } = getPackageJSON('react-dom')
// react-dom包路径&产物路径
const pkgPath = resolvePkgPath(name)
const distPath = resolvePkgPath(name, true)


export default [
  // react-dom
  {
    input: `${pkgPath}/${module}`,
    output: [
      {
        file: `${distPath}/index.js`,
        name: 'ReactDom',
        format: 'umd'
      },
      {
        file: `${distPath}/client.js`,
        name: 'ReactDom',
        format: 'umd'
      }
    ],
    plugins: [
      ...getBaseRollupPlugins(),
      alias({
        entries: {
          hostConfig: `${pkgPath}/src/hostConfig.ts`
        }
      }),
      generatePackageJson({
        inputFolder: pkgPath,
        outputFolder: distPath,
        baseContents: ({ name, description, version }) => ({
          name,
          description,
          version,
          peerDependencies: {
            react: version
          },
          main: 'index.js'
        })
      })
    ],
    // 定义外部包
    external: [
      ...Object.keys(peerDependencies)
    ]
  }
]