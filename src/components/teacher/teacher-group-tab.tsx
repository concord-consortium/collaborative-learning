import { inject, observer } from "mobx-react";
import * as React from "react";
import { BaseComponent, IBaseProps } from "../base";
import { TeacherGroupSixPack, GROUPS_PER_PAGE } from "./teacher-group-six-pack";
import { SixPackRightControls } from "../../clue/components/sixpack-right-controls";
import { Pager } from "../pager";
import "./teacher-group-tab.sass";

interface IProps extends IBaseProps {}

interface IState {
  selectedGroupId?: string;
  page: number;
}

@inject("stores")
@observer
export class  TeacherGroupTabComponent extends BaseComponent<IProps, IState> {

  constructor(props: IProps) {
    super(props);
    this.state = {
      page: 0
    };
  }

  public render() {
    return (
      <div className="teacher-group-tab">
        <TeacherGroupSixPack page={ this.state.page }/>
        <SixPackRightControls>
          <Pager
            currentPage={this.state.page}
            numPages={this.numPages}
            setPage={this.setPage}
          />
        </SixPackRightControls>
      </div>
    );
  }
  private setPage = (nextPage: number) => this.setState({page: nextPage});
  private get numPages(){
    return Math.ceil(this.stores.groups.allGroups.length / GROUPS_PER_PAGE);
  }

}
