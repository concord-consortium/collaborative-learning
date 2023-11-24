import Dialog from "./Dialog";
import TeacherDashboard from "./TeacherDashboard";
import ResourcesPanel from "./ResourcesPanel";

const dialog = new Dialog;
let dashboard = new TeacherDashboard;
let resourcesPanel = new ResourcesPanel;

class Scrolling {

  verifyScrolling(subsection) {
    cy.get('[data-focus-section='+subsection+'] [data-testid=tool-tile]').last().should("not.be.visible");
    cy.get('[data-focus-section='+subsection+'] [data-testid=tool-tile]').last().scrollIntoView({ easing: 'linear' });
    cy.get('[data-focus-section='+subsection+'] [data-testid=tool-tile]').last().should("be.visible");
    cy.get('[data-focus-section='+subsection+'] [data-testid=tool-tile]').first().scrollIntoView({ easing: 'linear' });
    cy.get('[data-focus-section='+subsection+'] [data-testid=tool-tile]').last().should("not.be.visible");
  }
  verifyDashboard() {
    dashboard.getGroupName().eq(0).should('contain', "Group 1");
    dashboard.getGroupName().eq(0).should('not.contain', "Group 9");
    dashboard.getNextPageButton().click({ force: true });
    cy.wait(5000);
    dashboard.getGroupName().eq(0).should('not.contain', "Group 1");
    dashboard.getGroupName().eq(0).should('contain', "Group 9");
    dashboard.getPreviousPageButton().click({ force: true });
    cy.wait(5000);
    dashboard.getGroupName().eq(0).should('contain', "Group 1");
    dashboard.getGroupName().eq(0).should('not.contain', "Group 9");
  }
  verifyScrollingClassWork() {
    cy.get("[data-test=supports-section-teacher-supports-documents] .list-item").last().should("not.be.visible");
    cy.get("[data-test=supports-section-teacher-supports-documents] .list-item").last().scrollIntoView();
    cy.get("[data-test=supports-section-teacher-supports-documents] .list-item").last().should("be.visible").should("contain", "Test Image Publish to This Class v1");
  }

  verifyScrollingWorkspaces() {
    cy.get("[data-test=my-work-section-workspaces-documents] .bottom-panel .list-item").last().should("not.be.visible");
    cy.get("[data-test=my-work-section-workspaces-documents] .bottom-panel .list-item").last().scrollIntoView();
    cy.get("[data-test=my-work-section-workspaces-documents] .bottom-panel .list-item").last().should("be.visible").should("contain", "Mon 4 Sep");
  }
  verifyScrollingMyWorkStarred() {
    resourcesPanel.getCanvasItemTitle('my-work', 'starred').contains("SAS 1.1 Solving a Mystery with Proportional Reasoning").should('exist').click({ force: true });
    cy.wait(5000);
    cy.get(".focus-document.my-work #section_NW").should("not.be.visible");
    cy.get(".focus-document.my-work #section_NW").scrollIntoView();
    cy.get(".focus-document.my-work #section_NW").should("be.visible");
    cy.wait(1000);
  }
  verifyScrollingClassWorkStarred() {
    resourcesPanel.getCanvasItemTitle('class-work', 'starred').contains("Student 5: MSA 1.3 Raising Money").should('exist').click({ force: true });
    cy.wait(5000);
    cy.get(".focus-document.class-work #section_NW").should("not.be.visible");
    cy.get(".focus-document.class-work #section_NW").scrollIntoView();
    cy.get(".focus-document.class-work #section_NW").should("be.visible");
    cy.wait(1000);
  }
  verifyScrollingThumbnailView() {
    cy.get(".class-work .scroll-arrow-button.right").click();
    cy.wait(2000);
    cy.get("[data-test=class-work-section-starred-documents] .list-item").first().should("not.be.visible");
    cy.get("[data-test=class-work-section-starred-documents] .list-item").last().should("be.visible");
    cy.get(".class-work .scroll-arrow-button.left").click();
    cy.wait(2000);
    cy.get(".class-work .scroll-arrow-button.left").click();
    cy.wait(2000);
    cy.get("[data-test=class-work-section-starred-documents] .list-item").first().should("be.visible");
    cy.get("[data-test=class-work-section-starred-documents] .list-item").last().should("not.be.visible");
  }
  verifyScrollingStudentWorkspacesExpandedView() {
    cy.get(".four-up .north-west .tile-row").last().should("not.be.visible");
    cy.get(".four-up .north-west .tile-row").last().scrollIntoView();
    cy.get(".four-up .north-west .tile-row").last().should("be.visible");
  }
  scrollToBottom(element) {
    element.scrollTo('bottom');
  }
  scrollToTop(element) {
    element.scrollTo('top');
  }
}

export default Scrolling;
