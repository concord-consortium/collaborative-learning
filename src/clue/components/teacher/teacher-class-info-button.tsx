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
      csv.push([`CLASS NAME: ${user.className}`]);
      csv.push(`CLASS HASH: ${user.classHash}`);
      csv.push(`TEACHER ID: ${user.id}`);

      csv.push([]);
      csv.push(["CURRENT GROUPS"]);
      const header: string[] = [];
      header.push("CURRENT GROUP");
      header.push("STUDENT ID", "STUDENT ID", "STUDENT ID", "STUDENT ID", "STUDENT ID", "STUDENT ID");
      csv.push(header.join(","));

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
      // now add the current groups to the CSV
      each(latestGroupsArray, (group) => {
        const row: string[] = [];
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

      // now get the groups for each offering
      if (offeringsSnapshot) {
        const offerings = offeringsSnapshot.val();
        each(offerings, (offering, offeringId) => {
          if (offering) {

            csv.push([]);
            csv.push([`OFFERING: ${offeringId}`]);
            const offHeader: string[] = [];
            offHeader.push("OFFERING GROUP");
            offHeader.push("STUDENT ID", "STUDENT ID", "STUDENT ID", "STUDENT ID", "STUDENT ID", "STUDENT ID");
            csv.push(header.join(","));

            each(offering.groups, (group, groupId) => {
              if (group) {
                const row: string[] = [];
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
      }

      this.exportCSV(csv.join("\n"), `TeacherID-${user.id}-ClassHash-${user.classHash}-student-groups.csv`);
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
