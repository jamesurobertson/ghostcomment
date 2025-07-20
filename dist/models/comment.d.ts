/**
 * Core data structures for GhostComment tool
 */
/**
 * Represents a ghost comment found in code
 */
export interface GhostComment {
    /** Absolute path to the file containing the comment */
    filePath: string;
    /** Line number where the comment was found (1-indexed) */
    lineNumber: number;
    /** The extracted comment content (without prefix) */
    content: string;
    /** The prefix that was used to identify this comment */
    prefix: string;
    /** The original line containing the comment */
    originalLine: string;
}
/**
 * Configuration for GhostComment operations
 */
export interface GhostCommentConfig {
    /** Comment prefix to search for (e.g., '//_gc_') */
    prefix: string;
    /** File patterns to include in scanning */
    include: string[];
    /** File patterns to exclude from scanning */
    exclude: string[];
    /** Whether to fail the process if ghost comments are found */
    failOnFound: boolean;
    /** GitHub personal access token */
    githubToken?: string;
    /** GitLab personal access token */
    gitlabToken?: string;
    /** Custom GitLab instance URL */
    gitlabUrl?: string;
}
/**
 * Git repository and PR/MR context information
 */
export interface GitContext {
    /** Repository owner (username or organization) */
    owner: string;
    /** Repository name */
    repo: string;
    /** Pull request number */
    pullNumber: number;
    /** Commit SHA that the comments should be posted on */
    commitSha: string;
    /** Base commit SHA for comparison */
    baseSha: string;
}
/**
 * Represents a comment to be posted via API
 */
export interface APIComment {
    /** Relative path to the file */
    filePath: string;
    /** Line number in the file */
    lineNumber: number;
    /** Comment content to post */
    content: string;
    /** Which side of the diff ('LEFT' for old, 'RIGHT' for new) */
    side: 'LEFT' | 'RIGHT';
}
/**
 * GitLab-specific position parameters for line comments
 */
export interface GitLabPosition {
    /** Path to the file before changes */
    old_path?: string;
    /** Path to the file after changes */
    new_path: string;
    /** Line number in the old version */
    old_line?: number;
    /** Line number in the new version */
    new_line: number;
}
/**
 * Response from GitHub API when creating a review comment
 */
export interface GitHubCommentResponse {
    /** Comment ID */
    id: number;
    /** Comment URL */
    url: string;
    /** Comment body */
    body: string;
    /** File path */
    path: string;
    /** Line number */
    line: number;
    /** Commit SHA */
    commit_id: string;
}
/**
 * Response from GitLab API when creating a discussion
 */
export interface GitLabDiscussionResponse {
    /** Discussion ID */
    id: string;
    /** Individual notes in the discussion */
    notes: Array<{
        /** Note ID */
        id: number;
        /** Note body */
        body: string;
        /** Author information */
        author: {
            /** Author name */
            name: string;
            /** Author username */
            username: string;
        };
    }>;
}
/**
 * Error types that can occur during GhostComment operations
 */
export declare enum GhostCommentErrorType {
    /** Configuration validation error */
    CONFIG_ERROR = "CONFIG_ERROR",
    /** File system operation error */
    FILE_ERROR = "FILE_ERROR",
    /** Git operation error */
    GIT_ERROR = "GIT_ERROR",
    /** GitHub API error */
    GITHUB_API_ERROR = "GITHUB_API_ERROR",
    /** GitLab API error */
    GITLAB_API_ERROR = "GITLAB_API_ERROR",
    /** Network/HTTP error */
    NETWORK_ERROR = "NETWORK_ERROR",
    /** Authentication error */
    AUTH_ERROR = "AUTH_ERROR",
    /** Rate limiting error */
    RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR"
}
/**
 * Custom error class for GhostComment operations
 */
export declare class GhostCommentError extends Error {
    readonly type: GhostCommentErrorType;
    readonly originalError?: Error | undefined;
    constructor(type: GhostCommentErrorType, message: string, originalError?: Error | undefined);
}
//# sourceMappingURL=comment.d.ts.map