import classNames from "classnames";
interface IProps {
  transform?: { x: number; y: number } | null;
  atStackTop: boolean;
  stackIsExpanded: boolean;
}

export const useSortableCardStyles = (props: IProps) => {
  const { transform, atStackTop, stackIsExpanded } = props;

  const dynamicClasses = classNames(
    "drag-handle", "sortable", "card",
    {
      "at-stack-top": atStackTop,
      "in-expanded-stack": stackIsExpanded,
       "in-collapsed-stack": !stackIsExpanded
    },
  );

  let dynamicStyles;

  if (transform) {
    dynamicStyles = {
      transform: `translate3d(${transform.x}px, ${transform.y - 25}px, 0)`,
      zIndex: 1000,
      opacity: stackIsExpanded ? 1 : 0.8,
    };
  }

  return {dynamicClasses, dynamicStyles};
};

