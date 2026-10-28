const baseConfig = require('./webpack.config');

module.exports = (env, argv) => {
  return baseConfig(env, { ...argv, mode: 'production' });
};
