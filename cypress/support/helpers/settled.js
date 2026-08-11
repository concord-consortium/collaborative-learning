/**
 * Yields a DOM property of an element only once it has stopped changing — that is, once two
 * consecutive reads agree.
 *
 * Use it for anything the browser or the app keeps updating after the action that set it going: a
 * smooth scroll still traveling towards its destination, a width that settles a render after the
 * layout around it changes. A single read can catch such a value mid-flight, and an assertion that
 * passes on a value still in motion leaves the step after it acting on a layout that has moved on.
 *
 * @param {string} selector - The element to read, as passed to `cy.get()`
 * @param {string} prop - The DOM property to read, as passed to `.invoke("prop", ...)`
 * @returns {Cypress.Chainable} The settled value of the property
 * @example
 * getSettledProp("[data-testid=doc-group-list]", "scrollLeft").should("be.eq", 0);
 */
export function getSettledProp(selector, prop) {
  let previous;
  return cy.get(selector).should($el => {
    const current = $el.prop(prop);
    const settled = current === previous;
    previous = current;
    expect(settled, `${prop} settled at ${current}`).to.be.true;
  }).invoke("prop", prop);
}
