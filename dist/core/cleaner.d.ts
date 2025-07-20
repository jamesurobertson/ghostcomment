/**
 * Core comment cleaner for removing ghost comments from files
 */
import { GhostComment } from '../models/comment.js';
/**
 * Result of cleaning operation
 */
export interface CleanResult {
    /** Number of files processed */
    filesProcessed: number;
    /** Total comments removed */
    commentsRemoved: number;
    /** Files that were modified */
    modifiedFiles: string[];
    /** Files that had errors */
    errorFiles: string[];
    /** Whether any errors occurred */
    hasErrors: boolean;
}
/**
 * Options for cleaning operation
 */
export interface CleanOptions {
    /** Whether to create backup files before cleaning */
    createBackups: boolean;
    /** Whether to restore backups on error */
    restoreOnError: boolean;
    /** Whether to remove backup files after successful operation */
    removeBackups: boolean;
    /** Dry run mode - don't actually modify files */
    dryRun: boolean;
}
/**
 * Default cleaning options
 */
export declare const DEFAULT_CLEAN_OPTIONS: CleanOptions;
/**
 * Removes ghost comments from files
 *
 * @param comments - Array of ghost comments to remove
 * @param options - Options for cleaning operation
 * @param workingDirectory - Working directory for resolving relative paths
 * @returns Promise resolving to cleaning result
 */
export declare function removeComments(comments: GhostComment[], options?: CleanOptions, workingDirectory?: string): Promise<CleanResult>;
/**
 * Validates that all comments can be safely removed
 *
 * @param comments - Array of ghost comments to validate
 * @param workingDirectory - Working directory for resolving relative paths
 * @returns Promise resolving to validation result
 */
export declare function validateCommentsForCleaning(comments: GhostComment[], workingDirectory?: string): Promise<{
    valid: boolean;
    errors: string[];
}>;
//# sourceMappingURL=cleaner.d.ts.map