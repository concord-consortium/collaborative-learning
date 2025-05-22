// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add("login", (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add("drag", { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add("dismiss", { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This is will overwrite an existing command --
// Cypress.Commands.overwrite("visit", (originalFn, url, options) => { ... })
import '@testing-library/cypress/add-commands';
import PrimaryWorkspace from './elements/common/PrimaryWorkspace';
import Canvas from './elements/common/Canvas';
import TeacherDashboard from "./elements/common/TeacherDashboard";
import 'cypress-file-upload';
import 'cypress-commands';
import ResourcesPanel from "./elements/common/ResourcesPanel";
import {platformCmdKey} from '../../src/utilities/hot-keys';

Cypress.Commands.add("uploadFile",(selector, filename, type="")=>{
    // cy.fixture(filename).as("image");

    return cy.get(selector).then(subject => {
        return cy.fixture(filename,'base64')
            .then(str => Promise.resolve(Cypress.Blob.base64StringToBlob))
        // From Cypress document: https://docs.cypress.io/api/utilities/blob.html#Examples
        // return Cypress.Blob.base64StringToBlob(cy.fixture(filename), "image/png")
            .then((blob) => {
            const el = subject[0];
            const nameSegments = filename.split('/');
            const name = nameSegments[nameSegments.length - 1];
            const testFile = new File([blob], name, { type });
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(testFile);
            el.files = dataTransfer.files;
            return subject;
        });
    });
});

// Login using cy.request, this is faster than using visit, and it makes it possible
// to visit a local domain after logging in
Cypress.Commands.add("login", (baseUrl, testTeacher) => {

    cy.request({
        url: `${baseUrl}/api/v1/users/sign_in`,
        method: "POST",
        body: {
          "user[login]": testTeacher.username,
          "user[password]": testTeacher.password
        },
        form: true
    })
    .its("status").should("equal", 200);
});

Cypress.Commands.add("logout", (baseUrl) => {
    cy.request({
        url: `${baseUrl}/api/v1/users/sign_out`,
        method: "GET"
    })
    .then((resp) => {
        expect(resp.status).to.eq(200);
      });
});

// Launch a local report, this uses cy.request to first launch the portal report
// this returns a redirect to a released version of CLUE
// the URL is modified to strip off the domain and path
// this way the same url parameters are passed to the localhost CLUE server
// The portal was not visited with cy.visit, so cypress will allow us to visit a different
// second level domain (localhost)
Cypress.Commands.add("launchReport", (reportUrl) => {
    cy.request({
        url: reportUrl,
        method: "GET",
        followRedirect: false
    })
    .then((resp) => {
        expect(resp.status).to.eq(302);
        expect(resp.redirectedToUrl).to.match(/^https:\/\/collaborative-learning\.concord\.org/);
        const realReportUrl = resp.redirectedToUrl;
        const localReportUrl = new URL(realReportUrl).search;
        // cy.visit resolves urls relative to the baseUrl
        cy.visit(localReportUrl);
    });
});
Cypress.Commands.add("waitForLoad", () => {
  cy.get('.version', {timeout: 60000});
  // Log the firebase user id
  cy.window().its('stores.db.firebase.userId').then(id => {
    cy.log("Firebase uid", id);
  });
});
Cypress.Commands.add("deleteWorkspaces",(baseUrl,queryParams)=>{
    let primaryWorkspace = new PrimaryWorkspace;
    let resourcesPanel = new ResourcesPanel;
    let canvas = new Canvas;
    let dashboard = new TeacherDashboard();

    cy.visit(baseUrl+queryParams);
    cy.waitForLoad();
    dashboard.switchView("Workspace & Resources");
    cy.wait(2000);
    resourcesPanel.openPrimaryWorkspaceTab("my-work");
    cy.openSection("my-work","workspaces");
    cy.wait(2000);
    primaryWorkspace.getAllSectionCanvasItems("my-work","workspaces").then((document_list)=>{
        let listLength = document_list.length;
        while(listLength>1){
            primaryWorkspace.getAllSectionCanvasItems("my-work","workspaces").eq(0).click();
            cy.wait(1111);
            canvas.deleteDocument();
            listLength=listLength-1;
            resourcesPanel.openPrimaryWorkspaceTab("my-work");
        }

    });
});
Cypress.Commands.add("openResourceTabs", () => {
  cy.get('.resources-expander').click();
} );
Cypress.Commands.add("openTopTab", (tab) => {
  cy.get('.top-tab.tab-'+tab).click();
  cy.get('.top-tab.tab-'+tab).invoke("attr", "class").should("contain", "selected");
} );
Cypress.Commands.add("openProblemSection", (section) => {//doc-tab my-work workspaces problem-documents selected
  cy.get('.prob-tab').contains(section).click({force:true});
  cy.get('.prob-tab').contains(section).invoke("attr", "class").should("contain", "selected");
});
Cypress.Commands.add("openSection", (tab, section) => {//doc-tab my-work workspaces problem-documents selected
  cy.get('.doc-tab.'+tab+'.'+section).click({force:true});
});

// TODO: this is duplicated in ResourcesPanel.js, however in that case the tab
// is passed in. Passing the tab is safer, otherwise this can find document items
// in other tabs.
Cypress.Commands.add("getCanvasItemTitle", (section) => {
  cy.get('.documents-list.'+section+' [data-test='+section+'-list-items] .footer');
});
Cypress.Commands.add("openDocumentThumbnail", (navTab,section,title) => { //opens thumbnail into the nav panel
  cy.get('.document-tabs.'+navTab+' .documents-list.'+section+' [data-test='+section+'-list-items] .footer').contains(title).parent().parent().siblings('.scaled-list-item-container').click({force:true});
});
Cypress.Commands.add("openDocumentWithTitle", (tab, section, title) => {
  cy.openSection(tab,section);
  cy.get('.document-tabs.'+tab+' .documents-list.'+section+' [data-test='+section+'-list-items] .footer').contains(title).parent().parent().siblings('.scaled-list-item-container').click({force:true});
  cy.get('.document-tabs.'+tab+' [data-test=subtab-'+section+'] .toolbar .tool.edit').click();
});
Cypress.Commands.add("openDocumentWithIndex", (tab, section, docIndex) => {
  cy.openSection(tab,section);
  cy.get('.document-list.'+section+' [data-test='+section+'-list-items] .footer').eq(docIndex).siblings('.scaled-list-item-container').click({force:true});
  cy.get('.toolbar .tool.edit').click();
});
Cypress.Commands.add("clickProblemResourceTile", (subsection, tileIndex = 0) => {
  cy.get('[data-focus-section="'+subsection+'"] .problem-panel .document-content .tile-row').eq(tileIndex).then($tileRow => {
    cy.wrap($tileRow).click();
    cy.wrap($tileRow).find(".tool-tile").invoke("attr", "class").should("contain", "selected");
  });
});
Cypress.Commands.add("getToolTile", (tileIndex = 0) => {
  cy.get('.problem-panel .document-content .tile-row .tool-tile').eq(tileIndex);
});
Cypress.Commands.add("clickProblemResource", () => {
  cy.get(".prob-tab.selected").eq(0).click();
});
Cypress.Commands.add("clickDocumentResource", () => {
  cy.get(".documents-panel div.document-title").eq(0).click();
});
Cypress.Commands.add("clickDocumentResourceTile", (tileIndex = 0) => {
  cy.get('.documents-panel .editable-document-content .tile-row').eq(tileIndex).click();
});
Cypress.Commands.add("getDocumentToolTile", (tileIndex = 0) => {
  cy.get('.documents-panel .editable-document-content .tile-row tool-tile').eq(tileIndex).click();
});
Cypress.Commands.add('collapseResourceTabs', () => {
  cy.get('.drag-thumbnail').trigger('mouseover').then(() => {
    cy.get('.divider-container .workspace-expander').click();
    cy.get('.primary-workspace .toolbar', {timeout: 120000});
  });
});
Cypress.Commands.add('closeResourceTabs', () => {
  cy.get('.nav-tab-panel .close-button').click();
});
Cypress.Commands.add('showOnlyDocumentWorkspace', () => {
  const cmdKey = platformCmdKey();
  cy.get(".workspace").then($workspace => {
    // only toggle the full screen of the document workspace if it is necessary
    if($workspace.find(".divider-container").length > 0) {
      cy.get('.primary-workspace .canvas').type(`{${cmdKey}+shift+f}`, {force: true});
    }
  });
});
Cypress.Commands.add('collapseWorkspace', () => {
  cy.get('.drag-thumbnail').trigger('mouseover').then(() => {
    cy.get('.divider-container .resources-expander').click();
  });
});
Cypress.Commands.add('linkTableToTile', (table, tile) => {
  cy.get('.primary-workspace .table-title').contains(table).click();
  cy.get(".table-toolbar .toolbar-button.link-tile").click();
  cy.get('.ReactModalPortal').within(() => {
    cy.get('[data-test=link-tile-select]').select(tile);
    cy.get('button').contains('Link').click();
  });
});
Cypress.Commands.add('unlinkTableToTile', (table, tile) => {
  cy.get('.primary-workspace .table-title').contains(table).click();
  cy.get(".table-toolbar .toolbar-button.link-tile").click();
  cy.get('.ReactModalPortal').within(() => {
    cy.get('[data-test=link-tile-select]').select(tile);
    cy.get('button').contains('Clear It!').click();
  });
});
Cypress.Commands.add('linkTableToDataflow', (program, table) => {
  cy.get('.primary-workspace .title-area').contains(program).parent().parent().within(() => {
    cy.get('.link-table-button').click();
  });
  cy.get('.ReactModalPortal').within(() => {
    cy.get('[data-test=link-tile-select]').select(table);
    cy.get('button').contains('Link').click();
  });
});
Cypress.Commands.add('unlinkTableToDataflow', (program, table) => {
  cy.get('.primary-workspace .title-area').contains(program).parent().parent().within(() => {
    cy.get('.link-table-button').click();
  });
  cy.get('.ReactModalPortal').within(() => {
    cy.get('[data-test=link-tile-select]').select(table);
    cy.get('button').contains('Clear It!').click();
  });
});
Cypress.Commands.add("deleteDocumentThumbnail", (tab, section,title) => {
  cy.get('.'+tab+' .documents-list.'+section+' [data-test='+section+'-list-items] .footer .icon-delete-document').eq(1).click({force:true});
});

Cypress.Commands.add('portalLogin', (options = {}) => {
  // Default to student if not specified
  const userType = options.userType || 'student';

  // Get credentials for the specified user type
  let username, password;
  if (userType === 'teacher') {
    username = Cypress.env('PORTAL_TEACHER_USERNAME');
    password = Cypress.env('PORTAL_TEACHER_PASSWORD');
  } else {
    username = Cypress.env('PORTAL_USERNAME');
    password = Cypress.env('PORTAL_PASSWORD');
  }

  // Handle cross-origin errors during login
  cy.on('uncaught:exception', () => {
    return false; // We want to handle all uncaught exceptions during login
  });

  // Debug logs in parent scope
  cy.log('DEBUG parent Cypress.env: ' + JSON.stringify(Cypress.env()));
  cy.log('DEBUG parent username: ' + username);
  cy.log('DEBUG parent password: ' + password);

  cy.origin('https://learn.portal.staging.concord.org', { args: { username, password } }, ({ username: originUsername, password: originPassword }) => {
    cy.on('uncaught:exception', () => {
      return false;
    });

    cy.visit('/users/sign_in');

    // Debug log to help diagnose CI credential issues
    // eslint-disable-next-line no-console
    console.log('DEBUG Cypress.env:', Cypress.env());

    if (!originUsername || !originPassword) {
      throw new Error('Portal credentials not found. Set PORTAL_USERNAME and PORTAL_PASSWORD in cypress.env.json or CI environment variables.');
    }

    // Fill in the login form
    cy.get('#user_login', { timeout: 30000 }).type(originUsername);
    cy.get('#user_password').type(originPassword);

    // Submit the form
    cy.get('input[type="submit"]').click();

    // Wait for successful login with longer timeout
    cy.url({ timeout: 60000 }).should('not.include', '/users/sign_in');
  });

  // Wait for any post-login redirects to complete
  cy.wait(2000);
});
