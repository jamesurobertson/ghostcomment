/**
 * GitHub API client for posting review comments
 */
import { GhostComment, GitContext, GitHubCommentResponse } from '../models/comment.js';
/**
 * GitHub API client configuration
 */
export interface GitHubClientConfig {
    /** GitHub personal access token */
    token: string;
    /** Base URL for GitHub API (default: https://api.github.com) */
    baseURL?: string;
    /** Request timeout in milliseconds */
    timeout?: number;
    /** Maximum retry attempts */
    maxRetries?: number;
    /** Enable debug logging */
    debug?: boolean;
}
/**
 * Result of posting comments to GitHub
 */
export interface GitHubPostResult {
    /** Number of comments successfully posted */
    posted: number;
    /** Number of comments that failed */
    failed: number;
    /** Comments that were skipped (line not in diff) */
    skipped: number;
    /** Successfully posted comment details */
    success: GitHubCommentResponse[];
    /** Failed comment details */
    errors: Array<{
        comment: GhostComment;
        error: string;
        code?: string;
    }>;
}
/**
 * GitHub API client for posting review comments
 */
export declare class GitHubClient {
    private readonly client;
    private readonly config;
    constructor(config: GitHubClientConfig);
    /**
     * Tests the GitHub API connection and token validity
     */
    testConnection(): Promise<void>;
    /**
     * Gets pull request information
     */
    getPullRequest(context: GitContext): Promise<{
        number: number;
        head: {
            sha: string;
        };
        base: {
            sha: string;
        };
    }>;
    /**
     * Posts a single review comment with retry logic
     */
    private postSingleComment;
    /**
     * Converts ghost comments to API comments format
     */
    private convertToAPIComments;
    /**
     * Posts review comments to a GitHub pull request
     */
    postReviewComments(comments: GhostComment[], context: GitContext): Promise<GitHubPostResult>;
    /**
     * Lists existing review comments on a pull request
     */
    listReviewComments(context: GitContext): Promise<GitHubCommentResponse[]>;
    /**
     * Gets the rate limit status
     */
    getRateLimit(): Promise<{
        remaining: number;
        limit: number;
        reset: Date;
    }>;
}
//# sourceMappingURL=github.d.ts.map