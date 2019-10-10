import { inject, observer } from "mobx-react";
import * as React from "react";
import { BaseComponent, IBaseProps } from "../base";
import { TeacherGroupSixPack, GROUPS_PER_PAGE } from "./teacher-group-six-pack";
import { SixPackRightControls } from "../../clue/components/sixpack-right-controls";
import { Pager } from "../pager";
import "./teacher-group-tab.sass";

export enum DocumentViewMode {
  Live,
  Published
}

interface IProps extends IBaseProps {}

interface IState {
  selectedGroupId?: string;
  page: number;
  documentViewMode: DocumentViewMode;
}

@inject("stores")
@observer
export class  TeacherGroupTabComponent extends BaseComponent<IProps, IState> {

  constructor(props: IProps) {
    super(props);
    this.state = {
      page: 0,
      documentViewMode: DocumentViewMode.Live
    };
  }

  public render() {
    const {page, documentViewMode} = this.state;
    return (
      <div className="teacher-group-tab">
        <TeacherGroupSixPack page={page} documentViewMode={documentViewMode} />
        <SixPackRightControls
          documentViewMode={documentViewMode}
          setDocumentViewMode={this.handleSetDocumentViewMode}
        >
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

  private handleSetDocumentViewMode = (documentViewMode: DocumentViewMode) => this.setState({documentViewMode});
}
