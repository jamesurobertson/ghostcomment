/**
 * Tests for the core scanner functionality
 */

import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { promises as fs } from 'fs';
import glob from 'fast-glob';
import { scanFiles, scanSingleFile, countGhostComments } from '../../src/core/scanner.js';
import { GhostCommentConfig, GhostCommentError, GhostCommentErrorType } from '../../src/models/comment.js';
import { DEFAULT_CONFIG } from '../../src/models/config.js';
import { mockConfig, sampleFiles, createTestFileWithComments, mockCwd } from '../fixtures/index.js';

// Mock fs and glob
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    stat: jest.fn(),
  },
}));

jest.mock('fast-glob');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockGlob = glob as jest.MockedFunction<typeof glob>;

describe('Scanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    mockFs.stat.mockResolvedValue({
      size: 1024,
    } as any);
    
    // Setup default glob mock
    (glob as any).mockResolvedValue([]);
  });

  describe('scanFiles', () => {
    it('should find ghost comments with default prefix', async () => {
      const testConfig: GhostCommentConfig = {
        ...DEFAULT_CONFIG,
        include: ['**/*.ts'],
        exclude: ['node_modules/**'],
      };

      // Mock glob to return test files
      (glob as any).mockResolvedValue(['/test/project/src/test.ts']);
      
      // Mock fs.readFile to return test content
      (mockFs.readFile as any).mockResolvedValue(sampleFiles['src/test.ts']);

      const comments = await scanFiles(testConfig, mockCwd);

      expect(comments).toHaveLength(1);
      expect(comments[0]!).toEqual({
        filePath: 'src/test.ts',
        lineNumber: 5,
        content: 'Removed unused legacy logic',
        prefix: '//_gc_',
        originalLine: '  //_gc_ Removed unused legacy logic',
      });
    });

    it('should handle multiple files with multiple comments', async () => {
      const testConfig: GhostCommentConfig = {
        ...DEFAULT_CONFIG,
        include: ['**/*.ts'],
      };

      (glob as any).mockResolvedValue([
        '/test/project/src/test.ts',
        '/test/project/src/utils.ts',
      ]);
      
      (mockFs.readFile as any).mockImplementation((filePath: any) => {
        if (filePath.includes('test.ts')) {
          return Promise.resolve(sampleFiles['src/test.ts']);
        }
        if (filePath.includes('utils.ts')) {
          return Promise.resolve(sampleFiles['src/utils.ts']);
        }
        return Promise.reject(new Error('File not found'));
      });

      const comments = await scanFiles(testConfig, mockCwd);

      expect(comments).toHaveLength(2);
      expect(comments[0]!.filePath).toBe('src/test.ts');
      expect(comments[1].filePath).toBe('src/utils.ts');
    });

    it('should respect include/exclude patterns', async () => {
      const testConfig: GhostCommentConfig = {
        ...DEFAULT_CONFIG,
        include: ['src/**/*.ts'],
        exclude: ['**/*.test.ts'],
      };

      await scanFiles(testConfig, mockCwd);

      expect(mockGlob).toHaveBeenCalledWith(
        testConfig.include,
        expect.objectContaining({
          ignore: testConfig.exclude,
          absolute: true,
          cwd: mockCwd,
        })
      );
    });

    it('should handle custom prefix', async () => {
      const testConfig: GhostCommentConfig = {
        ...DEFAULT_CONFIG,
        prefix: '//TODO:',
      };

      const testContent = createTestFileWithComments([
        { line: 3, content: 'Fix this later', prefix: '//TODO:' },
      ]);

      (glob as any).mockResolvedValue(['/test/project/src/test.ts']);
      mockFs.readFile.mockResolvedValue(testContent);

      const comments = await scanFiles(testConfig, mockCwd);

      expect(comments).toHaveLength(1);
      expect(comments[0]!.content).toBe('Fix this later');
      expect(comments[0]!.prefix).toBe('//TODO:');
    });

    it('should return empty array when no files match', async () => {
      const testConfig: GhostCommentConfig = DEFAULT_CONFIG;

      (glob as any).mockResolvedValue([]);

      const comments = await scanFiles(testConfig, mockCwd);

      expect(comments).toEqual([]);
    });

    it('should return empty array when no comments found', async () => {
      const testConfig: GhostCommentConfig = DEFAULT_CONFIG;

      (glob as any).mockResolvedValue(['/test/project/src/clean.ts']);
      mockFs.readFile.mockResolvedValue(`
        function cleanFunction() {
          return 'no comments here';
        }
      `);

      const comments = await scanFiles(testConfig, mockCwd);

      expect(comments).toEqual([]);
    });

    it('should handle files with no comments gracefully', async () => {
      const testConfig: GhostCommentConfig = DEFAULT_CONFIG;

      (glob as any).mockResolvedValue(['/test/project/README.md']);
      mockFs.readFile.mockResolvedValue(sampleFiles['README.md']);

      const comments = await scanFiles(testConfig, mockCwd);

      expect(comments).toEqual([]);
    });

    it('should validate configuration', async () => {
      const invalidConfig = {
        ...DEFAULT_CONFIG,
        prefix: '', // Invalid empty prefix
      };

      await expect(scanFiles(invalidConfig, mockCwd)).rejects.toThrow(GhostCommentError);
    });

    it('should handle file read errors gracefully', async () => {
      const testConfig: GhostCommentConfig = DEFAULT_CONFIG;

      (glob as any).mockResolvedValue(['/test/project/src/error.ts']);
      mockFs.readFile.mockRejectedValue(new Error('Permission denied'));

      // Should not throw but log warning
      const comments = await scanFiles(testConfig, mockCwd);

      expect(comments).toEqual([]);
    });

    it('should enforce file size limits', async () => {
      const testConfig: GhostCommentConfig = DEFAULT_CONFIG;

      // Mock console.warn to capture the warning
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      (glob as any).mockResolvedValue(['/test/project/src/large.ts']);
      (mockFs.stat as any).mockResolvedValue({
        size: 20 * 1024 * 1024, // 20MB - larger than limit
      });

      const result = await scanFiles(testConfig, mockCwd);
      
      // Should return empty array and log warning
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to scan'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('too large'));
      
      consoleSpy.mockRestore();
    });

    it('should enforce file count limits', async () => {
      const testConfig: GhostCommentConfig = DEFAULT_CONFIG;

      // Mock too many files
      const manyFiles = Array.from({ length: 15000 }, (_, i) => `/test/project/file${i}.ts`);
      (glob as any).mockResolvedValue(manyFiles);

      await expect(scanFiles(testConfig, mockCwd)).rejects.toThrow(GhostCommentError);
    });
  });

  describe('scanSingleFile', () => {
    it('should scan a single file successfully', async () => {
      const testConfig: GhostCommentConfig = DEFAULT_CONFIG;

      mockFs.readFile.mockResolvedValue(sampleFiles['src/test.ts']);

      const comments = await scanSingleFile('src/test.ts', testConfig, mockCwd);

      expect(comments).toHaveLength(1);
      expect(comments[0]!.filePath).toBe('src/test.ts');
    });

    it('should handle relative and absolute paths', async () => {
      const testConfig: GhostCommentConfig = DEFAULT_CONFIG;

      mockFs.readFile.mockResolvedValue(sampleFiles['src/test.ts']);

      const comments1 = await scanSingleFile('src/test.ts', testConfig, mockCwd);
      const comments2 = await scanSingleFile('/test/project/src/test.ts', testConfig, mockCwd);

      expect(comments1).toHaveLength(1);
      expect(comments2).toHaveLength(1);
      expect(comments1[0].filePath).toBe('src/test.ts');
      expect(comments2[0].filePath).toBe('src/test.ts');
    });
  });

  describe('countGhostComments', () => {
    it('should count comments without loading content into memory', async () => {
      const testConfig: GhostCommentConfig = DEFAULT_CONFIG;

      (glob as any).mockResolvedValue([
        '/test/project/src/test.ts',
        '/test/project/src/utils.ts',
      ]);
      
      (mockFs.readFile as any).mockImplementation((filePath: any) => {
        if (filePath.includes('test.ts')) {
          return Promise.resolve(sampleFiles['src/test.ts']);
        }
        if (filePath.includes('utils.ts')) {
          return Promise.resolve(sampleFiles['src/utils.ts']);
        }
        return Promise.reject(new Error('File not found'));
      });

      const count = await countGhostComments(testConfig, mockCwd);

      expect(count).toBe(2);
    });

    it('should return 0 when no comments found', async () => {
      const testConfig: GhostCommentConfig = DEFAULT_CONFIG;

      (glob as any).mockResolvedValue(['/test/project/README.md']);
      mockFs.readFile.mockResolvedValue(sampleFiles['README.md']);

      const count = await countGhostComments(testConfig, mockCwd);

      expect(count).toBe(0);
    });

    it('should handle errors gracefully and continue counting', async () => {
      const testConfig: GhostCommentConfig = DEFAULT_CONFIG;

      (glob as any).mockResolvedValue([
        '/test/project/src/test.ts',
        '/test/project/src/error.ts',
      ]);
      
      (mockFs.readFile as any).mockImplementation((filePath: any) => {
        if (filePath.includes('test.ts')) {
          return Promise.resolve(sampleFiles['src/test.ts']);
        }
        if (filePath.includes('error.ts')) {
          return Promise.reject(new Error('File error'));
        }
        return Promise.reject(new Error('File not found'));
      });

      const count = await countGhostComments(testConfig, mockCwd);

      expect(count).toBe(1); // Should count the successful file
    });
  });

  describe('error handling', () => {
    it('should throw GhostCommentError for configuration errors', async () => {
      const invalidConfig = {
        ...DEFAULT_CONFIG,
        include: [], // Invalid empty include
      };

      await expect(scanFiles(invalidConfig, mockCwd)).rejects.toThrow(
        expect.objectContaining({
          type: GhostCommentErrorType.CONFIG_ERROR,
        })
      );
    });

    it('should throw GhostCommentError for file system errors', async () => {
      const testConfig: GhostCommentConfig = DEFAULT_CONFIG;

      mockGlob.mockRejectedValue(new Error('Glob error'));

      await expect(scanFiles(testConfig, mockCwd)).rejects.toThrow(
        expect.objectContaining({
          type: GhostCommentErrorType.FILE_ERROR,
        })
      );
    });
  });
});