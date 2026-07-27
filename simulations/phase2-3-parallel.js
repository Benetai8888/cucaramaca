'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {availableParallelism} = require('node:os');
const {Worker, isMainThread, parentPort, workerData} = require('node:worker_threads');
const {
  TERMINATIONS,
  SCORINGS,
} = require('./phase2-3.js');
const {
  SEARCH_BRANCH_LIMIT,
  runSelfPlay,
  runMatchup,
  renderCorrectedReport,
} = require('./phase2-3-corrected.js');

const REPORT_JSON = path.join(__dirname, '..', 'reports', 'fases-2-3-corregidas.json');
const REPORT_MD = path.join(__dirname, '..', 'reports', 'fases-2-3-corregidas.md');

function save(output) {
  fs.mkdirSync(path.dirname(REPORT_JSON), {recursive: true});
  fs.writeFileSync(REPORT_JSON, `${JSON.stringify(output, null, 2)}\n`);
  fs.writeFileSync(REPORT_MD, renderCorrectedReport(output));
}

function jobKey(job) {
  if (job.type === 'self') {
    return `${job.policy}__${job.terminationId}__${job.scoringId}`;
  }
  return `${job.left}-vs-${job.right}__${job.terminationId}__${job.scoringId}`;
}

function buildJobs(options) {
  const jobs = [];
  let ordinal = 0;
  for (const policy of ['C', 'A', 'B', 'D2', 'D3']) {
    for (const termination of TERMINATIONS) {
      for (const scoring of SCORINGS) {
        ordinal++;
        jobs.push({
          type: 'self',
          policy,
          terminationId: termination.id,
          scoringId: scoring.id,
          games: options.selfGames,
          seed: options.seed + ordinal * 100_003,
        });
      }
    }
  }
  for (let matchupIndex = 0; matchupIndex < 2; matchupIndex++) {
    const [left, right] = [['D3', 'B'], ['D3', 'D2']][matchupIndex];
    for (let terminationIndex = 0; terminationIndex < TERMINATIONS.length; terminationIndex++) {
      for (let scoringIndex = 0; scoringIndex < SCORINGS.length; scoringIndex++) {
        jobs.push({
          type: 'matchup',
          left,
          right,
          terminationId: TERMINATIONS[terminationIndex].id,
          scoringId: SCORINGS[scoringIndex].id,
          games: options.matchupGames,
          seed: options.seed + 9_000_001 + matchupIndex * 1_000_003 +
            terminationIndex * 100_003 + scoringIndex * 7_919,
        });
      }
    }
  }
  return jobs;
}

function parseArguments(argv) {
  const options = {
    selfGames: 1000,
    matchupGames: 1000,
    seed: 20260727,
    workers: Math.min(availableParallelism(), 8),
    resume: true,
  };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--self-games') options.selfGames = Number(argv[++index]);
    else if (argument === '--matchup-games') options.matchupGames = Number(argv[++index]);
    else if (argument === '--seed') options.seed = Number(argv[++index]);
    else if (argument === '--workers') options.workers = Number(argv[++index]);
    else if (argument === '--no-resume') options.resume = false;
  }
  for (const key of ['selfGames', 'matchupGames', 'seed', 'workers']) {
    if (!Number.isInteger(options[key]) || options[key] < 1) {
      throw new Error(`--${key} inválido`);
    }
  }
  return options;
}

function emptyOutput(options) {
  return {
    metadata: {
      date: '2026-07-27',
      seed: options.seed,
      selfGames: options.selfGames,
      matchupGames: options.matchupGames,
      searchBranchLimit: SEARCH_BRANCH_LIMIT,
      primaryPolicy: 'C',
      parallelWorkers: options.workers,
    },
    selfPlay: {},
    matchups: {},
  };
}

function loadOutput(options) {
  if (!options.resume || !fs.existsSync(REPORT_JSON)) return emptyOutput(options);
  const output = JSON.parse(fs.readFileSync(REPORT_JSON, 'utf8'));
  const metadata = output.metadata || {};
  if (metadata.seed !== options.seed ||
      metadata.selfGames !== options.selfGames ||
      metadata.matchupGames !== options.matchupGames ||
      metadata.searchBranchLimit !== SEARCH_BRANCH_LIMIT) {
    return emptyOutput(options);
  }
  metadata.parallelWorkers = options.workers;
  return output;
}

function executeJob(job) {
  const termination = TERMINATIONS.find(item => item.id === job.terminationId);
  const scoring = SCORINGS.find(item => item.id === job.scoringId);
  if (job.type === 'self') {
    return runSelfPlay(job.policy, termination, scoring, job.games, job.seed);
  }
  return runMatchup(
    job.left,
    job.right,
    termination,
    scoring,
    job.games,
    job.seed,
  );
}

async function runParallel(options) {
  const output = loadOutput(options);
  const pending = buildJobs(options).filter(job => {
    const collection = job.type === 'self' ? output.selfPlay : output.matchups;
    return !collection[jobKey(job)];
  });
  const total = pending.length;
  let completed = 0;
  let cursor = 0;

  return new Promise((resolve, reject) => {
    let active = 0;
    const launch = () => {
      while (active < options.workers && cursor < pending.length) {
        const job = pending[cursor++];
        active++;
        const worker = new Worker(__filename, {workerData: job});
        worker.once('message', result => {
          const collection = job.type === 'self' ? output.selfPlay : output.matchups;
          collection[jobKey(job)] = result;
          completed++;
          active--;
          save(output);
          process.stdout.write(
            `${new Date().toISOString()} ${completed}/${total} ${jobKey(job)}\n`,
          );
          if (completed === total) resolve(output);
          else launch();
        });
        worker.once('error', reject);
        worker.once('exit', code => {
          if (code !== 0) reject(new Error(`Worker terminó con código ${code}`));
        });
      }
      if (total === 0) resolve(output);
    };
    launch();
  });
}

if (!isMainThread) {
  parentPort.postMessage(executeJob(workerData));
} else {
  const options = parseArguments(process.argv.slice(2));
  runParallel(options).then(output => {
    save(output);
    process.stdout.write(`${renderCorrectedReport(output)}\n`);
  }).catch(error => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  buildJobs,
  parseArguments,
  executeJob,
  runParallel,
};
