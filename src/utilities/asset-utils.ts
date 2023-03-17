export const getAssetUrl = (path: string, unitCode: string, baseUrl: string, branch="main") => {
  // This assumes images reside in a sub-directory of the unit directory.
  const pathParts = path.split("/");
  const filename = pathParts[pathParts.length - 1]; // e.g., "image.png"
  const assetsDir = pathParts[pathParts.length - 2]; // e.g., "images"
  const curriculumDir = pathParts[pathParts.length - 3]; // e.g., "sas"
  const urlObj = new URL(
    `/clue-curriculum/branch/${branch}/${curriculumDir === "msa" ? curriculumDir : unitCode}/${assetsDir}/${filename}`,
    baseUrl
  );
  return urlObj.href;
};
