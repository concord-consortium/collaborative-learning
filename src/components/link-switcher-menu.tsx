import { Button, Popover, Position, Menu, MenuItem } from "@blueprintjs/core";
import * as React from "react";
import { LogEventName, LogEventMethod, Logger } from "../lib/logger";

export interface IMenuLinkLog {
  event: LogEventName;
  parameters?: object;
  method?: LogEventMethod;
}

export interface IMenuLink {
  title: string;
  link?: string;
  enabled?: boolean;
  extras?: any;
  log?: IMenuLinkLog;
}

interface IProps {
  currentTitle: string;
  links: IMenuLink[];
  onClick?: (link: string, extras?: any) => void;
}

interface ILinkProps {
  title: string;
  disabled?: boolean;
  current?: boolean;
  link?: string;
  onClick?: (link?: string, extras?: any) => void;
  extras?: any;
  log?: IMenuLinkLog;
}

function LinkMenuItem(props: ILinkProps) {
  const {title, disabled, current, link, onClick, extras, log } = props;
  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    if (!disabled && onClick) {
      const clicked = () => onClick(link, extras);
      if (log) {
        Logger.log(log.event, log.parameters, log.method, clicked);
      } else {
        clicked();
      }
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
          disabled={!item.enabled}
          link={item.link}
          extras={item.extras}
          log={item.log}
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
