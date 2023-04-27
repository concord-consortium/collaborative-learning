import React, { useState, useRef, useEffect } from "react"
import { AnimationPhase, AnimationPhaseSet, humidAnimationPhases, humidifier } from "./demo-output-control-assets";
interface IProps {
  nodeValue: number;
  nodeId: number;
}

export const HumidiferAnimation: React.FC<IProps> = ({nodeValue, nodeId}) => {
  const priorValue = useRef<number | undefined>();
  const canLoopRef = useRef(false);

  const setImageSrc = (src: string, nodeId: number) => {
    const imgs = document.querySelectorAll(`.mist-${nodeId}`) as any;
    imgs.forEach((img: any) => img.src = src);
  }

  const startLooping = (id: number) => {
    if (canLoopRef.current === true){
      console.log("🔁 we can and should loop animation on node", id);
    }
  }

  const stopLooping = (id: number) => {
    canLoopRef.current = false;
    console.log("🔴 we should stop looping animation on node", id);
  }

  useEffect(() => {
    const justLoaded = priorValue.current === undefined;
    const shouldRampUp = priorValue.current === 0 && nodeValue === 1;
    const shouldRampDown = priorValue.current === 1 && nodeValue === 0;
    const shouldJustLoop = justLoaded && nodeValue === 1;
    const shouldJustRest = justLoaded && nodeValue === 0;

    if (shouldRampUp) {
      //console.log("|> shouldRampUp")
      canLoopRef.current = true;
      setImageSrc(humidAnimationPhases.rampUp.frames[0], nodeId);
      humidAnimationPhases.rampUp.frames.forEach((frame, index) => {
        setTimeout(() => {
          setImageSrc(frame, nodeId);
        }, index * 100);
      })
    }

    if (shouldRampDown) {
      canLoopRef.current = false;
      //console.log("|> shouldRampDown")
      setImageSrc(humidAnimationPhases.rampDown.frames[0], nodeId);
      humidAnimationPhases.rampDown.frames.forEach((frame, index) => {
        setTimeout(() => {
          setImageSrc(frame, nodeId);
        }, index * 100);
      })
    }

    if (shouldJustLoop) {
      canLoopRef.current = true;
      //console.log("|> loadInLoop")
      setImageSrc(humidAnimationPhases.stayOn.frames[0], nodeId);
    }

    if (shouldJustRest) {
      canLoopRef.current = false;
      //console.log("|> loadInRest")
      setImageSrc(humidAnimationPhases.stayOff.frames[0], nodeId);
    }

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
