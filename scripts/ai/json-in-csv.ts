import fs from "fs";

/**
 * Writes a csv file
 * @param docInfoObj a massive object of objects whose values are docN.txt, and tags
 * @param startTime unique id associated with this run
 */
export function writeTabularLabelsCSV(docInfoObj: any, startTime: number){
  const csvFileName = `tabular_${startTime}.csv`;

  let csvData = '';

  Object.values(docInfoObj).forEach((info) => {
    const tagFields = (info as any).tags.join(",");
    const valString = fs.readFileSync((info as any).fileName, 'utf-8');
    const parsed = JSON.parse(valString);
    const flat = JSON.stringify(parsed);
    const csvValue = `"${flat.replace(/"/g, '""')}"`;
    const csvLine = tagFields + "," + csvValue;
    csvData += csvLine + '\n';
  });

  console.log("about to write ", csvFileName);
  fs.writeFileSync(csvFileName, csvData);
}
