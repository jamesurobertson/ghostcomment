/**
 * Tests for GitHub API client
 */

import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import axios from 'axios';
import { GitHubClient } from '../../src/clients/github.js';
import { GhostCommentError, GhostCommentErrorType } from '../../src/models/comment.js';
import { mockGhostComments, mockGitContext, mockGitHubResponses } from '../fixtures/index.js';

// Mock axios
jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

// Mock axios.isAxiosError
Object.defineProperty(axios, 'isAxiosError', {
  value: jest.fn(),
  writable: true,
});

describe('GitHubClient', () => {
  let client: GitHubClient;
  let mockAxiosInstance: jest.Mocked<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a mock axios instance
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    };
    
    mockAxios.create.mockReturnValue(mockAxiosInstance);
    
    client = new GitHubClient({
      token: 'test-token',
      debug: false,
    });
  });

  describe('constructor', () => {
    it('should create client with default configuration', () => {
      expect(mockAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api.github.com',
          timeout: 30000,
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
            'Accept': 'application/vnd.github.v3+json',
          }),
        })
      );
    });

    it('should throw error when token is missing', () => {
      expect(() => new GitHubClient({ token: '' })).toThrow(
        expect.objectContaining({
          type: GhostCommentErrorType.AUTH_ERROR,
        })
      );
    });

    it('should accept custom configuration', () => {
      new GitHubClient({
        token: 'test-token',
        baseURL: 'https://api.github.example.com',
        timeout: 60000,
        debug: true,
      });

      expect(mockAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api.github.example.com',
          timeout: 60000,
        })
      );
    });
  });

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: mockGitHubResponses.user,
      });

      await expect(client.testConnection()).resolves.not.toThrow();
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/user');
    });

    it('should handle 401 authentication error', async () => {
      const axiosError = new Error('Request failed') as any;
      axiosError.isAxiosError = true;
      axiosError.response = { status: 401 };
      mockAxiosInstance.get.mockRejectedValue(axiosError);
      
      // Mock axios.isAxiosError to return true
      (axios.isAxiosError as jest.MockedFunction<typeof axios.isAxiosError>).mockReturnValue(true);

      await expect(client.testConnection()).rejects.toThrow(
        expect.objectContaining({
          type: GhostCommentErrorType.AUTH_ERROR,
        })
      );
    });

    it('should handle 403 permission error', async () => {
      const axiosError = new Error('Request failed') as any;
      axiosError.isAxiosError = true;
      axiosError.response = { status: 403 };
      mockAxiosInstance.get.mockRejectedValue(axiosError);
      
      // Mock axios.isAxiosError to return true
      (axios.isAxiosError as jest.MockedFunction<typeof axios.isAxiosError>).mockReturnValue(true);

      await expect(client.testConnection()).rejects.toThrow(
        expect.objectContaining({
          type: GhostCommentErrorType.AUTH_ERROR,
        })
      );
    });

    it('should handle network errors', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      await expect(client.testConnection()).rejects.toThrow(
        expect.objectContaining({
          type: GhostCommentErrorType.NETWORK_ERROR,
        })
      );
    });
  });

  describe('getPullRequest', () => {
    it('should fetch pull request information', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: mockGitHubResponses.pullRequest,
      });

      const result = await client.getPullRequest(mockGitContext);

      expect(result).toEqual({
        number: 123,
        head: { sha: 'abc123def456' },
        base: { sha: 'def456abc123' },
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/repos/testowner/testrepo/pulls/123'
      );
    });

    it('should handle PR not found error', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        isAxiosError: true,
        response: { status: 404 },
      });

      await expect(client.getPullRequest(mockGitContext)).rejects.toThrow(
        expect.objectContaining({
          type: GhostCommentErrorType.GITHUB_API_ERROR,
        })
      );
    });
  });

  describe('postReviewComments', () => {
    it('should post review comments successfully', async () => {
      // Mock PR info request
      mockAxiosInstance.get.mockResolvedValue({
        data: mockGitHubResponses.pullRequest,
      });

      // Mock comment posting
      mockAxiosInstance.post.mockResolvedValue({
        data: mockGitHubResponses.createCommentSuccess,
      });

      const result = await client.postReviewComments(
        [mockGhostComments[0]],
        mockGitContext
      );

      expect(result.posted).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.success).toHaveLength(1);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/repos/testowner/testrepo/pulls/123/comments',
        expect.objectContaining({
          body: '🧩 _Removed unused legacy logic_',
          commit_id: 'abc123def456',
          path: 'src/test.ts',
          line: 5,
          side: 'RIGHT',
        })
      );
    });

    it('should handle empty comments array', async () => {
      const result = await client.postReviewComments([], mockGitContext);

      expect(result.posted).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.success).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle 422 errors (line not in diff) gracefully', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: mockGitHubResponses.pullRequest,
      });

      const axiosError = new Error('Request failed') as any;
      axiosError.isAxiosError = true;
      axiosError.response = { status: 422 };
      mockAxiosInstance.post.mockRejectedValue(axiosError);
      
      // Mock axios.isAxiosError to return true
      (axios.isAxiosError as jest.MockedFunction<typeof axios.isAxiosError>).mockReturnValue(true);

      const result = await client.postReviewComments(
        [mockGhostComments[0]!],
        mockGitContext
      );

      expect(result.posted).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(1);
    });

    it('should handle API errors and continue with other comments', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: mockGitHubResponses.pullRequest,
      });

      mockAxiosInstance.post
        .mockResolvedValueOnce({
          data: mockGitHubResponses.createCommentSuccess,
        })
        .mockRejectedValueOnce({
          isAxiosError: true,
          response: { 
            status: 500,
            statusText: 'Internal Server Error',
            data: { message: 'Server error' },
          },
        });

      const result = await client.postReviewComments(
        [mockGhostComments[0], mockGhostComments[1]],
        mockGitContext
      );

      expect(result.posted).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(1);
    });

    it('should handle rate limiting', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: mockGitHubResponses.pullRequest,
      });

      const axiosError = new Error('Rate limited') as any;
      axiosError.isAxiosError = true;
      axiosError.response = { 
        status: 403,
        headers: {
          'x-ratelimit-reset': '1640995200',
        },
      };
      mockAxiosInstance.post.mockRejectedValue(axiosError);
      
      // Mock axios.isAxiosError to return true
      (axios.isAxiosError as jest.MockedFunction<typeof axios.isAxiosError>).mockReturnValue(true);

      const result = await client.postReviewComments([mockGhostComments[0]!], mockGitContext);
      
      expect(result.posted).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.error).toContain('rate limit exceeded');
    });

    it('should retry on temporary server errors', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: mockGitHubResponses.pullRequest,
      });

      const axiosError = new Error('Server error') as any;
      axiosError.isAxiosError = true;
      axiosError.response = { status: 500 };
      
      // First call fails with 500, second succeeds
      mockAxiosInstance.post
        .mockRejectedValueOnce(axiosError)
        .mockResolvedValueOnce({
          data: mockGitHubResponses.createCommentSuccess,
        });
      
      // Mock axios.isAxiosError to return true
      (axios.isAxiosError as jest.MockedFunction<typeof axios.isAxiosError>).mockReturnValue(true);

      const result = await client.postReviewComments(
        [mockGhostComments[0]!],
        mockGitContext
      );

      expect(result.posted).toBe(1);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple comments efficiently', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: mockGitHubResponses.pullRequest,
      });

      mockAxiosInstance.post.mockResolvedValue({
        data: mockGitHubResponses.createCommentSuccess,
      });

      const result = await client.postReviewComments(
        mockGhostComments,
        mockGitContext
      );

      expect(result.posted).toBe(mockGhostComments.length);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(mockGhostComments.length);
    });
  });

  describe('listReviewComments', () => {
    it('should list existing review comments', async () => {
      const mockComments = [mockGitHubResponses.createCommentSuccess];
      mockAxiosInstance.get.mockResolvedValue({
        data: mockComments,
      });

      const result = await client.listReviewComments(mockGitContext);

      expect(result).toEqual(mockComments);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/repos/testowner/testrepo/pulls/123/comments'
      );
    });
  });

  describe('getRateLimit', () => {
    it('should fetch rate limit information', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: mockGitHubResponses.rateLimit,
      });

      const result = await client.getRateLimit();

      expect(result).toEqual({
        remaining: 4999,
        limit: 5000,
        reset: expect.any(Date),
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/rate_limit');
    });
  });

  describe('error handling', () => {
    it('should handle malformed API responses', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: mockGitHubResponses.pullRequest,
      });

      const axiosError = new Error('Bad Request') as any;
      axiosError.isAxiosError = true;
      axiosError.response = {
        status: 400,
        statusText: 'Bad Request',
        data: {
          message: 'Validation Failed',
          errors: [
            { field: 'line', code: 'invalid' },
          ],
        },
      };
      mockAxiosInstance.post.mockRejectedValue(axiosError);
      
      // Mock axios.isAxiosError to return true
      (axios.isAxiosError as jest.MockedFunction<typeof axios.isAxiosError>).mockReturnValue(true);

      const result = await client.postReviewComments(
        [mockGhostComments[0]!],
        mockGitContext
      );

      expect(result.failed).toBe(1);
      expect(result.errors[0]!.error).toContain('Validation Failed');
      expect(result.errors[0]!.error).toContain('line: invalid');
    });

    it('should handle network timeouts', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: mockGitHubResponses.pullRequest,
      });

      mockAxiosInstance.post.mockRejectedValue(new Error('timeout'));
      
      // Mock axios.isAxiosError to return false for non-axios errors
      (axios.isAxiosError as jest.MockedFunction<typeof axios.isAxiosError>).mockReturnValue(false);

      const result = await client.postReviewComments(
        [mockGhostComments[0]!],
        mockGitContext
      );

      expect(result.failed).toBe(1);
      expect(result.errors[0]!.error).toContain('Network error');
    });
  });
});