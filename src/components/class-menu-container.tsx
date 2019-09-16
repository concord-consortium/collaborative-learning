
import { uniq } from "lodash";
import { inject, observer } from "mobx-react";
import * as React from "react";
import { BaseComponent, IBaseProps } from "./base";
import { getProblemLinkForClass } from "../lib/portal-api";
import { LinkSwitcherMenu  } from "./link-switcher-menu";

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class ClassMenuContainer extends BaseComponent <IProps, {}> {
  public render() {
    const {currentTitle, links} = this.getClueClasses();
    const clickHandler = (url: string) => window.location.replace(url);
    return <LinkSwitcherMenu
      currentTitle={currentTitle}
      links={links}
      clickHandler={clickHandler}
    />;
  }

  private getClueClasses() {
    // TODO: We don't have unit names, which would be very helpful for switching
    const { user, investigation, problem, } = this.stores;
    const problemId = `${investigation.ordinal}.${problem.ordinal}`;
    const classNames = uniq(user.clueClassOfferings.map(o => o.className));

    // Sample PortalClasses: [{ name: "clazz1", dashboardUrl: "learn.com/1", ordinal: "1.1" }]
    const classLinks = classNames.map(name => {
      const clazzProblem = getProblemLinkForClass(user.clueClassOfferings, name, problemId);
      if (clazzProblem) {
        return { title: name, link: clazzProblem.dashboardUrl };
      } else {
        return { title: name, link: "" };
      }
    });
    return {
      currentTitle:  user.className,
      links: classLinks
    };
  }
}
