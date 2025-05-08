import React from "react";
import { Transform } from "../objects/drawing-object";

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export interface TransformableProps {
  transform: Transform;
  children: React.ReactNode;
}

/** Renders an SVG group with an optional translate and scale transform.
 * When the transform changes, the group animates to the new transform.
 *
 * @param transform - The transform to apply to the group.
 * @param children - The children to render inside the group.
 */
export const Transformable: React.FC<TransformableProps> = ({ transform, children }) => {
  const prevRef = React.useRef(transform);
  const [animated, setAnimated] = React.useState(transform);

  React.useEffect(() => {
    const prev = prevRef.current;
    const target = transform;
    const duration = 500; // ms
    const start = performance.now();

    let rafId: number;
    function animate(now: number) {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      setAnimated({
        tx: lerp(prev.tx, target.tx, t),
        ty: lerp(prev.ty, target.ty, t),
        sx: lerp(prev.sx, target.sx, t),
        sy: lerp(prev.sy, target.sy, t)
      });
      if (t < 1) {
        rafId = requestAnimationFrame(animate);
      } else {
        setAnimated(target);
        prevRef.current = target;
      }
    }
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [transform]);

  return (
    <g transform={`translate(${animated.tx},${animated.ty}) scale(${animated.sx},${animated.sy})`}>
      {children}
    </g>
  );
};
