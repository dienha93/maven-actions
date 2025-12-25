const { OutputManager } = require('../../src/utils/output-manager');

// Mock dependencies
jest.mock('@actions/core');

const core = require('@actions/core');

describe('OutputManager', () => {
  let outputManager;

  beforeEach(() => {
    outputManager = new OutputManager();
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock core methods
    core.setOutput = jest.fn();
    core.info = jest.fn();
    core.debug = jest.fn();
    core.warning = jest.fn();
    core.summary = {
      addHeading: jest.fn().mockReturnThis(),
      addRaw: jest.fn().mockReturnThis(),
      addCodeBlock: jest.fn().mockReturnThis(),
      addTable: jest.fn().mockReturnThis(),
      write: jest.fn().mockResolvedValue()
    };
  });

  describe('setOutput', () => {
    it('should set output when value is provided', () => {
      // Arrange
      const name = 'test-output';
      const value = 'test-value';

      // Act
      outputManager.setOutput(name, value);

      // Assert
      expect(core.setOutput).toHaveBeenCalledWith(name, value);
      expect(core.debug).toHaveBeenCalledWith(`Output set: ${name} = ${value}`);
      expect(outputManager.outputs[name]).toBe(value);
    });

    it('should not set output when value is undefined', () => {
      // Arrange
      const name = 'test-output';
      const value = undefined;

      // Act
      outputManager.setOutput(name, value);

      // Assert
      expect(core.setOutput).not.toHaveBeenCalled();
      expect(outputManager.outputs[name]).toBeUndefined();
    });

    it('should not set output when value is null', () => {
      // Arrange
      const name = 'test-output';
      const value = null;

      // Act
      outputManager.setOutput(name, value);

      // Assert
      expect(core.setOutput).not.toHaveBeenCalled();
      expect(outputManager.outputs[name]).toBeUndefined();
    });

    it('should set output when value is empty string', () => {
      // Arrange
      const name = 'test-output';
      const value = '';

      // Act
      outputManager.setOutput(name, value);

      // Assert
      expect(core.setOutput).toHaveBeenCalledWith(name, value);
      expect(outputManager.outputs[name]).toBe(value);
    });

    it('should set output when value is zero', () => {
      // Arrange
      const name = 'test-output';
      const value = 0;

      // Act
      outputManager.setOutput(name, value);

      // Assert
      expect(core.setOutput).toHaveBeenCalledWith(name, value);
      expect(outputManager.outputs[name]).toBe(value);
    });
  });

  describe('setOutputs', () => {
    it('should set all outputs for successful build result', () => {
      // Arrange
      const result = {
        status: 'success',
        buildTime: 120,
        artifactPath: ['/path/to/artifact1.jar', '/path/to/artifact2.jar'],
        environment: {
          java: { version: '17', action: 'existing' },
          maven: { version: '3.9.5', action: 'installed' }
        },
        toString: () => 'Build completed successfully'
      };

      // Act
      outputManager.setOutputs(result);

      // Assert
      expect(core.setOutput).toHaveBeenCalledWith('status', 'success');
      expect(core.setOutput).toHaveBeenCalledWith('build-time', '120');
      expect(core.setOutput).toHaveBeenCalledWith('artifact-path', '/path/to/artifact1.jar,/path/to/artifact2.jar');
      expect(core.setOutput).toHaveBeenCalledWith('java-version', '17');
      expect(core.setOutput).toHaveBeenCalledWith('maven-version', '3.9.5');
      expect(core.info).toHaveBeenCalledWith('📋 Setting action outputs...');
    });

    it('should set outputs for failed build result with error', () => {
      // Arrange
      const result = {
        status: 'failure',
        buildTime: 45,
        error: 'Maven build failed with exit code 1',
        environment: {
          java: { version: '11', action: 'existing' },
          maven: { version: '3.8.6', action: 'existing' }
        },
        toString: () => 'Build failed'
      };

      // Act
      outputManager.setOutputs(result);

      // Assert
      expect(core.setOutput).toHaveBeenCalledWith('status', 'failure');
      expect(core.setOutput).toHaveBeenCalledWith('build-time', '45');
      expect(core.setOutput).toHaveBeenCalledWith('error-message', 'Maven build failed with exit code 1');
      expect(core.setOutput).toHaveBeenCalledWith('java-version', '11');
      expect(core.setOutput).toHaveBeenCalledWith('maven-version', '3.8.6');
    });

    it('should handle result with environment warnings', () => {
      // Arrange
      const result = {
        status: 'success',
        buildTime: 90,
        environment: {
          java: { 
            version: '17', 
            action: 'existing',
            warning: 'Using non-LTS Java version'
          },
          maven: { 
            version: '3.9.5', 
            action: 'installed',
            warning: 'Maven version is newer than recommended'
          }
        },
        toString: () => 'Build completed with warnings'
      };

      // Act
      outputManager.setOutputs(result);

      // Assert
      expect(core.setOutput).toHaveBeenCalledWith('environment-warnings', 
        'Java: Using non-LTS Java version; Maven: Maven version is newer than recommended');
    });

    it('should handle result with missing build time', () => {
      // Arrange
      const result = {
        status: 'success',
        environment: {
          java: { version: '17', action: 'existing' },
          maven: { version: '3.9.5', action: 'existing' }
        },
        toString: () => 'Build completed'
      };

      // Act
      outputManager.setOutputs(result);

      // Assert
      expect(core.setOutput).toHaveBeenCalledWith('build-time', '0');
    });

    it('should handle result with empty artifact path', () => {
      // Arrange
      const result = {
        status: 'success',
        buildTime: 60,
        artifactPath: [],
        environment: {
          java: { version: '17', action: 'existing' },
          maven: { version: '3.9.5', action: 'existing' }
        },
        toString: () => 'Build completed'
      };

      // Act
      outputManager.setOutputs(result);

      // Assert
      expect(core.setOutput).not.toHaveBeenCalledWith('artifact-path', expect.anything());
    });

    it('should handle result without environment information', () => {
      // Arrange
      const result = {
        status: 'success',
        buildTime: 30,
        toString: () => 'Build completed'
      };

      // Act
      outputManager.setOutputs(result);

      // Assert
      expect(core.setOutput).toHaveBeenCalledWith('status', 'success');
      expect(core.setOutput).toHaveBeenCalledWith('build-time', '30');
      expect(core.setOutput).not.toHaveBeenCalledWith('java-version', expect.anything());
      expect(core.setOutput).not.toHaveBeenCalledWith('maven-version', expect.anything());
    });
  });

  describe('createJobSummary', () => {
    it('should create job summary for successful build', async () => {
      // Arrange
      const result = {
        status: 'success',
        buildTime: 120,
        artifactPath: ['/path/to/artifact.jar'],
        environment: {
          java: { version: '17', action: 'existing' },
          maven: { version: '3.9.5', action: 'installed' }
        }
      };

      // Act
      await outputManager.createJobSummary(result);

      // Assert
      expect(core.summary.addHeading).toHaveBeenCalledWith('Maven Build Results', 1);
      expect(core.summary.addRaw).toHaveBeenCalledWith('✅ **Build Status:** SUCCESS\n');
      expect(core.summary.addRaw).toHaveBeenCalledWith('⏱️ **Build Time:** 120s\n\n');
      expect(core.summary.write).toHaveBeenCalled();
      expect(core.info).toHaveBeenCalledWith('✅ Job summary created');
    });

    it('should create job summary for failed build', async () => {
      // Arrange
      const result = {
        status: 'failure',
        buildTime: 45,
        error: 'Maven compilation failed',
        environment: {
          java: { version: '11', action: 'existing' },
          maven: { version: '3.8.6', action: 'existing' }
        }
      };

      // Act
      await outputManager.createJobSummary(result);

      // Assert
      expect(core.summary.addHeading).toHaveBeenCalledWith('Maven Build Results', 1);
      expect(core.summary.addRaw).toHaveBeenCalledWith('❌ **Build Status:** FAILURE\n');
      expect(core.summary.addHeading).toHaveBeenCalledWith('Error Details', 2);
      expect(core.summary.addCodeBlock).toHaveBeenCalledWith('Maven compilation failed', 'text');
    });

    it('should handle job summary creation failure', async () => {
      // Arrange
      const result = {
        status: 'success',
        buildTime: 60
      };
      
      const error = new Error('Summary creation failed');
      core.summary.write.mockRejectedValue(error);

      // Act
      await outputManager.createJobSummary(result);

      // Assert
      expect(core.warning).toHaveBeenCalledWith('Failed to create job summary: Summary creation failed');
    });
  });

  describe('addEnvironmentSection', () => {
    it('should add environment section with tool information', async () => {
      // Arrange
      const environment = {
        java: { version: '17', action: 'existing' },
        maven: { version: '3.9.5', action: 'installed' }
      };

      // Act
      await outputManager.addEnvironmentSection(environment);

      // Assert
      expect(core.summary.addHeading).toHaveBeenCalledWith('Environment', 2);
      expect(core.summary.addTable).toHaveBeenCalledWith([
        ['Tool', 'Version', 'Status', 'Notes'],
        ['Java', '17', '✅ Existing', 'OK'],
        ['Maven', '3.9.5', '📦 Installed', 'OK']
      ]);
    });

    it('should add environment section with warnings', async () => {
      // Arrange
      const environment = {
        java: { 
          version: '17', 
          action: 'warning',
          warning: 'Non-LTS version detected'
        },
        maven: { 
          version: '3.9.5', 
          action: 'installed',
          warning: 'Version mismatch'
        }
      };

      // Act
      await outputManager.addEnvironmentSection(environment);

      // Assert
      expect(core.summary.addTable).toHaveBeenCalledWith([
        ['Tool', 'Version', 'Status', 'Notes'],
        ['Java', '17', '⚠️ Warning', 'Non-LTS version detected'],
        ['Maven', '3.9.5', '📦 Installed', 'Version mismatch']
      ]);
    });
  });

  describe('getActionStatusEmoji', () => {
    it('should return correct emoji for existing action', () => {
      expect(outputManager.getActionStatusEmoji('existing')).toBe('✅ Existing');
    });

    it('should return correct emoji for installed action', () => {
      expect(outputManager.getActionStatusEmoji('installed')).toBe('📦 Installed');
    });

    it('should return correct emoji for warning action', () => {
      expect(outputManager.getActionStatusEmoji('warning')).toBe('⚠️ Warning');
    });

    it('should return unknown emoji for unrecognized action', () => {
      expect(outputManager.getActionStatusEmoji('unknown')).toBe('❓ Unknown');
      expect(outputManager.getActionStatusEmoji('')).toBe('❓ Unknown');
      expect(outputManager.getActionStatusEmoji(null)).toBe('❓ Unknown');
    });
  });

  describe('addArtifactsSection', () => {
    it('should add artifacts section with multiple artifacts', async () => {
      // Arrange
      const artifactPaths = [
        '/path/to/app-1.0.0.jar',
        '/path/to/app-1.0.0-sources.jar',
        '/path/to/app-1.0.0.war'
      ];

      // Act
      await outputManager.addArtifactsSection(artifactPaths);

      // Assert
      expect(core.summary.addHeading).toHaveBeenCalledWith('Build Artifacts', 2);
      expect(core.summary.addTable).toHaveBeenCalledWith([
        ['Artifact', 'Type'],
        ['app-1.0.0.jar', 'JAR'],
        ['app-1.0.0-sources.jar', 'JAR'],
        ['app-1.0.0.war', 'WAR']
      ]);
      expect(core.summary.addRaw).toHaveBeenCalledWith('\n📦 **Total Artifacts:** 3\n');
    });

    it('should handle single artifact', async () => {
      // Arrange
      const artifactPaths = ['/path/to/single-artifact.jar'];

      // Act
      await outputManager.addArtifactsSection(artifactPaths);

      // Assert
      expect(core.summary.addTable).toHaveBeenCalledWith([
        ['Artifact', 'Type'],
        ['single-artifact.jar', 'JAR']
      ]);
      expect(core.summary.addRaw).toHaveBeenCalledWith('\n📦 **Total Artifacts:** 1\n');
    });

    it('should handle empty artifacts array', async () => {
      // Arrange
      const artifactPaths = [];

      // Act
      await outputManager.addArtifactsSection(artifactPaths);

      // Assert
      expect(core.summary.addHeading).toHaveBeenCalledWith('Build Artifacts', 2);
      expect(core.summary.addTable).not.toHaveBeenCalled();
      expect(core.summary.addRaw).toHaveBeenCalledWith('\n📦 **Total Artifacts:** 0\n');
    });
  });

  describe('logOutputSummary', () => {
    it('should log all outputs to console', () => {
      // Arrange
      outputManager.outputs = {
        'status': 'success',
        'build-time': '120',
        'java-version': '17'
      };

      // Act
      outputManager.logOutputSummary();

      // Assert
      expect(core.info).toHaveBeenCalledWith('📋 Action Outputs Summary:');
      expect(core.info).toHaveBeenCalledWith('  status: success');
      expect(core.info).toHaveBeenCalledWith('  build-time: 120');
      expect(core.info).toHaveBeenCalledWith('  java-version: 17');
    });

    it('should handle empty outputs', () => {
      // Arrange
      outputManager.outputs = {};

      // Act
      outputManager.logOutputSummary();

      // Assert
      expect(core.info).toHaveBeenCalledWith('📋 Action Outputs Summary:');
      expect(core.info).toHaveBeenCalledTimes(1);
    });
  });

  describe('getOutputs', () => {
    it('should return copy of all outputs', () => {
      // Arrange
      outputManager.outputs = {
        'status': 'success',
        'build-time': '120'
      };

      // Act
      const outputs = outputManager.getOutputs();

      // Assert
      expect(outputs).toEqual({
        'status': 'success',
        'build-time': '120'
      });
      
      // Verify it's a copy, not the original object
      outputs['new-key'] = 'new-value';
      expect(outputManager.outputs['new-key']).toBeUndefined();
    });

    it('should return empty object when no outputs set', () => {
      // Act
      const outputs = outputManager.getOutputs();

      // Assert
      expect(outputs).toEqual({});
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete workflow for successful build with all features', async () => {
      // Arrange
      const result = {
        status: 'success',
        buildTime: 180,
        artifactPath: [
          '/target/app-1.0.0.jar',
          '/target/app-1.0.0-sources.jar'
        ],
        environment: {
          java: { 
            version: '17', 
            action: 'existing'
          },
          maven: { 
            version: '3.9.5', 
            action: 'installed',
            warning: 'Newer version available'
          }
        },
        toString: () => 'Build completed successfully'
      };

      // Act
      outputManager.setOutputs(result);
      await outputManager.createJobSummary(result);

      // Assert - Verify outputs were set
      expect(core.setOutput).toHaveBeenCalledWith('status', 'success');
      expect(core.setOutput).toHaveBeenCalledWith('build-time', '180');
      expect(core.setOutput).toHaveBeenCalledWith('artifact-path', '/target/app-1.0.0.jar,/target/app-1.0.0-sources.jar');
      expect(core.setOutput).toHaveBeenCalledWith('java-version', '17');
      expect(core.setOutput).toHaveBeenCalledWith('maven-version', '3.9.5');
      expect(core.setOutput).toHaveBeenCalledWith('environment-warnings', 'Maven: Newer version available');

      // Assert - Verify job summary was created
      expect(core.summary.addHeading).toHaveBeenCalledWith('Maven Build Results', 1);
      expect(core.summary.addRaw).toHaveBeenCalledWith('✅ **Build Status:** SUCCESS\n');
      expect(core.summary.write).toHaveBeenCalled();
    });

    it('should handle complete workflow for failed build with minimal information', async () => {
      // Arrange
      const result = {
        status: 'failure',
        error: 'Compilation error in Main.java',
        toString: () => 'Build failed'
      };

      // Act
      outputManager.setOutputs(result);
      await outputManager.createJobSummary(result);

      // Assert - Verify outputs were set
      expect(core.setOutput).toHaveBeenCalledWith('status', 'failure');
      expect(core.setOutput).toHaveBeenCalledWith('build-time', '0');
      expect(core.setOutput).toHaveBeenCalledWith('error-message', 'Compilation error in Main.java');

      // Assert - Verify job summary includes error
      expect(core.summary.addRaw).toHaveBeenCalledWith('❌ **Build Status:** FAILURE\n');
      expect(core.summary.addHeading).toHaveBeenCalledWith('Error Details', 2);
      expect(core.summary.addCodeBlock).toHaveBeenCalledWith('Compilation error in Main.java', 'text');
    });
  });
});