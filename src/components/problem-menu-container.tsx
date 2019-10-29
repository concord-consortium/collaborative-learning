import * as React from "react";
import { IBaseProps, BaseComponent } from "./base";
import { inject, observer } from "mobx-react";
import { LinkSwitcherMenu, IMenuLink } from "./link-switcher-menu";
import { LogEventName, Logger } from "../lib/logger";
import { toJS } from "mobx";
import { DropDown } from "cc-components";

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class ProblemMenuContainer extends BaseComponent <IProps, {}> {
  public render() {
    const { problem } = this.stores;
    const problemMenuItems = this.getProblemMenuItems();
    const handleClick = (item: IMenuLink) => {
      const {log, link, extras} = item;
      const followLink = () => {
        if (link) {
          window.location.replace(link);
        } else {
          this.showUnassignedLinkAlert(extras);
        }
      };
      followLink();
      if (log) {
        Logger.log(log.event, log.parameters, log.method);
      }
    };

    const menuItems = problemMenuItems.map( (i) => {
      return {
        text: i.title,
        link: i.link,
        selected: i.selected,
        onClick: () => handleClick(i)
      };
    });
    return <DropDown title="Problems" items={menuItems} />;
  }

  private showUnassignedLinkAlert(extras: any) {
    const { ui } = this.stores;
    const identifier = `${extras.title} (${extras.unitCode})`;
    ui.alert(
      `You must first assign ${identifier} from the portal.`,
      "Problem not currently assigned"
    );
  }

  private getProblemMenuItems() {
    const { user, unit, problem } = this.stores;
    const investigations = unit.investigations;
    const links: IMenuLink[] = [];

    // For each problem in the curriculum assigned in this class...
    investigations.forEach ( (investigation) => {
      investigation.problems.forEach ( (invProb) => {
        // Find the link, if any, in the portal offerings...
        const problemOrdinal = `${investigation.ordinal}.${invProb.ordinal}`;
        const unitCode = unit.code;
        const portalOffering = user.portalClassOfferings.find( (offering) => {
          return (
            offering.className === user.className &&
            offering.problemOrdinal === problemOrdinal &&
            offering.unitCode === unitCode
          );
        });

        links.push( {
          selected: problem.title === invProb.title,
          title: portalOffering ? invProb.title : `${invProb.title} (N/A)`,
          link: portalOffering ? portalOffering.location : undefined,
          enabled: true,
          extras: { unitCode, problemOrdinal, title: invProb.title },
          log: {event: LogEventName.DASHBOARD_SWITCH_PROBLEM, parameters: toJS(portalOffering)}
        });
      });
    });
    return links;
  }
}
