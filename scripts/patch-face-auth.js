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
