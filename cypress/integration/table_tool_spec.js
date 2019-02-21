import Canvas from '../support/elements/Canvas'
import LeftNav from '../support/elements/LeftNav'
import TableToolTile from '../support/elements/TableToolTile'
import RightNav from '../support/elements/RightNav'
import LearningLog from '../support/elements/LearningLog'


let canvas = new Canvas,
    leftNav = new LeftNav,
    tableToolTile = new TableToolTile,
    rightNav = new RightNav,
    learningLog = new LearningLog;

context('Table Tool Tile',function(){
   describe('test menu functions of table', function(){
      it('will add a table to canvas', function(){
          leftNav.openToWorkspace('Introduction');
          canvas.addTableTile();
          tableToolTile.getTableTile().should('be.visible');
      });
      it('will verify there are only two columns x & y', function(){

           tableToolTile.getColumnHeaderText().then(($headers)=>{
                expect(($headers.length)).to.be.eq(2);
           });
          tableToolTile.getColumnHeaderText().each(($header,index, $header_list)=>{
              let headerText=['x','y'];
                  expect($header.text()).to.be.eq(headerText[index]);
          });
      });
      it('will add a row to the table', function(){
          tableToolTile.addNewRow();
          tableToolTile.getTableRow().should('have.length',2);
      });
      it('will change column x name', function(){
          let header = 'pluto';
          tableToolTile.renameColumn('x', header);
          tableToolTile.getColumnHeaderText().first().should('contain',header);
      });
      it('will change column y name', function(){
          let header = 'mars';
          tableToolTile.renameColumn('y', header);
          tableToolTile.getColumnHeaderText().eq(1).should('contain',header);
      });
      it('will cancel a change in column name', function(){
          tableToolTile.getColumnHeaderText().first()
              .then(($header)=>{
                  const text=$header.text();
                  tableToolTile.openRenameColumnDialog(text);
                  tableToolTile.getRenameColumnDialogButton('Cancel').click();
                  cy.log(text);
                  tableToolTile.getColumnHeaderText().first().should('contain',text);
              });
      });
       it('will verify remove row menu item is disabled when no rows is selected', function(){
           tableToolTile.openTableMenu();
           tableToolTile.getRemoveRowMenuItem().should('have.class', 'bp3-disabled');
       });
      it('will remove a row', function(){
          tableToolTile.removeRows("0");
          tableToolTile.getTableRow().should('have.length',1);
      });
   });
    describe('table in different views', function(){
        //4-up view is tested in group_test_spec
        it('will open in 2-up view', function(){
            canvas.openTwoUpView();
            canvas.getLeftSideWorkspace().should('be.visible');
            canvas.getLeftSideWorkspaceTitle().should('contain', 'Introduction')
            tableToolTile.getTableTile().should('be.visible');
            canvas.getRightSideWorkspace().should('be.visible');
        });
        it('will reset to original', function(){
            canvas.openOneUpViewFromTwoUp();
            let singleCanvas = canvas.singleCanvas();
            let table = tableToolTile.tableToolTile();
            cy.get(singleCanvas + ' ' + table).should('be.visible');
        })
    });
    describe('edit table entries', function(){
        it('will add content to table', function(){
            tableToolTile.getTableCell().first().type('0');
            tableToolTile.getTableCell().last().type('5{enter}');
            tableToolTile.getTableCell().first().should('contain','0');
            tableToolTile.getTableCell().eq(1).should('contain', '5');
            tableToolTile.getTableRow().should('have.length',2);
            //also verify that new row is added when row "enter" key is sent to the last row
            tableToolTile.getTableCell().first().type('{enter}');
            tableToolTile.getTableRow().should('have.length',3);
        });
    });
   describe('share table', function(){
        // No quick way to verify table comes up in shared view without group setup
        it('will share the canvas',function(){
            canvas.shareCanvas();
        })
   });
   describe('publish table', function(){
       it('will publish canvas', function(){
           canvas.publishCanvas();
           // rightNav.openClassWorkTab();
           // rightNav.getClassWorkAreaCanvasItem().should('have.length',1).and('contain','Introduction')
           // need to verify that it is in the Class Work right nav
       });
   });
   describe('table in learning logs', function(){
       it('will add a table in a learning log canvas', function(){
            learningLog.createLearningLog('table LL');
            learningLog.getLLTableTool().click();
            learningLog.getLLTableTile().should('be.visible');
       });
       it('will publish learning log to Class Logs', function(){
            learningLog.publishLearningLog();
       });
   });
});