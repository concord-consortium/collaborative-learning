import dfHeader from "../../../support/elements/dataflow/dfHeader";

const header = new dfHeader;

context('Workspace view',()=>{
    describe('workspace ui',()=>{
        it('verify Dataflow workspace',()=>{
            header.getDataflowWorkspaceSwitch().each(($switch,index,$switchList)=>{
                var switches=['Control Panels','Workspace']
                expect($switch.text()).to.contain(switches[index]);        
            })
        })
    })
})
