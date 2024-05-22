import React, { useEffect, useState } from "react";
import { grabberCordFrames, advancedGrabberFrames } from "./demo-output-control-assets";
import { Sequence, TargetAnimator } from "./animator";

const grabberSequence = new Sequence(advancedGrabberFrames);
const cordSequence = new Sequence(grabberCordFrames);

interface IProps {
  nodeValue: number;
  percentTilt: number;
}

export const AdvancedGrabberAnimation: React.FC<IProps> = ({nodeValue, percentTilt}) => {

  const [imageSrc, setImageSrc] = useState(grabberSequence.getFrame(nodeValue));
  const [animator] = useState<TargetAnimator>(() => new TargetAnimator(setImageSrc, 50));

  const grabberDegrees = (percentTilt - .5) * -50;
  const grabberRotateStyle =  { transform: `rotate(${grabberDegrees}deg)`};

  const cordFrameSrc = cordSequence.getFrame(percentTilt);

  useEffect(() => {
    animator.playToPercent(grabberSequence, nodeValue);
  }, [animator, nodeValue]);

  // Remove the animation when the component is disposed
  useEffect(() => {
    return animator.stopInterval;
  }, [animator]);

  return (
    <>
      <img
        src={ cordFrameSrc }
        className="demo-output-image grabber-cord-image"
      />

      <img className="demo-output-image advanced-grabber-image"
        src={imageSrc} style={grabberRotateStyle}
      />
    </>
  );
};
