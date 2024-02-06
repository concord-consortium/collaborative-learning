import classNames
 from "classnames";
interface IProps {
  transform?: { x: number; y: number } | null;
  indexInStack: number;
  atStackTop: boolean;
  stackIsExpanded: boolean;
}

function getTiltAngle(index: number, stackIsExpanded: boolean) {
  if (stackIsExpanded) {
    return 0;
  }
  const angles = [0, -4, 3, -3, 3];
  // const offsets = [0, 0, 0, 0, 0];
  // const opacities = [1, 1, 1, 0.75, 0.5, 0.25];
  return angles[index % angles.length];
}

export const useSortableCardStyles = (props: IProps) => {
  const { transform, indexInStack, atStackTop, stackIsExpanded } = props;

  let dynamicStyles;

  const dynamicClasses = classNames(
    "drag-handle", "sortable", "card",
    {
      "at-stack-top": atStackTop,
      "in-expanded-stack": stackIsExpanded,
       "in-collapsed-stack": !stackIsExpanded
    },
  );

  if (transform) {
    dynamicStyles = {
      transform: `translate3d(${transform.x}px, ${transform.y - 25}px, 0)`,
      zIndex: 1000,
      opacity: stackIsExpanded ? 1 : 0.8,
    };
  }

  else {
    dynamicStyles = {
      transform: `rotate(${getTiltAngle(indexInStack, stackIsExpanded)}deg)`,
      transition: "transform 0.5s",
      zIndex: indexInStack * -1,
    };
  }

  return {dynamicClasses, dynamicStyles};
};


