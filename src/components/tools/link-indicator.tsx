import React from "react";
import SvgLinkedTileIcon from "../../assets/icons/linked-tile-icon";
import { getTableLinkColors } from "../../models/tools/table-links";
import { IconButtonSvg } from "../utilities/icon-button-svg";

// It should be possible to use a standard import and get TypeScript types
// (cf. https://mattferderer.com/use-sass-variables-in-typescript-and-javascript).
// See comment in `typings.d.ts` for details.
const styles = require("./link-indicator.scss");

interface IProps {
  id: string;
  index?: number;
}

export const LinkIndicatorComponent: React.FC<IProps> = ({ id, index }: IProps) => {
  const linkColors = getTableLinkColors(id);
  const svgLinkIcon = linkColors &&
                        <SvgLinkedTileIcon
                          className={`button-icon link-indicator link-icon`}
                          fillColor={linkColors.stroke} />;
  const initialOffset = parseInt(styles.linkIndicatorRightOffset, 10);
  const deltaOffset = parseInt(styles.linkIndicatorWidth, 10) + 2;
  const style: React.CSSProperties | undefined =
          index != null
            ? { right: initialOffset + deltaOffset * index }
            : undefined;

  return (
    svgLinkIcon
      ? <IconButtonSvg
          className="icon-link-indicator"
          style={style}
          icon="link-indicator"
          children={svgLinkIcon} />
      : null
  );
};
