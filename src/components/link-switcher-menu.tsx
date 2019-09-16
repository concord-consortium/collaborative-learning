import { Button, Popover, Position, Menu, MenuItem } from "@blueprintjs/core";
import * as React from "react";

export interface IMenuLink {
  title: string;
  link: string;
}

interface IProps {
  currentTitle: string;
  links: IMenuLink[];
  clickHandler?: (link: string) => void;
}
interface ILinkProps {
  title: string;
  disabled?: boolean;
  current?: boolean;
  link?: string;
  clickHandler?: (link: string) => void;
}

function LinkMenuItem(props: ILinkProps) {
  const {title, disabled, current, link, clickHandler } = props;
  const doClick = (e: React.MouseEvent<HTMLElement>) => {
    if (!disabled && clickHandler && link ) {
      clickHandler(link);
    }
  };

  return (
    <MenuItem
      key={title}
      text={title}
      active={current}
      onClick={doClick}
      disabled={disabled}
    />
  );
}

export class LinkSwitcherMenu extends React.Component<IProps, {}> {
  public render() {
    const { currentTitle, links, clickHandler} = this.props;
    const menuItems = links.map(item => {
      return (
        <LinkMenuItem
          key={item.title}
          title={item.title}
          current={item.title === currentTitle}
          disabled={false}
          link={item.link}
          clickHandler={clickHandler}
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
