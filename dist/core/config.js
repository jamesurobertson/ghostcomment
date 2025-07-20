/**
 * Configuration loading and validation system
 */
import { promises as fs } from 'fs';
import { resolve, join } from 'path';
import { GhostCommentError, GhostCommentErrorType, } from '../models/comment.js';
import { DEFAULT_CONFIG, CONFIG_FILE_NAMES, PACKAGE_JSON_FIELD, GITHUB_ACTIONS_ENV, CONFIG_VALIDATION, } from '../models/config.js';
/**
 * Loads and parses a JSON file safely
 */
async function loadJsonFile(filePath) {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content);
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            return null; // File doesn't exist
        }
        throw new GhostCommentError(GhostCommentErrorType.CONFIG_ERROR, `Failed to parse JSON file ${filePath}: ${error.message}`, error);
    }
}
/**
 * Finds the first existing configuration file
 */
async function findConfigFile(workingDirectory, customPath) {
    if (customPath) {
        const resolvedPath = resolve(workingDirectory, customPath);
        try {
            await fs.access(resolvedPath, fs.constants.R_OK);
            return resolvedPath;
        }
        catch {
            throw new GhostCommentError(GhostCommentErrorType.CONFIG_ERROR, `Custom config file not found: ${resolvedPath}`);
        }
    }
    // Check standard config file names
    for (const fileName of CONFIG_FILE_NAMES) {
        const filePath = join(workingDirectory, fileName);
        try {
            await fs.access(filePath, fs.constants.R_OK);
            return filePath;
        }
        catch {
            // Continue to next file
        }
    }
    return null;
}
/**
 * Loads configuration from a config file
 */
async function loadConfigFile(workingDirectory, customPath) {
    const configPath = await findConfigFile(workingDirectory, customPath);
    if (!configPath) {
        return {}; // No config file found, return empty config
    }
    const config = await loadJsonFile(configPath);
    if (!config) {
        return {};
    }
    // Validate that config is an object
    if (typeof config !== 'object' || Array.isArray(config)) {
        throw new GhostCommentError(GhostCommentErrorType.CONFIG_ERROR, `Configuration file ${configPath} must contain a JSON object`);
    }
    return config;
}
/**
 * Loads configuration from package.json
 */
async function loadPackageJsonConfig(workingDirectory) {
    const packageJsonPath = join(workingDirectory, 'package.json');
    const packageJson = await loadJsonFile(packageJsonPath);
    if (!packageJson || !packageJson[PACKAGE_JSON_FIELD]) {
        return {};
    }
    const config = packageJson[PACKAGE_JSON_FIELD];
    if (typeof config !== 'object' || Array.isArray(config)) {
        throw new GhostCommentError(GhostCommentErrorType.CONFIG_ERROR, `package.json ${PACKAGE_JSON_FIELD} field must be an object`);
    }
    return config;
}
/**
 * Loads configuration from environment variables
 */
function loadEnvironmentConfig() {
    const env = {};
    // Standard environment variables
    if (process.env.GITHUB_TOKEN)
        env.GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    if (process.env.GITLAB_TOKEN)
        env.GITLAB_TOKEN = process.env.GITLAB_TOKEN;
    if (process.env.GITLAB_URL)
        env.GITLAB_URL = process.env.GITLAB_URL;
    // GhostComment-specific environment variables
    if (process.env.GC_CONFIG_PATH)
        env.GC_CONFIG_PATH = process.env.GC_CONFIG_PATH;
    if (process.env.GC_REPO_OWNER)
        env.GC_REPO_OWNER = process.env.GC_REPO_OWNER;
    if (process.env.GC_REPO_NAME)
        env.GC_REPO_NAME = process.env.GC_REPO_NAME;
    if (process.env.GC_PULL_NUMBER)
        env.GC_PULL_NUMBER = process.env.GC_PULL_NUMBER;
    if (process.env.GC_DEBUG)
        env.GC_DEBUG = process.env.GC_DEBUG;
    if (process.env.GC_DRY_RUN)
        env.GC_DRY_RUN = process.env.GC_DRY_RUN;
    return env;
}
/**
 * Detects if running in GitHub Actions environment
 */
function detectGitHubActions() {
    return Boolean(process.env[GITHUB_ACTIONS_ENV.GITHUB_ACTIONS] || process.env.CI);
}
/**
 * Loads GitHub Actions context
 */
function loadGitHubActionsContext() {
    if (!detectGitHubActions()) {
        return {};
    }
    const context = {};
    if (process.env[GITHUB_ACTIONS_ENV.GITHUB_TOKEN]) {
        context.GITHUB_TOKEN = process.env[GITHUB_ACTIONS_ENV.GITHUB_TOKEN];
    }
    // Extract repository info from GITHUB_REPOSITORY (format: owner/repo)
    const githubRepo = process.env[GITHUB_ACTIONS_ENV.GITHUB_REPOSITORY];
    if (githubRepo) {
        const [owner, repo] = githubRepo.split('/');
        if (owner && repo) {
            context.GC_REPO_OWNER = owner;
            context.GC_REPO_NAME = repo;
        }
    }
    return context;
}
/**
 * Validates a configuration object
 */
function validateConfig(config) {
    const errors = [];
    // Validate prefix
    if (config.prefix !== undefined) {
        if (typeof config.prefix !== 'string') {
            errors.push('prefix must be a string');
        }
        else if (config.prefix.length === 0) {
            errors.push('prefix cannot be empty');
        }
        else if (config.prefix.length > CONFIG_VALIDATION.MAX_PREFIX_LENGTH) {
            errors.push(`prefix too long (max: ${CONFIG_VALIDATION.MAX_PREFIX_LENGTH} characters)`);
        }
    }
    // Validate include patterns
    if (config.include !== undefined) {
        if (!Array.isArray(config.include)) {
            errors.push('include must be an array');
        }
        else {
            if (config.include.length === 0) {
                errors.push('include patterns cannot be empty');
            }
            if (config.include.length > CONFIG_VALIDATION.MAX_INCLUDE_PATTERNS) {
                errors.push(`too many include patterns (max: ${CONFIG_VALIDATION.MAX_INCLUDE_PATTERNS})`);
            }
            for (const pattern of config.include) {
                if (typeof pattern !== 'string') {
                    errors.push('all include patterns must be strings');
                    break;
                }
            }
        }
    }
    // Validate exclude patterns
    if (config.exclude !== undefined) {
        if (!Array.isArray(config.exclude)) {
            errors.push('exclude must be an array');
        }
        else {
            if (config.exclude.length > CONFIG_VALIDATION.MAX_EXCLUDE_PATTERNS) {
                errors.push(`too many exclude patterns (max: ${CONFIG_VALIDATION.MAX_EXCLUDE_PATTERNS})`);
            }
            for (const pattern of config.exclude) {
                if (typeof pattern !== 'string') {
                    errors.push('all exclude patterns must be strings');
                    break;
                }
            }
        }
    }
    // Validate failOnFound
    if (config.failOnFound !== undefined && typeof config.failOnFound !== 'boolean') {
        errors.push('failOnFound must be a boolean');
    }
    // Validate tokens
    if (config.githubToken !== undefined && typeof config.githubToken !== 'string') {
        errors.push('githubToken must be a string');
    }
    if (config.gitlabToken !== undefined && typeof config.gitlabToken !== 'string') {
        errors.push('gitlabToken must be a string');
    }
    if (config.gitlabUrl !== undefined) {
        if (typeof config.gitlabUrl !== 'string') {
            errors.push('gitlabUrl must be a string');
        }
        else {
            try {
                new URL(config.gitlabUrl);
            }
            catch {
                errors.push('gitlabUrl must be a valid URL');
            }
        }
    }
    if (errors.length > 0) {
        throw new GhostCommentError(GhostCommentErrorType.CONFIG_ERROR, `Configuration validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`);
    }
}
/**
 * Merges configuration objects with priority
 */
function mergeConfigs(...configs) {
    const merged = {};
    // Merge in reverse priority order (last config has highest priority)
    for (const config of configs) {
        if (config.prefix !== undefined)
            merged.prefix = config.prefix;
        if (config.include !== undefined)
            merged.include = [...config.include];
        if (config.exclude !== undefined)
            merged.exclude = [...config.exclude];
        if (config.failOnFound !== undefined)
            merged.failOnFound = config.failOnFound;
        if (config.githubToken !== undefined)
            merged.githubToken = config.githubToken;
        if (config.gitlabToken !== undefined)
            merged.gitlabToken = config.gitlabToken;
        if (config.gitlabUrl !== undefined)
            merged.gitlabUrl = config.gitlabUrl;
    }
    // Ensure all required fields are present
    return {
        prefix: merged.prefix ?? DEFAULT_CONFIG.prefix,
        include: merged.include ?? DEFAULT_CONFIG.include,
        exclude: merged.exclude ?? DEFAULT_CONFIG.exclude,
        failOnFound: merged.failOnFound ?? DEFAULT_CONFIG.failOnFound,
        githubToken: merged.githubToken,
        gitlabToken: merged.gitlabToken,
        gitlabUrl: merged.gitlabUrl,
    };
}
/**
 * Converts environment config to GhostCommentConfig format
 */
function environmentToConfig(env) {
    const config = {};
    if (env.GITHUB_TOKEN)
        config.githubToken = env.GITHUB_TOKEN;
    if (env.GITLAB_TOKEN)
        config.gitlabToken = env.GITLAB_TOKEN;
    if (env.GITLAB_URL)
        config.gitlabUrl = env.GITLAB_URL;
    // Convert boolean-like environment variables
    if (env.GC_DEBUG === 'true') {
        // Debug mode could affect logging, but it's not part of GhostCommentConfig
        // We'll handle this in the CLI layer
    }
    return config;
}
/**
 * Converts CLI options to GhostCommentConfig format
 */
function cliOptionsToConfig(options) {
    const config = {};
    if (options.token)
        config.githubToken = options.token;
    if (options.failOnFound !== undefined)
        config.failOnFound = options.failOnFound;
    return config;
}
/**
 * Loads complete configuration from all sources
 *
 * @param options - CLI options (highest priority)
 * @param workingDirectory - Directory to search for config files
 * @returns Promise resolving to complete configuration
 */
export async function loadConfig(options = {}, workingDirectory = process.cwd()) {
    try {
        // Load from all sources
        const defaultConfig = DEFAULT_CONFIG;
        const packageJsonConfig = await loadPackageJsonConfig(workingDirectory);
        const fileConfig = await loadConfigFile(workingDirectory, options.config);
        const envConfig = loadEnvironmentConfig();
        const githubActionsConfig = loadGitHubActionsContext();
        // Convert to common format
        const envConfigConverted = environmentToConfig({ ...envConfig, ...githubActionsConfig });
        const cliConfigConverted = cliOptionsToConfig(options);
        // Merge in priority order (lowest to highest priority)
        const finalConfig = mergeConfigs(defaultConfig, packageJsonConfig, fileConfig, envConfigConverted, cliConfigConverted);
        // Validate final configuration
        validateConfig(finalConfig);
        return finalConfig;
    }
    catch (error) {
        if (error instanceof GhostCommentError) {
            throw error;
        }
        throw new GhostCommentError(GhostCommentErrorType.CONFIG_ERROR, 'Failed to load configuration', error);
    }
}
/**
 * Validates configuration without loading from files
 *
 * @param config - Configuration object to validate
 * @returns Validation result
 */
export function validateConfigOnly(config) {
    try {
        validateConfig(config);
        return { valid: true, errors: [] };
    }
    catch (error) {
        if (error instanceof GhostCommentError) {
            return {
                valid: false,
                errors: error.message.split('\n').slice(1), // Remove first line (summary)
            };
        }
        return {
            valid: false,
            errors: [`Unexpected error: ${error.message}`],
        };
    }
}
/**
 * Creates a default configuration file
 *
 * @param workingDirectory - Directory to create config file in
 * @param fileName - Name of config file to create
 * @returns Promise resolving to path of created file
 */
export async function createDefaultConfigFile(workingDirectory = process.cwd(), fileName = CONFIG_FILE_NAMES[0]) {
    const configPath = join(workingDirectory, fileName);
    try {
        // Check if file already exists
        try {
            await fs.access(configPath);
            throw new GhostCommentError(GhostCommentErrorType.CONFIG_ERROR, `Configuration file already exists: ${configPath}`);
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                throw error; // Re-throw if it's not a "file not found" error
            }
        }
        // Create config with comments
        const configContent = {
            prefix: DEFAULT_CONFIG.prefix,
            include: DEFAULT_CONFIG.include,
            exclude: DEFAULT_CONFIG.exclude,
            failOnFound: DEFAULT_CONFIG.failOnFound,
        };
        const jsonContent = JSON.stringify(configContent, null, 2);
        await fs.writeFile(configPath, jsonContent, 'utf-8');
        return configPath;
    }
    catch (error) {
        if (error instanceof GhostCommentError) {
            throw error;
        }
        throw new GhostCommentError(GhostCommentErrorType.CONFIG_ERROR, `Failed to create config file: ${configPath}`, error);
    }
}
//# sourceMappingURL=config.js.map