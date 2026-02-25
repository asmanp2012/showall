import { resolve, relative } from 'path';
import { existsSync, unlinkSync } from 'fs';
import { Logger } from './logger';

// Script configuration
const SCRIPT_NAME = "showall_clean";
const SCRIPT_DESCRIPTION = "Clean output files and temporary files";
const SCRIPT_VERSION = "2.1.0";

// Initialize logger (will be configured in main function)
let logger: Logger;

// Default patterns for cleaning
const CLEAN_PATTERNS = [
    'PROJECT_FULL_*.log',
    'GIT_FULL_INFO_*.log',
    '.showall.log'
];

// Get file size in human readable format
function getHumanReadableSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
}

// Find files matching patterns
async function findFiles(directory: string, patterns: string[]): Promise<string[]> {
    const files: string[] = [];
    
    for (const pattern of patterns) {
        try {
            const matches = await Array.fromAsync(
                new Bun.Glob(pattern).scan({ cwd: directory, absolute: true })
            );
            
            for (const match of matches) {
                if (!files.includes(match)) {
                    files.push(match);
                }
            }
        } catch (err: any) {
            logger?.debug(`Error scanning pattern ${pattern}: ${err.message}`);
        }
    }
    
    return files;
}

// Calculate total size of files
async function calculateTotalSize(files: string[]): Promise<number> {
    let total = 0;
    
    for (const file of files) {
        try {
            const stats = await Bun.file(file).stat();
            total += stats.size;
        } catch (err) {
            // Ignore errors
        }
    }
    
    return total;
}

// Main function
async function ShowallClean(
    targetDir: string = process.cwd()
) {
    // Initialize logger
    if (!logger) {
        logger = new Logger();
    }
    
    const absoluteTarget = resolve(targetDir);
    
    // Check if directory exists
    if (!existsSync(absoluteTarget)) {
        logger.error(`Directory '${absoluteTarget}' does not exist!`);
        process.exit(1);
    }
    
    logger.info(`Starting clean operation (${SCRIPT_NAME} v${SCRIPT_VERSION})...`);
    logger.info(`Target directory: ${absoluteTarget}`);
    logger.newLine();
    
    // Find files to clean
    logger.info('Scanning for files to clean...');
    const filesToClean = await logger.withSpinner('Finding files', async () => {
        return await findFiles(absoluteTarget, CLEAN_PATTERNS);
    });
    
    if (filesToClean.length === 0) {
        logger.success('No files found to clean!');
        return;
    }
    
    // Calculate total size
    const totalSize = await calculateTotalSize(filesToClean);
    
    // Show files that will be deleted
    logger.newLine();
    logger.info(`Found ${filesToClean.length} files to clean (${getHumanReadableSize(totalSize)}):`);
    logger.newLine();
    
    for (const file of filesToClean) {
        const stats = await Bun.file(file).stat();
        const relPath = relative(absoluteTarget, file);
        logger.log(`  📄 ${relPath} (${getHumanReadableSize(stats.size)})`);
    }
    
    logger.newLine();
    
    // Delete files
    let deleted = 0;
    let failed = 0;
    
    for (const file of filesToClean) {
        try {
            unlinkSync(file);
            deleted++;
            logger.vinfo(`Deleted: ${relative(absoluteTarget, file)}`);
        } catch (err: any) {
            failed++;
            logger?.error(`Failed to delete ${file}: ${err.message}`);
        }
    }
    
    logger.newLine();
    
    if (deleted > 0) {
        logger.success(`✅ Deleted ${deleted} files (${getHumanReadableSize(totalSize)})`);
    }
    if (failed > 0) {
        logger.warning(`⚠️  Failed to delete ${failed} files`);
    }
    
    logger.newLine();
}

export {
    ShowallClean,
    SCRIPT_VERSION as showall_clean_version,
    SCRIPT_DESCRIPTION as showall_clean_description
};