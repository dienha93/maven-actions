const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs').promises;
const path = require('path');

/**
 * Handles security vulnerability scanning for Maven projects
 */
class SecurityScanner {
  constructor(validatedInputs) {
    this.validatedInputs = validatedInputs;
    this.workingDirectory = validatedInputs.workingDirectory;
  }

  /**
   * Run security vulnerability scan
   */
  async scan() {
    core.info('🔒 Running security vulnerability scan...');

    try {
      const owaspResults = await this.runOwaspDependencyCheck();
      const snykResults = await this.runSnykScan();

      return {
        owasp: owaspResults,
        snyk: snykResults,
        totalIssues: (owaspResults?.vulnerabilities || 0) + (snykResults?.vulnerabilities || 0)
      };
    } catch (error) {
      core.warning(`Security scan failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Run OWASP Dependency Check
   */
  async runOwaspDependencyCheck() {
    core.info('🛡️ Running OWASP Dependency Check...');

    try {
      const args = [
        'mvn',
        'org.owasp:dependency-check-maven:check',
        '-DfailBuildOnCVSS=7',
        '-DsuppressionsFile=owasp-suppressions.xml'
      ];

      const options = {
        cwd: this.workingDirectory,
        ignoreReturnCode: true
      };

      const exitCode = await exec.exec(args[0], args.slice(1), options);

      // Parse OWASP report
      const reportPath = path.join(this.workingDirectory, 'target', 'dependency-check-report.json');

      try {
        const reportContent = await fs.readFile(reportPath, 'utf8');
        const report = JSON.parse(reportContent);

        const vulnerabilities = this.parseOwaspReport(report);

        return {
          success: exitCode === 0,
          vulnerabilities: vulnerabilities.length,
          highSeverity: vulnerabilities.filter((v) => v.severity === 'HIGH').length,
          mediumSeverity: vulnerabilities.filter((v) => v.severity === 'MEDIUM').length,
          lowSeverity: vulnerabilities.filter((v) => v.severity === 'LOW').length,
          reportPath,
          details: vulnerabilities
        };
      } catch (parseError) {
        core.warning(`Could not parse OWASP report: ${parseError.message}`);
        return { success: exitCode === 0, vulnerabilities: 0 };
      }
    } catch (error) {
      core.warning(`OWASP Dependency Check failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Run Snyk security scan
   */
  async runSnykScan() {
    core.info('🐍 Running Snyk security scan...');

    try {
      // Check if Snyk token is available
      const snykToken = process.env.SNYK_TOKEN;
      if (!snykToken) {
        core.warning('SNYK_TOKEN not found, skipping Snyk scan');
        return null;
      }

      const args = ['snyk', 'test', '--json', '--severity-threshold=medium'];

      let output = '';
      const options = {
        cwd: this.workingDirectory,
        ignoreReturnCode: true,
        listeners: {
          stdout: (data) => {
            output += data.toString();
          }
        }
      };

      const exitCode = await exec.exec(args[0], args.slice(1), options);

      try {
        const result = JSON.parse(output);
        const vulnerabilities = result.vulnerabilities || [];

        return {
          success: exitCode === 0,
          vulnerabilities: vulnerabilities.length,
          highSeverity: vulnerabilities.filter((v) => v.severity === 'high').length,
          mediumSeverity: vulnerabilities.filter((v) => v.severity === 'medium').length,
          lowSeverity: vulnerabilities.filter((v) => v.severity === 'low').length,
          details: vulnerabilities.map((v) => ({
            id: v.id,
            title: v.title,
            severity: v.severity,
            packageName: v.packageName,
            version: v.version
          }))
        };
      } catch (parseError) {
        core.warning(`Could not parse Snyk output: ${parseError.message}`);
        return { success: exitCode === 0, vulnerabilities: 0 };
      }
    } catch (error) {
      core.warning(`Snyk scan not available: ${error.message}`);
      return null;
    }
  }

  /**
   * Parse OWASP Dependency Check report
   */
  parseOwaspReport(report) {
    const vulnerabilities = [];

    if (report.dependencies) {
      for (const dependency of report.dependencies) {
        if (dependency.vulnerabilities) {
          for (const vuln of dependency.vulnerabilities) {
            vulnerabilities.push({
              id: vuln.name,
              title: vuln.description,
              severity: vuln.severity,
              packageName: dependency.fileName,
              cvssScore: vuln.cvssv3?.baseScore || vuln.cvssv2?.score,
              references: vuln.references?.map((ref) => ref.url) || []
            });
          }
        }
      }
    }

    return vulnerabilities;
  }

  /**
   * Generate security report summary
   */
  generateSecuritySummary(results) {
    if (!results) return '';

    let summary = '## Security Scan Results\n\n';

    if (results.owasp) {
      summary += '### OWASP Dependency Check\n';
      summary += `- Total Vulnerabilities: ${results.owasp.vulnerabilities}\n`;
      summary += `- High Severity: ${results.owasp.highSeverity}\n`;
      summary += `- Medium Severity: ${results.owasp.mediumSeverity}\n`;
      summary += `- Low Severity: ${results.owasp.lowSeverity}\n\n`;
    }

    if (results.snyk) {
      summary += `### Snyk Scan\n`;
      summary += `- Total Vulnerabilities: ${results.snyk.vulnerabilities}\n`;
      summary += `- High Severity: ${results.snyk.highSeverity}\n`;
      summary += `- Medium Severity: ${results.snyk.mediumSeverity}\n`;
      summary += `- Low Severity: ${results.snyk.lowSeverity}\n\n`;
    }

    summary += `**Total Issues Found: ${results.totalIssues}**\n`;

    return summary;
  }
}

module.exports = { SecurityScanner };
