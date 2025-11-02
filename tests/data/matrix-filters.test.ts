import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractAvailableTags,
  getFilteredQuadrants,
  getVisibleTaskCount,
} from '@/lib/matrix-filters';
import * as filters from '@/lib/filters';
import type { TaskRecord, QuadrantId } from '@/lib/types';
import type { FilterCriteria } from '@/lib/filters';

// Mock the filters module
vi.mock('@/lib/filters', async () => {
  const actual = await vi.importActual('@/lib/filters');
  return {
    ...actual,
    applyFilters: vi.fn(),
  };
});

describe('Matrix Filters', () => {
  const createTask = (
    id: string,
    quadrant: QuadrantId,
    tags: string[] = [],
    completed = false
  ): TaskRecord => ({
    id,
    title: `Task ${id}`,
    description: '',
    quadrant,
    urgent: quadrant.includes('urgent'),
    important: quadrant.includes('important'),
    completed,
    createdAt: Date.now(),
    tags,
    subtasks: [],
    dependencies: [],
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractAvailableTags', () => {
    it('should extract unique tags from tasks', () => {
      const tasks = [
        createTask('1', 'urgent-important', ['work', 'urgent']),
        createTask('2', 'not-urgent-important', ['personal', 'urgent']),
        createTask('3', 'urgent-not-important', ['work']),
      ];

      const result = extractAvailableTags(tasks);

      expect(result).toEqual(['personal', 'urgent', 'work']); // Alphabetically sorted
    });

    it('should return empty array when no tasks have tags', () => {
      const tasks = [
        createTask('1', 'urgent-important', []),
        createTask('2', 'not-urgent-important', []),
      ];

      const result = extractAvailableTags(tasks);

      expect(result).toEqual([]);
    });

    it('should handle empty task list', () => {
      const result = extractAvailableTags([]);

      expect(result).toEqual([]);
    });

    it('should deduplicate tags across tasks', () => {
      const tasks = [
        createTask('1', 'urgent-important', ['work', 'urgent']),
        createTask('2', 'not-urgent-important', ['work', 'important']),
        createTask('3', 'urgent-not-important', ['urgent', 'work']),
      ];

      const result = extractAvailableTags(tasks);

      expect(result).toEqual(['important', 'urgent', 'work']);
      expect(result.length).toBe(3); // No duplicates
    });

    it('should sort tags alphabetically', () => {
      const tasks = [
        createTask('1', 'urgent-important', ['zebra', 'alpha', 'middle']),
      ];

      const result = extractAvailableTags(tasks);

      expect(result).toEqual(['alpha', 'middle', 'zebra']);
    });

    it('should handle tasks with many tags', () => {
      const tasks = [
        createTask('1', 'urgent-important', ['a', 'b', 'c', 'd', 'e']),
        createTask('2', 'not-urgent-important', ['f', 'g', 'h']),
      ];

      const result = extractAvailableTags(tasks);

      expect(result).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    });
  });

  describe('getFilteredQuadrants', () => {
    it('should filter and group tasks by quadrant', () => {
      const tasks = [
        createTask('1', 'urgent-important'),
        createTask('2', 'not-urgent-important'),
        createTask('3', 'urgent-not-important'),
        createTask('4', 'not-urgent-not-important'),
      ];

      // Mock applyFilters to return all tasks
      vi.mocked(filters.applyFilters).mockReturnValue(tasks);

      const result = getFilteredQuadrants(tasks, {}, '', false);

      expect(result).toMatchObject({
        'urgent-important': [tasks[0]],
        'not-urgent-important': [tasks[1]],
        'urgent-not-important': [tasks[2]],
        'not-urgent-not-important': [tasks[3]],
      });
    });

    it('should merge search query into filter criteria', () => {
      const tasks = [createTask('1', 'urgent-important')];
      vi.mocked(filters.applyFilters).mockReturnValue(tasks);

      getFilteredQuadrants(tasks, {}, 'search term', false);

      expect(filters.applyFilters).toHaveBeenCalledWith(tasks, {
        searchQuery: 'search term',
        status: 'active',
      });
    });

    it('should trim search query before applying', () => {
      const tasks = [createTask('1', 'urgent-important')];
      vi.mocked(filters.applyFilters).mockReturnValue(tasks);

      getFilteredQuadrants(tasks, {}, '  search  ', false);

      expect(filters.applyFilters).toHaveBeenCalledWith(tasks, {
        searchQuery: 'search',
        status: 'active',
      });
    });

    it('should set status to "active" when showCompleted is false', () => {
      const tasks = [createTask('1', 'urgent-important')];
      vi.mocked(filters.applyFilters).mockReturnValue(tasks);

      getFilteredQuadrants(tasks, {}, '', false);

      expect(filters.applyFilters).toHaveBeenCalledWith(tasks, {
        status: 'active',
      });
    });

    it('should set status to "all" when showCompleted is true', () => {
      const tasks = [createTask('1', 'urgent-important')];
      vi.mocked(filters.applyFilters).mockReturnValue(tasks);

      getFilteredQuadrants(tasks, {}, '', true);

      expect(filters.applyFilters).toHaveBeenCalledWith(tasks, {
        status: 'all',
      });
    });

    it('should preserve filter criteria status if specified', () => {
      const tasks = [createTask('1', 'urgent-important')];
      vi.mocked(filters.applyFilters).mockReturnValue(tasks);

      getFilteredQuadrants(tasks, { status: 'completed' }, '', false);

      expect(filters.applyFilters).toHaveBeenCalledWith(tasks, {
        status: 'completed',
      });
    });

    it('should handle empty task list', () => {
      vi.mocked(filters.applyFilters).mockReturnValue([]);

      const result = getFilteredQuadrants([], {}, '', false);

      expect(result).toMatchObject({
        'urgent-important': [],
        'not-urgent-important': [],
        'urgent-not-important': [],
        'not-urgent-not-important': [],
      });
    });

    it('should group multiple tasks in same quadrant', () => {
      const tasks = [
        createTask('1', 'urgent-important'),
        createTask('2', 'urgent-important'),
        createTask('3', 'urgent-important'),
      ];

      vi.mocked(filters.applyFilters).mockReturnValue(tasks);

      const result = getFilteredQuadrants(tasks, {}, '', false);

      expect(result['urgent-important']).toHaveLength(3);
      expect(result['not-urgent-important']).toHaveLength(0);
    });

    it('should preserve existing filter criteria', () => {
      const tasks = [createTask('1', 'urgent-important')];
      const criteria: FilterCriteria = {
        quadrants: ['urgent-important'],
        tags: ['work'],
      };

      vi.mocked(filters.applyFilters).mockReturnValue(tasks);

      getFilteredQuadrants(tasks, criteria, '', false);

      expect(filters.applyFilters).toHaveBeenCalledWith(tasks, {
        ...criteria,
        status: 'active',
      });
    });
  });

  describe('getVisibleTaskCount', () => {
    it('should count tasks across all quadrants', () => {
      const filteredQuadrants: Record<QuadrantId, TaskRecord[]> = {
        'urgent-important': [createTask('1', 'urgent-important'), createTask('2', 'urgent-important')],
        'not-urgent-important': [createTask('3', 'not-urgent-important')],
        'urgent-not-important': [],
        'not-urgent-not-important': [createTask('4', 'not-urgent-not-important')],
      };

      const result = getVisibleTaskCount(filteredQuadrants);

      expect(result).toBe(4);
    });

    it('should return 0 for empty quadrants', () => {
      const filteredQuadrants: Record<QuadrantId, TaskRecord[]> = {
        'urgent-important': [],
        'not-urgent-important': [],
        'urgent-not-important': [],
        'not-urgent-not-important': [],
      };

      const result = getVisibleTaskCount(filteredQuadrants);

      expect(result).toBe(0);
    });

    it('should handle quadrants with many tasks', () => {
      const filteredQuadrants: Record<QuadrantId, TaskRecord[]> = {
        'urgent-important': Array.from({ length: 10 }, (_, i) => createTask(`${i}`, 'urgent-important')),
        'not-urgent-important': Array.from({ length: 5 }, (_, i) => createTask(`${i + 10}`, 'not-urgent-important')),
        'urgent-not-important': Array.from({ length: 3 }, (_, i) => createTask(`${i + 15}`, 'urgent-not-important')),
        'not-urgent-not-important': Array.from({ length: 2 }, (_, i) => createTask(`${i + 18}`, 'not-urgent-not-important')),
      };

      const result = getVisibleTaskCount(filteredQuadrants);

      expect(result).toBe(20);
    });

    it('should handle missing quadrants gracefully', () => {
      const filteredQuadrants = {
        'urgent-important': [createTask('1', 'urgent-important')],
      } as Record<QuadrantId, TaskRecord[]>;

      const result = getVisibleTaskCount(filteredQuadrants);

      expect(result).toBe(1); // Only counts existing quadrant
    });
  });
});
