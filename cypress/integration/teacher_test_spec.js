import Header from '../support/elements/Header';
import RightNav from '../support/elements/RightNav';
import LeftNav from '../support/elements/LeftNav';
import Canvas from '../support/elements/Canvas';
import Workspace from '../support/elements/Workspace';
import TeacherDashboard from '../support/elements/TeacherDashboard';

let qaClass = 10,
    qaGroup10 = 10,
    problem = 2.3,
    studentArr10=[15,16,17,18],
    studentArr20=[25,26,27,28],
    qaGroup20 = 20;

let teacher = 10;

let header = new Header,
    rightNav = new RightNav,
    leftNav = new LeftNav,
    canvas = new Canvas,
    workspace = new Workspace,
    teacherDashboard = new TeacherDashboard;



const baseUrl = `${Cypress.config("baseUrl")}`;

context('Teacher workspace',function(){ //does not have My Work tab and has Teacher in user name
    describe('Check header area for correctness', function(){

        it("setup", function(){ //need to setup two groups to verify teacher can switch groups
            cy.setupGroup(studentArr10, qaGroup10); //This publishes canvases to Class Work
            cy.setupGroup(studentArr20, qaGroup20); //This publishes canvases to Class Work
        });
        it('will go to a teacher view of the setup class', function() {
            cy.visit(baseUrl+'?appMode=qa&fakeClass='+qaClass+'&fakeUser=teacher:'+teacher+'&problem='+problem);
            cy.wait(3000)
        });
        it('will verify if class name is correct', function(){
            header.getClassName().should('contain',''+'Class '+qaClass);
        });
        it('will verify teacher name is correct', function(){
            header.getUserName().should('contain','Teacher '+teacher);
        });
        it('will verify the groups tab is present', function(){
            teacherDashboard.getGroupList().should('be.visible');
        });
        it('will verify if group names are present and join one of the groups', function(){
            teacherDashboard.getGroupName().should('contain',qaGroup10);
            teacherDashboard.getGroupName().should('contain',qaGroup20);
            teacherDashboard.getGroupName().contains(qaGroup10).click();
            teacherDashboard.joinGroup();

            header.getGroupName().should('contain','Group '+qaGroup10);
        });
        it('will verify teacher can switch groups', function(){
            workspace.leaveGroup();
            teacherDashboard.getGroupName().should('contain',qaGroup10);
            teacherDashboard.getGroupName().should('contain',qaGroup20);
            teacherDashboard.getGroupName().contains(qaGroup20).click();

            teacherDashboard.joinGroup();
            header.getGroupName().should('contain','Group '+qaGroup20);
        })
    });

    describe('Check right nav for correctness', function(){
       it('will verify that Class Work tab comes up and My Work tab is not visible', function(){
           rightNav.getClassWorkTab().should('be.visible');
           rightNav.getClassLogTab().should('be.visible');
           rightNav.getMyWorkTab().should('not.be.visible');
       })
    });

    // describe('Check left nav is accessible and opens student canvases correctly', function(){
    //     //TODO: Happy path
    //     //Teacher selects a tab to view
    //     //Multiple students' shared canvases open in a four up view. Unshared canvases showed not be visible
    //     //Teacher cannot leave 4-up view
    //     //Cannot publish
    //     //Teacher does not have tool palette so cannot add tool-tiles to canvas
    //     //Cannot share
    
    //     //TODO: Teacher tries to edit student canvases
    //     //Teacher tries to edit text, graph, draw tool
    //     //Teacher tries to upload image
    //     //Teacher tries to drag a tile from one student canvas to the other.
    
    //     //TODO: Student republishes work
    //     //Multiple students republish their work
    //     //Teacher sees updated  documents
    // });
    
    
    
    // describe('Check 2-up view as teacher', function(){
    //     describe('Check the student canvases restore correctly from Class Work', function(){
    //         it('will verify teacher can get a 2-up view', function(){
    
    //         });
    //         it('will add canvas to right-workspace from class work', function(){
    
    //         });
    //         it('will verify teacher cannot copy elements from right-workspace to left-workspace', function(){
    
    //         });
    //         it('back out of 2-up view', function(){
    
    //         });
    //         it('will verify that clicking on Class Work canvas opens right-workspace 2-up view automatically', function(){
    
    //         });
    //         it('back out of 2-up view to clean up', function(){
    
    //         });
    //     });
    //     describe('check student canvases restore correctly from Class Logs', function(){
    //         //Need to add setup of learning log canvases to Class Logs. See todo above in setup.
    //         it('will open 2-up view', function(){
    
    //         });
    //         it('will add canvas to right-workspace from class log', function(){
    
    //         });
    //         it('will verify teacher cannot copy elements from right-workspace to left-workspace', function(){
    
    //         });
    //         it('back out of 2-up view', function(){
    
    //         });
    //         it('will verify that clicking on Class Log canvas opens right-workspace 2-up view automatically', function(){
    
    //         });
    //         it('back out of 2-up view to clean up', function(){
    
    //         });
    //     });
    
    // });
    
    // describe('Teacher can create and publish Learning Logs', function(){
    //     it('will verify learning log is accessible', function(){
    
    //     });
    //     it('will create a learning log', function(){
    
    //     });
    //     it('will publish the learning log and verify that it is in the class log', function(){
    
    //     });
    // });

    // describe('Teacher can add support messages', function(){

    //     it('will add a message for all sections to whole class, a group, and a student, and verify message appears in teacher dashboard', function() {
    //         cy.visit(baseUrl + '?appMode=qa&fakeClass=' + qaClass + '&fakeUser=teacher:' + teacher + '&problem=' + problem);
    //         cy.wait(1000);
    //         // Add message to class
    //         teacherDashboard.sendSupportMessage('class', 'This message is for whole class in all sections');
    //         teacherDashboard.getClassSupportsMessage().should('be.visible').and('contain','whole class in all sections');
    //         // Add message to group
    //         teacherDashboard.selectGroup(qaGroup10);
    //         teacherDashboard.sendSupportMessage('group', 'This message is for group 10 in all sections');
    //         teacherDashboard.getGroupSupportsMessage().should('be.visible').and('contain','group 10 in all sections');

    //         // add message to student
    //         teacherDashboard.selectStudent(studentArr10[0]);
    //         teacherDashboard.sendSupportMessage('user', 'This message is for S' + studentArr10[0] + ' in all sections');
    //         cy.wait(1000);
    //         teacherDashboard.getStudentSupportsMessage().should('be.visible').and('contain', 'S'+studentArr10[0] +' in all sections'); 
    //     });

    //     it('verify message appears in all sections for whole class', function(){
    //         let i = 0, j = 0;

    //         for (i=0; i<studentArr10.length-2; i++){
    //             cy.visit(baseUrl+'?appMode=qa&qaGroup='+qaGroup10+'&fakeClass='+qaClass+'&fakeUser=student:'+studentArr10[i]+'&problem='+problem);
    //             cy.wait(3000);
    //             leftNav.getLeftNavTabs().each(($tab, index, $tabList)=>{
    //                 cy.wrap($tab).click({force:true});
    //                 leftNav.getOpenToWorkspaceButton(index).click({force: true});
    //                 cy.wait(3000);
    //                 if (index<1) {
    //                     cy.get('[data-test="support-icon class"]').last().click();
    //                     }
    //                 cy.get('[data-test="supports-list"]').contains('whole class in all sections')
    //             })
    //         }

    //         for (j=0; j<studentArr20.length-2; j++){
    //             cy.visit(baseUrl+'?appMode=qa&qaGroup='+qaGroup20+'&fakeClass='+qaClass+'&fakeUser=student:'+studentArr20[j]+'&problem='+problem);
    //             cy.wait(3000);
    //             leftNav.getLeftNavTabs().each(($tab, index, $tabList)=>{
    //                 cy.wrap($tab).click({force:true});
    //                 leftNav.getOpenToWorkspaceButton(index).click({force: true});
    //                 cy.wait(3000);
    //                 if (index<1) {
    //                     cy.get('[data-test="support-icon class"]').last().click();
    //                 }
    //                 cy.get('[data-test="supports-list"]').contains('whole class in all sections')
    //             })
    //         }
    //     });

    //     it('verify message appears in all sections for a group and not the other', function(){
    //         let i=0;

    //         for (i=0; i<studentArr10.length-2; i++){
    //             cy.visit(baseUrl+'?appMode=qa&qaGroup='+qaGroup10+'&fakeClass='+qaClass+'&fakeUser=student:'+studentArr10[i]+'&problem='+problem);
    //             cy.wait(3000);
    //             leftNav.getLeftNavTabs().each(($tab, index, $tabList)=>{
    //                 cy.wrap($tab).click({force:true});
    //                 leftNav.getOpenToWorkspaceButton(index).click({force: true});
    //                 cy.wait(3000);
    //                 if (index<1) {
    //                     cy.get('[data-test="support-icon group"]').last().click();
    //                 }
    //                 cy.get('[data-test="supports-list"]').contains('group 10 in all sections')
    //             })
    //         }

    //         // verify message is not in the other group
    //         cy.visit(baseUrl+'?appMode=qa&qaGroup='+qaGroup20+'&fakeClass='+qaClass+'&fakeUser=student:'+studentArr20[0]+'&problem='+problem);
    //         cy.wait(3000);
    //         leftNav.getLeftNavTabs().each(($tab, index, $tabList)=>{
    //             cy.wrap($tab).click({force:true});
    //             leftNav.getOpenToWorkspaceButton(index).click({force: true});
    //             cy.wait(3000);
    //             if (index<1) {
    //                 cy.get('[data-test="support-icon group"]').should('not.exist');
    //             }
    //         })
    //     });

    //     it('verify message appears in all sections for a student and not another', function(){
    //         cy.visit(baseUrl+'?appMode=qa&fakeClass='+qaClass+'&fakeUser=student:'+studentArr10[0]+'&problem='+problem);
    //         leftNav.getLeftNavTabs().each(($tab, index, $tabList)=>{
    //             cy.wrap($tab).click({force:true});
    //             leftNav.getOpenToWorkspaceButton(index).click({force: true});
    //             cy.wait(3000);
    //             if (index<1) {
    //                 cy.get('[data-test="support-icon user"]').last().click();
    //             }
    //             cy.get('[data-test="supports-list"]').contains('S'+studentArr10[0]+' in all sections')
    //         });

    //         // verify that message does not appear  for another student in all sections
    //         cy.visit(baseUrl+'?appMode=qa&fakeClass='+qaClass+'&fakeUser=student:'+studentArr10[2]+'&problem='+problem);
    //         leftNav.getLeftNavTabs().each(($tab, index, $tabList)=>{
    //             cy.wrap($tab).click({force:true});
    //             leftNav.getOpenToWorkspaceButton(index).click({force: true});
    //             cy.wait(3000);
    //             if (index<1) {
    //                 cy.get('[data-test="support-icon user"]').should('not.exist');
    //             }
    //         })
    //     });

    //     it('will delete a message to whole class for all sections and verify message disappears in all sections for whole class', function() {
    //         cy.visit(baseUrl + '?appMode=qa&fakeClass=' + qaClass + '&fakeUser=teacher:' + teacher + '&problem=' + problem);
    //         cy.wait(1000);
    //         teacherDashboard.deleteClassSupportMessage();
    //         teacherDashboard.getClassSupportsMessage().should('not.exist')

    //         teacherDashboard.selectGroup(qaGroup10);
    //         teacherDashboard.deleteGroupSupportMessage();
    //         teacherDashboard.getGroupSupportsMessage().should('not.exist');

    //         // teacherDashboard.selectGroup(qaGroup10);
    //         teacherDashboard.selectStudent(studentArr10[0]);
    //         teacherDashboard.deleteStudentSupportMessage();
    //         teacherDashboard.getStudentSupportsMessage().should('not.exist');
    //     });

    //     it('will verify message is not in all sections for whole class', function(){
    //         let i = 0, j = 0;
    //         for (i=0; i<studentArr10.length-2; i++){
    //             cy.visit(baseUrl+'?appMode=qa&qaGroup='+qaGroup10+'&fakeClass='+qaClass+'&fakeUser=student:'+studentArr10[i]+'&problem='+problem);
    //             cy.wait(3000);
    //             leftNav.getLeftNavTabs().each(($tab, index, $tabList)=>{
    //                 cy.wrap($tab).click({force:true});
    //                 leftNav.getOpenToWorkspaceButton(index).click({force: true});
    //                 cy.wait(3000);
    //                 if (index<1) {
    //                     cy.get('[data-test="support-icon class"]').should('not.exist');
    //                 }
    //             })
    //         }
    //         for (j=0; j<studentArr20.length-2; j++){
    //             cy.visit(baseUrl+'?appMode=qa&qaGroup='+qaGroup20+'&fakeClass='+qaClass+'&fakeUser=student:'+studentArr20[j]+'&problem='+problem);
    //             cy.wait(3000);
    //             leftNav.getLeftNavTabs().each(($tab, index, $tabList)=>{
    //                 cy.wrap($tab).click({force:true});
    //                 leftNav.getOpenToWorkspaceButton(index).click({force: true});
    //                 cy.wait(3000);
    //                 if (index<1) {
    //                     cy.get('[data-test="support-icon class"]').should('not.exist');
    //                 }
    //             })
    //         }
    //     });

    //     it('verify message disappears in all sections for a group', function(){
    //         let i=0;
    //         for (i=0; i<studentArr10.length-2; i++){
    //             cy.visit(baseUrl+'?appMode=qa&qaGroup='+qaGroup10+'&fakeClass='+qaClass+'&fakeUser=student:'+studentArr10[i]+'&problem='+problem);
    //             cy.wait(3000);
    //             leftNav.getLeftNavTabs().each(($tab, index, $tabList)=>{
    //                 cy.wrap($tab).click({force:true});
    //                 leftNav.getOpenToWorkspaceButton(index).click({force: true});
    //                 cy.wait(3000);
    //                 if (index<1) {
    //                     cy.get('[data-test="support-icon group"]').should('not.exist');
    //                 }
    //             })
    //         }
    //     });

    //     it('verify message disappears in all sections for a student', function(){
    //         cy.visit(baseUrl+'?appMode=qa&fakeClass='+qaClass+'&fakeUser=student:'+studentArr10[0]+'&problem='+problem);
    //         leftNav.getLeftNavTabs().each(($tab, index, $tabList)=>{
    //             cy.wrap($tab).click({force:true});
    //             leftNav.getOpenToWorkspaceButton(index).click({force: true});
    //             cy.wait(3000);
    //             if (index<1) {
    //                 cy.get('[data-test="support-icon user"]').should('not.exist');
    //             }
    //         })
    //     });

    //     it('will add a message to whole class for specific section and verify message appears in teacher dashboard', function(){
    //         let section1 = "Extra Workspace";
    //         cy.visit(baseUrl+'?appMode=qa&fakeClass='+qaClass+'&fakeUser=teacher:'+teacher+'&problem='+problem);
    //         cy.wait(1000);
    //         teacherDashboard.selectSection('class', section1);
    //         teacherDashboard.sendSupportMessage('class','This message is for whole class in '+section1);
    //         teacherDashboard.getClassSupportsMessage().should('be.visible').and('contain','whole class in '+section1);


    //         let section2="Initial Challenge";
    //         teacherDashboard.selectGroup(qaGroup10);
    //         teacherDashboard.selectSection('group',section2);
    //         teacherDashboard.sendSupportMessage('group','This message is for group'+qaGroup10+' in '+section2);
    //         teacherDashboard.getGroupSupportsMessage().should('be.visible').and('contain', 'group'+qaGroup10+' in '+section2);


    //         let section3='What if...?';
    //         teacherDashboard.selectGroup(qaGroup10);
    //         teacherDashboard.selectStudent(studentArr10[0]);
    //         teacherDashboard.selectSection('user', section3);
    //         teacherDashboard.sendSupportMessage('user','This message is for S'+studentArr10[0]+' in '+section3);
    //         teacherDashboard.getStudentSupportsMessage().should('be.visible').and('contain', 'S'+studentArr10[0] +' in '+section3);
    //     });

    //     it('verify message appears for class in specific section', function(){
    //         let i=0, j=0;
    //         let section1 = "Extra Workspace";

    //         for (i=0; i<studentArr10.length-2; i++){
    //             cy.visit(baseUrl+'?appMode=qa&qaGroup='+qaGroup10+'&fakeClass='+qaClass+'&fakeUser=student:'+studentArr10[i]+'&problem='+problem);
    //             cy.wait(3000);
    //             leftNav.openToWorkspace(section1);
    //             cy.wait(3000);
    //             cy.get('[data-test="support-icon class"]').last().click();
    //             cy.get('[data-test="supports-list"]').contains('whole class in '+section1)
    //         }
    //         //verify message does not appear in non-specified section
    //         leftNav.openToWorkspace('Introduction');
    //         cy.wait(3000);
    //         cy.get('[data-test="support-icon class"]').should('not.exist');

    //         for (j=0; j<studentArr20.length-2; j++){
    //             cy.visit(baseUrl+'?appMode=qa&qaGroup='+qaGroup20+'&fakeClass='+qaClass+'&fakeUser=student:'+studentArr20[j]+'&problem='+problem);
    //             cy.wait(3000);
    //             leftNav.openToWorkspace(section1);
    //             cy.wait(3000);
    //             cy.get('[data-test="support-icon class"]').last().click();
    //             cy.get('[data-test="supports-list"]').contains('whole class in '+section1)
    //         }
    //         //verify message does not appear in non-specified section
    //         leftNav.openToWorkspace('Introduction');
    //         cy.wait(3000);
    //         cy.get('[data-test="support-icon class"]').should('not.exist'); 
    //     });

    //     it('verify message appears in the section for a group', function(){
    //         let i=0;
    //         let section2="Initial Challenge";
    //         for (i=0;i<studentArr10.length-1;i++){
    //             cy.visit(baseUrl+'?appMode=qa&fakeClass='+qaClass+'&fakeUser=student:'+studentArr10[i]+'&problem='+problem);
    //             leftNav.openToWorkspace(section2);
    //             cy.wait(2000);
    //             cy.get('[data-test="support-icon group"]').last().click();
    //             cy.get('[data-test="supports-list"]').contains('group'+qaGroup10+' in '+section2) 
    //         }
    //          //verify message does not appear in non-specified section
    //         leftNav.openToWorkspace('Introduction');
    //         cy.wait(3000);
    //         cy.get('[data-test="support-icon group"]').should('not.exist'); 

    //         //verify message does not appear in non-specified group
    //         cy.visit(baseUrl+'?appMode=qa&fakeClass='+qaClass+'&fakeUser=student:'+studentArr20[1]+'&problem='+problem)
    //         leftNav.openToWorkspace(section2);
    //         cy.wait(3000);
    //         cy.get('[data-test="support-icon group"]').should('not.exist'); 
    //     });

    //     it('will add a message to a student for a specific section and verify message appears in the section for a student', function(){
    //         let i=0;
    //         let section3='What if...?';
    //         cy.visit(baseUrl+'?appMode=qa&fakeClass='+qaClass+'&fakeUser=student:'+studentArr10[0]+'&problem='+problem);
    //         leftNav.openToWorkspace(section3);
    //         cy.wait(2000);
    //         cy.get('[data-test="support-icon user"]').last().click();
    //         cy.get('[data-test="supports-list"]').contains('S'+studentArr10[0]+' in '+section3) ;
      
    //          //verify message does not appear in non-specified section
    //          leftNav.openToWorkspace('Introduction');
    //          cy.wait(3000);
    //          cy.get('[data-test="support-icon user"]').should('not.exist');

    //         //verify message does not appear in non-specified user
    //         cy.visit(baseUrl+'?appMode=qa&fakeClass='+qaClass+'&fakeUser=student:'+studentArr20[1]+'&problem='+problem);
    //         leftNav.openToWorkspace(section3);
    //         cy.wait(3000);
    //         cy.get('[data-test="support-icon user"]').should('not.exist');
    //     });
    // })
});


