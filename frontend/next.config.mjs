import i18n from './next-i18next.config.js'
import withPWA from 'next-pwa'
import workerCache from './worker-cache.js'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  i18n: {
    ...i18n.i18n
  },
  webpack(config, { isServer, webpack }) {
    const fileLoaderRule = config.module.rules.find((rule) =>
      rule.test?.test?.('.svg'),
    )
    config.module.rules.push(
      {
        ...fileLoaderRule,
        test: /\.svg$/i,
        resourceQuery: /url/,
      },
      {
        test: /\.svg$/i,
        issuer: fileLoaderRule.issuer,
        resourceQuery: { not: [...fileLoaderRule.resourceQuery.not, /url/] },
        use: ['@svgr/webpack'],
      },
    )
    fileLoaderRule.exclude = /\.svg$/i

    config.module.rules.push({
      test: /\.wasm$/,
      loader: 'base64-loader',
      type: 'javascript/auto',
    })
    config.module.noParse = /\.wasm$/
    config.module.rules.forEach((rule) => {
      (rule.oneOf || []).forEach((oneOf) => {
        if (oneOf.loader && oneOf.loader.indexOf('file-loader') >= 0) {
          oneOf.exclude.push(/\.wasm$/)
        }
      })
    })
    if (!isServer) {
      config.resolve.fallback.fs = false
    }

    config.plugins.push(
      new webpack.IgnorePlugin({ resourceRegExp: /\/__tests__\// })
    )

    return config
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  }
}

export default withPWA({
  dest: 'public',
  cacheStartUrl: true,
  dynamicStartUrl: false,
  reloadOnOnline: false,
  disable: process.env.NODE_ENV !== 'production',
  mode: 'production',
  exclude: [
    ({ asset }) => {
      if (
        asset.name.startsWith('server/') ||
        asset.name.match(/^((app-|^)build-manifest\.json|react-loadable-manifest\.json)$/)
      ) {
        return true
      }
      if (process.env.NODE_ENV !== 'production' && !asset.name.startsWith('static/runtime/')) {
        return true
      }
      return false
    }
  ],
  runtimeCaching: workerCache,
  importScripts: ['public/worker-hashing.js']
})(nextConfig)
