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
    const latestGroupsArray: string[] = []; // store the group ids

    const offeringsPath = db.firebase.getOfferingsPath(db.stores.user);
    const offeringsRef = db.firebase.ref(offeringsPath);
    // get a snapshot of the offerings in this class
    const offeringsSnapshot = await offeringsRef.once("value");

    const usersPath = db.firebase.getUsersPath(db.stores.user);
    const usersRef = db.firebase.ref(usersPath);
    // get a snapshot of the users in this class
    const usersSnapshot = await usersRef.once("value");

    if (usersSnapshot && offeringsSnapshot) {
      const csv: any[] = [];
      const header: string[] = [];
      header.push("CLASS NAME");
      header.push("CLASS HASH");
      header.push("TEACHER ID");
      header.push("OFFERING");
      header.push("CURRENT GROUP");
      header.push("STUDENT ID 1", "STUDENT ID 2", "STUDENT ID 3", "STUDENT ID 4", "STUDENT ID 5", "STUDENT ID 6");
      csv.push(header.join(","));

      let first = true;

      // get the groups for each offering
      const offerings = offeringsSnapshot.val();
      each(offerings, (offering, offeringId) => {
        if (offering) {
          each(offering.groups, (group, groupId) => {
            if (group) {
              const row: string[] = [];
              first ? row.push(user.className, user.classHash, user.id) : row.push("", "", "");
              first = false;
              row.push(offeringId);
              row.push(groupId);
              each(group.users, (gUser, uId) => {
                if (gUser) {
                  row.push(uId);
                }
              });
              csv.push(row.join(","));
            }
          });
        }
      });

      // get the current set of groups
      const users = usersSnapshot.val();
      each(users, (portalUser, userId) => {
        // a user is a DBPortalUser in db-types.ts, can be undefined, each has the latestGroupId
        if (portalUser) {
          // classUser contains the user name information
          const classUser = this.stores.class.getUserById(userId);
          if (classUser?.type === "student") {
            if (latestGroupsArray.indexOf(portalUser.latestGroupId) === -1) {
              latestGroupsArray.push(portalUser.latestGroupId);
            }
          }
        }
      });
      // add the current groups to the CSV
      each(latestGroupsArray, (group) => {
        const row: string[] = [];
        row.push("", "", "");
        row.push("CURRENT GROUPS");
        row.push(group);
        each(users, (portalUser, userId) => {
          if (portalUser) {
            const classUser = this.stores.class.getUserById(userId);
            if (classUser?.type === "student" && portalUser.latestGroupId === group) {
              row.push(classUser.id);
            }
          }
        });
        csv.push(row.join(","));
      });

      this.exportCSV(csv.join("\n"), `teacherId-${user.id}-classHash-${user.classHash}-studentGroups.csv`);
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
