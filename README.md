# CodeArena

A tiny online judge, like a mini LeetCode, built for **Hacktoberfest Hack Day 2026 at NIT Jamshedpur**, organised by the Electrical Engineering Society.

Pick a problem, write a solution, hit **Submit**, and get a verdict: Accepted, Wrong Answer, Time Limit Exceeded, Runtime Error or Compilation Error.

It works... mostly. Some verdicts are wrong, the leaderboard page is empty, only Python is supported, and dark mode is half-done. **That's where you come in.** Check the [Issues](../../issues) tab, pick one, and send a pull request.

## How it works

Your code never runs on a server. It runs **inside your own browser**:

- Python runs through [Pyodide](https://pyodide.org/), which is Python compiled to WebAssembly.
- The code runs in a [Web Worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API), so an infinite loop can't freeze the page. When the time limit runs out, the page kills the worker.
- The page compares your output with the expected output and works out the verdict.
- The small Express server only stores submissions and serves problems and the leaderboard.

```
client/            React + Vite frontend
  public/python-worker.js   runs Python in a Web Worker
  src/judge/                runner, output comparison, verdicts
  src/pages/                Problem list, problem page, leaderboard
server/            Express API (stores data in server/data/db.json)
problems/          one folder per problem
```

## Run it locally

You need [Node.js](https://nodejs.org/) 20 or newer.

```bash
git clone https://github.com/<your-username>/HacktoberFest_EES.git
cd HacktoberFest_EES
npm install
npm run dev
```

Open http://localhost:5173, type a team name in the top bar, and solve **Hello, Arena!**

- The frontend runs on port 5173 and the API on port 4000.
- The first submission takes a few seconds while Python loads in your browser.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before you start. It explains how to claim an issue, how to add a problem and what a good PR looks like.

## License

[MIT](LICENSE)
