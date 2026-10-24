  // GM26 scatter range controls begin
  scatterOptions(slot, x, y) {
    const range = name => this.memo('scatter-range|' + name, () => {
      const col = this.numVals(name);
      return col ? this._E.observedRange(col.a) : null;
    });
    const dataRange = {x:range(x), y:range(y)};
    const ax = this.axUI(slot, slot === 'plot' ? ['scatter',x,y] : [x,y], {
      x:true, y:true, zero:'y', xName:x, yName:y
    });
    const controls = this._axOut && this._axOut['ax' + slot[0].toUpperCase() + slot.slice(1)];
    if (controls) {
      controls.hasDataRange = !!(dataRange.x && dataRange.y);
      controls.rangeHint = controls.hasDataRange ? 'Observed range · ' + x + ': ' + dataRange.x.map(v => this.numberText(v)).join(' to ') +
        ' · ' + y + ': ' + dataRange.y.map(v => this.numberText(v)).join(' to ') + '. Blank limits use these ranges; entered limits override them.' : '';
    }
    return {ax, dataRange};
  }
  // GM26 scatter range controls end
