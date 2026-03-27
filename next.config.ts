import type { NextConfig } from 'next'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** App directory — avoids Turbopack inferring a parent folder (e.g. multi-repo `Dev/Audius`) as root, which breaks `@import "tailwindcss"` resolution. */
const appRoot = path.dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  turbopack: {
    root: appRoot,
  },
}

export default nextConfig
