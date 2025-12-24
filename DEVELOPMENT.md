# Development Guide

## Project Structure

```
maven-build-action/
├── action.yml                          # Action metadata and inputs/outputs
├── package.json                        # Node.js dependencies and scripts
├── README.md                          # User documentation
├── LICENSE                            # MIT license
├── .gitignore                         # Git ignore patterns
├── .eslintrc.js                       # ESLint configuration
├── .prettierrc                        # Prettier configuration
├── jest.config.js                     # Jest test configuration
├── DEVELOPMENT.md                     # This file
├── Dockerfile                         # Docker container (if needed)
│
├── .github/
│   └── workflows/
│       └── ci.yml                     # CI/CD pipeline for the action
│
├── src/                               # Source code
│   ├── index.js                       # Main entry point
│   │
│   ├── validators/                    # Input validation (Security Layer)
│   │   └── input-validator.js         # Comprehensive input validation
│   │
│   ├── handlers/                      # Core business logic handlers
│   │   └── maven-handler.js           # Main Maven operations handler
│   │
│   ├── processors/                    # Event and data processors
│   │   ├── event-processor.js         # GitHub event processing
│   │   └── test-processor.js          # Test result processing
│   │
│   ├── executors/                     # Command executors
│   │   └── maven-executor.js          # Maven command execution
│   │
│   ├── scanners/                      # Security and quality scanners
│   │   └── security-scanner.js        # OWASP/Snyk security scanning
│   │
│   ├── managers/                      # Resource managers
│   │   ├── artifact-manager.js        # Build artifact management
│   │   └── cache-manager.js           # Maven dependency caching
│   │
│   └── utils/                         # Utility functions
│       └── output-manager.js          # Action output management
│
├── tests/                             # Test files
│   ├── validators/
│   │   └── input-validator.test.js    # Input validation tests
│   ├── handlers/
│   │   └── maven-handler.test.js      # Handler tests
│   └── processors/
│       └── event-processor.test.js    # Processor tests
│
└── dist/                              # Built action (generated)
    └── index.js                       # Compiled action bundle
```

## Architecture Overview

### **Architectural Viewpoint**
This custom GitHub Action follows a modular, event-driven architecture that separates concerns across different layers:

1. **Handler Layer**: Orchestrates the overall Maven build process
2. **Processor Layer**: Handles event processing and result parsing
3. **Executor Layer**: Manages actual Maven command execution
4. **Manager Layer**: Handles resources like artifacts and caching
5. **Scanner Layer**: Provides security and quality scanning capabilities

### **Design Options + Trade-offs**

**Option 1: Monolithic Action (Single File)**
- ✅ Simple deployment and distribution
- ❌ Hard to test, maintain, and extend
- ❌ Violates single responsibility principle

**Option 2: Modular Architecture (Current Choice)**
- ✅ Clear separation of concerns
- ✅ Easy to test individual components
- ✅ Extensible for new Maven operations
- ✅ Follows enterprise patterns from your banking platform
- ❌ More complex initial setup
- ❌ Requires build step to bundle

**Option 3: Composite Action (Multiple Actions)**
- ✅ Very modular
- ❌ Complex orchestration
- ❌ Multiple repositories to maintain

### **Recommendation**
The modular architecture aligns with your banking platform's structure and provides the best balance of maintainability, testability, and extensibility while handling the complexity of Maven's lifecycle phases.

## Key Components

### 1. Event Processor (`src/processors/event-processor.js`)
- Processes GitHub webhook events (push, PR, release, etc.)
- Determines deployment targets based on branch patterns
- Provides context for Maven operations

### 2. Maven Handler (`src/handlers/maven-handler.js`)
- Orchestrates the complete Maven build process
- Manages the execution flow based on event context
- Coordinates between different managers and processors

### 3. Maven Executor (`src/executors/maven-executor.js`)
- Executes actual Maven commands
- Handles Maven-specific configuration (settings, profiles, etc.)
- Provides consistent error handling and logging

### 4. Cache Manager (`src/managers/cache-manager.js`)
- Manages Maven dependency caching
- Generates cache keys based on pom.xml content
- Handles cache restoration and saving

### 5. Artifact Manager (`src/managers/artifact-manager.js`)
- Collects build artifacts (JARs, WARs, reports)
- Uploads artifacts to GitHub Actions
- Handles deployment to external repositories

### 6. Security Scanner (`src/scanners/security-scanner.js`)
- Integrates OWASP Dependency Check
- Supports Snyk vulnerability scanning
- Generates security reports

## Development Workflow

### Setup
```bash
# Install dependencies
npm install

# Run linter
npm run lint

# Run tests
npm test

# Build action
npm run build
```

### Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- maven-handler.test.js
```

### Building
```bash
# Build the action bundle
npm run build

# This creates dist/index.js with all dependencies bundled
```

### Local Testing
```bash
# Create a test Maven project
mkdir test-maven-project
cd test-maven-project

# Generate a simple Maven project
mvn archetype:generate \
  -DgroupId=com.example \
  -DartifactId=test-app \
  -DarchetypeArtifactId=maven-archetype-quickstart \
  -DinteractiveMode=false

# Test the action locally (requires act or similar tool)
act -j test
```

## Event-Driven Behavior

The action adapts its behavior based on GitHub events:

### Push Events
- **Main Branch**: Full build + production deployment prep
- **Develop Branch**: Full build + development deployment
- **Feature Branch**: Build + test only
- **Hotfix Branch**: Full build + staging deployment

### Pull Request Events
- Always runs tests and security scans
- Publishes test results as annotations
- Generates coverage reports

### Release Events
- Runs complete build suite
- Deploys to production repositories
- Creates release artifacts

## Extension Points

### Adding New Maven Operations
1. Add new method to `MavenExecutor`
2. Update `MavenActionHandler.executeMavenOperation()`
3. Add corresponding tests

### Adding New Security Scanners
1. Create new scanner in `src/scanners/`
2. Integrate with `SecurityScanner.scan()`
3. Update report generation

### Adding New Deployment Targets
1. Add new method to `ArtifactManager`
2. Update `deployArtifacts()` switch statement
3. Add configuration inputs to `action.yml`

## Performance Considerations

### Caching Strategy
- Maven dependencies cached by pom.xml content hash
- Multi-module project support
- Fallback cache keys for partial hits

### Parallel Execution
- Security scans run in parallel with artifact processing
- Test processing happens concurrently with other operations

### Resource Management
- Streaming for large files
- Cleanup of temporary artifacts
- Memory-efficient XML parsing

## Security Considerations

### Input Validation
- All inputs validated before use
- Path traversal protection
- Command injection prevention

### Secrets Management
- No secrets logged or exposed
- Secure handling of deployment credentials
- Environment variable isolation

### Dependency Security
- Regular dependency updates
- Vulnerability scanning of action dependencies
- Minimal dependency footprint

## Monitoring and Observability

### Logging
- Structured logging with context
- Debug mode support
- Performance timing

### Metrics
- Build duration tracking
- Cache hit/miss rates
- Test result statistics

### Error Handling
- Graceful degradation
- Detailed error messages
- Stack trace capture in debug mode

## Contributing Guidelines

1. **Follow Code Conventions**: Use ESLint and Prettier configurations
2. **Write Tests**: Maintain >80% code coverage
3. **Update Documentation**: Keep README and this guide current
4. **Security First**: Follow security best practices
5. **Performance**: Consider impact on build times

## Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create release branch
4. Run full test suite
5. Build and commit dist/
6. Create GitHub release with semantic versioning
7. Update marketplace listing

---

**Question for Deeper Architectural Thinking**: 

Given that this action will be used across multiple teams in your banking platform, how would you design a plugin architecture that allows teams to extend the action with custom Maven goals or deployment targets without modifying the core action code? Consider the trade-offs between flexibility, security, and maintainability in a regulated banking environment.