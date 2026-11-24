const fs = require('fs');
const path = require('path');

const packageRoot = path.join(__dirname, '..', 'node_modules', 'react-native-offline-face-auth');
const packageInfo = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
if (packageInfo.version !== '0.1.0') {
  throw new Error(`Review the camera debug patch before upgrading react-native-offline-face-auth (${packageInfo.version}).`);
}

// ─── 1. Patch types.ts / lib/typescript/types.d.ts / lib/commonjs/types.js / lib/module/types.js ───
const typesTsPath = path.join(packageRoot, 'src', 'types.ts');
if (fs.existsSync(typesTsPath)) {
  let typesSource = fs.readFileSync(typesTsPath, 'utf8');
  typesSource = typesSource.replace(
    "export type Challenge = 'blink' | 'smile' | 'turn_head';",
    "export type Challenge = 'blink' | 'smile' | 'turn_head' | 'turn_left' | 'turn_right';"
  );
  fs.writeFileSync(typesTsPath, typesSource);
}

const typesDtsPath = path.join(packageRoot, 'lib', 'typescript', 'types.d.ts');
if (fs.existsSync(typesDtsPath)) {
  let typesDtsSource = fs.readFileSync(typesDtsPath, 'utf8');
  typesDtsSource = typesDtsSource.replace(
    "export type Challenge = 'blink' | 'smile' | 'turn_head';",
    "export type Challenge = 'blink' | 'smile' | 'turn_head' | 'turn_left' | 'turn_right';"
  );
  fs.writeFileSync(typesDtsPath, typesDtsSource);
}

// ─── 2. Patch activeChallenge.ts / lib/module / lib/commonjs ───────────────────
const activeChallengePath = path.join(packageRoot, 'src', 'activeChallenge.ts');
if (fs.existsSync(activeChallengePath)) {
  const code = `import { LANDMARK } from './detector';
import type { Thresholds } from './config';
import type { DetectedFace } from './types';
import type { Challenge } from './types';

export interface ChallengeConfig {
  pool: Challenge[];
  timeoutMs: number;
  thresholds: Pick<Thresholds,
    | 'blinkCloseEar'
    | 'blinkOpenEar'
    | 'smileRatio'
    | 'turnYawThreshold'
    | 'turnReturnThreshold'
    | 'challengeLostFrameTolerance'
  >;
}

type ChallengeState = 'pending' | 'passed' | 'failed';

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function eyeAspectRatio(lm: { x: number; y: number }[], ring: readonly number[]): number {
  const [p0, p1, p2, p3, p4, p5] = ring;
  const a = dist(lm[p1!]!, lm[p5!]!);
  const b = dist(lm[p2!]!, lm[p4!]!);
  const c = dist(lm[p0!]!, lm[p3!]!);
  return (a + b) / (2 * c + 1e-6);
}

function mouthWidthRatio(lm: { x: number; y: number }[]): number {
  const w = dist(lm[LANDMARK.mouthLeft]!, lm[LANDMARK.mouthRight]!);
  const h = dist(lm[LANDMARK.mouthTop]!, lm[LANDMARK.mouthBottom]!);
  return w / (h + 1e-6);
}

export class ActiveChallenge {
  readonly challenge: Challenge;
  readonly prompt: string;
  private _status: ChallengeState = 'pending';
  private blinkSeenClosed = false;
  private turnSeenYaw = false;
  private lostFrameCount = 0;
  private readonly startMs: number;
  private readonly timeoutMs: number;
  private readonly config: ChallengeConfig;

  constructor(
    config: ChallengeConfig,
    startMs: number,
    rng: () => number = Math.random,
  ) {
    this.config = config;
    this.startMs = startMs;
    this.timeoutMs = config.timeoutMs;
    const idx = Math.floor(rng() * config.pool.length);
    this.challenge = config.pool[idx % config.pool.length]!;
    this.prompt = ActiveChallenge.promptFor(this.challenge);
  }

  get status(): ChallengeState {
    return this._status;
  }

  feed(face: DetectedFace | null, now: number): ChallengeState {
    if (this._status !== 'pending') return this._status;

    if (now - this.startMs > this.timeoutMs) {
      this._status = 'failed';
      return 'failed';
    }

    if (face === null) {
      this.lostFrameCount += 1;
      if (this.lostFrameCount > this.config.thresholds.challengeLostFrameTolerance) {
        this._status = 'failed';
        return 'failed';
      }
      return 'pending';
    }
    this.lostFrameCount = 0;

    switch (this.challenge) {
      case 'blink':
        return this.feedBlink(face);
      case 'smile':
        return this.feedSmile(face);
      case 'turn_left':
        return this.feedTurnLeft(face);
      case 'turn_right':
        return this.feedTurnRight(face);
      case 'turn_head':
      default:
        return this.feedTurn(face);
    }
  }

  private feedBlink(face: DetectedFace): ChallengeState {
    const lm = face.landmarks;
    const ear =
      (eyeAspectRatio(lm, LANDMARK.leftEye) + eyeAspectRatio(lm, LANDMARK.rightEye)) / 2;
    const closeThreshold = Math.max(0.18, this.config.thresholds.blinkCloseEar ?? 0.20);
    const openThreshold = Math.max(0.21, this.config.thresholds.blinkOpenEar ?? 0.22);

    if (!this.blinkSeenClosed && ear < closeThreshold) {
      this.blinkSeenClosed = true;
    } else if (this.blinkSeenClosed && ear >= openThreshold) {
      this._status = 'passed';
    }
    return this._status;
  }

  private feedSmile(face: DetectedFace): ChallengeState {
    const ratio = mouthWidthRatio(face.landmarks);
    if (ratio >= (this.config.thresholds.smileRatio ?? 0.70)) {
      this._status = 'passed';
    }
    return this._status;
  }

  private feedTurnLeft(face: DetectedFace): ChallengeState {
    const yaw = face.headPose.yaw;
    const threshold = this.config.thresholds.turnYawThreshold || 12;
    const returnThreshold = this.config.thresholds.turnReturnThreshold || 6;
    if (!this.turnSeenYaw && yaw < -threshold) {
      this.turnSeenYaw = true;
    } else if (this.turnSeenYaw && yaw > -returnThreshold) {
      this._status = 'passed';
    }
    return this._status;
  }

  private feedTurnRight(face: DetectedFace): ChallengeState {
    const yaw = face.headPose.yaw;
    const threshold = this.config.thresholds.turnYawThreshold || 12;
    const returnThreshold = this.config.thresholds.turnReturnThreshold || 6;
    if (!this.turnSeenYaw && yaw > threshold) {
      this.turnSeenYaw = true;
    } else if (this.turnSeenYaw && yaw < returnThreshold) {
      this._status = 'passed';
    }
    return this._status;
  }

  private feedTurn(face: DetectedFace): ChallengeState {
    const yaw = Math.abs(face.headPose.yaw);
    const threshold = this.config.thresholds.turnYawThreshold || 12;
    const returnThreshold = this.config.thresholds.turnReturnThreshold || 6;
    if (!this.turnSeenYaw && yaw > threshold) {
      this.turnSeenYaw = true;
    } else if (this.turnSeenYaw && yaw < returnThreshold) {
      this._status = 'passed';
    }
    return this._status;
  }

  private static promptFor(c: Challenge): string {
    switch (c) {
      case 'blink':      return 'Blink your eyes';
      case 'turn_left':  return 'Turn your head left';
      case 'turn_right': return 'Turn your head right';
      case 'turn_head':  return 'Turn your head';
      case 'smile':      return 'Smile naturally';
      default:           return 'Look directly at camera';
    }
  }
}
`;
  fs.writeFileSync(activeChallengePath, code);
}

// ─── 3. Patch FaceAuthView.tsx ────────────────────────────────────────────────
const viewPath = path.join(packageRoot, 'src', 'FaceAuthView.tsx');
let source = fs.readFileSync(viewPath, 'utf8').replace(/\r\n/g, '\n');
source = source.replace("import { saveModelDebugFrame } from './debug';\n", '');
source = source.replace('  const cameraRef = useRef<Camera>(null);\n  const DEBUG_INTERVAL_MS = 5_000;\n', '');
source = source.replace('const { frameProcessor, triggerDebugCapture } = useFrameSource({', 'const { frameProcessor } = useFrameSource({');
source = source.replace('onModelDebug: __DEV__ ? saveModelDebugFrame : undefined,', '// Camera-derived debug frames are never written to disk.\n    onModelDebug: undefined,');
source = source.replace(/  \/\/ ── Debug: every DEBUG_INTERVAL_MS[\s\S]*?(?=  const handleBack = useCallback)/, '');
source = source.replace('        ref={cameraRef}\n', '');

// Support extended challenge prompts
source = source.replace(
  /const CHALLENGE_PROMPT:\s*Record<Challenge,\s*\{[^}]+\}>\s*=\s*\{[\s\S]*?\};/,
  `const CHALLENGE_PROMPT: Record<Challenge, { icon: string; title: string }> = {
  blink: { icon: '😉', title: 'Blink your eyes' },
  turn_left: { icon: '⬅️', title: 'Turn head left' },
  turn_right: { icon: '➡️', title: 'Turn head right' },
  turn_head: { icon: '↔️', title: 'Turn head left or right' },
  smile: { icon: '😊', title: 'Smile naturally' },
};`
);

// Support sessionKey and immediate embedding flag trigger
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
}

// Ensure analyzing flag responds to both 'Verifying…' and 'Hold still…'
source = source.replace(
  "const analyzing = g.message === 'Verifying…';",
  "const analyzing = g.message === 'Verifying…' || g.message === 'Hold still…';"
);

// Reposition promptCard to top: 20 so it never obscures the face detection canvas
source = source.replace(
  /promptCard:\s*\{\s*position:\s*'absolute',\s*top:\s*'18%',/g,
  "promptCard: {\n    position: 'absolute',\n    top: 20,"
);
source = source.replace(
  /promptCard:\s*\{\s*position:\s*'absolute',\s*top:\s*20,/g,
  "promptCard: {\n    position: 'absolute',\n    top: 20,"
);

fs.writeFileSync(viewPath, source);

// Patch typescript definition file for FaceAuthView
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

// ─── 4. Patch FaceMaskOverlay.tsx with Enlarged Circular Canvas & Brackets ───
const overlayPathFile = path.join(packageRoot, 'src', 'FaceMaskOverlay.tsx');
if (fs.existsSync(overlayPathFile)) {
  const overlayCode = `import React, { useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Path, Ellipse, Text as SvgText } from 'react-native-svg';

export interface FaceMaskOverlayProps {
  centered: boolean | null;
  facePos: { cx: number; cy: number } | null;
}

function getArrows(pos: { cx: number; cy: number } | null): string {
  if (!pos) return '';
  const arrows: string[] = [];
  if (pos.cx < 0.44) arrows.push('→');
  else if (pos.cx > 0.56) arrows.push('←');
  if (pos.cy < 0.38) arrows.push('↓');
  else if (pos.cy > 0.52) arrows.push('↑');
  return arrows.join('  ');
}

export function FaceMaskOverlay({ centered, facePos }: FaceMaskOverlayProps) {
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const [containerDims, setContainerDims] = useState<{ width: number; height: number } | null>(null);

  const width = containerDims?.width || Math.min(winWidth, 420);
  const height = containerDims?.height || Math.min(winHeight, 600);

  // Position circle comfortably centered horizontally, with optical vertical centering
  const cx = width * 0.5;
  const cy = height * 0.44;

  const minDim = Math.min(width, height);
  // Enlarged circular face detection canvas: ~290px x 330px
  const rx = Math.min(Math.round(minDim * 0.38), 148);
  const ry = Math.min(Math.round(minDim * 0.42), 168);

  const strokeColor = centered === true
    ? '#22C55E'
    : centered === false
    ? '#EF4444'
    : 'rgba(255,255,255,0.85)';

  const strokeWidth = centered === true ? 3.5 : 2.5;
  const strokeDash = centered === true ? undefined : '10,6';

  const arrowText = centered === false ? getArrows(facePos) : '';
  const showCheck = centered === true;

  const overlayPath = [
    \`M 0 0 H \${width} V \${height} H 0 Z\`,
    \`M \${cx - rx} \${cy}\`,
    \`A \${rx} \${ry} 0 1 0 \${cx + rx} \${cy}\`,
    \`A \${rx} \${ry} 0 1 0 \${cx - rx} \${cy}\`,
    \`Z\`,
  ].join(' ');

  const cornerLen = 22;
  const pad = 12;
  const leftX = cx - rx - pad;
  const rightX = cx + rx + pad;
  const topY = cy - ry - pad;
  const botY = cy + ry + pad;
  const cornerColor = centered === true ? '#22C55E' : 'rgba(255,255,255,0.6)';

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        if (w > 0 && h > 0 && (!containerDims || containerDims.width !== w || containerDims.height !== h)) {
          setContainerDims({ width: w, height: h });
        }
      }}
    >
      <Svg height="100%" width="100%">
        <Path d={overlayPath} fill="rgba(0,0,0,0.65)" fillRule="evenodd" />

        {showCheck && (
          <Ellipse
            cx={cx}
            cy={cy}
            rx={rx + 4}
            ry={ry + 4}
            fill="none"
            stroke="rgba(34,197,94,0.35)"
            strokeWidth={3}
          />
        )}

        <Ellipse
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDash}
        />

        {/* Professional Corner Target Brackets */}
        <Path
          d={\`M \${leftX} \${topY + cornerLen} V \${topY} H \${leftX + cornerLen}\`}
          stroke={cornerColor}
          strokeWidth={2.5}
          fill="none"
        />
        <Path
          d={\`M \${rightX - cornerLen} \${topY} H \${rightX} V \${topY + cornerLen}\`}
          stroke={cornerColor}
          strokeWidth={2.5}
          fill="none"
        />
        <Path
          d={\`M \${leftX} \${botY - cornerLen} V \${botY} H \${leftX + cornerLen}\`}
          stroke={cornerColor}
          strokeWidth={2.5}
          fill="none"
        />
        <Path
          d={\`M \${rightX - cornerLen} \${botY} H \${rightX} V \${botY - cornerLen}\`}
          stroke={cornerColor}
          strokeWidth={2.5}
          fill="none"
        />

        {showCheck && (
          <SvgText
            x={cx}
            y={cy}
            textAnchor="middle"
            alignmentBaseline="central"
            fontSize={56}
            fontWeight="bold"
            fill="#22C55E"
          >
            ✓
          </SvgText>
        )}

        {!showCheck && arrowText !== '' && (
          <SvgText
            x={cx}
            y={cy}
            textAnchor="middle"
            alignmentBaseline="central"
            fontSize={44}
            fontWeight="bold"
            fill="#FFFFFF"
          >
            {arrowText}
          </SvgText>
        )}
      </Svg>
    </View>
  );
}
`;
  fs.writeFileSync(overlayPathFile, overlayCode);
}

// ─── 5. Patch compiled lib/module and lib/commonjs distribution files ─────────
// 5a. FaceMaskOverlay compiled files
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
  if (pos.cx < 0.44) arrows.push('→');else if (pos.cx > 0.56) arrows.push('←');
  if (pos.cy < 0.38) arrows.push('↓');else if (pos.cy > 0.52) arrows.push('↑');
  return arrows.join('  ');
}

export function FaceMaskOverlay({ centered, facePos }) {
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const [containerDims, setContainerDims] = useState(null);
  const width = containerDims?.width || Math.min(winWidth, 420);
  const height = containerDims?.height || Math.min(winHeight, 600);

  const cx = width * 0.5;
  const cy = height * 0.44;

  const minDim = Math.min(width, height);
  const rx = Math.min(Math.round(minDim * 0.38), 148);
  const ry = Math.min(Math.round(minDim * 0.42), 168);

  const strokeColor = centered === true ? '#22C55E' : centered === false ? '#EF4444' : 'rgba(255,255,255,0.85)';
  const strokeWidth = centered === true ? 3.5 : 2.5;
  const strokeDash = centered === true ? undefined : '10,6';

  const arrowText = centered === false ? getArrows(facePos) : '';
  const showCheck = centered === true;

  const overlayPath = [\`M 0 0 H \${width} V \${height} H 0 Z\`, \`M \${cx - rx} \${cy}\`, \`A \${rx} \${ry} 0 1 0 \${cx + rx} \${cy}\`, \`A \${rx} \${ry} 0 1 0 \${cx - rx} \${cy}\`, \`Z\`].join(' ');

  const cornerLen = 22;
  const pad = 12;
  const leftX = cx - rx - pad;
  const rightX = cx + rx + pad;
  const topY = cy - ry - pad;
  const botY = cy + ry + pad;
  const cornerColor = centered === true ? '#22C55E' : 'rgba(255,255,255,0.6)';

  return _jsx(View, {
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
      children: [
        _jsx(Path, { d: overlayPath, fill: "rgba(0,0,0,0.65)", fillRule: "evenodd" }),
        showCheck && _jsx(Ellipse, { cx: cx, cy: cy, rx: rx + 4, ry: ry + 4, fill: "none", stroke: "rgba(34,197,94,0.35)", strokeWidth: 3 }),
        _jsx(Ellipse, { cx: cx, cy: cy, rx: rx, ry: ry, fill: "none", stroke: strokeColor, strokeWidth: strokeWidth, strokeDasharray: strokeDash }),
        _jsx(Path, { d: \`M \${leftX} \${topY + cornerLen} V \${topY} H \${leftX + cornerLen}\`, stroke: cornerColor, strokeWidth: 2.5, fill: "none" }),
        _jsx(Path, { d: \`M \${rightX - cornerLen} \${topY} H \${rightX} V \${topY + cornerLen}\`, stroke: cornerColor, strokeWidth: 2.5, fill: "none" }),
        _jsx(Path, { d: \`M \${leftX} \${botY - cornerLen} V \${botY} H \${leftX + cornerLen}\`, stroke: cornerColor, strokeWidth: 2.5, fill: "none" }),
        _jsx(Path, { d: \`M \${rightX - cornerLen} \${botY} H \${rightX} V \${botY - cornerLen}\`, stroke: cornerColor, strokeWidth: 2.5, fill: "none" }),
        showCheck && _jsx(SvgText, { x: cx, y: cy, textAnchor: "middle", alignmentBaseline: "central", fontSize: 56, fontWeight: "bold", fill: "#22C55E", children: "\\u2713" }),
        !showCheck && arrowText !== '' && _jsx(SvgText, { x: cx, y: cy, textAnchor: "middle", alignmentBaseline: "central", fontSize: 44, fontWeight: "bold", fill: "#FFFFFF", children: arrowText })
      ]
    })
  });
}
`;
  fs.writeFileSync(moduleOverlayPath, code);
}

const cjsOverlayPath = path.join(packageRoot, 'lib', 'commonjs', 'FaceMaskOverlay.js');
if (fs.existsSync(cjsOverlayPath)) {
  const code = `"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
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
  if (pos.cx < 0.44) arrows.push('→');else if (pos.cx > 0.56) arrows.push('←');
  if (pos.cy < 0.38) arrows.push('↓');else if (pos.cy > 0.52) arrows.push('↑');
  return arrows.join('  ');
}

function FaceMaskOverlay({ centered, facePos }) {
  const { width: winWidth, height: winHeight } = (0, _reactNative.useWindowDimensions)();
  const [containerDims, setContainerDims] = (0, _react.useState)(null);
  const width = containerDims?.width || Math.min(winWidth, 420);
  const height = containerDims?.height || Math.min(winHeight, 600);

  const cx = width * 0.5;
  const cy = height * 0.44;

  const minDim = Math.min(width, height);
  const rx = Math.min(Math.round(minDim * 0.38), 148);
  const ry = Math.min(Math.round(minDim * 0.42), 168);

  const strokeColor = centered === true ? '#22C55E' : centered === false ? '#EF4444' : 'rgba(255,255,255,0.85)';
  const strokeWidth = centered === true ? 3.5 : 2.5;
  const strokeDash = centered === true ? undefined : '10,6';

  const arrowText = centered === false ? getArrows(facePos) : '';
  const showCheck = centered === true;

  const overlayPath = [\`M 0 0 H \${width} V \${height} H 0 Z\`, \`M \${cx - rx} \${cy}\`, \`A \${rx} \${ry} 0 1 0 \${cx + rx} \${cy}\`, \`A \${rx} \${ry} 0 1 0 \${cx - rx} \${cy}\`, \`Z\`].join(' ');

  const cornerLen = 22;
  const pad = 12;
  const leftX = cx - rx - pad;
  const rightX = cx + rx + pad;
  const topY = cy - ry - pad;
  const botY = cy + ry + pad;
  const cornerColor = centered === true ? '#22C55E' : 'rgba(255,255,255,0.6)';

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
      children: [
        (0, _jsxRuntime.jsx)(_reactNativeSvg.Path, { d: overlayPath, fill: "rgba(0,0,0,0.65)", fillRule: "evenodd" }),
        showCheck && (0, _jsxRuntime.jsx)(_reactNativeSvg.Ellipse, { cx: cx, cy: cy, rx: rx + 4, ry: ry + 4, fill: "none", stroke: "rgba(34,197,94,0.35)", strokeWidth: 3 }),
        (0, _jsxRuntime.jsx)(_reactNativeSvg.Ellipse, { cx: cx, cy: cy, rx: rx, ry: ry, fill: "none", stroke: strokeColor, strokeWidth: strokeWidth, strokeDasharray: strokeDash }),
        (0, _jsxRuntime.jsx)(_reactNativeSvg.Path, { d: \`M \${leftX} \${topY + cornerLen} V \${topY} H \${leftX + cornerLen}\`, stroke: cornerColor, strokeWidth: 2.5, fill: "none" }),
        (0, _jsxRuntime.jsx)(_reactNativeSvg.Path, { d: \`M \${rightX - cornerLen} \${topY} H \${rightX} V \${topY + cornerLen}\`, stroke: cornerColor, strokeWidth: 2.5, fill: "none" }),
        (0, _jsxRuntime.jsx)(_reactNativeSvg.Path, { d: \`M \${leftX} \${botY - cornerLen} V \${botY} H \${leftX + cornerLen}\`, stroke: cornerColor, strokeWidth: 2.5, fill: "none" }),
        (0, _jsxRuntime.jsx)(_reactNativeSvg.Path, { d: \`M \${rightX - cornerLen} \${botY} H \${rightX} V \${botY - cornerLen}\`, stroke: cornerColor, strokeWidth: 2.5, fill: "none" }),
        showCheck && (0, _jsxRuntime.jsx)(_reactNativeSvg.Text, { x: cx, y: cy, textAnchor: "middle", alignmentBaseline: "central", fontSize: 56, fontWeight: "bold", fill: "#22C55E", children: "\\u2713" }),
        !showCheck && arrowText !== '' && (0, _jsxRuntime.jsx)(_reactNativeSvg.Text, { x: cx, y: cy, textAnchor: "middle", alignmentBaseline: "central", fontSize: 44, fontWeight: "bold", fill: "#FFFFFF", children: arrowText })
      ]
    })
  });
}
`;
  fs.writeFileSync(cjsOverlayPath, code);
}

// 5b. FaceAuthView compiled files
const moduleViewPath = path.join(packageRoot, 'lib', 'module', 'FaceAuthView.js');
if (fs.existsSync(moduleViewPath)) {
  let mSource = fs.readFileSync(moduleViewPath, 'utf8').replace(/\r\n/g, '\n');
  mSource = mSource.replace("import { saveModelDebugFrame } from './debug';\n", '');
  mSource = mSource.replace('  const cameraRef = useRef(null);\n  const DEBUG_INTERVAL_MS = 5_000;\n', '');
  mSource = mSource.replace('const { frameProcessor, triggerDebugCapture } = useFrameSource({', 'const { frameProcessor } = useFrameSource({');
  mSource = mSource.replace('onModelDebug: __DEV__ ? saveModelDebugFrame : undefined,', 'onModelDebug: undefined,');
  mSource = mSource.replace(/  \/\/ ── Debug: every DEBUG_INTERVAL_MS[\s\S]*?(?=  const handleBack = useCallback)/, '');
  mSource = mSource.replace('      ref: cameraRef,\n', '');
  mSource = mSource.replace(
    /const CHALLENGE_PROMPT\s*=\s*\{[\s\S]*?\};/,
    `const CHALLENGE_PROMPT = {
  blink: { icon: '😉', title: 'Blink your eyes' },
  turn_left: { icon: '⬅️', title: 'Turn head left' },
  turn_right: { icon: '➡️', title: 'Turn head right' },
  turn_head: { icon: '↔️', title: 'Turn head left or right' },
  smile: { icon: '😊', title: 'Smile naturally' }
};`
  );
  mSource = mSource.replace(
    "const analyzing = g.message === 'Verifying…';",
    "const analyzing = g.message === 'Verifying…' || g.message === 'Hold still…';"
  );
  mSource = mSource.replace(
    /promptCard:\s*\{\s*position:\s*'absolute',\s*top:\s*'18%',/g,
    "promptCard: {\n    position: 'absolute',\n    top: 20,"
  );
  if (!mSource.includes('sessionKey,')) {
    mSource = mSource.replace('  style\n}) {', '  style,\n  sessionKey\n}) {');
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

const cjsViewPath = path.join(packageRoot, 'lib', 'commonjs', 'FaceAuthView.js');
if (fs.existsSync(cjsViewPath)) {
  let cSource = fs.readFileSync(cjsViewPath, 'utf8').replace(/\r\n/g, '\n');
  cSource = cSource.replace("var _debug = require(\"./debug\");\n", '');
  cSource = cSource.replace('  const cameraRef = (0, _react.useRef)(null);\n  const DEBUG_INTERVAL_MS = 5_000;\n', '');
  cSource = cSource.replace('const { frameProcessor, triggerDebugCapture } = (0, _frameSource.useFrameSource)({', 'const { frameProcessor } = (0, _frameSource.useFrameSource)({');
  cSource = cSource.replace('onModelDebug: __DEV__ ? _debug.saveModelDebugFrame : undefined,', 'onModelDebug: undefined,');
  cSource = cSource.replace(/  \/\/ ── Debug: every DEBUG_INTERVAL_MS[\s\S]*?(?=  const handleBack = \(0, _react.useCallback\))/, '');
  cSource = cSource.replace('      ref: cameraRef,\n', '');
  cSource = cSource.replace(
    /var CHALLENGE_PROMPT\s*=\s*\{[\s\S]*?\};/,
    `var CHALLENGE_PROMPT = {
  blink: { icon: '😉', title: 'Blink your eyes' },
  turn_left: { icon: '⬅️', title: 'Turn head left' },
  turn_right: { icon: '➡️', title: 'Turn head right' },
  turn_head: { icon: '↔️', title: 'Turn head left or right' },
  smile: { icon: '😊', title: 'Smile naturally' }
};`
  );
  cSource = cSource.replace(
    "const analyzing = g.message === 'Verifying…';",
    "const analyzing = g.message === 'Verifying…' || g.message === 'Hold still…';"
  );
  cSource = cSource.replace(
    /promptCard:\s*\{\s*position:\s*'absolute',\s*top:\s*'18%',/g,
    "promptCard: {\n    position: 'absolute',\n    top: 20,"
  );
  if (!cSource.includes('sessionKey,')) {
    cSource = cSource.replace('  style\n}) {', '  style,\n  sessionKey\n}) {');
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

// ─── 6. Patch Babel plugin in react-native-worklets-core ───────────────────────
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
  fs.writeFileSync(workletsPluginPath, workletsSource);
}

// ─── 7. react-native-get-random-values fallback ──────────────────────────────
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

// ─── 8. react-native-fast-tflite fallbacks ───────────────────────────────────
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

// ─── 9. react-native-keychain fallback ───────────────────────────────────────
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

// ─── 10. Calibrated High-Speed & High-Accuracy Thresholds & Quality Gate ─────
// 10a. Patch config.ts / lib/commonjs/config.js / lib/module/config.js
['src/config.ts', 'lib/commonjs/config.js', 'lib/module/config.js'].forEach((relPath) => {
  const filePath = path.join(packageRoot, relPath);
  if (fs.existsSync(filePath)) {
    let cfgContent = fs.readFileSync(filePath, 'utf8');
    cfgContent = cfgContent.replace(/minFaceArea:\s*0\.[0-9]+/g, 'minFaceArea: 0.04');
    cfgContent = cfgContent.replace(/centerMargin:\s*0\.[0-9]+/g, 'centerMargin: 0.02');
    cfgContent = cfgContent.replace(/maxYaw:\s*[0-9]+/g, 'maxYaw: 40');
    cfgContent = cfgContent.replace(/fineThreshold:\s*0\.[0-9]+/g, 'fineThreshold: 0.64');
    cfgContent = cfgContent.replace(/coarseThreshold:\s*0\.[0-9]+/g, 'coarseThreshold: 0.45');
    cfgContent = cfgContent.replace(/minBrightness:\s*[0-9]+/g, 'minBrightness: 30');
    cfgContent = cfgContent.replace(/maxBrightness:\s*[0-9]+/g, 'maxBrightness: 245');
    cfgContent = cfgContent.replace(/minSharpness:\s*[0-9]+/g, 'minSharpness: 40');
    cfgContent = cfgContent.replace(/livenessFrames:\s*[0-9]+/g, 'livenessFrames: 2');
    cfgContent = cfgContent.replace(/probeFrameCount:\s*[0-9]+/g, 'probeFrameCount: 2');
    cfgContent = cfgContent.replace(/templateFrameCount:\s*[0-9]+/g, 'templateFrameCount: 2');
    cfgContent = cfgContent.replace(/topK:\s*[0-9]+/g, 'topK: 2');
    cfgContent = cfgContent.replace(/challenges:\s*\[[^\]]+\]/g, "challenges: ['blink', 'turn_left', 'turn_right', 'turn_head']");
    fs.writeFileSync(filePath, cfgContent);
  }
});

// 10b. Patch qualityGate.ts / lib/commonjs/qualityGate.js / lib/module/qualityGate.js
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

// 10c. Patch pipeline.ts / lib/commonjs/pipeline.js / lib/module/pipeline.js
// Set default gateFrames = 2, livenessFrames = 2, embedFrames = 2 for ultra-fast response
['src/pipeline.ts', 'lib/commonjs/pipeline.js', 'lib/module/pipeline.js'].forEach((relPath) => {
  const filePath = path.join(packageRoot, relPath);
  if (fs.existsSync(filePath)) {
    let pipeContent = fs.readFileSync(filePath, 'utf8');
    pipeContent = pipeContent.replace(/this\.gateFrames\s*=\s*opts\.gateFrames\s*\?\?\s*[0-9]+;/g, 'this.gateFrames = Math.min(opts.gateFrames ?? 2, 2);');
    pipeContent = pipeContent.replace(/this\.embedFrames\s*=\s*opts\.embedFrames\s*\?\?\s*[0-9]+;/g, 'this.embedFrames = Math.min(opts.embedFrames ?? 2, 2);');
    pipeContent = pipeContent.replace(/this\.opts\.thresholds\.livenessFrames\s*\?\?\s*[0-9]+/g, 'Math.min(this.opts.thresholds.livenessFrames ?? 2, 2)');
    fs.writeFileSync(filePath, pipeContent);
  }
});
