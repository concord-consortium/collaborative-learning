import React, { useEffect, useState } from "react";
import { grabberFrames } from "./demo-output-control-assets";
import { Sequence, TargetAnimator } from "./animator";

const grabberSequence = new Sequence(grabberFrames);

interface IProps {
  nodeValue: number;
}

export const GrabberAnimation: React.FC<IProps> = ({nodeValue}) => {
  const [imageSrc, setImageSrc] = useState(grabberSequence.getFrame(nodeValue));
  const [animator] = useState<TargetAnimator>(() => new TargetAnimator(setImageSrc, 50));

  useEffect(() => {
    animator.playToPercent(grabberSequence, nodeValue);
  }, [animator, nodeValue]);

  // Remove the animation when the component is disposed
  useEffect(() => {
    return animator.stopInterval;
  }, [animator]);

  return (
    <img className="demo-output-image grabber-image" src={imageSrc} />
  );
};
