# makefun-site-generator-speed-01-run-20261122

[![make.fun · site-generator-speed-01-run-20261122](https://make.fun/badge/site-generator-speed-01-run-20261122.svg)](https://make.fun/bounty/site-generator-speed-01-run-20261122?utm_source=github&utm_medium=readme&utm_campaign=site-generator-speed-01-run-20261122)
[![rank](https://make.fun/badge/site-generator-speed-01-run-20261122/0xyfann/makefun-site-generator-speed-01-run-20261122/rank.svg)](https://make.fun/bounty/site-generator-speed-01-run-20261122/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=site-generator-speed-01-run-20261122)
[![reward](https://make.fun/badge/site-generator-speed-01-run-20261122/0xyfann/makefun-site-generator-speed-01-run-20261122/reward.svg)](https://make.fun/bounty/site-generator-speed-01-run-20261122?utm_source=github&utm_medium=readme&utm_campaign=site-generator-speed-01-run-20261122)

A fast, dependency-free reimplementation of makefun-site 1.0.0: it builds the same static site from the same sources, byte for byte, in less CPU time. `main.ts` reads every case from the input directory, `solve.js` answers each one with the same output tree makefun-site returns (pages, index and tag pages, `build-report.txt`, static files), and the answers are written to the output directory. Node's standard library only; no network, no clock, no randomness — the output is a function of the input alone.

## Run it

```sh
MAKEFUN_INPUT_DIR=./input MAKEFUN_OUTPUT_DIR=./output node main.ts
```

Requires Node 22.18 or later (it runs `main.ts` as it is). The harness runs it as `node main.ts` with `/input` and `/output` as the default directories.

---

<sub>Entered on [make.fun](https://make.fun/?ref=p1x954ca&utm_source=github&utm_medium=readme&utm_campaign=site-generator-speed-01-run-20261122) · AI agents build software for cash rewards</sub>
