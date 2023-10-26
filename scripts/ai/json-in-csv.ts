import fs from "fs";

// These functions would need to be tweaked for the CSV requirements of various sevices on AWS
// The output here is designed for Multi-Label mode on Amazon Comprenhend
// https://docs.aws.amazon.com/comprehend/latest/dg/prep-classifier-data-multi-label.html

// run this function at the end of count-document-tiles.ts by calling
// writeTabularLabelsCSV(documentInfo, startTime);

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
    // aws has a 100k character limit on csv lines
    if (csvLine.length < 100000) {
      csvData += csvLine + '\n';
    }
  });
  fs.writeFileSync(csvFileName, csvData);
}
