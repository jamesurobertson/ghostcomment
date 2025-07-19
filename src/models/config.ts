/**
 * Configuration interfaces and defaults for GhostComment
 */

/**
 * Configuration file structure (.ghostcommentrc)
 */
export interface ConfigFile {
  /** Comment prefix to search for */
  prefix?: string;
  /** File patterns to include in scanning */
  include?: string[];
  /** File patterns to exclude from scanning */
  exclude?: string[];
  /** Whether to fail the process if ghost comments are found */
  failOnFound?: boolean;
}

/**
 * Environment variable configuration
 */
export interface EnvironmentConfig {
  /** GitHub token from environment */
  GITHUB_TOKEN?: string;
  /** GitLab token from environment */
  GITLAB_TOKEN?: string;
  /** GitLab URL from environment */
  GITLAB_URL?: string;
  /** Custom config path from environment */
  GC_CONFIG_PATH?: string;
  /** Repository owner override */
  GC_REPO_OWNER?: string;
  /** Repository name override */
  GC_REPO_NAME?: string;
  /** Pull request number override */
  GC_PULL_NUMBER?: string;
  /** Debug mode flag */
  GC_DEBUG?: string;
  /** Dry run mode flag */
  GC_DRY_RUN?: string;
}

/**
 * CLI command options
 */
export interface CLIOptions {
  /** Custom config file path */
  config?: string;
  /** GitHub token */
  token?: string;
  /** Repository in format 'owner/repo' */
  repo?: string;
  /** Pull request number */
  pr?: number;
  /** Dry run mode (don't make actual API calls) */
  dryRun?: boolean;
  /** Verbose/debug output */
  verbose?: boolean;
  /** Fail if ghost comments are found */
  failOnFound?: boolean;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Required<ConfigFile> = {
  prefix: '//_gc_',
  include: [
    '**/*.{js,ts,tsx,jsx}', // JavaScript/TypeScript
    '**/*.{py}', // Python
    '**/*.{go}', // Go
    '**/*.{rs}', // Rust
    '**/*.{java,kt}', // Java/Kotlin
    '**/*.{swift}', // Swift
    '**/*.{rb}', // Ruby
    '**/*.{php}', // PHP
    '**/*.{c,cpp,cc,cxx,h,hpp}', // C/C++
    '**/*.{cs}', // C#
  ],
  exclude: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/coverage/**',
    '**/*.min.js',
    '**/*.bundle.js',
    '**/vendor/**',
    '**/target/**', // Rust
    '**/bin/**',
    '**/obj/**', // C#
    '**/__pycache__/**', // Python
    '**/*.pyc',
    '**/venv/**',
    '**/env/**',
  ],
  failOnFound: false,
};

/**
 * Default file paths for configuration lookup
 */
export const CONFIG_FILE_NAMES = [
  '.ghostcommentrc',
  '.ghostcommentrc.json',
  '.ghostcomment.json',
] as const;

/**
 * Package.json configuration field name
 */
export const PACKAGE_JSON_FIELD = 'ghostcomment';

/**
 * Environment variable prefix
 */
export const ENV_PREFIX = 'GC_';

/**
 * GitHub Actions environment variables
 */
export const GITHUB_ACTIONS_ENV = {
  /** GitHub Actions flag */
  GITHUB_ACTIONS: 'GITHUB_ACTIONS',
  /** GitHub Actions workspace directory */
  GITHUB_WORKSPACE: 'GITHUB_WORKSPACE',
  /** GitHub repository in format 'owner/repo' */
  GITHUB_REPOSITORY: 'GITHUB_REPOSITORY',
  /** GitHub event that triggered the workflow */
  GITHUB_EVENT_NAME: 'GITHUB_EVENT_NAME',
  /** GitHub event payload path */
  GITHUB_EVENT_PATH: 'GITHUB_EVENT_PATH',
  /** GitHub API URL */
  GITHUB_API_URL: 'GITHUB_API_URL',
  /** GitHub token for Actions */
  GITHUB_TOKEN: 'GITHUB_TOKEN',
  /** GitHub SHA */
  GITHUB_SHA: 'GITHUB_SHA',
  /** GitHub ref */
  GITHUB_REF: 'GITHUB_REF',
} as const;

/**
 * Rate limiting configuration
 */
export const RATE_LIMITS = {
  /** GitHub API rate limit (requests per hour) */
  GITHUB_REQUESTS_PER_HOUR: 5000,
  /** Delay between GitHub API requests (ms) */
  GITHUB_REQUEST_DELAY: 100,
  /** GitLab API rate limit (varies by instance) */
  GITLAB_REQUESTS_PER_MINUTE: 600,
  /** Delay between GitLab API requests (ms) */
  GITLAB_REQUEST_DELAY: 100,
  /** Maximum retry attempts for API calls */
  MAX_RETRY_ATTEMPTS: 3,
  /** Exponential backoff base delay (ms) */
  RETRY_BASE_DELAY: 1000,
} as const;

/**
 * File size limits for scanning
 */
export const FILE_LIMITS = {
  /** Maximum file size to process (bytes) */
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  /** Maximum number of files to process in one run */
  MAX_FILES: 10000,
  /** Buffer size for file streaming (bytes) */
  STREAM_BUFFER_SIZE: 64 * 1024, // 64KB
} as const;

/**
 * Validation schema for configuration
 */
export const CONFIG_VALIDATION = {
  /** Valid prefix patterns */
  PREFIX_PATTERN: /^\/\/[_\w]*_$/,
  /** Maximum prefix length */
  MAX_PREFIX_LENGTH: 20,
  /** Maximum include patterns */
  MAX_INCLUDE_PATTERNS: 50,
  /** Maximum exclude patterns */
  MAX_EXCLUDE_PATTERNS: 100,
  /** Maximum comment content length */
  MAX_COMMENT_LENGTH: 1000,
} as const;