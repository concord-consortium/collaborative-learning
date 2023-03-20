// Adapted from https://stackoverflow.com/a/43467144
export const isValidHttpUrl = (possibleUrl: string | undefined) => {
  try {
    const url = possibleUrl ? new URL(possibleUrl) : undefined;
    return url?.protocol === "http:" || url?.protocol === "https:";
  } catch (_) {
    return false;
  }
};

export const getUnitCodeFromUrl = (url: string) => {
  const urlParts = url.split("/");
  const unitCode = urlParts[urlParts.length-2];
  return unitCode;
};

export const getCurriculumBranchFromUrl = (url: string) => {
  const urlPieces = url.match(/branch\/([^/]+)\/(.*)/);
  const branch = urlPieces && urlPieces[1] ? urlPieces[1] : undefined;
  return branch;
};
