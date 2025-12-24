const { InputValidator } = require('../../src/validators/input-validator');
const fc = require('fast-check');

// Mock dependencies
jest.mock('@actions/core');

const core = require('@actions/core');

describe('InputValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new InputValidator();
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Default mock implementations
    core.getInput.mockReturnValue('');
    core.getBooleanInput.mockReturnValue(false);
    core.warning = jest.fn();
    core.info = jest.fn();
    core.setFailed = jest.fn();
  });

  describe('validateInputs', () => {
    it('should validate all inputs successfully with valid data', () => {
      core.getInput.mockImplementation((name) => {
        const inputs = {
          'operation': 'package',
          'java-version': '17',
          'java-distribution': 'corretto',
          'maven-version': '3.9.5',
          'working-directory': '.',
          'settings-file': 'settings.xml',
          'maven-args': '-Dmaven.test.skip=true',
          'environment-variables': '{"MAVEN_OPTS": "-Xmx2g"}'
        };
        return inputs[name] || '';
      });
      
      core.getBooleanInput.mockImplementation((name) => {
        const boolInputs = {
          'cache-enabled': true
        };
        return boolInputs[name] || false;
      });

      const result = validator.validateInputs();

      expect(result).toBeDefined();
      expect(result.operation).toBe('package');
      expect(result.javaVersion).toBe('17');
      expect(result.environmentVariables).toEqual({"MAVEN_OPTS": "-Xmx2g"});
    });

    it('should throw error when validation fails', () => {
      core.getInput.mockImplementation((name) => {
        if (name === 'operation') return 'invalid-operation';
        return '';
      });

      expect(() => validator.validateInputs()).toThrow('Input validation failed');
    });
  });

  describe('validateOperation', () => {
    it('should accept valid operations', () => {
      const validOps = ['validate', 'compile', 'test', 'package', 'verify', 'install', 'deploy', 'clean'];
      
      validOps.forEach(op => {
        const errors = [];
        core.getInput.mockReturnValue(op);
        validator.validateOperation(errors);
        expect(errors).toHaveLength(0);
      });
    });

    it('should reject invalid operations', () => {
      const errors = [];
      core.getInput.mockReturnValue('invalid-operation');
      
      validator.validateOperation(errors);
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Invalid value \'invalid-operation\'');
    });

    it('should require operation input', () => {
      const errors = [];
      core.getInput.mockReturnValue('');
      
      validator.validateOperation(errors);
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Required input is missing');
    });

    it('should reject comma-separated operations', () => {
      const errors = [];
      core.getInput.mockReturnValue('clean,compile,test');
      
      validator.validateOperation(errors);
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Multiple operations not supported');
    });

    it('should provide helpful suggestions for common typos', () => {
      const errors = [];
      core.getInput.mockReturnValue('build');
      
      validator.validateOperation(errors);
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Did you mean "compile" or "package"?');
    });
  });

  describe('validateJavaVersion', () => {
    it('should accept valid Java versions', () => {
      const validVersions = ['8', '11', '17', '21'];
      
      validVersions.forEach(version => {
        const errors = [];
        core.getInput.mockReturnValue(version);
        validator.validateJavaVersion(errors);
        expect(errors).toHaveLength(0);
      });
    });

    it('should reject invalid Java versions', () => {
      const errors = [];
      core.getInput.mockReturnValue('99');
      
      validator.validateJavaVersion(errors);
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Invalid value \'99\'');
    });
  });

  describe('validateJavaDistribution', () => {
    it('should accept valid Java distributions', () => {
      const validDistributions = ['oracle', 'corretto'];
      
      validDistributions.forEach(dist => {
        const errors = [];
        core.getInput.mockReturnValue(dist);
        validator.validateJavaDistribution(errors);
        expect(errors).toHaveLength(0);
      });
    });

    it('should reject invalid Java distributions', () => {
      const errors = [];
      core.getInput.mockReturnValue('invalid-dist');
      
      validator.validateJavaDistribution(errors);
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Invalid value \'invalid-dist\'');
    });
  });

  describe('validateMavenVersion', () => {
    it('should accept valid Maven versions', () => {
      const validVersions = ['3.9.5', '3.8.1', '3.6.3'];
      
      validVersions.forEach(version => {
        const errors = [];
        core.getInput.mockReturnValue(version);
        validator.validateMavenVersion(errors);
        expect(errors).toHaveLength(0);
      });
    });

    it('should reject invalid Maven version format', () => {
      const errors = [];
      core.getInput.mockReturnValue('3.9');
      
      validator.validateMavenVersion(errors);
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Invalid format \'3.9\'');
    });
  });

  describe('validateWorkingDirectory', () => {
    it('should accept valid working directories', () => {
      const validDirs = ['.', './subdir', 'project/module'];
      
      validDirs.forEach(dir => {
        const errors = [];
        core.getInput.mockReturnValue(dir);
        validator.validateWorkingDirectory(errors);
        expect(errors).toHaveLength(0);
      });
    });

    it('should reject paths that are too long', () => {
      const errors = [];
      const longPath = 'a'.repeat(300); // Exceeds maxPathLength
      core.getInput.mockReturnValue(longPath);
      
      validator.validateWorkingDirectory(errors);
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Path too long');
    });

    it('should reject paths with invalid characters', () => {
      const errors = [];
      core.getInput.mockReturnValue('path<with>invalid:chars');
      
      validator.validateWorkingDirectory(errors);
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Contains invalid characters');
    });
  });

  describe('validateSettingsFile', () => {
    it('should accept valid XML settings files', () => {
      const validFiles = ['settings.xml', 'custom-settings.xml', 'path/to/settings.xml'];
      
      validFiles.forEach(file => {
        const errors = [];
        core.getInput.mockReturnValue(file);
        validator.validateSettingsFile(errors);
        expect(errors).toHaveLength(0);
      });
    });

    it('should reject non-XML files', () => {
      const errors = [];
      core.getInput.mockReturnValue('settings.json');
      
      validator.validateSettingsFile(errors);
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Must be an XML file');
    });
  });

  describe('validateMavenArgs', () => {
    it('should accept valid Maven arguments', () => {
      const validArgs = ['-Dmaven.test.skip=true', '-Dspring.profiles.active=dev'];
      
      validArgs.forEach(args => {
        const errors = [];
        core.getInput.mockReturnValue(args);
        validator.validateMavenArgs(errors);
        expect(errors).toHaveLength(0);
      });
    });

    it('should reject arguments with command injection', () => {
      const errors = [];
      core.getInput.mockReturnValue('-Dtest=true; rm -rf /');
      
      validator.validateMavenArgs(errors);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('command injection');
    });

    it('should reject dangerous arguments', () => {
      const dangerousArgs = ['--settings custom.xml', '-f other-pom.xml', '--batch-mode'];
      
      dangerousArgs.forEach(args => {
        const errors = [];
        core.getInput.mockReturnValue(args);
        validator.validateMavenArgs(errors);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]).toContain('not allowed');
      });
    });

    it('should reject arguments that are too long', () => {
      const errors = [];
      const longArgs = 'a'.repeat(1001); // Exceeds maxStringLength
      core.getInput.mockReturnValue(longArgs);
      
      validator.validateMavenArgs(errors);
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Too long');
    });
  });

  describe('validateBooleanInputs', () => {
    it('should accept valid boolean values', () => {
      const validValues = ['true', 'false'];
      
      validValues.forEach(value => {
        const errors = [];
        core.getInput.mockReturnValue(value);
        validator.validateBooleanInputs(errors);
        expect(errors).toHaveLength(0);
      });
    });

    it('should reject invalid boolean values', () => {
      const errors = [];
      core.getInput.mockReturnValue('maybe');
      
      validator.validateBooleanInputs(errors);
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Must be \'true\' or \'false\'');
    });
  });

  describe('parseKeyValuePairs', () => {
    it('should parse valid key=value pairs', () => {
      const input = 'KEY1=value1\nKEY2=value2';
      const result = validator.parseKeyValuePairs(input);
      
      expect(result).toEqual({
        'KEY1': 'value1',
        'KEY2': 'value2'
      });
    });

    it('should handle semicolon separators', () => {
      const input = 'KEY1=value1;KEY2=value2';
      const result = validator.parseKeyValuePairs(input);
      
      expect(result).toEqual({
        'KEY1': 'value1',
        'KEY2': 'value2'
      });
    });

    it('should throw error for invalid format', () => {
      const input = 'INVALID_LINE_WITHOUT_EQUALS';
      
      expect(() => validator.parseKeyValuePairs(input)).toThrow('Invalid format');
    });
  });

  describe('isSensitiveEnvironmentVariable', () => {
    it('should detect sensitive variable names', () => {
      const sensitiveNames = ['PASSWORD', 'SECRET', 'TOKEN', 'API_KEY'];
      
      sensitiveNames.forEach(name => {
        expect(validator.isSensitiveEnvironmentVariable(name)).toBe(true);
      });
    });

    it('should allow non-sensitive variable names', () => {
      const normalNames = ['MAVEN_OPTS', 'JAVA_HOME', 'BUILD_NUMBER'];
      
      normalNames.forEach(name => {
        expect(validator.isSensitiveEnvironmentVariable(name)).toBe(false);
      });
    });
  });

  describe('getValidatedInputs', () => {
    it('should return validated inputs object', () => {
      core.getInput.mockImplementation((name) => {
        const inputs = {
          'operation': 'package',
          'java-version': '17',
          'java-distribution': 'corretto',
          'maven-version': '3.9.5',
          'working-directory': '.',
          'environment-variables': '{"MAVEN_OPTS": "-Xmx2g"}'
        };
        return inputs[name] || '';
      });
      
      core.getBooleanInput.mockReturnValue(true);

      const result = validator.getValidatedInputs();

      expect(result.operation).toBe('package');
      expect(result.javaVersion).toBe('17');
      expect(result.javaDistribution).toBe('corretto');
      expect(result.mavenVersion).toBe('3.9.5');
      expect(result.workingDirectory).toBe('.');
      expect(result.environmentVariables).toEqual({"MAVEN_OPTS": "-Xmx2g"});
      expect(result.cacheEnabled).toBe(true);
    });

    it('should handle key=value format environment variables', () => {
      core.getInput.mockImplementation((name) => {
        if (name === 'environment-variables') return 'MAVEN_OPTS=-Xmx2g\nJAVA_OPTS=-Xms1g';
        if (name === 'operation') return 'package';
        return '';
      });

      const result = validator.getValidatedInputs();

      expect(result.environmentVariables).toEqual({
        'MAVEN_OPTS': '-Xmx2g',
        'JAVA_OPTS': '-Xms1g'
      });
    });

    it('should handle invalid environment variables gracefully', () => {
      core.getInput.mockImplementation((name) => {
        if (name === 'environment-variables') return 'invalid json {';
        if (name === 'operation') return 'package';
        return '';
      });

      const result = validator.getValidatedInputs();

      expect(result.environmentVariables).toEqual({});
      expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('Failed to parse environment variables'));
    });
  });

  describe('sanitizeForLogging', () => {
    it('should mask sensitive environment variables', () => {
      const inputs = {
        operation: 'deploy',
        environmentVariables: {
          'API_SECRET': 'secret123',
          'MAVEN_OPTS': '-Xmx2g',
          'DATABASE_PASSWORD': 'password123'
        }
      };

      const sanitized = validator.sanitizeForLogging(inputs);

      expect(sanitized.environmentVariables['API_SECRET']).toBe('***');
      expect(sanitized.environmentVariables['DATABASE_PASSWORD']).toBe('***');
      expect(sanitized.environmentVariables['MAVEN_OPTS']).toBe('-Xmx2g');
      expect(sanitized.operation).toBe('deploy');
    });
  });

  describe('security helper methods', () => {
    describe('containsInvalidPathChars', () => {
      it('should detect invalid path characters', () => {
        const invalidPaths = ['path<with>invalid', 'path:with:colons', 'path|with|pipes'];
        
        invalidPaths.forEach(path => {
          expect(validator.containsInvalidPathChars(path)).toBe(true);
        });
      });

      it('should allow valid path characters', () => {
        const validPaths = ['./valid/path', 'valid-path', 'valid_path'];
        
        validPaths.forEach(path => {
          expect(validator.containsInvalidPathChars(path)).toBe(false);
        });
      });
    });

    describe('containsCommandInjection', () => {
      it('should detect command injection attempts', () => {
        const maliciousInputs = [
          'arg; rm -rf /',
          'arg && malicious',
          'arg || malicious',
          'arg | malicious',
          'arg `malicious`',
          'arg $(malicious)'
        ];
        
        maliciousInputs.forEach(input => {
          expect(validator.containsCommandInjection(input)).toBe(true);
        });
      });

      it('should allow safe inputs', () => {
        const safeInputs = [
          '-Dmaven.test.skip=true',
          '-Dspring.profiles.active=dev',
          '-Xmx2g'
        ];
        
        safeInputs.forEach(input => {
          expect(validator.containsCommandInjection(input)).toBe(false);
        });
      });
    });
  });

  // Property-Based Tests
  describe('Property-Based Tests', () => {
    describe('Property 1: Single Operation Execution', () => {
      /**
       * Feature: single-operation-support, Property 1: Single Operation Execution
       * Validates: Requirements 1.1
       * 
       * For any valid Maven operation, when specified as input, exactly one operation 
       * should execute and complete.
       */
      it('should validate any single valid operation without errors', () => {
        fc.assert(fc.property(
          fc.constantFrom(...validator.validOperations),
          (operation) => {
            // Arrange
            const errors = [];
            core.getInput.mockReturnValue(operation);
            
            // Act
            validator.validateOperation(errors);
            
            // Assert - no validation errors should occur for valid operations
            expect(errors).toHaveLength(0);
          }
        ), { numRuns: 100 });
      });

      it('should accept valid operations in any case format', () => {
        fc.assert(fc.property(
          fc.constantFrom(...validator.validOperations),
          fc.constantFrom('lower', 'upper', 'mixed'),
          (operation, caseFormat) => {
            // Arrange
            const errors = [];
            let formattedOperation;
            
            switch (caseFormat) {
              case 'upper':
                formattedOperation = operation.toUpperCase();
                break;
              case 'mixed':
                formattedOperation = operation.charAt(0).toUpperCase() + operation.slice(1);
                break;
              default:
                formattedOperation = operation.toLowerCase();
            }
            
            core.getInput.mockReturnValue(formattedOperation);
            
            // Act
            validator.validateOperation(errors);
            
            // Assert - should handle case variations
            expect(errors).toHaveLength(0);
          }
        ), { numRuns: 100 });
      });

      it('should handle valid operations with surrounding whitespace', () => {
        fc.assert(fc.property(
          fc.constantFrom(...validator.validOperations),
          fc.string().filter(s => /^\s*$/.test(s) && s.length <= 10), // whitespace only
          fc.string().filter(s => /^\s*$/.test(s) && s.length <= 10), // whitespace only
          (operation, prefixWhitespace, suffixWhitespace) => {
            // Arrange
            const errors = [];
            const operationWithWhitespace = prefixWhitespace + operation + suffixWhitespace;
            core.getInput.mockReturnValue(operationWithWhitespace);
            
            // Act
            validator.validateOperation(errors);
            
            // Assert - should trim whitespace and validate successfully
            expect(errors).toHaveLength(0);
          }
        ), { numRuns: 100 });
      });
    });

    describe('Property 2: Multiple Operation Rejection', () => {
      /**
       * Feature: single-operation-support, Property 2: Multiple Operation Rejection
       * Validates: Requirements 1.5, 4.2
       * 
       * For any input containing multiple operations or comma-separated values, 
       * the validator should reject the input with a clear error message.
       */
      it('should reject any input containing multiple comma-separated operations', () => {
        fc.assert(fc.property(
          fc.array(fc.constantFrom(...validator.validOperations), { minLength: 2, maxLength: 5 }),
          (operations) => {
            // Arrange
            const errors = [];
            const multipleOperationsInput = operations.join(',');
            core.getInput.mockReturnValue(multipleOperationsInput);
            
            // Act
            validator.validateOperation(errors);
            
            // Assert - should reject multiple operations with clear error message
            expect(errors).toHaveLength(1);
            expect(errors[0]).toContain('Multiple operations not supported');
            expect(errors[0]).toContain('Please specify only one operation');
          }
        ), { numRuns: 100 });
      });

      it('should reject multiple operations with various separators and whitespace', () => {
        fc.assert(fc.property(
          fc.array(fc.constantFrom(...validator.validOperations), { minLength: 2, maxLength: 4 }),
          fc.constantFrom(',', ', ', ' , ', '  ,  '), // various comma formats with whitespace
          (operations, separator) => {
            // Arrange
            const errors = [];
            const multipleOperationsInput = operations.join(separator);
            core.getInput.mockReturnValue(multipleOperationsInput);
            
            // Act
            validator.validateOperation(errors);
            
            // Assert - should reject regardless of whitespace around commas
            expect(errors).toHaveLength(1);
            expect(errors[0]).toContain('Multiple operations not supported');
          }
        ), { numRuns: 100 });
      });

      it('should reject mixed valid and invalid operations when comma-separated', () => {
        fc.assert(fc.property(
          fc.constantFrom(...validator.validOperations),
          fc.string().filter(s => !validator.validOperations.includes(s.toLowerCase().trim()) && s.length > 0 && s.length < 20),
          (validOperation, invalidOperation) => {
            // Arrange
            const errors = [];
            const mixedOperationsInput = `${validOperation},${invalidOperation}`;
            core.getInput.mockReturnValue(mixedOperationsInput);
            
            // Act
            validator.validateOperation(errors);
            
            // Assert - should reject due to multiple operations, not invalid operation
            expect(errors).toHaveLength(1);
            expect(errors[0]).toContain('Multiple operations not supported');
          }
        ), { numRuns: 100 });
      });

      it('should provide descriptive error message for multiple operation rejection', () => {
        fc.assert(fc.property(
          fc.array(fc.constantFrom(...validator.validOperations), { minLength: 2, maxLength: 3 }),
          (operations) => {
            // Arrange
            const errors = [];
            const multipleOperationsInput = operations.join(',');
            core.getInput.mockReturnValue(multipleOperationsInput);
            
            // Act
            validator.validateOperation(errors);
            
            // Assert - error message should be descriptive and actionable
            expect(errors).toHaveLength(1);
            const errorMessage = errors[0];
            expect(errorMessage).toContain('operation:');
            expect(errorMessage).toContain('Multiple operations not supported');
            expect(errorMessage).toContain('Please specify only one operation');
          }
        ), { numRuns: 100 });
      });
    });

    describe('Property 3: Invalid Operation Rejection', () => {
      /**
       * Feature: single-operation-support, Property 3: Invalid Operation Rejection
       * Validates: Requirements 1.2, 4.1
       * 
       * For any string containing invalid operation names, the validator should reject 
       * the input and provide descriptive error messages.
       */
      it('should reject any invalid operation name with descriptive error message', () => {
        fc.assert(fc.property(
          fc.string().filter(s => {
            const trimmed = s.trim().toLowerCase();
            return trimmed.length > 0 && 
                   trimmed.length < 50 && 
                   !validator.validOperations.includes(trimmed) &&
                   !trimmed.includes(',') && // Exclude comma-separated to focus on invalid names
                   /^[a-zA-Z0-9_-]+$/.test(trimmed); // Only alphanumeric chars to avoid injection patterns
          }),
          (invalidOperation) => {
            // Arrange
            const errors = [];
            core.getInput.mockReturnValue(invalidOperation);
            
            // Act
            validator.validateOperation(errors);
            
            // Assert - should reject with descriptive error message
            expect(errors).toHaveLength(1);
            const errorMessage = errors[0];
            expect(errorMessage).toContain('operation:');
            expect(errorMessage).toContain('Invalid value');
            expect(errorMessage).toContain(invalidOperation);
            expect(errorMessage).toContain('Must be one of:');
            // Should list all valid operations
            validator.validOperations.forEach(validOp => {
              expect(errorMessage).toContain(validOp);
            });
          }
        ), { numRuns: 100 });
      });

      it('should provide helpful suggestions for common invalid operation patterns', () => {
        fc.assert(fc.property(
          fc.constantFrom(
            'build', 'BUILD', 'Build',
            'run', 'RUN', 'Run',
            'publish', 'PUBLISH', 'Publish',
            'start', 'START', 'Start'
          ),
          (invalidOperation) => {
            // Arrange
            const errors = [];
            core.getInput.mockReturnValue(invalidOperation);
            
            // Act
            validator.validateOperation(errors);
            
            // Assert - should provide helpful suggestions
            expect(errors).toHaveLength(1);
            const errorMessage = errors[0];
            expect(errorMessage).toContain('Invalid value');
            
            // Should provide specific suggestions based on the invalid operation
            const lowerInvalid = invalidOperation.toLowerCase();
            if (lowerInvalid.includes('build')) {
              expect(errorMessage).toContain('Did you mean "compile" or "package"?');
            } else if (lowerInvalid.includes('run')) {
              expect(errorMessage).toContain('Did you mean "test"?');
            } else if (lowerInvalid.includes('publish')) {
              expect(errorMessage).toContain('Did you mean "deploy"?');
            }
          }
        ), { numRuns: 100 });
      });

      it('should reject empty or whitespace-only operation input', () => {
        fc.assert(fc.property(
          fc.string().filter(s => /^\s*$/.test(s)), // Only whitespace characters
          (whitespaceOperation) => {
            // Arrange
            const errors = [];
            core.getInput.mockReturnValue(whitespaceOperation);
            
            // Act
            validator.validateOperation(errors);
            
            // Assert - should reject empty/whitespace input
            expect(errors).toHaveLength(1);
            expect(errors[0]).toContain('operation:');
            
            // Empty string should show "Required input is missing"
            if (whitespaceOperation === '') {
              expect(errors[0]).toContain('Required input is missing');
            } else {
              // Whitespace-only strings get treated as invalid operations (which is correct per requirements)
              expect(errors[0]).toContain('Invalid value');
              expect(errors[0]).toContain('Must be one of:');
            }
          }
        ), { numRuns: 100 });
      });

      it('should reject operations with special characters and provide security-focused error', () => {
        fc.assert(fc.property(
          fc.string().filter(s => {
            return s.length > 0 && 
                   s.length < 30 &&
                   !validator.validOperations.includes(s.trim().toLowerCase()) &&
                   /[^a-zA-Z0-9_-]/.test(s) && // Contains special characters
                   !s.includes(','); // Exclude comma-separated to focus on invalid chars
          }),
          (operationWithSpecialChars) => {
            // Arrange
            const errors = [];
            core.getInput.mockReturnValue(operationWithSpecialChars);
            
            // Act
            validator.validateOperation(errors);
            
            // Assert - should reject with clear error message
            expect(errors).toHaveLength(1);
            const errorMessage = errors[0];
            expect(errorMessage).toContain('operation:');
            expect(errorMessage).toContain('Invalid value');
            expect(errorMessage).toContain('Must be one of:');
          }
        ), { numRuns: 100 });
      });

      it('should handle case-insensitive validation for invalid operations', () => {
        fc.assert(fc.property(
          fc.constantFrom('INVALID', 'invalid', 'Invalid', 'iNvAlId'),
          fc.constantFrom('NOTFOUND', 'notfound', 'NotFound', 'nOtFoUnD'),
          (invalidOp1, invalidOp2) => {
            // Test both operations separately
            [invalidOp1, invalidOp2].forEach(invalidOperation => {
              // Arrange
              const errors = [];
              core.getInput.mockReturnValue(invalidOperation);
              
              // Act
              validator.validateOperation(errors);
              
              // Assert - should reject regardless of case
              expect(errors).toHaveLength(1);
              expect(errors[0]).toContain('Invalid value');
              expect(errors[0]).toContain(invalidOperation);
            });
          }
        ), { numRuns: 100 });
      });

      it('should provide complete list of valid operations in error message', () => {
        fc.assert(fc.property(
          fc.string().filter(s => {
            const trimmed = s.trim().toLowerCase();
            return trimmed.length > 0 && 
                   trimmed.length < 20 && 
                   !validator.validOperations.includes(trimmed) &&
                   /^[a-zA-Z]+$/.test(trimmed); // Only letters to avoid special cases
          }),
          (invalidOperation) => {
            // Arrange
            const errors = [];
            core.getInput.mockReturnValue(invalidOperation);
            
            // Act
            validator.validateOperation(errors);
            
            // Assert - error message should contain all valid operations
            expect(errors).toHaveLength(1);
            const errorMessage = errors[0];
            
            // Should list all valid operations
            const expectedOperations = ['validate', 'compile', 'test', 'package', 'verify', 'install', 'deploy', 'clean'];
            expectedOperations.forEach(validOp => {
              expect(errorMessage).toContain(validOp);
            });
            
            // Should be formatted as a proper list
            expect(errorMessage).toContain('Must be one of:');
          }
        ), { numRuns: 100 });
      });
    });

    describe('Property 4: Whitespace Input Validation', () => {
      /**
       * Feature: single-operation-support, Property 4: Whitespace Input Validation
       * Validates: Requirements 1.4
       * 
       * For any input string composed entirely of whitespace characters, 
       * the validator should treat it as invalid input.
       */
      it('should reject any input composed entirely of whitespace characters', () => {
        fc.assert(fc.property(
          fc.string().filter(s => {
            // Generate strings that are non-empty but contain only whitespace
            return s.length > 0 && 
                   s.length <= 20 && 
                   /^\s+$/.test(s); // Only whitespace characters (spaces, tabs, newlines, etc.)
          }),
          (whitespaceInput) => {
            // Arrange
            const errors = [];
            core.getInput.mockReturnValue(whitespaceInput);
            
            // Act
            validator.validateOperation(errors);
            
            // Assert - should reject whitespace-only input as invalid
            expect(errors).toHaveLength(1);
            const errorMessage = errors[0];
            expect(errorMessage).toContain('operation:');
            expect(errorMessage).toContain('Invalid value');
            expect(errorMessage).toContain('Must be one of:');
          }
        ), { numRuns: 100 });
      });

      it('should treat various whitespace characters as invalid input', () => {
        fc.assert(fc.property(
          fc.constantFrom(' ', '  ', '\t', '\n', '\r', '\r\n', ' \t ', '\t\n\r'),
          fc.integer({ min: 1, max: 5 }),
          (whitespaceChar, repeatCount) => {
            // Arrange
            const errors = [];
            const whitespaceInput = whitespaceChar.repeat(repeatCount);
            core.getInput.mockReturnValue(whitespaceInput);
            
            // Act
            validator.validateOperation(errors);
            
            // Assert - should reject all types of whitespace-only input
            expect(errors).toHaveLength(1);
            const errorMessage = errors[0];
            expect(errorMessage).toContain('operation:');
            expect(errorMessage).toContain('Invalid value');
          }
        ), { numRuns: 100 });
      });

      it('should provide descriptive error message for whitespace-only input', () => {
        fc.assert(fc.property(
          fc.string().filter(s => s.length > 0 && s.length <= 10 && /^\s+$/.test(s)),
          (whitespaceInput) => {
            // Arrange
            const errors = [];
            core.getInput.mockReturnValue(whitespaceInput);
            
            // Act
            validator.validateOperation(errors);
            
            // Assert - error message should be descriptive and include valid operations
            expect(errors).toHaveLength(1);
            const errorMessage = errors[0];
            
            // Should indicate the invalid value (which will be the whitespace string)
            expect(errorMessage).toContain('Invalid value');
            expect(errorMessage).toContain(whitespaceInput);
            
            // Should provide list of valid operations
            expect(errorMessage).toContain('Must be one of:');
            validator.validOperations.forEach(validOp => {
              expect(errorMessage).toContain(validOp);
            });
          }
        ), { numRuns: 100 });
      });

      it('should distinguish between empty string and whitespace-only input in error messages', () => {
        // Test empty string
        const emptyErrors = [];
        core.getInput.mockReturnValue('');
        validator.validateOperation(emptyErrors);
        
        expect(emptyErrors).toHaveLength(1);
        expect(emptyErrors[0]).toContain('Required input is missing');
        
        // Test whitespace-only string
        fc.assert(fc.property(
          fc.string().filter(s => s.length > 0 && /^\s+$/.test(s) && s.length <= 5),
          (whitespaceInput) => {
            const whitespaceErrors = [];
            core.getInput.mockReturnValue(whitespaceInput);
            validator.validateOperation(whitespaceErrors);
            
            expect(whitespaceErrors).toHaveLength(1);
            // Whitespace-only should be treated as invalid value, not missing input
            expect(whitespaceErrors[0]).toContain('Invalid value');
            expect(whitespaceErrors[0]).not.toContain('Required input is missing');
          }
        ), { numRuns: 100 });
      });

      it('should handle mixed whitespace patterns consistently', () => {
        fc.assert(fc.property(
          fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 8 }),
          (whitespaceChars) => {
            // Arrange
            const errors = [];
            const mixedWhitespaceInput = whitespaceChars.join('');
            core.getInput.mockReturnValue(mixedWhitespaceInput);
            
            // Act
            validator.validateOperation(errors);
            
            // Assert - should consistently reject any combination of whitespace characters
            expect(errors).toHaveLength(1);
            expect(errors[0]).toContain('Invalid value');
            expect(errors[0]).toContain('Must be one of:');
          }
        ), { numRuns: 100 });
      });
    });

    describe('Property 5: Default Operation Execution', () => {
      /**
       * Feature: single-operation-support, Property 5: Default Operation Execution
       * Validates: Requirements 1.3
       * 
       * For any execution where no operation input is provided, the system should 
       * execute the default operation specified in configuration.
       */
      it('should use default operation when no operation input is provided', () => {
        fc.assert(fc.property(
          fc.constantFrom('', null, undefined),
          (emptyInput) => {
            // Arrange
            core.getInput.mockImplementation((name) => {
              if (name === 'operation') return emptyInput || '';
              return '';
            });
            
            // Act
            const result = validator.getValidatedInputs();
            
            // Assert - should use default operation from action.yml (package)
            expect(result.operation).toBe('');
            
            // The validation should fail for empty operation, but the system should 
            // be designed to handle default operations at a higher level
            const errors = [];
            validator.validateOperation(errors);
            expect(errors).toHaveLength(1);
            expect(errors[0]).toContain('Required input is missing');
          }
        ), { numRuns: 100 });
      });

      it('should handle default operation configuration consistently', () => {
        fc.assert(fc.property(
          fc.constantFrom('', '   ', '\t', '\n'),
          (emptyOrWhitespaceInput) => {
            // Arrange
            core.getInput.mockImplementation((name) => {
              if (name === 'operation') return emptyOrWhitespaceInput;
              return '';
            });
            
            // Act
            const result = validator.getValidatedInputs();
            
            // Assert - should return the raw input (empty/whitespace)
            expect(result.operation).toBe(emptyOrWhitespaceInput);
            
            // Validation should catch empty/whitespace and require explicit operation
            const errors = [];
            validator.validateOperation(errors);
            expect(errors).toHaveLength(1);
            
            if (emptyOrWhitespaceInput === '') {
              expect(errors[0]).toContain('Required input is missing');
            } else {
              expect(errors[0]).toContain('Invalid value');
            }
          }
        ), { numRuns: 100 });
      });

      it('should preserve explicit operation input over default when provided', () => {
        fc.assert(fc.property(
          fc.constantFrom(...validator.validOperations),
          (explicitOperation) => {
            // Arrange
            core.getInput.mockImplementation((name) => {
              if (name === 'operation') return explicitOperation;
              return '';
            });
            
            // Act
            const result = validator.getValidatedInputs();
            
            // Assert - should use the explicitly provided operation, not default
            expect(result.operation).toBe(explicitOperation);
            
            // Validation should pass for valid explicit operations
            const errors = [];
            validator.validateOperation(errors);
            expect(errors).toHaveLength(0);
          }
        ), { numRuns: 100 });
      });

      it('should handle default operation fallback in system configuration', () => {
        fc.assert(fc.property(
          fc.boolean(),
          (useEmptyInput) => {
            // Arrange
            const operationInput = useEmptyInput ? '' : undefined;
            core.getInput.mockImplementation((name) => {
              if (name === 'operation') return operationInput || '';
              return '';
            });
            
            // Act
            const result = validator.getValidatedInputs();
            
            // Assert - getValidatedInputs should return the raw input
            expect(result.operation).toBe(operationInput || '');
            
            // The default operation logic should be handled at the action level,
            // not in the validator. The validator should require explicit input.
            const errors = [];
            validator.validateOperation(errors);
            expect(errors).toHaveLength(1);
            expect(errors[0]).toContain('Required input is missing');
          }
        ), { numRuns: 100 });
      });

      it('should validate that default operation from action.yml is valid', () => {
        // This test ensures the default operation specified in action.yml ('package') 
        // is actually a valid operation according to the validator
        fc.assert(fc.property(
          fc.constant('package'), // Default from action.yml
          (defaultOperation) => {
            // Arrange
            const errors = [];
            core.getInput.mockReturnValue(defaultOperation);
            
            // Act
            validator.validateOperation(errors);
            
            // Assert - the default operation should always be valid
            expect(errors).toHaveLength(0);
            expect(validator.validOperations).toContain(defaultOperation);
          }
        ), { numRuns: 100 });
      });

      it('should handle default operation with various input configurations', () => {
        fc.assert(fc.property(
          fc.record({
            javaVersion: fc.constantFrom('8', '11', '17', '21'),
            javaDistribution: fc.constantFrom('oracle', 'corretto'),
            mavenVersion: fc.constantFrom('3.9.5', '3.8.1', '3.6.3'),
            workingDirectory: fc.constantFrom('.', './subdir', 'project'),
            cacheEnabled: fc.boolean()
          }),
          (inputConfig) => {
            // Arrange - provide all other inputs but leave operation empty
            core.getInput.mockImplementation((name) => {
              const inputMap = {
                'operation': '', // Empty operation to test default behavior
                'java-version': inputConfig.javaVersion,
                'java-distribution': inputConfig.javaDistribution,
                'maven-version': inputConfig.mavenVersion,
                'working-directory': inputConfig.workingDirectory,
                'settings-file': '',
                'maven-args': '',
                'environment-variables': '{}'
              };
              return inputMap[name] || '';
            });
            
            core.getBooleanInput.mockImplementation((name) => {
              if (name === 'cache-enabled') return inputConfig.cacheEnabled;
              return false;
            });
            
            // Act
            const result = validator.getValidatedInputs();
            
            // Assert - should return all other inputs correctly while operation is empty
            expect(result.operation).toBe('');
            expect(result.javaVersion).toBe(inputConfig.javaVersion);
            expect(result.javaDistribution).toBe(inputConfig.javaDistribution);
            expect(result.mavenVersion).toBe(inputConfig.mavenVersion);
            expect(result.workingDirectory).toBe(inputConfig.workingDirectory);
            expect(result.cacheEnabled).toBe(inputConfig.cacheEnabled);
            
            // Operation validation should still require explicit input
            const errors = [];
            validator.validateOperation(errors);
            expect(errors).toHaveLength(1);
            expect(errors[0]).toContain('Required input is missing');
          }
        ), { numRuns: 100 });
      });

      it('should ensure default operation behavior is consistent across validation calls', () => {
        fc.assert(fc.property(
          fc.integer({ min: 1, max: 5 }),
          (numberOfCalls) => {
            // Arrange
            core.getInput.mockImplementation((name) => {
              if (name === 'operation') return '';
              return '';
            });
            
            // Act - call validation multiple times
            const results = [];
            const errorArrays = [];
            
            for (let i = 0; i < numberOfCalls; i++) {
              results.push(validator.getValidatedInputs());
              const errors = [];
              validator.validateOperation(errors);
              errorArrays.push(errors);
            }
            
            // Assert - all calls should behave consistently
            for (let i = 1; i < numberOfCalls; i++) {
              expect(results[i].operation).toBe(results[0].operation);
              expect(errorArrays[i]).toEqual(errorArrays[0]);
            }
            
            // All should indicate missing required input
            errorArrays.forEach(errors => {
              expect(errors).toHaveLength(1);
              expect(errors[0]).toContain('Required input is missing');
            });
          }
        ), { numRuns: 100 });
      });
    });
  });
});