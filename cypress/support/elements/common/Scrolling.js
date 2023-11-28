import Dialog from "./Dialog";
import TeacherDashboard from "./TeacherDashboard";
import ResourcesPanel from "./ResourcesPanel";

const dialog = new Dialog;
let dashboard = new TeacherDashboard;
let resourcesPanel = new ResourcesPanel;

class Scrolling {

  verifyScrolling(subsection) {
    cy.get('[data-focus-section='+subsection+'] [data-testid=tool-tile]').last().should("not.be.visible");
    cy.get('[data-focus-section='+subsection+'] [data-testid=tool-tile]').last().scrollIntoView();
    cy.get('[data-focus-section='+subsection+'] [data-testid=tool-tile]').last().should("be.visible");
    cy.get('[data-focus-section='+subsection+'] [data-testid=tool-tile]').first().scrollIntoView();
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
    cy.get("[data-test=supports-section-teacher-supports-documents] .list-item").last().should("be.visible").should("contain", "1.1 silly pix");
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
  verifyScrollingMyWorkStarredDoubleFlipperView() {
    resourcesPanel.getCanvasItemTitle('my-work', 'starred').contains("0.1 Intro to CLUE").should('exist').click({ force: true });
    cy.wait(5000);
    cy.get(".focus-document.my-work.secondary #section_NW").should("not.be.visible");
    cy.get(".focus-document.my-work.secondary #section_NW").scrollIntoView();
    cy.get(".focus-document.my-work.secondary #section_NW").should("be.visible");
    cy.wait(1000);
  }
  verifyScrollingMyWorkThumbnailView() {
    cy.get(".my-work .scroller-controls.right .scroll-arrow-button.right").click();
    cy.wait(2000);
    cy.get("[data-test=my-work-section-starred-documents] .list-item").first().should("not.be.visible");
    cy.get(".my-work .scroller-controls.left .scroll-arrow-button.left").click();
    cy.wait(2000);
    cy.get("[data-test=my-work-section-starred-documents] .list-item").first().should("be.visible");
  }
  verifyScrollingClassWorkStarred() {
    resourcesPanel.getCanvasItemTitle('class-work', 'starred').contains("Student 9: SAS 1.1 Solving a Mystery with Proportional Reasoning v3").should('exist').click({ force: true });
    cy.wait(5000);
    cy.get(".focus-document.class-work #section_NW").should("not.be.visible");
    cy.get(".focus-document.class-work #section_NW").scrollIntoView();
    cy.get(".focus-document.class-work #section_NW").should("be.visible");
    cy.wait(1000);
  }
  verifyScrollingClassWorkStarredDoubleFlipperView() {
    resourcesPanel.getCanvasItemTitle('class-work', 'starred').contains("Student 1: SAS 1.1 Solving a Mystery with Proportional Reasoning v2").should('exist').click({ force: true });
    cy.wait(5000);
    cy.get(".focus-document.class-work.secondary #section_NW").should("not.be.visible");
    cy.get(".focus-document.class-work.secondary #section_NW").scrollIntoView();
    cy.get(".focus-document.class-work.secondary #section_NW").should("be.visible");
    cy.wait(1000);
  }
  verifyScrollingThumbnailView() {
    cy.get(".class-work .scroller-controls.right .scroll-arrow-button.right").click();
    cy.wait(2000);
    cy.get("[data-test=class-work-section-starred-documents] .list-item").first().should("not.be.visible");
    cy.get(".class-work .scroller-controls.left .scroll-arrow-button.left").click();
    cy.wait(2000);
    cy.get("[data-test=class-work-section-starred-documents] .list-item").first().should("be.visible");
  }
  verifyScrollingStudentWorkspaces4upView() {
    cy.get(".four-up .north-west .tile-row").last().should("not.be.visible");
      cy.get(".four-up .north-west .tile-row").last().scrollIntoView();
      cy.wait(1000);
      cy.get(".four-up .north-west .tile-row").last().scrollIntoView();
      cy.get(".four-up .north-west .tile-row").last().should("be.visible");
  }
  verifyScrollingStudentWorkspacesExpandedView() {
    cy.get(".four-up .north-east .tile-row").last().should("not.be.visible");
    cy.get(".four-up .north-east .tile-row").last().scrollIntoView();
    cy.get(".four-up .north-east .tile-row").last().should("be.visible");
  }
  scrollToBottom(element) {
    element.scrollTo('bottom');
  }
  scrollToTop(element) {
    element.scrollTo('top');
  }
  verifyScrollingStudentWorkspacesExpandedView() {
    cy.get(".four-up .north-east .tile-row").last().should("not.be.visible");
    cy.get(".four-up .north-east .tile-row").last().scrollIntoView();
    cy.get(".four-up .north-east .tile-row").last().should("be.visible");
  }
  getCanvasItem(tab, section, title) {
    return cy.get('.'+tab+ ' .list.'+section+'.bottom-panel .list-item[data-test='+section+'-list-items]').contains('.footer', title).siblings('.icon-holder').find('.icon-star');
  }
  getCanvasItemWithIndex(tab, section, index) {
    return cy.get('.'+tab+ ' .list.'+section+'.bottom-panel .list-item[data-test='+section+'-list-items]').find('.icon-holder .icon-star').eq(index);
  }
  starCanvasItem(tab, section,title) {
    if(this.getCanvasItem(tab, section,title).invoke("attr", "class").should("not.contain", "starred")) {
      this.getCanvasItem(tab, section,title).click();
      cy.wait(2000);
    }   
  }
  starMultipleCanvasItem(tab, section) {
    let index = 0;
    for(index = 0; index < 10; index++) {
      if(this.getCanvasItemWithIndex(tab, section, index).invoke("attr", "class").should("not.contain", "starred")) {
        this.getCanvasItemWithIndex(tab, section, index).click();
        cy.wait(2000);
      }  
    }   
  }
}

export default Scrolling;
