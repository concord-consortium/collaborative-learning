/**
 * Helper function to perform drag and drop of a tile to the canvas..
 * The function handles:
 * - Clicking the root element to ensure it's active
 * - Creating a DataTransfer object for the drag operation
 * - Triggering mousedown and dragstart events on the tile's drag handle
 * - Dropping the tile onto the target document's canvas
 * - Completing the operation with a mouseup event
 *
 * @param {void} - Uses Cypress context for element selection
 * @example
 * // Usage in a test:
 * cy.get('.nav-tab-panel .my-work .table-tool-tile')
 *   .first()
 *   .within(dragTile);
 */
export function dragTile() {
  // Click root element to ensure it's active
  cy.root().click();
  let dataTransfer = new DataTransfer();

  // Find the drag handle and initiate drag operation
  cy.get(".tool-tile-drag-handle").then($handle => {
    const rect = $handle[0].getBoundingClientRect();
    const clientX = rect.left + rect.width/2;
    const clientY = rect.top + rect.height/2;

    // Start drag operation
    cy.wrap($handle).trigger('mousedown', {
      clientX, clientY,
      // The scrollbar covers the handle if cypress scrolls to it
      // The component should be visible because the click above scrolled the tile the top
      // and the handle is at the top
      scrollBehavior: false
    });
    cy.wrap($handle).trigger('dragstart', {
      dataTransfer,
      // We have to explicity set the clientX and clientY because cypress will just use
      // the center of the target instead of the location of the previous trigger
      clientX, clientY,
      // The scrollbar can cover the handle if cypress scrolls
      scrollBehavior: false
    });
  });

  // Drop the tile onto the target document's canvas
  cy.document().find('.single-workspace .canvas .document-content').first()
    .trigger('drop', { force: true, dataTransfer });

  // Complete the drag operation
  cy.get(".tool-tile-drag-handle").trigger('mouseup', { force: true });
}
