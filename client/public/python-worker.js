// Runs Python code inside the browser using Pyodide.
// This file is a Web Worker, so an infinite loop here can't freeze the page:
// the page just kills the worker when the time limit runs out.
import { loadPyodide } from '/pyodide/pyodide.mjs';

let pyodide = null;

const RUNNER = `
import sys, io, traceback

def __run(code, stdin):
    sys.stdin = io.StringIO(stdin)
    out = io.StringIO()
    sys.stdout = out
    try:
        compiled = compile(code, "solution.py", "exec")
    except SyntaxError:
        sys.stdout = sys.__stdout__
        return ("syntax", traceback.format_exc(limit=0))
    try:
        exec(compiled, {"__name__": "__main__"})
    except BaseException:
        sys.stdout = sys.__stdout__
        return ("runtime", traceback.format_exc(limit=-1))
    sys.stdout = sys.__stdout__
    return ("ok", out.getvalue())
`;

self.onmessage = async (event) => {
  const msg = event.data;

  if (msg.type === 'init') {
    pyodide = await loadPyodide({ indexURL: '/pyodide/' });
    pyodide.runPython(RUNNER);
    self.postMessage({ type: 'ready' });
    return;
  }

  if (msg.type === 'run') {
    const run = pyodide.globals.get('__run');
    const result = run(msg.code, msg.input).toJs();
    run.destroy();
    const [kind, text] = result;
    if (kind === 'ok') self.postMessage({ type: 'ok', stdout: text });
    else self.postMessage({ type: kind, message: text });
  }
};
