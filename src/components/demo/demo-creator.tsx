import { inject, observer } from "mobx-react";
import * as React from "react";
import { BaseComponent, IBaseProps } from "../base";
import { InvestigationModelType } from "../../models/curriculum/investigation";
import { ProblemModelType } from "../../models/curriculum/problem";

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

/* istanbul ignore next */
@inject("stores")
@observer
export class DemoCreatorComponment extends BaseComponent<IProps, {}> {
  private problems: IProblemOption[] = [];

  public componentWillMount() {
    const { unit, demo } = this.stores;

    demo.setClass("1", "Class 1");

    unit.investigations.forEach((investigation, iIndex) => {
      investigation.problems.forEach((problem, pIndex) => {
        const title = `${investigation.title}: ${problem.title}: ${problem.subtitle}`;
        const ordinal = `${iIndex + 1}.${pIndex + 1}`;
        this.problems.push({investigation, problem, ordinal, title});
        if (!demo.problemOrdinal) {
          demo.setProblemOrdinal(ordinal);
        }
      });
    });
  }

  public render() {
    const { demo } = this.stores;
    const studentLinks: JSX.Element[] = [];
    const teacherLinks: JSX.Element[] = [];
    const classes: JSX.Element[] = [];
    const selectedProblem = this.problems[demo.problemIndex];

    const problems = this.problems.map((problem) => {
      return <option key={problem.ordinal} value={problem.ordinal}>{problem.title}</option>;
    });

    for (let classIndex = 1; classIndex <= NUM_FAKE_CLASSES; classIndex++) {
      classes.push(<option key={classIndex} value={classIndex}>Class {classIndex}</option>);
    }

    for (let studentIndex = 1; studentIndex <= NUM_FAKE_STUDENTS_VISIBLE; studentIndex++) {
      studentLinks.push(this.createLink("student", studentIndex));
    }

    for (let teacherIndex = 1; teacherIndex <= NUM_FAKE_TEACHERS; teacherIndex++) {
      teacherLinks.push(this.createLink("teacher", teacherIndex));
    }

    return (
      <div className="demo">
        <h1>Demo Creator</h1>
        <div>
          <label>Class:</label> <select className="classes" onChange={this.handleSelectClass}>{classes}</select>
        </div>
        <div>
          <label>Problem:</label> <select className="problems" onChange={this.handleSelectProblem}>{problems}</select>
        </div>
        <h2>Links for {demo.class.name}: {selectedProblem.title}</h2>
        <ul className="student-links">
          {studentLinks}
        </ul>
        <ul className="teacher-links">
          {teacherLinks}
        </ul>
      </div>
    );
  }

  private createLink(userType: string, userIndex: number) {
    const { demo } = this.stores;
    const fakeUser = `${userType}:${userIndex}`;
    const fakeOffering = demo.problemIndex + 1;
    // tslint:disable-next-line:max-line-length
    const href = `?appMode=demo&fakeClass=${demo.class.id}&fakeUser=${fakeUser}&fakeOffering=${fakeOffering}&problem=${demo.problemOrdinal}`;
    return (
      <li key={userIndex}>
        <a href={href} target="_blank">{userType} {userIndex}</a>
      </li>
    );
  }

  private handleSelectProblem = (e: React.ChangeEvent<HTMLSelectElement>) => {
    this.stores.demo.setProblemOrdinal(e.target.value);
    this.stores.demo.setProblemIndex(e.target.selectedIndex);
  }

  private handleSelectClass = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = `${e.target.value}`;
    this.stores.demo.setClass(id, `Class ${id}`);
  }
}
