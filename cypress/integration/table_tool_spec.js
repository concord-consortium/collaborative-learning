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
          tableToolTile.getTableToolTile().should('be.visible');
      });
      it('will verify remove row menu item is disabled when no new rows have been added', function(){
        tableToolTile.openTableMenu();
        tableToolTile.getRemoveRowMenuItem().should('be.disabled');
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
      it('will remove a row', function(){
          tableToolTile.addNewRow();
          tableToolTile.removeRows("1");
          tableToolTile.getTableRow().should('have.length',2);
      });
      it('will verify remove row menu item is disabled when no rows can be removed', function(){
          tableToolTile.openTableMenu();
          tableToolTile.getRemoveRowMenuItem().should('be.disabled');
      });
   });

    describe('table in different views', function(){
        it('will open 4-up view', function(){
            canvas.openFourUpView();
            let nwCanvas= canvas.northWestCanvas();
            let table = tableToolTile.tableToolTile();
            cy.get(nwCanvas + ' ' + table).should('be.visible');
        });
        it('will open in 2-up view', function(){
            canvas.openTwoUpView();
            let nwCanvas= canvas.northWestCanvas();
            let table = tableToolTile.tableToolTile();
            cy.get(nwCanvas + ' ' + table).should('be.visible');
            //TODO verify rightside workspace is open
        });
        it('will reset to original', function(){
            canvas.openOneUpViewFromTwoUp();
            canvas.openOneUpViewFromFourUp();
            let singleCanvas = canvas.singleCanvas();
            let table = tableToolTile.tableToolTile();
            cy.get(singleCanvas + ' ' + table).should('be.visible');
        })
    });
   describe('share table', function(){
        // No quick way to verify table comes up in shared view without group setup
        // it('will share the canvas',function(){
        //     canvas.shareCanvas();
        // })
   });
   describe('publish table', function(){
       it('will publish canvas', function(){
           canvas.publishCanvas();
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
            //verify Class log has 'table LL' and thumbnail has table
       });
   });
   describe('save and restores table from different areas', function(){
       it('will restore from My Work tab', function(){
            leftNav.openToWorkspace('Now What');
            rightNav.openMyWorkTab();
        //    rightNav.getMyWorkTab().click();
            // cy.wait(3000);
            // rightNav.getRightNavExpandedSpace().should('be.visible');
           // cy.wait(3000);
        //    rightNav.getAllMyWorkAreaCanvasItems().then(($items)=>{
        //        cy.log($items);
        //        cy.wrap($items[0]).click({force:click});
        //    })
           rightNav.openMyWorkAreaCanvasItem('Introduction');
            tableToolTile.getTableToolTile().should('be.visible');
       });
       it('will restore from Class Work tab', function(){
           leftNav.openToWorkspace('Now What');
            //verify can open published canvas to rightside workspace 2up view
       });
       it('will restore from Class Logs tab', function(){
            //open class logs tab and open 'table LL' to rightside workspace 2up view
       });
   })

    describe('edit table entries', function(){
        it('will add content to table', function(){
            //also verify that new row is added when row "enter" key is sent to the last row
        })
    });
});