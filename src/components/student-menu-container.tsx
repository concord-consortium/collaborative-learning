import React from "react";
import { inject, observer } from "mobx-react";
import { BaseComponent, IBaseProps } from "./base";
import { CustomSelect, ICustomDropdownItem } from "../clue/components/custom-select";
import { getConfirmLogoutUrl } from "../utilities/auth-utils";
import { aboutMenuItem } from "./about/about-dialog";

interface IProps extends IBaseProps {
  onShowAbout: () => void;
}

@inject("stores")
@observer
export class StudentMenuContainer extends BaseComponent <IProps> {
  public render() {
    const { user } = this.stores;
    const links: ICustomDropdownItem[] = [
      aboutMenuItem(this.props.onShowAbout),
      {
        text: "Log Out",
        isAction: true,
        selected: false,
        hideItemCheck: true,
        onClick: () => {
          // return back to standalone if the user authenticated in standalone mode
          // otherwise go to the default logout URL set in the portal (currently the homepage)
          const after = user.standaloneAuthUser ? window.location.href : undefined;
          window.location.assign(getConfirmLogoutUrl(after));
        }
      }
    ];

    return(
      <CustomSelect
        titlePrefix={user.name}
        title={user.className}
        items={links}
        showItemIcons={true}
        dataTest="user"
      />
    );
  }
}
