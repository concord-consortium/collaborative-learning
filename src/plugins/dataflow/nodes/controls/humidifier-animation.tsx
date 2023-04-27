import React, { useState, useRef, useEffect } from "react"
import { AnimationPhase, AnimationPhaseSet, humidAnimationPhases, humidifier } from "./demo-output-control-assets";
interface IProps {
  nodeValue: number;
  nodeId: number;
}

export const HumidiferAnimation: React.FC<IProps> = ({nodeValue, nodeId}) => {
  const priorValue = useRef<number | undefined>();

  const setImageSrc = (src: string, nodeId: number) => {
    const imgs = document.querySelectorAll(`.mist-${nodeId}`) as any;
    imgs.forEach((img: any) => img.src = src);
  }

  const advanceLoop = (i: number) => {
    if (nodeValue !== 1) return;
    const nextFrame = humidAnimationPhases.stayOn.frames[i];
    setImageSrc(nextFrame, nodeId);
    setTimeout(() => {
      if (i < humidAnimationPhases.stayOn.frames.length - 1) {
        advanceLoop(i + 1);
      } else {
        advanceLoop(0);
      }
    }, 100);
  }

  useEffect(() => {
    const justLoaded = priorValue.current === undefined;
    const shouldRampUp = priorValue.current === 0 && nodeValue === 1;
    const shouldRampDown = priorValue.current === 1 && nodeValue === 0;
    const shouldJustLoop = justLoaded && nodeValue === 1;
    const shouldJustRest = justLoaded && nodeValue === 0;

    if (shouldRampUp) {
      console.log("|> shouldRampUp")
      setImageSrc(humidAnimationPhases.rampUp.frames[0], nodeId);
      humidAnimationPhases.rampUp.frames.forEach((frame, index) => {
        setTimeout(() => {
          setImageSrc(frame, nodeId);
        }, index * 100);
      })
      advanceLoop(0);
    }

    if (shouldRampDown) {
      console.log("|> shouldRampDown")
      setImageSrc(humidAnimationPhases.rampDown.frames[0], nodeId);
      humidAnimationPhases.rampDown.frames.forEach((frame, index) => {
        setTimeout(() => {
          setImageSrc(frame, nodeId);
        }, index * 100);
      })
    }

    if (shouldJustLoop) {
      console.log("|> loadInLoop")
      setImageSrc(humidAnimationPhases.stayOn.frames[0], nodeId);
      advanceLoop(0);
    }

    if (shouldJustRest) {
      console.log("|> loadInRest")
      setImageSrc(humidAnimationPhases.stayOff.frames[0], nodeId);
    }

    priorValue.current = nodeValue;
  },[nodeValue])

  return (<>
    <img className={`mist-${nodeId} mist`} src={humidAnimationPhases.stayOff.frames[0]} />
  </>)
}
