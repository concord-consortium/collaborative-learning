// The Concord Consortium staff email addresses granted full access. One canonical list, used
// identically by multiple callers on both the server and the client, so a person the server
// allows in can't be refused by the client (or vice versa).
//
// Doug's old zoopdoop.com email is what Firebase auth sets as the GitHub provider email in the
// generated auth token even though it is not used on GitHub anymore. Leslie's mit.edu and Teale's
// gmail addresses are what they each use for GitHub.
const otherCCEmailAddresses = ["doug@zoopdoop.com", "lbond@alum.mit.edu", "fristoe@gmail.com"];

export const isCCEmail = (email: string): boolean =>
  email.endsWith("@concord.org") || otherCCEmailAddresses.includes(email);
