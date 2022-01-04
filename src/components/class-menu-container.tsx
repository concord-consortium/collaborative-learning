import React from "react";
import { uniq } from "lodash";
import { inject, observer } from "mobx-react";
import { BaseComponent, IBaseProps } from "./base";
import { LogEventName, Logger } from "../lib/logger";
import { IDropdownItem } from "@concord-consortium/react-components";
import { IUserPortalOffering } from "../models/stores/user";
import { CustomSelect } from "../clue/components/custom-select";

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class ClassMenuContainer extends BaseComponent <IProps> {
  public render() {
    const links = this.getPortalClasses();
    const { user } = this.stores;
    return(
      <CustomSelect
        titlePrefix={user.name}
        title={user.className}
        items={links}
      />
    );
  }

  private getPortalClasses() {
    const {user} = this.stores;
    const classNames = uniq(user.portalClassOfferings.map(o => o.className));
    const currentProblemPath = this.stores.problemPath;
    const links: IDropdownItem[] = [];

    // If, by chance, there are no classes in the offerings, return a link
    // with a name matching the current class name and no link. This bit of
    // code is primarily for when the application is running in demo mode.
    if (classNames.length === 0) {
      return [];
    }

    // For each class (that is, for each item in the class switcher menu) we try to find
    // a problem/offering with the same "problem path" (unit code plus problem ordinal)
    // as the current problem. If we find a match, we add that one to the link array.
    classNames.forEach( (className) => {
      const classProblems = user.portalClassOfferings.filter(o => o.className === className);
      const matchingProblems = classProblems.filter(l => l.problemPath === currentProblemPath);
      const handleClick = (name: string, url: string) => {
        const log = {
          event: LogEventName.DASHBOARD_SWITCH_CLASS,
          parameters: {className, link: url}
        };
        Logger.log(log.event, log.parameters);
        window.location.replace(url);
      };

      const addMenuItemForOffering = (offering: IUserPortalOffering, showProblemTitle: boolean) => {
        // Note that the same problem can be assigned multiple times to the same class
        // (e.g. as a pre- and post-test), so we optionally include the activity title as well.
        const text = showProblemTitle && offering.activityTitle
                      ? `${className} (${offering.activityTitle})`
                      : className;
        links.push({
          text,
          link: offering.location,
          selected: className === user.className,
          onClick: () => handleClick(className, offering.location)
        });
      };

      // only include classes which also assign the same problem
      if (matchingProblems.length) {
        matchingProblems.forEach(p => addMenuItemForOffering(p, matchingProblems.length > 1));
      }
    });

    return links;
  }
}
