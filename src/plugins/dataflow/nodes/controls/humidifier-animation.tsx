import React, { useState, useRef, useEffect } from "react"
import { AnimationPhase, AnimationPhaseSet, humidAnimationPhases, humidifier } from "./demo-output-control-assets";
interface IProps {
  nodeValue: number;
  nodeId: number;
}

export const HumidiferAnimation: React.FC<IProps> = ({nodeValue, nodeId}) => {
  const [intervalId, setIntervalId] = useState(null);
  const [isLooping, setIsLooping] = useState(false);
  const [loopIndex, setLoopIndex] = useState(0);
  const priorValue = useRef<number | undefined>();

  const disposeInterval = () => {
    setIsLooping(false);
    if (intervalId){
      clearInterval(intervalId);
    }
    setIntervalId(null)
  }

  const setImageSrc = (src: string, nodeId: number) => {
    const imgs = document.querySelectorAll(`.mist-${nodeId}`) as any;
    imgs.forEach((img: any) => img.src = src);
  }

  const advanceFrame = (frames: string[]) => {
    console.log("|> advanceFrame", loopIndex)
    setLoopIndex(() => (loopIndex + 1) % frames.length);
    setImageSrc(frames[loopIndex], nodeId);
  }

  const startLooping = () => {

    if (intervalId === null && !isLooping) {
      setIsLooping(true);
      console.log("|> 🔁 startLooping!", intervalId)
      // const interval = setInterval(() => {
      //   advanceFrame(humidAnimationPhases.stayOn.frames);
      // }, 200);
      // setIntervalId(interval as any);
    }
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
      setTimeout(() => startLooping(),400);
    }

    if (shouldRampDown) {
      console.log("|> shouldRampDown")
      setImageSrc(humidAnimationPhases.rampDown.frames[0], nodeId);
      humidAnimationPhases.rampDown.frames.forEach((frame, index) => {
        setTimeout(() => {
          setImageSrc(frame, nodeId);
        }, index * 100);
      })
      disposeInterval();
    }

    if (shouldJustLoop) {
      console.log("|> loadInLoop")
      setImageSrc(humidAnimationPhases.stayOn.frames[0], nodeId);
      setTimeout(() => {
        if (!isLooping) startLooping();
      }, 400);
    }

    if (shouldJustRest) {
      console.log("|> loadInRest")
      setImageSrc(humidAnimationPhases.stayOff.frames[0], nodeId);
      disposeInterval();
    }

    priorValue.current = nodeValue;
    return disposeInterval();
  },[nodeValue])

  return (<>
    <img className={`mist-${nodeId} mist`} src={humidAnimationPhases.stayOff.frames[0]} />
  </>)
}
