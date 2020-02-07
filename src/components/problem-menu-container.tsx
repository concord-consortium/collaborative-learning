import React from "react";
import { IBaseProps, BaseComponent } from "./base";
import { inject, observer } from "mobx-react";
import { LogEventName, LogEventMethod, Logger } from "../lib/logger";
import { toJS } from "mobx";
import { DropDown, IDropdownItem } from "@concord-consortium/react-components";

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class ProblemMenuContainer extends BaseComponent <IProps, {}> {

  public render() {
    const problemMenuItems = this.getProblemMenuItems();
    return <DropDown title="Problems" items={problemMenuItems} />;
  }

  private handleMenuItemClick = (item: IDropdownItem, problemName: string) => {
    const {link, text} = item;
    if (link) {
      window.location.replace(link);
    } else {
      this.showUnassignedLinkAlert(problemName);
    }
    const logItem = {
      event: LogEventName.DASHBOARD_SWITCH_CLASS,
      parameters: {text, link}
    };
    Logger.log(logItem.event, logItem.parameters, LogEventMethod.DO);
  }

  private showUnassignedLinkAlert(problemName: string) {
    const { ui } = this.stores;
    ui.alert(
      `You must first assign ${problemName} from the portal.`,
      "Problem not currently assigned"
    );
  }

  private getProblemMenuItems() {
    const { user, unit, problem } = this.stores;
    const investigations = unit.investigations;
    const links: IDropdownItem[] = [];

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
        const link: IDropdownItem = {
          selected: problem.title === invProb.title,
          text: portalOffering ? invProb.title : `${invProb.title} (N/A)`,
          link: portalOffering ? portalOffering.location : undefined,
          disabled: false
        };
        link.onClick = () => this.handleMenuItemClick(link, invProb.title);
        links.push(link);
      });
    });
    return links;
  }
}
