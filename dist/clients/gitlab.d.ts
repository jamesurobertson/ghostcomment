/**
 * GitLab API client for posting merge request discussions
 */
import { GhostComment, GitContext, GitLabDiscussionResponse } from '../models/comment.js';
/**
 * GitLab API client configuration
 */
export interface GitLabClientConfig {
    /** GitLab personal access token */
    token: string;
    /** GitLab instance URL (default: https://gitlab.com) */
    baseURL?: string;
    /** Request timeout in milliseconds */
    timeout?: number;
    /** Maximum retry attempts */
    maxRetries?: number;
    /** Enable debug logging */
    debug?: boolean;
}
/**
 * GitLab merge request information
 */
interface GitLabMergeRequest {
    id: number;
    iid: number;
    project_id: number;
    sha: string;
    merge_commit_sha?: string;
    source_branch: string;
    target_branch: string;
}
/**
 * Result of posting discussions to GitLab
 */
export interface GitLabPostResult {
    /** Number of discussions successfully posted */
    posted: number;
    /** Number of discussions that failed */
    failed: number;
    /** Number of discussions that were skipped */
    skipped: number;
    /** Successfully posted discussion details */
    success: GitLabDiscussionResponse[];
    /** Failed discussion details */
    errors: Array<{
        comment: GhostComment;
        error: string;
        code?: string;
    }>;
}
/**
 * GitLab API client for posting merge request discussions
 */
export declare class GitLabClient {
    private readonly client;
    private readonly config;
    constructor(config: GitLabClientConfig);
    /**
     * Tests the GitLab API connection and token validity
     */
    testConnection(): Promise<void>;
    /**
     * Gets project ID from owner/repo format
     */
    private getProjectId;
    /**
     * Gets merge request information
     */
    getMergeRequest(context: GitContext): Promise<GitLabMergeRequest>;
    /**
     * Creates GitLab position object for line-specific discussions
     */
    private createPosition;
    /**
     * Posts a single discussion with retry logic
     */
    private postSingleDiscussion;
    /**
     * Converts ghost comments to API comments format
     */
    private convertToAPIComments;
    /**
     * Posts discussions to a GitLab merge request
     */
    postDiscussions(comments: GhostComment[], context: GitContext): Promise<GitLabPostResult>;
    /**
     * Lists existing discussions on a merge request
     */
    listDiscussions(context: GitContext): Promise<GitLabDiscussionResponse[]>;
}
export {};
//# sourceMappingURL=gitlab.d.ts.map