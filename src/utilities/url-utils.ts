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
  const unitFileName = urlParts[urlParts.length-1];
  const unitCode = unitFileName.replace(/-unit\.json$/, "");
  return unitCode;
};

export const getCurriculumBranchFromUrl = (url: string) => {
  const urlParts = url.split("/");
  const branch = urlParts[urlParts.length-3];
  return branch;
};
