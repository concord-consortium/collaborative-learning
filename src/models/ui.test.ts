import { assert, expect } from "chai";
import { getSnapshot } from "mobx-state-tree";
import { UIModel, UIModelType } from "./ui";

describe("ui model", () => {
  let ui: UIModelType;

  before(() => {
    ui = UIModel.create({});
  });

  it("has default values", () => {
    expect(ui.allContracted).to.equal(true);
    expect(ui.learningLogExpanded).to.equal(false);
    expect(ui.leftNavExpanded).to.equal(false);
    expect(ui.myWorkExpanded).to.equal(false);
  });

  it("allows the left nav to be toggled", () => {
    ui.toggleLeftNav();
    expect(ui.allContracted).to.equal(false);
    expect(ui.leftNavExpanded).to.equal(true);
    ui.toggleLeftNav();
    expect(ui.allContracted).to.equal(true);
    expect(ui.leftNavExpanded).to.equal(false);
  });

  it("allows the left nav to be explicitly set", () => {
    ui.toggleLeftNav(false);
    expect(ui.allContracted).to.equal(true);
    expect(ui.leftNavExpanded).to.equal(false);
    ui.toggleLeftNav(true);
    expect(ui.allContracted).to.equal(false);
    expect(ui.leftNavExpanded).to.equal(true);
  });

  it("allows the learning log to be toggled", () => {
    ui.toggleLearningLog();
    expect(ui.allContracted).to.equal(false);
    expect(ui.learningLogExpanded).to.equal(true);
    ui.toggleLearningLog();
    expect(ui.allContracted).to.equal(true);
    expect(ui.learningLogExpanded).to.equal(false);
  });

  it("allows the learning log to be explicitly set", () => {
    ui.toggleLearningLog(false);
    expect(ui.allContracted).to.equal(true);
    expect(ui.learningLogExpanded).to.equal(false);
    ui.toggleLearningLog(true);
    expect(ui.allContracted).to.equal(false);
    expect(ui.learningLogExpanded).to.equal(true);
  });

  it("allows my work to be toggled", () => {
    ui.toggleMyWork();
    expect(ui.allContracted).to.equal(false);
    expect(ui.myWorkExpanded).to.equal(true);
    ui.toggleMyWork();
    expect(ui.allContracted).to.equal(true);
    expect(ui.myWorkExpanded).to.equal(false);
  });

  it("allows my work to be explicitly set", () => {
    ui.toggleMyWork(false);
    expect(ui.allContracted).to.equal(true);
    expect(ui.myWorkExpanded).to.equal(false);
    ui.toggleMyWork(true);
    expect(ui.allContracted).to.equal(false);
    expect(ui.myWorkExpanded).to.equal(true);
  });

  it("only allows one component to be expanded at a time", () => {
    ui.toggleLeftNav();
    expect(ui.leftNavExpanded).to.equal(true);
    expect(ui.learningLogExpanded).to.equal(false);
    expect(ui.myWorkExpanded).to.equal(false);

    ui.toggleLearningLog();
    expect(ui.leftNavExpanded).to.equal(false);
    expect(ui.learningLogExpanded).to.equal(true);
    expect(ui.myWorkExpanded).to.equal(false);

    ui.toggleMyWork();
    expect(ui.leftNavExpanded).to.equal(false);
    expect(ui.learningLogExpanded).to.equal(false);
    expect(ui.myWorkExpanded).to.equal(true);
  });
});
