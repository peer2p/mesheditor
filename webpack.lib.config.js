const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');

/**
 * Dual Webpack configuration for building the NPM Library (`dist-lib/`):
 * 1. Externalized UMD/CommonJS library (`dist-lib/index.umd.js`) with `@babylonjs/*` as peerDependencies
 * 2. Standalone all-in-one Web Component bundle (`dist-lib/standalone/mesheditor-element.bundle.js`)
 */
module.exports = [
  // 1. UMD Library Build (BabylonJS externalized as peerDependencies)
  {
    name: 'lib-umd',
    mode: 'production',
    entry: './src/index.ts',
    output: {
      path: path.resolve(__dirname, 'dist-lib'),
      filename: 'index.umd.js',
      library: {
        name: 'MeshEditor',
        type: 'umd',
      },
      globalObject: 'this',
      clean: false,
    },
    devtool: 'source-map',
    performance: {
      hints: false,
    },
    externals: [
      /^@babylonjs\/core(\/.*)?$/,
      /^@babylonjs\/loaders(\/.*)?$/,
      /^@babylonjs\/materials(\/.*)?$/,
      /^@babylonjs\/serializers(\/.*)?$/,
    ],
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                configFile: 'tsconfig.lib.json',
                transpileOnly: true,
              },
            },
          ],
          exclude: /node_modules/,
        },
      ],
    },
    plugins: [
      new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }),
      new CopyWebpackPlugin({
        patterns: [{ from: 'src/mesheditor.css', to: 'mesheditor.css' }],
      }),
    ],
    resolve: {
      extensions: ['.ts', '.js'],
      fallback: {
        fs: false,
        path: false,
      },
    },
    experiments: {
      asyncWebAssembly: true,
      syncWebAssembly: true,
    },
  },

  // 2. Standalone All-in-One Web Component Bundle (includes BabylonJS for <script> tag usage)
  {
    name: 'lib-standalone-element',
    mode: 'production',
    entry: './src/index.ts',
    output: {
      path: path.resolve(__dirname, 'dist-lib', 'standalone'),
      filename: 'mesheditor-element.bundle.js',
      library: {
        name: 'MeshEditor',
        type: 'umd',
      },
      globalObject: 'this',
      clean: true,
    },
    devtool: 'source-map',
    performance: {
      hints: false,
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                configFile: 'tsconfig.lib.json',
                transpileOnly: true,
              },
            },
          ],
          exclude: /node_modules/,
        },
      ],
    },
    plugins: [new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 })],
    resolve: {
      extensions: ['.ts', '.js'],
      fallback: {
        fs: false,
        path: false,
      },
    },
    experiments: {
      asyncWebAssembly: true,
      syncWebAssembly: true,
    },
  },
];
