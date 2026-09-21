import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource-variable/fraunces';

import React from 'react';
import {ThreeCanvas} from '@remotion/three';
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type {
  MotionSegment,
  MotionSpec,
  TextLine,
} from '../schema/motion-spec';

const fontFamilies = {
  inter: '"Inter Variable", sans-serif',
  'space-grotesk': '"Space Grotesk Variable", sans-serif',
  'jetbrains-mono': '"JetBrains Mono Variable", monospace',
  fraunces: '"Fraunces Variable", serif',
} as const;

const roleSizes: Record<TextLine['role'], number> = {
  eyebrow: 24,
  title: 112,
  subtitle: 38,
  body: 34,
  metric: 210,
};

const getLineStyle = ({
  line,
  spec,
  scale,
}: {
  line: TextLine;
  spec: MotionSpec;
  scale: number;
}): React.CSSProperties => {
  const isDisplay = line.role === 'title' || line.role === 'metric';
  const uppercase =
    line.role === 'eyebrow' ||
    (line.role === 'title' && spec.typography.uppercaseTitles);

  return {
    color: line.emphasis ? spec.palette.accent : spec.palette.foreground,
    fontFamily: fontFamilies[
      isDisplay ? spec.typography.display : spec.typography.body
    ],
    fontSize: roleSizes[line.role] * scale,
    fontVariationSettings: line.emphasis ? '"wght" 760' : '"wght" 560',
    letterSpacing:
      line.role === 'eyebrow'
        ? '0.16em'
        : `${spec.typography.tracking}em`,
    lineHeight:
      line.role === 'metric' ? 0.86 : line.role === 'title' ? 0.94 : 1.18,
    textTransform: uppercase ? 'uppercase' : 'none',
    textWrap: 'balance',
  };
};

const entranceStyle = ({
  entrance,
  frame,
  delay,
  fps,
}: {
  entrance: MotionSegment['entrance'];
  frame: number;
  delay: number;
  fps: number;
}): React.CSSProperties => {
  const localFrame = frame - delay;
  const progress = spring({
    frame: localFrame,
    fps,
    config: {damping: 18, mass: 0.75, stiffness: 120},
    durationInFrames: 24,
  });

  if (entrance === 'fade') {
    return {opacity: progress};
  }

  if (entrance === 'scale') {
    return {
      opacity: progress,
      transform: `scale(${interpolate(progress, [0, 1], [0.72, 1])})`,
    };
  }

  if (entrance === 'wipe') {
    return {
      opacity: progress,
      clipPath: `inset(0 ${100 - progress * 100}% 0 0)`,
      transform: `translateX(${interpolate(progress, [0, 1], [-30, 0])}px)`,
    };
  }

  return {
    opacity: progress,
    transform: `translateY(${interpolate(progress, [0, 1], [70, 0])}px)`,
  };
};

const exitStyle = ({
  exit,
  frame,
  durationInFrames,
}: {
  exit: MotionSegment['exit'];
  frame: number;
  durationInFrames: number;
}): React.CSSProperties => {
  if (exit === 'cut') {
    return {};
  }

  const progress = interpolate(
    frame,
    [durationInFrames - 18, durationInFrames - 1],
    [0, 1],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.ease)},
  );

  return {
    opacity: 1 - progress,
    transform: exit === 'shrink' ? `scale(${1 - progress * 0.08})` : undefined,
  };
};

const TextSegment: React.FC<{
  segment: MotionSegment;
  spec: MotionSpec;
}> = ({segment, spec}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const scale = Math.min(width, height) / 1080;
  const isCenter = segment.layout === 'center';
  const isSplit = segment.layout === 'split';
  const exit = exitStyle({
    exit: segment.exit,
    frame,
    durationInFrames: segment.durationInFrames,
  });

  return (
    <AbsoluteFill
      style={{
        alignItems: isCenter ? 'center' : 'flex-start',
        justifyContent: 'center',
        padding: `${Math.max(64, height * 0.08)}px ${Math.max(64, width * 0.08)}px`,
        textAlign: isCenter ? 'center' : 'left',
        ...exit,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16 * scale,
          width: isSplit ? '54%' : isCenter ? '86%' : '76%',
          marginRight: isSplit ? 'auto' : undefined,
        }}
      >
        {segment.lines.map((line, index) => {
          const delay =
            segment.entrance === 'stagger' ? 8 + index * 7 : 8 + index * 2;
          return (
            <div
              key={`${segment.id}-${index}`}
              style={{
                ...getLineStyle({line, spec, scale}),
                ...entranceStyle({
                  entrance: segment.entrance,
                  frame,
                  delay,
                  fps,
                }),
              }}
            >
              {line.text}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const GridAccent: React.FC<{color: string; intensity: number}> = ({
  color,
  intensity,
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        opacity: intensity * 0.22,
        backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`,
        backgroundSize: '72px 72px',
        backgroundPosition: `${frame * 0.35}px ${frame * 0.2}px`,
        maskImage: 'radial-gradient(circle at center, black, transparent 72%)',
      }}
    />
  );
};

const ThreeAccent: React.FC<{
  spec: MotionSpec;
}> = ({spec}) => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  const rotation = frame / fps;
  const {type, intensity} = spec.accent;
  const particles = Array.from({length: 16}, (_, index) => ({
    x: Math.sin(index * 31.7) * 4.8,
    y: Math.cos(index * 17.3) * 2.7,
    z: Math.sin(index * 9.1) * 2,
    size: 0.025 + (index % 4) * 0.012,
  }));

  return (
    <AbsoluteFill style={{opacity: 0.18 + intensity * 0.44}}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{fov: 42, position: [0, 0, 8]}}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 4, 5]} intensity={2} />

        {type === 'orbit' ? (
          <mesh
            position={[2.7, 0.2, -0.5]}
            rotation={[rotation * 0.4, rotation * 0.65, rotation * 0.2]}
          >
            <torusGeometry args={[2.1, 0.055, 16, 120]} />
            <meshStandardMaterial
              color={spec.palette.accent}
              emissive={spec.palette.accent}
              emissiveIntensity={0.7}
              roughness={0.24}
            />
          </mesh>
        ) : null}

        {type === 'glass' ? (
          <mesh
            position={[2.8, 0, 0]}
            rotation={[rotation * 0.22, rotation * 0.35, 0.3]}
          >
            <icosahedronGeometry args={[2.15, 1]} />
            <meshPhysicalMaterial
              color={spec.palette.accent}
              roughness={0.12}
              metalness={0.1}
              transmission={0.5}
              transparent
              opacity={0.72}
            />
          </mesh>
        ) : null}

        {type === 'particles'
          ? particles.map((particle, index) => (
              <mesh
                key={index}
                position={[
                  particle.x,
                  particle.y + Math.sin(rotation + index) * 0.15,
                  particle.z,
                ]}
              >
                <sphereGeometry args={[particle.size, 10, 10]} />
                <meshBasicMaterial color={spec.palette.accent} />
              </mesh>
            ))
          : null}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

const AccentLayer: React.FC<{spec: MotionSpec}> = ({spec}) => {
  if (spec.accent.type === 'none') {
    return null;
  }
  if (spec.accent.type === 'grid') {
    return (
      <GridAccent
        color={spec.palette.accent}
        intensity={spec.accent.intensity}
      />
    );
  }
  return <ThreeAccent spec={spec} />;
};

export const MotionDesign: React.FC<{spec: MotionSpec}> = ({spec}) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: spec.palette.background,
        overflow: 'hidden',
      }}
    >
      <AccentLayer spec={spec} />
      {spec.segments.map((segment) => (
        <Sequence
          key={segment.id}
          from={segment.startFrame}
          durationInFrames={segment.durationInFrames}
          premountFor={30}
        >
          <TextSegment segment={segment} spec={spec} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
