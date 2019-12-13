import dfHeader from "../../../support/elements/dataflow/dfHeader"
import Header from "../../../support/elements/common/Header";


const dfheader = new dfHeader;
const header = new Header;

before(function(){
    //need to change url to teacher query param
    const baseUrl = `${Cypress.config("baseUrl")}`;
    const queryParams = `${Cypress.config("teacherQueryParams")}`;

    cy.clearQAData('all');

    cy.visit(baseUrl+queryParams);
    cy.wait(4000)
});
context('Workspace view',()=>{
    //Other UI elements are in Common tests
    describe('workspace ui',()=>{
        it('verify Dataflow workspace switch',()=>{
            dfheader.getDataflowWorkspaceSwitch().each(($switch,index,$switchList)=>{
                var switches=['Control Panels','Workspace']
                expect($switch.text()).to.contain(switches[index]);        
            })
        })
        it('verify Problem name is Dataflow',function(){
            header.getProblemTitle().should('contain', 'Dataflow')
        })
    })
})
after(function(){
    cy.clearQAData('all');
  });
