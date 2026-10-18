const path = require('node:path');

const aliasMap = {
  '@': path.resolve(__dirname, '..', 'src'),
  '@sandougi/shared-schema': path.resolve(
    __dirname,
    '..',
    '..',
    'packages',
    'shared-schema',
    'src',
    'index.ts',
  ),
  '@tarojs/shared': path.resolve(__dirname, '..', 'node_modules', '@tarojs', 'shared'),
  '@tarojs/runtime': path.resolve(__dirname, '..', 'node_modules', '@tarojs', 'runtime'),
  '@tarojs/components': path.resolve(__dirname, '..', 'node_modules', '@tarojs', 'components'),
  '@tarojs/taro': path.resolve(__dirname, '..', 'node_modules', '@tarojs', 'taro'),
};

module.exports = {
  projectName: 'web-storefront',
  date: '2026-10-17',
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2,
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: [],
  defineConstants: {},
  copy: {
    patterns: [],
    options: {},
  },
  framework: 'react',
  compiler: 'webpack5',
  alias: { ...aliasMap },
  webpackChain(chain) {
    const resolveAlias = chain.resolve.alias;

    Object.entries(aliasMap).forEach(([key, value]) => {
      resolveAlias.set(key, value);
    });

    return chain;
  },
};
