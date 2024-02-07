import fs from "fs";

// This file contains functions to write multiple labels and full document JSON contents to a CSV file.
// It's designed for a specific use-case/experiment and should be called from count-document-tiles.ts.
// The output is for Multi-Label mode on Amazon Comprehend, which sends multiple labels in a single CSV field.
// See https://docs.aws.amazon.com/comprehend/latest/dg/prep-classifier-data-multi-label.html for more information.

// call from the end of count-document-tiles.ts like this: writeTabularLabelsCSV(documentInfo, startTime);
// this function depends on the document.txt files that were written by count-document-tiles.ts

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
    // aprox 2% of our documents end up exceededing the limit once stringified and escaped
    if (csvLine.length < 100000) {
      csvData += csvLine + '\n';
    }
  });
  fs.writeFileSync(csvFileName, csvData);
}
