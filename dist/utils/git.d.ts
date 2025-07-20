/**
 * Git utilities for extracting repository and PR context
 */
import { GitContext } from '../models/comment.js';
/**
 * Git repository information
 */
export interface GitRepository {
    /** Repository root directory */
    root: string;
    /** Current branch name */
    branch: string;
    /** Current commit SHA */
    commit: string;
    /** Repository remote URL */
    remoteUrl: string;
    /** Extracted owner from remote URL */
    owner: string;
    /** Extracted repository name from remote URL */
    repo: string;
}
/**
 * Pull request information from environment or Git
 */
export interface PullRequestInfo {
    /** Pull request number */
    number: number;
    /** Head commit SHA */
    headSha: string;
    /** Base commit SHA */
    baseSha: string;
    /** Base branch name */
    baseBranch: string;
    /** Head branch name */
    headBranch: string;
}
/**
 * Checks if directory is a Git repository
 */
export declare function isGitRepository(workingDirectory?: string): Promise<boolean>;
/**
 * Gets the current commit SHA
 */
export declare function getCurrentCommit(workingDirectory?: string): Promise<string>;
/**
 * Gets the current branch name
 */
export declare function getCurrentBranch(workingDirectory?: string): Promise<string>;
/**
 * Gets repository information from Git
 */
export declare function getRepositoryInfo(workingDirectory?: string): Promise<GitRepository>;
/**
 * Gets pull request information from environment or Git
 */
export declare function getPRContext(workingDirectory?: string, prNumber?: number): Promise<GitContext>;
/**
 * Gets list of files that have been modified in the current branch
 */
export declare function getDiffFiles(workingDirectory?: string, baseBranch?: string): Promise<string[]>;
/**
 * Gets the merge base between current branch and base branch
 */
export declare function getMergeBase(workingDirectory?: string, baseBranch?: string): Promise<string>;
/**
 * Validates that the working directory is clean (no uncommitted changes)
 */
export declare function validateCleanWorkingDirectory(workingDirectory?: string): Promise<void>;
//# sourceMappingURL=git.d.ts.map