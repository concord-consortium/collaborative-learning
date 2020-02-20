import { inject, observer } from "mobx-react";
import { BaseComponent, IBaseProps } from "./dataflow-base";
import * as React from "react";
import { exportCSV } from "../utilities/export";
import "./stats.sass";

export interface StatsGroup {
  studentName: string;
  documents: number;
  programDocuments: number;
  runProgramDocuments: number;
  runProgramDataDocuments: number;
  runProgramRelayOnlyDocuments: number;
  publishedProgramDocuments: number;
}

interface IProps extends IBaseProps {}

interface IState {
  loading: boolean;
  userStats: StatsGroup[];
}

const kHeaderNames = ["Documents", "Editable Programs", "Run Programs",
                      "Run Programs w/ Data", "Run Programs Relay-Only", "Published Programs"];

@inject("stores")
@observer
export class StatsComponent extends BaseComponent<IProps, IState> {

  constructor(props: IProps) {
    super(props);
    this.state = {
      loading: true,
      userStats: [],
    };
  }

  public async componentDidMount() {
    const {db} = this.stores;
    // request the published documents
    const publicationsPath = db.firebase.getClassPersonalPublicationsPath(db.stores.user);
    const publicationsRef = db.firebase.ref(publicationsPath);
    const publicationsSnapshot = await publicationsRef.once("value");
    const publishedDocOriginIds: string[] = [];
    if (publicationsSnapshot) {
      const pulishedDocs = publicationsSnapshot.val();
      Object.keys(pulishedDocs).forEach((pulishedDoc) => {
        const pulishedDocEntry = pulishedDocs[pulishedDoc];
        if (!publishedDocOriginIds.find(originDoc => originDoc === pulishedDocEntry.originDoc)) {
          publishedDocOriginIds.push(pulishedDocEntry.originDoc);
        }
      });
    }

    // request the users
    const usersPath = db.firebase.getUsersPath(db.stores.user);
    const usersRef = db.firebase.ref(usersPath);
    const usersSnapshot = await usersRef.once("value");
    if (usersSnapshot) {
      const users = usersSnapshot.val();
      const userStats: StatsGroup[] = [];

      Object.keys(users).forEach((userId) => {
        const user = this.stores.class.getUserById(userId);
        if (user && user.type === "student") {
          const statsGroup: StatsGroup = {
            studentName: user.fullName,
            documents: 0,
            programDocuments: 0,
            runProgramDocuments: 0,
            runProgramDataDocuments: 0,
            runProgramRelayOnlyDocuments: 0,
            publishedProgramDocuments: 0
          };

          const userEntry = users[userId];
          Object.keys(userEntry.personalDocs).forEach((pDoc) => {
            const document = userEntry.personalDocs[pDoc];

            // determine if this document is a published document
            if (publishedDocOriginIds.find(originDoc => originDoc === document.self.documentKey)) {
              statsGroup.publishedProgramDocuments++;
            }

            // determine if this is a run program
            if (document.properties && document.properties.dfRunId) {
              statsGroup.runProgramDocuments++;
              document.properties.dfHasData
                ? statsGroup.runProgramDataDocuments++
                : statsGroup.runProgramRelayOnlyDocuments++;
            } else {
              statsGroup.programDocuments++;
            }
            statsGroup.documents++;
          });
          userStats.push(statsGroup);
        }
      });
      this.setState({ loading: false, userStats });
    }
  }

  public render() {
    return (
      <div className="stats">
        <div className="stats-title">
        Classroom Statistics
        </div>
        { this.state.loading
          ? <div className="loading">Loading classroom statistics...</div>
          : this.renderStats()
        }
      </div>
    );
  }

  private renderStats() {
    return (
      <div className="stats-container">
        { this.renderTotalStats() }
        { this.renderAverageStats() }
        { this.renderUserStats() }
        <button className="stats-button export" onClick={this.handleExport}>Export Student Stats (csv)</button>
      </div>
    );
  }

  private getStatTotals() {
    const totals: StatsGroup = {
      studentName: "",
      documents: 0,
      programDocuments: 0,
      runProgramDocuments: 0,
      runProgramDataDocuments: 0,
      runProgramRelayOnlyDocuments: 0,
      publishedProgramDocuments: 0
    };
    this.state.userStats.forEach(stats => {
      totals.documents = totals.documents ? totals.documents + stats.documents : stats.documents;
      totals.programDocuments = totals.programDocuments
        ? totals.programDocuments + stats.programDocuments
        : stats.programDocuments;
      totals.runProgramDocuments = totals.runProgramDocuments
        ? totals.runProgramDocuments + stats.runProgramDocuments
        : stats.runProgramDocuments;
      totals.runProgramDataDocuments = totals.runProgramDataDocuments
        ? totals.runProgramDataDocuments + stats.runProgramDataDocuments
        : stats.runProgramDataDocuments;
      totals.runProgramRelayOnlyDocuments = totals.runProgramRelayOnlyDocuments
        ? totals.runProgramRelayOnlyDocuments + stats.runProgramRelayOnlyDocuments
        : stats.runProgramRelayOnlyDocuments;
      totals.publishedProgramDocuments = totals.publishedProgramDocuments
        ? totals.publishedProgramDocuments + stats.publishedProgramDocuments
        : stats.publishedProgramDocuments;
    });
    return totals;
  }

  private renderTotalStats() {
    const numUsers = this.state.userStats.length;
    const totals = this.getStatTotals();
    return (
      <div className="stats-table">
        Class Totals
        <table>
          <tbody>
            <tr className="header-row">
              <th>Students</th>
              { this.renderTableHeaders() }
            </tr>
            <tr className="stat-row">
              <td className="stat-cell">{numUsers}</td>
              <td className="stat-cell">{totals.documents}</td>
              <td className="stat-cell">{totals.programDocuments}</td>
              <td className="stat-cell">{totals.runProgramDocuments}</td>
              <td className="stat-cell">{totals.runProgramDataDocuments}</td>
              <td className="stat-cell">{totals.runProgramRelayOnlyDocuments}</td>
              <td className="stat-cell">{totals.publishedProgramDocuments}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  private renderAverageStats() {
    const numUsers = this.state.userStats.length;
    const totals = this.getStatTotals();
    return (
      <div className="stats-table">
        Per Student Averages
        <table>
          <tbody>
            <tr>
              { this.renderTableHeaders() }
            </tr>
            <tr className="stat-row">
              <td className="stat-cell">{(totals.documents / numUsers).toFixed(2)}</td>
              <td className="stat-cell">{(totals.programDocuments / numUsers).toFixed(2)}</td>
              <td className="stat-cell">{(totals.runProgramDocuments / numUsers).toFixed(2)}</td>
              <td className="stat-cell">{(totals.runProgramDataDocuments / numUsers).toFixed(2)}</td>
              <td className="stat-cell">{(totals.runProgramRelayOnlyDocuments / numUsers).toFixed(2)}</td>
              <td className="stat-cell">{(totals.publishedProgramDocuments / numUsers).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  private renderUserStats() {
    return (
      <div className="stats-table">
        Individual Students
        <table>
          <tbody>
            <tr>
              <th>Students</th>
              { this.renderTableHeaders() }
            </tr>
            { this.renderUserStatRows() }
          </tbody>
        </table>
      </div>
    );
  }

  private renderTableHeaders() {
    return (
      kHeaderNames.map((header, i) => {
        return (<th key={i}>{header}</th>);
      })
    );
  }

  private renderUserStatRows() {
    return (
      this.state.userStats.map((statGroup, i) => {
        return (
          <tr className="stat-row" key={i}>
            <td className="stat-cell">{statGroup.studentName}</td>
            <td className="stat-cell">{statGroup.documents}</td>
            <td className="stat-cell">{statGroup.programDocuments}</td>
            <td className="stat-cell">{statGroup.runProgramDocuments}</td>
            <td className="stat-cell">{statGroup.runProgramDataDocuments}</td>
            <td className="stat-cell">{statGroup.runProgramRelayOnlyDocuments}</td>
            <td className="stat-cell">{statGroup.publishedProgramDocuments}</td>
          </tr>
        );
      })
    );
  }

  private handleExport = () => {
    const csv: any[] = [];
    const header: string[] = [];
    header.push("Student");
    kHeaderNames.forEach(headerName => { header.push(headerName); });
    csv.push(header.join(","));

    this.state.userStats.forEach(statGroup => {
      const row: string[] = [];
      row.push(statGroup.studentName);
      row.push(statGroup.documents.toString());
      row.push(statGroup.programDocuments.toString());
      row.push(statGroup.runProgramDocuments.toString());
      row.push(statGroup.runProgramDataDocuments.toString());
      row.push(statGroup.runProgramRelayOnlyDocuments.toString());
      row.push(statGroup.publishedProgramDocuments.toString());
      csv.push(row.join(","));
    });
    exportCSV(csv.join("\n"), "classroom-stats.csv");
  }

}
