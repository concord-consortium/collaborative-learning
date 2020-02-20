import superagent from "superagent";
export const getErrorMessage = (err: any, res: superagent.Response) => {
  // The response should always be non-null, per the typedef and documentation:
  // cf. https://visionmedia.github.io/superagent/#error-handling
  // However, Rollbar has reported errors due to undefined responses
  // Using err.status or err.response, per the above link, may be preferable here
  return (res && res.body ? res.body.message : null) || err;
};
