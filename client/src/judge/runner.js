import { outputsMatch } from './compare.js';
import { toVerdict } from './verdict.js';

const DEFAULT_TIME_LIMIT_MS = 2000;

function startWorker() {
  const worker = new Worker('/python-worker.js', { type: 'module' });
  const ready = new Promise((resolve, reject) => {
    worker.onmessage = (e) => e.data.type === 'ready' && resolve();
    worker.onerror = (e) => reject(new Error(e.message || 'Could not start Python'));
  });
  worker.postMessage({ type: 'init' });
  return { worker, ready };
}

// Runs one test. Resolves with { type: 'ok' | 'syntax' | 'runtime' | 'timeout', ... }
function runTest(worker, code, input, timeLimitMs) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      worker.terminate();
      resolve({ type: 'timeout' });
    }, timeLimitMs);

    worker.onmessage = (e) => {
      clearTimeout(timer);
      resolve(e.data);
    };
    worker.postMessage({ type: 'run', code, input });
  });
}

/**
 * Judges a submission against a problem's tests.
 * onStatus is called with short status messages for the UI.
 * Returns { verdict, passed, total, message, tests, failingTest }.
 */
export async function judge(code, problem, onStatus = () => {}) {
  onStatus('Starting Python...');
  let currentWorker = null;

  async function getWorker() {
    if (currentWorker) return currentWorker;
    const { worker, ready } = startWorker();
    await ready;
    currentWorker = worker;
    return currentWorker;
  }

  await getWorker();

  const timeLimitMs = problem.timeLimitMs ?? problem.timeLimit ?? DEFAULT_TIME_LIMIT_MS;
  const tests = problem.tests || [];
  let passed = 0;
  const testResults = [];

  for (let i = 0; i < tests.length; i++) {
    onStatus(`Running test ${i + 1}/${tests.length}...`);
    const worker = await getWorker();
    const test = tests[i];
    const result = await runTest(worker, code, test.input, timeLimitMs);

    if (result.type === 'timeout') {
      currentWorker = null; // Worker was terminated inside runTest on timeout
    }

    if (result.type === 'ok') {
      result.passed = outputsMatch(result.stdout, test.output);
    }

    const verdict = toVerdict(result);
    const isPassed = verdict === 'AC';
    if (isPassed) passed++;

    const actual =
      result.type === 'timeout'
        ? '(Time Limit Exceeded)'
        : result.type === 'syntax' || result.type === 'runtime'
        ? result.message || ''
        : result.stdout ?? '';

    testResults.push({
      index: i + 1,
      input: test.input,
      expected: test.output,
      actual,
      passed: isPassed,
      verdict,
      message: result.message || '',
    });

    // If syntax error, subsequent tests will also fail with syntax error
    if (verdict === 'CE') {
      for (let j = i + 1; j < tests.length; j++) {
        testResults.push({
          index: j + 1,
          input: tests[j].input,
          expected: tests[j].output,
          actual: result.message || '',
          passed: false,
          verdict: 'CE',
          message: result.message || '',
        });
      }
      break;
    }
  }

  if (currentWorker) {
    currentWorker.terminate();
  }

  const failingTest = testResults.find((t) => !t.passed) || null;
  const overallVerdict = failingTest ? failingTest.verdict : 'AC';
  const message = failingTest?.message || '';

  return {
    verdict: overallVerdict,
    passed,
    total: tests.length,
    message,
    tests: testResults,
    failingTest,
  };
}
