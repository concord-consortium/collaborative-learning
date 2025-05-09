import React from "react";
import { Point } from "../model/drawing-basic-types";
import { Transform } from "../objects/drawing-object";

const duration = 500; // ms

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export interface TransformableProps {
  position: Point;
  transform: Transform;
  children: React.ReactNode;
}

/** Renders an SVG group with an optional translate and scale transform.
 * When the transform changes, the group animates to the new transform.
 *
 * @param transform - The transform to apply to the group.
 * @param children - The children to render inside the group.
 */
export const Transformable: React.FC<TransformableProps> = ({ position, transform, children }) => {
  const prevTransform = React.useRef(transform);
  const prevPosition = React.useRef(position);
  const [animated, setAnimated] = React.useState(transform);

  React.useEffect(() => {
    const prevTrans = prevTransform.current;
    const prevPos = prevPosition.current;
    const targetTrans = transform;
    const targetPos = position;
    const start = performance.now();
    let rafId: number;

    function animate(now: number) {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      setAnimated({
        tx: lerp(prevTrans.tx + prevPos.x, targetTrans.tx + targetPos.x, t),
        ty: lerp(prevTrans.ty + prevPos.y, targetTrans.ty + targetPos.y, t),
        sx: lerp(prevTrans.sx, targetTrans.sx, t),
        sy: lerp(prevTrans.sy, targetTrans.sy, t)
      });
      if (t < 1) {
        rafId = requestAnimationFrame(animate);
      } else {
        setAnimated({
          tx: targetTrans.tx + targetPos.x,
          ty: targetTrans.ty + targetPos.y,
          sx: targetTrans.sx,
          sy: targetTrans.sy
        });
        prevTransform.current = targetTrans;
        prevPosition.current = targetPos;
        console.log("animation complete");
      }
    }

    // Only animate flips
    if (prevTrans.sx !== targetTrans.sx || prevTrans.sy !== targetTrans.sy) {
      console.log("starting animation", prevTrans, targetTrans);
      rafId = requestAnimationFrame(animate);
    } else {
      console.log("no animation", prevTrans, targetTrans);
      setAnimated({
        tx: targetTrans.tx + targetPos.x,
        ty: targetTrans.ty + targetPos.y,
        sx: targetTrans.sx,
        sy: targetTrans.sy
      });
      prevTransform.current = targetTrans;
      prevPosition.current = targetPos;
    }
    return () => cancelAnimationFrame(rafId);
  }, [transform, position]);

  return (
    // eslint-disable-next-line max-len
    <g transform={`translate(${animated.tx},${animated.ty}) scale(${animated.sx},${animated.sy})`}>
      {children}
    </g>
  );
};
