/**
 * Tests for the core cleaner functionality
 */

import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { promises as fs } from 'fs';
import { removeComments, validateCommentsForCleaning, DEFAULT_CLEAN_OPTIONS } from '../../src/core/cleaner.js';
import { GhostComment, GhostCommentError, GhostCommentErrorType } from '../../src/models/comment.js';
import { mockGhostComments, mockCwd, createTestFileWithComments } from '../fixtures/index.js';

// Mock fs
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    copyFile: jest.fn(),
    unlink: jest.fn(),
    stat: jest.fn(),
    chmod: jest.fn(),
    utimes: jest.fn(),
    access: jest.fn(),
    constants: {
      R_OK: 4,
      W_OK: 2,
    },
  },
  constants: {
    R_OK: 4,
    W_OK: 2,
  },
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('Cleaner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    mockFs.stat.mockResolvedValue({
      mode: 0o644,
      atime: new Date('2023-01-01'),
      mtime: new Date('2023-01-01'),
    } as any);
    
    mockFs.access.mockResolvedValue(undefined);
  });

  describe('removeComments', () => {
    it('should remove ghost comments from files', async () => {
      const testComments: GhostComment[] = [
        {
          filePath: 'src/test.ts',
          lineNumber: 3,
          content: 'Remove this comment',
          prefix: '//_gc_',
          originalLine: '  //_gc_ Remove this comment',
        },
      ];

      const fileContent = createTestFileWithComments([
        { line: 3, content: 'Remove this comment' },
      ]);
      
      mockFs.readFile.mockResolvedValue(fileContent);

      const result = await removeComments(testComments, DEFAULT_CLEAN_OPTIONS, mockCwd);

      expect(result.filesProcessed).toBe(1);
      expect(result.commentsRemoved).toBe(1);
      expect(result.hasErrors).toBe(false);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should handle multiple comments in the same file', async () => {
      const testComments: GhostComment[] = [
        {
          filePath: 'src/test.ts',
          lineNumber: 2,
          content: 'First comment',
          prefix: '//_gc_',
          originalLine: '  //_gc_ First comment',
        },
        {
          filePath: 'src/test.ts',
          lineNumber: 4,
          content: 'Second comment',
          prefix: '//_gc_',
          originalLine: '  //_gc_ Second comment',
        },
      ];

      const fileContent = createTestFileWithComments([
        { line: 2, content: 'First comment' },
        { line: 4, content: 'Second comment' },
      ]);
      
      mockFs.readFile.mockResolvedValue(fileContent);

      const result = await removeComments(testComments, DEFAULT_CLEAN_OPTIONS, mockCwd);

      expect(result.filesProcessed).toBe(1);
      expect(result.commentsRemoved).toBe(2);
      expect(result.hasErrors).toBe(false);
    });

    it('should handle comments across multiple files', async () => {
      const testComments: GhostComment[] = [
        {
          filePath: 'src/file1.ts',
          lineNumber: 2,
          content: 'Comment in file 1',
          prefix: '//_gc_',
          originalLine: '  //_gc_ Comment in file 1',
        },
        {
          filePath: 'src/file2.ts',
          lineNumber: 3,
          content: 'Comment in file 2',
          prefix: '//_gc_',
          originalLine: '  //_gc_ Comment in file 2',
        },
      ];

      (mockFs.readFile as any).mockImplementation((filePath: any) => {
        if (filePath.includes('file1.ts')) {
          return Promise.resolve(createTestFileWithComments([
            { line: 2, content: 'Comment in file 1' },
          ]));
        }
        if (filePath.includes('file2.ts')) {
          return Promise.resolve(createTestFileWithComments([
            { line: 3, content: 'Comment in file 2' },
          ]));
        }
        return Promise.reject(new Error('File not found'));
      });

      const result = await removeComments(testComments, DEFAULT_CLEAN_OPTIONS, mockCwd);

      expect(result.filesProcessed).toBe(2);
      expect(result.commentsRemoved).toBe(2);
      expect(result.hasErrors).toBe(false);
    });

    it('should create backups when enabled', async () => {
      const testComments: GhostComment[] = [mockGhostComments[0]!];
      const fileContent = createTestFileWithComments([
        { line: 3, content: 'Test comment' },
      ]);
      
      mockFs.readFile.mockResolvedValue(fileContent);

      const options = {
        ...DEFAULT_CLEAN_OPTIONS,
        createBackups: true,
      };

      await removeComments(testComments, options, mockCwd);

      expect(mockFs.copyFile).toHaveBeenCalled();
    });

    it('should skip backups when disabled', async () => {
      const testComments: GhostComment[] = [mockGhostComments[0]!];
      const fileContent = createTestFileWithComments([
        { line: 3, content: 'Test comment' },
      ]);
      
      mockFs.readFile.mockResolvedValue(fileContent);

      const options = {
        ...DEFAULT_CLEAN_OPTIONS,
        createBackups: false,
      };

      await removeComments(testComments, options, mockCwd);

      expect(mockFs.copyFile).not.toHaveBeenCalled();
    });

    it('should handle dry run mode', async () => {
      const testComments: GhostComment[] = [mockGhostComments[0]!];
      const fileContent = createTestFileWithComments([
        { line: 3, content: 'Test comment' },
      ]);
      
      mockFs.readFile.mockResolvedValue(fileContent);

      const options = {
        ...DEFAULT_CLEAN_OPTIONS,
        dryRun: true,
      };

      const result = await removeComments(testComments, options, mockCwd);

      expect(result.filesProcessed).toBe(1);
      expect(result.commentsRemoved).toBe(1);
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('should validate that comment lines match expected content', async () => {
      const testComments: GhostComment[] = [
        {
          filePath: 'src/test.ts',
          lineNumber: 3,
          content: 'Expected comment',
          prefix: '//_gc_',
          originalLine: '  //_gc_ Expected comment',
        },
      ];

      // File content has different comment than expected
      const fileContent = createTestFileWithComments([
        { line: 3, content: 'Different comment' },
      ]);
      
      mockFs.readFile.mockResolvedValue(fileContent);

      await expect(removeComments(testComments, DEFAULT_CLEAN_OPTIONS, mockCwd))
        .rejects.toThrow(GhostCommentError);
    });

    it('should handle line number out of range', async () => {
      const testComments: GhostComment[] = [
        {
          filePath: 'src/test.ts',
          lineNumber: 100, // Line doesn't exist
          content: 'Comment',
          prefix: '//_gc_',
          originalLine: '  //_gc_ Comment',
        },
      ];

      const fileContent = 'function test() {\n  return true;\n}';
      mockFs.readFile.mockResolvedValue(fileContent);

      await expect(removeComments(testComments, DEFAULT_CLEAN_OPTIONS, mockCwd))
        .rejects.toThrow(GhostCommentError);
    });

    it('should restore backups on error when restoreOnError is enabled', async () => {
      const testComments: GhostComment[] = [
        {
          filePath: 'src/test1.ts',
          lineNumber: 2,
          content: 'Valid comment',
          prefix: '//_gc_',
          originalLine: '  //_gc_ Valid comment',
        },
        {
          filePath: 'src/test2.ts',
          lineNumber: 100, // Invalid line number
          content: 'Invalid comment',
          prefix: '//_gc_',
          originalLine: '  //_gc_ Invalid comment',
        },
      ];

      (mockFs.readFile as any).mockImplementation((filePath: any) => {
        if (filePath.includes('test1.ts')) {
          return Promise.resolve(createTestFileWithComments([
            { line: 2, content: 'Valid comment' },
          ]));
        }
        if (filePath.includes('test2.ts')) {
          return Promise.resolve('function test() {\n  return true;\n}');
        }
        return Promise.reject(new Error('File not found'));
      });

      const options = {
        ...DEFAULT_CLEAN_OPTIONS,
        createBackups: true,
        restoreOnError: true,
      };

      const result = await removeComments(testComments, options, mockCwd);

      expect(result.hasErrors).toBe(true);
      expect(result.errorFiles).toHaveLength(1);
      expect(mockFs.copyFile).toHaveBeenCalled(); // Restore from backup
    });

    it('should preserve file permissions and timestamps', async () => {
      const testComments: GhostComment[] = [mockGhostComments[0]!];
      const fileContent = createTestFileWithComments([
        { line: 3, content: 'Test comment' },
      ]);
      
      mockFs.readFile.mockResolvedValue(fileContent);

      await removeComments(testComments, DEFAULT_CLEAN_OPTIONS, mockCwd);

      expect(mockFs.chmod).toHaveBeenCalled();
      expect(mockFs.utimes).toHaveBeenCalled();
    });

    it('should handle empty comments array', async () => {
      const result = await removeComments([], DEFAULT_CLEAN_OPTIONS, mockCwd);

      expect(result.filesProcessed).toBe(0);
      expect(result.commentsRemoved).toBe(0);
      expect(result.hasErrors).toBe(false);
    });

    it('should remove backup files when removeBackups is enabled', async () => {
      const testComments: GhostComment[] = [mockGhostComments[0]!];
      const fileContent = createTestFileWithComments([
        { line: 3, content: 'Test comment' },
      ]);
      
      mockFs.readFile.mockResolvedValue(fileContent);

      const options = {
        ...DEFAULT_CLEAN_OPTIONS,
        createBackups: true,
        removeBackups: true,
      };

      await removeComments(testComments, options, mockCwd);

      expect(mockFs.unlink).toHaveBeenCalled();
    });
  });

  describe('validateCommentsForCleaning', () => {
    it('should validate that comments can be safely removed', async () => {
      const testComments: GhostComment[] = [
        {
          filePath: 'src/test.ts',
          lineNumber: 3,
          content: 'Valid comment',
          prefix: '//_gc_',
          originalLine: '  //_gc_ Valid comment',
        },
      ];

      const fileContent = createTestFileWithComments([
        { line: 3, content: 'Valid comment' },
      ]);
      
      mockFs.readFile.mockResolvedValue(fileContent);

      const result = await validateCommentsForCleaning(testComments, mockCwd);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect when file content has changed', async () => {
      const testComments: GhostComment[] = [
        {
          filePath: 'src/test.ts',
          lineNumber: 3,
          content: 'Original comment',
          prefix: '//_gc_',
          originalLine: '  //_gc_ Original comment',
        },
      ];

      const fileContent = createTestFileWithComments([
        { line: 3, content: 'Modified comment' },
      ]);
      
      mockFs.readFile.mockResolvedValue(fileContent);

      const result = await validateCommentsForCleaning(testComments, mockCwd);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Line content has changed');
    });

    it('should detect when line numbers are out of range', async () => {
      const testComments: GhostComment[] = [
        {
          filePath: 'src/test.ts',
          lineNumber: 100,
          content: 'Comment',
          prefix: '//_gc_',
          originalLine: '  //_gc_ Comment',
        },
      ];

      const fileContent = 'function test() {\n  return true;\n}';
      mockFs.readFile.mockResolvedValue(fileContent);

      const result = await validateCommentsForCleaning(testComments, mockCwd);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('out of range');
    });

    it('should detect when files are not accessible', async () => {
      const testComments: GhostComment[] = [mockGhostComments[0]!];

      mockFs.access.mockRejectedValue(new Error('Permission denied'));

      const result = await validateCommentsForCleaning(testComments, mockCwd);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('File access error');
    });

    it('should handle multiple validation errors', async () => {
      const testComments: GhostComment[] = [
        {
          filePath: 'src/missing.ts',
          lineNumber: 1,
          content: 'Comment',
          prefix: '//_gc_',
          originalLine: '  //_gc_ Comment',
        },
        {
          filePath: 'src/invalid.ts',
          lineNumber: 100,
          content: 'Comment',
          prefix: '//_gc_',
          originalLine: '  //_gc_ Comment',
        },
      ];

      mockFs.access.mockImplementation((filePath: string) => {
        if (filePath.includes('missing.ts')) {
          return Promise.reject(new Error('File not found'));
        }
        return Promise.resolve();
      });

      (mockFs.readFile as any).mockImplementation((filePath: any) => {
        if (filePath.includes('invalid.ts')) {
          return Promise.resolve('function test() {\n  return true;\n}');
        }
        return Promise.reject(new Error('File not found'));
      });

      const result = await validateCommentsForCleaning(testComments, mockCwd);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    it('should handle empty comments array', async () => {
      const result = await validateCommentsForCleaning([], mockCwd);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle file system errors gracefully', async () => {
      const testComments: GhostComment[] = [mockGhostComments[0]!];

      mockFs.readFile.mockRejectedValue(new Error('File system error'));

      await expect(removeComments(testComments, DEFAULT_CLEAN_OPTIONS, mockCwd))
        .rejects.toThrow(GhostCommentError);
    });

    it('should handle backup creation errors', async () => {
      const testComments: GhostComment[] = [mockGhostComments[0]!];
      const fileContent = createTestFileWithComments([
        { line: 3, content: 'Test comment' },
      ]);
      
      mockFs.readFile.mockResolvedValue(fileContent);
      mockFs.copyFile.mockRejectedValue(new Error('Backup failed'));

      const options = {
        ...DEFAULT_CLEAN_OPTIONS,
        createBackups: true,
      };

      await expect(removeComments(testComments, options, mockCwd))
        .rejects.toThrow(GhostCommentError);
    });
  });
});