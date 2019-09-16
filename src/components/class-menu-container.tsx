
import { uniq } from "lodash";
import { inject, observer } from "mobx-react";
import * as React from "react";
import { BaseComponent, IBaseProps } from "./base";
import { getProblemLinkForClass } from "../lib/portal-api";
import { ClassMenu, IMenuUser } from "./class-menu";

interface IProps extends IBaseProps { }

@inject("stores")
@observer
export class ClassMenuContainer extends BaseComponent <IProps, {}> {
  public render() {
    return <ClassMenu user={this.getClueClasses()} />;
    /*
      ILinkItem {
        title: "My First Class",
        selected: true,           // (only one, highlighted)
        url: "http://foo.com/",   // Where the link takes us
        disabled: false           // link active?
      }
      <LinkSwitcher
        buttonLabel={currentItemName: string}
        links={linkArray: ILinkItem[]}
      />
    */
  }
  private getClueClasses() {
    const { user, investigation, problem, } = this.stores;
    // TODO we don't have unit names :( console.log(unit);

    const problemId = `${investigation.ordinal}.${problem.ordinal}`;

    const classNames = uniq(user.clueClassOfferings.map(o => o.className));

    // Sample PortalClasses: [{ name: "clazz1", dashboardUrl: "learn.com/1", ordinal: "1.1" }]
    const portalClasses = classNames.map(name => {
      const clazzProblem = getProblemLinkForClass(user.clueClassOfferings, name, problemId);
      if (clazzProblem) {
        return {
          className: name,
          link: clazzProblem.dashboardUrl
        };
      }
      return {
        className: name,
        link: ""
      };
    });
    const renderResult: IMenuUser = {
      className:  user.className,
      portalClasses
    };
    return renderResult;
  }
}
