/**
 * Core comment scanner for detecting ghost comments in files
 */
import { promises as fs } from 'fs';
import glob from 'fast-glob';
import { resolve, relative } from 'path';
import { GhostCommentError, GhostCommentErrorType, } from '../models/comment.js';
import { FILE_LIMITS, CONFIG_VALIDATION } from '../models/config.js';
/**
 * Escapes special regex characters in a string
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/**
 * Validates file size before processing
 */
async function validateFileSize(filePath) {
    try {
        const stats = await fs.stat(filePath);
        if (stats.size > FILE_LIMITS.MAX_FILE_SIZE) {
            throw new GhostCommentError(GhostCommentErrorType.FILE_ERROR, `File ${filePath} is too large (${stats.size} bytes, max: ${FILE_LIMITS.MAX_FILE_SIZE})`);
        }
    }
    catch (error) {
        if (error instanceof GhostCommentError) {
            throw error;
        }
        throw new GhostCommentError(GhostCommentErrorType.FILE_ERROR, `Failed to check file size: ${filePath}`, error);
    }
}
/**
 * Detects encoding and reads file content safely
 */
async function readFileContent(filePath) {
    try {
        await validateFileSize(filePath);
        // For now, assume UTF-8 encoding
        // TODO: Add encoding detection if needed
        const content = await fs.readFile(filePath, 'utf-8');
        return content;
    }
    catch (error) {
        if (error instanceof GhostCommentError) {
            throw error;
        }
        throw new GhostCommentError(GhostCommentErrorType.FILE_ERROR, `Failed to read file: ${filePath}`, error);
    }
}
/**
 * Scans a single file for ghost comments
 */
async function scanFile(filePath, config, workingDirectory) {
    const comments = [];
    try {
        const content = await readFileContent(filePath);
        const lines = content.split('\n');
        // Create regex pattern for matching ghost comments
        const escapedPrefix = escapeRegex(config.prefix);
        const regex = new RegExp(`^\\s*${escapedPrefix}\\s*(.+)$`);
        lines.forEach((line, index) => {
            const match = line.match(regex);
            if (match && match[1]) {
                const commentContent = match[1].trim();
                // Validate comment length
                if (commentContent.length > CONFIG_VALIDATION.MAX_COMMENT_LENGTH) {
                    throw new GhostCommentError(GhostCommentErrorType.CONFIG_ERROR, `Comment too long at ${filePath}:${index + 1} (${commentContent.length} chars, max: ${CONFIG_VALIDATION.MAX_COMMENT_LENGTH})`);
                }
                // Use relative path from working directory for consistency
                const relativePath = relative(workingDirectory, filePath);
                comments.push({
                    filePath: relativePath,
                    lineNumber: index + 1,
                    content: commentContent,
                    prefix: config.prefix,
                    originalLine: line,
                });
            }
        });
        return comments;
    }
    catch (error) {
        if (error instanceof GhostCommentError) {
            throw error;
        }
        throw new GhostCommentError(GhostCommentErrorType.FILE_ERROR, `Failed to scan file: ${filePath}`, error);
    }
}
/**
 * Validates configuration before scanning
 */
function validateScanConfig(config) {
    if (!config.prefix) {
        throw new GhostCommentError(GhostCommentErrorType.CONFIG_ERROR, 'Comment prefix is required');
    }
    if (config.prefix.length > CONFIG_VALIDATION.MAX_PREFIX_LENGTH) {
        throw new GhostCommentError(GhostCommentErrorType.CONFIG_ERROR, `Prefix too long: ${config.prefix} (max: ${CONFIG_VALIDATION.MAX_PREFIX_LENGTH})`);
    }
    if (!config.include || config.include.length === 0) {
        throw new GhostCommentError(GhostCommentErrorType.CONFIG_ERROR, 'Include patterns are required');
    }
    if (config.include.length > CONFIG_VALIDATION.MAX_INCLUDE_PATTERNS) {
        throw new GhostCommentError(GhostCommentErrorType.CONFIG_ERROR, `Too many include patterns: ${config.include.length} (max: ${CONFIG_VALIDATION.MAX_INCLUDE_PATTERNS})`);
    }
    if (config.exclude && config.exclude.length > CONFIG_VALIDATION.MAX_EXCLUDE_PATTERNS) {
        throw new GhostCommentError(GhostCommentErrorType.CONFIG_ERROR, `Too many exclude patterns: ${config.exclude.length} (max: ${CONFIG_VALIDATION.MAX_EXCLUDE_PATTERNS})`);
    }
}
/**
 * Scans files for ghost comments using the provided configuration
 *
 * @param config - Configuration for scanning
 * @param workingDirectory - Working directory for resolving relative paths
 * @returns Promise resolving to array of found ghost comments
 */
export async function scanFiles(config, workingDirectory = process.cwd()) {
    validateScanConfig(config);
    try {
        // Use fast-glob to find matching files
        const files = await glob(config.include, {
            ignore: config.exclude || [],
            absolute: true,
            cwd: workingDirectory,
            followSymbolicLinks: false,
            suppressErrors: false,
        });
        // Check file count limit
        if (files.length > FILE_LIMITS.MAX_FILES) {
            throw new GhostCommentError(GhostCommentErrorType.FILE_ERROR, `Too many files to process: ${files.length} (max: ${FILE_LIMITS.MAX_FILES}). Consider refining your include/exclude patterns.`);
        }
        if (files.length === 0) {
            // Not an error, just no files found
            return [];
        }
        // Scan all files in parallel (with concurrency limit)
        const concurrency = 10; // Process up to 10 files simultaneously
        const allComments = [];
        for (let i = 0; i < files.length; i += concurrency) {
            const batch = files.slice(i, i + concurrency);
            const batchPromises = batch.map(filePath => scanFile(filePath, config, workingDirectory));
            const batchResults = await Promise.allSettled(batchPromises);
            for (let j = 0; j < batchResults.length; j++) {
                const result = batchResults[j];
                if (result && result.status === 'fulfilled') {
                    allComments.push(...result.value);
                }
                else if (result && result.status === 'rejected') {
                    // Log error but continue with other files
                    const filePath = batch[j];
                    console.warn(`Warning: Failed to scan ${filePath}: ${result.reason}`);
                }
            }
        }
        return allComments;
    }
    catch (error) {
        if (error instanceof GhostCommentError) {
            throw error;
        }
        throw new GhostCommentError(GhostCommentErrorType.FILE_ERROR, 'Failed to scan files for ghost comments', error);
    }
}
/**
 * Scans a single file for ghost comments (convenience function)
 *
 * @param filePath - Path to the file to scan
 * @param config - Configuration for scanning
 * @param workingDirectory - Working directory for resolving relative paths
 * @returns Promise resolving to array of found ghost comments in the file
 */
export async function scanSingleFile(filePath, config, workingDirectory = process.cwd()) {
    validateScanConfig(config);
    try {
        const resolvedPath = resolve(workingDirectory, filePath);
        return await scanFile(resolvedPath, config, workingDirectory);
    }
    catch (error) {
        if (error instanceof GhostCommentError) {
            throw error;
        }
        throw new GhostCommentError(GhostCommentErrorType.FILE_ERROR, `Failed to scan single file: ${filePath}`, error);
    }
}
/**
 * Counts ghost comments without loading them all into memory
 * Useful for large codebases where you just need a count
 *
 * @param config - Configuration for scanning
 * @param workingDirectory - Working directory for resolving relative paths
 * @returns Promise resolving to the number of ghost comments found
 */
export async function countGhostComments(config, workingDirectory = process.cwd()) {
    validateScanConfig(config);
    try {
        const files = await glob(config.include, {
            ignore: config.exclude || [],
            absolute: true,
            cwd: workingDirectory,
            followSymbolicLinks: false,
        });
        if (files.length > FILE_LIMITS.MAX_FILES) {
            throw new GhostCommentError(GhostCommentErrorType.FILE_ERROR, `Too many files to process: ${files.length} (max: ${FILE_LIMITS.MAX_FILES})`);
        }
        let totalCount = 0;
        const escapedPrefix = escapeRegex(config.prefix);
        const regex = new RegExp(`^\\s*${escapedPrefix}\\s*(.+)$`);
        for (const filePath of files) {
            try {
                await validateFileSize(filePath);
                const content = await fs.readFile(filePath, 'utf-8');
                const lines = content.split('\n');
                for (const line of lines) {
                    if (regex.test(line)) {
                        totalCount++;
                    }
                }
            }
            catch (error) {
                // Log warning but continue counting other files
                console.warn(`Warning: Failed to count comments in ${filePath}: ${error}`);
            }
        }
        return totalCount;
    }
    catch (error) {
        if (error instanceof GhostCommentError) {
            throw error;
        }
        throw new GhostCommentError(GhostCommentErrorType.FILE_ERROR, 'Failed to count ghost comments', error);
    }
}
//# sourceMappingURL=scanner.js.map