import fs from "fs";

/**
 * Gets the multilabel value from a tag array
 * @param tagArray an array of tags
 */
function getMultilabelValue(tagArray: [string]) {
  const hasTags = tagArray.length > 0;
  if (!hasTags) {
    return "no_label";
  } else if (tagArray.length === 1) {
    return tagArray[0];
  } else {
    return tagArray.join("|");
  }
}

/**
 * Writes a csv file
 * @param docInfoObj a massive object of objects whose values are docN.txt, and tags
 * @param startTime unique id associated with this run
 */
export function writeTabularLabelsCSV(docInfoObj: any, startTime: number){
  const csvFileName = `tabular_${startTime}.csv`;

  let csvData = '';

  Object.values(docInfoObj).forEach((info) => {
    const tagFields = getMultilabelValue((info as any).tags);
    const valString = fs.readFileSync((info as any).fileName, 'utf-8');
    const parsed = JSON.parse(valString);
    const flat = JSON.stringify(parsed);
    const csvValue = `"${flat.replace(/"/g, '""')}"`;
    const csvLine = tagFields + "," + csvValue;
    csvData += csvLine + '\n';
  });

  console.log("about to write ", csvData);
  fs.writeFileSync(csvFileName, csvData);
}
