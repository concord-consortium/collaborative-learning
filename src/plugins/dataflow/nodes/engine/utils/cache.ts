export class Cache<Key, T> {
  cache = new Map<Key, T>();

  constructor(private onDelete?: (item?: T) => void) {}

  get(key: Key) {
    return this.cache.get(key);
  }

  add(key: Key, data: T) {
    if (this.cache.has(key)) throw new Error('cache already exists');

    this.cache.set(key, data);
  }

  patch(key: Key, data: T) {
    this.cache.set(key, data);
  }

  delete(key: Key) {
    const item = this.cache.get(key);

    this.cache.delete(key);
    this.onDelete && this.onDelete(item);
  }

  clear() {
    Array.from(this.cache.keys()).forEach(item => {
      this.delete(item);
    });
  }
}
