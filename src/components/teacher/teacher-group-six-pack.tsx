import { inject, observer } from "mobx-react";
import * as React from "react";
import { BaseComponent, IBaseProps } from "../base";
import { FourUpComponent } from "../four-up";

import "./teacher-group-six-pack.sass";

interface IProps extends IBaseProps {
}

interface IState {
}

@inject("stores")
@observer
export class TeacherGroupSixPack extends BaseComponent<IProps, IState> {

  public render() {
    return (
      <div className="teacher-group-six-pack">
        {this.renderGroups()}
      </div>
    );
  }

  private renderGroups() {
    const { groups } = this.stores;
    const numberOfGroups = groups.allGroups.length;
    const rows = 2;
    const columns = 3;
    const renders = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        const groupIndex = r * columns + c;
        if (groupIndex < numberOfGroups) {
          renders.push(this.renderFourUp(groupIndex, r, c));
        }
      }
    }
    return renders;
  }

  private renderFourUp(groupIndex: number, r: number, c: number) {
    const { groups } = this.stores;
    const group = groups.allGroups[groupIndex];
    return (
      <div className={`teacher-group group-${r}-${c}`} key={`group-${r}-${c}`}>
        <div className="group-label">
          Group {String(group.id)}
        </div>
        <div className="teacher-group-canvas-container">
          <div className="teacher-group-canvas">
            <FourUpComponent sectionId="initialChallenge" groupId={group.id} isGhostUser={true} />
          </div>
        </div>
      </div>
    );
  }

}
