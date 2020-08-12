import React from "react";
import { uniq } from "lodash";
import { inject, observer } from "mobx-react";
import { BaseComponent, IBaseProps } from "./base";
import { LogEventName, Logger, LogEventMethod } from "../lib/logger";
import { DropDown, IDropdownItem } from "@concord-consortium/react-components";
import { getProblemOrdinal } from "../models/stores/stores";

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class ClassMenuContainer extends BaseComponent <IProps> {
  public render() {
    const links = this.getPortalClasses();
    const { user } = this.stores;
    return(<>
      <DropDown
        title="Class Menu"
        prefix={user.name}
        items={links}
      />
    </>);
  }

  private getCurrentProblemOrdinal() {
    const { appConfig, appMode, user: { offeringId, portalClassOfferings } } = this.stores;
    if (offeringId) {
      const currentOffering = portalClassOfferings.find( offering => {
        return (offering.offeringId === offeringId);
      });
      if (currentOffering) {
        return currentOffering.problemOrdinal;
      }
    }
    if (appMode === "authed") {
      console.warn(`Warning -- current offering not found. (Maybe in demo mode?)`);
    }
    return getProblemOrdinal(this.stores) || appConfig.defaultProblemOrdinal;
  }

  private getPortalClasses() {
    const {user} = this.stores;
    const classNames = uniq(user.portalClassOfferings.map(o => o.className));
    const currentProblemOrdinal = this.getCurrentProblemOrdinal();
    const links: IDropdownItem[] = [];

    // If, by chance, there are no classes in the offerings, return a link
    // with a name matching the current class name and no link. This is bit of
    // code is primarily for when the application is running in demo mode.
    if (classNames.length === 0) {
      return [];
    }

    // For each class (that is, for each item in the class switcher menu) we
    // try to find a problem/offering with the same ordinal identifier as the
    // current problem. If we find a match, we add that one to the link array.
    // If not, we use the first one in the list of offerings for that class.
    classNames.forEach( (className) => {
      const classLinks = user.portalClassOfferings.filter(o => o.className === className);
      const matchingLink = classLinks.find( l => l.problemOrdinal === currentProblemOrdinal);
      const handleClick = (name: string, url: string) => {
        const log = {
          event: LogEventName.DASHBOARD_SWITCH_CLASS,
          parameters: {className, link: url}
        };
        Logger.log(log.event, log.parameters, LogEventMethod.DO);
        window.location.replace(url);
      };

      if (matchingLink) {
        links.push({
          text: className,
          link: matchingLink.location,
          selected: className === user.className,
          onClick: () => handleClick(className, matchingLink.location)
        });
      } else if (classLinks) {
        links.push({
          text: className,
          link: classLinks[0].location
        });
      } else {
        console.warn(`Warning -- no problems assigned in this class ${className}`);
      }
    });

    return links;
  }
}
