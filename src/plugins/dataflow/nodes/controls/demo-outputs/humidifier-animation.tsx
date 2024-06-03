import React, { useRef, useEffect, useState } from "react";
import { humidEndingFrames, humidLoopFrames, humidOffFrames, humidStartingFrames } from "./demo-output-control-assets";
import { StateAnimator, StateSequence } from "./animator";

const stayOffSequence = new StateSequence(humidOffFrames);

const stayOnSequence = new StateSequence(humidLoopFrames);
stayOnSequence.nextForward = stayOnSequence; // Loop

const rampUpSequence = new StateSequence(humidStartingFrames);
rampUpSequence.nextForward = stayOnSequence; // go to stayOn

const rampDownSequence = new StateSequence(humidEndingFrames);

interface IProps {
  nodeValue: number;
}

export const HumidifierAnimation: React.FC<IProps> = ({nodeValue}) => {
  const priorValueRef = useRef<number | undefined>();

  const [imageSrc, setImageSrc] = useState(humidOffFrames[0]);
  const [animator] = useState<StateAnimator>(() => new StateAnimator(setImageSrc, 100));

  // Remove the animation when the component is disposed
  useEffect(() => {
    return animator.stopInterval;
  }, [animator]);

  useEffect(() => {
    const priorValue = priorValueRef.current;
    const justLoaded = priorValue === undefined;

    if (justLoaded && nodeValue === 1) {
      animator.play(stayOnSequence);
    }

    if (justLoaded && nodeValue === 0) {
      animator.play(stayOffSequence);
    }

    if (priorValue === 0 && nodeValue === 1) {
      animator.play(rampUpSequence);
    }

    if (priorValue === 1 && nodeValue === 0) {
      animator.play(rampDownSequence);
    }

    priorValueRef.current = nodeValue;
  },[animator, nodeValue, setImageSrc ]);

  return (
    <img className={`mist`} src={imageSrc} />
  );
};
