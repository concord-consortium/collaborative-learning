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
        // simple replacement of any instance of a delimiter (item or line) character in the sequence name
        // we don't yet filter out any specific characters for sequence names.
        const name = sequence.name.replace(",", " ").replace("\n", " ");
        const units = sequence.units.replace(",", " ").replace("\n", " ");
        // x is the timestamp, y is the value
        const row: string[] = ["" + d.x, name, units, "" + d.y];
        rows.push(row.join(","));
      });
    });

    const allRows = headers + "\n" + rows.join("\n");
    const csvFilename = "dataflow-export-" + Date.now() + ".csv";

    // Using similar technique for export as Dataflow 2.0 to ensure consistent functionality
    const csvBlob = new Blob([allRows], {type: "text/csv;charset=utf-8;"});
    if (navigator.msSaveBlob) {
      navigator.msSaveBlob(csvBlob, csvFilename);
    }
    else {
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(csvBlob);
      link.setAttribute("download", csvFilename);
      document.body.appendChild(link);
      // link created by us in code, so calling click on the link should not trigger blockers
      link.click();
      document.body.removeChild(link);
    }
  }
};
