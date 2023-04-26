import React, { useState, useRef, useEffect } from "react"
import { AnimationPhase, AnimationPhaseSet, humidAnimationPhases, humidifier } from "./demo-output-control-assets";
interface IProps {
  nodeValue: number;
}

function playThrough(total: number, f: any){
  for (let i = 0; i < total; i++){
    setTimeout(() => {
      f(i)
    }, i * 100)
  }
}


export const HumidiferAnimation: React.FC<IProps> = ({nodeValue}) => {
  const [currentPhase, setCurrentPhase] = useState<AnimationPhase>(humidAnimationPhases.stayOff);
  const [intervalId, setIntervalId] = useState(null);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const priorValue = useRef<number | undefined>();

  const disposeInterval = () => {
    setIntervalId(null)
  }

  useEffect(() => {
    const existingValue = priorValue.current;
    const rampUp = existingValue === 0 && nodeValue === 1;
    const rampDown = existingValue === 1 && nodeValue === 0;

    if (rampUp){
      setCurrentPhase(humidAnimationPhases.rampUp)
      playThrough(humidAnimationPhases.rampUp.frames.length, setCurrentFrameIndex)
      // const interval = setInterval(() => {
      //   setCurrentFrameIndex((currentFrameIndex) => currentFrameIndex + 1 % humidAnimationPhases.rampUp.frames.length);
      // }, 100);
      // setIntervalId(interval as any);
    }

    if (rampDown){
      setCurrentPhase(humidAnimationPhases.rampDown)
      playThrough(humidAnimationPhases.rampDown.frames.length, setCurrentFrameIndex)
    }

    priorValue.current = nodeValue;

    console.log("loop?", {nodeValue}, {existingValue}, {rampUp}, {rampDown})

    return disposeInterval();
  },[nodeValue])

  return (<>
    <img className="mist" src={currentPhase.frames[currentFrameIndex]} />
  </>)
}
