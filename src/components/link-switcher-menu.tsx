import { Button, Popover, Position, Menu, MenuItem } from "@blueprintjs/core";
import * as React from "react";

export interface IMenuLink {
  title: string;
  link?: string;
}

interface IProps {
  currentTitle: string;
  links: IMenuLink[];
  onClick?: (link: string) => void;
}

interface ILinkProps {
  title: string;
  disabled?: boolean;
  current?: boolean;
  link?: string;
  onClick?: (link: string) => void;
}

function LinkMenuItem(props: ILinkProps) {
  const {title, disabled, current, link, onClick } = props;
  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    if (!disabled && onClick && link ) {
      onClick(link);
    }
  };

  return (
    <MenuItem
      key={title}
      text={title}
      active={current}
      onClick={handleClick}
      disabled={disabled}
    />
  );
}

export class LinkSwitcherMenu extends React.Component<IProps, {}> {
  public render() {
    const { currentTitle, links, onClick } = this.props;
    const menuItems = links.map(item => {
      return (
        <LinkMenuItem
          key={item.title}
          title={item.title}
          current={item.title === currentTitle}
          disabled={item.link === undefined}
          link={item.link}
          onClick={onClick}
        />
      );
    });
    return (
      <Popover className="problemMenu"
        content={<Menu>{menuItems}</Menu>}
        position={Position.RIGHT_TOP}>
        <Button text={currentTitle}/>
      </Popover>
    );
  }
}
