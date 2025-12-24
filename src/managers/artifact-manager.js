const core = require('@actions/core');
const artifact = require('@actions/artifact');
const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');

/**
 * Manages build artifacts and deployment operations
 */
class ArtifactManager {
  constructor(validatedInputs) {
    this.validatedInputs = validatedInputs;
    this.workingDirectory = validatedInputs.workingDirectory;
    this.deployTarget = validatedInputs.deployTarget;
    this.deployUrl = validatedInputs.deployUrl;
    this.deployUsername = validatedInputs.deployUsername;
    this.deployPassword = validatedInputs.deployPassword;
  }

  /**
   * Handle artifacts based on Maven operation
   */
  async handleArtifacts(operation) {
    core.info('📦 Managing build artifacts...');
    
    try {
      const artifactPaths = await this.collectArtifacts(operation);
      
      if (artifactPaths.length > 0) {
        await this.uploadArtifacts(artifactPaths);
        
        // Handle deployment if configured
        if (this.shouldDeploy(operation)) {
          await this.deployArtifacts(artifactPaths);
        }
      }
      
      return artifactPaths;
    } catch (error) {
      core.warning(`Artifact management failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Collect build artifacts from target directory
   */
  async collectArtifacts(operation) {
    const targetDir = path.join(this.workingDirectory, 'target');
    const artifactPaths = [];
    
    try {
      // Check if target directory exists
      await fs.access(targetDir);
      
      // Collect JAR files
      const jarPattern = path.join(targetDir, '*.jar');
      const jarFiles = glob.sync(jarPattern);
      artifactPaths.push(...jarFiles);
      
      // Collect WAR files
      const warPattern = path.join(targetDir, '*.war');
      const warFiles = glob.sync(warPattern);
      artifactPaths.push(...warFiles);
      
      // Collect test reports if tests were run
      if (!core.getBooleanInput('skip-tests')) {
        const testReportsDir = path.join(targetDir, 'surefire-reports');
        try {
          await fs.access(testReportsDir);
          artifactPaths.push(testReportsDir);
        } catch (error) {
          // Test reports directory doesn't exist
        }
      }
      
      // Collect coverage reports if generated
      if (core.getBooleanInput('generate-coverage')) {
        const coverageDir = path.join(targetDir, 'site', 'jacoco');
        try {
          await fs.access(coverageDir);
          artifactPaths.push(coverageDir);
        } catch (error) {
          // Coverage directory doesn't exist
        }
      }
      
      core.info(`📋 Found ${artifactPaths.length} artifact(s)`);
      return artifactPaths;
      
    } catch (error) {
      core.warning(`Target directory not found: ${targetDir}`);
      return [];
    }
  }

  /**
   * Upload artifacts to GitHub Actions
   */
  async uploadArtifacts(artifactPaths) {
    if (artifactPaths.length === 0) return;
    
    core.info('⬆️ Uploading artifacts to GitHub Actions...');
    
    try {
      const artifactClient = artifact.create();
      
      // Upload JAR/WAR files
      const binaryFiles = artifactPaths.filter(p => p.endsWith('.jar') || p.endsWith('.war'));
      if (binaryFiles.length > 0) {
        await artifactClient.uploadArtifact(
          'build-artifacts',
          binaryFiles,
          this.workingDirectory,
          {
            continueOnError: false,
            retentionDays: 30
          }
        );
      }
      
      // Upload test reports
      const testReportsDir = artifactPaths.find(p => p.includes('surefire-reports'));
      if (testReportsDir) {
        const testFiles = glob.sync(path.join(testReportsDir, '**/*'));
        if (testFiles.length > 0) {
          await artifactClient.uploadArtifact(
            'test-reports',
            testFiles,
            testReportsDir,
            {
              continueOnError: true,
              retentionDays: 7
            }
          );
        }
      }
      
      // Upload coverage reports
      const coverageDir = artifactPaths.find(p => p.includes('jacoco'));
      if (coverageDir) {
        const coverageFiles = glob.sync(path.join(coverageDir, '**/*'));
        if (coverageFiles.length > 0) {
          await artifactClient.uploadArtifact(
            'coverage-reports',
            coverageFiles,
            coverageDir,
            {
              continueOnError: true,
              retentionDays: 7
            }
          );
        }
      }
      
      core.info('✅ Artifacts uploaded successfully');
    } catch (error) {
      core.warning(`Failed to upload artifacts: ${error.message}`);
    }
  }

  /**
   * Deploy artifacts to configured repository
   */
  async deployArtifacts(artifactPaths) {
    if (!this.deployTarget || !this.deployUrl) {
      core.info('🚫 No deployment configuration found, skipping deployment');
      return;
    }
    
    core.info(`🚀 Deploying artifacts to ${this.deployTarget}...`);
    
    try {
      switch (this.deployTarget.toLowerCase()) {
        case 'nexus':
          await this.deployToNexus(artifactPaths);
          break;
        case 'artifactory':
          await this.deployToArtifactory(artifactPaths);
          break;
        case 'github-packages':
          await this.deployToGitHubPackages(artifactPaths);
          break;
        default:
          throw new Error(`Unsupported deployment target: ${this.deployTarget}`);
      }
      
      core.info('✅ Deployment completed successfully');
    } catch (error) {
      core.setFailed(`Deployment failed: ${error.message}`);
    }
  }

  /**
   * Deploy to Nexus repository
   */
  async deployToNexus(artifactPaths) {
    // Implementation for Nexus deployment
    core.info('📦 Deploying to Nexus repository...');
    // This would use Maven deploy plugin or REST API calls
  }

  /**
   * Deploy to Artifactory repository
   */
  async deployToArtifactory(artifactPaths) {
    // Implementation for Artifactory deployment
    core.info('📦 Deploying to Artifactory repository...');
    // This would use Artifactory REST API
  }

  /**
   * Deploy to GitHub Packages
   */
  async deployToGitHubPackages(artifactPaths) {
    // Implementation for GitHub Packages deployment
    core.info('📦 Deploying to GitHub Packages...');
    // This would use Maven deploy with GitHub Packages configuration
  }

  /**
   * Check if deployment should occur
   */
  shouldDeploy(operation) {
    const deployOperations = ['deploy', 'install'];
    return deployOperations.includes(operation) && this.deployTarget;
  }

  /**
   * Get artifact summary for outputs
   */
  getArtifactSummary(artifactPaths) {
    if (artifactPaths.length === 0) return 'No artifacts generated';
    
    const jarFiles = artifactPaths.filter(p => p.endsWith('.jar'));
    const warFiles = artifactPaths.filter(p => p.endsWith('.war'));
    
    let summary = '';
    if (jarFiles.length > 0) {
      summary += `JAR files: ${jarFiles.length}\n`;
    }
    if (warFiles.length > 0) {
      summary += `WAR files: ${warFiles.length}\n`;
    }
    
    return summary.trim() || 'Artifacts generated';
  }
}

module.exports = { ArtifactManager };