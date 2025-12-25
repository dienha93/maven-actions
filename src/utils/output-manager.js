const core = require('@actions/core');
const { StringUtils } = require('./string-utils');
/**
 * Manages action outputs and provides formatted results
 */
class OutputManager {
  constructor() {
    this.outputs = {};
  }

  /**
   * Set all action outputs based on execution results
   */
  setOutputs(result) {
    core.info('📋 Setting action outputs...');

    // Build status
    this.setOutput('status', result.status);
    
    // Build time
    this.setOutput('build-time', result.buildTime?.toString() || '0');
    
    // Artifact path
    if (result.artifactPath && result.artifactPath.length > 0) {
      this.setOutput('artifact-path', result.artifactPath.join(','));
    }
    
    // Environment information
    if (result.environment) {
      this.setOutput('java-version', result.environment.java.version);
      this.setOutput('maven-version', result.environment.maven.version);
      
      // Set warnings if any
      const warnings = [];
      if (result.environment.java.warning) {
        warnings.push(`Java: ${result.environment.java.warning}`);
      }
      if (result.environment.maven.warning) {
        warnings.push(`Maven: ${result.environment.maven.warning}`);
      }
      
      if (warnings.length > 0) {
        this.setOutput('environment-warnings', warnings.join('; '));
      }
    }
    
    // Error information
    if (result.error) {
      core.setOutput('error-message', result.error);
    }

    this.logOutputSummary();
  }

  /**
   * Set individual output with validation
   */
  setOutput(name, value) {
    if (value !== undefined && value !== null) {
      core.setOutput(name, value);
      this.outputs[name] = value;
      core.debug(`Output set: ${name} = ${value}`);
    }
  }

  /**
   * Create GitHub Actions job summary
   */
  async createJobSummary(result) {
    core.info('📊 Creating job summary...');

    try {
      // Main header
      core.summary.addHeading('Maven Build Results', 1);
      
      // Build status
      const statusEmoji = result.status === 'success' ? '✅' : '❌';
      core.summary.addRaw(`${statusEmoji} **Build Status:** ${result.status.toUpperCase()}\n`);
      core.summary.addRaw(`⏱️ **Build Time:** ${result.buildTime}s\n\n`);

      // Environment information
      if (result.environment) {
        await this.addEnvironmentSection(result.environment);
      }

      // Artifacts section
      if (result.artifactPath && result.artifactPath.length > 0) {
        await this.addArtifactsSection(result.artifactPath);
      }

      // Error section
      if (result.error) {
        core.summary.addHeading('Error Details', 2);
        core.summary.addCodeBlock(result.error, 'text');
      }

      await core.summary.write();
      core.info('✅ Job summary created');
    } catch (error) {
      core.warning(`Failed to create job summary: ${error.message}`);
    }
  }


  /**
   * Add environment section to summary
   */
  async addEnvironmentSection(environment) {
    core.summary.addHeading('Environment', 2);
    
    const environmentTable = [
      ['Tool', 'Version', 'Status', 'Notes'],
      [
        'Java',
        environment.java.version,
        this.getActionStatusEmoji(environment.java.action),
        environment.java.warning || 'OK'
      ],
      [
        'Maven',
        environment.maven.version,
        this.getActionStatusEmoji(environment.maven.action),
        environment.maven.warning || 'OK'
      ]
    ];

    core.summary.addTable(environmentTable);
  }

  /**
   * Get emoji for action status
   */
  getActionStatusEmoji(action) {
    switch (action) {
      case 'existing': return '✅ Existing';
      case 'installed': return '📦 Installed';
      case 'warning': return '⚠️ Warning';
      default: return '❓ Unknown';
    }
  }
  async addArtifactsSection(artifactPaths) {
    core.summary.addHeading('Build Artifacts', 2);
    
    const artifacts = artifactPaths.map(path => {
      const fileName = path.split('/').pop();
      const fileType = fileName.split('.').pop().toUpperCase();
      return [fileName, fileType];
    });

    if (artifacts.length > 0) {
      core.summary.addTable([
        ['Artifact', 'Type'],
        ...artifacts
      ]);
    }

    core.summary.addRaw(`\n📦 **Total Artifacts:** ${artifacts.length}\n`);
  }

  /**
   * Log output summary to console
   */
  logOutputSummary() {
    core.info('📋 Action Outputs Summary:');
    
    Object.entries(this.outputs).forEach(([key, value]) => {
      core.info(`  ${key}: ${value}`);
    });
  }

  /**
   * Get all outputs
   */
  getOutputs() {
    return { ...this.outputs };
  }
}

module.exports = { OutputManager };