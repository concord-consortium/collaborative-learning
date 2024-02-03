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
  const angle = angles[index % angles.length];
  return angle;
}

function getCollapsedVerticalLocation(index: number) {
  // we need to know how tall this card is,

  // and we need to know the location of the top of the stack

  // then we need to place the card at the top.  The cards will be on top of eachother
}

function getExpandedVerticalLocation(index: number) {
  // we need to know how tall this card is,

  // and we need to know the location of the top of the stack

  // then we need to place the card at the top.  The cards will be on top of eachother
}


export const useSortableCardStyles = (props: IProps) => {
  const { transform: draggingTransform, indexInStack, atStackTop, stackIsExpanded } = props;

  const dynamicClasses = classNames(
    "drag-handle", "sortable", "card",
    {
      "at-stack-top": atStackTop,
      "in-expanded-stack": stackIsExpanded,
       "in-collapsed-stack": !stackIsExpanded
    },
  );

  let dynamicStyles;

  if (draggingTransform) {
    dynamicStyles = {
      transform: `translate3d(${draggingTransform.x}px, ${draggingTransform.y - 25}px, 0)`,
      zIndex: 1000,
      opacity: stackIsExpanded ? 1 : 0.8,
    };
  } else {
    const angle = getTiltAngle(indexInStack, stackIsExpanded);
    dynamicStyles = {
      transform: `rotate(${angle}deg)`,
      zIndex: indexInStack,
      opacity: 1,
    };
  }

  return {dynamicClasses, dynamicStyles};
};

/**
 *   const angle = getTiltAngle(indexInStack);
 * const getTiltAngle = (index: number) => {
  const angles = [-2, -1, 0, 1, 2];
  const angle = angles[index % angles.length];
  return angle;
};
 */
