import classNames from "classnames";
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
  const angles = [0, 1.25, -1.25, 3.5, -3.5];
  return angles[index % angles.length];
}

export const useSortableCardStyles = (props: IProps) => {
  const { transform, indexInStack, atStackTop, stackIsExpanded } = props;

  const dynamicClasses = classNames(
    "drag-handle", "sortable", "card",
    {
      "at-stack-top": atStackTop,
      "in-expanded-stack": stackIsExpanded,
      "in-collapsed-stack": !stackIsExpanded
    },
  );

  let dynamicStyles;

  // the only transform we apply is the one created by mouse dragging
  if (transform) {
    dynamicStyles = {
      transform: `translate3d(${transform.x}px, ${transform.y - 25}px, 0)`,
      zIndex: 1000,
      opacity: stackIsExpanded ? 1 : 0.8,
    };
  }
  // otherwise we may have some transforms based on the index in the stack and the expansion state
  else {
    const rotationString = !stackIsExpanded
      ? `rotate(${getTiltAngle(indexInStack, stackIsExpanded)}deg)`
      : `rotate(0deg)`;

    const translateYString = !stackIsExpanded
      ? `translateY(${indexInStack * -100}%)`
      : `translateY(0)`;

    dynamicStyles = {
      zIndex: indexInStack,
      transform: `${rotationString} ${translateYString}`,
      transition: "transform 0.5s",
    };
  }

  return {dynamicClasses, dynamicStyles};
};


