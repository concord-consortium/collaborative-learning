/**
 * Keyboard navigation tests for the My Work tab.
 *
 * - Tabbing reaches a document thumbnail (.list-item) and lands on its
 *   bookmark button on the next tab.
 * - Enter on a focused list item opens the document.
 * - Enter on a focused bookmark toggles the starred state.
 * - Tabbing never enters the embedded canvas (which is marked inert).
 * - Clicking the inert canvas region still opens the document, since the
 *   click bubbles to the parent .list-item.
 */

const queryParamsStudent = Cypress.config("qaUnitStudent5");

function visitMyWork() {
  cy.visit(queryParamsStudent);
  cy.waitForLoad();
  cy.openTopTab("my-work");
  cy.openSection("my-work", "workspaces");
  cy.get(".documents-list.workspaces .list-item").should("have.length.greaterThan", 0);
}

// Press Tab repeatedly until cy.focused() matches `selector`, up to maxTabs times.
// Don't enumerate tab stops in tests — they're brittle to UI churn.
function tabUntil(selector, maxTabs = 60) {
  function step(remaining) {
    if (remaining === 0) {
      throw new Error(`tabUntil: did not reach ${selector} within ${maxTabs} tabs`);
    }
    cy.realPress("Tab");
    cy.focused().then(($el) => {
      if (!$el.is(selector)) {
        step(remaining - 1);
      }
    });
  }
  step(maxTabs);
}

context("My Work tab — keyboard navigation", function () {
  beforeEach(function () {
    visitMyWork();
  });

  it("places focus on a list item after tabbing in from the My Work tab", function () {
    cy.get(".top-tab.tab-my-work").focus();
    tabUntil(".list-item");
    cy.focused().should("have.attr", "role", "button");
    cy.focused().invoke("attr", "aria-label").should("not.be.empty");
  });

  it("places focus on the bookmark button on the next tab after a list item", function () {
    cy.get(".documents-list.workspaces .list-item").first().as("firstItem");
    cy.get("@firstItem").focus();
    cy.realPress("Tab");
    cy.focused().should("have.attr", "data-testid", "bookmark-button");
    // The bookmark button is a sibling of the .list-item (both wrapped by
    // .list-item-container), so correlate them via that shared parent.
    cy.focused().then(($focused) => {
      cy.get("@firstItem").then(($firstItem) => {
        expect($focused.closest(".list-item-container")[0])
          .to.equal($firstItem.closest(".list-item-container")[0]);
      });
    });
  });

  it("opens the document when Enter is pressed on a focused list item", function () {
    cy.get(".documents-list.workspaces .list-item").first().focus();
    cy.realPress("Enter");
    cy.get(".primary-workspace .editable-document-content").should("be.visible");
  });

  it("toggles bookmark state when Enter is pressed on a focused bookmark button", function () {
    // The bookmark button is a sibling of .list-item, both inside
    // .list-item-container. Scope queries to the first container so the test
    // is unambiguous about which item's bookmark we're toggling.
    cy.get(".documents-list.workspaces .list-item-container").first().as("container");
    cy.get("@container").find('[data-testid="bookmark-button"]').as("bookmark");

    cy.get("@bookmark").then(($btn) => {
      const wasStarred = $btn.find(".icon-star").hasClass("starred");
      cy.get("@bookmark").focus();
      cy.realPress("Enter");
      cy.get("@container").find(".icon-star")
        .should(wasStarred ? "not.have.class" : "have.class", "starred");
    });
  });

  it("does not move focus into the embedded canvas during keyboard navigation", function () {
    // Start with focus on the first list item, then tab forward. At every
    // stop, assert focus is not inside the inert canvas region. Stop when
    // focus leaves the documents list — that means we've traversed all items
    // and their bookmark buttons. A safety limit guards against UI bugs that
    // could trap focus inside the list forever.
    cy.get(".documents-list.workspaces .list-item").first().focus();
    const safetyLimit = 200;
    function step(remaining) {
      if (remaining === 0) throw new Error("tab loop did not exit the documents-list");
      cy.focused().then(($el) => {
        expect(
          $el.closest(".scaled-list-item-container").length,
          "focus should not enter the inert canvas region"
        ).to.eq(0);
        if ($el.closest(".documents-list.workspaces").length > 0) {
          cy.realPress("Tab");
          step(remaining - 1);
        }
      });
    }
    step(safetyLimit);
  });

  it("opens the document when the inert canvas region is clicked (event bubbles to .list-item)", function () {
    cy.get(".documents-list.workspaces .list-item").first()
      .find(".scaled-list-item-container")
      .click({ force: true });
    cy.get(".primary-workspace .editable-document-content").should("be.visible");
  });
});
