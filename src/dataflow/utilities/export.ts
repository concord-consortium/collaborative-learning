import { DataSequence } from "../components/dataflow-program-graph";

export const exportCSV = (dataSequences: DataSequence[]) => {
  if (!dataSequences) {
    return;
  }
  if (dataSequences.length > 0) {
    const headers: string = "timestamp,name,units,value";
    const rows: string[] = [];
    dataSequences.forEach((sequence) => {
      sequence.data.forEach((d) => {
        // x is the timestamp, y is the value
        const row: string[] = ["" + d.x, sequence.name, sequence.units, "" + d.y];
        rows.push(row.join(","));
      });
    });
    const allRows = headers + "\n" + rows.join("\n");
    const csvFilename = "dataflow-export-" + Date.now() + ".csv";
    const csvBlob = new Blob([allRows], {type: "text/csv;charset=utf-8;"});
    if (navigator.msSaveBlob) {
        navigator.msSaveBlob(csvBlob, csvFilename);
    }
    else {
        const link = document.createElement("a");
        link.href = window.URL.createObjectURL(csvBlob);
        link.setAttribute("download", csvFilename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
  }
};
