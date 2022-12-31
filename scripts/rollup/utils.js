import path from 'path'
import fs from 'fs'
import ts from 'rollup-plugin-typescript2'
import cjs from '@rollup/plugin-commonjs'
import replace from '@rollup/plugin-replace'

const distPath = path.join(__dirname, '../../dist/node_modules')
const pkgsPath = path.join(__dirname, '../../packages')

export function resolvePkgPath (pkgName, isDist) {
  if (isDist) {
    return `${distPath}/${pkgName}`
  }
  return `${pkgsPath}/${pkgName}`
}

export function getPackageJSON (pkgName) {
  const pkgPath = `${resolvePkgPath(pkgName)}/package.json`
  const str = fs.readFileSync(pkgPath, { encoding: "utf-8" })
  return JSON.parse(str)
}

export function getBaseRollupPlugins ({ alias = {
  __DEV__: true
}, typescript = {} } = {}) {
  return [
    replace(alias),
    cjs(),
    ts(typescript)
  ]
}