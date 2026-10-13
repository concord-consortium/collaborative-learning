/**
 * The Timeline tile's event marks and Event Key, against the fixture in QA investigation 4.
 *
 * These cover what jsdom cannot: jsdom applies no stylesheets and computes no layout, so it cannot
 * tell a rectangle coloured from its icon from one coloured from the pale button colour, nor a
 * narrow event that degenerates to a line from one that renders as a bordered blob.
 *
 * The fixture holds ten events over one day across seven types. Events 2 and 5 are a couple of
 * minutes long, far below a pixel at this zoom, so they are the degenerate case.
 *
 * Switching a type off is not exercised here. An authored tile can only live in the curriculum
 * Problem panel, which is read-only, and a read-only tile has no drag handle to copy it into the
 * workspace with — so there is no editable Timeline holding events for Cypress to click. That
 * behaviour is covered by Jest instead: `timeline-key.test.tsx` for the checkbox, and
 * `timeline-content.test.ts` and `full-timeline.test.tsx` for what it hides.
 */
function beforeTest() {
  const queryParams = `${Cypress.config("qaUnitStudent8Investigation4")}`;
  cy.visit(queryParams);
  cy.waitForLoad();
  cy.get(".timeline-tile", { timeout: 30000 }).should("exist");
}

context("Timeline event marks and Event Key", () => {
  it("draws every event, and lists each type in the Event Key", () => {
    beforeTest();

    cy.log("ten events, numbered from one");
    cy.get(".event-label-button").should("have.length", 10);
    cy.get(".event-label-button").first().should("have.text", "1");
    cy.get(".event-label-button").last().should("have.text", "10");

    cy.log("each of the six colour words is used, and a seventh type falls back to the default");
    ["blue", "orange", "red", "yellow", "magenta", "purple", "default"].forEach(word => {
      cy.get(`.event-overlay.${word}-event`).should("exist");
    });

    // eventTypeColorWords hands out six colour words, so a seventh type draws with the default
    // grey "?" but gets no Event Key entry. The seventh colour belongs to the student-defined
    // events story; see the CLUE-671 design doc's Known Edges.
    cy.log("the key lists the types that have a colour");
    cy.get(".timeline-key .event-type-entry").should("have.length", 6);
    cy.get(".timeline-key").should("contain.text", "Avalanche").and("contain.text", "Landslide");
  });

  it("colours a rectangle from its icon colour, not the pale button colour", () => {
    beforeTest();

    // $blue-select. The button beside it stays $blue-base, so a rule that coloured both from the
    // same variable would fail one of these.
    cy.get(".event-overlay.blue-event").first()
      .should("have.css", "border-top-color", "rgb(66, 166, 255)")
      .and("have.css", "background-color", "rgba(66, 166, 255, 0.4)");
    cy.get(".event-label-button.blue-event").first()
      .should("have.css", "background-color", "rgb(170, 215, 255)");
  });

  it("draws an event too narrow to fill as a single line in the outline colour", () => {
    beforeTest();

    // Event 2 spans three minutes of a one-day view. The telling measure is the content box: a
    // degenerate event has none at all, so what shows is border only, in the outline colour. A
    // rectangle that lost its border, or stopped being border-box, would fail this.
    cy.get(".event-overlay.orange-event").first().then($el => {
      const el = $el[0];
      expect(el.getBoundingClientRect().width, "outer width").to.be.closeTo(2, 0.5);
      expect(el.clientWidth, "interior width").to.equal(0);
    });

    cy.log("a wide event keeps an interior for its translucent fill");
    cy.get(".event-overlay.blue-event").first().then($el => {
      expect($el[0].clientWidth, "interior width").to.be.greaterThan(10);
    });
  });

  it("leaves the Event Key inert in the read-only Problem panel", () => {
    beforeTest();

    // A read-only pane shares the document model, so a live checkbox there would edit content the
    // reader does not own. The marks are still drawn; only the controls are dead.
    cy.get(".nav-tab-panel .timeline-key input[type=checkbox]").should("be.disabled");
    cy.get(".nav-tab-panel .event-overlay").should("have.length", 10);
  });

  it("fits the tile without scrolling at its default height", () => {
    beforeTest();

    cy.get(".timeline-tile").then($el => {
      const el = $el[0];
      expect(el.scrollHeight, "vertical overflow").to.be.at.most(el.clientHeight + 1);
      expect(el.scrollWidth, "horizontal overflow").to.be.at.most(el.clientWidth + 1);
    });
  });
});
