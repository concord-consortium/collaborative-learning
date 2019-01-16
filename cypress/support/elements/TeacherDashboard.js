class TeacherDashboard {
    getTeacherDashboard(){
        return cy.get('.teacher-dashboard');
    }
    getGroupChooserTab(){
        return cy.get('#teacher-dashboard-groups');
    }
    getGroupList(){
        return cy.get('.teacher-group-tab > .group-list ')
    }
    getGroupName(){
        return cy.get('.teacher-dashboard > .tabbed-area > .tab-contents > .contents > .teacher-group-tab > .group-list > .group > .group-title');
    }
    joinGroup(){
        cy.get('.teacher-group-tab > .selected-group > .title > .actions > span').should('contain','Join Group').click();
    }
    getGroupMembers(){
        return cy.get('.teacher-dashboard > .tabbed-area > .tab-contents > .contents > .teacher-group-tab > .group-list > .group > .group-users');
    }
    getUserName(){
        return cy.get('.header > .user > .name')
    }
}
export default TeacherDashboard;