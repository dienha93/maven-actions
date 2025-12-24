# Maven Build Action

A comprehensive GitHub Action for Maven projects that handles the complete build lifecycle including compilation, testing, security scanning, and deployment.

## Features

- 🔨 **Complete Maven Lifecycle**: Support for all Maven phases (validate, compile, test, package, verify, install, deploy)
- 🧪 **Test Processing**: Automatic test result parsing and reporting with JUnit integration
- 📊 **Code Coverage**: JaCoCo coverage report generation and analysis
- 🔒 **Security Scanning**: OWASP Dependency Check and Snyk vulnerability scanning
- 📦 **Artifact Management**: Automatic artifact collection and upload
- ⚡ **Smart Caching**: Maven dependency caching for faster builds
- 🚀 **Deployment Support**: Deploy to Nexus, Artifactory, or GitHub Packages
- 📋 **Rich Reporting**: Detailed job summaries and GitHub Actions annotations
- 🎯 **Event-Aware**: Intelligent behavior based on GitHub events (push, PR, release)

## Usage

### Basic Usage

```yaml
name: Maven CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Build with Maven
      uses: your-username/maven-build-action@v1
      with:
        operation: 'package'
        java-version: '17'
        maven-version: '3.9.5'
```

### Advanced Usage

```yaml
name: Maven CI/CD

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  release:
    types: [ published ]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Maven Build and Test
      uses: your-username/maven-build-action@v1
      with:
        operation: 'verify'
        java-version: '17'
        java-distribution: 'temurin'
        maven-version: '3.9.5'
        cache-enabled: true
        publish-test-results: true
        generate-coverage: true
        security-scan: true
        profiles: 'ci,coverage'
        maven-args: '-Dmaven.compiler.debug=true'
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

  deploy:
    needs: build-and-test
    runs-on: ubuntu-latest
    if: github.event_name == 'release'
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Deploy to Repository
      uses: your-username/maven-build-action@v1
      with:
        operation: 'deploy'
        deploy-target: 'nexus'
        deploy-url: ${{ secrets.NEXUS_URL }}
        deploy-username: ${{ secrets.NEXUS_USERNAME }}
        deploy-password: ${{ secrets.NEXUS_PASSWORD }}
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `maven-version` | Maven version to use | No | `3.9.5` |
| `java-version` | Java version to use | No | `17` |
| `java-distribution` | Java distribution | No | `temurin` |
| `operation` | Maven operation (validate, compile, test, package, verify, install, deploy) | Yes | `package` |
| `skip-tests` | Skip running tests | No | `false` |
| `working-directory` | Working directory for Maven commands | No | `.` |
| `settings-file` | Path to Maven settings.xml | No | `` |
| `profiles` | Maven profiles to activate (comma-separated) | No | `` |
| `maven-args` | Additional Maven arguments | No | `` |
| `cache-enabled` | Enable Maven dependency caching | No | `true` |
| `publish-test-results` | Publish test results | No | `true` |
| `generate-coverage` | Generate code coverage reports | No | `false` |
| `security-scan` | Run security vulnerability scan | No | `false` |
| `deploy-target` | Deployment target (nexus, artifactory, github-packages) | No | `` |
| `deploy-url` | Deployment repository URL | No | `` |
| `deploy-username` | Deployment username | No | `` |
| `deploy-password` | Deployment password | No | `` |

## Outputs

| Output | Description |
|--------|-------------|
| `build-status` | Build status (success, failure) |
| `test-results` | Test results summary (JSON) |
| `coverage-percentage` | Code coverage percentage |
| `artifact-path` | Path to generated artifacts |
| `security-issues` | Number of security issues found |
| `build-time` | Total build time in seconds |

## Event-Driven Behavior

The action automatically adapts its behavior based on GitHub events:

### Push Events
- **Main/Master Branch**: Runs full build with deployment preparation
- **Develop Branch**: Runs full build with development deployment
- **Feature Branches**: Runs build and tests only
- **Hotfix Branches**: Runs full build with staging deployment

### Pull Request Events
- Always runs tests and security scans
- Publishes test results as PR comments
- Blocks merge on test failures (if configured)

### Release Events
- Runs full build suite including security scans
- Deploys to production repositories
- Creates release artifacts

### Scheduled Events
- Runs comprehensive security scans
- Updates dependency caches
- Generates detailed reports

## Security Scanning

### OWASP Dependency Check
Automatically scans for known vulnerabilities in dependencies:

```yaml
- name: Build with Security Scan
  uses: your-username/maven-build-action@v1
  with:
    operation: 'verify'
    security-scan: true
```

### Snyk Integration
Requires `SNYK_TOKEN` environment variable:

```yaml
- name: Build with Snyk Scan
  uses: your-username/maven-build-action@v1
  with:
    operation: 'verify'
    security-scan: true
  env:
    SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

## Caching

Maven dependencies are automatically cached to improve build performance:

- Cache key includes OS, Java version, Maven version, and pom.xml content hashes
- Supports multi-module projects
- Automatic cache invalidation on dependency changes
- Fallback cache keys for partial cache hits

## Deployment

### Nexus Repository

```yaml
- name: Deploy to Nexus
  uses: your-username/maven-build-action@v1
  with:
    operation: 'deploy'
    deploy-target: 'nexus'
    deploy-url: 'https://nexus.example.com/repository/maven-releases/'
    deploy-username: ${{ secrets.NEXUS_USERNAME }}
    deploy-password: ${{ secrets.NEXUS_PASSWORD }}
```

### GitHub Packages

```yaml
- name: Deploy to GitHub Packages
  uses: your-username/maven-build-action@v1
  with:
    operation: 'deploy'
    deploy-target: 'github-packages'
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Multi-Module Projects

The action automatically detects and handles multi-module Maven projects:

- Scans for all pom.xml files in the project
- Includes all modules in cache key calculation
- Processes test results from all modules
- Collects artifacts from all modules

## Troubleshooting

### Common Issues

1. **Cache Miss on Every Build**
   - Ensure pom.xml files are committed to repository
   - Check that working-directory is set correctly

2. **Test Results Not Published**
   - Verify `publish-test-results` is set to `true`
   - Ensure tests are actually running (not skipped)

3. **Security Scan Failures**
   - Check SNYK_TOKEN is properly configured
   - Verify network access to security scanning services

4. **Deployment Failures**
   - Validate deployment credentials
   - Check repository URL and permissions
   - Ensure artifacts are generated before deployment

### Debug Mode

Enable debug logging by setting the `ACTIONS_STEP_DEBUG` secret to `true` in your repository.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](https://github.com/your-username/maven-build-action/wiki)
- 🐛 [Issue Tracker](https://github.com/your-username/maven-build-action/issues)
- 💬 [Discussions](https://github.com/your-username/maven-build-action/discussions)