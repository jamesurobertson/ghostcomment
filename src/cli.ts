#!/usr/bin/env node

/**
 * GhostComment CLI - Extract and post developer-to-reviewer comments
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { scanFiles, countGhostComments } from './core/scanner.js';
import { removeComments, validateCommentsForCleaning, DEFAULT_CLEAN_OPTIONS } from './core/cleaner.js';
import { loadConfig, createDefaultConfigFile } from './core/config.js';
import { getPRContext, isGitRepository } from './utils/git.js';
import { GitHubClient } from './clients/github.js';
import { GitLabClient } from './clients/gitlab.js';
import {
  GhostCommentError,
  GhostCommentErrorType,
  GitContext,
} from './models/comment.js';
import { CLIOptions } from './models/config.js';

/**
 * Global CLI state
 */
interface CLIState {
  verbose: boolean;
  dryRun: boolean;
  workingDirectory: string;
}

let cliState: CLIState = {
  verbose: false,
  dryRun: false,
  workingDirectory: process.cwd(),
};

/**
 * Logging utilities
 */
const log = {
  info: (message: string): void => {
    console.log(chalk.blue('ℹ'), message);
  },
  success: (message: string): void => {
    console.log(chalk.green('✓'), message);
  },
  warning: (message: string): void => {
    console.log(chalk.yellow('⚠'), message);
  },
  error: (message: string): void => {
    console.error(chalk.red('✗'), message);
  },
  debug: (message: string): void => {
    if (cliState.verbose) {
      console.log(chalk.gray('🔍'), chalk.gray(message));
    }
  },
  plain: (message: string): void => {
    console.log(message);
  },
};

/**
 * Shows a spinner-like progress indicator
 */
function showProgress(message: string): () => void {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let frameIndex = 0;
  
  process.stdout.write(`${chalk.cyan(frames[frameIndex])} ${message}`);
  
  const interval = setInterval(() => {
    frameIndex = (frameIndex + 1) % frames.length;
    process.stdout.write(`\r${chalk.cyan(frames[frameIndex])} ${message}`);
  }, 80);
  
  return () => {
    clearInterval(interval);
    process.stdout.write('\r' + ' '.repeat(message.length + 2) + '\r');
  };
}

/**
 * Handles CLI errors with proper exit codes
 */
function handleError(error: Error): never {
  if (error instanceof GhostCommentError) {
    switch (error.type) {
      case GhostCommentErrorType.CONFIG_ERROR:
        log.error(`Configuration error: ${error.message}`);
        process.exit(1);
      case GhostCommentErrorType.FILE_ERROR:
        log.error(`File error: ${error.message}`);
        process.exit(2);
      case GhostCommentErrorType.GIT_ERROR:
        log.error(`Git error: ${error.message}`);
        process.exit(3);
      case GhostCommentErrorType.GITHUB_API_ERROR:
        log.error(`GitHub API error: ${error.message}`);
        process.exit(4);
      case GhostCommentErrorType.GITLAB_API_ERROR:
        log.error(`GitLab API error: ${error.message}`);
        process.exit(5);
      case GhostCommentErrorType.AUTH_ERROR:
        log.error(`Authentication error: ${error.message}`);
        process.exit(6);
      case GhostCommentErrorType.RATE_LIMIT_ERROR:
        log.error(`Rate limit error: ${error.message}`);
        process.exit(7);
      case GhostCommentErrorType.NETWORK_ERROR:
        log.error(`Network error: ${error.message}`);
        process.exit(8);
      default:
        log.error(`Unknown error: ${error.message}`);
        process.exit(99);
    }
  }
  
  log.error(`Unexpected error: ${error.message}`);
  if (cliState.verbose && error.stack) {
    console.error(chalk.gray(error.stack));
  }
  process.exit(1);
}

/**
 * Validates that we're in a Git repository
 */
async function validateGitRepository(): Promise<void> {
  if (!(await isGitRepository(cliState.workingDirectory))) {
    throw new GhostCommentError(
      GhostCommentErrorType.GIT_ERROR,
      'Current directory is not a Git repository'
    );
  }
}

/**
 * Gets Git context for PR operations
 */
async function getGitContext(options: { pr?: number; repo?: string }): Promise<GitContext> {
  let context: GitContext;
  
  if (options.repo && options.pr) {
    // Manual specification
    const [owner, repo] = options.repo.split('/');
    if (!owner || !repo) {
      throw new GhostCommentError(
        GhostCommentErrorType.CONFIG_ERROR,
        'Repository must be in format "owner/repo"'
      );
    }
    
    context = {
      owner,
      repo,
      pullNumber: options.pr,
      commitSha: '', // Will be filled by API clients
      baseSha: '',
    };
  } else {
    // Auto-detect from Git
    context = await getPRContext(cliState.workingDirectory, options.pr);
  }
  
  return context;
}

/**
 * Scan command - finds ghost comments in files
 */
async function scanCommand(options: {
  config?: string;
  count?: boolean;
}): Promise<void> {
  try {
    const stopProgress = showProgress('Loading configuration...');
    
    const cliOptions: CLIOptions = {
      config: options.config,
      verbose: cliState.verbose,
      dryRun: cliState.dryRun,
    };
    
    const config = await loadConfig(cliOptions, cliState.workingDirectory);
    stopProgress();
    
    log.debug(`Using prefix: ${config.prefix}`);
    log.debug(`Include patterns: ${config.include.join(', ')}`);
    log.debug(`Exclude patterns: ${config.exclude.join(', ')}`);
    
    if (options.count) {
      const stopCountProgress = showProgress('Counting ghost comments...');
      const count = await countGhostComments(config, cliState.workingDirectory);
      stopCountProgress();
      
      if (count === 0) {
        log.success('No ghost comments found');
      } else {
        log.info(`Found ${chalk.bold(count.toString())} ghost comments`);
      }
      
      if (config.failOnFound && count > 0) {
        process.exit(1);
      }
      return;
    }
    
    const stopScanProgress = showProgress('Scanning for ghost comments...');
    const comments = await scanFiles(config, cliState.workingDirectory);
    stopScanProgress();
    
    if (comments.length === 0) {
      log.success('No ghost comments found');
      return;
    }
    
    log.info(`Found ${chalk.bold(comments.length.toString())} ghost comments:`);
    console.log();
    
    // Group comments by file for better display
    const commentsByFile = new Map<string, typeof comments>();
    for (const comment of comments) {
      const existing = commentsByFile.get(comment.filePath) || [];
      existing.push(comment);
      commentsByFile.set(comment.filePath, existing);
    }
    
    for (const [filePath, fileComments] of commentsByFile) {
      console.log(chalk.cyan(filePath));
      for (const comment of fileComments) {
        console.log(`  ${chalk.gray(`Line ${comment.lineNumber}:`)} ${comment.content}`);
      }
      console.log();
    }
    
    if (config.failOnFound) {
      log.error('Ghost comments found and failOnFound is enabled');
      process.exit(1);
    }
  } catch (error) {
    handleError(error as Error);
  }
}

/**
 * Clean command - removes ghost comments from files
 */
async function cleanCommand(options: {
  config?: string;
  backup?: boolean;
  force?: boolean;
}): Promise<void> {
  try {
    const stopProgress = showProgress('Loading configuration...');
    
    const cliOptions: CLIOptions = {
      config: options.config,
      verbose: cliState.verbose,
      dryRun: cliState.dryRun,
    };
    
    const config = await loadConfig(cliOptions, cliState.workingDirectory);
    stopProgress();
    
    const stopScanProgress = showProgress('Scanning for ghost comments...');
    const comments = await scanFiles(config, cliState.workingDirectory);
    stopScanProgress();
    
    if (comments.length === 0) {
      log.success('No ghost comments found to clean');
      return;
    }
    
    log.info(`Found ${comments.length} ghost comments to remove`);
    
    // Validate comments can be safely removed
    if (!options.force) {
      const stopValidateProgress = showProgress('Validating comments...');
      const validation = await validateCommentsForCleaning(comments, cliState.workingDirectory);
      stopValidateProgress();
      
      if (!validation.valid) {
        log.error('Cannot safely remove comments:');
        for (const error of validation.errors) {
          log.error(`  ${error}`);
        }
        process.exit(1);
      }
    }
    
    if (cliState.dryRun) {
      log.info('DRY RUN: Would remove the following comments:');
      for (const comment of comments) {
        console.log(`  ${chalk.cyan(comment.filePath)}:${comment.lineNumber} - ${comment.content}`);
      }
      return;
    }
    
    const cleanOptions = {
      ...DEFAULT_CLEAN_OPTIONS,
      createBackups: options.backup !== false,
      dryRun: cliState.dryRun,
    };
    
    const stopCleanProgress = showProgress('Removing ghost comments...');
    const result = await removeComments(comments, cleanOptions, cliState.workingDirectory);
    stopCleanProgress();
    
    if (result.hasErrors) {
      log.warning(`Removed ${result.commentsRemoved} comments from ${result.filesProcessed} files with ${result.errorFiles.length} errors`);
      for (const errorFile of result.errorFiles) {
        log.error(`  Failed to clean: ${errorFile}`);
      }
      process.exit(1);
    } else {
      log.success(`Removed ${result.commentsRemoved} comments from ${result.filesProcessed} files`);
      
      if (cleanOptions.createBackups) {
        log.info(`Backup files created (use --no-backup to skip)`);
      }
    }
  } catch (error) {
    handleError(error as Error);
  }
}

/**
 * Comment command - posts comments to GitHub/GitLab
 */
async function commentCommand(options: {
  config?: string;
  token?: string;
  repo?: string;
  pr?: number;
  platform?: 'github' | 'gitlab';
  gitlab?: string;
}): Promise<void> {
  try {
    await validateGitRepository();
    
    const stopProgress = showProgress('Loading configuration...');
    
    const cliOptions: CLIOptions = {
      config: options.config,
      token: options.token,
      repo: options.repo,
      pr: options.pr,
      verbose: cliState.verbose,
      dryRun: cliState.dryRun,
    };
    
    const config = await loadConfig(cliOptions, cliState.workingDirectory);
    stopProgress();
    
    // Auto-detect platform if not specified
    let platform = options.platform;
    if (!platform) {
      platform = config.gitlabToken ? 'gitlab' : 'github';
    }
    
    // Validate tokens
    const token = platform === 'gitlab' ? config.gitlabToken : config.githubToken;
    if (!token) {
      throw new GhostCommentError(
        GhostCommentErrorType.AUTH_ERROR,
        `${platform === 'gitlab' ? 'GitLab' : 'GitHub'} token is required. Set via --token or environment variable.`
      );
    }
    
    const stopScanProgress = showProgress('Scanning for ghost comments...');
    const comments = await scanFiles(config, cliState.workingDirectory);
    stopScanProgress();
    
    if (comments.length === 0) {
      log.success('No ghost comments found to post');
      return;
    }
    
    log.info(`Found ${comments.length} ghost comments to post`);
    
    const context = await getGitContext(options);
    log.debug(`Target: ${context.owner}/${context.repo} ${platform === 'gitlab' ? '!' : '#'}${context.pullNumber}`);
    
    if (cliState.dryRun) {
      log.info('DRY RUN: Would post the following comments:');
      for (const comment of comments) {
        console.log(`  ${chalk.cyan(comment.filePath)}:${comment.lineNumber} - ${comment.content}`);
      }
      return;
    }
    
    if (platform === 'gitlab') {
      const client = new GitLabClient({
        token: token!,
        baseURL: options.gitlab || config.gitlabUrl,
        debug: cliState.verbose,
      });
      
      const stopTestProgress = showProgress('Testing GitLab connection...');
      await client.testConnection();
      stopTestProgress();
      log.success('GitLab connection successful');
      
      const result = await client.postDiscussions(comments, context);
      
      if (result.failed > 0) {
        log.warning(`Posted ${result.posted}, skipped ${result.skipped}, failed ${result.failed} discussions`);
        process.exit(1);
      } else {
        log.success(`Posted ${result.posted} discussions, skipped ${result.skipped}`);
      }
    } else {
      const client = new GitHubClient({
        token: token!,
        debug: cliState.verbose,
      });
      
      const stopTestProgress = showProgress('Testing GitHub connection...');
      await client.testConnection();
      stopTestProgress();
      log.success('GitHub connection successful');
      
      const result = await client.postReviewComments(comments, context);
      
      if (result.failed > 0) {
        log.warning(`Posted ${result.posted}, skipped ${result.skipped}, failed ${result.failed} comments`);
        process.exit(1);
      } else {
        log.success(`Posted ${result.posted} comments, skipped ${result.skipped}`);
      }
    }
  } catch (error) {
    handleError(error as Error);
  }
}

/**
 * Config command - manages configuration
 */
async function configCommand(
  action: string,
  options: {
    file?: string;
  }
): Promise<void> {
  try {
    switch (action) {
      case 'init':
        {
          const fileName = options.file || '.ghostcommentrc';
          const stopProgress = showProgress(`Creating ${fileName}...`);
          const configPath = await createDefaultConfigFile(cliState.workingDirectory, fileName);
          stopProgress();
          log.success(`Created configuration file: ${configPath}`);
        }
        break;
        
      case 'show':
        {
          const stopProgress = showProgress('Loading configuration...');
          const config = await loadConfig({}, cliState.workingDirectory);
          stopProgress();
          
          console.log(chalk.bold('Current configuration:'));
          console.log(JSON.stringify({
            prefix: config.prefix,
            include: config.include,
            exclude: config.exclude,
            failOnFound: config.failOnFound,
            // Don't show sensitive tokens
            githubToken: config.githubToken ? '***' : undefined,
            gitlabToken: config.gitlabToken ? '***' : undefined,
            gitlabUrl: config.gitlabUrl,
          }, null, 2));
        }
        break;
        
      default:
        log.error(`Unknown config action: ${action}`);
        log.info('Available actions: init, show');
        process.exit(1);
    }
  } catch (error) {
    handleError(error as Error);
  }
}

/**
 * Main CLI setup
 */
function createCLI(): Command {
  const program = new Command();
  
  program
    .name('ghostcomment')
    .description('Extract and post developer-to-reviewer comments from code')
    .version('1.0.0')
    .option('-v, --verbose', 'Enable verbose output')
    .option('--dry-run', 'Show what would be done without making changes')
    .option('-C, --cwd <path>', 'Change working directory')
    .hook('preAction', (thisCommand) => {
      const opts = thisCommand.opts();
      cliState.verbose = Boolean(opts.verbose);
      cliState.dryRun = Boolean(opts.dryRun);
      
      if (opts.cwd) {
        cliState.workingDirectory = opts.cwd as string;
        process.chdir(cliState.workingDirectory);
      }
      
      if (cliState.dryRun) {
        log.info(chalk.yellow('DRY RUN MODE - No changes will be made'));
      }
    });
  
  // Scan command
  program
    .command('scan')
    .description('Scan files for ghost comments')
    .option('-c, --config <path>', 'Path to configuration file')
    .option('--count', 'Only show count of ghost comments')
    .action(scanCommand);
  
  // Clean command
  program
    .command('clean')
    .description('Remove ghost comments from files')
    .option('-c, --config <path>', 'Path to configuration file')
    .option('--no-backup', 'Do not create backup files')
    .option('-f, --force', 'Skip validation of comments before removal')
    .action(cleanCommand);
  
  // Comment command
  program
    .command('comment')
    .description('Post ghost comments to GitHub PR or GitLab MR')
    .option('-c, --config <path>', 'Path to configuration file')
    .option('-t, --token <token>', 'GitHub or GitLab API token')
    .option('-r, --repo <owner/repo>', 'Repository in format "owner/repo"')
    .option('-p, --pr <number>', 'Pull request or merge request number', parseInt)
    .option('--platform <platform>', 'Platform: github or gitlab')
    .option('--gitlab <url>', 'GitLab instance URL')
    .action(commentCommand);
  
  // Config command
  program
    .command('config <action>')
    .description('Manage configuration (actions: init, show)')
    .option('-f, --file <name>', 'Configuration file name')
    .action(configCommand);
  
  return program;
}

/**
 * Main entry point
 */
function main(): void {
  const program = createCLI();
  
  // Handle unhandled errors
  process.on('uncaughtException', (error) => {
    log.error('Uncaught exception:');
    handleError(error);
  });
  
  process.on('unhandledRejection', (reason) => {
    log.error('Unhandled rejection:');
    handleError(reason as Error);
  });
  
  // Parse command line arguments
  program.parse();
}

// Only run main if this file is being executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main, createCLI };