const core = require('@actions/core');
const path = require('path');

/**
 * Validates all action inputs to prevent security issues and ensure proper configuration
 */
class InputValidator {
  constructor() {
    this.validOperations = ['validate', 'compile', 'test', 'package', 'verify', 'install', 'deploy', 'clean'];
    this.validJavaVersions = ['8', '11', '17', '21'];
    this.validJavaDistributions = ['oracle', 'corretto'];
    this.maxPathLength = 260; // Windows path limit
    this.maxStringLength = 1000;
    this.sensitiveEnvVarPatterns = [
      /password/i, /secret/i, /token/i, /key/i, /credential/i, /auth/i
    ];
    this.validEnvVarNamePattern = /^[A-Z_][A-Z0-9_]*$/;
  }

  /**
   * Validate all action inputs
   */
  validateInputs() {
    core.info('🔍 Validating action inputs...');
    
    const validationErrors = [];
    
    try {
      // Validate required inputs
      this.validateOperation(validationErrors);
      
      // Validate optional inputs
      this.validateJavaVersion(validationErrors);
      this.validateJavaDistribution(validationErrors);
      this.validateMavenVersion(validationErrors);
      this.validateWorkingDirectory(validationErrors);
      this.validateSettingsFile(validationErrors);
      this.validateMavenArgs(validationErrors);
      this.validateBooleanInputs(validationErrors);
      
      // Check for validation errors
      if (validationErrors.length > 0) {
        const errorMessage = `Input validation failed:\n${validationErrors.join('\n')}`;
        throw new Error(errorMessage);
      }
      
      core.info('✅ All inputs validated successfully');
      return this.getValidatedInputs();
      
    } catch (error) {
      core.setFailed(`Input validation error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate Maven operation input
   */
  validateOperation(errors) {
    const operation = core.getInput('operation');
    
    if (!operation) {
      errors.push('- operation: Required input is missing');
      return;
    }
    
    // Check for whitespace-only input (Requirement 1.4)
    if (/^\s+$/.test(operation)) {
      errors.push(`- operation: Invalid value '${operation}'. Must be one of: ${this.validOperations.join(', ')}`);
      return;
    }
    
    // Check for comma-separated operations and reject them
    if (operation.includes(',')) {
      errors.push('- operation: Multiple operations not supported. Please specify only one operation.');
      return;
    }
    
    // Validate single operation
    const trimmedOperation = operation.trim().toLowerCase();
    
    if (!this.validOperations.includes(trimmedOperation)) {
      const suggestions = this.generateOperationSuggestions([trimmedOperation]);
      errors.push(`- operation: Invalid value '${operation}'. Must be one of: ${this.validOperations.join(', ')}${suggestions ? '. ' + suggestions : ''}`);
    }
  }

  /**
   * Generate helpful suggestions for invalid operations
   */
  generateOperationSuggestions(invalidOperations) {
    const suggestions = [];
    
    for (const invalid of invalidOperations) {
      // Simple fuzzy matching for common typos
      if (invalid.includes('build')) {
        suggestions.push('Did you mean "compile" or "package"?');
      } else if (invalid.includes('run')) {
        suggestions.push('Did you mean "test"?');
      } else if (invalid.includes('publish')) {
        suggestions.push('Did you mean "deploy"?');
      }
    }
    
    return suggestions.length > 0 ? suggestions.join(' ') : '';
  }

  /**
   * Validate Java version input
   */
  validateJavaVersion(errors) {
    const javaVersion = core.getInput('java-version');
    
    if (javaVersion && !this.validJavaVersions.includes(javaVersion)) {
      errors.push(`- java-version: Invalid value '${javaVersion}'. Must be one of: ${this.validJavaVersions.join(', ')}`);
    }
  }

  /**
   * Validate Java distribution input
   */
  validateJavaDistribution(errors) {
    const javaDistribution = core.getInput('java-distribution');
    
    if (javaDistribution && !this.validJavaDistributions.includes(javaDistribution)) {
      errors.push(`- java-distribution: Invalid value '${javaDistribution}'. Must be one of: ${this.validJavaDistributions.join(', ')}`);
    }
  }

  /**
   * Validate Maven version input
   */
  validateMavenVersion(errors) {
    const mavenVersion = core.getInput('maven-version');
    
    if (mavenVersion) {
      // Validate semantic version format (e.g., 3.9.5)
      const versionRegex = /^\d+\.\d+\.\d+$/;
      if (!versionRegex.test(mavenVersion)) {
        errors.push(`- maven-version: Invalid format '${mavenVersion}'. Must be in format X.Y.Z (e.g., 3.9.5)`);
      }
    }
  }

  /**
   * Validate working directory input
   */
  validateWorkingDirectory(errors) {
    const workingDir = core.getInput('working-directory');
    
    if (workingDir) {
      // Check path length
      if (workingDir.length > this.maxPathLength) {
        errors.push(`- working-directory: Path too long (${workingDir.length} > ${this.maxPathLength})`);
      }
      
      // Check for invalid characters
      if (this.containsInvalidPathChars(workingDir)) {
        errors.push('- working-directory: Contains invalid characters');
      }
    }
  }

  /**
   * Validate settings file input
   */
  validateSettingsFile(errors) {
    const settingsFile = core.getInput('settings-file');
    
    if (settingsFile) {
      // Check if it's a valid XML file path
      if (!settingsFile.endsWith('.xml')) {
        errors.push('- settings-file: Must be an XML file (*.xml)');
      }
      
      // Check path length
      if (settingsFile.length > this.maxPathLength) {
        errors.push(`- settings-file: Path too long (${settingsFile.length} > ${this.maxPathLength})`);
      }
    }
  }

  /**
   * Validate Maven arguments input
   */
  validateMavenArgs(errors) {
    const mavenArgs = core.getInput('maven-args');
    
    if (mavenArgs) {
      // Check string length
      if (mavenArgs.length > this.maxStringLength) {
        errors.push(`- maven-args: Too long (${mavenArgs.length} > ${this.maxStringLength})`);
      }
      
      // Check for dangerous arguments
      const dangerousArgs = [
        '--settings', '-s',  // Settings should use settings-file input
        '--file', '-f',      // POM file changes not allowed
        '--batch-mode', '-B', // We control batch mode
        '--quiet', '-q',     // We control logging
        '--debug', '-X'      // We control debug mode
      ];
      
      const argsList = mavenArgs.split(/\s+/);
      for (const arg of argsList) {
        if (dangerousArgs.includes(arg)) {
          errors.push(`- maven-args: Argument '${arg}' not allowed. Use dedicated inputs instead.`);
        }
      }
      
      // Check for command injection attempts
      if (this.containsCommandInjection(mavenArgs)) {
        errors.push('- maven-args: Potential command injection detected');
      }
    }
  }

  /**
   * Parse key=value pairs from string input
   */
  parseKeyValuePairs(input) {
    const envVars = {};
    const lines = input.split(/[\n;]/).map(line => line.trim()).filter(line => line.length > 0);
    
    for (const line of lines) {
      const equalIndex = line.indexOf('=');
      if (equalIndex === -1) {
        throw new Error(`Invalid format in line: "${line}". Expected key=value format.`);
      }
      
      const key = line.substring(0, equalIndex).trim();
      const value = line.substring(equalIndex + 1).trim();
      
      if (!key) {
        throw new Error(`Empty key in line: "${line}"`);
      }
      
      envVars[key] = value;
    }
    
    return envVars;
  }

  /**
   * Check if environment variable name suggests sensitive content
   */
  isSensitiveEnvironmentVariable(key) {
    return this.sensitiveEnvVarPatterns.some(pattern => pattern.test(key));
  }

  /**
   * Validate boolean inputs
   */
  validateBooleanInputs(errors) {
    const booleanInputs = [
      'cache-enabled'
    ];
    
    for (const inputName of booleanInputs) {
      const value = core.getInput(inputName);
      if (value && !['true', 'false'].includes(value.toLowerCase())) {
        errors.push(`- ${inputName}: Must be 'true' or 'false', got '${value}'`);
      }
    }
  }

  /**
   * Check for invalid path characters
   */
  containsInvalidPathChars(inputPath) {
    // Characters not allowed in file paths
    const invalidChars = /[<>:"|?*\x00-\x1f]/;
    return invalidChars.test(inputPath);
  }

  /**
   * Check for command injection attempts
   */
  containsCommandInjection(input) {
    const dangerousPatterns = [
      ';',     // Command separator
      '&&',    // Command chaining
      '||',    // Command chaining
      '|',     // Pipe
      '`',     // Command substitution
      '$(',    // Command substitution
      '${',    // Variable substitution
      '\n',    // Newline injection
      '\r'     // Carriage return injection
    ];
    
    return dangerousPatterns.some(pattern => input.includes(pattern));
  }

  /**
   * Get validated inputs as an object
   */
  getValidatedInputs() {
    
    // Parse environment variables if provided
    let environmentVariables = {};
    const envVarsInput = core.getInput('environment-variables');
    if (envVarsInput) {
      try {
        if (envVarsInput.trim().startsWith('{')) {
          environmentVariables = JSON.parse(envVarsInput);
        } else {
          environmentVariables = this.parseKeyValuePairs(envVarsInput);
        }
      } catch (error) {
        core.warning(`Failed to parse environment variables: ${error.message}`);
      }
    }
    
    return {
      // Original single operation for backward compatibility
      operation: core.getInput('operation'),
      
      // Environment variables
      environmentVariables: environmentVariables,
      
      // Existing inputs
      javaVersion: core.getInput('java-version') || '17',
      javaDistribution: core.getInput('java-distribution') || 'corretto',
      mavenVersion: core.getInput('maven-version') || '3.9.5',
      workingDirectory: core.getInput('working-directory') || '.',
      settingsFile: core.getInput('settings-file'),
      mavenArgs: core.getInput('maven-args'),
      cacheEnabled: core.getBooleanInput('cache-enabled'),
    };
  }

  /**
   * Sanitize input for logging (remove sensitive data)
   */
  sanitizeForLogging(inputs) {
    const sanitized = { ...inputs };
    
    // Sanitize environment variables
    if (sanitized.environmentVariables && typeof sanitized.environmentVariables === 'object') {
      const sanitizedEnvVars = {};
      for (const [key, value] of Object.entries(sanitized.environmentVariables)) {
        if (this.isSensitiveEnvironmentVariable(key)) {
          sanitizedEnvVars[key] = '***';
        } else {
          sanitizedEnvVars[key] = value;
        }
      }
      sanitized.environmentVariables = sanitizedEnvVars;
    }
    
    return sanitized;
  }
}

module.exports = { InputValidator };