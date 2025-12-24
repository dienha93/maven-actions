const { MavenActionHandler } = require('../../src/handlers/maven-handler');
const { OutputManager } = require('../../src/utils/output-manager');

// Mock dependencies
jest.mock('@actions/core');
jest.mock('../../src/executors/maven-executor');
jest.mock('../../src/processors/test-processor');
jest.mock('../../src/scanners/security-scanner');
jest.mock('../../src/managers/artifact-manager');
jest.mock('../../src/managers/cache-manager');
jest.mock('../../src/managers/environment-manager');

const core = require('@actions/core');

describe('MavenActionHandler', () => {
  let handler;
  let outputManager;
  let validatedInputs;

  beforeEach(() => {
    outputManager = new OutputManager();
    
    // Create mock validated inputs with the new structure
    validatedInputs = {
      operation: 'package',
      environmentVariables: {},
      javaVersion: '17',
      javaDistribution: 'corretto',
      mavenVersion: '3.9.5',
      workingDirectory: '.',
      settingsFile: '',
      mavenArgs: '',
      cacheEnabled: true,
      skipTests: false
    };
    
    handler = new MavenActionHandler(outputManager, validatedInputs);
    
    // Mock the environment manager methods
    handler.environmentManager.setupEnvironment = jest.fn().mockResolvedValue({
      java: { action: 'existing', version: '17' },
      maven: { action: 'existing', version: '3.9.5' }
    });
    
    handler.environmentManager.getEnvironmentSummary = jest.fn().mockReturnValue({
      java: { version: '17', action: 'existing' },
      maven: { version: '3.9.5', action: 'existing' }
    });
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Default mock implementations
    core.getInput.mockImplementation((name) => {
      const inputs = {
        'operation': 'package',
        'cache-enabled': 'true',
        'skip-tests': 'false',
        'security-scan': 'false',
        'publish-test-results': 'true',
        'generate-coverage': 'false'
      };
      return inputs[name] || '';
    });
    
    core.getBooleanInput.mockImplementation((name) => {
      const boolInputs = {
        'cache-enabled': true,
        'skip-tests': false,
        'security-scan': false,
        'publish-test-results': true,
        'generate-coverage': false
      };
      return boolInputs[name] || false;
    });
  });

  describe('execute', () => {
    it('should execute Maven package operation successfully', async () => {
      // Arrange
      const eventContext = {
        eventName: 'push',
        branch: 'main'
      };

      // Mock successful execution
      handler.mavenExecutor.package = jest.fn().mockResolvedValue({ success: true });
      handler.cacheManager.restore = jest.fn().mockResolvedValue(true);
      handler.cacheManager.save = jest.fn().mockResolvedValue(true);
      handler.artifactManager.handleArtifacts = jest.fn().mockResolvedValue(['/path/to/artifact.jar']);

      // Act
      const result = await handler.execute(eventContext);

      // Assert
      expect(result.buildStatus).toBe('success');
      expect(result.operation).toBe('package');
      expect(result.artifactPath).toEqual(['/path/to/artifact.jar']);
      expect(handler.cacheManager.restore).toHaveBeenCalled();
      expect(handler.cacheManager.save).toHaveBeenCalled();
    });

    it('should handle Maven execution failure', async () => {
      // Arrange
      const eventContext = {
        eventName: 'push',
        branch: 'feature/test'
      };

      const error = new Error('Maven build failed');
      handler.mavenExecutor.package = jest.fn().mockRejectedValue(error);
      handler.cacheManager.restore = jest.fn().mockResolvedValue(false);

      // Act
      const result = await handler.execute(eventContext);

      // Assert
      expect(result.buildStatus).toBe('failure');
      expect(result.error).toBe('Maven build failed');
      expect(result.operation).toBe('package');
    });

    it('should process tests when operation includes testing', async () => {
      // Arrange - Update the validatedInputs to use 'verify' operation
      handler.validatedInputs.operation = 'verify';
      const eventContext = { eventName: 'pull_request' };

      handler.mavenExecutor.verify = jest.fn().mockResolvedValue({ success: true });
      handler.testProcessor.process = jest.fn().mockResolvedValue({
        totalTests: 10,
        totalFailures: 0,
        successRate: '100'
      });
      handler.cacheManager.restore = jest.fn().mockResolvedValue(true);
      handler.cacheManager.save = jest.fn().mockResolvedValue(true);
      handler.artifactManager.handleArtifacts = jest.fn().mockResolvedValue([]);

      // Act
      const result = await handler.execute(eventContext);

      // Assert
      expect(result.buildStatus).toBe('success');
    });

  });

  describe('shouldProcessTests', () => {
    it('should return true for test operations when tests are not skipped', () => {
      core.getBooleanInput.mockReturnValue(false); // skip-tests = false
      
      expect(handler.shouldProcessTests('test')).toBe(true);
      expect(handler.shouldProcessTests('package')).toBe(true);
      expect(handler.shouldProcessTests('verify')).toBe(true);
    });

    it('should return false when tests are skipped', () => {
      // Update validatedInputs to have skipTests = true
      handler.validatedInputs.skipTests = true;
      
      expect(handler.shouldProcessTests('test')).toBe(false);
      expect(handler.shouldProcessTests('package')).toBe(false);
    });

    it('should return false for non-test operations', () => {
      handler.validatedInputs.skipTests = false;
      
      expect(handler.shouldProcessTests('validate')).toBe(false);
      expect(handler.shouldProcessTests('compile')).toBe(false);
    });
  });

  describe('executeMavenOperation', () => {
    it('should call correct Maven executor method', async () => {
      // Mock all executor methods
      handler.mavenExecutor.validate = jest.fn().mockResolvedValue({ success: true });
      handler.mavenExecutor.compile = jest.fn().mockResolvedValue({ success: true });
      handler.mavenExecutor.test = jest.fn().mockResolvedValue({ success: true });
      handler.mavenExecutor.package = jest.fn().mockResolvedValue({ success: true });
      handler.mavenExecutor.verify = jest.fn().mockResolvedValue({ success: true });
      handler.mavenExecutor.install = jest.fn().mockResolvedValue({ success: true });
      handler.mavenExecutor.deploy = jest.fn().mockResolvedValue({ success: true });

      const eventContext = { eventName: 'push' };

      // Test each operation
      await handler.executeMavenOperation('validate', eventContext);
      expect(handler.mavenExecutor.validate).toHaveBeenCalled();

      await handler.executeMavenOperation('compile', eventContext);
      expect(handler.mavenExecutor.compile).toHaveBeenCalled();

      await handler.executeMavenOperation('test', eventContext);
      expect(handler.mavenExecutor.test).toHaveBeenCalled();

      await handler.executeMavenOperation('package', eventContext);
      expect(handler.mavenExecutor.package).toHaveBeenCalled();

      await handler.executeMavenOperation('verify', eventContext);
      expect(handler.mavenExecutor.verify).toHaveBeenCalled();

      await handler.executeMavenOperation('install', eventContext);
      expect(handler.mavenExecutor.install).toHaveBeenCalled();

      await handler.executeMavenOperation('deploy', eventContext);
      expect(handler.mavenExecutor.deploy).toHaveBeenCalled();
    });

    it('should throw error for unsupported operation', async () => {
      const eventContext = { eventName: 'push' };
      
      await expect(handler.executeMavenOperation('unsupported', eventContext))
        .rejects.toThrow('Unsupported Maven operation: unsupported');
    });
  });
});