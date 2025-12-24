const core = require('@actions/core');
const cache = require('@actions/cache');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs').promises;

/**
 * Manages Maven dependency caching for faster builds
 */
class CacheManager {
  constructor(validatedInputs) {
    this.validatedInputs = validatedInputs;
    this.workingDirectory = validatedInputs.workingDirectory;
    this.cacheEnabled = validatedInputs.cacheEnabled;
    this.m2Repository = path.join(require('os').homedir(), '.m2', 'repository');
  }

  /**
   * Restore Maven dependencies from cache
   */
  async restore() {
    if (!this.cacheEnabled) {
      core.info('📦 Cache disabled, skipping restore');
      return false;
    }

    core.info('📦 Restoring Maven dependencies from cache...');

    try {
      const cacheKey = await this.generateCacheKey();
      const restoreKeys = await this.generateRestoreKeys();

      core.info(`Cache key: ${cacheKey}`);
      core.info(`Restore keys: ${restoreKeys.join(', ')}`);

      const cacheHit = await cache.restoreCache(
        [this.m2Repository],
        cacheKey,
        restoreKeys
      );

      if (cacheHit) {
        core.info(`✅ Cache restored from key: ${cacheHit}`);
        return true;
      } else {
        core.info('📦 No cache found, will download dependencies');
        return false;
      }
    } catch (error) {
      core.warning(`Cache restore failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Save Maven dependencies to cache
   */
  async save() {
    if (!this.cacheEnabled) {
      core.info('📦 Cache disabled, skipping save');
      return false;
    }

    core.info('📦 Saving Maven dependencies to cache...');

    try {
      // Check if .m2 repository exists and has content
      const exists = await this.directoryExists(this.m2Repository);
      if (!exists) {
        core.warning('Maven repository directory not found, skipping cache save');
        return false;
      }

      const cacheKey = await this.generateCacheKey();
      
      // Only save if we have a new cache key (dependencies changed)
      const existingCacheKey = core.getState('cache-key');
      if (existingCacheKey === cacheKey) {
        core.info('📦 Dependencies unchanged, skipping cache save');
        return false;
      }

      await cache.saveCache([this.m2Repository], cacheKey);
      
      // Store the cache key for future reference
      core.saveState('cache-key', cacheKey);
      
      core.info(`✅ Cache saved with key: ${cacheKey}`);
      return true;
    } catch (error) {
      // Cache save failures are not critical, just log a warning
      core.warning(`Cache save failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Generate cache key based on pom.xml files
   */
  async generateCacheKey() {
    const pomFiles = await this.findPomFiles();
    const pomContents = [];

    for (const pomFile of pomFiles) {
      try {
        const content = await fs.readFile(pomFile, 'utf8');
        pomContents.push(content);
      } catch (error) {
        core.warning(`Could not read ${pomFile}: ${error.message}`);
      }
    }

    // Include OS and Java version in cache key for compatibility
    const os = process.platform;
    const javaVersion = this.validatedInputs.javaVersion;
    const mavenVersion = this.validatedInputs.mavenVersion;

    const hashInput = `${os}-java${javaVersion}-maven${mavenVersion}-${pomContents.join('')}`;
    const hash = crypto.createHash('sha256').update(hashInput).digest('hex');

    return `maven-deps-${hash}`;
  }

  /**
   * Generate restore keys for cache fallback
   */
  async generateRestoreKeys() {
    const os = process.platform;
    const javaVersion = this.validatedInputs.javaVersion;
    const mavenVersion = this.validatedInputs.mavenVersion;

    return [
      `maven-deps-${os}-java${javaVersion}-maven${mavenVersion}`,
      `maven-deps-${os}-java${javaVersion}`,
      `maven-deps-${os}`,
      'maven-deps'
    ];
  }

  /**
   * Find all pom.xml files in the project
   */
  async findPomFiles() {
    const pomFiles = [];
    
    // Always include root pom.xml
    const rootPom = path.join(this.workingDirectory, 'pom.xml');
    if (await this.fileExists(rootPom)) {
      pomFiles.push(rootPom);
    }

    // Look for module pom.xml files
    try {
      await this.findPomFilesRecursive(this.workingDirectory, pomFiles);
    } catch (error) {
      core.warning(`Error finding pom files: ${error.message}`);
    }

    return pomFiles;
  }

  /**
   * Recursively find pom.xml files
   */
  async findPomFilesRecursive(dir, pomFiles, depth = 0) {
    // Limit recursion depth to avoid infinite loops
    if (depth > 5) return;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'target') {
          const subDir = path.join(dir, entry.name);
          const subPom = path.join(subDir, 'pom.xml');
          
          if (await this.fileExists(subPom)) {
            pomFiles.push(subPom);
          }
          
          // Recurse into subdirectory
          await this.findPomFilesRecursive(subDir, pomFiles, depth + 1);
        }
      }
    } catch (error) {
      // Ignore errors reading directories
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if directory exists
   */
  async directoryExists(dirPath) {
    try {
      const stat = await fs.stat(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    if (!await this.directoryExists(this.m2Repository)) {
      return { size: 0, files: 0 };
    }

    try {
      let totalSize = 0;
      let fileCount = 0;

      const calculateSize = async (dir) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            await calculateSize(fullPath);
          } else {
            const stat = await fs.stat(fullPath);
            totalSize += stat.size;
            fileCount++;
          }
        }
      };

      await calculateSize(this.m2Repository);

      return {
        size: totalSize,
        files: fileCount,
        sizeFormatted: this.formatBytes(totalSize)
      };
    } catch (error) {
      core.warning(`Could not calculate cache stats: ${error.message}`);
      return { size: 0, files: 0, sizeFormatted: '0 B' };
    }
  }

  /**
   * Format bytes to human readable string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = { CacheManager };