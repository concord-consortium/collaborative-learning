import React from "react";
import { Transform } from "../objects/drawing-object";

const duration = 1000; // ms

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export interface TransformableProps {
  type: string;
  transform: Transform;
  setAnimating: (animating: boolean) => void;
  children: React.ReactNode;
}

/** Renders an SVG group with an optional translate and scale transform.
 * When the transform changes, the group animates to the new transform.
 *
 * @param type - Type of object being rendered; used to generate a class attribute.
 * @param transform - The transform to apply to the group.
 * @param children - The children to render inside the group.
 */
export const Transformable: React.FC<TransformableProps> = ({ type, transform, setAnimating, children }) => {
  const prevTransform = React.useRef(transform);
  const [animated, setAnimated] = React.useState(transform);

  React.useEffect(() => {
    const prevTrans = prevTransform.current;
    const targetTrans = transform;
    const start = performance.now();
    let rafId: number;

    // console.log("prev transform", prevTrans);
    // console.log("new transform", targetTrans);

    function animate(now: number) {
      // Linear interpolation between the previous and target transforms.
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      setAnimated({
        corner: {
          x: lerp(prevTrans.corner.x, targetTrans.corner.x, t),
          y: lerp(prevTrans.corner.y, targetTrans.corner.y, t)
        },
        position: {
          x: lerp(prevTrans.position.x, targetTrans.position.x, t),
          y: lerp(prevTrans.position.y, targetTrans.position.y, t)
        },
        center: {
          x: lerp(prevTrans.center.x, targetTrans.center.x, t),
          y: lerp(prevTrans.center.y, targetTrans.center.y, t)},
        scale: {
          x: lerp(prevTrans.scale.x, targetTrans.scale.x, t),
          y: lerp(prevTrans.scale.y, targetTrans.scale.y, t)},
        rotation:
          lerp(prevTrans.rotation, targetTrans.rotation, t)
      });
      if (t < 1) {
        rafId = requestAnimationFrame(animate);
      } else {
        setAnimating(false);
        setAnimated(targetTrans);
        prevTransform.current = targetTrans;
      }
    }

    // Only animate flips and rotations
    if (prevTrans.scale.x !== targetTrans.scale.x
        || prevTrans.scale.y !== targetTrans.scale.y
        || prevTrans.rotation !== targetTrans.rotation) {
      setAnimating(true);
      rafId = requestAnimationFrame(animate);
    } else {
      setAnimating(false);
      setAnimated(targetTrans);
      prevTransform.current = targetTrans;
    }
    return () => {
      cancelAnimationFrame(rafId);
      setAnimating(false);
    };
  }, [transform, setAnimating]);

  // Series of transforms:
  // 1. Translate to the bottom-right corner of the bounding box (rotation center)
  // 2. Apply rotation
  // 3. Translate to the "center" point of the object
  // 4. Apply reflections with scale

  const toPosition = {
    x: animated.position.x-animated.corner.x+animated.center.x,
    y: animated.position.y-animated.corner.y+animated.center.y };

  return (
    <g
      className={`transformable transformable-${type}`}
      transform={`translate(${animated.corner.x},${animated.corner.y}) rotate(${animated.rotation}) `
       + `translate(${toPosition.x},${toPosition.y}) scale(${animated.scale.x},${animated.scale.y})`}
    >
      {children}
    </g>
  );
};
