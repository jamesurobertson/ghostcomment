/**
 * Core data structures for GhostComment tool
 */
/**
 * Error types that can occur during GhostComment operations
 */
export var GhostCommentErrorType;
(function (GhostCommentErrorType) {
    /** Configuration validation error */
    GhostCommentErrorType["CONFIG_ERROR"] = "CONFIG_ERROR";
    /** File system operation error */
    GhostCommentErrorType["FILE_ERROR"] = "FILE_ERROR";
    /** Git operation error */
    GhostCommentErrorType["GIT_ERROR"] = "GIT_ERROR";
    /** GitHub API error */
    GhostCommentErrorType["GITHUB_API_ERROR"] = "GITHUB_API_ERROR";
    /** GitLab API error */
    GhostCommentErrorType["GITLAB_API_ERROR"] = "GITLAB_API_ERROR";
    /** Network/HTTP error */
    GhostCommentErrorType["NETWORK_ERROR"] = "NETWORK_ERROR";
    /** Authentication error */
    GhostCommentErrorType["AUTH_ERROR"] = "AUTH_ERROR";
    /** Rate limiting error */
    GhostCommentErrorType["RATE_LIMIT_ERROR"] = "RATE_LIMIT_ERROR";
})(GhostCommentErrorType || (GhostCommentErrorType = {}));
/**
 * Custom error class for GhostComment operations
 */
export class GhostCommentError extends Error {
    constructor(type, message, originalError) {
        super(message);
        this.type = type;
        this.originalError = originalError;
        this.name = 'GhostCommentError';
    }
}
//# sourceMappingURL=comment.js.map