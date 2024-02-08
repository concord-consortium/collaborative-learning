import classNames from "classnames";
interface IProps {
  transform?: { x: number; y: number } | null;
  indexInStack: number;
  stackIsExpanded: boolean;
}

function getTiltAngle(index: number, stackIsExpanded: boolean) {
  if (stackIsExpanded) return 0;
  const angles = [0, -4, 3, -3, 3];
  return angles[index % angles.length];
}

function getOpacity(index: number) {
  const gradualFade = 1 - (index - 2) * 0.25;
  const opacity =  index > 2 ? gradualFade : 1;
  return opacity > .09 ? opacity : 0;
}

export const useSortableCardStyles = (props: IProps) => {
  const { transform, indexInStack, stackIsExpanded } = props;

  let dynamicStyles;

  const dynamicClasses = classNames(
    "drag-handle", "sortable", "card",
    {
      "in-expanded-stack": stackIsExpanded,
      "in-collapsed-stack": !stackIsExpanded
    },
  );

  if (transform) {
    dynamicStyles = {
      transform: `translate(${transform.x}px, ${transform.y - 25}px)`,
      zIndex: 1000,
      opacity: stackIsExpanded ? 1 : 0.8,
    };
  }

  else {
    dynamicStyles = {
      transform: `rotate(${getTiltAngle(indexInStack, stackIsExpanded)}deg)`,
      transition: "transform 0.5s",
      zIndex: 100 + (indexInStack * -1),
      opacity: stackIsExpanded ? 1 : getOpacity(indexInStack),
    };
  }

  return {dynamicClasses, dynamicStyles};
};


