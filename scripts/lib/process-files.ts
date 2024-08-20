import { readdir } from "fs/promises";

const fileBatchSize = 8;

export interface IProcessFilesStats {
  startTime: number,
  endTime?: number,
  duration?: number,
  fileCount: number,
  processedFiles: number,
}

interface IOptions {
  sourcePath: string,
  processFile: (fileName: string, path: string) => Promise<void>,
  batchComplete?: (stats: IProcessFilesStats) => void,
  fileNamePrefix?: string,
  fileLimit?: number,
}

export async function processFiles({
  sourcePath,
  processFile,
  batchComplete,
  fileNamePrefix,
  fileLimit,
}: IOptions) {
  const stats: IProcessFilesStats = {
    startTime: Date.now(),
    fileCount: 0,
    processedFiles: 0,
  };
  let fileBatch: string[] = [];

  const files = await readdir(sourcePath);

  async function processBatch() {
    await Promise.all(fileBatch.map(async file => {
      // If we've hit the file limit don't continue
      if (fileLimit && stats.processedFiles >= fileLimit) return;

      const path = `${sourcePath}/${file}`;
      await processFile(file, path);
      stats.processedFiles++;


    }));
    fileBatch = [];
    batchComplete?.(stats);
  }

  for (const file of files) {
    // If we've hit the file limit don't continue
    if (fileLimit && stats.processedFiles >= fileLimit) break;

    // Skip files that don't match the prefix
    if (fileNamePrefix && !file.startsWith(fileNamePrefix)) return;

    fileBatch.push(file);

    if (fileBatch.length >= fileBatchSize) {
      await processBatch();
    }
  }
  // Process any remaining files
  await processBatch();

  stats.endTime = Date.now();
  stats.duration = stats.endTime - stats.startTime;
  stats.fileCount = files.length;

  return stats;
}
