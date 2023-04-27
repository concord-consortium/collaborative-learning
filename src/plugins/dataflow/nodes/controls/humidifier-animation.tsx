import React, { useState, useRef, useEffect } from "react"
import { AnimationPhase, AnimationPhaseSet, humidAnimationPhases, humidifier } from "./demo-output-control-assets";
interface IProps {
  nodeValue: number;
}

const rampUpCount = humidAnimationPhases.rampUp.frames.length;
const rampDownCount = humidAnimationPhases.rampDown.frames.length;
const stayOnCount = humidAnimationPhases.stayOn.frames.length;
const { rampDown, rampUp, stayOn, stayOff } = humidAnimationPhases;

console.log("| humidAnimationPhases", humidAnimationPhases)
export const HumidiferAnimation: React.FC<IProps> = ({nodeValue}) => {
  const [currentPhase, setCurrentPhase] = useState<AnimationPhase | null>(null);
  const [intervalId, setIntervalId] = useState(null);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const priorValue = useRef<number | undefined>();

  const niceLog = (msg: string) => {
    console.log(msg, `\n    | prior: ${priorValue.current} | value: ${nodeValue} | phase: ${currentPhase?.name}[${currentFrameIndex}] | interval: ${intervalId}`)
  }

  const disposeInterval = () => {
    setIntervalId(null)
  }

  useEffect(() => {
    const justLoaded = priorValue.current === undefined;
    const shouldRampUp = priorValue.current === 0 && nodeValue === 1;
    const shouldRampDown = priorValue.current === 1 && nodeValue === 0;
    const shouldJustLoop = justLoaded && nodeValue === 1;
    const shouldJustRest = justLoaded && nodeValue === 0;

    setCurrentFrameIndex(0);

    if (shouldRampUp) {
      console.log("|> shouldRampUp")
    }

    if (shouldRampDown) {
      console.log("|> shouldRampDown")
    }

    if (shouldJustLoop) {
      console.log("|> shouldJustLoop")
    }

    if (shouldJustRest) {
      console.log("|> shouldJustRest")
    }

    priorValue.current = nodeValue;
    return disposeInterval();
  },[nodeValue])

  return (<>
    <img className="mist" src={humidAnimationPhases.stayOn.frames[1]} />
  </>)
}
