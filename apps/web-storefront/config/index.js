const path = require('node:path');

const aliasMap = {
  '@': path.resolve(__dirname, '..', 'src'),
  '@utils/supabase': path.resolve(__dirname, '..', 'src', 'utils', 'supabase.js'),
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
  env: {
    // Taro passes these values into DefinePlugin; JSON.stringify keeps strings quoted in compiled code.
    TARO_APP_SUPABASE_URL: JSON.stringify(process.env.TARO_APP_SUPABASE_URL || ''),
    TARO_APP_SUPABASE_ANON_KEY: JSON.stringify(process.env.TARO_APP_SUPABASE_ANON_KEY || ''),
  },
  alias: { ...aliasMap },
  webpackChain(chain) {
    const resolveAlias = chain.resolve.alias;
    const supabaseJsPath = path.resolve(__dirname, '..', 'src', 'utils', 'supabase.js');

    Object.entries(aliasMap).forEach(([key, value]) => {
      if (key && value) {
        resolveAlias.set(key, value);
      }
    });

    resolveAlias.set('@utils/supabase', supabaseJsPath);
    resolveAlias.set('@/utils/supabase', supabaseJsPath);

    chain.module
      .rule('supabase-js')
      .test(/src[\\/]utils[\\/]supabase\.js$/)
      .exclude.add(/node_modules\/(?!@supabase)/)
      .end()
      .use('supabase-babel')
      .loader(require.resolve('babel-loader'))
      .options({
        cacheDirectory: true,
        babelrc: false,
        configFile: false,
        presets: [[require.resolve('@babel/preset-env'), { modules: false }]],
      });

    chain.module
      .rule('js')
      .exclude.add(/node_modules\/(?!@supabase)/)
      .end();

    return chain;
  },
};
