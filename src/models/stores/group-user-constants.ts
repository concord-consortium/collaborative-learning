// A group member who isn't in the class roster counts as new until the class info is more than
// this much newer than the member's connectedTimestamp, and as removed after that.
// Kept free of MST imports so the Cypress specs can import it.
export const kNewGroupUserGraceMs = 1000;
