import Header from '../support/elements/Header.js';
import RightNav from '../support/elements/RightNav';
import LeftNav from '../support/elements/LeftNav';
import Canvas from '../support/elements/Canvas';
import Workspace from '../support/elements/Workspace';
import TeacherDashboard from '../support/elements/TeacherDashboard';

let qaClass = 10,
    qaOffering = 10,
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

        it("will set up group and fill each student's canvas", function(){ //need to setup two groups to verify teacher can switch groups
            cy.setupGroup(studentArr10, qaGroup10); //This publishes canvases to Class Work
            cy.setupGroup(studentArr20, qaGroup20); //This publishes canvases to Class Work

            //TODO: set up some canvases from learning log to Class Log for later testing
        });
        it('set up group and will go to a teacher view of the site', function() {
            // cy.visit(baseUrl+'?appMode=qa&fakeClass='+qaClass+'&fakeUser=teacher:'+teacher+'&problem='+problem+'&qaGroup='+qaGroup10);
            cy.visit(baseUrl+'?appMode=qa&fakeClass='+qaClass+'&fakeUser=teacher:'+teacher+'&problem='+problem);
            cy.wait(3000)
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
        it('will verify if class name is correct', function(){
            header.getClassName().should('contain',''+'Class '+qaClass);
        });

        it('will verify group members is correct', function(){
            header.getGroupMembers().each(($member,index, $list)=> {
                expect(['S'+studentArr10[0],'S'+studentArr10[1],'S'+studentArr10[2],'S'+studentArr10[3]]).to.include($member.text());
            });
        });
        it('will verify teacher name is correct', function(){
            header.getUserName().should('contain','Teacher '+teacher);
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

    describe('Check left nav is accessible and opens student canvases correctly', function(){
        //TODO: Happy path
        //Teacher selects a tab to view
        //Multiple students' shared canvases open in a four up view. Unshared canvases showed not be visible
        //Teacher cannot leave 4-up view
        //Cannot publish
        //Teacher does not have tool palette so cannot add tool-tiles to canvas
        //Cannot share

        //TODO: Teacher tries to edit student canvases
        //Teacher tries to edit text, graph, draw tool
        //Teacher tries to upload image
        //Teacher tries to drag a tile from one student canvas to the other.

        //TODO: Student republishes work
        //Multiple students republish their work
        //Teacher sees updated  documents
    });



    describe('Check 2-up view as teacher', function(){
        describe('Check the student canvases restore correctly from Class Work', function(){
            it('will verify teacher can get a 2-up view', function(){

            });
            it('will add canvas to right-workspace from class work', function(){

            });
            it('will verify teacher cannot copy elements from right-workspace to left-workspace', function(){

            });
            it('back out of 2-up view', function(){

            });
            it('will verify that clicking on Class Work canvas opens right-workspace 2-up view automatically', function(){

            });
            it('back out of 2-up view to clean up', function(){

            });
        });
        describe('check student canvases restore correctly from Class Logs', function(){
            //Need to add setup of learning log canvases to Class Logs. See todo above in setup.
            it('will open 2-up view', function(){

            });
            it('will add canvas to right-workspace from class log', function(){

            });
            it('will verify teacher cannot copy elements from right-workspace to left-workspace', function(){

            });
            it('back out of 2-up view', function(){

            });
            it('will verify that clicking on Class Log canvas opens right-workspace 2-up view automatically', function(){

            });
            it('back out of 2-up view to clean up', function(){

            });
        });

    });

    describe('Teacher can create and publish Learning Logs', function(){
        it('will verify learning log is accessible', function(){

        });
        it('will create a learning log', function(){

        });
        it('will publish the learning log and verify that it is in the class log', function(){

        });
    })




});

