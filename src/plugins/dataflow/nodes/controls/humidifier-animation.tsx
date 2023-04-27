import React, { useState, useRef, useEffect } from "react"
import { AnimationPhase, AnimationPhaseSet, humidAnimationPhases, humidifier } from "./demo-output-control-assets";
interface IProps {
  nodeValue: number;
  nodeId: number;
}

const rampUpCount = humidAnimationPhases.rampUp.frames.length;
const rampDownCount = humidAnimationPhases.rampDown.frames.length;
const stayOnCount = humidAnimationPhases.stayOn.frames.length;
const { rampDown, rampUp, stayOn, stayOff } = humidAnimationPhases;

console.log("| humidAnimationPhases", humidAnimationPhases)
export const HumidiferAnimation: React.FC<IProps> = ({nodeValue, nodeId}) => {
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

  const setImageSrc = (src: string, nodeId: number) => {
    const imgs = document.querySelector(`.mist-${nodeId}`) as HTMLImageElement; //handle more than one?
    console.log("|> setImageSrc", src);
    imgs.src = src;
  }

  useEffect(() => {
    const justLoaded = priorValue.current === undefined;
    const shouldRampUp = priorValue.current === 0 && nodeValue === 1;
    const shouldRampDown = priorValue.current === 1 && nodeValue === 0;
    const shouldJustLoop = justLoaded && nodeValue === 1;
    const shouldJustRest = justLoaded && nodeValue === 0;

    setCurrentFrameIndex(0);

    if (shouldRampUp) {
      console.log("\n|> shouldRampUp")
      setImageSrc(humidAnimationPhases.rampUp.frames[0], nodeId);
      humidAnimationPhases.rampUp.frames.forEach((frame, index) => {
        setTimeout(() => {
          setImageSrc(frame, nodeId);
        }, index * 100);
      })
    }

    if (shouldRampDown) {
      console.log("\n|> shouldRampDown")
      setImageSrc(humidAnimationPhases.rampDown.frames[0], nodeId);
      humidAnimationPhases.rampDown.frames.forEach((frame, index) => {
        setTimeout(() => {
          setImageSrc(frame, nodeId);
        }, index * 100);
      })
    }

    if (shouldJustLoop) {
      console.log("\n|> shouldJustLoop")
      setImageSrc(humidAnimationPhases.stayOn.frames[0], nodeId);
    }

    if (shouldJustRest) {
      console.log("\n|> shouldJustRest")
      setImageSrc(humidAnimationPhases.stayOff.frames[0], nodeId);
    }

    priorValue.current = nodeValue;
    return disposeInterval();
  },[nodeValue])

  return (<>
    <img className={`mist-${nodeId} mist`} src={humidAnimationPhases.stayOff.frames[0]} />
  </>)
}
