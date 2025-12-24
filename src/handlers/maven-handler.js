const core = require('@actions/core');
const { MavenExecutor } = require('../executors/maven-executor');
const { TestProcessor } = require('../processors/test-processor');
const { SecurityScanner } = require('../scanners/security-scanner');
const { ArtifactManager } = require('../managers/artifact-manager');
const { CacheManager } = require('../managers/cache-manager');
const { EnvironmentManager } = require('../managers/environment-manager');

/**
 * Main handler for Maven operations
 */
class MavenActionHandler {
  constructor(outputManager, validatedInputs) {
    this.outputManager = outputManager;
    this.validatedInputs = validatedInputs;
    this.environmentManager = new EnvironmentManager(validatedInputs);
    this.mavenExecutor = new MavenExecutor(validatedInputs);
    this.testProcessor = new TestProcessor(validatedInputs);
    this.securityScanner = new SecurityScanner(validatedInputs);
    this.artifactManager = new ArtifactManager(validatedInputs);
    this.cacheManager = new CacheManager(validatedInputs);
  }

  /**
   * Execute Maven operations based on event context
   */
  async execute(eventContext) {
    const startTime = Date.now();
    const operation = this.validatedInputs.operation;
    
    try {
      // Setup environment (Java and Maven)
      const environmentSetup = await this.setupEnvironment();
      
      // Restore cache if enabled
      if (this.validatedInputs.cacheEnabled) {
        await this.cacheManager.restore();
      }
      
      // Execute Maven operation
      const buildResult = await this.executeMavenOperation(operation, eventContext);
      
      // Handle artifacts
      const artifactPath = await this.artifactManager.handleArtifacts(operation);
      
      // Save cache if enabled
      if (this.validatedInputs.cacheEnabled) {
        await this.cacheManager.save();
      }
      
      const endTime = Date.now();
      const buildTime = Math.round((endTime - startTime) / 1000);
      
      return {
        buildStatus: 'success',
        artifactPath,
        buildTime,
        operation,
        environment: this.environmentInfo
      };
      
    } catch (error) {
      const endTime = Date.now();
      const buildTime = Math.round((endTime - startTime) / 1000);
      
      return {
        buildStatus: 'failure',
        error: error.message,
        buildTime,
        operation,
        environment: this.environmentInfo || null
      };
    }
  }

  /**
   * Setup Maven environment
   */
  async setupEnvironment() {
    core.info('🔧 Setting up Maven environment...');
    
    try {
      // Setup Java and Maven environment
      const environmentSetup = await this.environmentManager.setupEnvironment();
      
      // Store environment info for outputs
      this.environmentInfo = this.environmentManager.getEnvironmentSummary(
        environmentSetup.java,
        environmentSetup.maven
      );
      
      core.info('✅ Environment setup completed');
      return environmentSetup;
      
    } catch (error) {
      core.error(`Environment setup failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute specific Maven operation
   */
  async executeMavenOperation(operation, eventContext) {
    core.info(`🔨 Executing Maven operation: ${operation}`);
    
    switch (operation) {
      case 'validate':
        return await this.mavenExecutor.validate();
      case 'compile':
        return await this.mavenExecutor.compile();
      case 'test':
        return await this.mavenExecutor.test();
      case 'package':
        return await this.mavenExecutor.package();
      case 'verify':
        return await this.mavenExecutor.verify();
      case 'install':
        return await this.mavenExecutor.install();
      case 'deploy':
        return await this.mavenExecutor.deploy();
      default:
        throw new Error(`Unsupported Maven operation: ${operation}`);
    }
  }

  /**
   * Check if tests should be processed
   */
  shouldProcessTests(operation) {
    const testOperations = ['test', 'package', 'verify', 'install', 'deploy'];
    return testOperations.includes(operation) && !this.validatedInputs.skipTests;
  }
}

module.exports = { MavenActionHandler };