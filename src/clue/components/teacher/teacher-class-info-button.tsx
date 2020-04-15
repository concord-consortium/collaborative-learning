import { inject } from "mobx-react";
import { BaseComponent, IBaseProps } from "../../../components/base";
import React from "react";
import { each } from "lodash";

import "./teacher-class-info-button.sass";

interface IProps extends IBaseProps {}

@inject("stores")
export class ClassInfoButton extends BaseComponent <IProps, {}> {
  public render() {
    return (
      <div className="class-info-button-container">
        <button className="class-info-button export" onClick={this.handleExportClick}>Export Class Groups (csv)</button>
      </div>
    );
  }

  private handleExportClick = async () => {
    const {db, user} = this.stores; // access the database
    const groupsArray: string[] = []; // store the group ids
    const usersPath = db.firebase.getUsersPath(db.stores.user);
    const usersRef = db.firebase.ref(usersPath);
    // get a snapshot of the users in this class
    const usersSnapshot = await usersRef.once("value");
    if (usersSnapshot) {
      const users = usersSnapshot.val();
      each(users, (portalUser, userId) => {
        // a user is a DBPortalUser in db-types.ts, can be undefined, each has the latestGroupId
        if (portalUser) {
          // classUser contains the user name information
          const classUser = this.stores.class.getUserById(userId);
          if (classUser?.type === "student") {
            if (groupsArray.indexOf(portalUser.latestGroupId) === -1) groupsArray.push(portalUser.latestGroupId);
          }
        }
      });

      const csv: any[] = [];
      const header: string[] = [];
      header.push("GROUP");
      header.push("STUDENT", "STUDENT", "STUDENT", "STUDENT");
      csv.push(header.join(","));
      each(groupsArray, (group) => {
        const row: string[] = [];
        row.push(group);
        each(users, (portalUser, userId) => {
          if (portalUser) {
            const classUser = this.stores.class.getUserById(userId);
            if (classUser?.type === "student" && portalUser.latestGroupId === group) {
              row.push(classUser.fullName);
            }
          }
        });
        csv.push(row.join(","));
      });
      this.exportCSV(csv.join("\n"), `${user.className}-student-groups.csv`);
    }
  }

  private exportCSV = (csv: string, fileName: string) => {
    const csvBlob = new Blob([csv], {type: "text/csv;charset=utf-8;"});
    if (navigator.msSaveBlob) {
      navigator.msSaveBlob(csvBlob, fileName);
    }
    else {
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(csvBlob);
      link.setAttribute("download", fileName);
      document.body.appendChild(link);

      link.click();
      document.body.removeChild(link);
    }
  }
}
