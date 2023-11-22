// import PrimaryWorkspace from "../common/PrimaryWorkspace";
import ResourcesPanel from "./ResourcesPanel";
import Dialog from "../common/Dialog";

let resourcesPanel = new ResourcesPanel;
let dialog = new Dialog;

class CluePrimaryWorkspace {
  deleteTeacherSupport(tab, section, title) {
    resourcesPanel.getCanvasItemTitle(tab, section).contains(title).parent().siblings('.icon-holder').then(($deleteIcon) => {
      cy.wrap($deleteIcon).click({ force: true });
    });
    cy.wait(3000);
    dialog.getDialogOKButton().click();
  }
}
export default CluePrimaryWorkspace;
