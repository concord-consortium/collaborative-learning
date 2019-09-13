
import * as _ from "lodash";
import { inject, observer } from "mobx-react";
import * as React from "react";
import { BaseComponent, IBaseProps } from "./base";
import { GroupModelType, GroupUserModelType } from "../models/stores/groups";
import { ClassMenu, IMenuUser } from "./class-menu";

interface IProps extends IBaseProps { }

@inject("stores")
@observer
export class ClassMenuContainer extends BaseComponent <IProps, {}> {
  public render() {
    const { user } = this.stores;
    return <ClassMenu user={(user as unknown) as IMenuUser} />;
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
}
