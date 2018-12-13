import LeftNav from './elements/LeftNav.js'
import Canvas from './elements/Canvas.js'

describe('Test Left tabs',function(){
    let leftNav = new LeftNav(),
        canvas = new Canvas();

 it('will verify the transfer of the tab info to the canvas', function(){
    let titleArr = [], i=0;

     leftNav.getLeftNavTabs().each(($tab, index, $tabList)=>{
         titleArr.push($tab.text());
     }).then(($tab)=> {

         for (i = 0; i < $tab.length - 1; i++) {
             let title = $tab.text;
             cy.get('#leftNavTab' + i).click({force:true});
                 leftNav.getOpenToWorkspaceButton().should('contain', titleArr[i]).click({force: true});
                     canvas.getCanvasTitle().should('contain', titleArr[i]);
         }
     })
 });
});