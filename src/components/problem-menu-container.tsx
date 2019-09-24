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
    const handleClick = (url: string, extras?: any) => {
      if (url) {
        window.location.replace(url);
      } else {
        this.showUnassignedLinkAlert(extras);
      }
    };
    return (
      <LinkSwitcherMenu
        currentTitle={problem.title}
        links={this.getProblemMenuItems()}
        onClick={handleClick}
      />
    );
  }
  private showUnassignedLinkAlert(extras: any) {
    const { ui } = this.stores;
    const identifier = `${extras.title} (${extras.unitCode})`;
    ui.alert(`You must first assign ${identifier} from the portal.`, "Problem not currently assigned");
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
        const unitCode = unit.code;
        const portalOffering = user.portalClassOfferings.find( (offering) => {
          return (
            offering.className === user.className &&
            offering.problemOrdinal === problemOrdinal
          );
        });
        links.push( {
          title: portalOffering ? problem.title : `${problem.title} (N/A)`,
          link: portalOffering ? portalOffering.location : undefined,
          enabled: true,
          extras: { unitCode, problemOrdinal, title: problem.title }
        });
      });
    });
    return links;
  }
}
