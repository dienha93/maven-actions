const { EnvironmentManager } = require('../../src/managers/environment-manager');

// Mock dependencies
jest.mock('@actions/core');
jest.mock('@actions/exec');
jest.mock('@actions/tool-cache');

const core = require('@actions/core');
const exec = require('@actions/exec');
const tc = require('@actions/tool-cache');

describe('EnvironmentManager', () => {
  let manager;
  let validatedInputs;

  beforeEach(() => {
    validatedInputs = {
      javaVersion: '17',
      javaDistribution: 'temurin',
      mavenVersion: '3.9.5'
    };
    
    manager = new EnvironmentManager(validatedInputs);
    
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('setupEnvironment', () => {
    it('should setup both Java and Maven successfully', async () => {
      // Mock successful Java detection
      manager.getCurrentJavaVersion = jest.fn().mockResolvedValue({
        available: true,
        version: '17',
        vendor: 'Eclipse Temurin',
        javaHome: '/opt/java/17'
      });
      
      // Mock successful Maven detection
      manager.getCurrentMavenVersion = jest.fn().mockResolvedValue({
        available: true,
        version: '3.9.5',
        mavenHome: '/opt/maven'
      });
      
      // Mock verification
      manager.verifyEnvironment = jest.fn().mockResolvedValue({
        java: { available: true, version: '17' },
        maven: { available: true, version: '3.9.5' }
      });

      const result = await manager.setupEnvironment();

      expect(result.java.action).toBe('existing');
      expect(result.maven.action).toBe('existing');
      expect(manager.verifyEnvironment).toHaveBeenCalled();
    });

    it('should install Java when not available', async () => {
      // Mock Java not available
      manager.getCurrentJavaVersion = jest.fn().mockResolvedValue({
        available: false
      });
      
      // Mock Maven available
      manager.getCurrentMavenVersion = jest.fn().mockResolvedValue({
        available: true,
        version: '3.9.5'
      });
      
      // Mock Java installation
      manager.installJava = jest.fn().mockResolvedValue({
        action: 'installed',
        version: '17',
        distribution: 'temurin'
      });
      
      manager.verifyEnvironment = jest.fn().mockResolvedValue({});

      const result = await manager.setupEnvironment();

      expect(manager.installJava).toHaveBeenCalled();
      expect(result.java.action).toBe('installed');
    });

    it('should install Maven when not available', async () => {
      // Mock Java available
      manager.getCurrentJavaVersion = jest.fn().mockResolvedValue({
        available: true,
        version: '17'
      });
      
      // Mock Maven not available
      manager.getCurrentMavenVersion = jest.fn().mockResolvedValue({
        available: false
      });
      
      // Mock Maven installation
      manager.installMaven = jest.fn().mockResolvedValue({
        action: 'installed',
        version: '3.9.5'
      });
      
      manager.verifyEnvironment = jest.fn().mockResolvedValue({});

      const result = await manager.setupEnvironment();

      expect(manager.installMaven).toHaveBeenCalled();
      expect(result.maven.action).toBe('installed');
    });
  });

  describe('getCurrentJavaVersion', () => {
    it('should detect Java version correctly', async () => {
      const mockOutput = 'openjdk version "17.0.2" 2022-01-18\nOpenJDK Runtime Environment Temurin-17.0.2+8';
      
      exec.exec.mockImplementation((command, args, options) => {
        if (command === 'java' && args.includes('-version')) {
          options.listeners.stdout(mockOutput);
          return Promise.resolve(0);
        }
        return Promise.resolve(0);
      });

      const result = await manager.getCurrentJavaVersion();

      expect(result.available).toBe(true);
      expect(result.version).toBe('17');
      expect(result.vendor).toBe('openjdk');
    });

    it('should handle Java 8 version format', async () => {
      const mockOutput = 'openjdk version "1.8.0_332"';
      
      exec.exec.mockImplementation((command, args, options) => {
        if (command === 'java' && args.includes('-version')) {
          options.listeners.stdout(mockOutput);
          return Promise.resolve(0);
        }
        return Promise.resolve(0);
      });

      const result = await manager.getCurrentJavaVersion();

      expect(result.available).toBe(true);
      expect(result.version).toBe('8');
    });

    it('should return unavailable when Java not found', async () => {
      exec.exec.mockResolvedValue(1); // Non-zero exit code

      const result = await manager.getCurrentJavaVersion();

      expect(result.available).toBe(false);
    });
  });

  describe('getCurrentMavenVersion', () => {
    it('should detect Maven version correctly', async () => {
      const mockOutput = 'Apache Maven 3.9.5 (57804ffe001d7215b5e7bcb531cf83df38f93546)\nMaven home: /opt/maven';
      
      exec.exec.mockImplementation((command, args, options) => {
        if (command === 'mvn' && args.includes('-version')) {
          options.listeners.stdout(mockOutput);
          return Promise.resolve(0);
        }
        return Promise.resolve(0);
      });

      const result = await manager.getCurrentMavenVersion();

      expect(result.available).toBe(true);
      expect(result.version).toBe('3.9.5');
      expect(result.mavenHome).toBe('/opt/maven');
    });

    it('should return unavailable when Maven not found', async () => {
      exec.exec.mockResolvedValue(1); // Non-zero exit code

      const result = await manager.getCurrentMavenVersion();

      expect(result.available).toBe(false);
    });
  });

  describe('version compatibility checks', () => {
    describe('isJavaVersionCompatible', () => {
      it('should accept exact version match', () => {
        expect(manager.isJavaVersionCompatible('17')).toBe(true);
      });

      it('should accept backward compatible versions', () => {
        manager.requiredJavaVersion = '11';
        expect(manager.isJavaVersionCompatible('17')).toBe(true);
        expect(manager.isJavaVersionCompatible('21')).toBe(true);
      });

      it('should reject incompatible versions', () => {
        manager.requiredJavaVersion = '17';
        expect(manager.isJavaVersionCompatible('11')).toBe(false);
        expect(manager.isJavaVersionCompatible('8')).toBe(false);
      });
    });

    describe('isMavenVersionCompatible', () => {
      it('should accept exact version match', () => {
        expect(manager.isMavenVersionCompatible('3.9.5')).toBe(true);
      });

      it('should accept newer versions', () => {
        manager.requiredMavenVersion = '3.8.1';
        expect(manager.isMavenVersionCompatible('3.9.5')).toBe(true);
        expect(manager.isMavenVersionCompatible('3.8.6')).toBe(true);
      });

      it('should reject older versions', () => {
        manager.requiredMavenVersion = '3.9.5';
        expect(manager.isMavenVersionCompatible('3.8.1')).toBe(false);
        expect(manager.isMavenVersionCompatible('3.6.3')).toBe(false);
      });
    });
  });

  describe('extractMajorJavaVersion', () => {
    it('should extract version from Java 8 format', () => {
      expect(manager.extractMajorJavaVersion('1.8.0_332')).toBe('8');
    });

    it('should extract version from Java 11+ format', () => {
      expect(manager.extractMajorJavaVersion('17.0.2')).toBe('17');
      expect(manager.extractMajorJavaVersion('11.0.16')).toBe('11');
      expect(manager.extractMajorJavaVersion('21.0.1')).toBe('21');
    });
  });

  describe('installJava', () => {
    it('should validate supported Java version', async () => {
      validatedInputs.javaVersion = '99'; // Unsupported version
      manager = new EnvironmentManager(validatedInputs);

      await expect(manager.installJava()).rejects.toThrow('Unsupported Java version: 99');
    });

    it('should validate supported Java distribution', async () => {
      validatedInputs.javaDistribution = 'unsupported'; // Unsupported distribution
      manager = new EnvironmentManager(validatedInputs);

      await expect(manager.installJava()).rejects.toThrow('Unsupported Java distribution: unsupported');
    });

    it('should use cached Java if available', async () => {
      tc.find.mockReturnValue('/cached/java/path');
      tc.cacheDir = jest.fn();
      core.addPath = jest.fn();
      core.exportVariable = jest.fn();

      // Mock the downloadAndSetupJava method to simulate the actual installation process
      manager.downloadAndSetupJava = jest.fn().mockImplementation(async () => {
        // Simulate what the real method would do
        core.exportVariable('JAVA_HOME', '/cached/java/path');
        return '/cached/java/path';
      });

      const result = await manager.installJava();

      expect(result.action).toBe('installed');
      expect(result.version).toBe('17');
      expect(core.exportVariable).toHaveBeenCalledWith('JAVA_HOME', '/cached/java/path');
    });
  });

  describe('installMaven', () => {
    it('should validate supported Maven version', async () => {
      validatedInputs.mavenVersion = '2.0.0'; // Unsupported version
      manager = new EnvironmentManager(validatedInputs);

      await expect(manager.installMaven()).rejects.toThrow('Unsupported Maven version: 2.0.0');
    });

    it('should use cached Maven if available', async () => {
      tc.find.mockReturnValue('/cached/maven/path');
      tc.cacheDir = jest.fn();
      core.addPath = jest.fn();
      core.exportVariable = jest.fn();

      // Mock the downloadAndSetupMaven method to simulate the actual installation process
      manager.downloadAndSetupMaven = jest.fn().mockImplementation(async () => {
        // Simulate what the real method would do
        core.exportVariable('M2_HOME', '/cached/maven/path');
        return '/cached/maven/path';
      });

      const result = await manager.installMaven();

      expect(result.action).toBe('installed');
      expect(result.version).toBe('3.9.5');
      expect(core.exportVariable).toHaveBeenCalledWith('M2_HOME', '/cached/maven/path');
    });
  });

  describe('verifyEnvironment', () => {
    it('should verify both Java and Maven are available', async () => {
      manager.getCurrentJavaVersion = jest.fn().mockResolvedValue({
        available: true,
        version: '17',
        vendor: 'Eclipse Temurin'
      });
      
      manager.getCurrentMavenVersion = jest.fn().mockResolvedValue({
        available: true,
        version: '3.9.5'
      });

      const result = await manager.verifyEnvironment();

      expect(result.java.available).toBe(true);
      expect(result.maven.available).toBe(true);
      expect(core.info).toHaveBeenCalledWith('✅ Environment verified:');
    });

    it('should throw error if Java verification fails', async () => {
      manager.getCurrentJavaVersion = jest.fn().mockResolvedValue({
        available: false
      });

      await expect(manager.verifyEnvironment()).rejects.toThrow('Java verification failed');
    });

    it('should throw error if Maven verification fails', async () => {
      manager.getCurrentJavaVersion = jest.fn().mockResolvedValue({
        available: true,
        version: '17'
      });
      
      manager.getCurrentMavenVersion = jest.fn().mockResolvedValue({
        available: false
      });

      await expect(manager.verifyEnvironment()).rejects.toThrow('Maven verification failed');
    });
  });

  describe('getEnvironmentSummary', () => {
    it('should create proper environment summary', () => {
      const javaSetup = {
        action: 'existing',
        version: '17',
        warning: null
      };
      
      const mavenSetup = {
        action: 'warning',
        version: '3.8.1',
        warning: 'Version mismatch'
      };

      const summary = manager.getEnvironmentSummary(javaSetup, mavenSetup);

      expect(summary.java.version).toBe('17');
      expect(summary.java.action).toBe('existing');
      expect(summary.java.warning).toBe(null);
      
      expect(summary.maven.version).toBe('3.8.1');
      expect(summary.maven.action).toBe('warning');
      expect(summary.maven.warning).toBe('Version mismatch');
    });
  });
});