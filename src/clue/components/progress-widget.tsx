import { inject, observer } from "mobx-react";
import React from "react";
import "./progress-widget.scss";

import { ProgressWidgetItem } from "./progress-widget-item";
import { BaseComponent } from "../../components/base";
import { ITileCountsPerSection } from "../../models/document/document-content-types";

export interface IProgressItem {
  label: string;
  completed: number;
  total: number;
}

interface IProps {
  selectedSectionId: string | null;
  setSelectedSectionId: (sectionId: string) => void;
}

interface IState {
}

@inject("stores")
@observer
export class ProgressWidget extends BaseComponent<IProps, IState> {

  public render() {
    const { selectedSectionId, setSelectedSectionId } = this.props;
    const progressItems = this.getProgressItems();
    return(
      <div className="progress-widget">
        <div className="label"> Progress </div>
        { progressItems.map(item => {
            return (
              <ProgressWidgetItem
                key={item.label}
                item={item}
                selected={item.label === selectedSectionId}
                setSelectedSectionId={setSelectedSectionId}
              />
            );
          })}
      </div>
    );
  }

  private getProgressItems() {
    const { problem, groups, documents } = this.stores;
    const { sections } = problem;
    const sectionIds = sections.map(section => section.type);
    const sectionInitials = sections.map(section => section.initials);

    // get the tile section counts per user
    const countsPerUser: {[key: string]: ITileCountsPerSection} = {};
    groups.allGroups.forEach(group => {
      documents.getProblemDocumentsForGroup(group.id).forEach(document => {
        // In the normal course of events there should only ever be one problem document per user,
        // but we've had bugs in the past that resulted in writing additional spurious problem documents.
        // Therefore, we only assign to countsPerUser for the first problem document we encounter for a user.
        if (!countsPerUser[document.uid]) {
          countsPerUser[document.uid] = document.content?.getTileCountsPerSection(sectionIds) || {};
        }
      });
    });

    // and sum the completion counts up by section to generate the progress items
    const userIds = Object.keys(countsPerUser);
    const numUsers = userIds.length;
    const progressItems: IProgressItem[] = [];
    sectionIds.forEach((sectionId, index) => {
      let completed = 0;
      userIds.forEach(userId => {
        completed += countsPerUser[userId][sectionId] > 0 ? 1 : 0;
      });
      progressItems.push({
        label: sectionInitials[index], // sectionIds and sectionIds are parallel arrays
        completed,
        total: numUsers
      });
    });

    return progressItems;
  }

}
