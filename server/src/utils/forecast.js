// src/utils/forecast.js — lightweight statistics (no ML). Pure functions.
// Dates are 'YYYY-MM-DD' strings in the server's local timezone, matching the
// DATE_FORMAT() output of the SQL queries. Run Node and MySQL on the same TZ.
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const mean = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const std = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const r1 = x => Math.round(x * 10) / 10;
const r2 = x => Math.round(x * 100) / 100;

function movingAverage(values, window = 7) {
  return values.map((_, i) => mean(values.slice(Math.max(0, i - window + 1), i + 1)));
}

// rows: [{ d:'2026-10-01', n:3 }] -> zero-filled [{ date, value }] from..to inclusive
function fillDaily(rows, from, to) {
  const map = new Map(rows.map(r => [String(r.d).slice(0, 10), Number(r.n) || 0]));
  const out = [];
  const end = iso(to);
  for (let d = parseISO(iso(from)); iso(d) <= end; d = addDays(d, 1)) {
    const date = iso(d);
    out.push({ date, value: map.get(date) || 0 });
  }
  return out;
}

// least-squares slope per step
function linearSlope(y) {
  const n = y.length;
  if (n < 2) return 0;
  const xm = (n - 1) / 2, ym = mean(y);
  let num = 0, den = 0;
  y.forEach((v, i) => { num += (i - xm) * (v - ym); den += (i - xm) ** 2; });
  return den ? num / den : 0;
}

const trendLabel = (slope, eps = 0.2) => (slope > eps ? 'rising' : slope < -eps ? 'falling' : 'stable');

/**
 * Weekday baseline x growth factor, blended with a 7-day moving average.
 * series: [{ date, value }] (zero-filled, oldest first)
 */
function weekdayForecast(series, horizon = 7) {
  const n = series.length;
  const vals = series.map(p => p.value);
  const total = vals.reduce((s, x) => s + x, 0);
  const confidence = n >= 28 && total >= 10 ? 'medium' : n >= 14 && total >= 5 ? 'low' : 'insufficient_data';
  if (!n) {
    return { confidence, growth: 1, slope: 0, trend: 'stable', moving_average_7d: 0, baseline: { mean: 0, std: 0 }, forecast: [] };
  }

  const byDow = Array.from({ length: 7 }, () => []);
  series.forEach(p => byDow[parseISO(p.date).getDay()].push(p.value));
  const dowAvg = byDow.map(mean);

  const half = Math.floor(n / 2);
  const prior = mean(vals.slice(0, half)), recent = mean(vals.slice(half));
  const growth = clamp(prior > 0 ? recent / prior : 1, 0.5, 2);
  const ma7 = mean(vals.slice(-7));
  const slope = linearSlope(vals);
  const sd = std(vals);
  const last = parseISO(series[n - 1].date);

  const forecast = Array.from({ length: horizon }, (_, i) => {
    const d = addDays(last, i + 1);
    const base = 0.7 * dowAvg[d.getDay()] + 0.3 * ma7;
    const p = Math.max(0, base * growth);
    return { date: iso(d), predicted: r1(p), lower: r1(Math.max(0, p - sd)), upper: r1(p + sd) };
  });

  return {
    confidence, growth: r2(growth), slope: r2(slope), trend: trendLabel(slope),
    moving_average_7d: r1(ma7), baseline: { mean: r1(mean(vals)), std: r1(sd) }, forecast,
  };
}

// z-score of the current value against history, with a floor to ignore noise
function spikeCheck(current, history, floor = 5) {
  const m = mean(history), s = std(history);
  const z = s > 0 ? (current - m) / s : current > m ? 3 : 0;
  return { current, baseline: r1(m), z: r1(z), spike_active: z >= 2 && current >= floor };
}

module.exports = {
  iso, parseISO, addDays, mean, std, clamp, r1, r2,
  movingAverage, fillDaily, linearSlope, trendLabel, weekdayForecast, spikeCheck,
};