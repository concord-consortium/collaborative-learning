import ResourcesPanel from '../../../support/elements/common/ResourcesPanel';
import SortedWork from '../../../support/elements/common/SortedWork';

const resourcesPanel = new ResourcesPanel;
const sortWork = new SortedWork;

// This unit declares a class-wide document and leaves group documents off. That combination is what
// the workspace's reopen path has to cover: a class-wide document can be the primary document even
// though the unit has no group documents at all.
const unit = "./demo/units/qa-class-wide/content.json";
const studentUrl = `/?appMode=qa&qaGroup=90&fakeClass=90&fakeUser=student:90&problem=1.1&unit=${unit}`;

// The title the unit authors for its one class-wide slot.
const classWideTitle = "Driving Question Board";
const problemTitle = "1.1 Class-Wide Documents";

function openClassWideDocumentInWorkspace() {
  cy.openTopTab("sort-work");
  cy.get(".section-header-arrow").click({ multiple: true });
  // The whole class converges on one document per declared slot, so the section holds exactly one.
  sortWork.getSortWorkGroup("Whole Class").find(".list-item").should("have.length", 1);
  sortWork.getSortWorkGroup("Whole Class").find(".list-item .footer .info")
    .contains(classWideTitle).click();
  resourcesPanel.getEditableDocumentContent().should("be.visible");
  resourcesPanel.getDocumentEditButton().click();
  // Close it in Sort Work again. Sort Work re-opens whichever document it had open, so leaving it
  // open there would load the document on reload no matter what the workspace does.
  cy.get(".close-doc-button").click();
}

function getPrimaryDocumentTitle() {
  return cy.get(".primary-workspace [data-test=document-title]");
}

describe("class-wide documents", () => {
  it("keeps a class-wide document as the primary document across a reload", () => {
    cy.visit(studentUrl);
    cy.waitForLoad();

    cy.log("the workspace starts on the problem document");
    getPrimaryDocumentTitle().should("contain", problemTitle);

    cy.log("editing the class-wide document from Sort Work makes it the primary document");
    openClassWideDocumentInWorkspace();
    getPrimaryDocumentTitle().should("contain", classWideTitle);

    cy.log("the primary document key is saved before we navigate away");
    cy.window().its("stores.persistentUI.problemWorkspace.primaryDocumentKey").should("exist");
    cy.wait(2000);

    cy.log("after a reload the class-wide document is opened again, not replaced");
    cy.visit(studentUrl);
    cy.waitForLoad();
    getPrimaryDocumentTitle().should("contain", classWideTitle);
  });
});
