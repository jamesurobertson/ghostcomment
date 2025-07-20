/**
 * GhostComment - Extract and post developer-to-reviewer comments
 * Main library exports for programmatic usage
 */
export { scanFiles, scanSingleFile, countGhostComments } from './core/scanner.js';
export { removeComments, validateCommentsForCleaning, DEFAULT_CLEAN_OPTIONS } from './core/cleaner.js';
export { loadConfig, validateConfigOnly, createDefaultConfigFile } from './core/config.js';
export { GitHubClient } from './clients/github.js';
export { GitLabClient } from './clients/gitlab.js';
export { isGitRepository, getCurrentCommit, getCurrentBranch, getRepositoryInfo, getPRContext, getDiffFiles, getMergeBase, validateCleanWorkingDirectory, } from './utils/git.js';
export type { GhostComment, GhostCommentConfig, GitContext, APIComment, GitHubCommentResponse, GitLabDiscussionResponse, GitLabPosition, } from './models/comment.js';
export type { ConfigFile, EnvironmentConfig, CLIOptions, } from './models/config.js';
export type { CleanResult, CleanOptions } from './core/cleaner.js';
export type { GitHubClientConfig, GitHubPostResult } from './clients/github.js';
export type { GitLabClientConfig, GitLabPostResult } from './clients/gitlab.js';
export type { GitRepository, PullRequestInfo } from './utils/git.js';
export { GhostCommentError, GhostCommentErrorType } from './models/comment.js';
export { DEFAULT_CONFIG, CONFIG_FILE_NAMES, PACKAGE_JSON_FIELD, ENV_PREFIX, GITHUB_ACTIONS_ENV, RATE_LIMITS, FILE_LIMITS, CONFIG_VALIDATION, } from './models/config.js';
export { createCLI, main } from './cli.js';
//# sourceMappingURL=index.d.ts.map