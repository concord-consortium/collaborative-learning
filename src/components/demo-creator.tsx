import { inject, observer } from "mobx-react";
import * as React from "react";
import { BaseComponent, IBaseProps } from "./base";
import { InvestigationModelType } from "../models/curriculum/investigation";
import { ProblemModelType } from "../models/curriculum/problem";

import "./demo-creator.sass";

export const NUM_DEMO_CLASSES = 9;
export const NUM_DEMO_STUDENTS = 9;
export const NUM_DEMO_TEACHERS = 3;

interface IProps extends IBaseProps {}

interface IProblemOption {
  investigation: InvestigationModelType;
  problem: ProblemModelType;
  title: string;
  ordinal: string;
}

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
      return <option key={problem.ordinal}>{problem.title}</option>;
    });

    for (let classIndex = 1; classIndex <= NUM_DEMO_CLASSES; classIndex++) {
      classes.push(<option key={classIndex}>Class {classIndex}</option>);
    }

    for (let studentIndex = 1; studentIndex <= NUM_DEMO_STUDENTS; studentIndex++) {
      studentLinks.push(this.createLink("student", studentIndex));
    }

    for (let teacherIndex = 1; teacherIndex <= NUM_DEMO_TEACHERS; teacherIndex++) {
      teacherLinks.push(this.createLink("teacher", teacherIndex));
    }

    return (
      <div className="demo">
        <h1>Demo Creator</h1>
        <div>
          <label>Class:</label> <select onChange={this.handleSelectClass}>{classes}</select>
        </div>
        <div>
          <label>Problem:</label> <select onChange={this.handleSelectProblem}>{problems}</select>
        </div>
        <h2>Links for {demo.class.name}: {selectedProblem.title}</h2>
        <ul>
          {studentLinks}
        </ul>
        <ul>
          {teacherLinks}
        </ul>
      </div>
    );
  }

  private createLink(userType: string, userIndex: number) {
    const { demo } = this.stores;
    const demoUser = `${userType}:${userIndex}`;
    const demoOffering = demo.problemIndex + 1;
    // tslint:disable-next-line:max-line-length
    const href = `?appMode=demo&demoClass=${demo.class.id}&demoUser=${demoUser}&demoOffering=${demoOffering}&problem=${demo.problemOrdinal}`;
    return (
      <li key={userIndex}>
        <a href={href} target="_blank">{userType} {userIndex}</a>
      </li>
    );
  }

  private handleSelectProblem = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const problem = this.problems[e.target.selectedIndex];
    this.stores.demo.setProblemOrdinal(problem.ordinal);
    this.stores.demo.setProblemIndex(e.target.selectedIndex);
  }

  private handleSelectClass = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = `${e.target.selectedIndex + 1}`;
    this.stores.demo.setClass(id, `Class ${id}`);
  }
}
