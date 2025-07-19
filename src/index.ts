/**
 * GhostComment - Extract and post developer-to-reviewer comments
 * Main library exports for programmatic usage
 */

// Core functionality
export { scanFiles, scanSingleFile, countGhostComments } from './core/scanner.js';
export { removeComments, validateCommentsForCleaning, DEFAULT_CLEAN_OPTIONS } from './core/cleaner.js';
export { loadConfig, validateConfigOnly, createDefaultConfigFile } from './core/config.js';

// API clients
export { GitHubClient } from './clients/github.js';
export { GitLabClient } from './clients/gitlab.js';

// Git utilities
export {
  isGitRepository,
  getCurrentCommit,
  getCurrentBranch,
  getRepositoryInfo,
  getPRContext,
  getDiffFiles,
  getMergeBase,
  validateCleanWorkingDirectory,
} from './utils/git.js';

// Type definitions
export type {
  GhostComment,
  GhostCommentConfig,
  GitContext,
  APIComment,
  GitHubCommentResponse,
  GitLabDiscussionResponse,
  GitLabPosition,
} from './models/comment.js';

export type {
  ConfigFile,
  EnvironmentConfig,
  CLIOptions,
} from './models/config.js';

export type { CleanResult, CleanOptions } from './core/cleaner.js';
export type { GitHubClientConfig, GitHubPostResult } from './clients/github.js';
export type { GitLabClientConfig, GitLabPostResult } from './clients/gitlab.js';
export type { GitRepository, PullRequestInfo } from './utils/git.js';

// Error classes
export { GhostCommentError, GhostCommentErrorType } from './models/comment.js';

// Constants
export {
  DEFAULT_CONFIG,
  CONFIG_FILE_NAMES,
  PACKAGE_JSON_FIELD,
  ENV_PREFIX,
  GITHUB_ACTIONS_ENV,
  RATE_LIMITS,
  FILE_LIMITS,
  CONFIG_VALIDATION,
} from './models/config.js';

// CLI (for programmatic usage)
export { createCLI, main } from './cli.js';