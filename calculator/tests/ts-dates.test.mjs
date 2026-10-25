import assert from 'node:assert/strict';
import { tsdReadText, tsdReadNumber, tsdLabel, tsdSeries, tsdIndex, tsdPanelCandidates, tsdDailyKind } from '../src/ts-dates.mjs';

// text formats → frequency and codes (months since 1960m1, quarters since 1960q1, days since 1960-01-01)
const one = (v, o) => { const r = tsdReadText([v], o); return [r.freq, r.codes[0]]; };
assert.deepEqual(one('2014-01-01'), ['daily', 19724]);
assert.deepEqual(one('2014-01'), ['monthly', 648]);
assert.deepEqual(one('2014m1'), ['monthly', 648]);
assert.deepEqual(one('2011q3'), ['quarterly', 206]);
assert.deepEqual(one('Q3 2011'), ['quarterly', 206]);
assert.deepEqual(one('2011'), ['yearly', 2011]);
assert.deepEqual(one('Nov 1, 2011'), ['daily', 18932]);
assert.deepEqual(one('November 1 2011'), ['daily', 18932]);
assert.deepEqual(one('01nov2011'), ['daily', 18932]);
assert.deepEqual(one('1 de noviembre de 2011'), ['daily', 18932]);
assert.deepEqual(one('ene 2014'), ['monthly', 648]);
assert.deepEqual(one('Jan-2014'), ['monthly', 648]);
assert.equal(tsdLabel(18932, 'daily'), '1 Nov 2011');
assert.equal(tsdLabel(648, 'monthly'), '2014m1');
assert.equal(tsdLabel(206, 'quarterly'), '2011q3');
// slash dates: order inferred when a part exceeds 12, otherwise flagged as ambiguous
let r = tsdReadText(['13/01/2020', '14/01/2020']); assert.equal(r.order, 'dmy'); assert.equal(r.codes[0], 21927);
r = tsdReadText(['01/13/2020']); assert.equal(r.order, 'mdy'); assert.equal(r.codes[0], 21927);
r = tsdReadText(['01/02/2020']); assert.equal(r.ambiguous, true);
r = tsdReadText(['01/02/2020'], 'dmy'); assert.equal(r.ambiguous, false); assert.equal(tsdLabel(r.codes[0], 'daily'), '1 Feb 2020');
// invalid and blank values are counted, not guessed
r = tsdReadText(['2014-01', '2014-13', '', 'n.d.']); assert.equal(r.freq, 'monthly'); assert.equal(r.invalid, 2); assert.equal(r.blank, 1); assert.ok(Number.isNaN(r.codes[1]));
// numbers: years, integer periods, non-integers rejected
assert.equal(tsdReadNumber([2000, 2001]).freq, 'yearly');
assert.equal(tsdReadNumber([1, 2, 3]).freq, 'generic');
assert.equal(tsdReadNumber([1.5, 2]).invalid, 1);
// R index: decimal years for months/quarters, the year for annual data, positions otherwise
assert.equal(tsdIndex(648, 'monthly', 0), 2014); assert.equal(tsdIndex(206, 'quarterly', 0), 2011.5); assert.equal(tsdIndex(18932, 'daily', 4), 5);

// series: unique periods pass; repeats need a panel variable or an explicit rule
const time = [648, 649, 650, 651], y = new Float64Array([1, 2, 3, 4]);
let s = tsdSeries({ time, freq: 'monthly', vars: { y } }); assert.deepEqual(s.errors, []); assert.deepEqual(s.rows.map(r => r.y), [1, 2, 3, 4]);
s = tsdSeries({ time: [648, 648, 649, 650], freq: 'monthly', vars: { y } }); assert.match(s.errors[0], /appears more than once \(2014m1 \(2 rows\)\)/);
s = tsdSeries({ time: [648, 648, 649, 650], freq: 'monthly', repeats: 'mean', vars: { y } }); assert.deepEqual(s.rows.map(r => r.y), [1.5, 3, 4]);
s = tsdSeries({ time: [648, 648, 649, 650], freq: 'monthly', repeats: 'sum', vars: { y } }); assert.deepEqual(s.rows.map(r => r.y), [3, 3, 4]);
// panel: pick one unit, or combine by period explicitly
const pt = [648, 649, 648, 649], pu = ['A', 'A', 'B', 'B'], py = new Float64Array([1, 2, 10, 20]);
s = tsdSeries({ time: pt, unit: pu, freq: 'monthly', vars: { y: py } }); assert.match(s.errors[0], /panel data \(2 units\)/);
s = tsdSeries({ time: pt, unit: pu, unitPick: 'B', freq: 'monthly', vars: { y: py } }); assert.deepEqual(s.rows.map(r => r.y), [10, 20]);
s = tsdSeries({ time: pt, unit: pu, combine: 'mean', freq: 'monthly', vars: { y: py } }); assert.deepEqual(s.rows.map(r => r.y), [5.5, 11]);
s = tsdSeries({ time: pt, unit: pu, combine: 'sum', freq: 'monthly', vars: { y: py } }); assert.deepEqual(s.rows.map(r => r.y), [11, 22]);
// repeats within one unit are still reported in a panel
s = tsdSeries({ time: [648, 648, 649], unit: ['A', 'A', 'A'], unitPick: 'A', freq: 'monthly', vars: { y: new Float64Array([1, 2, 3]) } }); assert.match(s.errors[0], /more than once/);
// gaps and missing outcomes are errors, never filled
s = tsdSeries({ time: [648, 650, 651], freq: 'monthly', vars: { y: new Float64Array([1, 2, 3]) } }); assert.match(s.errors[0], /gaps \(1 missing between 2014m1 and 2014m3\)/);
s = tsdSeries({ time: [648, 649, 650], freq: 'monthly', vars: { y: new Float64Array([1, NaN, 3]) } }); assert.match(s.errors[0], /y is missing in 1 period/);
// subgroup mask
s = tsdSeries({ time: [648, 649, 650], freq: 'monthly', mask: [1, 1, 0], vars: { y: new Float64Array([1, 2, 3]) } }); assert.equal(s.rows.length, 2);
// panel candidates: columns that make (unit, time) unique
const cand = tsdPanelCandidates([2000, 2000, 2001, 2001], [['ent', [1, 2, 1, 2]], ['x', [5, 5, 6, 6]]]);
assert.deepEqual(cand.map(c => c.name), ['ent']);
// daily kinds: weekly steps, weekday-only trading days
const days = []; for (let d = 18932; days.length < 30; d++) { const w = new Date(Date.UTC(1960, 0, 1) + d * 86400000).getUTCDay(); if (w && w < 6) days.push(d); }
assert.equal(tsdDailyKind(days), 'trading');
assert.equal(tsdDailyKind([18932, 18939, 18946, 18953]), 'weekly');
assert.equal(tsdDailyKind([18932, 18933, 18934, 18935]), 'daily');
s = tsdSeries({ time: days, freq: 'trading', vars: { y: new Float64Array(days.length).fill(1) } }); assert.deepEqual(s.errors, []);
s = tsdSeries({ time: days, freq: 'daily', vars: { y: new Float64Array(days.length).fill(1) } }); assert.match(s.errors[0], /read the dates as trading days/);
console.log('Text dates (ISO, Stata m/q, month names in English and Spanish, slash order), numeric years, labels, R index, repeats, panels, gaps, missing values, subgroups, panel candidates and trading days passed.');
// dates on the first or last day of each period are monthly, quarterly or annual data
import { tsdFromDays } from '../src/ts-dates.mjs';
const firstOfMonth = tsdReadText(['2015-01-01', '2015-02-01', '2015-03-01', '2015-04-01']).codes;
assert.equal(tsdDailyKind(firstOfMonth), 'monthly');
assert.deepEqual(Array.from(tsdFromDays(firstOfMonth, 'monthly')), [660, 661, 662, 663]);
assert.equal(tsdDailyKind(tsdReadText(['2015-01-31', '2015-02-28', '2015-03-31']).codes), 'monthly');
assert.equal(tsdDailyKind(tsdReadText(['2015-01-01', '2015-04-01', '2015-07-01', '2015-10-01']).codes), 'quarterly');
assert.equal(tsdDailyKind(tsdReadText(['2015-01-01', '2016-01-01', '2017-01-01']).codes), 'yearly');
assert.equal(tsdDailyKind(tsdReadText(['2015-01-01', '2015-01-02', '2015-01-03']).codes), 'daily');
// panel: first-of-month dates repeated per unit
assert.equal(tsdDailyKind(tsdReadText(['2015-01-01', '2015-01-01', '2015-02-01', '2015-02-01']).codes, ['A', 'B', 'A', 'B']), 'monthly');
console.log('First/last-day-of-period dates are read as monthly, quarterly or annual periods.');
// combining repeated rows skips missing values (Stata collapse); a period is missing only when all its rows are
const sm = tsdSeries({ time: [648, 648, 649, 649], freq: 'monthly', repeats: 'mean', vars: { y: new Float64Array([1, NaN, NaN, NaN]) } });
assert.equal(sm.rows[0].y, 1); assert.ok(Number.isNaN(sm.rows[1].y)); assert.match(sm.errors[0], /y is missing in 1 period/);
console.log('Combining repeated rows skips missing values.');
// a nearly unique measurement is not a panel identifier
assert.deepEqual(tsdPanelCandidates([1, 1, 2, 3, 4, 5], [['sales', [10, 11, 12, 13, 14, 10]]]), []);
console.log('Nearly unique columns are not suggested as panel variables.');
