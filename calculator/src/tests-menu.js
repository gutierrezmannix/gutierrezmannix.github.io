      const TESTS = [
        ['Univariate Descriptive Analysis', goT({ tab: 'one' })],
        ['t-tests · One-sample', goT({ tab: 'one', ttMode: 'value' }, 'T-test')],
        ['t-tests · Independent samples', goT({ tab: 'two', twoMode: 'means' })],
        ['t-tests · Paired samples', goT({ tab: 'one', ttMode: 'paired' }, 'T-test')],
        ['One-way ANOVA', goT({ tab: 'two', twoMode: 'means' })],
        ['Chi-square test', goT({ tab: 'two', twoMode: 'ct' })],
        ['Correlation', goT({ tab: 'two', twoMode: 'corr' })],
        ['Regression', goT({ tab: 'reg' })],
        ['Text analysis', goT({ tab: 'text' })],
        ['Time series', goT({ tab: 'ts' })],
        ['Networks analysis', goT({ tab: 'ergm' })],
        ['Structural equation modeling', goT({ tab: 'sem' })],
        ['Which test do I need?', () => this.setState({ dhOpen: true, dhQ1: '', dhQ2: '', mfPane: 'help', mfDock: true, mfMobile: 'dock', mfFile: false, mfNav: '' })]
      ];
