# showall - Project Analysis Tool

A simple and powerful tool for analyzing and collecting Git repository information and project files. Built with Bun, it generates suitable outputs for AI tool analysis.

## 🎯 Quick Reference Card

```bash
# Most common commands:
showall all              # Full analysis (git + files)
showall git              # Just git info
showall file             # Just code files
showall clean            # Clean up outputs
showall -t . -o reports  # Specify target/output
showall -v               # Verbose mode
```

## ✨ Features

- Git Repository Analysis - Complete Git information including commits, branches, tags, and changes
- Code File Collection - Gather all project files with syntax highlighting and directory structure
- Smart Filtering - Automatically skips binary files, build artifacts, and common ignore patterns
- Multiple Output Formats - Generates well-structured logs for easy AI processing
- Cleanup Utility - Remove generated output files with a single command
- Verbose & Quiet Modes - Control output verbosity for different use cases

## 📦 Installation

### Prerequisites

- Bun runtime (v1.0.0 or higher)
- Git (for repository analysis)

### Step-by-Step Installation

- 1.Create tools directory (preferably in your home directory):

```bash
mkdir -p ~/.tools
```

- 2.Add configuration to your shell profile (`.bashrc`, `.zshrc` or `.bash_profile`)

```bash
export DEV_TOOLS="${HOME}/.tools"

for file in $DEV_TOOLS/*/.bashrc; do
    # echo "import ${file}";
    source "${file}"
done
unset file
```

- 3.Clone the repository:

```bash
# Clone repository
cd $DEV_TOOLS
git clone https://github.com/asmanp2012/showall.git
```

- 4.Reload your shell configuration:

```bash
source ~/.bashrc  # or ~/.zshrc, etc.
```

- 5.Verify installation:

```bash
showall --version
```

## 🚀 Usage

### Basic Commands

```bash
# Collect Git information from current directory
showall git

# Collect project files from specific directory
showall file /path/to/project

# Run both collectors
showall all

# Clean up generated output files
showall clean

# Show help
showall help
```

### Options

| Option | Description |
| -------- | ------------- |
| `-f, --file` | Run file collector only |
| `-g, --git` | Run git collector only |
| `-c, --clean` | Run clean command |
| `-m, --mode=MODE` | Specify mode (git, file, all, clean) |
| `-t, --target=DIR` | Target directory to analyze |
| `-o, --output=DIR` | Output directory for generated files |
| `-v, --verbose` | Enable verbose output |
| `-q, --quiet` | Suppress non-error output |
| `-h, --help` | Show help message |
| `--version` | Show version information |

### Examples

```bash
# Analyze a project with verbose output
showall all -t ~/projects/myapp -o ./output -v

# Just get Git info with specific output location
showall git -t /path/to/repo -o /path/to/output

# Clean generated files in specific directory
showall clean /path/to/project

# Quick file collection
showall file -t . -o ./reports
```

## 📁 Output Files

| Collector | File Pattern | Description |
|-----------|--------------|-------------|
| Git | `GIT_FULL_INFO_*_*.log` | Complete Git repository information |
| File | `PROJECT_FULL_*.log` | All project code files with structure |
| Log | `.showall.log` | Application log file |

### Git Collector Output Includes

- Repository overview (commits, branches, last commit)
- Author statistics
- Branch information with last commit dates
- Commit history with graphs
- Current changes (staged, unstaged, untracked)
- Tag information
- Git configuration
- Object counts and reflog

### File Collector Output Includes

- Directory tree structure
- Complete file contents with syntax hints
- File size and line count information
- Binary file detection and skipping
- Pattern-based file filtering
- Summary statistics

## 🧹 Cleaning Up

The clean command removes generated output files based on predefined patterns:

```bash
# Clean default patterns in current directory
showall clean

# Clean in specific directory
showall clean /path/to/project

# Clean with verbose output
showall clean -v
```

Default clean patterns:

- `PROJECT_FULL_*.log`
- `GIT_FULL_INFO_*.log`
- `.showall.log`

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🙏 Acknowledgments

- Built with [Bun](https://bun.sh) - fast JavaScript runtime
- Inspired by the need for AI-friendly code analysis tools
- Thanks to all contributors and users

## 📧 Contact & Support

- **GitHub**: [@asmanp2012](https://github.com/asmanp2012)
- **Issues**: [https://github.com/asmanp2012/showall/issues](https://github.com/asmanp2012/showall/issues)
- **Discussions**: GitHub Discussions page for questions and ideas

---

At the end **Happy Coding! 🚀**
