/**
 * Core comment cleaner for removing ghost comments from files
 */

import { promises as fs } from 'fs';
import { resolve, dirname, basename, join } from 'path';
import {
  GhostComment,
  GhostCommentError,
  GhostCommentErrorType,
} from '../models/comment.js';

/**
 * Represents a file that was modified during cleaning
 */
interface CleanedFile {
  /** Original file path */
  filePath: string;
  /** Backup file path */
  backupPath: string;
  /** Number of comments removed */
  commentsRemoved: number;
  /** Original file stats for restoration */
  originalStats: {
    mode: number;
    atime: Date;
    mtime: Date;
  };
}

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
export const DEFAULT_CLEAN_OPTIONS: CleanOptions = {
  createBackups: true,
  restoreOnError: true,
  removeBackups: false,
  dryRun: false,
};

/**
 * Creates a backup file path
 */
function createBackupPath(filePath: string): string {
  const dir = dirname(filePath);
  const name = basename(filePath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return join(dir, `.${name}.ghostcomment-backup-${timestamp}`);
}

/**
 * Creates a backup of a file
 */
async function createBackup(filePath: string): Promise<string> {
  try {
    const backupPath = createBackupPath(filePath);
    await fs.copyFile(filePath, backupPath);
    return backupPath;
  } catch (error) {
    throw new GhostCommentError(
      GhostCommentErrorType.FILE_ERROR,
      `Failed to create backup for ${filePath}`,
      error as Error
    );
  }
}

/**
 * Gets file stats for restoration
 */
async function getFileStats(filePath: string): Promise<{
  mode: number;
  atime: Date;
  mtime: Date;
}> {
  try {
    const stats = await fs.stat(filePath);
    return {
      mode: stats.mode,
      atime: stats.atime,
      mtime: stats.mtime,
    };
  } catch (error) {
    throw new GhostCommentError(
      GhostCommentErrorType.FILE_ERROR,
      `Failed to get file stats for ${filePath}`,
      error as Error
    );
  }
}

/**
 * Restores file permissions and timestamps
 */
async function restoreFileStats(
  filePath: string,
  stats: { mode: number; atime: Date; mtime: Date }
): Promise<void> {
  try {
    await fs.chmod(filePath, stats.mode);
    await fs.utimes(filePath, stats.atime, stats.mtime);
  } catch (error) {
    // Don't fail the operation if we can't restore stats
    console.warn(`Warning: Failed to restore file stats for ${filePath}: ${error}`);
  }
}

/**
 * Restores a file from backup
 */
async function restoreFromBackup(
  filePath: string,
  backupPath: string
): Promise<void> {
  try {
    await fs.copyFile(backupPath, filePath);
  } catch (error) {
    throw new GhostCommentError(
      GhostCommentErrorType.FILE_ERROR,
      `Failed to restore ${filePath} from backup ${backupPath}`,
      error as Error
    );
  }
}

/**
 * Removes a backup file
 */
async function removeBackup(backupPath: string): Promise<void> {
  try {
    await fs.unlink(backupPath);
  } catch (error) {
    // Don't fail if backup can't be removed
    console.warn(`Warning: Failed to remove backup ${backupPath}: ${error}`);
  }
}

/**
 * Groups ghost comments by file path
 */
function groupCommentsByFile(comments: GhostComment[]): Map<string, GhostComment[]> {
  const grouped = new Map<string, GhostComment[]>();
  
  for (const comment of comments) {
    const existing = grouped.get(comment.filePath) || [];
    existing.push(comment);
    grouped.set(comment.filePath, existing);
  }
  
  // Sort comments by line number (descending) so we can remove from bottom to top
  // This preserves line numbers for earlier comments
  for (const [filePath, fileComments] of grouped) {
    fileComments.sort((a, b) => b.lineNumber - a.lineNumber);
    grouped.set(filePath, fileComments);
  }
  
  return grouped;
}

/**
 * Cleans ghost comments from a single file
 */
async function cleanFile(
  filePath: string,
  comments: GhostComment[],
  options: CleanOptions,
  workingDirectory: string
): Promise<CleanedFile> {
  const resolvedPath = resolve(workingDirectory, filePath);
  
  try {
    // Get original file stats
    const originalStats = await getFileStats(resolvedPath);
    
    // Create backup if requested
    let backupPath = '';
    if (options.createBackups && !options.dryRun) {
      backupPath = await createBackup(resolvedPath);
    }
    
    // Read file content
    const content = await fs.readFile(resolvedPath, 'utf-8');
    const lines = content.split('\n');
    
    // Track which lines to remove
    const linesToRemove = new Set<number>();
    let removedCount = 0;
    
    // Verify each comment exists and mark lines for removal
    for (const comment of comments) {
      const lineIndex = comment.lineNumber - 1; // Convert to 0-based index
      
      if (lineIndex < 0 || lineIndex >= lines.length) {
        throw new GhostCommentError(
          GhostCommentErrorType.FILE_ERROR,
          `Comment line ${comment.lineNumber} is out of range in ${filePath} (file has ${lines.length} lines)`
        );
      }
      
      const actualLine = lines[lineIndex];
      
      // Verify the line matches what we expect
      if (actualLine !== comment.originalLine) {
        throw new GhostCommentError(
          GhostCommentErrorType.FILE_ERROR,
          `Line ${comment.lineNumber} in ${filePath} has changed since scanning. Expected: "${comment.originalLine}", Found: "${actualLine}"`
        );
      }
      
      linesToRemove.add(lineIndex);
      removedCount++;
    }
    
    if (!options.dryRun) {
      // Create new content with ghost comment lines removed
      const newLines = lines.filter((_, index) => !linesToRemove.has(index));
      const newContent = newLines.join('\n');
      
      // Write the cleaned content
      await fs.writeFile(resolvedPath, newContent, 'utf-8');
      
      // Restore file permissions and timestamps
      await restoreFileStats(resolvedPath, originalStats);
    }
    
    return {
      filePath,
      backupPath,
      commentsRemoved: removedCount,
      originalStats,
    };
    
  } catch (error) {
    if (error instanceof GhostCommentError) {
      throw error;
    }
    throw new GhostCommentError(
      GhostCommentErrorType.FILE_ERROR,
      `Failed to clean file ${filePath}`,
      error as Error
    );
  }
}

/**
 * Removes ghost comments from files
 * 
 * @param comments - Array of ghost comments to remove
 * @param options - Options for cleaning operation
 * @param workingDirectory - Working directory for resolving relative paths
 * @returns Promise resolving to cleaning result
 */
export async function removeComments(
  comments: GhostComment[],
  options: CleanOptions = DEFAULT_CLEAN_OPTIONS,
  workingDirectory: string = process.cwd()
): Promise<CleanResult> {
  if (comments.length === 0) {
    return {
      filesProcessed: 0,
      commentsRemoved: 0,
      modifiedFiles: [],
      errorFiles: [],
      hasErrors: false,
    };
  }
  
  // Group comments by file
  const commentsByFile = groupCommentsByFile(comments);
  const cleanedFiles: CleanedFile[] = [];
  const errorFiles: string[] = [];
  let totalCommentsRemoved = 0;
  
  try {
    // Clean each file
    for (const [filePath, fileComments] of commentsByFile) {
      try {
        const cleanedFile = await cleanFile(
          filePath,
          fileComments,
          options,
          workingDirectory
        );
        cleanedFiles.push(cleanedFile);
        totalCommentsRemoved += cleanedFile.commentsRemoved;
      } catch (error) {
        errorFiles.push(filePath);
        console.error(`Error cleaning ${filePath}: ${error}`);
      }
    }
    
    // If there were errors and restoreOnError is enabled, restore all files
    if (errorFiles.length > 0 && options.restoreOnError && !options.dryRun) {
      console.log('Errors occurred during cleaning. Restoring files from backups...');
      
      for (const cleanedFile of cleanedFiles) {
        if (cleanedFile.backupPath) {
          try {
            await restoreFromBackup(cleanedFile.filePath, cleanedFile.backupPath);
            console.log(`Restored ${cleanedFile.filePath} from backup`);
          } catch (restoreError) {
            console.error(`Failed to restore ${cleanedFile.filePath}: ${restoreError}`);
          }
        }
      }
      
      // Reset counters since we restored everything
      totalCommentsRemoved = 0;
    }
    
    // Remove backup files if requested and no errors occurred
    if (
      options.removeBackups &&
      !options.dryRun &&
      errorFiles.length === 0
    ) {
      for (const cleanedFile of cleanedFiles) {
        if (cleanedFile.backupPath) {
          await removeBackup(cleanedFile.backupPath);
        }
      }
    }
    
    return {
      filesProcessed: commentsByFile.size,
      commentsRemoved: totalCommentsRemoved,
      modifiedFiles: cleanedFiles.map(f => f.filePath),
      errorFiles,
      hasErrors: errorFiles.length > 0,
    };
    
  } catch (error) {
    // If there's a catastrophic error, try to restore all backups
    if (options.restoreOnError && !options.dryRun) {
      for (const cleanedFile of cleanedFiles) {
        if (cleanedFile.backupPath) {
          try {
            await restoreFromBackup(cleanedFile.filePath, cleanedFile.backupPath);
          } catch (restoreError) {
            console.error(`Failed to restore ${cleanedFile.filePath}: ${restoreError}`);
          }
        }
      }
    }
    
    if (error instanceof GhostCommentError) {
      throw error;
    }
    throw new GhostCommentError(
      GhostCommentErrorType.FILE_ERROR,
      'Failed to remove ghost comments',
      error as Error
    );
  }
}

/**
 * Validates that all comments can be safely removed
 * 
 * @param comments - Array of ghost comments to validate
 * @param workingDirectory - Working directory for resolving relative paths
 * @returns Promise resolving to validation result
 */
export async function validateCommentsForCleaning(
  comments: GhostComment[],
  workingDirectory: string = process.cwd()
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  try {
    const commentsByFile = groupCommentsByFile(comments);
    
    for (const [filePath, fileComments] of commentsByFile) {
      const resolvedPath = resolve(workingDirectory, filePath);
      
      try {
        // Check if file exists and is readable
        await fs.access(resolvedPath, fs.constants.R_OK | fs.constants.W_OK);
        
        // Read current content
        const content = await fs.readFile(resolvedPath, 'utf-8');
        const lines = content.split('\n');
        
        // Validate each comment
        for (const comment of fileComments) {
          const lineIndex = comment.lineNumber - 1;
          
          if (lineIndex < 0 || lineIndex >= lines.length) {
            errors.push(
              `${filePath}:${comment.lineNumber} - Line number out of range (file has ${lines.length} lines)`
            );
            continue;
          }
          
          const actualLine = lines[lineIndex];
          if (actualLine !== comment.originalLine) {
            errors.push(
              `${filePath}:${comment.lineNumber} - Line content has changed since scanning`
            );
          }
        }
      } catch (fileError) {
        errors.push(`${filePath} - File access error: ${fileError}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  } catch (error) {
    errors.push(`Validation error: ${error}`);
    return {
      valid: false,
      errors,
    };
  }
}