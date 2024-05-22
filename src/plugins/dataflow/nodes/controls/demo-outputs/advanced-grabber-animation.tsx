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
  const [cordImageSrc, setCordImageSrc] = useState(cordSequence.getFrame(percentTilt));
  const [animator] = useState<TargetAnimator>(() => new TargetAnimator(setImageSrc, 50));
  const [cordAnimator] = useState<TargetAnimator>(() => new TargetAnimator(setCordImageSrc, 30));

  useEffect(() => {
    animator.playToPercent(grabberSequence, nodeValue);
    cordAnimator.playToPercent(cordSequence, percentTilt);
  }, [animator, nodeValue, cordAnimator, percentTilt]);

  // Remove the animation when the component is disposed
  useEffect(() => {
    return () => {
      animator.stopInterval();
      cordAnimator.stopInterval();
    };
  }, [animator, cordAnimator]);

  // Hack: We are calculating the grabber rotation based on the cord
  // animation. The cord frames are being animated and we need to sync
  // the rotation with these cord frames. The animation library doesn't
  // provide away to animate two things at the same time. We hack around
  // this by using the current cord frame index to get a value from
  // 0 to 1 and then convert that to degrees.
  const maxCordFrame = grabberCordFrames.length - 1;
  const cordIndex = cordAnimator.currentFrame ?? (maxCordFrame / 2);
  const tiltFromCordAnimation = cordIndex / maxCordFrame;
  const grabberDegrees = (tiltFromCordAnimation - .5) * -50;
  const grabberRotateStyle =  { transform: `rotate(${grabberDegrees}deg)`};

  return (
    <>
      <img
        src={ cordImageSrc }
        className="demo-output-image grabber-cord-image"
      />

      <img className="demo-output-image advanced-grabber-image"
        src={imageSrc} style={grabberRotateStyle}
      />
    </>
  );
};
