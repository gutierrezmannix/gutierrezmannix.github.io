// Pick a value in a labelled control, as a person does (build .70): a native <select> (small lists of options), or a
// searchable box (every list of variables, and long lists) — type the value, then click its option. Several values (a
// list of variables) are added one by one through the same box. value: 'name' | { label: 'Shown text' } | [ ... ].
async function pickBy(page, scope, label, value) {
  scope = scope || page;
  const sel = scope.locator('select[aria-label="' + label + '"]').first();
  if (await sel.count()) return sel.selectOption(value);
  const box = scope.getByRole('combobox', { name: label, exact: true }).first();
  if (Array.isArray(value)) { // a list of variables (chips): the list given replaces the one there
    const grp = scope.getByRole('group', { name: label, exact: true }).first();
    if (await grp.count()) for (let k = 0; k < 40; k++) { const x = grp.locator('button[aria-label^="Remove "]').first(); if (!(await x.count())) break; await x.click(); await page.waitForTimeout(120); }
  }
  for (const v of Array.isArray(value) ? value : [value]) {
    const text = v && typeof v === 'object' ? v.label : String(v);
    await box.click(); await box.fill(''); await box.type(text); await page.waitForTimeout(200);
    const list = page.locator('.tl-combo-list').first();
    const opt = v && typeof v === 'object' ? list.locator('[role=option]', { hasText: v.label }).first() : list.locator('[role=option][data-value="' + text.replace(/"/g, '\\"') + '"]').first();
    await opt.dispatchEvent('mousedown'); await page.waitForTimeout(250);
  }
}
module.exports = { pickBy };
