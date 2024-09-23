/**
 * Visit qaConfigSubtabsUnit as a teacher or student.
 * If visiting as a student you can also specify the group the student should be in.
 * After visiting the unit, it will wait for CLUE to load.
 *
 * @param {*} params {student?: id, teacher?: id, group?: id}
 */
export function visitQaSubtabsUnit(params) {
  const teacherQueryParams = `${Cypress.config("qaConfigSubtabsUnitTeacher1")}`;
  const studentQueryParams = `${Cypress.config("qaConfigSubtabsUnitStudent5")}`;
  let queryParams;
  if ("student" in params) {
    queryParams = studentQueryParams.replace("student:5", `student:${params.student}`);
    if ("group" in params) {
      queryParams = queryParams.replace("qaGroup=5", `qaGroup=${params.group}`);
    }
  } else if ("teacher" in params) {
    if ("group" in params) {
      throw new Error(`teachers aren't in groups: ${params.group}`);
    }
    queryParams = teacherQueryParams.replace("teacher:1", `teacher:${params.teacher}`);
  } else {
    throw new Error(`unknown params ${JSON.stringify(params)}`);
  }
  cy.visit(queryParams);
  cy.waitForLoad();
}
