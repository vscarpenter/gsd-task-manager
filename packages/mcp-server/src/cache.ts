/**
 * In-memory task caching layer
 * Reduces redundant API calls and decryption operations
 */

import type { DecryptedTask } from './types.js';

export interface CacheConfig {
  /** Time-to-live in milliseconds (default: 30 seconds) */
  ttlMs: number;
  /** Maximum number of entries (default: 1000) */
  maxEntries: number;
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  ttlMs: 30000, // 30 seconds
  maxEntries: 1000,
};

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/**
 * Generic TTL cache implementation
 */
class TTLCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private config: CacheConfig;

  constructor(config: CacheConfig = DEFAULT_CACHE_CONFIG) {
    this.config = config;
  }

  /**
   * Get value from cache if valid
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set value in cache with TTL
   */
  set(key: string, data: T): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.config.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.config.ttlMs,
    });
  }

  /**
   * Remove specific key from cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxEntries: number; ttlMs: number } {
    return {
      size: this.cache.size,
      maxEntries: this.config.maxEntries,
      ttlMs: this.config.ttlMs,
    };
  }
}

/**
 * Task-specific cache manager
 * Handles task list caching with automatic invalidation
 */
class TaskCacheManager {
  private taskListCache: TTLCache<DecryptedTask[]>;
  private singleTaskCache: TTLCache<DecryptedTask>;
  private hitCount = 0;
  private missCount = 0;

  constructor(config: CacheConfig = DEFAULT_CACHE_CONFIG) {
    this.taskListCache = new TTLCache<DecryptedTask[]>(config);
    this.singleTaskCache = new TTLCache<DecryptedTask>(config);
  }

  /**
   * Get cached task list
   */
  getTaskList(cacheKey: string): DecryptedTask[] | null {
    const result = this.taskListCache.get(cacheKey);
    if (result) {
      this.hitCount++;
    } else {
      this.missCount++;
    }
    return result;
  }

  /**
   * Cache task list
   */
  setTaskList(cacheKey: string, tasks: DecryptedTask[]): void {
    this.taskListCache.set(cacheKey, tasks);

    // Also cache individual tasks for single-task lookups
    tasks.forEach((task) => {
      this.singleTaskCache.set(task.id, task);
    });
  }

  /**
   * Get cached single task
   */
  getTask(taskId: string): DecryptedTask | null {
    const result = this.singleTaskCache.get(taskId);
    if (result) {
      this.hitCount++;
    } else {
      this.missCount++;
    }
    return result;
  }

  /**
   * Cache single task
   */
  setTask(task: DecryptedTask): void {
    this.singleTaskCache.set(task.id, task);
  }

  /**
   * Invalidate all caches (called after write operations)
   */
  invalidate(): void {
    this.taskListCache.clear();
    this.singleTaskCache.clear();
  }

  /**
   * Invalidate specific task (for targeted invalidation)
   */
  invalidateTask(taskId: string): void {
    this.singleTaskCache.delete(taskId);
    // Also clear list cache since it may contain this task
    this.taskListCache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    taskListCache: { size: number; maxEntries: number; ttlMs: number };
    singleTaskCache: { size: number; maxEntries: number; ttlMs: number };
    hitRate: number;
    hits: number;
    misses: number;
  } {
    const total = this.hitCount + this.missCount;
    return {
      taskListCache: this.taskListCache.getStats(),
      singleTaskCache: this.singleTaskCache.getStats(),
      hitRate: total > 0 ? this.hitCount / total : 0,
      hits: this.hitCount,
      misses: this.missCount,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.hitCount = 0;
    this.missCount = 0;
  }
}

// Singleton instance
let cacheInstance: TaskCacheManager | null = null;

/**
 * Get the task cache manager singleton
 */
export function getTaskCache(config?: CacheConfig): TaskCacheManager {
  if (!cacheInstance) {
    cacheInstance = new TaskCacheManager(config);
  }
  return cacheInstance;
}

/**
 * Reset the cache (for testing)
 */
export function resetTaskCache(): void {
  if (cacheInstance) {
    cacheInstance.invalidate();
    cacheInstance.resetStats();
  }
  cacheInstance = null;
}

/**
 * Generate cache key for task list queries
 */
export function generateTaskListCacheKey(filters?: {
  quadrant?: string;
  completed?: boolean;
  tags?: string[];
}): string {
  if (!filters) return 'all';

  const parts: string[] = [];
  if (filters.quadrant) parts.push(`q:${filters.quadrant}`);
  if (filters.completed !== undefined) parts.push(`c:${filters.completed}`);
  if (filters.tags?.length) parts.push(`t:${filters.tags.sort().join(',')}`);

  return parts.length > 0 ? parts.join('|') : 'all';
}
