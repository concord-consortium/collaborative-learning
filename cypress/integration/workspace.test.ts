context("Test the overall workspace", () => {
  before(() => {
      cy.visit("/?appMode=qa&fakeClass=2783&fakeUser=student:1&fakeOffering=43&qaGroup=1&problem=1.1");
  });

  describe("Desktop functionalities", () => {
      it("will verify that clicking on tab closes the nav area", () => {
          const tabSelector: string = ".left-nav > .tabs > .tab:first"; // TypeScript works
          cy.get(tabSelector).click({force: true}); // left nav expand area should be visible
          cy.get(".left-nav.expanded").should("be.visible");
          cy.get(tabSelector).click({force: true}); // left nav expand area should not be visible
          cy.get(".left-nav.expanded").should("not.be.visible");

          cy.get("#rightNavTabMy\\ Work").click(); // my work expand area should be visible
          cy.get(".right-nav>.tabs.expanded").should("be.visible");
          cy.get("#rightNavTabMy\\ Work").click(); // my work expand area should not be visible
          cy.get(".right-nav>.tabs.expanded").should("not.be.visible");

          cy.get("#learningLogTab").click(); // learning log expand area should be visible
          cy.get(".bottom-nav.expanded").should("be.visible");
          cy.get("#learningLogTab").click(); // learning log expand area should not be visible
          cy.get(".bottom-nav.expanded").should("not.be.visible");
      });

      it("will verify that left nav area is closes when other tabs are opened", () => {
          // should this be tab closes when no longer in that area? my work and left nav
          cy.get(".left-nav > .tabs > .tab:first").click(); // left nav expand area should be visible
          cy.get(".left-nav.expanded").should("be.visible");
          cy.get(".right-nav>.tabs.expanded").should("not.be.visible");
          cy.get(".bottom-nav.expanded").should("not.be.visible");
          cy.get("#rightNavTabMy\\ Work").click(); // my work expand area should be visible
          cy.get(".left-nav.expanded").should("not.be.visible");
          cy.get(".right-nav>.tabs.expanded").should("be.visible");
          cy.get(".bottom-nav.expanded").should("not.be.visible");
          cy.get("#learningLogTab").click(); // learning log expand area should be visible
          cy.get(".left-nav.expanded").should("not.be.visible");
          cy.get(".right-nav>.tabs.expanded").should("be.visible");
          cy.get(".bottom-nav.expanded").should("be.visible");
          // close all tabs to clear workspace for next test
          cy.get("#learningLogTab").click(); // learning log expand area should be visible
          cy.get("#rightNavTabMy\\ Work").click(); // my work expand area should be visible
      });

      it("will verify that My Work tab is still visible and clickable when Learning Log is expanded", () => {
          cy.get("#learningLogTab").click(); // learning log expand area should be visible
          cy.get(".bottom-nav.expanded").should("be.visible");
          cy.get("#rightNavTabMy\\ Work").should("be.visible");
          cy.get("#rightNavTabMy\\ Work").click();
          cy.get(".right-nav>.tabs.expanded").should("be.visible");
      });

  });
});
