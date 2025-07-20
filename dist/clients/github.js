/**
 * GitHub API client for posting review comments
 */
import axios from 'axios';
import { GhostCommentError, GhostCommentErrorType, } from '../models/comment.js';
import { RATE_LIMITS } from '../models/config.js';
/**
 * GitHub API client for posting review comments
 */
export class GitHubClient {
    constructor(config) {
        this.config = {
            baseURL: 'https://api.github.com',
            timeout: 30000,
            maxRetries: RATE_LIMITS.MAX_RETRY_ATTEMPTS,
            debug: false,
            ...config,
        };
        // Validate token
        if (!this.config.token) {
            throw new GhostCommentError(GhostCommentErrorType.AUTH_ERROR, 'GitHub token is required');
        }
        // Create axios instance
        this.client = axios.create({
            baseURL: this.config.baseURL,
            timeout: this.config.timeout,
            headers: {
                'Authorization': `Bearer ${this.config.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'GhostComment/1.0.0',
                'X-GitHub-Api-Version': '2022-11-28',
            },
        });
        // Add request interceptor for debugging
        if (this.config.debug) {
            this.client.interceptors.request.use(request => {
                console.log(`GitHub API Request: ${request.method?.toUpperCase()} ${request.url}`);
                return request;
            });
        }
        // Add response interceptor for debugging and error handling
        this.client.interceptors.response.use(response => {
            if (this.config.debug) {
                console.log(`GitHub API Response: ${response.status} ${response.statusText}`);
            }
            return response;
        }, error => {
            if (this.config.debug) {
                console.log(`GitHub API Error: ${error.response?.status} ${error.response?.statusText}`);
            }
            return Promise.reject(error);
        });
    }
    /**
     * Tests the GitHub API connection and token validity
     */
    async testConnection() {
        try {
            await this.client.get('/user');
        }
        catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 401) {
                    throw new GhostCommentError(GhostCommentErrorType.AUTH_ERROR, 'GitHub token is invalid or expired');
                }
                if (error.response?.status === 403) {
                    throw new GhostCommentError(GhostCommentErrorType.AUTH_ERROR, 'GitHub token does not have sufficient permissions');
                }
            }
            throw new GhostCommentError(GhostCommentErrorType.NETWORK_ERROR, 'Failed to connect to GitHub API', error);
        }
    }
    /**
     * Gets pull request information
     */
    async getPullRequest(context) {
        try {
            const response = await this.client.get(`/repos/${context.owner}/${context.repo}/pulls/${context.pullNumber}`);
            return {
                number: response.data.number,
                head: { sha: response.data.head.sha },
                base: { sha: response.data.base.sha },
            };
        }
        catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 404) {
                    throw new GhostCommentError(GhostCommentErrorType.GITHUB_API_ERROR, `Pull request #${context.pullNumber} not found in ${context.owner}/${context.repo}`);
                }
            }
            throw new GhostCommentError(GhostCommentErrorType.GITHUB_API_ERROR, `Failed to get pull request information`, error);
        }
    }
    /**
     * Posts a single review comment with retry logic
     */
    async postSingleComment(comment, context, attempt = 1) {
        try {
            const requestBody = {
                body: comment.content,
                commit_id: context.commitSha,
                path: comment.filePath,
                line: comment.lineNumber,
                side: comment.side,
            };
            if (this.config.debug) {
                console.log(`Posting comment to ${comment.filePath}:${comment.lineNumber}`);
            }
            const response = await this.client.post(`/repos/${context.owner}/${context.repo}/pulls/${context.pullNumber}/comments`, requestBody);
            return response.data;
        }
        catch (error) {
            if (axios.isAxiosError(error)) {
                const axiosError = error;
                // Handle specific error cases
                if (axiosError.response?.status === 422) {
                    // Line not in diff - this is expected and not an error
                    throw new GhostCommentError(GhostCommentErrorType.GITHUB_API_ERROR, `Line ${comment.lineNumber} not in diff for ${comment.filePath}`, undefined);
                }
                if (axiosError.response?.status === 403) {
                    // Rate limited
                    const resetTime = axiosError.response.headers['x-ratelimit-reset'];
                    const retryAfter = axiosError.response.headers['retry-after'];
                    if (resetTime || retryAfter) {
                        throw new GhostCommentError(GhostCommentErrorType.RATE_LIMIT_ERROR, `GitHub API rate limit exceeded. Reset at: ${resetTime || 'unknown'}`);
                    }
                }
                if (axiosError.response?.status === 401) {
                    throw new GhostCommentError(GhostCommentErrorType.AUTH_ERROR, 'GitHub token is invalid or expired');
                }
                // Retry on temporary errors
                if (attempt < this.config.maxRetries &&
                    (axiosError.response?.status === 500 ||
                        axiosError.response?.status === 502 ||
                        axiosError.response?.status === 503 ||
                        axiosError.response?.status === 504)) {
                    const delay = RATE_LIMITS.RETRY_BASE_DELAY * Math.pow(2, attempt - 1);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return this.postSingleComment(comment, context, attempt + 1);
                }
                // Format error message
                const errorData = axiosError.response?.data;
                let errorMessage = `HTTP ${axiosError.response?.status}: ${axiosError.response?.statusText}`;
                if (errorData?.message) {
                    errorMessage += ` - ${errorData.message}`;
                }
                if (errorData?.errors && errorData.errors.length > 0) {
                    const errorDetails = errorData.errors
                        .map(e => `${e.field}: ${e.code}`)
                        .join(', ');
                    errorMessage += ` (${errorDetails})`;
                }
                throw new GhostCommentError(GhostCommentErrorType.GITHUB_API_ERROR, errorMessage, error);
            }
            throw new GhostCommentError(GhostCommentErrorType.NETWORK_ERROR, 'Network error while posting comment', error);
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
     * Posts review comments to a GitHub pull request
     */
    async postReviewComments(comments, context) {
        if (comments.length === 0) {
            return {
                posted: 0,
                failed: 0,
                skipped: 0,
                success: [],
                errors: [],
            };
        }
        // Validate context has required fields
        if (!context.commitSha) {
            const prInfo = await this.getPullRequest(context);
            context.commitSha = prInfo.head.sha;
            if (!context.baseSha) {
                context.baseSha = prInfo.base.sha;
            }
        }
        const apiComments = this.convertToAPIComments(comments);
        const result = {
            posted: 0,
            failed: 0,
            skipped: 0,
            success: [],
            errors: [],
        };
        console.log(`Posting ${apiComments.length} comments to GitHub PR #${context.pullNumber}...`);
        // Post comments with rate limiting
        for (let i = 0; i < apiComments.length; i++) {
            const apiComment = apiComments[i];
            const originalComment = comments[i];
            if (!apiComment || !originalComment) {
                continue;
            }
            try {
                const response = await this.postSingleComment(apiComment, context);
                result.success.push(response);
                result.posted++;
                console.log(`✓ Posted comment on ${apiComment.filePath}:${apiComment.lineNumber}`);
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
                        console.error(`✗ Failed to post comment on ${apiComment.filePath}:${apiComment.lineNumber}: ${error.message}`);
                    }
                }
                else {
                    result.failed++;
                    result.errors.push({
                        comment: originalComment,
                        error: error.message,
                    });
                    console.error(`✗ Failed to post comment on ${apiComment.filePath}:${apiComment.lineNumber}: ${error.message}`);
                }
            }
            // Rate limiting delay between requests
            if (i < apiComments.length - 1) {
                await new Promise(resolve => setTimeout(resolve, RATE_LIMITS.GITHUB_REQUEST_DELAY));
            }
        }
        console.log(`GitHub posting complete: ${result.posted} posted, ${result.skipped} skipped, ${result.failed} failed`);
        return result;
    }
    /**
     * Lists existing review comments on a pull request
     */
    async listReviewComments(context) {
        try {
            const response = await this.client.get(`/repos/${context.owner}/${context.repo}/pulls/${context.pullNumber}/comments`);
            return response.data;
        }
        catch (error) {
            throw new GhostCommentError(GhostCommentErrorType.GITHUB_API_ERROR, 'Failed to list review comments', error);
        }
    }
    /**
     * Gets the rate limit status
     */
    async getRateLimit() {
        try {
            const response = await this.client.get('/rate_limit');
            const core = response.data.rate;
            return {
                remaining: core.remaining,
                limit: core.limit,
                reset: new Date(core.reset * 1000),
            };
        }
        catch (error) {
            throw new GhostCommentError(GhostCommentErrorType.GITHUB_API_ERROR, 'Failed to get rate limit status', error);
        }
    }
}
//# sourceMappingURL=github.js.map