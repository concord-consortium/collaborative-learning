/**
 * The Timeline tile's event marks and Event Key, against the fixture in QA investigation 4.
 *
 * These cover what jsdom cannot: jsdom applies no stylesheets and computes no layout, so it cannot
 * tell a rectangle colored from its icon from one colored from the pale button color, nor a
 * narrow event that degenerates to a line from one that renders as a bordered blob.
 *
 * The fixture holds ten events over one day across seven types. Events 2 and 5 are minutes long,
 * narrower than the rectangle's 2px of border, which is what makes them the degenerate case.
 *
 * The tile sits in the curriculum Problem panel, which is read-only, so these exercise a reader's
 * filtering. That a reader's choices stay in their own pane is checked in Jest, where one model
 * can be rendered in two panes at once; what these cover is that the marks come and go on screen.
 */
const keyCheckbox = label =>
  cy.get(".timeline-key").contains("label", label).find("input[type=checkbox]");

function beforeTest() {
  const queryParams = `${Cypress.config("qaUnitStudent8Investigation4")}`;
  cy.visit(queryParams);
  cy.waitForLoad();
  cy.get(".timeline-tile", { timeout: 30000 }).should("exist");
  // The Key renders once the shared models resolve. Waiting for it here keeps the no-scrolling
  // check below from measuring a tile that has not finished growing.
  cy.get(".timeline-key .event-type-entry", { timeout: 30000 }).should("have.length", 6);
}

context("Timeline event marks and Event Key", () => {
  it("draws every event, and lists each type in the Event Key", () => {
    beforeTest();

    cy.log("ten events, numbered from one");
    cy.get(".event-label-button").should("have.length", 10);
    cy.get(".event-label-button").first().should("have.text", "1");
    cy.get(".event-label-button").last().should("have.text", "10");

    cy.log("each of the six color words is used, and a seventh type falls back to the default");
    ["blue", "orange", "red", "yellow", "magenta", "purple", "default"].forEach(word => {
      cy.get(`.event-overlay.${word}-event`).should("exist");
    });

    // eventTypeColorWords hands out six color words, so a seventh type draws with the default
    // gray "?" but gets no Event Key entry; the seventh color is reserved for student-defined
    // event types.
    cy.log("the key lists the types that have a color");
    cy.get(".timeline-key .event-type-entry").should("have.length", 6);
    cy.get(".timeline-key").should("contain.text", "Avalanche").and("contain.text", "Landslide");
  });

  it("colors a rectangle from its icon color, not the pale button color", () => {
    beforeTest();

    // $blue-select. The button beside it stays $blue-base, so a rule that colored both from the
    // same variable would fail one of these.
    cy.get(".event-overlay.blue-event").first()
      .should("have.css", "border-top-color", "rgb(66, 166, 255)")
      .and("have.css", "background-color", "rgba(66, 166, 255, 0.4)");
    cy.get(".event-label-button.blue-event").first()
      .should("have.css", "background-color", "rgb(170, 215, 255)");
  });

  it("draws an event too narrow to fill as a single line in the outline color", () => {
    beforeTest();

    // Event 2 spans three minutes of a one-day view. The telling measure is the content box: a
    // degenerate event has none at all, so what shows is border only, in the outline color. A
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

  it("switches a type's marks off and on from the Event Key", () => {
    beforeTest();

    cy.get(".event-overlay.blue-event").should("have.length", 2);
    cy.get(".full-timeline-event.blue-event").should("have.length", 2);

    cy.log("unchecking Avalanche removes its marks from the graph and the Full Timeline");
    keyCheckbox("Avalanche").uncheck();
    cy.get(".event-overlay.blue-event").should("not.exist");
    cy.get(".full-timeline-event.blue-event").should("not.exist");
    cy.get(".event-overlay.orange-event").should("exist");

    cy.log("checking it again brings them back");
    keyCheckbox("Avalanche").check();
    cy.get(".event-overlay.blue-event").should("have.length", 2);
    cy.get(".full-timeline-event.blue-event").should("have.length", 2);
  });

  it("keeps each event's number when a type is switched off", () => {
    beforeTest();

    // Event 1 is an Avalanche and event 3 an Explosion. Hiding the Avalanches must not renumber
    // the Explosion to 2.
    keyCheckbox("Avalanche").uncheck();
    cy.get(".event-overlay.red-event").should("exist");
    cy.get(".event-label-button").first().should("have.text", "2");
    cy.get(".event-label-button").should("have.length", 8);
  });

  it("steps Prev and Next over switched-off events", () => {
    beforeTest();

    cy.log("Next from event 1 reaches event 2 while everything is shown");
    cy.get(".event-label").should("have.text", "Event 1");
    cy.get(".next-button").click();
    cy.get(".event-label").should("have.text", "Event 2");

    cy.log("with Earthquakes off, Next from event 1 skips event 2 and lands on 3");
    cy.get(".prev-button").click();
    keyCheckbox("Earthquake").uncheck();
    cy.get(".event-label").should("have.text", "Event 1");
    cy.get(".next-button").click();
    cy.get(".event-label").should("have.text", "Event 3");
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
