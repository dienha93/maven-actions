# Maven Build Action Release Notes

## v1.1.0 - Temurin Distribution Support
*Released: December 26, 2024*

### ✨ New Features
- Added Eclipse Temurin distribution support (`java-distribution: 'temurin'`)
- Integrated with Adoptium API v3 for reliable JDK downloads
- Cross-platform support (Linux, macOS, Windows) with x64/ARM64 architectures

### 🔧 Improvements
- Enhanced Java vendor detection for Temurin installations
- Improved macOS JDK path resolution (`Contents/Home`)
- Better error handling for distribution downloads

### 📝 Usage
```yaml
- uses: dienha93/maven-actions@v1.1.0
  with:
    java-distribution: 'temurin'  # New option
    java-version: '17'
```

**Supported distributions:** `oracle`, `corretto`, `temurin`

---

## v1.0.0 - Initial Release

### 🎉 Initial Release

We're excited to announce the first stable release of Maven Build Action - a comprehensive GitHub Action designed to streamline Maven-based Java projects in your CI/CD pipelines.

## ✨ Key Features

### 🔨 Maven Operations Support
- **Complete Lifecycle Support**: Execute any Maven lifecycle operation (clean, compile, test, package, verify, install, deploy)
- **Flexible Configuration**: Customize Maven arguments and working directories
- **Settings File Support**: Use custom Maven settings.xml files for enterprise environments

### ☕ Java Environment Management
- **Multi-Version Support**: Java 8, 11, 17, 21 , 25 and other LTS versions
- **Distribution Choice**: Support for multiple Java distributions (Corretto, Temurin, Zulu, etc.)
- **Force Installation**: Option to force Java installation even if already present
- **Automatic Setup**: Seamless Java environment configuration

### 📦 Maven Version Management
- **Configurable Versions**: Choose from Maven 3.6.x to 3.9.x versions
- **Default Latest**: Ships with Maven 3.9.5 by default
- **Automatic Installation**: Downloads and configures Maven if not present

### ⚡ Smart Caching System
- **Dependency Caching**: Intelligent caching of Maven dependencies (.m2/repository)
- **Multi-Key Strategy**: Uses OS, Java version, Maven version, and pom.xml hashes
- **Fallback Support**: Multiple restore keys for partial cache hits
- **Configurable**: Can be disabled for specific use cases

### 🎯 Event-Aware Processing
- **GitHub Event Integration**: Adapts behavior based on push, pull_request, release events
- **Context-Aware Execution**: Provides rich context about the triggering event
- **Workflow Intelligence**: Understands different workflow scenarios

### 🛡️ Security & Validation
- **Input Validation**: Comprehensive validation of all user inputs
- **Security Scanning**: Built-in security vulnerability scanning capabilities
- **Safe Execution**: Sanitized logging to prevent credential exposure

### 📊 Rich Output & Reporting
- **Detailed Outputs**: Build status, artifact paths, build time, versions used
- **Job Summaries**: Rich GitHub Actions job summaries with build information
- **Test Processing**: Automatic test result parsing and reporting
- **Artifact Management**: Intelligent handling of build artifacts

## 🚀 Usage Examples

### Basic Usage
```yaml
- name: Build with Maven
  uses: dienha93/maven-actions@v1.0.0
  with:
    operation: 'package'
    java-version: '17'
    maven-version: '3.9.5'
```

### Advanced Configuration
```yaml
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
    maven-args: '-Dmaven.compiler.debug=true'
```

## 📋 Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `maven-version` | Maven version to use | No | `3.9.5` |
| `java-version` | Java version to use | No | `17` |
| `java-distribution` | Java distribution to use | No | `corretto` |
| `maven-args` | Additional Maven arguments | No | `` |
| `operation` | Maven operation to perform | Yes | `package` |
| `working-directory` | Working directory for Maven commands | No | `.` |
| `settings-file` | Path to Maven settings.xml file | No | `` |
| `cache-enabled` | Enable Maven dependency caching | No | `true` |
| `force-install` | Force to install Java version | No | `false` |

## 📤 Outputs

| Output | Description |
|--------|-------------|
| `status` | Build status (success, failure) |
| `artifact-path` | Path to generated artifacts |
| `build-time` | Total build time in seconds |
| `java-version` | Java version used in build |
| `maven-version` | Maven version used in build |

## 🏗️ Architecture Highlights

- **Modular Design**: Clean separation of concerns with dedicated managers for caching, artifacts, environment setup
- **Error Handling**: Comprehensive error handling with detailed logging and debugging support
- **Performance Optimized**: Smart caching strategies to minimize build times
- **Enterprise Ready**: Support for custom settings, private repositories, and corporate environments

## 🔧 Technical Requirements

- **Node.js Runtime**: Uses Node.js 24 for optimal performance
- **GitHub Actions**: Compatible with all GitHub-hosted and self-hosted runners
- **Operating Systems**: Supports Ubuntu, Windows, and macOS runners

## 🐛 Known Limitations

- **Single Operation**: Currently supports one Maven operation per action execution
- **Sequential Workflows**: For multiple operations, use multiple action steps

## 🛣️ Roadmap

Future releases will include:
- Multi-operation support in single execution
- Enhanced test reporting with coverage metrics
- Integration with popular code quality tools
- Support for Maven wrapper (mvnw)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with ❤️ using GitHub Actions Toolkit
- Inspired by the Maven and Java community
- Special thanks to all beta testers and contributors

---

**Full Changelog**: https://github.com/dienha93/maven-actions/commits/v1.0.0