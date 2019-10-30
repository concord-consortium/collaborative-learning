import dfHeader from "../../../support/elements/dataflow/dfHeader";

const header = new dfHeader;

context('Workspace view',()=>{
    //Other UI elements are in Common tests
    describe('workspace ui',()=>{
        it('verify Dataflow workspace switch',()=>{
            header.getDataflowWorkspaceSwitch().each(($switch,index,$switchList)=>{
                var switches=['Control Panels','Workspace']
                expect($switch.text()).to.contain(switches[index]);        
            })
        })
        it('verify Problem name is Dataflow',function(){

        })
    })
})
