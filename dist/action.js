/**
 * GitHub Action entry point for GhostComment
 */
import * as core from '@actions/core';
import * as github from '@actions/github';
import { scanFiles } from './core/scanner.js';
import { removeComments, DEFAULT_CLEAN_OPTIONS } from './core/cleaner.js';
import { loadConfig } from './core/config.js';
import { getPRContext } from './utils/git.js';
import { GitHubClient } from './clients/github.js';
import { GhostCommentError, GhostCommentErrorType, } from './models/comment.js';
/**
 * Parses boolean input from GitHub Actions
 */
function getBooleanInput(name, defaultValue = false) {
    const value = core.getInput(name);
    if (!value)
        return defaultValue;
    return value.toLowerCase() === 'true';
}
/**
 * Gets GitHub PR context from Actions environment
 */
function getGitHubActionsPRContext() {
    const context = github.context;
    if (context.eventName === 'pull_request' || context.eventName === 'pull_request_target') {
        const prNumber = context.payload.pull_request?.number;
        if (prNumber && context.repo.owner && context.repo.repo) {
            return {
                prNumber,
                owner: context.repo.owner,
                repo: context.repo.repo,
            };
        }
    }
    return null;
}
/**
 * Main action function
 */
async function run() {
    try {
        // Get inputs
        const githubToken = core.getInput('github-token', { required: true });
        const configPath = core.getInput('config-path') || undefined;
        const failOnFound = getBooleanInput('fail-on-found');
        const cleanMode = getBooleanInput('clean-mode', true);
        const dryRun = getBooleanInput('dry-run');
        const verbose = getBooleanInput('verbose');
        if (verbose) {
            core.info('🔍 Verbose mode enabled');
        }
        if (dryRun) {
            core.warning('🚧 Dry run mode - no changes will be made');
        }
        // Load configuration
        core.info('📋 Loading configuration...');
        const cliOptions = {
            config: configPath,
            verbose,
            dryRun,
        };
        const config = await loadConfig(cliOptions, process.cwd());
        if (verbose) {
            core.info(`Using prefix: ${config.prefix}`);
            core.info(`Include patterns: ${config.include.join(', ')}`);
            core.info(`Exclude patterns: ${config.exclude.join(', ')}`);
        }
        // Override config with Action inputs
        config.githubToken = githubToken;
        config.failOnFound = failOnFound;
        // Scan for ghost comments
        core.info('🔍 Scanning for ghost comments...');
        const comments = await scanFiles(config, process.cwd());
        core.setOutput('comments-found', comments.length.toString());
        if (comments.length === 0) {
            core.info('✅ No ghost comments found');
            return;
        }
        core.info(`📝 Found ${comments.length} ghost comments`);
        // Group comments by file for logging
        const commentsByFile = new Map();
        for (const comment of comments) {
            const existing = commentsByFile.get(comment.filePath) || [];
            existing.push(comment);
            commentsByFile.set(comment.filePath, existing);
        }
        if (verbose) {
            for (const [filePath, fileComments] of commentsByFile) {
                core.info(`📄 ${filePath}:`);
                for (const comment of fileComments) {
                    core.info(`  Line ${comment.lineNumber}: ${comment.content}`);
                }
            }
        }
        // Get PR context
        const actionsPRContext = getGitHubActionsPRContext();
        if (!actionsPRContext) {
            throw new Error('This action must be run on pull_request or pull_request_target events');
        }
        const gitContext = await getPRContext(process.cwd(), actionsPRContext.prNumber);
        core.info(`🎯 Target: ${gitContext.owner}/${gitContext.repo} #${gitContext.pullNumber}`);
        if (!dryRun) {
            // Post comments to GitHub
            core.info('💬 Posting comments to GitHub PR...');
            const githubClient = new GitHubClient({
                token: githubToken,
                debug: verbose,
            });
            // Skip connection test - proceed directly to posting comments
            core.info('🔗 GitHub client initialized');
            const postResult = await githubClient.postReviewComments(comments, gitContext);
            core.setOutput('comments-posted', postResult.posted.toString());
            core.setOutput('comments-skipped', postResult.skipped.toString());
            core.setOutput('comments-failed', postResult.failed.toString());
            if (postResult.failed > 0) {
                core.warning(`⚠️ Posted ${postResult.posted}, skipped ${postResult.skipped}, failed ${postResult.failed} comments`);
                // Log errors
                for (const error of postResult.errors) {
                    core.error(`Failed to post comment on ${error.comment.filePath}:${error.comment.lineNumber}: ${error.error}`);
                }
            }
            else {
                core.info(`✅ Posted ${postResult.posted} comments, skipped ${postResult.skipped}`);
            }
            // Clean ghost comments if enabled
            if (cleanMode) {
                core.info('🧹 Removing ghost comments from files...');
                const cleanOptions = {
                    ...DEFAULT_CLEAN_OPTIONS,
                    createBackups: false, // Don't create backups in CI
                    dryRun: false,
                };
                const cleanResult = await removeComments(comments, cleanOptions, process.cwd());
                core.setOutput('comments-cleaned', cleanResult.commentsRemoved.toString());
                if (cleanResult.hasErrors) {
                    core.warning(`⚠️ Cleaned ${cleanResult.commentsRemoved} comments with ${cleanResult.errorFiles.length} errors`);
                    for (const errorFile of cleanResult.errorFiles) {
                        core.error(`Failed to clean: ${errorFile}`);
                    }
                }
                else {
                    core.info(`✅ Cleaned ${cleanResult.commentsRemoved} comments from ${cleanResult.filesProcessed} files`);
                }
            }
            else {
                core.setOutput('comments-cleaned', '0');
                core.info('ℹ️ Clean mode disabled - ghost comments left in files');
            }
            // Fail if requested and comments found
            if (config.failOnFound && comments.length > 0) {
                core.setFailed(`Ghost comments found and fail-on-found is enabled (found: ${comments.length})`);
                return;
            }
            // Fail if there were posting errors
            if (postResult.failed > 0) {
                core.setFailed(`Failed to post ${postResult.failed} comments`);
                return;
            }
        }
        else {
            core.info('🚧 Dry run mode - would post the following comments:');
            for (const comment of comments) {
                core.info(`  ${comment.filePath}:${comment.lineNumber} - ${comment.content}`);
            }
            core.setOutput('comments-posted', '0');
            core.setOutput('comments-skipped', '0');
            core.setOutput('comments-failed', '0');
            core.setOutput('comments-cleaned', '0');
        }
    }
    catch (error) {
        let errorMessage = 'Unknown error occurred';
        if (error instanceof GhostCommentError) {
            errorMessage = `${error.type}: ${error.message}`;
            // Add specific guidance for common errors
            switch (error.type) {
                case GhostCommentErrorType.AUTH_ERROR:
                    errorMessage += '\nPlease check your GitHub token has the required permissions.';
                    break;
                case GhostCommentErrorType.CONFIG_ERROR:
                    errorMessage += '\nPlease check your configuration file and inputs.';
                    break;
                case GhostCommentErrorType.GIT_ERROR:
                    errorMessage += '\nPlease ensure this is running in a Git repository context.';
                    break;
            }
        }
        else if (error instanceof Error) {
            errorMessage = error.message;
        }
        core.setFailed(errorMessage);
        // Set error outputs
        core.setOutput('comments-found', '0');
        core.setOutput('comments-posted', '0');
        core.setOutput('comments-skipped', '0');
        core.setOutput('comments-failed', '0');
        core.setOutput('comments-cleaned', '0');
    }
}
// Only run if this file is being executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    void run();
}
export { run };
//# sourceMappingURL=action.js.map