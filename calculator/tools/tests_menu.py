"""Keep the Tests menu in a readable progression while retaining its existing routes."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def integrate_component(component):
    start = component.index('      const TESTS = [')
    end = component.index('      const MENU_ONLY =', start)
    component = component[:start] + (ROOT / 'src/tests-menu.js').read_text() + component[end:]
    component = component.replace(
        'Choose an analysis: univariate descriptives, t-tests, ANOVA, chi-square, correlation, regression, time series, text analysis, networks or SEM',
        'Choose an analysis: univariate descriptives, t-tests, ANOVA, chi-square, correlation, regression, text analysis, time series, networks analysis or structural equation modeling')
    return component
