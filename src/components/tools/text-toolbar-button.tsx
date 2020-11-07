import React from "react";
import classNames from "classnames";

interface IProps {
  iconName: string;
  tooltip: string;
  enabled: boolean;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
}

const iconClasses = (iconName: string, enabled: boolean, isSelected: boolean) => {
  return classNames("button-icon", "fa", "fa-fw", `fa-${iconName}`, isSelected ? "on" : "off", { enabled });
};

export const TextToolbarButton: React.FC<IProps> = ({
              iconName, tooltip, enabled, isSelected, onClick
            }: IProps) => {
  return (
    <div className={classNames("button-with-tool-tip", { enabled })} key={iconName}>
      <i className={iconClasses(iconName, enabled, isSelected)} onClick={onClick} />
      <span className={classNames("tool-tip-text", { enabled })}>
        {tooltip}
      </span>
    </div>
  );
};
