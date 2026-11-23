let plugins = [];
try {
  require.resolve('react-native-worklets-core/plugin');
  plugins.push('react-native-worklets-core/plugin');
} catch (e) {
  // Plugin not installed in node_modules yet
}

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins,
};
