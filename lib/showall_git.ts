#!/usr/bin/env bun

import { $ } from "bun";
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { Logger } from './logger';

// Script configuration
const SCRIPT_NAME = "showall_git";
const SCRIPT_DESCRIPTION = "Git repository information collector";
const SCRIPT_VERSION = "2.0.0";

// Initialize logger (will be configured in main function)
let logger: Logger;

// Execute git command and return output
async function execGitCommand(
  command: string,
  options: { silent?: boolean } = {}
): Promise<string> {
  try {
    // برای دستورات git باید از bash استفاده کنیم
    const result = await $`bash -c ${command}`.text();
    return result.trim();
  } catch (e: any) {
    if (!options.silent) {
      logger?.error(`Failed to execute: ${command}`);
      if (e.stdout) logger?.error(`stdout: ${e.stdout}`);
      if (e.stderr) logger?.error(`stderr: ${e.stderr}`);
    }
    return '';
  }
}

// Check if directory is a git repository
async function checkGitRepo(dir: string): Promise<boolean> {
  try {
    const command = `cd '${dir}' && git rev-parse --git-dir 2>/dev/null`;
    await execGitCommand(command)
  } catch {
    return false;
  }
  return true;
}

// Get repository name
async function getRepoName(dir: string): Promise<string> {
  const topLevel = await execGitCommand(`cd '${dir}' && git rev-parse --show-toplevel`, { silent: true });
  return topLevel.split('/').pop() || '';
}

// Get total commits count
async function getTotalCommits(dir: string): Promise<string> {
  return await execGitCommand(`cd '${dir}' && git rev-list --count HEAD 2>/dev/null`, { silent: true }) || '0';
}

// Get author statistics
async function getAuthorStats(dir: string): Promise<string> {
  return await execGitCommand(`cd '${dir}' && git shortlog -s -n --all 2>/dev/null`, { silent: true });
}

// Get file status (A, M, D, R)
async function getFileStatus(dir: string, file: string, type: 'staged' | 'unstaged'): Promise<string> {
  const cmd = type === 'staged' 
    ? `cd '${dir}' && git diff --staged --name-status -- '${file}'`
    : `cd '${dir}' && git diff --name-status -- '${file}'`;
  const output = await execGitCommand(cmd, { silent: true });
  return output.split('\t')[0] || '';
}

// Get status display with emoji
function getStatusDisplay(status: string): string {
  const displays: Record<string, string> = {
    'A': '🆕 [NEW FILE]',
    'M': '✏️ [MODIFIED]',
    'D': '🗑️ [DELETED]',
    'R': '📝 [RENAMED]'
  };
  return displays[status.charAt(0)] || '📄';
}

// List files with their status
async function listFilesWithStatus(dir: string, files: string[], type: 'staged' | 'unstaged'): Promise<string> {
  const results = await Promise.all(
    files.map(async file => {
      const status = await getFileStatus(dir, file, type);
      const statusDisplay = getStatusDisplay(status);
      return `  - ${statusDisplay} ${file}`;
    })
  );
  return results.join('\n');
}

// Show full content of changes for each file
async function showFullFileChanges(dir: string, files: string[], type: 'staged' | 'unstaged'): Promise<string> {
  let output = '';
  
  for (const file of files) {
    const fullPath = join(dir, file);
    if (existsSync(fullPath)) {
      const status = await getFileStatus(dir, file, type);
      const statusDisplay = getStatusDisplay(status);
      
      output += `\n#### ${statusDisplay} File: ${file}\n`;
      output += '```diff\n';
      
      const cmd = type === 'staged' 
        ? `cd '${dir}' && git diff --staged -- '${file}'`
        : `cd '${dir}' && git diff -- '${file}'`;
      
      const diff = await execGitCommand(cmd, { silent: true });
      output += diff;
      output += '```\n\n---\n';
    }
  }
  
  return output;
}

// Show untracked files
async function showUntrackedFiles(dir: string): Promise<{ hasFiles: boolean; output: string }> {
  const untracked = (await execGitCommand(`cd '${dir}' && git ls-files --others --exclude-standard 2>/dev/null`, { silent: true }))
    .split('\n')
    .filter(Boolean);
  
  if (untracked.length > 0) {
    let output = '### 🆕 UNTRACKED FILES (new files not added to git)\n\n';
    output += `📁 New files (run 'git add' to stage them) (${untracked.length} files):\n`;
    output += untracked.map(f => `  - 🆕 [NEW] ${f}`).join('\n');
    output += '\n\n💡 Tip: Use \'git add <file>\' to start tracking these files\n';
    return { hasFiles: true, output };
  }
  return { hasFiles: false, output: '' };
}

// Show staged changes
async function showStagedChanges(dir: string): Promise<{ hasFiles: boolean; output: string }> {
  const staged = (await execGitCommand(`cd '${dir}' && git diff --staged --name-only 2>/dev/null`, { silent: true }))
    .split('\n')
    .filter(Boolean);
  
  if (staged.length > 0) {
    let output = '### 📌 STAGED CHANGES (ready to commit)\n\n';
    output += `📁 Files staged for commit (${staged.length} files):\n`;
    output += await listFilesWithStatus(dir, staged, 'staged');
    
    output += '\n\n📊 Changes summary:\n';
    output += await execGitCommand(`cd '${dir}' && git diff --staged --stat 2>/dev/null`, { silent: true });
    output += '\n\n### 📄 FULL CONTENT OF STAGED CHANGES:\n';
    output += await showFullFileChanges(dir, staged, 'staged');
    return { hasFiles: true, output };
  }
  return { hasFiles: false, output: '' };
}

// Show unstaged changes
async function showUnstagedChanges(dir: string): Promise<{ hasFiles: boolean; output: string }> {
  const unstaged = (await execGitCommand(`cd '${dir}' && git diff --name-only 2>/dev/null`, { silent: true }))
    .split('\n')
    .filter(Boolean);
  
  if (unstaged.length > 0) {
    let output = '### ✏️ UNSTAGED CHANGES (not yet staged)\n\n';
    output += `📁 Modified files (not staged) (${unstaged.length} files):\n`;
    output += await listFilesWithStatus(dir, unstaged, 'unstaged');
    output += '\n\n📊 Changes summary:\n';
    output += await execGitCommand(`cd '${dir}' && git diff --stat 2>/dev/null`, { silent: true });
    output += '\n\n### 📄 FULL CONTENT OF UNSTAGED CHANGES:\n';
    output += await showFullFileChanges(dir, unstaged, 'unstaged');
    return { hasFiles: true, output };
  }
  return { hasFiles: false, output: '' };
}

// Get changes info
async function getChangesInfo(dir: string): Promise<string> {
  let output = '## 📝 Current Changes\n\n';
  
  const staged = await showStagedChanges(dir);
  const unstaged = await showUnstagedChanges(dir);
  const untracked = await showUntrackedFiles(dir);
  
  if (staged.hasFiles) {
    output += staged.output;
  } 
  if (unstaged.hasFiles) {
    output += unstaged.output;
  } 
  if (untracked.hasFiles) {
    output += untracked.output;
  }
  
  if (!staged.hasFiles && !unstaged.hasFiles && !untracked.hasFiles) {
    output += 'No changes detected in working directory.\n';
  }
  
  return output + '\n';
}

// Get branch information
async function getBranchInfo(dir: string): Promise<string> {
  let output = '## 🌿 Branch Information\n\n';
  
  output += '### Current branch:\n';
  output += await execGitCommand(`cd '${dir}' && git branch --show-current 2>/dev/null`, { silent: true }) + '\n\n';
  
  output += '### All branches:\n';
  output += await execGitCommand(`cd '${dir}' && git branch -avv 2>/dev/null`, { silent: true }) + '\n\n';
  
  output += '### Remote branches:\n';
  output += await execGitCommand(`cd '${dir}' && git branch -r 2>/dev/null`, { silent: true }) + '\n\n';
  
  output += '### Branch last commit dates:\n';
  const branches = (await execGitCommand(`cd '${dir}' && git branch 2>/dev/null`, { silent: true }))
    .split('\n')
    .map(b => b.replace('*', '').trim())
    .filter(Boolean);
  
  for (const branch of branches) {
    const date = await execGitCommand(`cd '${dir}' && git show -s --format="%ci" ${branch} 2>/dev/null`, { silent: true });
    output += `${branch}: ${date || 'No commits'}\n`;
  }
  
  return output + '\n';
}

// Get commit history
async function getCommitHistory(dir: string): Promise<string> {
  let output = '## 📜 Commit History\n\n';
  
  output += '### Last 20 commits:\n';
  output += await execGitCommand(`cd '${dir}' && git log --oneline -20 --graph --decorate 2>/dev/null`, { silent: true }) + '\n\n';
  
  output += '### Commits per day (last 30 days):\n';
  output += await execGitCommand(`cd '${dir}' && git log --since="30 days ago" --pretty=format:"%ad" --date=short 2>/dev/null | sort | uniq -c`, { silent: true }) + '\n\n';
  
  output += '### Detailed recent commits:\n';
  const detailedLog = await execGitCommand(
    `cd '${dir}' && git log -5 --pretty=format:"%n🔹 Commit: %H%n📅 Date: %ci%n👤 Author: %an <%ae>%n📝 Message: %s%n📄 Files changed:%n%b" --stat 2>/dev/null`,
    { silent: true }
  );
  output += detailedLog + '\n\n';
  
  return output;
}

// Get tag information
async function getTagInfo(dir: string): Promise<string> {
  let output = '## 🏷️ Tag Information\n\n';
  
  output += '### All tags:\n';
  output += await execGitCommand(`cd '${dir}' && git tag -l 2>/dev/null`, { silent: true }) + '\n\n';
  
  output += '### Annotated tags with messages:\n';
  output += await execGitCommand(`cd '${dir}' && git tag -l -n 2>/dev/null`, { silent: true }) + '\n\n';
  
  output += '### Latest tag:\n';
  const latestTag = await execGitCommand(`cd '${dir}' && git describe --tags --abbrev=0 2>/dev/null`, { silent: true });
  output += (latestTag || 'No tags found') + '\n\n';
  
  return output;
}

// Get configuration
async function getConfigInfo(dir: string): Promise<string> {
  let output = '## ⚙️ Git Configuration\n\n';
  
  output += '### Global config:\n';
  output += await execGitCommand('git config --global --list 2>/dev/null', { silent: true }) || 'No global config found\n';
  output += '\n';
  
  output += '### Local config:\n';
  output += await execGitCommand(`cd '${dir}' && git config --local --list 2>/dev/null`, { silent: true }) || 'No local config found\n';
  output += '\n';
  
  output += '### Important settings:\n';
  
  const userName = await execGitCommand(`cd '${dir}' && git config user.name 2>/dev/null`, { silent: true });
  const userEmail = await execGitCommand(`cd '${dir}' && git config user.email 2>/dev/null`, { silent: true });
  const coreEditor = await execGitCommand(`cd '${dir}' && git config core.editor 2>/dev/null`, { silent: true });
  
  
  output += `user.name: ${userName || 'Not set'}\n`;
  output += `user.email: ${userEmail || 'Not set'}\n`;
  output += `core.editor: ${coreEditor || 'Not set'}\n\n`;
  
  return output;
}

// Main function
async function ShowallGit(
  targetDir: string = process.cwd(),
  outputDir: string = process.cwd(),
  verbose: boolean = true
) {
  // Initialize logger with settings from main script
  if (!logger) {
    logger = new Logger();
  }
  logger.verbose = verbose;
  // Resolve paths using Bun
  const absoluteTarget = resolve(targetDir);
  const absoluteOutput = resolve(outputDir);
  
  if (!await checkGitRepo(absoluteTarget)) {
    logger.error('Not a git repository!');
    process.exit(1);
  }
  
  const repoName = await getRepoName(absoluteTarget);
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0].replace(/T/g, '_');
  const fileName = `GIT_FULL_INFO_${repoName}_${timestamp}.log`;
  const outputFile = join(absoluteOutput, fileName);

  logger.info(`Starting Git repository information collection...`);
  logger.info(`Repository: ${repoName}`);
  logger.info(`Target directory: ${absoluteTarget}`);
  logger.newLine();
  
  let content = '';
  
  // Header
  content += '# 🔍 Complete Git Repository Information\n';
  content += `# Repository: ${repoName}\n`;
  content += `# Collected on: ${new Date().toLocaleString()}\n`;
  content += `# Git version: ${await execGitCommand('git --version', { silent: true })}\n`;
  content += '# ===============================================\n\n';
  
  // Repository overview
  content += '## 📊 Repository Overview\n';
  content += `Name: ${repoName}\n`;
  content += `Total commits: ${await getTotalCommits(absoluteTarget)}\n`;
  content += `Current branch: ${await execGitCommand(`cd '${absoluteTarget}' && git branch --show-current`, { silent: true })}\n`;
  
  const lastCommit = await execGitCommand(`cd '${absoluteTarget}' && git log -1 --format="%H - %s" 2>/dev/null`, { silent: true });
  content += `Last commit: ${lastCommit || 'No commits'}\n`;
  
  const lastCommitDate = await execGitCommand(`cd '${absoluteTarget}' && git log -1 --format="%ci" 2>/dev/null`, { silent: true });
  content += `Last commit date: ${lastCommitDate || 'No commits'}\n\n`;
  
  // Collect all information in parallel where possible 
  logger.vinfo('📊 Collecting author statistics...');
  const authorStats = await getAuthorStats(absoluteTarget);
  logger.vinfo('✅ Author statistics collected');

  logger.vinfo('🌿 Collecting branch information...');
  const branchInfo = await getBranchInfo(absoluteTarget);
  logger.vinfo('✅ Branch information collected');

  logger.vinfo('📜 Collecting commit history...');
  const commitHistory = await getCommitHistory(absoluteTarget);
  logger.vinfo('✅ Commit history collected');

  logger.vinfo('📝 Collecting changes information...');
  const changesInfo = await getChangesInfo(absoluteTarget);
  logger.vinfo('✅ Changes information collected');

  logger.vinfo('🏷️ Collecting tag information...');
  const tagInfo = await getTagInfo(absoluteTarget);
  logger.vinfo('✅ Tag information collected');

  logger.vinfo('⚙️ Collecting configuration information...');
  const configInfo = await getConfigInfo(absoluteTarget);
  logger.vinfo('✅ Configuration information collected');

  content += '## 👥 Contributors\n\n';
  content += authorStats + '\n\n';
  content += branchInfo;
  content += commitHistory;
  content += changesInfo;
  content += tagInfo;
  content += configInfo;
  
  // Git objects info
  content += '## 🗄️ Git Objects\n';
  content += '### Object count:\n';
  content += await execGitCommand(
    `cd '${absoluteTarget}' && git count-objects -v 2>/dev/null`,
    { silent: true }
  ) || 'No objects found\n';
  content += '\n';
  
  // Reflog
  content += '## 📋 Reflog (last 20 entries)\n';
  content += await execGitCommand(`cd '${absoluteTarget}' && git reflog show -20 2>/dev/null`, { silent: true }) || 'No reflog data\n';
  content += '\n';
  
  // Summary
  content += '## 📈 Summary\n';
  
  const branchCount = await execGitCommand(`cd '${absoluteTarget}' && git branch | wc -l`, { silent: true });
  const tagCount = await execGitCommand(`cd '${absoluteTarget}' && git tag | wc -l`, { silent: true });
  const stashCount = await execGitCommand(`cd '${absoluteTarget}' && git stash list | wc -l 2>/dev/null`, { silent: true });
  
  
  content += `Total branches: ${branchCount.trim()}\n`;
  content += `Total tags: ${tagCount.trim()}\n`;
  content += `Total stashes: ${stashCount.trim() || '0'}\n\n`;
  
  // Change statistics
  content += '## 🔄 Change Statistics\n';
  
  const stagedCount = await execGitCommand(`cd '${absoluteTarget}' && git diff --staged --name-only | wc -l`, { silent: true });
  const unstagedCount = await execGitCommand(`cd '${absoluteTarget}' && git diff --name-only | wc -l`, { silent: true });
  const untrackedCount = await execGitCommand(`cd '${absoluteTarget}' && git ls-files --others --exclude-standard | wc -l`, { silent: true });
  
  
  content += `Staged files: ${stagedCount.trim()}\n`;
  content += `Unstaged files: ${unstagedCount.trim()}\n`;
  content += `Untracked files: ${untrackedCount.trim()}\n\n`;
  
  content += '# 🎯 Collection completed successfully!\n';
  content += '# Please Write for me commit message\n';
  
  // Write to file
  await Bun.write(outputFile, content);
  
  // return;
  logger.success('✅ Git collection completed!');
  logger.info(`Output file: ${outputFile}`);
  logger.newLine();

  
  const fileStats = await Bun.file(outputFile).stat();
  const fileSize = (fileStats.size / 1024).toFixed(2);
  logger.log(`📊 File size: ${fileSize} KB`);
  
  const lineCount = content.split('\n').length;
  logger.log(`📈 Total lines: ${lineCount}`);
  logger.newLine();
  
  // Show quick stats
  logger.info('Quick repository stats:');
  logger.log(`├─ Commits: ${await getTotalCommits(absoluteTarget)}`);
  logger.log(`├─ Branches: ${branchCount.trim()}`);
  logger.log(`├─ Tags: ${tagCount.trim()}`);
  logger.log(`├─ Staged files: ${stagedCount.trim()}`);
  logger.log(`├─ Unstaged files: ${unstagedCount.trim()}`);
  logger.log(`└─ Untracked files: ${untrackedCount.trim()}`);
  logger.newLine();
  
  logger.warning('💡 Tip: Use "gzip" to compress the output file');
}

export {
  ShowallGit,
  SCRIPT_VERSION as showall_git_version,
  SCRIPT_DESCRIPTION as showall_git_description
};
