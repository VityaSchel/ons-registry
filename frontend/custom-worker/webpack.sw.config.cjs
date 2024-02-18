/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path')
const { IgnorePlugin } = require('webpack')

/** @type {import('webpack').Configuration} */
const config = {
  mode: 'production',
  entry: __dirname + '/index.ts',
  output: {
    path: path.resolve(__dirname, '../public'),
    filename: 'custom-worker.js'
  },
  module: {
    rules: [
      {
        test: /\.wasm$/,
        type: 'javascript/auto',
        use: [{
          loader: 'base64-loader'
        }]
      }
    ],
    noParse: /\.wasm$/
  },
  plugins: [
    new IgnorePlugin({ resourceRegExp: /\/__tests__\// })
  ],
  resolve: {
    fallback: {
      path: require.resolve('path-browserify'),
      fs: false
    }
  }
}
module.exports = config