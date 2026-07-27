// Minimal in-memory implementation of the OPFS subset used by opfs-seismic-cache.

class FakeFileHandle {
  readonly kind = "file";
  constructor(public name: string, private store: Map<string, ArrayBuffer>, private key: string) {}
  async createWritable() {
    const store = this.store, key = this.key;
    let buf = new Uint8Array(0);
    return {
      async write(data: ArrayBuffer | Uint8Array) {
        const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
        const next = new Uint8Array(buf.length + bytes.length);
        next.set(buf); next.set(bytes, buf.length); buf = next;
      },
      async close() { store.set(key, buf.buffer.slice(0) as ArrayBuffer); },
    };
  }
  async getFile() {
    const bytes = this.store.get(this.key) ?? new ArrayBuffer(0);
    return { size: bytes.byteLength, arrayBuffer: async () => bytes };
  }
}

export class FakeDirHandle {
  readonly kind = "directory";
  private dirs = new Map<string, FakeDirHandle>();
  private files = new Set<string>();
  constructor(private path = "", private store = new Map<string, ArrayBuffer>()) {}

  async getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<FakeDirHandle> {
    let dir = this.dirs.get(name);
    if (!dir) {
      if (!opts?.create) throw Object.assign(new Error("NotFound"), { name: "NotFoundError" });
      dir = new FakeDirHandle(`${this.path}/${name}`, this.store);
      this.dirs.set(name, dir);
    }
    return dir;
  }
  async getFileHandle(name: string, opts?: { create?: boolean }): Promise<FakeFileHandle> {
    const key = `${this.path}/${name}`;
    if (!this.files.has(name)) {
      if (!opts?.create) throw Object.assign(new Error("NotFound"), { name: "NotFoundError" });
      this.files.add(name);
    }
    return new FakeFileHandle(name, this.store, key);
  }
  async removeEntry(name: string, _opts?: { recursive?: boolean }): Promise<void> {
    this.dirs.delete(name); this.files.delete(name);
  }

  async *entries(): AsyncIterableIterator<[string, FakeDirHandle | FakeFileHandle]> {
    for (const [name, dir] of this.dirs) yield [name, dir];
    for (const name of this.files) yield [name, new FakeFileHandle(name, this.store, `${this.path}/${name}`)];
  }
  async *values(): AsyncIterableIterator<FakeDirHandle | FakeFileHandle> {
    for await (const [, handle] of this.entries()) yield handle;
  }
}
