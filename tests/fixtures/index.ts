/**
 * Test fixtures and mock data
 */

import { GhostComment, GitContext, GhostCommentConfig } from '../../src/models/comment.js';
import { DEFAULT_CONFIG } from '../../src/models/config.js';

/**
 * Sample ghost comments for testing
 */
export const mockGhostComments: GhostComment[] = [
  {
    filePath: 'src/test.ts',
    lineNumber: 5,
    content: 'Removed unused legacy logic',
    prefix: '//_gc_',
    originalLine: '  //_gc_ Removed unused legacy logic',
  },
  {
    filePath: 'src/utils.ts',
    lineNumber: 3,
    content: 'This API is deprecated but still needed',
    prefix: '//_gc_',
    originalLine: '  //_gc_ This API is deprecated but still needed',
  },
  {
    filePath: 'tests/example.test.ts',
    lineNumber: 10,
    content: 'Mock data for integration test',
    prefix: '//_gc_',
    originalLine: '    // _gc_ Mock data for integration test',
  },
];

/**
 * Sample Git context for testing
 */
export const mockGitContext: GitContext = {
  owner: 'testowner',
  repo: 'testrepo',
  pullNumber: 123,
  commitSha: 'abc123def456',
  baseSha: 'def456abc123',
};

/**
 * Sample configuration for testing
 */
export const mockConfig: GhostCommentConfig = {
  ...DEFAULT_CONFIG,
  githubToken: 'test-github-token',
  gitlabToken: 'test-gitlab-token',
  gitlabUrl: 'https://gitlab.example.com',
};

/**
 * Sample file contents with ghost comments
 */
export const sampleFiles = {
  'src/test.ts': `
import { something } from './utils';

function testFunction() {
  const x = 1;
  //_gc_ Removed unused legacy logic
  const y = 2;
  return x + y;
}

export default testFunction;
`.trim(),

  'src/utils.ts': `
export function utilityFunction() {
  //_gc_ This API is deprecated but still needed
  return legacyAPI();
}

function legacyAPI() {
  return 'legacy';
}
`.trim(),

  'README.md': `
# Test Project

This is a test project.
`.trim(),

  'package.json': `
{
  "name": "test-project",
  "version": "1.0.0",
  "ghostcomment": {
    "prefix": "//_gc_",
    "include": ["src/**/*.ts"],
    "exclude": ["node_modules/**"]
  }
}
`.trim(),

  '.ghostcommentrc': `
{
  "prefix": "//_gc_",
  "include": ["**/*.ts", "**/*.js"],
  "exclude": ["node_modules/**", "dist/**"],
  "failOnFound": false
}
`.trim(),
};

/**
 * Sample GitHub API responses
 */
export const mockGitHubResponses = {
  user: {
    login: 'testuser',
    id: 12345,
    name: 'Test User',
  },
  pullRequest: {
    number: 123,
    head: { sha: 'abc123def456' },
    base: { sha: 'def456abc123' },
    state: 'open',
  },
  createCommentSuccess: {
    id: 98765,
    url: 'https://api.github.com/repos/testowner/testrepo/pulls/comments/98765',
    body: '🧩 _Removed unused legacy logic_',
    path: 'src/test.ts',
    line: 15,
    commit_id: 'abc123def456',
  },
  rateLimit: {
    rate: {
      limit: 5000,
      remaining: 4999,
      reset: Math.floor(Date.now() / 1000) + 3600,
    },
  },
};

/**
 * Sample GitLab API responses
 */
export const mockGitLabResponses = {
  user: {
    id: 54321,
    username: 'testuser',
    name: 'Test User',
  },
  project: {
    id: 12345,
    name: 'testrepo',
    path_with_namespace: 'testowner/testrepo',
  },
  mergeRequest: {
    id: 98765,
    iid: 123,
    project_id: 12345,
    sha: 'abc123def456',
    source_branch: 'feature-branch',
    target_branch: 'main',
  },
  createDiscussionSuccess: {
    id: 'discussion123',
    notes: [
      {
        id: 456789,
        body: '🧩 _Removed unused legacy logic_',
        author: {
          name: 'Test User',
          username: 'testuser',
        },
      },
    ],
  },
};

/**
 * Mock file system structure
 */
export const mockFileSystem = new Map([
  ['src/test.ts', sampleFiles['src/test.ts']],
  ['src/utils.ts', sampleFiles['src/utils.ts']],
  ['README.md', sampleFiles['README.md']],
  ['package.json', sampleFiles['package.json']],
  ['.ghostcommentrc', sampleFiles['.ghostcommentrc']],
]);

/**
 * Creates temporary directory structure for tests
 */
export function createMockDirectoryStructure(): Map<string, string> {
  return new Map(mockFileSystem);
}

/**
 * Helper to create test file content with ghost comments
 */
export function createTestFileWithComments(
  comments: Array<{ line: number; content: string; prefix?: string }>
): string {
  const lines = [
    'function testFunction() {',
    '  const x = 1;',
    '  const y = 2;',
    '  const z = 3;',
    '  return x + y + z;',
    '}',
  ];

  // Insert comments at specified lines
  for (const comment of comments.reverse()) {
    const prefix = comment.prefix || '//_gc_';
    const commentLine = `  ${prefix} ${comment.content}`;
    lines.splice(comment.line - 1, 0, commentLine);
  }

  return lines.join('\n');
}

/**
 * Mock process.cwd for tests
 */
export const mockCwd = '/test/project';

/**
 * Environment variable mocks
 */
export const mockEnvVars = {
  GITHUB_TOKEN: 'test-github-token',
  GITLAB_TOKEN: 'test-gitlab-token',
  GITLAB_URL: 'https://gitlab.example.com',
  GITHUB_ACTIONS: 'true',
  GITHUB_REPOSITORY: 'testowner/testrepo',
  GITHUB_EVENT_NAME: 'pull_request',
  GITHUB_REF: 'refs/pull/123/merge',
  GITHUB_SHA: 'abc123def456',
  CI: 'true',
};