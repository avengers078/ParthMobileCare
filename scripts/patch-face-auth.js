const fs = require('fs');
const path = require('path');

const packageRoot = path.join(__dirname, '..', 'node_modules', 'react-native-offline-face-auth');
const packageInfo = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
if (packageInfo.version !== '0.1.0') {
  throw new Error(`Review the camera debug patch before upgrading react-native-offline-face-auth (${packageInfo.version}).`);
}

const viewPath = path.join(packageRoot, 'src', 'FaceAuthView.tsx');
let source = fs.readFileSync(viewPath, 'utf8');
source = source.replace("import { saveModelDebugFrame } from './debug';\n", '');
source = source.replace('  const cameraRef = useRef<Camera>(null);\n  const DEBUG_INTERVAL_MS = 5_000;\n', '');
source = source.replace('const { frameProcessor, triggerDebugCapture } = useFrameSource({', 'const { frameProcessor } = useFrameSource({');
source = source.replace('onModelDebug: __DEV__ ? saveModelDebugFrame : undefined,', '// Camera-derived debug frames are never written to disk.\n    onModelDebug: undefined,');
source = source.replace(/  \/\/ ── Debug: every DEBUG_INTERVAL_MS[\s\S]*?(?=  const handleBack = useCallback)/, '');
source = source.replace('        ref={cameraRef}\n', '');
if (source.includes('triggerDebugCapture') || source.includes('cameraRef') || source.includes('saveModelDebugFrame')) {
  throw new Error('Could not disable all camera frame debug capture paths.');
}
fs.writeFileSync(viewPath, source);

// worklets-core 1.6.3 requests Babel proposal plugin names that Babel 7.25+
// replaced with transform plugin names. Keep the worklet compiler on the
// equivalent transform plugins already installed with the React Native preset.
const workletsRoot = path.join(__dirname, '..', 'node_modules', 'react-native-worklets-core');
const workletsInfo = JSON.parse(fs.readFileSync(path.join(workletsRoot, 'package.json'), 'utf8'));
if (workletsInfo.version !== '1.6.3') {
  throw new Error(`Review the Babel plugin patch before upgrading react-native-worklets-core (${workletsInfo.version}).`);
}

const workletsPluginPaths = [
  path.join(workletsRoot, 'src', 'plugin', 'index.js'),
  path.join(workletsRoot, 'lib', 'commonjs', 'plugin', 'index.js'),
  path.join(workletsRoot, 'lib', 'module', 'plugin', 'index.js'),
];
for (const workletsPluginPath of workletsPluginPaths) {
  let workletsSource = fs.readFileSync(workletsPluginPath, 'utf8');
  workletsSource = workletsSource.replaceAll(
    '@babel/plugin-proposal-optional-chaining',
    '@babel/plugin-transform-optional-chaining',
  );
  workletsSource = workletsSource.replaceAll(
    '@babel/plugin-proposal-nullish-coalescing-operator',
    '@babel/plugin-transform-nullish-coalescing-operator',
  );
  workletsSource = workletsSource.replaceAll(
    '    presets: ["@babel/preset-typescript"],\n    plugins: [',
    '    plugins: [\n      "@babel/plugin-transform-typescript",',
  );
  if (
    workletsSource.includes('@babel/plugin-proposal-optional-chaining') ||
    workletsSource.includes('@babel/plugin-proposal-nullish-coalescing-operator') ||
    workletsSource.includes('@babel/preset-typescript')
  ) {
    throw new Error(`Could not update missing Babel transform references in ${workletsPluginPath}.`);
  }
  fs.writeFileSync(workletsPluginPath, workletsSource);
}
