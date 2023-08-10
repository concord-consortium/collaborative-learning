// This was taken from https://github.com/AviVahl/promise-assist/blob/main/src/deferred.ts
/*
MIT License

Copyright (c) 2018 Avi Vahl

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
export type PromiseResolveCb<T> = (value: T | PromiseLike<T>) => void;
export type PromiseRejectCb = (reason?: any) => void;

export interface IDeferredPromise<T> {
  promise: Promise<T>;
  resolve: PromiseResolveCb<T>;
  reject: PromiseRejectCb;
}

/**
 * Creates a deferred Promise, where resolve/reject
 * are exposed to the place that holds the promise.
 *
 * Generally bad practice, but there are use-cases where one mixes
 * callback-based API with Promise API and this is helpful.
 */
export function deferred<T = void>(): IDeferredPromise<T> {
  let resolve!: PromiseResolveCb<T>;
  let reject!: PromiseRejectCb;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}
