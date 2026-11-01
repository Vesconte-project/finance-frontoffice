import { fileURLToPath } from 'node:url'
const config = { experimental: { cpus: 1 }, turbopack: { root: fileURLToPath(new URL('../../..', import.meta.url)) }, typescript: { ignoreBuildErrors: true } }
export default config
