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
  const angles = [0, 1.25, -1.25, 3.5, -3.5];
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
    };
  }

  return {dynamicClasses, dynamicStyles};
};


