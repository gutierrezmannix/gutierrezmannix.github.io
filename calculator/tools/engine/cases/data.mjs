import { packet, num, cat } from '../casekit.mjs';
const other = cols => { const o = {}; cols.forEach((c, i) => { o[c.key] = { name: c.name, type: c.type, values: c.values }; }); return o; };
export function cases() {
  const base = [cat('id', ['3', '1', '2', '2', '5']), cat('a', ['p', 'q', 'r', 's', null]), num('v', [1, 2, 3, null, 5])];
  const oth = other([{ key: 'v1', name: 'id', type: 'categorical', values: ['2', '3', '9', '1', '1'] }, { key: 'v3', name: 'v', type: 'numeric', values: [11, 12, 13, 14, 15] }, { key: 'v4', name: 'b', type: 'categorical', values: ['A', 'B', 'C', 'D', null] }]);
  const out = [];
  for (const join of ['left', 'right', 'inner', 'full']) out.push({ name: 'merge_' + join, packet: { ...packet('merge', base, { keys: ['id'] }, { join }), other: oth } });
  const ub = [cat('id', ['3', '1', '2', '4', '5']), cat('a', ['p', 'q', 'r', 's', null]), num('v', [1, 2, 3, null, 5])];
  for (const join of ['left', 'right', 'inner', 'full']) out.push({ name: 'merge_ok_' + join, packet: { ...packet('merge', ub, { keys: ['id'] }, { join }), other: oth } });
  out.push({ name: 'merge_two_keys', packet: { ...packet('merge', [cat('id', ['1', '1', '2']), num('yr', [2000, 2001, 2000]), num('v', [1, 2, 3])], { keys: ['id', 'yr'] }, { join: 'full' }), other: other([{ key: 'v1', name: 'id', type: 'categorical', values: ['1', '2', '2'] }, { key: 'v2', name: 'yr', type: 'numeric', values: [2001, 2000, 2002] }, { key: 'v4', name: 'w', type: 'numeric', values: [7, 8, 9] }]) } });
  out.push({ name: 'merge_many', packet: { ...packet('merge', base, { keys: ['id'] }, { join: 'left', manyToMany: false }), other: other([{ key: 'v1', name: 'id', type: 'categorical', values: ['2', '2'] }, { key: 'v4', name: 'b', type: 'categorical', values: ['x', 'y'] }]) } });
  out.push({ name: 'merge_many_ok', packet: { ...packet('merge', base, { keys: ['id'] }, { join: 'inner', manyToMany: true }), other: other([{ key: 'v1', name: 'id', type: 'categorical', values: ['2', '2'] }, { key: 'v4', name: 'b', type: 'categorical', values: ['x', 'y'] }]) } });
  out.push({ name: 'merge_nokey', packet: { ...packet('merge', base, { keys: ['a'] }, { join: 'left' }), other: oth } });
  out.push({ name: 'merge_nokeys', packet: { ...packet('merge', base, {}, { join: 'left' }), other: oth } });
  out.push({ name: 'merge_noother', packet: packet('merge', base, { keys: ['id'] }) });
  out.push({ name: 'append', packet: { ...packet('append', base, {}), other: other([{ key: 'v1', name: 'id', type: 'categorical', values: ['7'] }, { key: 'v2', name: 'a', type: 'categorical', values: ['z'] }, { key: 'v3', name: 'v', type: 'numeric', values: [9] }]) } });
  out.push({ name: 'append_mismatch', packet: { ...packet('append', base, {}), other: oth } });
  out.push({ name: 'append_types', packet: { ...packet('append', base, {}), other: other([{ key: 'v1', name: 'id', type: 'numeric', values: [7] }, { key: 'v2', name: 'a', type: 'categorical', values: ['z'] }, { key: 'v3', name: 'v', type: 'numeric', values: [9] }]) } });
  const w = [cat('sid', ['b', 'a', 'c']), num('k', [9, 8, 7]), num('t1', [1, 2, null]), num('t2', [4, 5, 6])];
  out.push({ name: 'long', packet: packet('long', w, { subject: 'sid', variables: ['t1', 't2'] }) });
  out.push({ name: 'long_dupid', packet: packet('long', [cat('sid', ['b', 'b', 'c']), num('t1', [1, 2, 3]), num('t2', [4, 5, 6])], { subject: 'sid', variables: ['t1', 't2'] }) });
  const l = [cat('sid', ['b', 'a', 'b', 'a', 'c']), num('yr', [2001, 2001, 2000, 2000, 2001]), num('y', [1, 2, 3, 4, 5]), num('extra', [0, 0, 0, 0, 0])];
  out.push({ name: 'wide', packet: packet('wide', l, { subject: 'sid', time: 'yr', y: 'y' }) });
  out.push({ name: 'wide_dup', packet: packet('wide', [cat('sid', ['b', 'b']), num('yr', [2001, 2001]), num('y', [1, 2])], { subject: 'sid', time: 'yr', y: 'y' }) });
  out.push({ name: 'duplicates', packet: packet('duplicates', [cat('id', ['3', '1', '2', '2', '5', '1', null, null]), num('v', [1, 2, 3, 4, 5, 6, 7, 8])], { keys: ['id'] }) });
  out.push({ name: 'duplicates_nokeys', packet: packet('duplicates', base, {}) });
  return out;
}
