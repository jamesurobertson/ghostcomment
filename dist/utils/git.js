/**
 * Git utilities for extracting repository and PR context
 */
import { simpleGit, CheckRepoActions } from 'simple-git';
import { GhostCommentError, GhostCommentErrorType, } from '../models/comment.js';
/**
 * Initializes simple-git with error handling
 */
function initGit(workingDirectory) {
    try {
        return simpleGit(workingDirectory);
    }
    catch (error) {
        throw new GhostCommentError(GhostCommentErrorType.GIT_ERROR, `Failed to initialize Git in ${workingDirectory}`, error);
    }
}
/**
 * Checks if directory is a Git repository
 */
export async function isGitRepository(workingDirectory = process.cwd()) {
    try {
        const git = initGit(workingDirectory);
        const isRepo = await git.checkIsRepo(CheckRepoActions.IS_REPO_ROOT);
        return isRepo;
    }
    catch {
        return false;
    }
}
/**
 * Gets the current commit SHA
 */
export async function getCurrentCommit(workingDirectory = process.cwd()) {
    try {
        if (!(await isGitRepository(workingDirectory))) {
            throw new GhostCommentError(GhostCommentErrorType.GIT_ERROR, `Directory is not a Git repository: ${workingDirectory}`);
        }
        const git = initGit(workingDirectory);
        const log = await git.log(['-1']);
        if (!log.latest) {
            throw new GhostCommentError(GhostCommentErrorType.GIT_ERROR, 'No commits found in repository');
        }
        return log.latest.hash;
    }
    catch (error) {
        if (error instanceof GhostCommentError) {
            throw error;
        }
        throw new GhostCommentError(GhostCommentErrorType.GIT_ERROR, 'Failed to get current commit', error);
    }
}
/**
 * Gets the current branch name
 */
export async function getCurrentBranch(workingDirectory = process.cwd()) {
    try {
        if (!(await isGitRepository(workingDirectory))) {
            throw new GhostCommentError(GhostCommentErrorType.GIT_ERROR, `Directory is not a Git repository: ${workingDirectory}`);
        }
        const git = initGit(workingDirectory);
        const branch = await git.branch();
        if (!branch.current) {
            throw new GhostCommentError(GhostCommentErrorType.GIT_ERROR, 'No current branch found (detached HEAD?)');
        }
        return branch.current;
    }
    catch (error) {
        if (error instanceof GhostCommentError) {
            throw error;
        }
        throw new GhostCommentError(GhostCommentErrorType.GIT_ERROR, 'Failed to get current branch', error);
    }
}
/**
 * Parses GitHub/GitLab repository info from remote URL
 */
function parseRepositoryUrl(remoteUrl) {
    // Handle both HTTPS and SSH formats
    const patterns = [
        // HTTPS: https://github.com/owner/repo.git
        /https:\/\/(?:github\.com|gitlab\.com)\/([^\/]+)\/([^\/]+?)(?:\.git)?$/,
        // SSH: git@github.com:owner/repo.git
        /git@(?:github\.com|gitlab\.com):([^\/]+)\/([^\/]+?)(?:\.git)?$/,
        // Custom GitLab: https://gitlab.example.com/owner/repo.git
        /https:\/\/[^\/]+\/([^\/]+)\/([^\/]+?)(?:\.git)?$/,
        // Custom GitLab SSH: git@gitlab.example.com:owner/repo.git
        /git@[^:]+:([^\/]+)\/([^\/]+?)(?:\.git)?$/,
    ];
    for (const pattern of patterns) {
        const match = remoteUrl.match(pattern);
        if (match) {
            return {
                owner: match[1] || '',
                repo: match[2] || '',
            };
        }
    }
    throw new GhostCommentError(GhostCommentErrorType.GIT_ERROR, `Unable to parse repository info from remote URL: ${remoteUrl}`);
}
/**
 * Gets repository information from Git
 */
export async function getRepositoryInfo(workingDirectory = process.cwd()) {
    try {
        if (!(await isGitRepository(workingDirectory))) {
            throw new GhostCommentError(GhostCommentErrorType.GIT_ERROR, `Directory is not a Git repository: ${workingDirectory}`);
        }
        const git = initGit(workingDirectory);
        // Get repository root
        const root = await git.revparse(['--show-toplevel']);
        // Get current branch and commit
        const [branch, commit] = await Promise.all([
            getCurrentBranch(workingDirectory),
            getCurrentCommit(workingDirectory),
        ]);
        if (!branch || !commit) {
            throw new GhostCommentError(GhostCommentErrorType.GIT_ERROR, 'Failed to get branch or commit information');
        }
        // Get remote URL (try origin first, then any remote)
        const remotes = await git.getRemotes(true);
        if (remotes.length === 0) {
            throw new GhostCommentError(GhostCommentErrorType.GIT_ERROR, 'No Git remotes found');
        }
        const originRemote = remotes.find(r => r.name === 'origin') || remotes[0];
        if (!originRemote) {
            throw new GhostCommentError(GhostCommentErrorType.GIT_ERROR, 'No Git remotes found');
        }
        const remoteUrl = originRemote.refs.fetch || originRemote.refs.push;
        if (!remoteUrl) {
            throw new GhostCommentError(GhostCommentErrorType.GIT_ERROR, 'No remote URL found');
        }
        // Parse owner and repo from remote URL
        const { owner, repo } = parseRepositoryUrl(remoteUrl);
        return {
            root,
            branch,
            commit,
            remoteUrl,
            owner,
            repo,
        };
    }
    catch (error) {
        if (error instanceof GhostCommentError) {
            throw error;
        }
        throw new GhostCommentError(GhostCommentErrorType.GIT_ERROR, 'Failed to get repository information', error);
    }
}
/**
 * Extracts PR context from GitHub Actions environment
 */
function getGitHubActionsPRContext() {
    // Check if running in GitHub Actions
    if (!process.env.GITHUB_ACTIONS) {
        return null;
    }
    const context = {};
    // Get PR number from GitHub event
    if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
        // Try to get PR number from GitHub ref (refs/pull/123/merge)
        const ref = process.env.GITHUB_REF;
        if (ref) {
            const match = ref.match(/refs\/pull\/(\d+)\/merge/);
            if (match && match[1]) {
                context.number = parseInt(match[1], 10);
            }
        }
        // Get commit SHAs
        if (process.env.GITHUB_SHA) {
            context.headSha = process.env.GITHUB_SHA;
        }
        // For base SHA, we'd need to parse the event payload
        // For now, we'll detect it from Git
    }
    return Object.keys(context).length > 0 ? context : null;
}
/**
 * Gets pull request information from environment or Git
 */
export async function getPRContext(workingDirectory = process.cwd(), prNumber) {
    try {
        const repoInfo = await getRepositoryInfo(workingDirectory);
        // Try to get PR context from GitHub Actions first
        const ghActionsPR = getGitHubActionsPRContext();
        // Use provided PR number or try to detect from environment
        const pullNumber = prNumber || ghActionsPR?.number;
        if (!pullNumber) {
            // Try to extract from branch name (e.g., pr-123, pull/123)
            const branchPRMatch = repoInfo.branch.match(/(?:pr|pull)[-\/]?(\d+)/i);
            if (branchPRMatch && branchPRMatch[1]) {
                const extractedPR = parseInt(branchPRMatch[1], 10);
                if (extractedPR) {
                    return {
                        owner: repoInfo.owner,
                        repo: repoInfo.repo,
                        pullNumber: extractedPR,
                        commitSha: repoInfo.commit,
                        baseSha: '', // Will be filled by API client if needed
                    };
                }
            }
            throw new GhostCommentError(GhostCommentErrorType.GIT_ERROR, 'Unable to determine PR number. Please provide --pr option or ensure running in PR context.');
        }
        return {
            owner: repoInfo.owner,
            repo: repoInfo.repo,
            pullNumber,
            commitSha: ghActionsPR?.headSha || repoInfo.commit,
            baseSha: ghActionsPR?.baseSha || '', // Will be filled by API client if needed
        };
    }
    catch (error) {
        if (error instanceof GhostCommentError) {
            throw error;
        }
        throw new GhostCommentError(GhostCommentErrorType.GIT_ERROR, 'Failed to get PR context', error);
    }
}
/**
 * Gets list of files that have been modified in the current branch
 */
export async function getDiffFiles(workingDirectory = process.cwd(), baseBranch = 'main') {
    try {
        if (!(await isGitRepository(workingDirectory))) {
            throw new GhostCommentError(GhostCommentErrorType.GIT_ERROR, `Directory is not a Git repository: ${workingDirectory}`);
        }
        const git = initGit(workingDirectory);
        // Get current branch
        const currentBranch = await getCurrentBranch(workingDirectory);
        // If we're on the base branch, compare with previous commit
        if (currentBranch === baseBranch) {
            const diff = await git.diff(['--name-only', 'HEAD~1']);
            return diff.split('\n').filter(file => file.length > 0);
        }
        // Compare current branch with base branch
        try {
            const diff = await git.diff(['--name-only', `${baseBranch}...HEAD`]);
            return diff.split('\n').filter(file => file.length > 0);
        }
        catch {
            // If base branch doesn't exist locally, try origin/base
            try {
                const diff = await git.diff(['--name-only', `origin/${baseBranch}...HEAD`]);
                return diff.split('\n').filter(file => file.length > 0);
            }
            catch {
                // Fallback to comparing with HEAD~1
                const diff = await git.diff(['--name-only', 'HEAD~1']);
                return diff.split('\n').filter(file => file.length > 0);
            }
        }
    }
    catch (error) {
        if (error instanceof GhostCommentError) {
            throw error;
        }
        throw new GhostCommentError(GhostCommentErrorType.GIT_ERROR, 'Failed to get diff files', error);
    }
}
/**
 * Gets the merge base between current branch and base branch
 */
export async function getMergeBase(workingDirectory = process.cwd(), baseBranch = 'main') {
    try {
        if (!(await isGitRepository(workingDirectory))) {
            throw new GhostCommentError(GhostCommentErrorType.GIT_ERROR, `Directory is not a Git repository: ${workingDirectory}`);
        }
        const git = initGit(workingDirectory);
        try {
            const mergeBase = await git.raw(['merge-base', baseBranch, 'HEAD']);
            return mergeBase.trim();
        }
        catch {
            // Try with origin prefix
            try {
                const mergeBase = await git.raw(['merge-base', `origin/${baseBranch}`, 'HEAD']);
                return mergeBase.trim();
            }
            catch {
                // Fallback to previous commit
                const log = await git.log(['-2']);
                if (log.all.length >= 2 && log.all[1]) {
                    return log.all[1].hash;
                }
                throw new GhostCommentError(GhostCommentErrorType.GIT_ERROR, 'Unable to determine merge base');
            }
        }
    }
    catch (error) {
        if (error instanceof GhostCommentError) {
            throw error;
        }
        throw new GhostCommentError(GhostCommentErrorType.GIT_ERROR, 'Failed to get merge base', error);
    }
}
/**
 * Validates that the working directory is clean (no uncommitted changes)
 */
export async function validateCleanWorkingDirectory(workingDirectory = process.cwd()) {
    try {
        if (!(await isGitRepository(workingDirectory))) {
            throw new GhostCommentError(GhostCommentErrorType.GIT_ERROR, `Directory is not a Git repository: ${workingDirectory}`);
        }
        const git = initGit(workingDirectory);
        const status = await git.status();
        if (!status.isClean()) {
            const changes = [
                ...status.modified.map(f => `modified: ${f}`),
                ...status.not_added.map(f => `untracked: ${f}`),
                ...status.created.map(f => `added: ${f}`),
                ...status.deleted.map(f => `deleted: ${f}`),
                ...status.renamed.map(f => `renamed: ${f.from} -> ${f.to}`),
            ];
            throw new GhostCommentError(GhostCommentErrorType.GIT_ERROR, `Working directory has uncommitted changes:\n${changes.join('\n')}`);
        }
    }
    catch (error) {
        if (error instanceof GhostCommentError) {
            throw error;
        }
        throw new GhostCommentError(GhostCommentErrorType.GIT_ERROR, 'Failed to validate working directory', error);
    }
}
//# sourceMappingURL=git.js.map