      const TESTS = [
        ['Univariate Descriptive Analysis', goT({ tab: 'one' })],
        ['t-tests', goT({ tab: 'ttest' })],
        ['One-way ANOVA', goT({ tab: 'two', twoMode: 'means' })],
        ['Chi-square test', goT({ tab: 'two', twoMode: 'ct' })],
        ['Correlation', goT({ tab: 'two', twoMode: 'corr' })],
        ['Regression', goT({ tab: 'reg' })],
        ['Text analysis', goT({ tab: 'text' })],
        ['Time series', goT({ tab: 'ts' })],
        ['Networks analysis', goT({ tab: 'ergm' })],
        ['Structural equation modeling', goT({ tab: 'sem' })],
        ['Model guide', () => this.openModelGuide()]
      ];
