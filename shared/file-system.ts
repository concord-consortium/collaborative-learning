// Generic File System Access API helpers.

// The installed TS DOM lib omits the async-iteration helpers on FileSystemDirectoryHandle;
// declare them so directory contents can be enumerated without an `any` cast. This is an
// ambient augmentation — it applies project-wide because this file is part of the build.
declare global {
  interface FileSystemDirectoryHandle {
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
    keys(): AsyncIterableIterator<string>;
    values(): AsyncIterableIterator<FileSystemHandle>;
  }
}

/** Type guard narrowing a handle to a directory (the lib's FileSystemHandle isn't a union). */
export function isDirectory(handle: FileSystemHandle): handle is FileSystemDirectoryHandle {
  return handle.kind === "directory";
}
