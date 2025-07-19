# GhostComment

> Extract and post developer-to-reviewer comments from code to GitHub PR and GitLab MR discussions

[![npm version](https://badge.fury.io/js/ghostcomment.svg)](https://www.npmjs.com/package/ghostcomment)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

GhostComment allows engineers to leave context-specific comments in their code while working locally, then automatically extracts those comments, removes them from the codebase, and posts them as inline comments on GitHub PRs or GitLab MRs. This improves code review clarity without polluting the codebase with one-time annotations.

## 🚀 Quick Start

### Install

```bash
# npm
npm install -g ghostcomment

# npx (no installation)
npx ghostcomment --help
```

### Basic Usage

1. **Add ghost comments to your code:**

```typescript
function processData(data: any) {
  // _gc_ Removed legacy validation logic that was causing performance issues
  const cleanData = sanitize(data);
  
  // _gc_ TODO: Consider using a more efficient algorithm here
  return transform(cleanData);
}
```

2. **Scan for ghost comments:**

```bash
ghostcomment scan
```

3. **Post comments to your PR:**

```bash
# Will auto-detect PR from Git context
ghostcomment comment --token $GITHUB_TOKEN

# Or specify manually
ghostcomment comment --token $GITHUB_TOKEN --repo owner/repo --pr 123
```

4. **Clean up (remove ghost comments from files):**

```bash
ghostcomment clean
```

## 📋 Table of Contents

- [Installation](#installation)
- [CLI Usage](#cli-usage)
- [GitHub Action](#github-action)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Contributing](#contributing)

## 📦 Installation

### Global Installation

```bash
npm install -g ghostcomment
```

### Local Installation

```bash
npm install --save-dev ghostcomment
```

### GitHub Action

Add to your workflow:

```yaml
- uses: ghostcomment/ghostcomment@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

## 🖥️ CLI Usage

### Commands

#### `ghostcomment scan`

Scan files for ghost comments:

```bash
ghostcomment scan [options]

Options:
  -c, --config <path>   Path to configuration file
  --count              Only show count of ghost comments
  -v, --verbose        Enable verbose output
  --dry-run           Show what would be done without making changes
```

#### `ghostcomment clean`

Remove ghost comments from files:

```bash
ghostcomment clean [options]

Options:
  -c, --config <path>   Path to configuration file
  --no-backup          Do not create backup files
  -f, --force          Skip validation of comments before removal
```

#### `ghostcomment comment`

Post ghost comments to GitHub PR or GitLab MR:

```bash
ghostcomment comment [options]

Options:
  -c, --config <path>      Path to configuration file
  -t, --token <token>      GitHub or GitLab API token
  -r, --repo <owner/repo>  Repository in format "owner/repo"
  -p, --pr <number>        Pull request or merge request number
  --platform <platform>   Platform: github or gitlab
  --gitlab <url>          GitLab instance URL
```

#### `ghostcomment config`

Manage configuration:

```bash
# Create default config file
ghostcomment config init

# Show current configuration
ghostcomment config show
```

### Global Options

```bash
Options:
  -v, --verbose        Enable verbose output
  --dry-run           Show what would be done without making changes
  -C, --cwd <path>    Change working directory
  -h, --help          Display help information
  -V, --version       Display version number
```

## 🔧 GitHub Action

### Basic Setup

Create `.github/workflows/ghostcomment.yml`:

```yaml
name: GhostComment
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  ghostcomment:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ghostcomment/ghostcomment@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Advanced Configuration

```yaml
- uses: ghostcomment/ghostcomment@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    config-path: '.ghostcommentrc'
    fail-on-found: 'false'
    clean-mode: 'true'
    dry-run: 'false'
    verbose: 'false'
```

### Action Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `github-token` | GitHub token for posting comments | ✅ | - |
| `config-path` | Path to configuration file | ❌ | `.ghostcommentrc` |
| `fail-on-found` | Fail if ghost comments are found | ❌ | `false` |
| `clean-mode` | Remove ghost comments after posting | ❌ | `true` |
| `dry-run` | Run without making changes | ❌ | `false` |
| `verbose` | Enable verbose logging | ❌ | `false` |

### Action Outputs

| Output | Description |
|--------|-------------|
| `comments-found` | Number of ghost comments found |
| `comments-posted` | Number of comments successfully posted |
| `comments-skipped` | Number of comments skipped (not in diff) |
| `comments-failed` | Number of comments that failed to post |
| `comments-cleaned` | Number of comments removed from files |

## ⚙️ Configuration

### Configuration File

Create `.ghostcommentrc` in your project root:

```json
{
  "prefix": "//_gc_",
  "include": [
    "**/*.{js,ts,tsx,jsx}",
    "**/*.{py,go,rs,java,kt,swift}"
  ],
  "exclude": [
    "**/node_modules/**",
    "**/dist/**",
    "**/.git/**"
  ],
  "failOnFound": false
}
```

### Package.json Configuration

Add configuration to your `package.json`:

```json
{
  "ghostcomment": {
    "prefix": "//_gc_",
    "include": ["src/**/*.ts"],
    "exclude": ["**/*.test.ts"]
  }
}
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub personal access token |
| `GITLAB_TOKEN` | GitLab personal access token |
| `GITLAB_URL` | Custom GitLab instance URL |
| `GC_CONFIG_PATH` | Custom config file path |
| `GC_DEBUG` | Enable debug logging |
| `GC_DRY_RUN` | Enable dry-run mode |

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `prefix` | `string` | `//_gc_` | Comment prefix to search for |
| `include` | `string[]` | `["**/*.{js,ts,tsx,jsx,py,go,rs,java,kt,swift}"]` | File patterns to include |
| `exclude` | `string[]` | `["**/node_modules/**", "**/dist/**", "**/.git/**"]` | File patterns to exclude |
| `failOnFound` | `boolean` | `false` | Fail process if ghost comments found |

## 📚 API Reference

### Programmatic Usage

```typescript
import { scanFiles, removeComments, GitHubClient } from 'ghostcomment';

// Scan for ghost comments
const config = await loadConfig();
const comments = await scanFiles(config);

// Post to GitHub
const client = new GitHubClient({ token: 'your-token' });
await client.postReviewComments(comments, gitContext);

// Clean files
await removeComments(comments);
```

### Core Functions

#### `scanFiles(config, workingDirectory?)`

Scans files for ghost comments.

```typescript
const comments = await scanFiles({
  prefix: '//_gc_',
  include: ['**/*.ts'],
  exclude: ['node_modules/**']
});
```

#### `removeComments(comments, options?, workingDirectory?)`

Removes ghost comments from files.

```typescript
await removeComments(comments, {
  createBackups: true,
  restoreOnError: true,
  dryRun: false
});
```

#### `loadConfig(options?, workingDirectory?)`

Loads configuration from multiple sources.

```typescript
const config = await loadConfig({
  config: '.ghostcommentrc',
  verbose: true
});
```

### API Clients

#### GitHub Client

```typescript
const client = new GitHubClient({
  token: 'github-token',
  baseURL: 'https://api.github.com'
});

await client.postReviewComments(comments, {
  owner: 'owner',
  repo: 'repo',
  pullNumber: 123,
  commitSha: 'abc123'
});
```

#### GitLab Client

```typescript
const client = new GitLabClient({
  token: 'gitlab-token',
  baseURL: 'https://gitlab.com'
});

await client.postDiscussions(comments, gitContext);
```

## 💡 Examples

### Basic Workflow

```typescript
// 1. Add ghost comments while coding
function updateUser(user: User) {
  // _gc_ Added validation to prevent XSS attacks
  const cleanData = sanitizeInput(user.data);
  
  // _gc_ Switched to async/await for better error handling
  return database.updateUser(user.id, cleanData);
}
```

```bash
# 2. Scan and review
ghostcomment scan
# Found 2 ghost comments:
#   src/user.ts:15 - Added validation to prevent XSS attacks
#   src/user.ts:18 - Switched to async/await for better error handling

# 3. Post to PR (in CI or locally)
ghostcomment comment --token $GITHUB_TOKEN

# 4. Clean up
ghostcomment clean
```

### Custom Prefixes

```json
{
  "prefix": "//TODO:",
  "include": ["src/**/*.js"]
}
```

```javascript
function processOrder(order) {
  //TODO: Consider caching frequently accessed orders
  return validateOrder(order);
}
```

### Multiple Platforms

```bash
# GitHub
export GITHUB_TOKEN=your-github-token
ghostcomment comment --platform github

# GitLab
export GITLAB_TOKEN=your-gitlab-token
ghostcomment comment --platform gitlab --gitlab https://gitlab.example.com
```

### CI/CD Integration

#### GitHub Actions

```yaml
name: Code Review Helper
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  ghostcomment:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - uses: ghostcomment/ghostcomment@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          fail-on-found: 'false'
          clean-mode: 'true'
```

#### GitLab CI

```yaml
ghostcomment:
  image: node:20
  stage: review
  script:
    - npm install -g ghostcomment
    - ghostcomment comment --platform gitlab --token $GITLAB_TOKEN
  only:
    - merge_requests
```

### Advanced Configuration

```json
{
  "prefix": "//_gc_",
  "include": [
    "src/**/*.{ts,tsx}",
    "lib/**/*.js",
    "scripts/**/*.py"
  ],
  "exclude": [
    "**/*.test.*",
    "**/*.spec.*",
    "**/node_modules/**",
    "**/dist/**",
    "**/__pycache__/**"
  ],
  "failOnFound": true
}
```

## 🚨 Error Handling

GhostComment provides detailed error messages and appropriate exit codes:

| Exit Code | Description |
|-----------|-------------|
| `0` | Success |
| `1` | Configuration error |
| `2` | File system error |
| `3` | Git repository error |
| `4` | GitHub API error |
| `5` | GitLab API error |
| `6` | Authentication error |
| `7` | Rate limit error |
| `8` | Network error |

### Common Issues

#### Authentication Errors

```bash
# GitHub
export GITHUB_TOKEN=ghp_your_token_here

# GitLab
export GITLAB_TOKEN=glpat_your_token_here
```

#### Line Not in Diff

When a ghost comment line isn't part of the PR diff, it will be skipped:

```
⚠ Skipped src/file.ts:42 - line not in diff
```

#### Rate Limiting

```
✗ GitHub API rate limit exceeded. Reset at: 2023-12-01T15:30:00Z
```

## 🔒 Security

- **Token Security**: API tokens are never logged or stored
- **GitHub Actions**: Uses `secrets.GITHUB_TOKEN` with minimal permissions
- **File Safety**: Creates backups before modifying files
- **Validation**: Verifies file content before making changes

### Required Permissions

#### GitHub Token
- `pull_requests: write` - To post review comments
- `contents: read` - To read repository content

#### GitLab Token
- `api` scope - To access merge request API

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
git clone https://github.com/ghostcomment/ghostcomment.git
cd ghostcomment
npm install
npm run build
npm test
```

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- scanner.test.ts
```

### Building

```bash
# Build TypeScript
npm run build

# Bundle for GitHub Action
npm run bundle

# Format code
npm run format

# Lint
npm run lint
```

## 📄 License

MIT © [GhostComment](LICENSE)

## 🙏 Acknowledgments

- [Commander.js](https://github.com/tj/commander.js/) - CLI framework
- [fast-glob](https://github.com/mrmlnc/fast-glob) - Fast file matching
- [simple-git](https://github.com/steveukx/git-js) - Git integration
- [axios](https://github.com/axios/axios) - HTTP client

---

<p align="center">
  <strong>Made with ❤️ for better code reviews</strong>
</p>