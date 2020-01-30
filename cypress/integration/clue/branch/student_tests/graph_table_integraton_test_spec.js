import Canvas from '../../../../support/elements/common/Canvas'
import ClueCanvas from '../../../../support/elements/clue/cCanvas'
import GraphToolTile from '../../../../support/elements/clue/GraphToolTile'
import RightNav from '../../../../support/elements/common/RightNav'
import TableToolTile from '../../../../support/elements/clue/TableToolTile'
import ImageToolTile from '../../../../support/elements/clue/ImageToolTile'

const canvas = new Canvas;
const clueCanvas = new ClueCanvas;
const rightNav = new RightNav;
const graphToolTile = new GraphToolTile;
const tableToolTile = new TableToolTile;
const imageToolTile = new ImageToolTile;

function addTableAndGraph(){
    clueCanvas.addTile('table');
    clueCanvas.addTile('geometry');
}

function deleteTableAndGraph(){
    clueCanvas.deleteTile('graph');
    clueCanvas.deleteTile('table');
}

function connectTableToGraph(){
    const dataTransfer = new DataTransfer;
    tableToolTile.getTableTile().click();
    tableToolTile.getTableTile().parent().parent().should('have.class','selected');

    tableToolTile.getTableTile()
        .trigger('dragstart', {dataTransfer})
    graphToolTile.getGraphTile()
            .trigger('dragover',{dataTransfer})
            .trigger('drop', {dataTransfer})
            .trigger('dragend',{dataTransfer});
}

before(function(){
    const baseUrl = `${Cypress.config("baseUrl")}`;
    const queryParams = "?appMode=qa&fakeClass=5&fakeUser=student:5&problem=2.3&qaGroup=5"; //using different problem bec. 2.1 disables graph table integration
    cy.clearQAData('all');

    cy.visit(baseUrl+queryParams);
    cy.waitForSpinner();
    clueCanvas.getInvestigationCanvasTitle().text().as('investigationTitle')               
})

context('Tests for graph and table integration', function(){
    before(function(){
        addTableAndGraph();
    })
    describe("connect and disconnect table and graph", function(){
        const xCoord = '7';
        const yCoord = '5';
        it('verify link icon appears when table and graph are connected',function(){
            clueCanvas.getLinkIcon().should('not.exist');
            connectTableToGraph();
            tableToolTile.getTableTile().scrollIntoView();
            graphToolTile.getGraphTile().parent().parent().parent().siblings('[data-test=link-indicator-icon]').should('be.visible');
            tableToolTile.getTableTile().parent().should('have.class','is-linked');
            graphToolTile.getGraphTile().should('have.class','is-linked');
            tableToolTile.getTableTile().parent().siblings('[data-test=link-indicator-icon]').should('be.visible');
        })
        it('verify points added has p1 label in table and graph',function(){
            tableToolTile.addNewRow();
            tableToolTile.enterData(0,xCoord);
            tableToolTile.enterData(1,yCoord);
            tableToolTile.getTableIndexColumnCell().first().should('contain', 'p1');
            graphToolTile.getGraphPointLabel().contains('p1').should('exist');
        })
        it('verify unlink of graph and table',function(){
            tableToolTile.unlinkTable();
            graphToolTile.getGraphTile().parent().parent().parent().siblings('#icon-link-indicator').should('not.exist');
            tableToolTile.getTableTile().parent().siblings('#icon-link-indicator').should('not.exist');
        })
        it('verify point no longer has p1 in table and graph', function(){
            tableToolTile.getTableIndexColumnCell().first().should('not.contain', 'p1');
            graphToolTile.getGraphPointLabel().contains('p1').should('not.exist');
        })
        it('reconnect table to graph for later test',function(){
            connectTableToGraph();
        })
    })

    describe('connect table to graph before adding coordinates', function(){
        describe('Test blank cells',function(){//verify this is still true
          const xCoord = '9';
          const yCoord = '9';
          let title = "graph to table"
          before(()=>{
            canvas.canvas();
            canvas.createNewExtraDocument(title);
            canvas.getPersonalDocTitle().should('contain', title)
            addTableAndGraph();
            connectTableToGraph();
          })
            it('will add a blank row', function(){ 
                tableToolTile.getTableTile().should('exist')
                tableToolTile.addNewRow();
                tableToolTile.getTableIndexColumnCell().first().should('contain', 'p1');
                graphToolTile.getGraphPointLabel().contains('p1').should('not.exist');
            });
            it('will add a coordinate in x only column', function(){
                tableToolTile.addNewRow();
                tableToolTile.getTableIndexColumnCell().eq(1).should('contain', 'p2');
                tableToolTile.enterData(2,xCoord);
                tableToolTile.getTableCell().eq(3).type(' ');
                graphToolTile.getGraphPointLabel().contains('p2').should('not.exist');
            })
            // TODO: p3, whether existing or not, continually breaks the tests
            it('will add a coordinate in y only column', function(){
                tableToolTile.addNewRow();
                tableToolTile.getTableIndexColumnCell().eq(2).should('contain', 'p3');
                tableToolTile.enterData(5,yCoord)
                tableToolTile.getTableCell().eq(5).type(yCoord);
                graphToolTile.getGraphPointLabel().contains('p3').should('not.exist');
            })
            it('will update blank cells', function(){
                tableToolTile.enterData(0,'0')
                tableToolTile.enterData(1,'0')
                graphToolTile.getGraphPointLabel().contains('p1').should('exist');
                graphToolTile.getGraphPointCoordinates(0).should('contain', '(0, 0)' );
                tableToolTile.getTableCell().eq(3).type('0{enter}');
                // tableToolTile.getTableCell().eq(6).type(' ');
                graphToolTile.getGraphPointLabel().contains('p2').should('exist');
                graphToolTile.getGraphPointCoordinates(1).should('contain', '('+xCoord+', 0)' );
                tableToolTile.getTableCell().eq(4).type('0{enter}');
                // tableToolTile.getTableCell().eq(6).type(' ');
                graphToolTile.getGraphPointLabel().contains('p3').should('exist');
                graphToolTile.getGraphPointCoordinates(2).should('contain', '(0, '+yCoord+')');            });
        });
        describe('test creating a polygon', function (){
            it('will add both coordinates in the table', function(){
                tableToolTile.addNewRow();
                tableToolTile.enterData(6,'5')
                tableToolTile.enterData(7,'5')
                graphToolTile.getGraphPointLabel().contains('p4').should('exist');
                graphToolTile.getGraphPointCoordinates().should('contain', '(5, 5)' );
            })
            it('will create a polygon', function(){ //first point is created in previous it
                graphToolTile.getGraphPoint().last().click({force:true}).dblclick({force:true});
                graphToolTile.getGraphPolygon().should('exist')
            });
            it('will add angle to a table point', function(){
                graphToolTile.showAngle();
                graphToolTile.getAngleAdornment().should('exist');
            });
            it('will move a point by changing coordinates on the table', function(){
                let new_x = '8';
                tableToolTile.getTableCell().eq(6).type(new_x+'{enter}');
                tableToolTile.getTableCell().eq(8).type(' ');//type in blank again so the coordinate sticks
                graphToolTile.getGraphPointCoordinates().should('contain', '('+new_x+', 5)' )
            });
            it('will delete a point in the table', function(){
                let  id='';
                let point=2; //the 3rd point in the graph
                tableToolTile.removeRows(2);
               //verifies p3 no longer exist in table and graph
                tableToolTile.getTableRow().should('have.length',4)
                tableToolTile.getTableIndexColumnCell().eq(2).should('contain', 'p3');
                tableToolTile.getTableIndexColumnCell().eq(3).should('not.contain', 'p4');
                graphToolTile.getGraphPointLabel().contains('p4').should('not.exist');
                graphToolTile.getGraphPointID(point)
                    .then((id)=>{
                        id='#'.concat(id);
                        cy.get(id).then(($el)=>{
                            expect($el).to.not.be.visible;                        
                    })
                });
                //verifies angle adornment no longer exists
                graphToolTile.getAngleAdornment().should('not.exist')
            })
        });
        describe('text axes changes', function(){
            it('will change the name of the x-axis in the table', function(){
                let id='';
                tableToolTile.renameColumn('x', 'mars');
                graphToolTile.getGraphAxisLabelId('x')
                    .then((id)=>{
                        id='#'.concat(id);
                        cy.get(id).then(($el)=>{
                            expect($el.text()).to.contain('mars');
                        })
                    });
            });
            it('will change the name of the y-axis in the table', function(){
                let id='';
                tableToolTile.renameColumn('y', 'venus');
                graphToolTile.getGraphAxisLabelId('y')
                    .then((id)=> {
                        id = '#'.concat(id);
                        cy.get(id).then(($el) => {
                            expect($el.text()).to.contain('venus');
                        });
                    });
            });
        });
        describe('normal graph interactions', function(){
            it('will add a polygon directly onto the graph', function(){
                graphToolTile.getGraphTile().click();
                graphToolTile.addPointToGraph(5,5); //not sure why this isn't appearing
                graphToolTile.addPointToGraph(10,15);
                graphToolTile.addPointToGraph(13,10);
                graphToolTile.addPointToGraph(5,10)
                graphToolTile.getGraphPoint().last().click({force:true}).click({force:true});
            });
            it('will add and angle to a point created from a table', function(){
                graphToolTile.showAngle();
                graphToolTile.getAngleAdornment().should('exist');
            });
            // TODO: Cannot find the images
            it.skip('will add an image to a graph that is connected to a table', function(){
                const imageFilePath='image.png';
                const dataTransfer = new DataTransfer;

                clueCanvas.addTile('image');
                imageToolTile.getImageTile().scrollIntoView().click();
                imageToolTile.getImageToolControl().click();
                cy.uploadFile(imageToolTile.imageChooseFileButton(), imageFilePath, 'image/png')
                // cy.wait(2000)
                imageToolTile.getImageTile()
                    .trigger('dragstart', {dataTransfer});
                graphToolTile.getGraphTile()
                    .trigger('drop', {dataTransfer});
                    imageToolTile.getImageTile()
                    .trigger('dragend');
                cy.get('.canvas-area .geometry-content svg image').should('exist');
            })
        });
        describe('test non-numeric entries in table', function(){
            it('will enter non-numeric number in the table', function(){
                tableToolTile.getTableCell().eq(5).type('g{enter}');
                tableToolTile.getTableCell().eq(5).should('contain',5)
            })
        });
        describe('Test disconnecting the table', function(){
            it('will delete the connected table', function(){
                clueCanvas.deleteTile('table');
                //verify axis rename does not exist
                graphToolTile.getGraphAxisLabelId('x')
                    .then((id)=>{
                        id='#'.concat(id);
                        cy.get(id).then(($el)=>{
                            expect($el.text()).to.not.contain('mars');                        
                        })
                    });
                graphToolTile.getGraphPointLabel().contains('p1').should('not.exist'); 
                graphToolTile.getGraphPointLabel().contains('A').should('exist');    
            });
        });
    });
    describe('connect table to graph after adding coordinates in table', function(){
        before(()=>{
            let title = 'table to graph'
            canvas.canvas();
            canvas.createNewExtraDocument(title);
            canvas.getPersonalDocTitle().should('contain', title)
            addTableAndGraph();
        })
        describe('Add coordinates to the table',()=>{
            it('will add coordinates in the table', function(){
                tableToolTile.addNewRow();
                tableToolTile.enterData(0,'5');
                tableToolTile.enterData(1,'5');
                tableToolTile.addNewRow();
                tableToolTile.enterData(2,'0');
                tableToolTile.enterData(3,'0');
                tableToolTile.addNewRow();
                tableToolTile.enterData(4,'9');
                tableToolTile.enterData(5,'5');
                tableToolTile.addNewRow();
    
            })
            it('will change the name of the axis in the table', function(){
                tableToolTile.renameColumn('x', 'neptune');
                tableToolTile.renameColumn('y', 'saturn');
            });
            it('will connect table to graph', function(){
                connectTableToGraph();
            });
            it('verify table is labeled with point names', function(){
                tableToolTile.getTableIndexColumnCell().eq(0).should('contain', 'p1');
                tableToolTile.getTableIndexColumnCell().eq(1).should('contain', 'p2');
                tableToolTile.getTableIndexColumnCell().eq(2).should('contain', 'p3');
            })
            // TODO: None of them contain their respective elements
            it('verify points are on the graph', function(){
                graphToolTile.getGraphPointLabel().contains('p1').should('exist');
                // graphToolTile.getGraphPointCoordinates().should('contain', '(5, 5)' );
                graphToolTile.getGraphPointLabel().contains('p2').should('exist');
                // graphToolTile.getGraphPointCoordinates().should('contain', '(0,f 0)' );
                graphToolTile.getGraphPointLabel().contains('p3').should('exist');
                // graphToolTile.getGraphPointCoordinates().should('contain', '(9, 5)' )
            })
            it('verify axes names are on the graph', function(){
                graphToolTile.getGraphAxisLabelId('x')
                .then((id)=>{
                    id='#'.concat(id);
                    cy.get(id).then(($el)=>{
                        expect($el.text()).to.contain('neptune');                        
                    })
                });
                graphToolTile.getGraphAxisLabelId('y')
                .then((id)=> {
                    id = '#'.concat(id);
                    cy.get(id).then(($el) => {
                        expect($el.text()).to.contain('saturn');
                    });
                });
            })
        });
    });        
});
context('Save and restore keeps the connection between table and graph', function(){
    before(function(){
        let title = '2.3 Mouthing Off and Nosing Around';
        rightNav.openRightNavTab('my-work');
        rightNav.openSection('my-work','investigations');
        rightNav.openCanvasItem('my-work','investigations',title)
    })
    it('verify connection of table and graph on restored canvas', function(){
        tableToolTile.getTableIndexColumnCell().first().should('contain', 'p1');
        graphToolTile.getGraphPointLabel().contains('p1').should('exist');
    });
});
context('Delete connected table', function(){
    it('will delete connected table', function(){
        clueCanvas.deleteTile('table');
        graphToolTile.getGraphPointLabel().contains('p1').should('not.exist');
        graphToolTile.getGraphPoint().should('not.exist');
    });
    it('will verify graph is still functional after connected table is deleted', function(){
        graphToolTile.getGraphTile().click();
        graphToolTile.addPointToGraph(2,6);
        graphToolTile.getGraphPoint().should('exist').and ('have.length', 1)
    });
});