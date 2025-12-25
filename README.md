# Maven Build Action

A comprehensive GitHub Action for Maven projects that handles build operations with Maven lifecycle phases.

## Features

- 🔨 **Maven Operations**: Support for Maven lifecycle operations (clean, compile, test, package, verify, install, deploy)
- ☕ **Java Setup**: Automatic Java environment setup with configurable versions and distributions
- 📦 **Maven Setup**: Configurable Maven version installation
- ⚡ **Smart Caching**: Maven dependency caching for faster builds

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
      uses: dienha93/maven-actions@v1.0.0
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

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Maven Build and Test
      uses: dienha93/maven-actions@v1.0.0
      with:
        operation: 'verify'
        java-version: '17'
        java-distribution: 'corretto'
        maven-version: '3.9.5'
        working-directory: './my-project'
        settings-file: './.m2/settings.xml'
        cache-enabled: true
        force-install: false
        maven-args: '-Dmaven.compiler.debug=true -DskipITs=false'
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `maven-version` | Maven version to use | No | `3.9.5` |
| `java-version` | Java version to use | No | `17` |
| `java-distribution` | Java distribution to use | No | `corretto` |
| `maven-args` | Additional Maven arguments | No | `` |
| `operation` | Maven operation to perform (e.g., "clean", "compile", "test", "package", "verify", "install", "deploy") | Yes | `package` |
| `working-directory` | Working directory for Maven commands | No | `.` |
| `settings-file` | Path to Maven settings.xml file | No | `` |
| `cache-enabled` | Enable Maven dependency caching | No | `true` |
| `force-install` | Force to install Java version | No | `false` |

## Outputs

| Output | Description |
|--------|-------------|
| `status` | Build status (success, failure) |
| `artifact-path` | Path to generated artifacts |
| `build-time` | Total build time in seconds |
| `java-version` | Java version used in build |
| `maven-version` | Maven version used in build |

## Caching

Maven dependencies are automatically cached to improve build performance:

- Cache key includes OS, Java version, Maven version, and pom.xml content hashes
- Supports multi-module projects
- Automatic cache invalidation on dependency changes
- Can be disabled by setting `cache-enabled: false`


## Troubleshooting

### Common Issues

1. **Cache Miss on Every Build**
   - Ensure pom.xml files are committed to repository
   - Check that working-directory is set correctly

2. **Java Version Issues**
   - Use `force-install: true` to force Java installation
   - Verify the Java distribution is available for your version

3. **Maven Operation Failures**
   - Check Maven logs in the action output
   - Verify all required dependencies are available
   - Ensure proper Maven settings configuration

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

- 🐛 [Issue Tracker](https://github.com/dienha93/maven-actions/issues)
- 💬 [Discussions](https://github.com/dienha93/maven-actions/discussions)