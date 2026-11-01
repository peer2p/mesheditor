const fs = require('fs');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { setupAntigravityBridgeRoutes } = require('./scripts/antigravity-bridge');
require('./scripts/sync-skills');
require('./scripts/sync-templates');

module.exports = (env, argv) => {
  const isProduction = (argv && argv.mode === 'production') || process.env.NODE_ENV === 'production';

  return {
    mode: isProduction ? 'production' : 'development',
    entry: {
      mesheditor: './src/index.ts',
    },
    output: {
      filename: isProduction ? '[name].[contenthash:8].js' : '[name].bundle.js',
      path: path.resolve(__dirname, 'dist'),
      clean: true,
    },
    devtool: isProduction ? 'source-map' : 'eval-source-map',
    devServer: {
      port: 8080,
      host: '0.0.0.0',
      allowedHosts: 'all',
      hot: true,
      open: true,
      static: {
        directory: path.resolve(__dirname, 'dist'),
      },
      client: {
        overlay: {
          errors: true,
          warnings: false,
        },
      },
      setupMiddlewares: (middlewares, devServer) => {
        if (devServer && devServer.app) {
          setupAntigravityBridgeRoutes(devServer.app);
        }
        return middlewares;
      },
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                transpileOnly: false,
              },
            },
          ],
          exclude: /node_modules/,
        },
        {
          test: /\.md$/,
          type: 'asset/source',
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        templateContent: ({ compilation, htmlWebpackPlugin }) => {
          const ejs = require('ejs');
          const templatePath = path.resolve(__dirname, 'src/mesheditor.ejs');
          compilation.fileDependencies.add(templatePath);
          const iconPath = path.resolve(__dirname, 'build/app-icon.svg');
          if (fs.existsSync(iconPath)) {
            compilation.fileDependencies.add(iconPath);
          }
          const editorToolsDir = path.resolve(__dirname, 'src/tools/editor');
          if (fs.existsSync(editorToolsDir)) {
            const editorFiles = fs.readdirSync(editorToolsDir);
            for (const file of editorFiles) {
              if (file.endsWith('.ejs')) {
                compilation.fileDependencies.add(path.resolve(editorToolsDir, file));
              }
            }
          }
          const raw = fs.readFileSync(templatePath, 'utf8');
          return ejs.render(raw, { htmlWebpackPlugin }, { filename: templatePath });
        },
        filename: 'index.html',
        chunks: ['mesheditor'],
        title: 'Mesh Editor',
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: 'src/mesheditor.css', to: 'mesheditor.css' },
          { from: 'skills', to: 'skills' },
        ],
      }),
    ],
    optimization: {
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          babylon: {
            test: /[\\/]node_modules[\\/]@babylonjs[\\/]/,
            name: 'babylon',
            priority: 20,
          },
          vendors: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: 10,
          },
        },
      },
    },
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
  };
};
