import { Button, Popover, Position, Menu, MenuItem } from "@blueprintjs/core";
import * as React from "react";
import { BaseComponent, IBaseProps } from "./base";

export interface IMenuPortalClass {
  className: string;
  link: string;
}

export interface IMenuUser {
  className: string;
  portalClasses: IMenuPortalClass[];
}
interface IProps extends IBaseProps {
  user: IMenuUser;
}

export class ClassMenu extends React.Component<IProps, {}> {
  public render() {
    const { user } = this.props;
    return (
      <Popover className="problemMenu"
        content={this.renderClassMenu(user.className)} position={Position.RIGHT_TOP}>
        <Button text={user.className}/>
      </Popover>
    );
  }

  private renderClassMenu(currentClassName: string) {
    const { user } = this.props;
    const isActive = false;
    let key = 0;
    const handleMenuItem = (link: string) => {
      return ( (e: React.MouseEvent<HTMLElement>) => {
        console.log(`Class menu selection DL / NP:  ${link}`);
        if (link && link !== "" && ! isActive) {
          window.location.replace(link);
        }
      });
    };
    if (user.portalClasses.length <= 0) {
      // If we don't have a list of classes, populate the menu with with this
      // class, at least. Otherwise, it makes for an ugly, empty menu.
      return (
        <Menu>
          <MenuItem key={key++} text={user.className} active={true}/>
        </Menu>
      );
    }
    return (
      <Menu>
        { user.portalClasses.map( (c: IMenuPortalClass) =>
            <MenuItem
              key={key++}
              text={c.className}
              active={c.className === currentClassName}
              onClick={handleMenuItem(c.link)}
            />
        )}
      </Menu>
    );
  }
}
