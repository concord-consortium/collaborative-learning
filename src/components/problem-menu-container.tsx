import * as React from "react";
import { IBaseProps, BaseComponent } from "./base";
import { inject, observer } from "mobx-react";
import { LinkSwitcherMenu, IMenuLink } from "./link-switcher-menu";

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class ProblemMenuContainer extends BaseComponent <IProps, {}> {
  public render() {
    const { problem } = this.stores;
    const clickHandler = (url: string) => { window.location.replace(url); };
    return (
      <LinkSwitcherMenu
        currentTitle={problem.title}
        links={this.getProblemMenuItems()}
        clickHandler={clickHandler}
      />
    );
  }

  private getProblemMenuItems() {
    const { user, unit } = this.stores;
    const investigations = unit.investigations;
    const links: IMenuLink[] = [];

    // For each problem in the curriculum assigned in this class...
    investigations.forEach ( (investigation) => {
      investigation.problems.forEach ( (problem) => {
        // Find the link, if any, in the portal offerings...
        const problemOrdinal = `${investigation.ordinal}.${problem.ordinal}`;
        const portalOffering = user.clueClassOfferings.find( (offering) => {
          return (
            offering.className === user.className &&
            offering.problemOrdinal === problemOrdinal
          );
        });
        links.push( {
          title: problem.title,
          link: portalOffering ? portalOffering.location : undefined
        });
      });
    });
    return links;
  }
}
