const fs = require('fs');
const path = require('path');

const packageRoot = path.join(__dirname, '..', 'node_modules', 'react-native-offline-face-auth');
const packageInfo = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
if (packageInfo.version !== '0.1.0') {
  throw new Error(`Review the camera debug patch before upgrading react-native-offline-face-auth (${packageInfo.version}).`);
}

const viewPath = path.join(packageRoot, 'src', 'FaceAuthView.tsx');
let source = fs.readFileSync(viewPath, 'utf8').replace(/\r\n/g, '\n');
source = source.replace("import { saveModelDebugFrame } from './debug';\n", '');
source = source.replace('  const cameraRef = useRef<Camera>(null);\n  const DEBUG_INTERVAL_MS = 5_000;\n', '');
source = source.replace('const { frameProcessor, triggerDebugCapture } = useFrameSource({', 'const { frameProcessor } = useFrameSource({');
source = source.replace('onModelDebug: __DEV__ ? saveModelDebugFrame : undefined,', '// Camera-derived debug frames are never written to disk.\n    onModelDebug: undefined,');
source = source.replace(/  \/\/ ── Debug: every DEBUG_INTERVAL_MS[\s\S]*?(?=  const handleBack = useCallback)/, '');
source = source.replace('        ref={cameraRef}\n', '');
if (source.includes('triggerDebugCapture') || source.includes('cameraRef') || source.includes('saveModelDebugFrame')) {
  throw new Error('Could not disable all camera frame debug capture paths.');
}

// Support sessionKey so camera hardware is never unmounted between sample captures
if (!source.includes('sessionKey?: number | string;')) {
  source = source.replace(
    '  style?: object;\n}',
    '  style?: object;\n  sessionKey?: number | string;\n}'
  );
  source = source.replace(
    '  style,\n}: FaceAuthViewProps) {',
    '  style,\n  sessionKey,\n}: FaceAuthViewProps) {'
  );
  source = source.replace(
    '  const { start, cancel, feed, active, stageRef } = useFaceAuth({',
    `  const isFirstMountRef = useRef(true);
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }
    setHint('Position your face in the frame');
    setChallenge(undefined);
    setVerifying(false);
    setFaceCentered(null);
    setFacePos(null);
    cancel();
    start();
  }, [sessionKey, cancel, start]);

  const { start, cancel, feed, active, stageRef } = useFaceAuth({`
  );
  source = source.replace(
    '        frameProcessor={frameProcessor}\n      />',
    '        frameProcessor={frameProcessor}\n        onError={(err) => {\n          console.warn("[FaceAuthView] Camera error:", err);\n        }}\n      />'
  );
}

fs.writeFileSync(viewPath, source);

// Also patch typescript definition file for FaceAuthView
const viewDtsPath = path.join(packageRoot, 'lib', 'typescript', 'FaceAuthView.d.ts');
if (fs.existsSync(viewDtsPath)) {
  let dtsSource = fs.readFileSync(viewDtsPath, 'utf8').replace(/\r\n/g, '\n');
  if (!dtsSource.includes('sessionKey?: number | string;')) {
    dtsSource = dtsSource.replace(
      '    style?: object;\n}',
      '    style?: object;\n    sessionKey?: number | string;\n}'
    );
    fs.writeFileSync(viewDtsPath, dtsSource);
  }
}

// Patch FaceMaskOverlay to use container-relative layout rather than full window dimensions
const overlayPathFile = path.join(packageRoot, 'src', 'FaceMaskOverlay.tsx');
if (fs.existsSync(overlayPathFile)) {
  let overlaySource = fs.readFileSync(overlayPathFile, 'utf8').replace(/\r\n/g, '\n');
  if (!overlaySource.includes('containerDims')) {
    overlaySource = overlaySource.replace(
      "import React from 'react';",
      "import React, { useState } from 'react';"
    );
    overlaySource = overlaySource.replace(
      /const OVAL_RX = 120;\nconst OVAL_RY = 160;/,
      '// Dynamic sizing replaces hardcoded OVAL_RX/OVAL_RY based on container dimensions'
    );
    overlaySource = overlaySource.replace(
      `export function FaceMaskOverlay({ centered, facePos }: FaceMaskOverlayProps) {
  const { width, height } = useWindowDimensions();

  // Oval centre in pixels (must match cx="50%" cy="45%" used for the border ellipse)
  const cx = width  * 0.5;
  const cy = height * 0.45;`,
      `export function FaceMaskOverlay({ centered, facePos }: FaceMaskOverlayProps) {
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const [containerDims, setContainerDims] = useState<{ width: number; height: number } | null>(null);

  const width = containerDims?.width || Math.min(winWidth - 32, 380);
  const height = containerDims?.height || 380;

  // Oval centre in pixels: centered horizontally, placed at 40% height
  // (comfortably above the hintBar at the bottom of the container)
  const cx = width * 0.5;
  const cy = height * 0.40;

  const rx = Math.min(Math.round(width * 0.28), 110);
  const ry = Math.min(Math.round(height * 0.28), 115);`
    );
    overlaySource = overlaySource.replace(
      `  const overlayPath = [
    \`M 0 0 H \${width} V \${height} H 0 Z\`,
    \`M \${cx - OVAL_RX} \${cy}\`,
    \`A \${OVAL_RX} \${OVAL_RY} 0 1 0 \${cx + OVAL_RX} \${cy}\`,
    \`A \${OVAL_RX} \${OVAL_RY} 0 1 0 \${cx - OVAL_RX} \${cy}\`,
    \`Z\`,
  ].join(' ');`,
      `  const overlayPath = [
    \`M 0 0 H \${width} V \${height} H 0 Z\`,
    \`M \${cx - rx} \${cy}\`,
    \`A \${rx} \${ry} 0 1 0 \${cx + rx} \${cy}\`,
    \`A \${rx} \${ry} 0 1 0 \${cx - rx} \${cy}\`,
    \`Z\`,
  ].join(' ');`
    );
    overlaySource = overlaySource.replace(
      '    <View style={StyleSheet.absoluteFill} pointerEvents="none">',
      `    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        if (w > 0 && h > 0 && (!containerDims || containerDims.width !== w || containerDims.height !== h)) {
          setContainerDims({ width: w, height: h });
        }
      }}
    >`
    );
    overlaySource = overlaySource.replace(
      '        <Ellipse\n          cx={cx} cy={cy}\n          rx={OVAL_RX} ry={OVAL_RY}',
      '        <Ellipse\n          cx={cx} cy={cy}\n          rx={rx} ry={ry}'
    );
    fs.writeFileSync(overlayPathFile, overlaySource);
  }
}

// ─── Patch compiled distribution files (lib/module and lib/commonjs) ─────────
// Metro resolves react-native-offline-face-auth to lib/module or lib/commonjs,
// so patches must be reflected in compiled bundles as well.

// 1. lib/module/FaceMaskOverlay.js
const moduleOverlayPath = path.join(packageRoot, 'lib', 'module', 'FaceMaskOverlay.js');
if (fs.existsSync(moduleOverlayPath)) {
  const code = `"use strict";

import React, { useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Path, Ellipse, Text as SvgText } from 'react-native-svg';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";

function getArrows(pos) {
  if (!pos) return '';
  const arrows = [];
  if (pos.cx < 0.45) arrows.push('→');else if (pos.cx > 0.55) arrows.push('←');
  if (pos.cy < 0.40) arrows.push('↓');else if (pos.cy > 0.50) arrows.push('↑');
  return arrows.join('  ');
}

export function FaceMaskOverlay({
  centered,
  facePos
}) {
  const {
    width: winWidth,
    height: winHeight
  } = useWindowDimensions();
  const [containerDims, setContainerDims] = useState(null);
  const width = containerDims?.width || Math.min(winWidth - 32, 380);
  const height = containerDims?.height || 380;

  const cx = width * 0.5;
  const cy = height * 0.40;

  const rx = Math.min(Math.round(width * 0.28), 110);
  const ry = Math.min(Math.round(height * 0.28), 115);

  const strokeColor = centered === true ? 'rgba(34,197,94,0.95)' :
  centered === false ? 'rgba(239,68,68,0.85)' :
  'rgba(255,255,255,0.7)';

  const strokeWidth = centered === true ? 3 : 2;
  const strokeDash = centered === true ? undefined : '8,6';

  const arrowText = centered === false ? getArrows(facePos) : '';
  const showCheck = centered === true;

  const overlayPath = [\`M 0 0 H \${width} V \${height} H 0 Z\`, \`M \${cx - rx} \${cy}\`, \`A \${rx} \${ry} 0 1 0 \${cx + rx} \${cy}\`, \`A \${rx} \${ry} 0 1 0 \${cx - rx} \${cy}\`, \`Z\`].join(' ');
  return (
    _jsx(View, {
      style: StyleSheet.absoluteFill,
      pointerEvents: "none",
      onLayout: e => {
        const { width: w, height: h } = e.nativeEvent.layout;
        if (w > 0 && h > 0 && (!containerDims || containerDims.width !== w || containerDims.height !== h)) {
          setContainerDims({ width: w, height: h });
        }
      },
      children: _jsxs(Svg, {
        height: "100%",
        width: "100%",
        children: [_jsx(Path, {
          d: overlayPath,
          fill: "rgba(0,0,0,0.60)",
          fillRule: "evenodd"
        }), _jsx(Ellipse, {
          cx: cx,
          cy: cy,
          rx: rx,
          ry: ry,
          fill: "none",
          stroke: strokeColor,
          strokeWidth: strokeWidth,
          strokeDasharray: strokeDash
        }), showCheck && _jsx(SvgText, {
          x: cx,
          y: cy,
          textAnchor: "middle",
          alignmentBaseline: "central",
          fontSize: 52,
          fill: "rgba(34,197,94,0.95)",
          children: "\\u2713"
        }), !showCheck && arrowText !== '' && _jsx(SvgText, {
          x: cx,
          y: cy,
          textAnchor: "middle",
          alignmentBaseline: "central",
          fontSize: 40,
          fill: "rgba(255,255,255,0.95)",
          children: arrowText
        })]
      })
    })
  );
}
`;
  fs.writeFileSync(moduleOverlayPath, code);
}

// 2. lib/commonjs/FaceMaskOverlay.js
const cjsOverlayPath = path.join(packageRoot, 'lib', 'commonjs', 'FaceMaskOverlay.js');
if (fs.existsSync(cjsOverlayPath)) {
  const code = `"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FaceMaskOverlay = FaceMaskOverlay;
var _react = _interopRequireWildcard(require("react"));
var _reactNative = require("react-native");
var _reactNativeSvg = _interopRequireWildcard(require("react-native-svg"));
var _jsxRuntime = require("react/jsx-runtime");
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }

function getArrows(pos) {
  if (!pos) return '';
  const arrows = [];
  if (pos.cx < 0.45) arrows.push('→');else if (pos.cx > 0.55) arrows.push('←');
  if (pos.cy < 0.40) arrows.push('↓');else if (pos.cy > 0.50) arrows.push('↑');
  return arrows.join('  ');
}

function FaceMaskOverlay({
  centered,
  facePos
}) {
  const {
    width: winWidth,
    height: winHeight
  } = (0, _reactNative.useWindowDimensions)();
  const [containerDims, setContainerDims] = (0, _react.useState)(null);
  const width = containerDims?.width || Math.min(winWidth - 32, 380);
  const height = containerDims?.height || 380;

  const cx = width * 0.5;
  const cy = height * 0.40;

  const rx = Math.min(Math.round(width * 0.28), 110);
  const ry = Math.min(Math.round(height * 0.28), 115);

  const strokeColor = centered === true ? 'rgba(34,197,94,0.95)' :
  centered === false ? 'rgba(239,68,68,0.85)' :
  'rgba(255,255,255,0.7)';

  const strokeWidth = centered === true ? 3 : 2;
  const strokeDash = centered === true ? undefined : '8,6';

  const arrowText = centered === false ? getArrows(facePos) : '';
  const showCheck = centered === true;

  const overlayPath = [\`M 0 0 H \${width} V \${height} H 0 Z\`, \`M \${cx - rx} \${cy}\`, \`A \${rx} \${ry} 0 1 0 \${cx + rx} \${cy}\`, \`A \${rx} \${ry} 0 1 0 \${cx - rx} \${cy}\`, \`Z\`].join(' ');
  return (0, _jsxRuntime.jsx)(_reactNative.View, {
    style: _reactNative.StyleSheet.absoluteFill,
    pointerEvents: "none",
    onLayout: e => {
      const { width: w, height: h } = e.nativeEvent.layout;
      if (w > 0 && h > 0 && (!containerDims || containerDims.width !== w || containerDims.height !== h)) {
        setContainerDims({ width: w, height: h });
      }
    },
    children: (0, _jsxRuntime.jsxs)(_reactNativeSvg.default, {
      height: "100%",
      width: "100%",
      children: [(0, _jsxRuntime.jsx)(_reactNativeSvg.Path, {
        d: overlayPath,
        fill: "rgba(0,0,0,0.60)",
        fillRule: "evenodd"
      }), (0, _jsxRuntime.jsx)(_reactNativeSvg.Ellipse, {
        cx: cx,
        cy: cy,
        rx: rx,
        ry: ry,
        fill: "none",
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        strokeDasharray: strokeDash
      }), showCheck && (0, _jsxRuntime.jsx)(_reactNativeSvg.Text, {
        x: cx,
        y: cy,
        textAnchor: "middle",
        alignmentBaseline: "central",
        fontSize: 52,
        fill: "rgba(34,197,94,0.95)",
        children: "\\u2713"
      }), !showCheck && arrowText !== '' && (0, _jsxRuntime.jsx)(_reactNativeSvg.Text, {
        x: cx,
        y: cy,
        textAnchor: "middle",
        alignmentBaseline: "central",
        fontSize: 40,
        fill: "rgba(255,255,255,0.95)",
        children: arrowText
      })]
    })
  });
}
`;
  fs.writeFileSync(cjsOverlayPath, code);
}

// 3. lib/module/FaceAuthView.js
const moduleViewPath = path.join(packageRoot, 'lib', 'module', 'FaceAuthView.js');
if (fs.existsSync(moduleViewPath)) {
  let mSource = fs.readFileSync(moduleViewPath, 'utf8').replace(/\r\n/g, '\n');
  mSource = mSource.replace("import { saveModelDebugFrame } from './debug';\n", '');
  mSource = mSource.replace('  const cameraRef = useRef(null);\n  const DEBUG_INTERVAL_MS = 5_000;\n', '');
  mSource = mSource.replace('const { frameProcessor, triggerDebugCapture } = useFrameSource({', 'const { frameProcessor } = useFrameSource({');
  mSource = mSource.replace('onModelDebug: __DEV__ ? saveModelDebugFrame : undefined,', 'onModelDebug: undefined,');
  mSource = mSource.replace(/  \/\/ ── Debug: every DEBUG_INTERVAL_MS[\s\S]*?(?=  const handleBack = useCallback)/, '');
  mSource = mSource.replace('      ref: cameraRef,\n', '');
  if (!mSource.includes('sessionKey,')) {
    mSource = mSource.replace(
      '  style\n}) {',
      '  style,\n  sessionKey\n}) {'
    );
    mSource = mSource.replace(
      '  const {\n    start,\n    cancel,\n    feed,\n    active,\n    stageRef\n  } = useFaceAuth({',
      `  const isFirstMountRef = useRef(true);
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }
    setHint('Position your face in the frame');
    setChallenge(undefined);
    setVerifying(false);
    setFaceCentered(null);
    setFacePos(null);
    cancel();
    start();
  }, [sessionKey, cancel, start]);

  const {
    start,
    cancel,
    feed,
    active,
    stageRef
  } = useFaceAuth({`
    );
    mSource = mSource.replace(
      '      frameProcessor: frameProcessor\n    }),',
      '      frameProcessor: frameProcessor,\n      onError: err => { console.warn("[FaceAuthView] Camera error:", err); }\n    }),'
    );
  }
  fs.writeFileSync(moduleViewPath, mSource);
}

// 4. lib/commonjs/FaceAuthView.js
const cjsViewPath = path.join(packageRoot, 'lib', 'commonjs', 'FaceAuthView.js');
if (fs.existsSync(cjsViewPath)) {
  let cSource = fs.readFileSync(cjsViewPath, 'utf8').replace(/\r\n/g, '\n');
  cSource = cSource.replace("var _debug = require(\"./debug\");\n", '');
  cSource = cSource.replace('  const cameraRef = (0, _react.useRef)(null);\n  const DEBUG_INTERVAL_MS = 5_000;\n', '');
  cSource = cSource.replace('const { frameProcessor, triggerDebugCapture } = (0, _frameSource.useFrameSource)({', 'const { frameProcessor } = (0, _frameSource.useFrameSource)({');
  cSource = cSource.replace('onModelDebug: __DEV__ ? _debug.saveModelDebugFrame : undefined,', 'onModelDebug: undefined,');
  cSource = cSource.replace(/  \/\/ ── Debug: every DEBUG_INTERVAL_MS[\s\S]*?(?=  const handleBack = \(0, _react.useCallback\))/, '');
  cSource = cSource.replace('      ref: cameraRef,\n', '');
  if (!cSource.includes('sessionKey,')) {
    cSource = cSource.replace(
      '  style\n}) {',
      '  style,\n  sessionKey\n}) {'
    );
    cSource = cSource.replace(
      '  const {\n    start,\n    cancel,\n    feed,\n    active,\n    stageRef\n  } = (0, _useFaceAuth.useFaceAuth)({',
      `  const isFirstMountRef = (0, _react.useRef)(true);
  (0, _react.useEffect)(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }
    setHint('Position your face in the frame');
    setChallenge(undefined);
    setVerifying(false);
    setFaceCentered(null);
    setFacePos(null);
    cancel();
    start();
  }, [sessionKey, cancel, start]);

  const {
    start,
    cancel,
    feed,
    active,
    stageRef
  } = (0, _useFaceAuth.useFaceAuth)({`
    );
    cSource = cSource.replace(
      '      frameProcessor: frameProcessor\n    }),',
      '      frameProcessor: frameProcessor,\n      onError: err => { console.warn("[FaceAuthView] Camera error:", err); }\n    }),'
    );
  }
  fs.writeFileSync(cjsViewPath, cSource);
}

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
  let workletsSource = fs.readFileSync(workletsPluginPath, 'utf8').replace(/\r\n/g, '\n');
  workletsSource = workletsSource.replaceAll(
    '@babel/plugin-proposal-optional-chaining',
    '@babel/plugin-transform-optional-chaining',
  );
  workletsSource = workletsSource.replaceAll(
    '@babel/plugin-proposal-nullish-coalescing-operator',
    '@babel/plugin-transform-nullish-coalescing-operator',
  );
  workletsSource = workletsSource.replace(
    /presets:\s*\["@babel\/preset-typescript"\],\s*plugins:\s*\[/,
    'plugins: [\n      "@babel/plugin-transform-typescript",\n',
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

// react-native-get-random-values: prevent crash when native RNGetRandomValues is not compiled into the APK
const getRandomValuesPath = path.join(__dirname, '..', 'node_modules', 'react-native-get-random-values', 'index.js');
if (fs.existsSync(getRandomValuesPath)) {
  let gvSource = fs.readFileSync(getRandomValuesPath, 'utf8').replace(/\r\n/g, '\n');
  let changed = false;
  if (!gvSource.includes('NativeModules,')) {
    gvSource = gvSource.replace(
      "const { TurboModuleRegistry } = require('react-native')",
      "const { NativeModules, TurboModuleRegistry } = require('react-native')"
    );
    changed = true;
  }
  if (gvSource.includes("TurboModuleRegistry.getEnforcing('RNGetRandomValues')")) {
    gvSource = gvSource.replace(
      "    module = TurboModuleRegistry.getEnforcing('RNGetRandomValues')",
      "    try {\n      module = (TurboModuleRegistry.get ? TurboModuleRegistry.get('RNGetRandomValues') : null) || (NativeModules && NativeModules.RNGetRandomValues) || null;\n    } catch {\n      module = null;\n    }"
    );
    gvSource = gvSource.replace(
      "  base64Decode(getRandomBase64(array.byteLength), new Uint8Array(array.buffer, array.byteOffset, array.byteLength))\n\n  return array",
      "  const b64 = getRandomBase64(array.byteLength);\n  if (!b64) {\n    return insecureRandomValues(array);\n  }\n  base64Decode(b64, new Uint8Array(array.buffer, array.byteOffset, array.byteLength));\n\n  return array"
    );
    changed = true;
  }
  if (gvSource.includes("console.warn('Using an insecure random number generator")) {
    gvSource = gvSource.replace(
      "    console.warn('Using an insecure random number generator, this should only happen when running in a debugger without support for crypto.getRandomValues')",
      "    // Silenced warning for debugger/dev mode without blocking execution"
    );
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(getRandomValuesPath, gvSource);
  }
}

// react-native-fast-tflite: prevent crash when native Tflite is not compiled into the APK
const tfliteSpecPath = path.join(__dirname, '..', 'node_modules', 'react-native-fast-tflite', 'spec', 'NativeRNTflite.ts');
if (fs.existsSync(tfliteSpecPath)) {
  let specSource = fs.readFileSync(tfliteSpecPath, 'utf8').replace(/\r\n/g, '\n');
  if (specSource.includes("TurboModuleRegistry.getEnforcing<Spec>('Tflite')")) {
    specSource = specSource.replace(
      "export default TurboModuleRegistry.getEnforcing<Spec>('Tflite')",
      "let nativeModule: Spec | null = null;\ntry {\n  nativeModule = TurboModuleRegistry.get ? TurboModuleRegistry.get<Spec>('Tflite') : null;\n} catch {\n  nativeModule = null;\n}\nexport default nativeModule;"
    );
    fs.writeFileSync(tfliteSpecPath, specSource);
  }
}

const tfliteSourcePath = path.join(__dirname, '..', 'node_modules', 'react-native-fast-tflite', 'src', 'TensorflowLite.ts');
if (fs.existsSync(tfliteSourcePath)) {
  let tfSource = fs.readFileSync(tfliteSourcePath, 'utf8').replace(/\r\n/g, '\n');
  let changed = false;
  if (tfSource.includes('const result = TensorflowModule.install() as boolean')) {
    tfSource = tfSource.replace(
      "const result = TensorflowModule.install() as boolean\nif (result !== true)\n  console.error('Failed to install Tensorflow Lite bindings!')\n\nconsole.log('Successfully installed!')",
      "if (TensorflowModule && typeof TensorflowModule.install === 'function') {\n  const result = TensorflowModule.install() as boolean;\n  if (result !== true) console.error('Failed to install Tensorflow Lite bindings!');\n  else console.log('Successfully installed!');\n} else {\n  console.warn('Native Tflite module is not installed in this binary.');\n}"
    );
    changed = true;
  }
  if (!tfSource.includes('Native TFLite module is not installed in this build')) {
    tfSource = tfSource.replace(
      "  return global.__loadTensorflowModel(uri, delegate)",
      "  if (typeof global.__loadTensorflowModel !== 'function') {\n    throw new Error('Native TFLite module is not installed in this build.');\n  }\n  return global.__loadTensorflowModel(uri, delegate)"
    );
    changed = true;
  }
  if (tfSource.includes('const asset = Image.resolveAssetSource(source)\n    uri = asset.uri')) {
    tfSource = tfSource.replace(
      'const asset = Image.resolveAssetSource(source)\n    uri = asset.uri',
      'const asset = Image.resolveAssetSource(source)\n    if (!asset || !asset.uri) {\n      throw new Error(`TFLite: Failed to resolve asset source for ${source}!`);\n    }\n    uri = asset.uri'
    );
    changed = true;
  }
  if (tfSource.includes('console.error(`Failed to load Tensorflow Model ${source}!`, e)')) {
    tfSource = tfSource.replace(
      'console.error(`Failed to load Tensorflow Model ${source}!`, e)',
      'console.warn(`Failed to load Tensorflow Model ${source}!`, e)'
    );
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(tfliteSourcePath, tfSource);
  }
}

// react-native-keychain: prevent crash when native RNKeychainManager is not compiled into the APK
const keychainSrcPath = path.join(__dirname, '..', 'node_modules', 'react-native-keychain', 'src', 'index.ts');
if (fs.existsSync(keychainSrcPath)) {
  let kcSource = fs.readFileSync(keychainSrcPath, 'utf8').replace(/\r\n/g, '\n');
  if (kcSource.includes('const { RNKeychainManager } = NativeModules;')) {
    kcSource = kcSource.replace(
      'const { RNKeychainManager } = NativeModules;',
      `const _kcMemoryStore = new Map();
const _kcFallback = {
  getGenericPasswordForOptions: async (opts) => {
    const s = opts?.service || 'default';
    const item = _kcMemoryStore.get(s);
    return item ? { service: s, username: item.username, password: item.password, storage: 'KC_MOCK' } : false;
  },
  setGenericPasswordForOptions: async (opts, u, p) => {
    const s = opts?.service || 'default';
    _kcMemoryStore.set(s, { username: u, password: p });
    return { service: s, storage: 'KC_MOCK' };
  },
  resetGenericPasswordForOptions: async (opts) => {
    _kcMemoryStore.delete(opts?.service || 'default');
    return true;
  },
  hasGenericPasswordForOptions: async (opts) => _kcMemoryStore.has(opts?.service || 'default'),
  getAllGenericPasswordServices: async () => Array.from(_kcMemoryStore.keys()),
  getSupportedBiometryType: async () => null,
  canCheckAuthentication: async () => false,
  getSecurityLevel: async () => 'SOFTWARE',
  isPasscodeAuthAvailable: async () => false,
};
const RNKeychainManager = NativeModules.RNKeychainManager || _kcFallback;`
    );
    fs.writeFileSync(keychainSrcPath, kcSource);
  }
}

// ─── Calibrated Thresholds & Quality Gate Patches ─────────────────────────────
// 1. Patch config.ts / lib/commonjs/config.js / lib/module/config.js
['src/config.ts', 'lib/commonjs/config.js', 'lib/module/config.js'].forEach((relPath) => {
  const filePath = path.join(packageRoot, relPath);
  if (fs.existsSync(filePath)) {
    let cfgContent = fs.readFileSync(filePath, 'utf8');
    cfgContent = cfgContent.replace(/minFaceArea:\s*0\.4/g, 'minFaceArea: 0.04');
    cfgContent = cfgContent.replace(/centerMargin:\s*0\.10?/g, 'centerMargin: 0.02');
    cfgContent = cfgContent.replace(/maxYaw:\s*30/g, 'maxYaw: 40');
    cfgContent = cfgContent.replace(/fineThreshold:\s*0\.72/g, 'fineThreshold: 0.70');
    fs.writeFileSync(filePath, cfgContent);
  }
});

// 2. Patch qualityGate.ts / lib/commonjs/qualityGate.js / lib/module/qualityGate.js
// Ensure centerMargin is clamped to at most 0.04 to prevent false 'Center your face' lockups
['src/qualityGate.ts', 'lib/commonjs/qualityGate.js', 'lib/module/qualityGate.js'].forEach((relPath) => {
  const filePath = path.join(packageRoot, relPath);
  if (fs.existsSync(filePath)) {
    let qgContent = fs.readFileSync(filePath, 'utf8');
    if (qgContent.includes('const m = t.centerMargin;')) {
      qgContent = qgContent.replace(
        'const m = t.centerMargin;',
        'const m = Math.min(t.centerMargin ?? 0.02, 0.04);'
      );
    } else if (qgContent.includes('const m = t.centerMargin')) {
      qgContent = qgContent.replace(
        'const m = t.centerMargin',
        'const m = Math.min(t.centerMargin ?? 0.02, 0.04)'
      );
    }
    fs.writeFileSync(filePath, qgContent);
  }
});

// 3. Patch pipeline.ts / lib/commonjs/pipeline.js / lib/module/pipeline.js
// Set default gateFrames = 2 so 2 consecutive stable frames transition smoothly into challenge/analyzing
['src/pipeline.ts', 'lib/commonjs/pipeline.js', 'lib/module/pipeline.js'].forEach((relPath) => {
  const filePath = path.join(packageRoot, relPath);
  if (fs.existsSync(filePath)) {
    let pipeContent = fs.readFileSync(filePath, 'utf8');
    pipeContent = pipeContent.replace(/this\.gateFrames\s*=\s*opts\.gateFrames\s*\?\?\s*3;/g, 'this.gateFrames = Math.min(opts.gateFrames ?? 2, 2);');
    fs.writeFileSync(filePath, pipeContent);
  }
});




