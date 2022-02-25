import React from "react";
import classNames from "classnames";
import { Tooltip } from "react-tippy";
import { useTooltipOptions } from "../../hooks/use-tooltip-options";
import BoldToolIcon from "../../clue/assets/icons/text/bold-text-icon.svg";
import ItalicToolIcon from "../../clue/assets/icons/text/italic-text-icon.svg";
import UnderlineToolIcon from "../../clue/assets/icons/text/underline-text-icon.svg";
import SuperscriptToolIcon from "../../clue/assets/icons/text/superscript-text-icon.svg";
import SubscriptToolIcon from "../../clue/assets/icons/text/subscript-text-icon.svg";
import NumberedListToolIcon from "../../clue/assets/icons/text/numbered-list-text-icon.svg";
import BulletedListToolIcon from "../../clue/assets/icons/text/bulleted-list-text-icon.svg";

interface IProps {
  iconName: string;
  tooltip: string;
  enabled: boolean;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
}

const kTooltipYDistance = 2;
const buttonIcon = (iconName: string, enabled: boolean, isSelected: boolean, onClick: (e: React.MouseEvent)=>void) => {
  const iconClasses = classNames("button-icon", isSelected ? "on" : "off", { enabled });
  const iconNameArr = ["bold", "italic", "underline", "superscript", "subscript", "list-ol", "list-ul"];
  const iconComponentArr = [ <BoldToolIcon key={iconName} className={iconClasses} onClick={onClick}/>,
                             <ItalicToolIcon key={iconName} className={iconClasses} onClick={onClick}/>,
                             <UnderlineToolIcon key={iconName} className={iconClasses} onClick={onClick}/>,
                             <SuperscriptToolIcon key={iconName} className={iconClasses} onClick={onClick}/>,
                             <SubscriptToolIcon key={iconName} className={iconClasses} onClick={onClick}/>,
                             <NumberedListToolIcon key={iconName} className={iconClasses} onClick={onClick}/>,
                             <BulletedListToolIcon key={iconName} className={iconClasses} onClick={onClick}/>
                           ];
  return iconComponentArr[iconNameArr.indexOf(iconName)];
};

export const TextToolbarButton: React.FC<IProps> = ({
              iconName, tooltip, enabled, isSelected, onClick
            }: IProps) => {
  const tooltipOptions = useTooltipOptions({ distance: kTooltipYDistance });

  return (
    <Tooltip title={tooltip} {...tooltipOptions}>
      <div className={classNames("button-with-tool-tip", isSelected ? "on" : "off", { enabled })} key={iconName}>
        {buttonIcon(iconName, enabled, isSelected, onClick)}
      </div>
    </Tooltip>

  );
};
