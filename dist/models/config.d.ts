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
export declare const DEFAULT_CONFIG: Required<ConfigFile>;
/**
 * Default file paths for configuration lookup
 */
export declare const CONFIG_FILE_NAMES: readonly [".ghostcommentrc", ".ghostcommentrc.json", ".ghostcomment.json"];
/**
 * Package.json configuration field name
 */
export declare const PACKAGE_JSON_FIELD = "ghostcomment";
/**
 * Environment variable prefix
 */
export declare const ENV_PREFIX = "GC_";
/**
 * GitHub Actions environment variables
 */
export declare const GITHUB_ACTIONS_ENV: {
    /** GitHub Actions flag */
    readonly GITHUB_ACTIONS: "GITHUB_ACTIONS";
    /** GitHub Actions workspace directory */
    readonly GITHUB_WORKSPACE: "GITHUB_WORKSPACE";
    /** GitHub repository in format 'owner/repo' */
    readonly GITHUB_REPOSITORY: "GITHUB_REPOSITORY";
    /** GitHub event that triggered the workflow */
    readonly GITHUB_EVENT_NAME: "GITHUB_EVENT_NAME";
    /** GitHub event payload path */
    readonly GITHUB_EVENT_PATH: "GITHUB_EVENT_PATH";
    /** GitHub API URL */
    readonly GITHUB_API_URL: "GITHUB_API_URL";
    /** GitHub token for Actions */
    readonly GITHUB_TOKEN: "GITHUB_TOKEN";
    /** GitHub SHA */
    readonly GITHUB_SHA: "GITHUB_SHA";
    /** GitHub ref */
    readonly GITHUB_REF: "GITHUB_REF";
};
/**
 * Rate limiting configuration
 */
export declare const RATE_LIMITS: {
    /** GitHub API rate limit (requests per hour) */
    readonly GITHUB_REQUESTS_PER_HOUR: 5000;
    /** Delay between GitHub API requests (ms) */
    readonly GITHUB_REQUEST_DELAY: 100;
    /** GitLab API rate limit (varies by instance) */
    readonly GITLAB_REQUESTS_PER_MINUTE: 600;
    /** Delay between GitLab API requests (ms) */
    readonly GITLAB_REQUEST_DELAY: 100;
    /** Maximum retry attempts for API calls */
    readonly MAX_RETRY_ATTEMPTS: 3;
    /** Exponential backoff base delay (ms) */
    readonly RETRY_BASE_DELAY: 1000;
};
/**
 * File size limits for scanning
 */
export declare const FILE_LIMITS: {
    /** Maximum file size to process (bytes) */
    readonly MAX_FILE_SIZE: number;
    /** Maximum number of files to process in one run */
    readonly MAX_FILES: 10000;
    /** Buffer size for file streaming (bytes) */
    readonly STREAM_BUFFER_SIZE: number;
};
/**
 * Validation schema for configuration
 */
export declare const CONFIG_VALIDATION: {
    /** Valid prefix patterns */
    readonly PREFIX_PATTERN: RegExp;
    /** Maximum prefix length */
    readonly MAX_PREFIX_LENGTH: 20;
    /** Maximum include patterns */
    readonly MAX_INCLUDE_PATTERNS: 50;
    /** Maximum exclude patterns */
    readonly MAX_EXCLUDE_PATTERNS: 100;
    /** Maximum comment content length */
    readonly MAX_COMMENT_LENGTH: 1000;
};
//# sourceMappingURL=config.d.ts.map