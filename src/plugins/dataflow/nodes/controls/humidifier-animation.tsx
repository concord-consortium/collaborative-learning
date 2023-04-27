import React, { useState, useRef, useEffect } from "react"
import { AnimationPhase, AnimationPhaseSet, humidAnimationPhases, humidifier } from "./demo-output-control-assets";
interface IProps {
  nodeValue: number;
  nodeId: number;
}

// TODO in morning,this now works
// 1 first add a timeout before the animation starts so it looks nice (15)
// 2 THEN, make it an map and check for the id sort of thing (45)
// where it is a registry of all the humiidifier animations
// 3 then duplicate the whole thing for the fan (30)
// 4 merge it backto your branch (5)
var humidAnimationInterval: any = null;


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

  const startLooping = (id: number) => {
    if (humidAnimationInterval === null){
      humidAnimationInterval = setInterval(() => {
        console.log("🔁 loop animation on node", id, humidAnimationInterval);
        advanceFrame(humidAnimationPhases.stayOn.frames);
      }, 100);
    }
  }

  const stopLooping = (id: number) => {
    console.log("🔴 we should stop looping animation on node", id);
    console.log("interval BEFORE KILL: ", humidAnimationInterval)
    clearInterval(humidAnimationInterval);
    humidAnimationInterval = null;
    console.log("interval AFTER KILL: ", humidAnimationInterval)
  }

  useEffect(() => {
    const justLoaded = priorValue.current === undefined;
    const shouldRampUp = priorValue.current === 0 && nodeValue === 1;
    const shouldRampDown = priorValue.current === 1 && nodeValue === 0;
    const shouldJustLoop = justLoaded && nodeValue === 1;
    const shouldJustRest = justLoaded && nodeValue === 0;

    console.log("interval: ", humidAnimationInterval)
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

    if (shouldJustLoop) {
      setImageSrc(humidAnimationPhases.stayOn.frames[0], nodeId);
    }

    if (shouldJustRest) {
      setImageSrc(humidAnimationPhases.stayOff.frames[0], nodeId);
    }

    if (shouldJustLoop || shouldRampUp){
      startLooping(nodeId);
    } else {
      stopLooping(nodeId)
    }
    priorValue.current = nodeValue;
    console.log("| humidInterval: ", humidAnimationInterval)
  },[nodeValue])

  return (<>
    <img className={`mist-${nodeId} mist`} src={humidAnimationPhases.stayOff.frames[0]} />
  </>)
}
