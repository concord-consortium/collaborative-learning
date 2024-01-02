import ClueCanvas from "../../../support/elements/common/cCanvas";
import ChatPanel from "../../../support/elements/common/ChatPanel";

let clueCanvas = new ClueCanvas;
let chatPanel = new ChatPanel;

const queryParams = {
  teacherQueryParams: "/?appMode=demo&demoName=CLUE-Test&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=teacher:6"
};

function beforeTest(params) {
  cy.clearQAData('all');
  cy.visit(params);
  cy.waitForLoad();
  cy.openTopTab("my-work");
  cy.wait(5000);
}

context('Commented Document List', () => {
  it('Comment all document list', () => {
    beforeTest(queryParams.teacherQueryParams);
    chatPanel.openChatPanel();
    cy.wait(2000);
    chatPanel.documentCommentList();
  });
});
