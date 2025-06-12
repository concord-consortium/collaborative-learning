import { inject, observer } from "mobx-react";
import React from "react";
import { BaseComponent, IBaseProps } from "../../../components/base";
import { DocumentViewMode } from "../../../components/document/document";
import { Pager } from "../../../components/pager";
import { SixPackRightControls } from "./sixpack-right-controls";
import { TeacherGroupSixPack, GROUPS_PER_PAGE } from "./teacher-group-six-pack";
import "./teacher-group-tab.scss";

interface IProps extends IBaseProps {}

interface IState {
  selectedGroupId?: string;
  page: number;
  documentViewMode: DocumentViewMode;
  selectedSectionId: string | null;
}

@inject("stores")
@observer
export class  TeacherGroupTabComponent extends BaseComponent<IProps, IState> {

  constructor(props: IProps) {
    super(props);

    this.state = {
      page: 0,
      documentViewMode: DocumentViewMode.Live,
      selectedSectionId: null
    };
  }

  public render() {
    const {page, documentViewMode, selectedSectionId} = this.state;
    return (
      <div className="teacher-group-tab">
        <TeacherGroupSixPack
          page={page}
          documentViewMode={documentViewMode}
          selectedSectionId={selectedSectionId}
        />
        <SixPackRightControls
          documentViewMode={documentViewMode}
          setDocumentViewMode={this.setDocumentViewMode}
          setSelectedSectionId={this.setSelectedSectionId}
          selectedSectionId={selectedSectionId}
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

  private setDocumentViewMode = (documentViewMode: DocumentViewMode) => {
    this.setState({documentViewMode});
  };

  private setSelectedSectionId = (selectedSectionId: string) => {
    this.setState({selectedSectionId});
  };
}
