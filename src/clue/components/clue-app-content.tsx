import { inject, observer } from "mobx-react";
import * as React from "react";
import { ClueHeaderComponent } from "./clue-header";
import { DialogComponent } from "../../components/utilities/dialog";
import { DocumentWorkspaceComponent } from "../../components/document/document-workspace";
import { BaseComponent, IBaseProps } from "../../components/base";

import "./clue-app-content.sass";

interface IProps extends IBaseProps {}

@inject("stores")
@observer
export class ClueAppContentComponent extends BaseComponent<IProps, {}> {

  public render() {
    const isGhostUser = this.stores.groups.ghostUserId === this.stores.user.id;
    return (
      <div className="clue-app-content">
        <ClueHeaderComponent isGhostUser={isGhostUser} />
        <DocumentWorkspaceComponent isGhostUser={isGhostUser} />
        <DialogComponent dialog={this.stores.ui.dialog} />
      </div>
    );
  }

}
