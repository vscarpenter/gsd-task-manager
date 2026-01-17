import { describe, it, expect } from 'vitest';
import {
  allTools,
  readTools,
  writeTools,
  analyticsTools,
  systemTools,
  getSyncStatusTool,
  listDevicesTool,
  getTaskStatsTool,
  listTasksTool,
  getTaskTool,
  searchTasksTool,
  getTokenStatusTool,
  getProductivityMetricsTool,
  getTagAnalyticsTool,
  createTaskTool,
  updateTaskTool,
  completeTaskTool,
  deleteTaskTool,
  bulkUpdateTasksTool,
  validateConfigTool,
  getHelpTool,
  getCacheStatsTool,
} from '../../tools/schemas/index.js';

describe('Tool Schemas', () => {
  describe('Schema Count Validation', () => {
    it('should have exactly 20 tools total', () => {
      // 7 read + 5 write + 5 analytics + 3 system
      expect(allTools).toHaveLength(20);
    });

    it('should have 7 read tools', () => {
      // get_sync_status, list_devices, get_task_stats, list_tasks, get_task, search_tasks, get_token_status
      expect(readTools).toHaveLength(7);
    });

    it('should have 5 write tools', () => {
      expect(writeTools).toHaveLength(5);
    });

    it('should have 5 analytics tools', () => {
      expect(analyticsTools).toHaveLength(5);
    });

    it('should have 3 system tools', () => {
      // validate_config, get_help, get_cache_stats
      expect(systemTools).toHaveLength(3);
    });
  });

  describe('Schema Structure Validation', () => {
    it('each tool should have required MCP tool properties', () => {
      allTools.forEach((tool) => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(typeof tool.inputSchema).toBe('object');
      });
    });

    it('each tool name should be unique', () => {
      const names = allTools.map((t) => t.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it('each tool should have non-empty description', () => {
      allTools.forEach((tool) => {
        expect(tool.description).toBeDefined();
        expect(tool.description!.length).toBeGreaterThan(0);
      });
    });

    it('each inputSchema should have type and properties', () => {
      allTools.forEach((tool) => {
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema).toHaveProperty('properties');
        expect(tool.inputSchema).toHaveProperty('required');
        expect(Array.isArray(tool.inputSchema.required)).toBe(true);
      });
    });
  });

  describe('Read Tools', () => {
    it('get_sync_status should have no required parameters', () => {
      expect(getSyncStatusTool.name).toBe('get_sync_status');
      expect(getSyncStatusTool.inputSchema.required).toHaveLength(0);
    });

    it('list_devices should have no required parameters', () => {
      expect(listDevicesTool.name).toBe('list_devices');
      expect(listDevicesTool.inputSchema.required).toHaveLength(0);
    });

    it('get_task_stats should have no required parameters', () => {
      expect(getTaskStatsTool.name).toBe('get_task_stats');
      expect(getTaskStatsTool.inputSchema.required).toHaveLength(0);
    });

    it('list_tasks should have optional filter parameters', () => {
      expect(listTasksTool.name).toBe('list_tasks');
      expect(listTasksTool.inputSchema.required).toHaveLength(0);
      expect(listTasksTool.inputSchema.properties).toHaveProperty('quadrant');
      expect(listTasksTool.inputSchema.properties).toHaveProperty('completed');
      expect(listTasksTool.inputSchema.properties).toHaveProperty('tags');
    });

    it('get_task should require taskId', () => {
      expect(getTaskTool.name).toBe('get_task');
      expect(getTaskTool.inputSchema.required).toContain('taskId');
      expect(getTaskTool.inputSchema.properties).toHaveProperty('taskId');
    });

    it('search_tasks should require query', () => {
      expect(searchTasksTool.name).toBe('search_tasks');
      expect(searchTasksTool.inputSchema.required).toContain('query');
      expect(searchTasksTool.inputSchema.properties).toHaveProperty('query');
    });

    it('get_token_status should have no required parameters', () => {
      expect(getTokenStatusTool.name).toBe('get_token_status');
      expect(getTokenStatusTool.inputSchema.required).toHaveLength(0);
    });
  });

  describe('Analytics Tools', () => {
    it('all analytics tools should mention encryption requirement', () => {
      analyticsTools.forEach((tool) => {
        expect(tool.description).toMatch(/GSD_ENCRYPTION_PASSPHRASE/i);
      });
    });

    it('get_productivity_metrics should have no required parameters', () => {
      expect(getProductivityMetricsTool.name).toBe('get_productivity_metrics');
      expect(getProductivityMetricsTool.inputSchema.required).toHaveLength(0);
    });

    it('get_tag_analytics should have optional limit parameter', () => {
      expect(getTagAnalyticsTool.name).toBe('get_tag_analytics');
      expect(getTagAnalyticsTool.inputSchema.required).toHaveLength(0);
      expect(getTagAnalyticsTool.inputSchema.properties).toHaveProperty('limit');
    });
  });

  describe('Write Tools', () => {
    it('all write tools should mention encryption requirement', () => {
      writeTools.forEach((tool) => {
        expect(tool.description).toMatch(/GSD_ENCRYPTION_PASSPHRASE/i);
      });
    });

    it('all write tools should have optional dryRun parameter', () => {
      writeTools.forEach((tool) => {
        expect(tool.inputSchema.properties).toHaveProperty('dryRun');
        // dryRun should not be required
        expect(tool.inputSchema.required).not.toContain('dryRun');
      });
    });

    it('create_task should require title, urgent, and important', () => {
      expect(createTaskTool.name).toBe('create_task');
      expect(createTaskTool.inputSchema.required).toContain('title');
      expect(createTaskTool.inputSchema.required).toContain('urgent');
      expect(createTaskTool.inputSchema.required).toContain('important');
      expect(createTaskTool.inputSchema.required).toHaveLength(3);
    });

    it('create_task should have all task properties', () => {
      const properties = createTaskTool.inputSchema.properties;
      expect(properties).toHaveProperty('title');
      expect(properties).toHaveProperty('description');
      expect(properties).toHaveProperty('urgent');
      expect(properties).toHaveProperty('important');
      expect(properties).toHaveProperty('dueDate');
      expect(properties).toHaveProperty('tags');
      expect(properties).toHaveProperty('subtasks');
      expect(properties).toHaveProperty('recurrence');
      expect(properties).toHaveProperty('dependencies');
    });

    it('update_task should only require id', () => {
      expect(updateTaskTool.name).toBe('update_task');
      expect(updateTaskTool.inputSchema.required).toContain('id');
      expect(updateTaskTool.inputSchema.required).toHaveLength(1);
    });

    it('complete_task should require id and completed', () => {
      expect(completeTaskTool.name).toBe('complete_task');
      expect(completeTaskTool.inputSchema.required).toContain('id');
      expect(completeTaskTool.inputSchema.required).toContain('completed');
      expect(completeTaskTool.inputSchema.required).toHaveLength(2);
    });

    it('delete_task should require id', () => {
      expect(deleteTaskTool.name).toBe('delete_task');
      expect(deleteTaskTool.inputSchema.required).toContain('id');
      expect(deleteTaskTool.inputSchema.required).toHaveLength(1);
    });

    it('bulk_update_tasks should require taskIds and operation', () => {
      expect(bulkUpdateTasksTool.name).toBe('bulk_update_tasks');
      expect(bulkUpdateTasksTool.inputSchema.required).toContain('taskIds');
      expect(bulkUpdateTasksTool.inputSchema.required).toContain('operation');
      expect(bulkUpdateTasksTool.inputSchema.required).toHaveLength(2);
    });

    it('bulk_update_tasks should have operation type enum', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const operationProp = bulkUpdateTasksTool.inputSchema.properties?.operation as any;
      expect(operationProp).toBeDefined();
      expect(operationProp.properties.type).toHaveProperty('enum');
      const typeEnum = operationProp.properties.type.enum;
      expect(typeEnum).toContain('complete');
      expect(typeEnum).toContain('move_quadrant');
      expect(typeEnum).toContain('add_tags');
      expect(typeEnum).toContain('remove_tags');
      expect(typeEnum).toContain('set_due_date');
      expect(typeEnum).toContain('delete');
    });
  });

  describe('System Tools', () => {
    it('validate_config should have no required parameters', () => {
      expect(validateConfigTool.name).toBe('validate_config');
      expect(validateConfigTool.inputSchema.required).toHaveLength(0);
    });

    it('get_help should have optional topic parameter', () => {
      expect(getHelpTool.name).toBe('get_help');
      expect(getHelpTool.inputSchema.required).toHaveLength(0);
      expect(getHelpTool.inputSchema.properties).toHaveProperty('topic');
    });

    it('get_help topic should have valid enum values', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const topicProp = getHelpTool.inputSchema.properties?.topic as any;
      expect(topicProp).toHaveProperty('enum');
      expect(topicProp.enum).toContain('tools');
      expect(topicProp.enum).toContain('analytics');
      expect(topicProp.enum).toContain('setup');
      expect(topicProp.enum).toContain('examples');
      expect(topicProp.enum).toContain('troubleshooting');
    });

    it('get_cache_stats should have optional reset parameter', () => {
      expect(getCacheStatsTool.name).toBe('get_cache_stats');
      expect(getCacheStatsTool.inputSchema.required).toHaveLength(0);
      expect(getCacheStatsTool.inputSchema.properties).toHaveProperty('reset');
    });
  });

  describe('Schema Consistency', () => {
    it('quadrant enum should be consistent across tools', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const listTasksQuadrant = (listTasksTool.inputSchema.properties?.quadrant as any)?.enum;
      expect(listTasksQuadrant).toEqual([
        'urgent-important',
        'not-urgent-important',
        'urgent-not-important',
        'not-urgent-not-important',
      ]);
    });

    it('recurrence enum should be consistent across tools', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const createRecurrence = (createTaskTool.inputSchema.properties?.recurrence as any)?.enum;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateRecurrence = (updateTaskTool.inputSchema.properties?.recurrence as any)?.enum;
      expect(createRecurrence).toEqual(['none', 'daily', 'weekly', 'monthly']);
      expect(updateRecurrence).toEqual(['none', 'daily', 'weekly', 'monthly']);
    });

    it('subtasks structure should be consistent across create and update', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const createSubtasks = createTaskTool.inputSchema.properties?.subtasks as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateSubtasks = updateTaskTool.inputSchema.properties?.subtasks as any;

      expect(createSubtasks.items.properties).toHaveProperty('title');
      expect(createSubtasks.items.properties).toHaveProperty('completed');
      expect(updateSubtasks.items.properties).toHaveProperty('id');
      expect(updateSubtasks.items.properties).toHaveProperty('title');
      expect(updateSubtasks.items.properties).toHaveProperty('completed');
    });
  });
});
