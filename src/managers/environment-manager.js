const core = require('@actions/core');
const exec = require('@actions/exec');
const tc = require('@actions/tool-cache');
const path = require('path');
const fs = require('fs').promises;

/**
 * Manages Java and Maven installation and version verification
 */
class EnvironmentManager {
  constructor(validatedInputs) {
    this.validatedInputs = validatedInputs;
    this.requiredJavaVersion = validatedInputs.javaVersion;
    this.requiredJavaDistribution = validatedInputs.javaDistribution;
    this.requiredMavenVersion = validatedInputs.mavenVersion;
    
    // Supported versions (should match input-validator.js)
    this.supportedJavaVersions = ['8', '11', '17', '21'];
    this.supportedJavaDistributions = ['temurin', 'zulu', 'adopt', 'liberica', 'microsoft', 'corretto'];
    this.supportedMavenVersions = ['3.6.3', '3.8.1', '3.8.6', '3.9.0', '3.9.5', '3.9.6'];
  }

  /**
   * Setup complete Java and Maven environment
   */
  async setupEnvironment() {
    core.info('🔧 Setting up build environment...');
    
    try {
      // Check and setup Java
      const javaSetup = await this.setupJava();
      
      // Check and setup Maven
      const mavenSetup = await this.setupMaven();
      
      // Verify final setup
      await this.verifyEnvironment();
      
      return {
        java: javaSetup,
        maven: mavenSetup
      };
      
    } catch (error) {
      core.setFailed(`Environment setup failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Setup Java environment
   */
  async setupJava() {
    core.info('☕ Checking Java environment...');
    
    try {
      // Check if Java is already available
      const currentJava = await this.getCurrentJavaVersion();
      
      if (currentJava.available) {
        core.info(`📋 Current Java: ${currentJava.version} (${currentJava.vendor || 'unknown vendor'})`);
        
        // Check if current version matches required
        if (this.isJavaVersionCompatible(currentJava.version)) {
          core.info(`✅ Java ${currentJava.version} is compatible with required ${this.requiredJavaVersion}`);
          return {
            action: 'existing',
            version: currentJava.version,
            vendor: currentJava.vendor,
            path: currentJava.javaHome
          };
        } else {
          core.warning(`⚠️ Current Java ${currentJava.version} differs from required ${this.requiredJavaVersion}`);
          core.warning('Continuing with existing Java version. Consider updating if build issues occur.');
          return {
            action: 'warning',
            version: currentJava.version,
            vendor: currentJava.vendor,
            path: currentJava.javaHome,
            warning: `Version mismatch: current ${currentJava.version}, required ${this.requiredJavaVersion}`
          };
        }
      } else {
        core.info('📦 Java not found, installing...');
        return await this.installJava();
      }
      
    } catch (error) {
      core.error(`Java setup failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Setup Maven environment
   */
  async setupMaven() {
    core.info('🔨 Checking Maven environment...');
    
    try {
      // Check if Maven is already available
      const currentMaven = await this.getCurrentMavenVersion();
      
      if (currentMaven.available) {
        core.info(`📋 Current Maven: ${currentMaven.version}`);
        
        // Check if current version matches required
        if (this.isMavenVersionCompatible(currentMaven.version)) {
          core.info(`✅ Maven ${currentMaven.version} is compatible with required ${this.requiredMavenVersion}`);
          return {
            action: 'existing',
            version: currentMaven.version,
            path: currentMaven.mavenHome
          };
        } else {
          core.warning(`⚠️ Current Maven ${currentMaven.version} differs from required ${this.requiredMavenVersion}`);
          core.warning('Continuing with existing Maven version. Consider updating if build issues occur.');
          return {
            action: 'warning',
            version: currentMaven.version,
            path: currentMaven.mavenHome,
            warning: `Version mismatch: current ${currentMaven.version}, required ${this.requiredMavenVersion}`
          };
        }
      } else {
        core.info('📦 Maven not found, installing...');
        return await this.installMaven();
      }
      
    } catch (error) {
      core.error(`Maven setup failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get current Java version and details
   */
  async getCurrentJavaVersion() {
    try {
      let javaVersion = '';
      let javaVendor = '';
      let javaHome = '';
      
      // Try to get Java version
      const versionOptions = {
        ignoreReturnCode: true,
        listeners: {
          stdout: (data) => {
            javaVersion += data.toString();
          }
        }
      };
      
      const exitCode = await exec.exec('java', ['-version'], versionOptions);
      
      if (exitCode !== 0) {
        return { available: false };
      }
      
      // Parse Java version
      const versionMatch = javaVersion.match(/version "([^"]+)"/);
      if (!versionMatch) {
        return { available: false };
      }
      
      const fullVersion = versionMatch[1];
      const majorVersion = this.extractMajorJavaVersion(fullVersion);
      
      // Try to get vendor info
      const vendorMatch = javaVersion.match(/(OpenJDK|Oracle|Eclipse Temurin|Zulu|AdoptOpenJDK|Liberica|Microsoft|Amazon Corretto)/i);
      if (vendorMatch) {
        javaVendor = vendorMatch[1];
      }
      
      // Try to get JAVA_HOME
      try {
        javaHome = process.env.JAVA_HOME || '';
        if (!javaHome) {
          // Try to detect JAVA_HOME
          let javaHomeOutput = '';
          const homeOptions = {
            ignoreReturnCode: true,
            listeners: {
              stdout: (data) => {
                javaHomeOutput += data.toString();
              }
            }
          };
          
          await exec.exec('java', ['-XshowSettings:properties', '-version'], homeOptions);
          const homeMatch = javaHomeOutput.match(/java\.home = (.+)/);
          if (homeMatch) {
            javaHome = homeMatch[1].trim();
          }
        }
      } catch (error) {
        // JAVA_HOME detection failed, continue without it
      }
      
      return {
        available: true,
        version: majorVersion,
        fullVersion: fullVersion,
        vendor: javaVendor,
        javaHome: javaHome
      };
      
    } catch (error) {
      return { available: false };
    }
  }

  /**
   * Get current Maven version and details
   */
  async getCurrentMavenVersion() {
    try {
      let mavenOutput = '';
      
      const options = {
        ignoreReturnCode: true,
        listeners: {
          stdout: (data) => {
            mavenOutput += data.toString();
          }
        }
      };
      
      const exitCode = await exec.exec('mvn', ['-version'], options);
      
      if (exitCode !== 0) {
        return { available: false };
      }
      
      // Parse Maven version
      const versionMatch = mavenOutput.match(/Apache Maven ([^\s]+)/);
      if (!versionMatch) {
        return { available: false };
      }
      
      const version = versionMatch[1];
      
      // Try to get Maven home
      let mavenHome = '';
      const homeMatch = mavenOutput.match(/Maven home: (.+)/);
      if (homeMatch) {
        mavenHome = homeMatch[1].trim();
      }
      
      return {
        available: true,
        version: version,
        mavenHome: mavenHome
      };
      
    } catch (error) {
      return { available: false };
    }
  }

  /**
   * Install Java using GitHub Actions setup-java
   */
  async installJava() {
    core.info(`📦 Installing Java ${this.requiredJavaVersion} (${this.requiredJavaDistribution})...`);
    
    try {
      // Validate requested version is supported
      if (!this.supportedJavaVersions.includes(this.requiredJavaVersion)) {
        throw new Error(`Unsupported Java version: ${this.requiredJavaVersion}. Supported: ${this.supportedJavaVersions.join(', ')}`);
      }
      
      if (!this.supportedJavaDistributions.includes(this.requiredJavaDistribution)) {
        throw new Error(`Unsupported Java distribution: ${this.requiredJavaDistribution}. Supported: ${this.supportedJavaDistributions.join(', ')}`);
      }
      
      // Use actions/setup-java approach
      const javaPath = await this.downloadAndSetupJava();
      
      core.info(`✅ Java ${this.requiredJavaVersion} installed successfully`);
      
      return {
        action: 'installed',
        version: this.requiredJavaVersion,
        distribution: this.requiredJavaDistribution,
        path: javaPath
      };
      
    } catch (error) {
      throw new Error(`Java installation failed: ${error.message}`);
    }
  }

  /**
   * Install Maven
   */
  async installMaven() {
    core.info(`📦 Installing Maven ${this.requiredMavenVersion}...`);
    
    try {
      // Validate requested version is supported
      if (!this.supportedMavenVersions.includes(this.requiredMavenVersion)) {
        throw new Error(`Unsupported Maven version: ${this.requiredMavenVersion}. Supported: ${this.supportedMavenVersions.join(', ')}`);
      }
      
      const mavenPath = await this.downloadAndSetupMaven();
      
      core.info(`✅ Maven ${this.requiredMavenVersion} installed successfully`);
      
      return {
        action: 'installed',
        version: this.requiredMavenVersion,
        path: mavenPath
      };
      
    } catch (error) {
      throw new Error(`Maven installation failed: ${error.message}`);
    }
  }

  /**
   * Download and setup Java
   */
  async downloadAndSetupJava() {
    const toolName = 'Java_' + this.requiredJavaDistribution;
    const version = this.requiredJavaVersion;
    
    // Check if already cached
    let javaPath = tc.find(toolName, version);
    
    if (!javaPath) {
      core.info(`Downloading Java ${version} (${this.requiredJavaDistribution})...`);
      
      // Download URL mapping for different distributions
      const downloadUrl = this.getJavaDownloadUrl();
      
      const downloadPath = await tc.downloadTool(downloadUrl);
      const extractedPath = await tc.extractTar(downloadPath, undefined, 'xz');
      
      // Cache the tool
      javaPath = await tc.cacheDir(extractedPath, toolName, version);
    }
    
    // Add to PATH
    const binPath = path.join(javaPath, 'bin');
    core.addPath(binPath);
    
    // Set JAVA_HOME
    core.exportVariable('JAVA_HOME', javaPath);
    
    return javaPath;
  }

  /**
   * Download and setup Maven
   */
  async downloadAndSetupMaven() {
    const toolName = 'Maven';
    const version = this.requiredMavenVersion;
    
    // Check if already cached
    let mavenPath = tc.find(toolName, version);
    
    if (!mavenPath) {
      core.info(`Downloading Maven ${version}...`);
      
      const downloadUrl = `https://archive.apache.org/dist/maven/maven-3/${version}/binaries/apache-maven-${version}-bin.tar.gz`;
      
      const downloadPath = await tc.downloadTool(downloadUrl);
      const extractedPath = await tc.extractTar(downloadPath);
      
      // Maven extracts to apache-maven-{version} directory
      const mavenDir = path.join(extractedPath, `apache-maven-${version}`);
      
      // Cache the tool
      mavenPath = await tc.cacheDir(mavenDir, toolName, version);
    }
    
    // Add to PATH
    const binPath = path.join(mavenPath, 'bin');
    core.addPath(binPath);
    
    // Set M2_HOME
    core.exportVariable('M2_HOME', mavenPath);
    core.exportVariable('MAVEN_HOME', mavenPath);
    
    return mavenPath;
  }

  /**
   * Get Java download URL based on distribution and version
   */
  getJavaDownloadUrl() {
    const version = this.requiredJavaVersion;
    const distribution = this.requiredJavaDistribution;
    const platform = process.platform;
    const arch = process.arch === 'x64' ? 'x64' : process.arch;
    
    // This is a simplified example - in production, you'd have a comprehensive mapping
    const baseUrls = {
      temurin: `https://github.com/adoptium/temurin${version}-binaries/releases/download`,
      zulu: `https://cdn.azul.com/zulu/bin`,
      // Add other distributions as needed
    };
    
    if (distribution === 'temurin') {
      // Example for Temurin (Eclipse Adoptium)
      const platformMap = {
        linux: 'linux',
        darwin: 'mac',
        win32: 'windows'
      };
      
      const platformName = platformMap[platform] || 'linux';
      const archMap = {
        x64: 'x64',
        arm64: 'aarch64'
      };
      
      const archName = archMap[arch] || 'x64';
      
      // This would need to be more sophisticated in production
      return `${baseUrls.temurin}/jdk-${version}+36/OpenJDK${version}U-jdk_${archName}_${platformName}_hotspot_${version}_36.tar.gz`;
    }
    
    throw new Error(`Download URL not configured for ${distribution} ${version}`);
  }

  /**
   * Check if Java version is compatible
   */
  isJavaVersionCompatible(currentVersion) {
    // Allow exact match or compatible versions
    return currentVersion === this.requiredJavaVersion || 
           this.isJavaVersionBackwardCompatible(currentVersion, this.requiredJavaVersion);
  }

  /**
   * Check if Maven version is compatible
   */
  isMavenVersionCompatible(currentVersion) {
    // Allow exact match or compatible versions
    return currentVersion === this.requiredMavenVersion ||
           this.isMavenVersionBackwardCompatible(currentVersion, this.requiredMavenVersion);
  }

  /**
   * Check Java backward compatibility
   */
  isJavaVersionBackwardCompatible(current, required) {
    const currentMajor = parseInt(current);
    const requiredMajor = parseInt(required);
    
    // Higher versions are generally backward compatible
    return currentMajor >= requiredMajor;
  }

  /**
   * Check Maven backward compatibility
   */
  isMavenVersionBackwardCompatible(current, required) {
    // Simple semantic version comparison
    const currentParts = current.split('.').map(Number);
    const requiredParts = required.split('.').map(Number);
    
    for (let i = 0; i < Math.max(currentParts.length, requiredParts.length); i++) {
      const currentPart = currentParts[i] || 0;
      const requiredPart = requiredParts[i] || 0;
      
      if (currentPart > requiredPart) return true;
      if (currentPart < requiredPart) return false;
    }
    
    return true; // Equal versions
  }

  /**
   * Extract major Java version from full version string
   */
  extractMajorJavaVersion(fullVersion) {
    // Handle different Java version formats
    // Java 8: "1.8.0_XXX"
    // Java 11+: "11.0.X", "17.0.X", etc.
    
    if (fullVersion.startsWith('1.8')) {
      return '8';
    }
    
    const match = fullVersion.match(/^(\d+)/);
    return match ? match[1] : fullVersion;
  }

  /**
   * Verify final environment setup
   */
  async verifyEnvironment() {
    core.info('🔍 Verifying environment setup...');
    
    try {
      // Verify Java
      const javaCheck = await this.getCurrentJavaVersion();
      if (!javaCheck.available) {
        throw new Error('Java verification failed - not available after setup');
      }
      
      // Verify Maven
      const mavenCheck = await this.getCurrentMavenVersion();
      if (!mavenCheck.available) {
        throw new Error('Maven verification failed - not available after setup');
      }
      
      core.info(`✅ Environment verified:`);
      core.info(`   Java: ${javaCheck.version} (${javaCheck.vendor || 'unknown'})`);
      core.info(`   Maven: ${mavenCheck.version}`);
      
      return {
        java: javaCheck,
        maven: mavenCheck
      };
      
    } catch (error) {
      throw new Error(`Environment verification failed: ${error.message}`);
    }
  }

  /**
   * Get environment summary for outputs
   */
  getEnvironmentSummary(javaSetup, mavenSetup) {
    return {
      java: {
        version: javaSetup.version,
        action: javaSetup.action,
        warning: javaSetup.warning || null
      },
      maven: {
        version: mavenSetup.version,
        action: mavenSetup.action,
        warning: mavenSetup.warning || null
      }
    };
  }
}

module.exports = { EnvironmentManager };