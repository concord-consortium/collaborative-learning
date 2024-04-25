This is a re-write of the Rete Dataflow engine.

The Rete Dataflow engine uses asynchronous calls to each node's data method. This conflicts with MobX and MobX React's transaction mechanism to optimize re-renders.

Our engine here strips out all of the async code so the full update can be wrapped in a single MobX transaction. At some point this might cause problems if there are too many nodes and they take too long to process. Currently this synchronous approach is more efficient.

You can compare these files to the ones in https://github.com/retejs/engine.

The original files were licensed with:

MIT License

Copyright (c) 2023 "Ni55aN" Vitaliy Stoliarov

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
