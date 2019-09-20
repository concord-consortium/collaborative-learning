import * as React from "react";
import { uniq } from "lodash";
import { inject, observer } from "mobx-react";
import { BaseComponent, IBaseProps } from "./base";
import { LinkSwitcherMenu, IMenuLink  } from "./link-switcher-menu";

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class ClassMenuContainer extends BaseComponent <IProps, {}> {
  public render() {
    const {currentTitle, links} = this.getClueClasses();
    const clickHandler = (url: string) => { window.location.replace(url); };
    return <LinkSwitcherMenu
      currentTitle={currentTitle}
      links={links}
      clickHandler={clickHandler}
    />;
  }

  private getCurrentProblemOrdinal() {
    const { offeringId, clueClassOfferings } = this.stores.user;
    if (offeringId) {
      const currentOffering = clueClassOfferings.find( offering => {
        return (offering.offeringId === offeringId);
      });
      if (currentOffering) {
        return currentOffering.problemOrdinal;
      }
    }
    // tslint:disable-next-line:no-console
    console.log(`Warning -- current offering not found. (Maybe in demo mode?)`);
    return "0.0";
  }

  private getClueClasses() {
    // TODO: We don't have unit names, which would be very helpful for switching
    const {user} = this.stores;
    const classNames = uniq(user.clueClassOfferings.map(o => o.className));
    const currentProblemOrdinal = this.getCurrentProblemOrdinal();
    const links: IMenuLink[] = [];

    // If, by chance, there are no classes in the offerings, return a link
    // with a name matching the current class name and no link. This is bit of
    // code is primarily for when the application is running in demo mode.
    if (classNames.length === 0) {
      return {
        currentTitle:  user.className,
        links: [
          {
          title: user.className
          }
        ]
      };
    }

    // For each class (that is, for each item in the class switcher menu) we
    // try to find a problem/offering with the same ordinal identifier as the
    // current problem. If we find a match, we add that one to the link array.
    // If not, we use the first one in the list of offerings for that class.

    classNames.forEach( (className) => {
      const classLinks = user.clueClassOfferings.filter(o => o.className === className);
      const matchingLink = classLinks.find( l => l.problemOrdinal === currentProblemOrdinal);
      if (matchingLink) {
        links.push( { title: className, link: matchingLink.location });
      } else if (classLinks) {
        links.push( { title: className, link: classLinks[0].location} );
      } else {
        // tslint:disable-next-line:no-console
        console.log(`Warning -- no problems assigned in this class ${className}`);
      }
    });

    return {
      currentTitle:  user.className,
      links
    };
  }
}
