let plugins = [];
try {
  require.resolve('react-native-worklets-core/plugin');
  plugins.push('react-native-worklets-core/plugin');
} catch (e) {
  // Plugin not installed in node_modules yet
}

// Strip console.log/warn/info in production builds for performance
if (process.env.NODE_ENV === 'production' || process.env.BABEL_ENV === 'production') {
  try {
    require.resolve('babel-plugin-transform-remove-console');
    plugins.push(['transform-remove-console', { exclude: ['error'] }]);
  } catch (e) {
    // Plugin not installed — console statements remain in production
  }
}

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins,
};
