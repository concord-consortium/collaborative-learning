import { inject, observer } from "mobx-react";
import React from "react";
import { BaseComponent, IBaseProps } from "../base";
import { InvestigationModelType } from "../../models/curriculum/investigation";
import { ProblemModelType } from "../../models/curriculum/problem";
import { parseUrl, stringify } from "query-string";
import { kDemoSiteStorageKey } from "../../models/stores/store-types";

import "./demo-creator.sass";

export const NUM_FAKE_CLASSES = 9;
export const NUM_FAKE_STUDENTS = 99;
export const NUM_FAKE_STUDENTS_VISIBLE = 9;
export const NUM_FAKE_TEACHERS = 3;

interface IProps extends IBaseProps {}

interface IProblemOption {
  investigation: InvestigationModelType;
  problem: ProblemModelType;
  title: string;
  ordinal: string;
}

// Parse incoming URL for pass-through query parameters.
// Pass through any that are not in the exclusion list.
// Emit non-excluded ones as a URL query string (with an ampersand prepended if not empty).
export const passThroughQueryItemsFromUrl = (href: string) => {
  const excludeList = ["demo", "demoName", "fakeClass", "fakeUser", "problem"];
  const incomingUrlQueryPairs = parseUrl(href).query;
  excludeList.forEach((keyToExclude) => {
    delete incomingUrlQueryPairs[keyToExclude];
  });
  const passThroughQueryItems = (Object.keys(incomingUrlQueryPairs).length > 0)
    ? `&${stringify(incomingUrlQueryPairs)}`
    : '';
  return passThroughQueryItems;
};

/* istanbul ignore next */
@inject("stores")
@observer
export class DemoCreatorComponent extends BaseComponent<IProps> {
  private problemOptions: IProblemOption[] = [];

  constructor(props: IProps) {
    super(props);
    this.stores.demo.setClass("1", "Class 1");
  }

  public render() {
    const { appConfig, unit, demo } = this.stores;
    const problemTitleTemplate = appConfig.demoProblemTitle || "%investigationTitle%: %problemTitle%";

    // Assemble the list of problems once unit data has been loaded.
    if (!this.problemOptions.length) {
      unit.investigations.forEach(investigation => {
        investigation.problems.forEach(problem => {
          const title = problemTitleTemplate
                          .replace("%investigationTitle%", investigation.title)
                          .replace("%problemTitle%", problem.fullTitle);
          const ordinal = `${investigation.ordinal}.${problem.ordinal}`;
          this.problemOptions.push({investigation, problem, ordinal, title});
          if (!demo.problemOrdinal) {
            demo.setProblemOrdinal(ordinal);
          }
        });
      });
    }
    if (!this.problemOptions.length) {
      // Did not find any problems in unit; probably unit info hasn't been loaded yet.
      return (<p>Loading...</p>);
    }

    const studentLinks: JSX.Element[] = [];
    const teacherLinks: JSX.Element[] = [];
    const classes: JSX.Element[] = [];
    const selectedProblem = this.problemOptions[demo.problemIndex];

    const passThroughQueryItems = passThroughQueryItemsFromUrl(location.href);

    const problems = this.problemOptions.map((problem) => {
      return <option key={problem.ordinal} value={problem.ordinal}>{problem.title}</option>;
    });

    for (let classIndex = 1; classIndex <= NUM_FAKE_CLASSES; classIndex++) {
      classes.push(<option key={classIndex} value={classIndex}>Class {classIndex}</option>);
    }

    for (let studentIndex = 1; studentIndex <= NUM_FAKE_STUDENTS_VISIBLE; studentIndex++) {
      studentLinks.push(this.createLink("student", studentIndex, passThroughQueryItems));
    }

    for (let teacherIndex = 1; teacherIndex <= NUM_FAKE_TEACHERS; teacherIndex++) {
      teacherLinks.push(this.createLink("teacher", teacherIndex, passThroughQueryItems));
    }

    return (
      <div className="demo">
        <h1>Demo Creator</h1>
        <div>
          <label>Name:</label>
          <input type="text" onChange={this.handleSetName} defaultValue={demo.name} />
        </div>
        <div>
          <label>Class:</label>
          <select className="classes" data-test="class-select" onChange={this.handleSelectClass}>
            {classes}
          </select>
        </div>
        <div>
          <label>Problem:</label>
          <select className="problems" data-test="problem-select" onChange={this.handleSelectProblem}>
            {problems}
          </select>
        </div>
        <h2>Links for {demo.class.name}: {selectedProblem?.title||''}</h2>
        <ul className="student-links">
          {studentLinks}
        </ul>
        <ul className="teacher-links">
          {teacherLinks}
        </ul>
      </div>
    );
  }

  private createLink(userType: string, userIndex: number, passThroughQueryItems: string) {
    const { demo } = this.stores;
    const demoNameParam = demo.name ? `&demoName=${demo.name}` : "";
    const fakeUser = `${userType}:${userIndex}`;
    // eslint-disable-next-line max-len
    const href = `?appMode=demo${demoNameParam}&fakeClass=${demo.class.id}&fakeUser=${fakeUser}&problem=${demo.problemOrdinal}${passThroughQueryItems}`;
    return (
      <li key={userIndex}>
        <a href={href} target="_blank" rel="noreferrer">{userType} {userIndex}</a>
      </li>
    );
  }

  private handleSelectProblem = (e: React.ChangeEvent<HTMLSelectElement>) => {
    this.stores.demo.setProblemOrdinal(e.target.value);
    this.stores.demo.setProblemIndex(e.target.selectedIndex);
  };

  private handleSelectClass = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = `${e.target.value}`;
    this.stores.demo.setClass(id, `Class ${id}`);
  };

  private handleSetName = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value.trim();
    this.stores.demo.setName(name);
    if (name) {
      try {
        window.localStorage.setItem(kDemoSiteStorageKey, name);
      } catch (error) {
        console.warn("Unable to save demo name; perhaps localStorage is disabled:", error);
      }
    }
  };
}
