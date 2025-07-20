/**
 * GitLab API client for posting merge request discussions
 */
import axios from 'axios';
import { GhostCommentError, GhostCommentErrorType, } from '../models/comment.js';
import { RATE_LIMITS } from '../models/config.js';
/**
 * GitLab API client for posting merge request discussions
 */
export class GitLabClient {
    constructor(config) {
        this.config = {
            baseURL: 'https://gitlab.com',
            timeout: 30000,
            maxRetries: RATE_LIMITS.MAX_RETRY_ATTEMPTS,
            debug: false,
            ...config,
        };
        // Validate token
        if (!this.config.token) {
            throw new GhostCommentError(GhostCommentErrorType.AUTH_ERROR, 'GitLab token is required');
        }
        // Ensure baseURL ends with /api/v4
        let apiUrl = this.config.baseURL;
        if (!apiUrl.endsWith('/api/v4')) {
            if (!apiUrl.endsWith('/')) {
                apiUrl += '/';
            }
            apiUrl += 'api/v4';
        }
        // Create axios instance
        this.client = axios.create({
            baseURL: apiUrl,
            timeout: this.config.timeout,
            headers: {
                'Authorization': `Bearer ${this.config.token}`,
                'Content-Type': 'application/json',
                'User-Agent': 'GhostComment/1.0.0',
            },
        });
        // Add request interceptor for debugging
        if (this.config.debug) {
            this.client.interceptors.request.use(request => {
                console.log(`GitLab API Request: ${request.method?.toUpperCase()} ${request.url}`);
                return request;
            });
        }
        // Add response interceptor for debugging and error handling
        this.client.interceptors.response.use(response => {
            if (this.config.debug) {
                console.log(`GitLab API Response: ${response.status} ${response.statusText}`);
            }
            return response;
        }, error => {
            if (this.config.debug) {
                console.log(`GitLab API Error: ${error.response?.status} ${error.response?.statusText}`);
            }
            return Promise.reject(error);
        });
    }
    /**
     * Tests the GitLab API connection and token validity
     */
    async testConnection() {
        try {
            await this.client.get('/user');
        }
        catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 401) {
                    throw new GhostCommentError(GhostCommentErrorType.AUTH_ERROR, 'GitLab token is invalid or expired');
                }
                if (error.response?.status === 403) {
                    throw new GhostCommentError(GhostCommentErrorType.AUTH_ERROR, 'GitLab token does not have sufficient permissions');
                }
            }
            throw new GhostCommentError(GhostCommentErrorType.NETWORK_ERROR, 'Failed to connect to GitLab API', error);
        }
    }
    /**
     * Gets project ID from owner/repo format
     */
    async getProjectId(owner, repo) {
        try {
            const projectPath = `${owner}/${repo}`;
            const encodedPath = encodeURIComponent(projectPath);
            const response = await this.client.get(`/projects/${encodedPath}`);
            return response.data.id;
        }
        catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 404) {
                    throw new GhostCommentError(GhostCommentErrorType.GITLAB_API_ERROR, `Project ${owner}/${repo} not found`);
                }
            }
            throw new GhostCommentError(GhostCommentErrorType.GITLAB_API_ERROR, `Failed to get project ID for ${owner}/${repo}`, error);
        }
    }
    /**
     * Gets merge request information
     */
    async getMergeRequest(context) {
        try {
            const projectId = await this.getProjectId(context.owner, context.repo);
            const response = await this.client.get(`/projects/${projectId}/merge_requests/${context.pullNumber}`);
            return {
                id: response.data.id,
                iid: response.data.iid,
                project_id: projectId,
                sha: response.data.sha,
                merge_commit_sha: response.data.merge_commit_sha,
                source_branch: response.data.source_branch,
                target_branch: response.data.target_branch,
            };
        }
        catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 404) {
                    throw new GhostCommentError(GhostCommentErrorType.GITLAB_API_ERROR, `Merge request !${context.pullNumber} not found in ${context.owner}/${context.repo}`);
                }
            }
            throw new GhostCommentError(GhostCommentErrorType.GITLAB_API_ERROR, `Failed to get merge request information`, error);
        }
    }
    /**
     * Creates GitLab position object for line-specific discussions
     */
    createPosition(comment) {
        return {
            new_path: comment.filePath,
            old_path: comment.filePath, // Required by GitLab API
            new_line: comment.lineNumber,
            // old_line is omitted for new lines (side: 'RIGHT')
        };
    }
    /**
     * Posts a single discussion with retry logic
     */
    async postSingleDiscussion(comment, projectId, mrIid, attempt = 1) {
        try {
            const requestBody = {
                body: comment.content,
            };
            // Add position for line-specific comments
            if (comment.lineNumber > 0) {
                requestBody.position = this.createPosition(comment);
            }
            if (this.config.debug) {
                console.log(`Posting discussion to ${comment.filePath}:${comment.lineNumber}`);
            }
            const response = await this.client.post(`/projects/${projectId}/merge_requests/${mrIid}/discussions`, requestBody);
            return response.data;
        }
        catch (error) {
            if (axios.isAxiosError(error)) {
                const axiosError = error;
                // Handle specific error cases
                if (axiosError.response?.status === 400) {
                    // Bad request - might be line not in diff
                    const errorMessage = Array.isArray(axiosError.response.data?.message)
                        ? axiosError.response.data.message.join(', ')
                        : axiosError.response.data?.message || 'Bad request';
                    if (errorMessage.includes('line') || errorMessage.includes('position')) {
                        throw new GhostCommentError(GhostCommentErrorType.GITLAB_API_ERROR, `Line ${comment.lineNumber} not in diff for ${comment.filePath}`, undefined);
                    }
                }
                if (axiosError.response?.status === 429) {
                    throw new GhostCommentError(GhostCommentErrorType.RATE_LIMIT_ERROR, 'GitLab API rate limit exceeded');
                }
                if (axiosError.response?.status === 401) {
                    throw new GhostCommentError(GhostCommentErrorType.AUTH_ERROR, 'GitLab token is invalid or expired');
                }
                if (axiosError.response?.status === 403) {
                    throw new GhostCommentError(GhostCommentErrorType.AUTH_ERROR, 'Insufficient permissions to post to this merge request');
                }
                // Retry on temporary errors
                if (attempt < this.config.maxRetries &&
                    (axiosError.response?.status === 500 ||
                        axiosError.response?.status === 502 ||
                        axiosError.response?.status === 503 ||
                        axiosError.response?.status === 504)) {
                    const delay = RATE_LIMITS.RETRY_BASE_DELAY * Math.pow(2, attempt - 1);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return this.postSingleDiscussion(comment, projectId, mrIid, attempt + 1);
                }
                // Format error message
                const errorData = axiosError.response?.data;
                let errorMessage = `HTTP ${axiosError.response?.status}: ${axiosError.response?.statusText}`;
                if (errorData?.message) {
                    const message = Array.isArray(errorData.message)
                        ? errorData.message.join(', ')
                        : errorData.message;
                    errorMessage += ` - ${message}`;
                }
                throw new GhostCommentError(GhostCommentErrorType.GITLAB_API_ERROR, errorMessage, error);
            }
            throw new GhostCommentError(GhostCommentErrorType.NETWORK_ERROR, 'Network error while posting discussion', error);
        }
    }
    /**
     * Converts ghost comments to API comments format
     */
    convertToAPIComments(comments) {
        return comments.map(comment => ({
            filePath: comment.filePath,
            lineNumber: comment.lineNumber,
            content: `🧩 _${comment.content}_`,
            side: 'RIGHT',
        }));
    }
    /**
     * Posts discussions to a GitLab merge request
     */
    async postDiscussions(comments, context) {
        if (comments.length === 0) {
            return {
                posted: 0,
                failed: 0,
                skipped: 0,
                success: [],
                errors: [],
            };
        }
        // Get merge request information
        const mrInfo = await this.getMergeRequest(context);
        // Update context with actual commit SHA if needed
        if (!context.commitSha) {
            context.commitSha = mrInfo.sha;
        }
        const apiComments = this.convertToAPIComments(comments);
        const result = {
            posted: 0,
            failed: 0,
            skipped: 0,
            success: [],
            errors: [],
        };
        console.log(`Posting ${apiComments.length} discussions to GitLab MR !${context.pullNumber}...`);
        // Post discussions with rate limiting
        for (let i = 0; i < apiComments.length; i++) {
            const apiComment = apiComments[i];
            const originalComment = comments[i];
            if (!apiComment || !originalComment) {
                continue;
            }
            try {
                const response = await this.postSingleDiscussion(apiComment, mrInfo.project_id, mrInfo.iid);
                result.success.push(response);
                result.posted++;
                console.log(`✓ Posted discussion on ${apiComment.filePath}:${apiComment.lineNumber}`);
            }
            catch (error) {
                if (error instanceof GhostCommentError) {
                    if (error.message.includes('not in diff')) {
                        result.skipped++;
                        console.log(`⚠ Skipped ${apiComment.filePath}:${apiComment.lineNumber} - line not in diff`);
                    }
                    else {
                        result.failed++;
                        result.errors.push({
                            comment: originalComment,
                            error: error.message,
                            code: error.type,
                        });
                        console.error(`✗ Failed to post discussion on ${apiComment.filePath}:${apiComment.lineNumber}: ${error.message}`);
                    }
                }
                else {
                    result.failed++;
                    result.errors.push({
                        comment: originalComment,
                        error: error.message,
                    });
                    console.error(`✗ Failed to post discussion on ${apiComment.filePath}:${apiComment.lineNumber}: ${error.message}`);
                }
            }
            // Rate limiting delay between requests
            if (i < apiComments.length - 1) {
                await new Promise(resolve => setTimeout(resolve, RATE_LIMITS.GITLAB_REQUEST_DELAY));
            }
        }
        console.log(`GitLab posting complete: ${result.posted} posted, ${result.skipped} skipped, ${result.failed} failed`);
        return result;
    }
    /**
     * Lists existing discussions on a merge request
     */
    async listDiscussions(context) {
        try {
            const projectId = await this.getProjectId(context.owner, context.repo);
            const response = await this.client.get(`/projects/${projectId}/merge_requests/${context.pullNumber}/discussions`);
            return response.data;
        }
        catch (error) {
            throw new GhostCommentError(GhostCommentErrorType.GITLAB_API_ERROR, 'Failed to list merge request discussions', error);
        }
    }
}
//# sourceMappingURL=gitlab.js.map