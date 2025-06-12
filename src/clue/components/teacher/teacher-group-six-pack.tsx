import { inject, observer } from "mobx-react";
import React from "react";
import { BaseComponent, IBaseProps } from "../../../components/base";
import { DocumentViewMode } from "../../../components/document/document";
import { GroupUserModelType } from "../../../models/stores/groups";
import { TeacherGroupSixPackFourUp } from "./teacher-group-six-pack-fourup";

import "./teacher-group-six-pack.scss";

interface IProps extends IBaseProps {
  page: number;
  documentViewMode: DocumentViewMode;
  selectedSectionId: string | null;
}

interface IState {
  focusedGroupUser: GroupUserModelType | undefined;
}

const ROWS = 2;
const COLUMNS = 3;
export const GROUPS_PER_PAGE = ROWS * COLUMNS;

@inject("stores")
@observer
export class TeacherGroupSixPack extends BaseComponent<IProps, IState> {

  constructor(props: IProps) {
    super(props);
    this.state = {
      focusedGroupUser: undefined
    };
  }
  public render() {
    return (
      <div className="teacher-group-six-pack">
        {this.renderGroups()}
      </div>
    );
  }

  private renderGroups() {
    const { page, documentViewMode, selectedSectionId } = this.props;
    const { groups } = this.stores;
    const renders = [];
    const renderGroups = groups.nonEmptyGroups;
    const numberOfGroups = renderGroups.length;
    for (let row = 0; row < ROWS; row++) {
      for (let column = 0; column < COLUMNS; column++) {
        const groupIndex = (page * GROUPS_PER_PAGE) + (row * COLUMNS) + column;
        if (groupIndex < numberOfGroups) {
          const group = renderGroups[groupIndex];
          const fourUp = <TeacherGroupSixPackFourUp
                            key={group.id}
                            group={group}
                            row={row}
                            column={column}
                            documentViewMode={documentViewMode}
                            selectedSectionId={selectedSectionId}
                          />;
          renders.push(fourUp);
        }
      }
    }
    return renders;
  }
}
