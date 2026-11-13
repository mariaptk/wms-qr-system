const os = require('os');

const HISTORY_MINUTES = 60;
const MAX_ROUTES = 50;
const SAMPLE_SIZE = 500;

const state = {
  startedAt: new Date(),
  total: 0,
  inFlight: 0,
  byStatusClass: { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 },
  byMethod: {},
  byRoute: {},
  durations: [],
  durationSum: 0,
  durationMax: 0,
  history: [],
  cpu: { usage: process.cpuUsage(), at: process.hrtime.bigint(), percent: 0 },
};

function minuteBucket(now) {
  const minute = new Date(Math.floor(now / 60000) * 60000).toISOString();
  let bucket = state.history[state.history.length - 1];
  if (!bucket || bucket.minute !== minute) {
    bucket = { minute, requests: 0, errors: 0, durationSum: 0 };
    state.history.push(bucket);
    if (state.history.length > HISTORY_MINUTES) state.history.shift();
  }
  return bucket;
}

function recordRequest({ method, route, statusCode, durationMs }) {
  state.total += 1;
  const statusClass = `${Math.floor(statusCode / 100)}xx`;
  if (statusClass in state.byStatusClass) state.byStatusClass[statusClass] += 1;
  state.byMethod[method] = (state.byMethod[method] || 0) + 1;

  if (route && (route in state.byRoute || Object.keys(state.byRoute).length < MAX_ROUTES)) {
    state.byRoute[route] = (state.byRoute[route] || 0) + 1;
  }

  state.durationSum += durationMs;
  state.durationMax = Math.max(state.durationMax, durationMs);
  state.durations.push(durationMs);
  if (state.durations.length > SAMPLE_SIZE) state.durations.shift();

  const bucket = minuteBucket(Date.now());
  bucket.requests += 1;
  bucket.durationSum += durationMs;
  if (statusCode >= 500) bucket.errors += 1;
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

// Загрузка CPU процессом между двумя соседними вызовами, в процентах от одного ядра.
function cpuPercent() {
  const now = process.hrtime.bigint();
  const elapsedUs = Number(now - state.cpu.at) / 1000;
  if (elapsedUs >= 1000000) {
    const diff = process.cpuUsage(state.cpu.usage);
    state.cpu.percent = ((diff.user + diff.system) / elapsedUs) * 100;
    state.cpu.usage = process.cpuUsage();
    state.cpu.at = now;
  }
  return Math.round(state.cpu.percent * 10) / 10;
}

const mb = (bytes) => Math.round((bytes / 1024 / 1024) * 10) / 10;

function snapshot() {
  const memory = process.memoryUsage();
  const sorted = [...state.durations].sort((a, b) => a - b);
  const round = (value) => Math.round(value * 10) / 10;

  return {
    uptimeSeconds: Math.round(process.uptime()),
    startedAt: state.startedAt.toISOString(),
    memoryMb: {
      rss: mb(memory.rss),
      heapUsed: mb(memory.heapUsed),
      heapTotal: mb(memory.heapTotal),
      external: mb(memory.external),
    },
    cpu: {
      processPercent: cpuPercent(),
      loadAverage: os.loadavg().map(round),
      cores: os.cpus().length,
    },
    system: {
      totalMemoryMb: mb(os.totalmem()),
      freeMemoryMb: mb(os.freemem()),
      platform: `${os.platform()} ${os.arch()}`,
      node: process.version,
    },
    requests: {
      total: state.total,
      inFlight: state.inFlight,
      byStatusClass: { ...state.byStatusClass },
      byMethod: { ...state.byMethod },
      topRoutes: Object.entries(state.byRoute)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([route, count]) => ({ route, count })),
    },
    responseTimeMs: {
      avg: state.total ? round(state.durationSum / state.total) : 0,
      p95: round(percentile(sorted, 95)),
      max: round(state.durationMax),
    },
    history: state.history.map((bucket) => ({
      minute: bucket.minute,
      requests: bucket.requests,
      errors: bucket.errors,
      avgMs: bucket.requests ? round(bucket.durationSum / bucket.requests) : 0,
    })),
  };
}

function requestStarted() {
  state.inFlight += 1;
}

function requestFinished() {
  state.inFlight = Math.max(0, state.inFlight - 1);
}

module.exports = {
  recordRequest,
  requestStarted,
  requestFinished,
  snapshot,
};
