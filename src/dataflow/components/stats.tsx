import { inject, observer } from "mobx-react";
import { BaseComponent, IBaseProps } from "./dataflow-base";
import React from "react";
import { exportCSV } from "../utilities/export";
import { each } from "lodash";
import "./stats.sass";

export interface StatsGroup {
  userId: string;
  userName: string;
  documents: number;
  programDocuments: number;
  runProgramDocuments: number;
  runProgramDataDocuments: number;
  runProgramRelayDocuments: number;
  runProgramRelayOnlyDocuments: number;
  publishedProgramDocuments: number;
}

interface IProps extends IBaseProps {}

interface IState {
  loading: boolean;
  userStats: StatsGroup[];
}

const kHeaderNames = ["Documents", "Editable Programs", "Run Programs", "Run Programs with Data",
                      "Run Programs with Relay", "Run Programs Relay-Only", "Published Data Programs"];

@inject("stores")
@observer
export class StatsComponent extends BaseComponent<IProps, IState> {
  private _isMounted: boolean;

  constructor(props: IProps) {
    super(props);
    this.state = {
      loading: true,
      userStats: [],
    };
  }

  public async componentDidMount() {
    this._isMounted = true;
    const {db} = this.stores;
    // request the published documents
    const publicationsPath = db.firebase.getClassPersonalPublicationsPath(db.stores.user);
    const publicationsRef = db.firebase.ref(publicationsPath);
    const publicationsSnapshot = await publicationsRef.once("value");
    const publishedDocOriginIds: Set<string> = new Set();
    if (publicationsSnapshot) {
      const publishedDocs = publicationsSnapshot.val();
      each(publishedDocs, publishedDoc => {
        publishedDocOriginIds.add(publishedDoc.originDoc);
      });
    }

    // request the users
    const usersPath = db.firebase.getUsersPath(db.stores.user);
    const usersRef = db.firebase.ref(usersPath);
    const usersSnapshot = await usersRef.once("value");
    if (usersSnapshot) {
      const users = usersSnapshot.val();
      const userStats: StatsGroup[] = [];
      each(users, (userEntry, userId) => {
        const user = this.stores.class.getUserById(userId);
        if (user?.type === "student") {
          const statsGroup: StatsGroup = {
            userId,
            userName: user.fullName,
            documents: 0,
            programDocuments: 0,
            runProgramDocuments: 0,
            runProgramDataDocuments: 0,
            runProgramRelayDocuments: 0,
            runProgramRelayOnlyDocuments: 0,
            publishedProgramDocuments: 0
          };
          each(userEntry.personalDocs, document => {
            // determine if this document is a published document
            if (publishedDocOriginIds.has(document.self.documentKey)) {
              statsGroup.publishedProgramDocuments++;
            }
            // determine if this is a run program
            if (document.properties?.dfRunId) {
              statsGroup.runProgramDocuments++;
              if (document.properties?.dfHasData) {
                statsGroup.runProgramDataDocuments++;
              }
              if (document.properties?.dfHasRelay) {
                statsGroup.runProgramRelayDocuments++;
              }
              if (document.properties?.dfHasRelay && !document.properties?.dfHasData) {
                statsGroup.runProgramRelayOnlyDocuments++;
              }
            } else {
              statsGroup.programDocuments++;
            }
            statsGroup.documents++;
          });
          userStats.push(statsGroup);
        }
      });
      this._isMounted && this.setState({ loading: false, userStats });
    }
  }

  public componentWillUnmount() {
    this._isMounted = false;
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
      userId: "",
      userName: String(this.state.userStats.length),
      documents: 0,
      programDocuments: 0,
      runProgramDocuments: 0,
      runProgramDataDocuments: 0,
      runProgramRelayDocuments: 0,
      runProgramRelayOnlyDocuments: 0,
      publishedProgramDocuments: 0
    };
    this.state.userStats.forEach(stats => {
      totals.documents = totals.documents + stats.documents;
      totals.programDocuments = totals.programDocuments + stats.programDocuments;
      totals.runProgramDocuments = totals.runProgramDocuments + stats.runProgramDocuments;
      totals.runProgramDataDocuments = totals.runProgramDataDocuments + stats.runProgramDataDocuments;
      totals.runProgramRelayDocuments = totals.runProgramRelayDocuments + stats.runProgramRelayDocuments;
      totals.runProgramRelayOnlyDocuments = totals.runProgramRelayOnlyDocuments + stats.runProgramRelayOnlyDocuments;
      totals.publishedProgramDocuments = totals.publishedProgramDocuments + stats.publishedProgramDocuments;
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
              <td className="stat-cell">{totals.runProgramRelayDocuments}</td>
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
              <td className="stat-cell">{(totals.runProgramRelayDocuments / numUsers).toFixed(2)}</td>
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
          <tr className="stat-row" key={statGroup.userId}>
            <td className="stat-cell">{statGroup.userName}</td>
            <td className="stat-cell">{statGroup.documents}</td>
            <td className="stat-cell">{statGroup.programDocuments}</td>
            <td className="stat-cell">{statGroup.runProgramDocuments}</td>
            <td className="stat-cell">{statGroup.runProgramDataDocuments}</td>
            <td className="stat-cell">{statGroup.runProgramRelayDocuments}</td>
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
      row.push(statGroup.userName);
      row.push(statGroup.documents.toString());
      row.push(statGroup.programDocuments.toString());
      row.push(statGroup.runProgramDocuments.toString());
      row.push(statGroup.runProgramDataDocuments.toString());
      row.push(statGroup.runProgramRelayDocuments.toString());
      row.push(statGroup.runProgramRelayOnlyDocuments.toString());
      row.push(statGroup.publishedProgramDocuments.toString());
      csv.push(row.join(","));
    });
    exportCSV(csv.join("\n"), "classroom-stats.csv");
  }

}
