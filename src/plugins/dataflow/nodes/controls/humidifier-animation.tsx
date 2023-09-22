import React, { useCallback, useRef, useEffect } from "react";
import { humidAnimationPhases } from "./demo-output-control-assets";
import { NodeEditor } from "rete";
interface IProps {
  nodeValue: number;
  nodeId: number;
  editor: NodeEditor;
}

const humidAnimations = new Map<number, any>();

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

export const HumidiferAnimation: React.FC<IProps> = ({nodeValue, nodeId, editor}) => {
  const priorValue = useRef<number | undefined>();

  editor.on("noderemoved", (node: any) => {
    if (node.id === nodeId) {
      removeAnimation(nodeId);
    }
  });

  const setImageSrc = useCallback((src: string) => {
    const imgs = document.querySelectorAll(`.mist-${nodeId}`) as any;
    imgs.forEach((img: any) => img.src = src);
  }, [nodeId]);

  const advanceFrame = useCallback((frames: string[]) => {
    const currentFrame = frames[0];
    const nextFrame = frames[1];
    frames.shift();
    frames.push(currentFrame);
    setImageSrc(nextFrame);
  }, [setImageSrc]);

  const startLooping = useCallback(() => {
    if (!nodeHasAnimation(nodeId)){
      const interval = setInterval(() => {
        advanceFrame(humidAnimationPhases.stayOn.frames);
      }, 100);
      registerAnimation(nodeId, interval);
    }
  }, [advanceFrame, nodeId]);

  const stopLooping = useCallback(() => {
    if (nodeHasAnimation(nodeId)){
      removeAnimation(nodeId);
    }
  }, [nodeId]);

  useEffect(() => {
    const justLoaded = priorValue.current === undefined;
    const shouldRampUp = priorValue.current === 0 && nodeValue === 1;
    const shouldRampDown = priorValue.current === 1 && nodeValue === 0;
    const shouldJustLoop = justLoaded && nodeValue === 1;
    const shouldJustRest = justLoaded && nodeValue === 0;

    if (shouldRampUp) {
      setImageSrc(humidAnimationPhases.rampUp.frames[0]);
      humidAnimationPhases.rampUp.frames.forEach((frame, index) => {
        setTimeout(() => {
          setImageSrc(frame);
        }, index * 100);
      });
    }

    if (shouldRampDown) {
      setImageSrc(humidAnimationPhases.rampDown.frames[0]);
      humidAnimationPhases.rampDown.frames.forEach((frame, index) => {
        setTimeout(() => {
          setImageSrc(frame);
        }, index * 100);
      });
    }

    if (shouldJustLoop) setImageSrc(humidAnimationPhases.stayOn.frames[0]);
    if (shouldJustRest) setImageSrc(humidAnimationPhases.stayOff.frames[0]);

    if (shouldJustLoop || shouldRampUp){
      startLooping();
    } else {
      stopLooping();
    }

    priorValue.current = nodeValue;
  }, [nodeValue, setImageSrc, startLooping, stopLooping]);

  return (
    <img className={`mist-${nodeId} mist`} src={humidAnimationPhases.stayOff.frames[0]} />
  );
};
