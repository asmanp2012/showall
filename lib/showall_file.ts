#!/usr/bin/env bun

import { $ } from "bun";
import { join, relative, basename, extname, resolve } from 'path';
import { Logger } from './logger';

// Script configuration
const SCRIPT_NAME = "showall_file";
const SCRIPT_DESCRIPTION = "Project code files collector";
const SCRIPT_VERSION = "2.0.0";

// Initialize logger
let logger: Logger;

// Define patterns for find files
const PATTERNS = [
    // Files with specific extensions
    '*.py', '*.php', '*.go', '*.rb', '*.rs', '*.swift', '*.kt', '*.scala',
    '*.cpp', '*.c', '*.h', '*.hpp', '*.r', '*.R', '*.dart',
    '*.java', '*.clj', '*.cljs', '*.cljc', '*.properties',
    '*.vb', '*.cs', '*.fs', '*.fsx', '*.fsi',
    '*.m', '*.jl', '*.lua', '*.hs', '*.elm', '*.ex', '*.exs', '*.erl', '*.hrl',
    '*.njk', '*.html', '*.htm', '*.css', '*.scss', '*.less', '*.sass',
    '*.js', '*.jsx', '*.ts', '*.tsx',
    '*.pl', '*.pm', '*.t',
    '*.json', '*.xml', '*.yml', '*.yaml', '*.toml',
    '*.md', '*.markdown', '*.txt',
    '*.sh', '*.bash', '*.zsh', '*.fish',
    '*.sql', '*.graphql', '*.gql',
    '*.svg',
    '*.config', '.env*', '*.env', '*.vim', '.vimrc', '*.ini', '*.cfg', '*.conf', '*.tf', '*.tfvars',

    // Important config files without extension
    '.env',

    // Project files
    'Dockerfile', 'Dockerfile.*',
    'docker-compose.yml', 'docker-compose.yaml', 'docker-compose.*',
    'Makefile', 'makefile', 'GNUmakefile', 'Makefile.*',
    'CMakeLists.txt', 'Procfile',

    // Document files
    'README', 'README.*', 'CHANGELOG', 'CHANGELOG.*',
    'LICENSE', 'LICENSE.*', 'CONTRIBUTING', 'CONTRIBUTING.*'
];

// Define IGNORE patterns (files to exclude)
const IGNORE_PATTERNS = [
    // Temporary and cache files
    '*.tmp', '*.temp', '*.log', '*.cache', '*.swp', '*.swo', '*.swn',

    // Build and generated files
    '*.o', '*.obj', '*.exe', '*.dll', '*.so', '*.dylib', '*.class', '*.jar', '*.war', '*.ear',

    // Data and database files
    '*.db', '*.sqlite', '*.sqlite3', '*.mdb',

    // Media and binary files
    '*.jpg', '*.jpeg', '*.png', '*.gif', '*.bmp', '*.ico', '*.mp3', '*.mp4', '*.avi', '*.mov',
    '*.pdf', '*.doc', '*.docx', '*.xls', '*.xlsx', '*.ppt', '*.pptx',

    // Archive files
    '*.zip', '*.tar', '*.gz', '*.bz2', '*.7z', '*.rar',

    // Lock files
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'Gemfile.lock',
    'composer.lock', 'poetry.lock', 'Cargo.lock',

    // System files
    '.DS_Store', 'Thumbs.db', 'desktop.ini',

    // IDE files
    '.idea', '.vscode', '*.code-workspace'
];

// Define exclude directories
const EXCLUDE_DIRS = [
    '__pycache__',
    'node_modules',
    '.git',
    '.venv',
    'venv',
    'env',
    'dist',
    '.next',
    '.nuxt',
    '.output',
    'coverage',
    'build',
    'target',
    'out',
    'obj',
    'bin',
    'logs',
    'tmp',
    'temp',
    'cache',
    '.idea',
    '.vscode'
];

interface FileInfo {
    path: string;
    size: number;
    isBinary: boolean;
}

interface Stats {
    totalFound: number;
    processed: number;
    skippedBinary: number;
    skippedByPattern: number;
    skippedFiles: string[];
}

// تابع کمکی برای پاکسازی مسیر
function cleanPath(path: string): string {
    return path.replace(/\n/g, '').replace(/\r/g, '').trim();
}

async function walkDirectory(dir: string, baseDir: string = dir): Promise<FileInfo[]> {
    const files: FileInfo[] = [];
    
    try {
        // استفاده از Bun.file().exists() به جای readdir
        const dirPath = cleanPath(dir);
        const entries = await $`find "${dirPath}" -maxdepth 1 -printf "%P\\n" 2>/dev/null`.text();
        
        for (const entry of entries.split('\n').filter(Boolean)) {
            const fullPath = join(dir, entry);
            const relativePath = relative(baseDir, fullPath);
            
            // Check if directory
            const isDir = (await $`test -d "${fullPath}" && echo "true" || echo "false"`.text()).trim() === "true";
            
            if (isDir) {
                if (EXCLUDE_DIRS.includes(entry)) {
                    continue;
                }
                const subFiles = await walkDirectory(fullPath, baseDir);
                files.push(...subFiles);
                continue;
            }
            
            // Check if file matches patterns
            if (!matchesPattern(entry, PATTERNS)) {
                continue;
            }
            
            // Check if file matches ignore patterns
            if (matchesPattern(entry, IGNORE_PATTERNS)) {
                continue;
            }
            
            // Get file size using Bun
            const fileStats = await Bun.file(fullPath).stat();
            
            // Skip empty files
            if (fileStats.size === 0) {
                continue;
            }
            
            // Check if file is text/binary
            const isBinary = await isBinaryFile(fullPath);
            
            files.push({
                path: relativePath,
                size: fileStats.size,
                isBinary
            });
        }
    } catch (err) {
        // Skip permission errors
        if (!options?.silent) {
            logger?.debug(`Permission denied: ${dir}`);
        }
    }
    
    return files;
}

function matchesPattern(filename: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
        // Convert glob pattern to regex
        const regexPattern = pattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(filename);
    });
}

async function isBinaryFile(filePath: string): Promise<boolean> {
    try {
        const file = Bun.file(filePath);
        const buffer = await file.arrayBuffer();
        const sample = new Uint8Array(buffer.slice(0, 512));
        
        // Check for null bytes and control characters
        for (let i = 0; i < sample.length; i++) {
            if (sample[i] === 0) {
                return true; // Null byte indicates binary
            }
            if (sample[i] < 32 && sample[i] !== 9 && sample[i] !== 10 && sample[i] !== 13) {
                return true; // Control character (except tab, LF, CR)
            }
        }
        return false;
    } catch {
        return true;
    }
}

function getFileType(filePath: string): string {
    const ext = extname(filePath).toLowerCase();
    const filename = basename(filePath);
    
    // Map extensions to language comments
    const typeMap: Record<string, string> = {
        '.py': '# Python',
        '.js': '// JavaScript',
        '.jsx': '// React JSX',
        '.ts': '// TypeScript',
        '.tsx': '// React TSX',
        '.java': '// Java',
        '.cpp': '// C++',
        '.c': '// C',
        '.h': '// C/C++ Header',
        '.hpp': '// C++ Header',
        '.php': '// PHP',
        '.rb': '# Ruby',
        '.go': '// Go',
        '.rs': '// Rust',
        '.swift': '// Swift',
        '.kt': '// Kotlin',
        '.scala': '// Scala',
        '.html': '<!-- HTML -->',
        '.htm': '<!-- HTML -->',
        '.css': '/* CSS */',
        '.scss': '/* SCSS */',
        '.less': '/* Less */',
        '.sass': '/* Sass */',
        '.json': '// JSON',
        '.xml': '<!-- XML -->',
        '.yml': '# YAML',
        '.yaml': '# YAML',
        '.toml': '# TOML',
        '.md': '# Markdown',
        '.markdown': '# Markdown',
        '.txt': '# Text File',
        '.sh': '# Shell Script',
        '.bash': '# Bash Script',
        '.zsh': '# Zsh Script',
        '.fish': '# Fish Script',
        '.sql': '-- SQL',
        '.r': '# R',
        '.R': '# R',
        '.m': '// MATLAB/Objective-C',
        '.jl': '# Julia',
        '.lua': '-- Lua',
        '.pl': '# Perl',
        '.pm': '# Perl Module',
        '.t': '# Perl Test',
        '.hs': '-- Haskell',
        '.fs': '// F#',
        '.fsx': '// F# Script',
        '.vb': "' Visual Basic",
        '.cs': '// C#',
        '.dart': '// Dart',
        '.elm': '-- Elm',
        '.clj': '; Clojure',
        '.cljs': '; ClojureScript',
        '.ex': '# Elixir',
        '.exs': '# Elixir Script',
        '.erl': '% Erlang',
        '.vim': '" Vim Script',
        '.tf': '# Terraform',
        '.tfvars': '# Terraform Variables',
        '.svg': '<!-- SVG -->',
        '.proto': '// Protocol Buffers',
        '.graphql': '# GraphQL',
        '.gql': '# GraphQL'
    };
    
    if (typeMap[ext]) {
        return typeMap[ext];
    }
    
    // Special files
    if (filename.startsWith('Dockerfile')) {
        return '# Dockerfile';
    }
    if (filename === 'Makefile' || filename.startsWith('Makefile.')) {
        return '# Makefile';
    }
    if (filename.startsWith('.env')) {
        return '# Environment Variables';
    }
    if (filename === 'package.json') {
        return '// Node.js Package';
    }
    
    return '# File';
}

async function generateDirectoryTree(dir: string): Promise<string> {
    let tree = '';
    const cleanDir = cleanPath(dir);
    
    async function buildTree(currentPath: string, prefix: string = ''): Promise<void> {
        try {
            const entries = await $`find "${currentPath}" -maxdepth 1 -printf "%P\\n" 2>/dev/null`.text();
            const filteredEntries = entries.split('\n')
                .filter(Boolean)
                .filter(name => !EXCLUDE_DIRS.includes(name));
            
            for (let i = 0; i < filteredEntries.length; i++) {
                const entry = filteredEntries[i];
                const isLast = i === filteredEntries.length - 1;
                const fullPath = join(currentPath, entry);
                
                // Check if directory
                const isDir = (await $`test -d "${fullPath}" && echo "true" || echo "false"`.text()).trim() === "true";
                
                tree += `${prefix}${isLast ? '└── ' : '├── '}${entry}\n`;
                
                if (isDir) {
                    const newPrefix = prefix + (isLast ? '    ' : '│   ');
                    await buildTree(fullPath, newPrefix);
                }
            }
        } catch (err) {
            // Skip permission errors
        }
    }
    
    tree += '.\n';
    await buildTree(cleanDir);
    return tree;
}

// Main function
async function ShowallFile(
    targetDir: string = process.cwd(),
    outputDir: string = process.cwd()
) {
    // Initialize logger with settings from main script
    if (!logger) {
        logger = new Logger();
    }
    
    // Resolve and clean paths
    const absoluteTarget = cleanPath(resolve(targetDir));
    const absoluteOutput = cleanPath(resolve(outputDir));
    
    // Check if target directory exists using Bun
    const targetExists = await Bun.file(absoluteTarget).exists();
    if (!targetExists) {
        logger.error(`Directory '${absoluteTarget}' does not exist!`);
        process.exit(1);
    }
    
    const repoName = basename(absoluteTarget);
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0].replace(/T/g, '_');
    const outputFile = `PROJECT_FULL_${repoName}_${timestamp}.log`;
    const outputPath = join(absoluteOutput, outputFile);
    
    logger.info(`Starting file collection...`);
    logger.info(`Target directory: ${absoluteTarget}`);
    logger.info(`Output file: ${outputPath}`);
    console.log('');
    
    logger.info('Scanning directory...');
    
    // Collect all files
    const files = await walkDirectory(absoluteTarget);
    
    const stats: Stats = {
        totalFound: files.length,
        processed: 0,
        skippedBinary: 0,
        skippedByPattern: 0,
        skippedFiles: []
    };
    
    let content = '';
    let fileCounter = 0;
    
    // Header
    content += '# 📦 Complete Project Code Collection (No Limits)\n';
    content += '# For analysis by AI tools\n';
    content += `# Date: ${new Date().toLocaleString()}\n`;
    content += `# Path: ${absoluteTarget}\n`;
    content += '#\n';
    content += '# This file contains complete content of all code files\n';
    content += '# ===============================================\n\n';
    
    // Project Info
    content += '## 🔍 Project Information\n';
    content += `Path: ${absoluteTarget}\n`;
    content += `Date: ${new Date().toLocaleString()}\n\n`;
    
    // Directory Structure
    content += '### Directory Structure:\n';
    content += '```\n';
    content += await generateDirectoryTree(absoluteTarget);
    content += '```\n\n';
    
    // Important Files List
    content += '## 📋 Important Files List\n';
    content += `Total important files found: ${files.length}\n`;
    content += '```\n';
    content += files.map(f => f.path).join('\n');
    content += '```\n\n';
    
    // File Contents
    content += '## 📄 Complete File Contents\n\n';
    
    for (const file of files) {
        if (file.isBinary) {
            stats.skippedBinary++;
            stats.skippedFiles.push(`${file.path} (binary, ${Math.round(file.size/1024)}KB)`);
            continue;
        }
        
        fileCounter++;
        stats.processed++;
        
        content += `### File ${fileCounter}: ${file.path}\n`;
        content += `Size: ${Math.round(file.size/1024)}KB\n`;
        
        try {
            const fullPath = join(absoluteTarget, file.path);
            const fileContent = await Bun.file(fullPath).text();
            const lines = fileContent.split('\n').length;
            content += `Lines: ${lines}\n`;
            content += '```\n';
            
            // Add language comment
            const fileType = getFileType(file.path);
            content += fileType + '\n\n';
            
            // Replace tabs with spaces for better formatting
            content += fileContent.replace(/\t/g, '    ');
            
            content += '\n```\n';
            content += '\n---\n\n';
        } catch (err) {
            // Skip files that can't be read
            stats.skippedByPattern++;
        }
    }
    
    // Summary
    content += '## 📊 Final Summary\n';
    content += `✅ Files displayed: ${stats.processed}\n`;
    
    if (stats.skippedBinary > 0) {
        content += `\n⏭️  Files skipped (binary): ${stats.skippedBinary}\n`;
        content += '\n### Binary files skipped:\n';
        content += '```\n';
        content += stats.skippedFiles.join('\n');
        content += '\n```\n';
    }
    
    content += '\n### Ignored patterns:\n';
    for (const pattern of IGNORE_PATTERNS) {
        content += `- ${pattern}\n`;
    }
    
    content += '\n### Ignored directories:\n';
    for (const dir of EXCLUDE_DIRS) {
        content += `- ${dir}/\n`;
    }
    
    content += '\n### File statistics:\n';
    content += `- Total files found: ${stats.totalFound}\n`;
    content += `- Files processed: ${stats.processed}\n`;
    content += `- Files skipped (binary): ${stats.skippedBinary}\n`;
    content += `- Files skipped (error): ${stats.skippedByPattern}\n`;
    
    // Write to file using Bun
    await Bun.write(outputPath, content);
    
    // Show results
    logger.success('✅ File collection completed!');
    console.log('');
    console.log(`📄 Output file: ${outputFile}`);
    console.log(`📁 Path: ${absoluteOutput}/`);
    
    const fileStats = await Bun.file(outputPath).stat();
    console.log(`📊 File size: ${Math.round(fileStats.size / 1024)} KB`);
    
    const lineCount = content.split('\n').length;
    console.log(`📈 Total lines: ${lineCount}`);
    console.log('');
    console.log(`🔍 Files processed: ${stats.processed}`);
    console.log(`⏭️  Files skipped (binary): ${stats.skippedBinary}`);
    console.log(`🚫 Files skipped (error): ${stats.skippedByPattern}`);
    console.log('');
    
    logger.warning('💡 Tip: If the file gets too large, you can compress it with gzip:');
    console.log(`    gzip ${outputFile}`);
    console.log('');
}

export {
    ShowallFile,
    SCRIPT_VERSION as showall_files_version,
    SCRIPT_DESCRIPTION as showall_files_description
};