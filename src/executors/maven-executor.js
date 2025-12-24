const core = require('@actions/core');
const exec = require('@actions/exec');
const path = require('path');

/**
 * Executes Maven commands with proper configuration and error handling
 */
class MavenExecutor {
  constructor(validatedInputs) {
    this.validatedInputs = validatedInputs;
    this.workingDirectory = validatedInputs.workingDirectory;
    this.mavenArgs = validatedInputs.mavenArgs;
    this.settingsFile = validatedInputs.settingsFile;
    this.profiles = validatedInputs.profiles;
    this.skipTests = validatedInputs.skipTests;
  }

  /**
   * Execute Maven validate phase
   */
  async validate() {
    core.info('🔍 Validating Maven project...');
    return await this.executeMavenCommand('validate');
  }

  /**
   * Execute Maven compile phase
   */
  async compile() {
    core.info('🔨 Compiling source code...');
    return await this.executeMavenCommand('compile');
  }

  /**
   * Execute Maven test phase
   */
  async test() {
    core.info('🧪 Running tests...');
    const args = this.skipTests ? ['-DskipTests'] : [];
    return await this.executeMavenCommand('test', args);
  }

  /**
   * Execute Maven package phase
   */
  async package() {
    core.info('📦 Packaging application...');
    const args = this.skipTests ? ['-DskipTests'] : [];
    return await this.executeMavenCommand('package', args);
  }

  /**
   * Execute Maven verify phase
   */
  async verify() {
    core.info('✅ Verifying build...');
    const args = this.skipTests ? ['-DskipTests'] : [];
    return await this.executeMavenCommand('verify', args);
  }

  /**
   * Execute Maven install phase
   */
  async install() {
    core.info('📥 Installing to local repository...');
    const args = this.skipTests ? ['-DskipTests'] : [];
    return await this.executeMavenCommand('install', args);
  }

  /**
   * Execute Maven deploy phase
   */
  async deploy() {
    core.info('🚀 Deploying artifacts...');
    const args = this.skipTests ? ['-DskipTests'] : [];
    return await this.executeMavenCommand('deploy', args);
  }

  /**
   * Execute Maven command with common configuration
   */
  async executeMavenCommand(phase, additionalArgs = []) {
    const args = ['mvn', phase];
    
    // Add settings file if specified
    if (this.settingsFile) {
      args.push('-s', this.settingsFile);
    }
    
    // Add additional arguments
    args.push(...additionalArgs);
    
    // Add custom Maven arguments
    if (this.mavenArgs) {
      args.push(...this.mavenArgs.split(' '));
    }
    
    // Add common flags
    args.push('-B'); // Batch mode
    args.push('-V'); // Show version
    
    const options = {
      cwd: this.workingDirectory,
      ignoreReturnCode: false
    };
    
    try {
      const exitCode = await exec.exec(args[0], args.slice(1), options);
      
      if (exitCode === 0) {
        core.info(`✅ Maven ${phase} completed successfully`);
        return { success: true, phase, exitCode };
      } else {
        throw new Error(`Maven ${phase} failed with exit code ${exitCode}`);
      }
    } catch (error) {
      core.error(`❌ Maven ${phase} failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get Maven project information
   */
  async getProjectInfo() {
    const args = ['mvn', 'help:evaluate', '-Dexpression=project.version', '-q', '-DforceStdout'];
    
    let version = '';
    const options = {
      cwd: this.workingDirectory,
      listeners: {
        stdout: (data) => {
          version += data.toString();
        }
      }
    };
    
    await exec.exec(args[0], args.slice(1), options);
    
    return {
      version: version.trim()
    };
  }
}

module.exports = { MavenExecutor };