import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatsCard } from '@/components/dashboard/stats-card';
import { CompletionChart } from '@/components/dashboard/completion-chart';
import { QuadrantDistribution } from '@/components/dashboard/quadrant-distribution';
import { StreakIndicator } from '@/components/dashboard/streak-indicator';
import { TagAnalytics } from '@/components/dashboard/tag-analytics';
import { UpcomingDeadlines } from '@/components/dashboard/upcoming-deadlines';
import { getDb } from '@/lib/db';
import type { TaskRecord } from '@/lib/types';

describe('Dashboard Components', () => {
  let db: ReturnType<typeof getDb>;

  beforeEach(async () => {
    db = getDb();
    await db.tasks.clear();
  });

  afterEach(async () => {
    await db.tasks.clear();
  });

  describe('StatsCard', () => {
    it('should render stat value and label', () => {
      render(<StatsCard value={42} title="Total Tasks" />);

      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('Total Tasks')).toBeInTheDocument();
    });

    it('should render with trend indicator up', () => {
      render(<StatsCard value={42} title="Completed" trend={{ value: 15, isPositive: true }} />);

      // Should show up arrow and percentage
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText(/↑/)).toBeInTheDocument();
      expect(screen.getByText(/15%/)).toBeInTheDocument();
    });

    it('should render with trend indicator down', () => {
      render(<StatsCard value={10} title="Pending" trend={{ value: 8, isPositive: false }} />);

      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText(/↓/)).toBeInTheDocument();
      expect(screen.getByText(/8%/)).toBeInTheDocument();
    });

    it('should render without trend indicator', () => {
      render(<StatsCard value={5} title="Categories" />);

      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('Categories')).toBeInTheDocument();
    });

    it('should render zero value', () => {
      render(<StatsCard value={0} title="Overdue" />);

      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should render large numbers', () => {
      render(<StatsCard value={1234} title="All Time Completed" />);

      expect(screen.getByText('1234')).toBeInTheDocument();
    });
  });

  describe('StreakIndicator', () => {
    it('should render current streak', () => {
      render(<StreakIndicator streakData={{ current: 7, longest: 10, lastCompletionDate: null }} />);

      expect(screen.getByText(/7/)).toBeInTheDocument();
      expect(screen.getByText(/current streak/i)).toBeInTheDocument();
    });

    it('should render longest streak', () => {
      render(<StreakIndicator streakData={{ current: 3, longest: 15, lastCompletionDate: null }} />);

      expect(screen.getByText(/15/)).toBeInTheDocument();
      expect(screen.getByText(/longest streak/i)).toBeInTheDocument();
    });

    it('should handle zero streak', () => {
      render(<StreakIndicator streakData={{ current: 0, longest: 0, lastCompletionDate: null }} />);

      expect(screen.getByText(/0/)).toBeInTheDocument();
      expect(screen.getByText(/start your streak/i)).toBeInTheDocument();
    });

    it('should render streak icon', () => {
      render(<StreakIndicator streakData={{ current: 5, longest: 10, lastCompletionDate: null }} />);

      // Should have flame icon
      expect(screen.getByText(/current streak/i)).toBeInTheDocument();
    });
  });

  describe('CompletionChart', () => {
    it('should render with empty data', () => {
      render(<CompletionChart data={[]} />);

      // Should render chart title
      expect(screen.getByText(/completion trend/i)).toBeInTheDocument();
    });

    it('should render with line chart by default', () => {
      const data = [
        { date: '2025-01-01', completed: 5, created: 3 },
        { date: '2025-01-02', completed: 2, created: 4 },
      ];

      render(<CompletionChart data={data} />);

      expect(screen.getByText(/completion trend/i)).toBeInTheDocument();
    });

    it('should render with bar chart type', () => {
      const data = Array.from({ length: 7 }, (_, i) => ({
        date: `2025-01-${String(i + 1).padStart(2, '0')}`,
        completed: Math.floor(Math.random() * 10),
        created: Math.floor(Math.random() * 10),
      }));

      render(<CompletionChart data={data} chartType="bar" />);

      expect(screen.getByText(/completion trend/i)).toBeInTheDocument();
    });

    it('should accept chart type prop', async () => {
      const data = [
        { date: '2025-01-01', completed: 5, created: 3 },
      ];

      const { rerender } = render(<CompletionChart data={data} chartType="line" />);
      expect(screen.getByText(/completion trend/i)).toBeInTheDocument();

      // Rerender with bar chart type
      rerender(<CompletionChart data={data} chartType="bar" />);

      // Chart should still be rendered
      expect(screen.getByText(/completion trend/i)).toBeInTheDocument();
    });
  });

  describe('QuadrantDistribution', () => {
    it('should render with empty data', () => {
      const distribution = {
        'urgent-important': 0,
        'not-urgent-important': 0,
        'urgent-not-important': 0,
        'not-urgent-not-important': 0,
      } as const;

      render(<QuadrantDistribution distribution={distribution} />);

      expect(screen.getByText(/quadrant distribution/i)).toBeInTheDocument();
      expect(screen.getByText(/no active tasks/i)).toBeInTheDocument();
    });

    it('should render with task distribution', () => {
      const distribution = {
        'urgent-important': 10,
        'not-urgent-important': 15,
        'urgent-not-important': 5,
        'not-urgent-not-important': 2,
      } as const;

      render(<QuadrantDistribution distribution={distribution} />);

      expect(screen.getByText(/quadrant distribution/i)).toBeInTheDocument();
    });

    it('should render pie chart', () => {
      const distribution = {
        'urgent-important': 10,
        'not-urgent-important': 20,
        'urgent-not-important': 0,
        'not-urgent-not-important': 0,
      } as const;

      render(<QuadrantDistribution distribution={distribution} />);

      expect(screen.getByText(/quadrant distribution/i)).toBeInTheDocument();
    });
  });

  describe('TagAnalytics', () => {
    it('should render empty state when no tags', () => {
      render(<TagAnalytics tagStats={[]} />);

      expect(screen.getByText(/no tags to display/i)).toBeInTheDocument();
    });

    it('should render tag statistics', () => {
      const tagStats = [
        { tag: 'work', count: 15, completionRate: 80, completedCount: 0 },
        { tag: 'personal', count: 10, completionRate: 60, completedCount: 0 },
        { tag: 'urgent', count: 5, completionRate: 100, completedCount: 0 },
      ];

      render(<TagAnalytics tagStats={tagStats} />);

      expect(screen.getByText('work')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();

      expect(screen.getByText('personal')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('60%')).toBeInTheDocument();
    });

    it('should show completion rate progress bars', () => {
      const tagStats = [
        { tag: 'work', count: 10, completionRate: 75, completedCount: 0 },
      ];

      render(<TagAnalytics tagStats={tagStats} />);

      // Progress bar should be rendered
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('should handle 0% completion rate', () => {
      const tagStats = [
        { tag: 'new', count: 5, completionRate: 0, completedCount: 0 },
      ];

      render(<TagAnalytics tagStats={tagStats} />);

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should handle 100% completion rate', () => {
      const tagStats = [
        { tag: 'done', count: 5, completionRate: 100, completedCount: 0 },
      ];

      render(<TagAnalytics tagStats={tagStats} />);

      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  describe('UpcomingDeadlines', () => {
    const now = Date.now();
    const oneDayMs = 86400000;

    const testTasks: TaskRecord[] = [
      {
        id: 'overdue-1',
        title: 'Late Task',
        description: '',
        urgent: true,
        important: true,
        quadrant: 'urgent-important',
        completed: false,
        dueDate: new Date(now - oneDayMs).toISOString(),
        createdAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
        recurrence: 'none',
        tags: [],
        subtasks: [],
        dependencies: [],
        vectorClock: {}, notificationEnabled: true, notificationSent: false,
      },
      {
        id: 'today-1',
        title: 'Due Today',
        description: '',
        urgent: true,
        important: true,
        quadrant: 'urgent-important',
        completed: false,
        dueDate: new Date(now).toISOString(),
        createdAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
        recurrence: 'none',
        tags: [],
        subtasks: [],
        dependencies: [],
        vectorClock: {}, notificationEnabled: true, notificationSent: false,
      },
      {
        id: 'week-1',
        title: 'Due This Week',
        description: '',
        urgent: false,
        important: true,
        quadrant: 'not-urgent-important',
        completed: false,
        dueDate: new Date(now + 3 * oneDayMs).toISOString(),
        createdAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
        recurrence: 'none',
        tags: [],
        subtasks: [],
        dependencies: [],
        vectorClock: {}, notificationEnabled: true, notificationSent: false,
      },
    ];

    it('should render empty state when no upcoming deadlines', () => {
      render(<UpcomingDeadlines tasks={[]} />);

      expect(screen.getByText(/no upcoming deadlines/i)).toBeInTheDocument();
    });

    it('should show overdue tasks', () => {
      render(<UpcomingDeadlines tasks={testTasks} />);

      expect(screen.getByText('Late Task')).toBeInTheDocument();
      expect(screen.getByText(/overdue/i)).toBeInTheDocument();
    });

    it('should show tasks due today', () => {
      render(<UpcomingDeadlines tasks={testTasks} />);

      expect(screen.getByRole('button', { name: /Due Today/i })).toBeInTheDocument();
      expect(screen.getByText(/due today \(1\)/i)).toBeInTheDocument();
    });

    it('should show tasks due this week', () => {
      render(<UpcomingDeadlines tasks={testTasks} />);

      expect(screen.getByText('Due This Week')).toBeInTheDocument();
    });

    it('should group tasks by category', () => {
      render(<UpcomingDeadlines tasks={testTasks} />);

      // Should have section headers or content
      expect(screen.getByText(/overdue \(1\)/i)).toBeInTheDocument();
      expect(screen.getByText(/due today \(1\)/i)).toBeInTheDocument();
    });

    it('should make tasks clickable to navigate', () => {
      const onTaskClick = vi.fn();
      render(<UpcomingDeadlines tasks={testTasks} onTaskClick={onTaskClick} />);

      expect(screen.getByText('Late Task')).toBeInTheDocument();
    });

    it('should show count of overdue tasks', () => {
      render(<UpcomingDeadlines tasks={testTasks} />);

      // Should show overdue section
      expect(screen.getByText(/overdue/i)).toBeInTheDocument();
    });

    it('should not show completed tasks', () => {
      const tasksWithCompleted: TaskRecord[] = [
        ...testTasks,
        {
          id: 'completed-overdue',
          title: 'Completed Overdue',
          description: '',
          urgent: true,
          important: true,
          quadrant: 'urgent-important',
          completed: true,
          completedAt: new Date().toISOString(),
          dueDate: new Date(Date.now() - oneDayMs).toISOString(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          recurrence: 'none',
          tags: [],
          subtasks: [],
          dependencies: [],
          vectorClock: {}, notificationEnabled: true, notificationSent: false,
        },
      ];

      render(<UpcomingDeadlines tasks={tasksWithCompleted} />);

      // Completed task should not be displayed
      expect(screen.queryByText('Completed Overdue')).not.toBeInTheDocument();
      // But uncompleted tasks should still be visible
      expect(screen.getByText('Late Task')).toBeInTheDocument();
    });
  });
});
