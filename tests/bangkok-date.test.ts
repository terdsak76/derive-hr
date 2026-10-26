import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatBangkokDate, bangkokMonth, bangkokYear, bangkokDateAfter } from '../src/lib/bangkok-date';
import { parseBangkokDateTime, formatBangkokDateTime } from '../src/lib/overtime';
import { parseLeaveDate } from '../src/lib/leaves';
import { parseWorkdayDate } from '../src/lib/workday-changes';
import { parseFinanceMonth } from '../src/lib/finance';

test('Bangkok calendar defaults cross midnight, month and year at 17:00 UTC', () => {
  for (const [timestamp, expected] of [
    ['2026-10-25T16:59:59.999Z', '2026-10-25'],
    ['2026-10-25T17:00:00.000Z', '2026-10-26'],
    ['2026-10-26T16:59:59.999Z', '2026-10-26'],
    ['2026-10-31T17:00:00.000Z', '2026-11-01'],
    ['2026-12-31T17:00:00.000Z', '2027-01-01'],
    ['2028-02-28T17:00:00.000Z', '2028-02-29'],
  ]) {
    const instant = new Date(timestamp);
    assert.equal(formatBangkokDate(instant), expected);
    assert.equal(bangkokMonth(instant), expected.slice(0, 7));
    assert.equal(bangkokYear(instant), Number(expected.slice(0, 4)));
  }
});

test('workday default dates advance by Bangkok calendar days across rollovers', () => {
  assert.equal(bangkokDateAfter(2, new Date('2026-12-30T17:00:00Z')), '2027-01-02');
  assert.equal(bangkokDateAfter(2, new Date('2028-02-27T17:00:00Z')), '2028-03-01');
});

test('calendar-only leave and workday dates retain their selected day', () => {
  for (const parse of [parseLeaveDate, parseWorkdayDate]) {
    const date = parse('2026-10-26');
    assert.ok(date);
    assert.equal(formatBangkokDate(date), '2026-10-26');
    assert.equal(date.toISOString(), '2026-10-26T00:00:00.000Z');
  }
});

test('overtime input and display use Bangkok independently of the host timezone', () => {
  const date = parseBangkokDateTime('2027-01-01T00:15');
  assert.ok(date);
  assert.equal(date.toISOString(), '2026-12-31T17:15:00.000Z');
  assert.equal(formatBangkokDateTime(date), '01/01/2027 00:15');
});

test('finance reporting boundaries include the whole Bangkok calendar month', () => {
  const month = parseFinanceMonth('2026-12');
  assert.ok(month);
  assert.equal(formatBangkokDate(month.start), '2026-12-01');
  assert.equal(formatBangkokDate(new Date(month.end.getTime() - 1)), '2026-12-31');
  assert.equal(formatBangkokDate(month.end), '2027-01-01');
});
