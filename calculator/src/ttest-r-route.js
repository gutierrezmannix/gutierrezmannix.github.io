      // GM26 t-test R semantics
      else if (fn === 't.test') {
        argList.forEach(arg=>{const named=arg.match(/^([A-Za-z_.][\w.]*)\s*=\s*(.+)$/);if(named)kw[named[1]]=named[2].trim();});
        if(kw['conf.level']!==undefined){const confidence=Number(kw['conf.level']);if(!(confidence>0&&confidence<1))return fail('conf.level must be between 0 and 1.');opts.ttAlpha=1-confidence;}
        const paired=/^(true|t)$/i.test(kw.paired || '');
        const alternative=String(kw.alternative || 'two.sided').replace(/["']/g,'').toLowerCase();
        if(alternative!=='two.sided')return fail('This t-test workspace reports two-sided tests. Use alternative = "two.sided".');
        if(/^(true|t)$/i.test(kw['var.equal'] || ''))return fail('The independent-groups test uses Welch unequal-variance inference. var.equal = TRUE is not supported here.');
        if(fm){if(paired)return fail('For paired measurements, use t.test(df$before, df$after, paired = TRUE).');verb='ttest';vars=[fm[1],fm[2].trim()];}
        else{
          const positional=argList.filter(arg=>!/^\s*[A-Za-z_.]+\s*=/.test(arg)),v=dollar(positional[0] || ''),v2=dollar(positional[1] || '');
          if(!v)return fail('t.test() needs a numeric outcome variable.');
          if(paired){if(!v2)return fail('Paired t-tests need two measurements.');if(kw.mu!==undefined&&Number(kw.mu)!==0)return fail('The paired test in this workspace tests a zero mean difference.');verb='ttestp';vars=[v,v2];}
          else if(v2)return fail('For independent samples, use t.test(outcome ~ group, data = df). Two measurement columns are only accepted with paired = TRUE.');
          else{verb='ttest1';vars=[v];opts.mu=kw.mu ?? '0';}
        }
      }
