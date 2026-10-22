import React, { useEffect, useState } from "react";
import { kServoMaxAngle, kServoMinAngle } from "../../utilities/servo-angle";
import { Sequence, TargetAnimator } from "./animator";
import servoArm from "../../../assets/servo-arm.png";
import servoBody from "../../../assets/servo-body.png";

// How far the arm moves per step, and how often it steps. Together these give about 125 deg/s,
// so the full sweep takes around 1.4s -- roughly the speed of a hobby servo. The arm therefore
// lands on even degrees; at this size that is about a pixel, and the node still reads out the
// true value.
const kDegreesPerStep = 2;
const kStepPeriodMs = 16;

// TargetAnimator steps one frame at a time towards its target, so the frames here are the angles
// the arm can take rather than images. Sequence does not care what a frame is.
const servoAngles = new Sequence(
  Array.from({ length: (kServoMaxAngle - kServoMinAngle) / kDegreesPerStep + 1 },
             (_, i) => kServoMinAngle + i * kDegreesPerStep)
);

/** The fraction of the sweep `angle` sits at, which is what TargetAnimator wants. */
function sweepFraction(angle: number) {
  return (angle - kServoMinAngle) / (kServoMaxAngle - kServoMinAngle);
}

interface IProps {
  angle: number;
}

export const ServoAnimation: React.FC<IProps> = ({ angle }) => {
  const [shownAngle, setShownAngle] = useState(angle);
  const [animator] = useState<TargetAnimator>(() => new TargetAnimator(setShownAngle, kStepPeriodMs));

  useEffect(() => {
    animator.playToPercent(servoAngles, sweepFraction(angle));
  }, [animator, angle]);

  // Stop stepping when the node goes away.
  useEffect(() => animator.stopInterval, [animator]);

  return (
    <div className="servo-assembly">
      <img className="servo-part body" src={servoBody} alt="" />
      {/* The body lies on its side with the hub at its right, so the angle is the rotation: 0
          points up, 90 to the right, 180 down, sweeping the space beside the body. The arm's ink
          runs only upwards from its pivot, which is why an unrotated arm is the one pointing up. */}
      <img
        className="servo-part arm"
        src={servoArm}
        style={{ transform: `rotate(${shownAngle}deg)` }}
        alt=""
      />
    </div>
  );
};
