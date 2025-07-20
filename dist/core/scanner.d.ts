/**
 * Core comment scanner for detecting ghost comments in files
 */
import { GhostComment, GhostCommentConfig } from '../models/comment.js';
/**
 * Scans files for ghost comments using the provided configuration
 *
 * @param config - Configuration for scanning
 * @param workingDirectory - Working directory for resolving relative paths
 * @returns Promise resolving to array of found ghost comments
 */
export declare function scanFiles(config: GhostCommentConfig, workingDirectory?: string): Promise<GhostComment[]>;
/**
 * Scans a single file for ghost comments (convenience function)
 *
 * @param filePath - Path to the file to scan
 * @param config - Configuration for scanning
 * @param workingDirectory - Working directory for resolving relative paths
 * @returns Promise resolving to array of found ghost comments in the file
 */
export declare function scanSingleFile(filePath: string, config: GhostCommentConfig, workingDirectory?: string): Promise<GhostComment[]>;
/**
 * Counts ghost comments without loading them all into memory
 * Useful for large codebases where you just need a count
 *
 * @param config - Configuration for scanning
 * @param workingDirectory - Working directory for resolving relative paths
 * @returns Promise resolving to the number of ghost comments found
 */
export declare function countGhostComments(config: GhostCommentConfig, workingDirectory?: string): Promise<number>;
//# sourceMappingURL=scanner.d.ts.map