import React, { useState, useRef, useEffect } from "react"
import { AnimationPhase, AnimationPhaseSet, humidAnimationPhases, humidifier } from "./demo-output-control-assets";
interface IProps {
  nodeValue: number;
  nodeId: number;
}

let humidAnimations = new Map<number, any>();

function registerAnimation(nodeId: number, interval: any) {
  humidAnimations.set(nodeId, interval);
}

function removeAnimation(nodeId: number) {
  clearInterval(humidAnimations.get(nodeId));
  humidAnimations.delete(nodeId);
}

function nodeHasAnimation(nodeId: number) {
  return humidAnimations.has(nodeId);
}

export const HumidiferAnimation: React.FC<IProps> = ({nodeValue, nodeId}) => {
  const priorValue = useRef<number | undefined>();

  const advanceFrame = (frames: string[]) => {
    const currentFrame = frames[0];
    const nextFrame = frames[1];
    frames.shift();
    frames.push(currentFrame);
    setImageSrc(nextFrame, nodeId);
  }

  const setImageSrc = (src: string, nodeId: number) => {
    const imgs = document.querySelectorAll(`.mist-${nodeId}`) as any;
    imgs.forEach((img: any) => img.src = src);
  }

  const startLooping = (nodeId: number) => {
    if (!nodeHasAnimation(nodeId)){
      const interval = setInterval(() => {
        advanceFrame(humidAnimationPhases.stayOn.frames);
      }, 100);
      registerAnimation(nodeId, interval);
    }
  }

  const stopLooping = (nodeId: number) => {
    if (nodeHasAnimation(nodeId)){
      removeAnimation(nodeId);
    }
  }

  useEffect(() => {
    const justLoaded = priorValue.current === undefined;
    const shouldRampUp = priorValue.current === 0 && nodeValue === 1;
    const shouldRampDown = priorValue.current === 1 && nodeValue === 0;
    const shouldJustLoop = justLoaded && nodeValue === 1;
    const shouldJustRest = justLoaded && nodeValue === 0;

    if (shouldRampUp) {
      setImageSrc(humidAnimationPhases.rampUp.frames[0], nodeId);
      humidAnimationPhases.rampUp.frames.forEach((frame, index) => {
        setTimeout(() => {
          setImageSrc(frame, nodeId);
        }, index * 100);
      })
    }

    if (shouldRampDown) {
      setImageSrc(humidAnimationPhases.rampDown.frames[0], nodeId);
      humidAnimationPhases.rampDown.frames.forEach((frame, index) => {
        setTimeout(() => {
          setImageSrc(frame, nodeId);
        }, index * 100);
      })
    }

    if (shouldJustLoop) setImageSrc(humidAnimationPhases.stayOn.frames[0], nodeId);
    if (shouldJustRest) setImageSrc(humidAnimationPhases.stayOff.frames[0], nodeId);


    if (shouldJustLoop || shouldRampUp){
      startLooping(nodeId);
    } else {
      stopLooping(nodeId)
    }
    priorValue.current = nodeValue;
  },[nodeValue])

  return (<>
    <img className={`mist-${nodeId} mist`} src={humidAnimationPhases.stayOff.frames[0]} />
  </>)
}
