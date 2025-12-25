const core = require('@actions/core');
const fs = require('fs').promises;
const path = require('path');
const { XMLParser } = require('fast-xml-parser');

/**
 * Processes Maven test results and generates reports
 */
class TestProcessor {
  constructor(validatedInputs) {
    this.validatedInputs = validatedInputs;
    this.workingDirectory = validatedInputs.workingDirectory;
    this.publishResults = validatedInputs.publishTestResults;
    this.generateCoverage = validatedInputs.generateCoverage;
  }

  /**
   * Process test results from Surefire reports
   */
  async process() {
    core.info('📊 Processing test results...');

    try {
      const testResults = await this.parseTestResults();
      const coverageResults = this.generateCoverage ? await this.parseCoverageResults() : null;

      if (this.publishResults) {
        await this.publishTestResults(testResults);
      }

      return {
        ...testResults,
        coverage: coverageResults
      };
    } catch (error) {
      core.warning(`Failed to process test results: ${error.message}`);
      return null;
    }
  }

  /**
   * Parse Surefire test reports
   */
  async parseTestResults() {
    const surefireDir = path.join(this.workingDirectory, 'target', 'surefire-reports');

    try {
      const files = await fs.readdir(surefireDir);
      const xmlFiles = files.filter((file) => file.startsWith('TEST-') && file.endsWith('.xml'));

      let totalTests = 0;
      let totalFailures = 0;
      let totalErrors = 0;
      let totalSkipped = 0;
      let totalTime = 0;
      const testSuites = [];

      for (const xmlFile of xmlFiles) {
        const xmlPath = path.join(surefireDir, xmlFile);
        const xmlContent = await fs.readFile(xmlPath, 'utf8');

        const parser = new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: '@_'
        });

        const result = parser.parse(xmlContent);
        const testSuite = result.testsuite;

        if (testSuite) {
          const tests = parseInt(testSuite['@_tests'] || '0');
          const failures = parseInt(testSuite['@_failures'] || '0');
          const errors = parseInt(testSuite['@_errors'] || '0');
          const skipped = parseInt(testSuite['@_skipped'] || '0');
          const time = parseFloat(testSuite['@_time'] || '0');

          totalTests += tests;
          totalFailures += failures;
          totalErrors += errors;
          totalSkipped += skipped;
          totalTime += time;

          testSuites.push({
            name: testSuite['@_name'],
            tests,
            failures,
            errors,
            skipped,
            time,
            className: testSuite['@_name']
          });
        }
      }

      const successRate =
        totalTests > 0
          ? (((totalTests - totalFailures - totalErrors) / totalTests) * 100).toFixed(2)
          : '0';

      return {
        totalTests,
        totalFailures,
        totalErrors,
        totalSkipped,
        totalTime: totalTime.toFixed(2),
        successRate,
        testSuites
      };
    } catch (error) {
      core.warning(`No test results found in ${surefireDir}`);
      return {
        totalTests: 0,
        totalFailures: 0,
        totalErrors: 0,
        totalSkipped: 0,
        totalTime: '0',
        successRate: '0',
        testSuites: []
      };
    }
  }

  /**
   * Parse JaCoCo coverage results
   */
  async parseCoverageResults() {
    const jacocoFile = path.join(this.workingDirectory, 'target', 'site', 'jacoco', 'jacoco.xml');

    try {
      const xmlContent = await fs.readFile(jacocoFile, 'utf8');

      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_'
      });

      const result = parser.parse(xmlContent);
      const report = result.report;

      if (report && report.counter) {
        const counters = Array.isArray(report.counter) ? report.counter : [report.counter];

        const instructionCounter = counters.find((c) => c['@_type'] === 'INSTRUCTION');
        const branchCounter = counters.find((c) => c['@_type'] === 'BRANCH');
        const lineCounter = counters.find((c) => c['@_type'] === 'LINE');

        const calculatePercentage = (counter) => {
          if (!counter) return '0';
          const covered = parseInt(counter['@_covered'] || '0');
          const missed = parseInt(counter['@_missed'] || '0');
          const total = covered + missed;
          return total > 0 ? ((covered / total) * 100).toFixed(2) : '0';
        };

        return {
          instructionCoverage: calculatePercentage(instructionCounter),
          branchCoverage: calculatePercentage(branchCounter),
          lineCoverage: calculatePercentage(lineCounter),
          reportPath: jacocoFile
        };
      }

      return null;
    } catch (error) {
      core.warning(`No coverage results found: ${error.message}`);
      return null;
    }
  }

  /**
   * Publish test results as GitHub Actions annotations
   */
  async publishTestResults(testResults) {
    core.info('📋 Publishing test results...');

    // Create summary
    const summary = `
## Test Results Summary

| Metric | Value |
|--------|-------|
| Total Tests | ${testResults.totalTests} |
| Passed | ${testResults.totalTests - testResults.totalFailures - testResults.totalErrors} |
| Failed | ${testResults.totalFailures} |
| Errors | ${testResults.totalErrors} |
| Skipped | ${testResults.totalSkipped} |
| Success Rate | ${testResults.successRate}% |
| Duration | ${testResults.totalTime}s |
`;

    core.summary.addRaw(summary);

    // Add test suite details
    if (testResults.testSuites.length > 0) {
      core.summary.addHeading('Test Suites', 3);

      const tableData = testResults.testSuites.map((suite) => [
        suite.name,
        suite.tests.toString(),
        suite.failures.toString(),
        suite.errors.toString(),
        suite.skipped.toString(),
        `${suite.time}s`
      ]);

      core.summary.addTable([
        ['Suite', 'Tests', 'Failures', 'Errors', 'Skipped', 'Time'],
        ...tableData
      ]);
    }

    await core.summary.write();

    // Add annotations for failures
    if (testResults.totalFailures > 0 || testResults.totalErrors > 0) {
      core.warning(`${testResults.totalFailures + testResults.totalErrors} test(s) failed`);
    }
  }
}

module.exports = { TestProcessor };
