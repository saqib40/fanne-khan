import React from 'react';
import {Composition, Folder} from 'remotion';
import {fixtures} from './fixtures';
import {MotionDesign} from './remotion/MotionDesign';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Generated"
        component={MotionDesign}
        durationInFrames={fixtures.KineticTitle.durationInFrames}
        fps={fixtures.KineticTitle.fps}
        width={fixtures.KineticTitle.width}
        height={fixtures.KineticTitle.height}
        defaultProps={{spec: fixtures.KineticTitle}}
        calculateMetadata={({props}) => ({
          durationInFrames: props.spec.durationInFrames,
          fps: props.spec.fps,
          width: props.spec.width,
          height: props.spec.height,
        })}
      />
      <Folder name="Day-1-Motion-Studies">
        {Object.entries(fixtures).map(([id, spec]) => (
          <Composition
            key={id}
            id={id}
            component={MotionDesign}
            durationInFrames={spec.durationInFrames}
            fps={spec.fps}
            width={spec.width}
            height={spec.height}
            defaultProps={{spec}}
          />
        ))}
      </Folder>
    </>
  );
};
