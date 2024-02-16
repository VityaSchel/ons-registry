import path from 'path'

const config = {
  mode: 'production',
  entry: './index.ts',
  output: {
    path: path.resolve(__dirname, '../src/public'),
    filename: 'worker-hashing.js'
  },

  module: {
    rules: [{
      test: /\.wasm$/,
      type: 'javascript/auto',
      use: [{
        loader: 'wasm-loader' 
      }]
    }]
  }
}

export default config