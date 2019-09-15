import { inject, observer } from "mobx-react";
import * as React from "react";
import { BaseComponent, IBaseProps } from "../base";
import { FourUpComponent } from "../four-up";
import { Button, ButtonGroup } from "@blueprintjs/core";

import "./teacher-group-six-pack.sass";

interface IProps extends IBaseProps {
}

interface IState {
  page: number;
}

const ROWS = 2;
const COLUMNS = 3;
const GROUPS_PER_PAGE = ROWS * COLUMNS;

@inject("stores")
@observer
export class TeacherGroupSixPack extends BaseComponent<IProps, IState> {

  constructor(props: IProps) {
    super(props);
    this.state = {
      page: 0
    };
  }

  public render() {
    return (
      <div className="teacher-group-six-pack">
        {this.renderGroups()}
        {this.renderPager()}
      </div>
    );
  }

  private renderGroups() {
    const { page } = this.state;
    const { groups } = this.stores;
    const numberOfGroups = groups.allGroups.length;
    const renders = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLUMNS; c++) {
        const groupIndex = (page * GROUPS_PER_PAGE) + (r * COLUMNS) + c;
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
            <FourUpComponent groupId={group.id} isGhostUser={true} />
          </div>
        </div>
      </div>
    );
  }

  private renderPager() {
    const { page } = this.state;

    if (this.numberOfPages < 2) {
      return null;
    }

    return (
      <div className="teacher-group-six-pack-pager">
        <ButtonGroup>
          <Button onClick={this.handlePreviousPage} disabled={page <= this.prevPage}>« Previous</Button>
          <Button onClick={this.handleNextPage} disabled={page >= this.nextPage}>Next »</Button>
        </ButtonGroup>
      </div>
    );
  }

  private get numberOfPages() {
    return Math.ceil(this.stores.groups.allGroups.length / GROUPS_PER_PAGE);
  }

  private get prevPage() {
    return Math.max(0, this.state.page - 1);
  }

  private get nextPage() {
    return Math.min(this.numberOfPages - 1, this.state.page + 1);
  }

  private handlePreviousPage = () => {
    this.setState({page: this.prevPage});
  }

  private handleNextPage = () => {
    this.setState({page: this.nextPage});
  }
}
