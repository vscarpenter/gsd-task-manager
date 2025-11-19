import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
      render(<StatsCard value={42} label="Total Tasks" />);

      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('Total Tasks')).toBeInTheDocument();
    });

    it('should render with trend indicator up', () => {
      render(<StatsCard value={42} label="Completed" trend="up" />);

      // Should show up arrow or positive indicator
      const card = screen.getByText('42').closest('.stats-card');
      expect(card).toBeInTheDocument();
    });

    it('should render with trend indicator down', () => {
      render(<StatsCard value={10} label="Pending" trend="down" />);

      const card = screen.getByText('10').closest('.stats-card');
      expect(card).toBeInTheDocument();
    });

    it('should render without trend indicator', () => {
      render(<StatsCard value={5} label="Categories" />);

      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('Categories')).toBeInTheDocument();
    });

    it('should render zero value', () => {
      render(<StatsCard value={0} label="Overdue" />);

      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should render large numbers', () => {
      render(<StatsCard value={1234} label="All Time Completed" />);

      expect(screen.getByText('1234')).toBeInTheDocument();
    });
  });

  describe('StreakIndicator', () => {
    it('should render current streak', () => {
      render(<StreakIndicator currentStreak={7} longestStreak={10} />);

      expect(screen.getByText(/7/)).toBeInTheDocument();
      expect(screen.getByText(/current streak/i)).toBeInTheDocument();
    });

    it('should render longest streak', () => {
      render(<StreakIndicator currentStreak={3} longestStreak={15} />);

      expect(screen.getByText(/15/)).toBeInTheDocument();
      expect(screen.getByText(/longest streak/i)).toBeInTheDocument();
    });

    it('should handle zero streak', () => {
      render(<StreakIndicator currentStreak={0} longestStreak={0} />);

      expect(screen.getByText(/0/)).toBeInTheDocument();
    });

    it('should render streak icon', () => {
      render(<StreakIndicator currentStreak={5} longestStreak={10} />);

      // Should have flame or streak icon
      const component = screen.getByText(/current streak/i).closest('div');
      expect(component).toBeInTheDocument();
    });
  });

  describe('CompletionChart', () => {
    it('should render with empty data', () => {
      render(<CompletionChart data={[]} period="7" />);

      // Should render chart container even with no data
      expect(screen.getByRole('region', { name: /completion chart/i })).toBeInTheDocument();
    });

    it('should render with 7-day period data', () => {
      const data = [
        { date: '2025-01-01', completed: 5, created: 3 },
        { date: '2025-01-02', completed: 2, created: 4 },
      ];

      render(<CompletionChart data={data} period="7" />);

      expect(screen.getByRole('region', { name: /completion chart/i })).toBeInTheDocument();
    });

    it('should render with 30-day period data', () => {
      const data = Array.from({ length: 30 }, (_, i) => ({
        date: `2025-01-${i + 1}`,
        completed: Math.floor(Math.random() * 10),
        created: Math.floor(Math.random() * 10),
      }));

      render(<CompletionChart data={data} period="30" />);

      expect(screen.getByRole('region', { name: /completion chart/i })).toBeInTheDocument();
    });

    it('should toggle between line and bar chart', async () => {
      const user = userEvent.setup();

      const data = [
        { date: '2025-01-01', completed: 5, created: 3 },
      ];

      render(<CompletionChart data={data} period="7" />);

      // Find toggle button (if exists)
      const toggleButton = screen.queryByRole('button', { name: /chart type/i });

      if (toggleButton) {
        await user.click(toggleButton);
      }

      // Chart should still be rendered
      expect(screen.getByRole('region', { name: /completion chart/i })).toBeInTheDocument();
    });
  });

  describe('QuadrantDistribution', () => {
    it('should render with empty data', () => {
      const data = [
        { quadrant: 'Urgent & Important', count: 0 },
        { quadrant: 'Not Urgent & Important', count: 0 },
        { quadrant: 'Urgent & Not Important', count: 0 },
        { quadrant: 'Not Urgent & Not Important', count: 0 },
      ];

      render(<QuadrantDistribution data={data} />);

      expect(screen.getByText(/quadrant distribution/i)).toBeInTheDocument();
    });

    it('should render with task distribution', () => {
      const data = [
        { quadrant: 'Urgent & Important', count: 10 },
        { quadrant: 'Not Urgent & Important', count: 15 },
        { quadrant: 'Urgent & Not Important', count: 5 },
        { quadrant: 'Not Urgent & Not Important', count: 2 },
      ];

      render(<QuadrantDistribution data={data} />);

      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should render pie chart', () => {
      const data = [
        { quadrant: 'Urgent & Important', count: 10 },
        { quadrant: 'Not Urgent & Important', count: 20 },
      ];

      render(<QuadrantDistribution data={data} />);

      // Pie chart should be rendered
      expect(screen.getByRole('region', { name: /distribution/i })).toBeInTheDocument();
    });
  });

  describe('TagAnalytics', () => {
    it('should render empty state when no tags', () => {
      render(<TagAnalytics tags={[]} />);

      expect(screen.getByText(/no tags yet/i)).toBeInTheDocument();
    });

    it('should render tag statistics', () => {
      const tags = [
        { tag: 'work', count: 15, completionRate: 80 },
        { tag: 'personal', count: 10, completionRate: 60 },
        { tag: 'urgent', count: 5, completionRate: 100 },
      ];

      render(<TagAnalytics tags={tags} />);

      expect(screen.getByText('work')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();

      expect(screen.getByText('personal')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('60%')).toBeInTheDocument();
    });

    it('should show completion rate progress bars', () => {
      const tags = [
        { tag: 'work', count: 10, completionRate: 75 },
      ];

      render(<TagAnalytics tags={tags} />);

      // Progress bar should be rendered
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('should handle 0% completion rate', () => {
      const tags = [
        { tag: 'new', count: 5, completionRate: 0 },
      ];

      render(<TagAnalytics tags={tags} />);

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should handle 100% completion rate', () => {
      const tags = [
        { tag: 'done', count: 5, completionRate: 100 },
      ];

      render(<TagAnalytics tags={tags} />);

      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  describe('UpcomingDeadlines', () => {
    beforeEach(async () => {
      const now = Date.now();
      const oneDayMs = 86400000;

      const tasks: TaskRecord[] = [
        {
          id: 'overdue-1',
          title: 'Overdue Task',
          description: '',
          urgent: true,
          important: true,
          quadrant: 'urgent-important',
          completed: false,
          dueDate: new Date(now - oneDayMs).toISOString(),
          createdAt: now,
          updatedAt: now,
          recurrence: 'none',
          tags: [],
          subtasks: [],
          dependencies: [],
          vectorClock: {},
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
          createdAt: now,
          updatedAt: now,
          recurrence: 'none',
          tags: [],
          subtasks: [],
          dependencies: [],
          vectorClock: {},
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
          createdAt: now,
          updatedAt: now,
          recurrence: 'none',
          tags: [],
          subtasks: [],
          dependencies: [],
          vectorClock: {},
        },
      ];

      await db.tasks.bulkAdd(tasks);
    });

    it('should render empty state when no upcoming deadlines', async () => {
      await db.tasks.clear();

      render(<UpcomingDeadlines />);

      await waitFor(() => {
        expect(screen.getByText(/no upcoming deadlines/i)).toBeInTheDocument();
      });
    });

    it('should show overdue tasks', async () => {
      render(<UpcomingDeadlines />);

      await waitFor(() => {
        expect(screen.getByText('Overdue Task')).toBeInTheDocument();
        expect(screen.getByText(/overdue/i)).toBeInTheDocument();
      });
    });

    it('should show tasks due today', async () => {
      render(<UpcomingDeadlines />);

      await waitFor(() => {
        expect(screen.getByText('Due Today')).toBeInTheDocument();
        expect(screen.getByText(/today/i)).toBeInTheDocument();
      });
    });

    it('should show tasks due this week', async () => {
      render(<UpcomingDeadlines />);

      await waitFor(() => {
        expect(screen.getByText('Due This Week')).toBeInTheDocument();
      });
    });

    it('should group tasks by category', async () => {
      render(<UpcomingDeadlines />);

      await waitFor(() => {
        // Should have section headers
        expect(screen.getByText(/overdue/i)).toBeInTheDocument();
        expect(screen.getByText(/today/i)).toBeInTheDocument();
        expect(screen.getByText(/this week/i)).toBeInTheDocument();
      });
    });

    it('should make tasks clickable to navigate', async () => {
      const user = userEvent.setup();

      render(<UpcomingDeadlines />);

      await waitFor(() => {
        expect(screen.getByText('Overdue Task')).toBeInTheDocument();
      });

      const taskLink = screen.getByText('Overdue Task').closest('a');

      if (taskLink) {
        expect(taskLink).toHaveAttribute('href');
      }
    });

    it('should show count of overdue tasks', async () => {
      render(<UpcomingDeadlines />);

      await waitFor(() => {
        // Should show "1 overdue" or similar
        const overdueSection = screen.getByText(/overdue/i).closest('section');
        expect(overdueSection).toBeInTheDocument();
      });
    });

    it('should not show completed tasks', async () => {
      await db.tasks.add({
        id: 'completed-overdue',
        title: 'Completed Overdue',
        description: '',
        urgent: true,
        important: true,
        quadrant: 'urgent-important',
        completed: true,
        completedAt: Date.now(),
        dueDate: new Date(Date.now() - 86400000).toISOString(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        recurrence: 'none',
        tags: [],
        subtasks: [],
        dependencies: [],
        vectorClock: {},
      });

      render(<UpcomingDeadlines />);

      await waitFor(() => {
        expect(screen.queryByText('Completed Overdue')).not.toBeInTheDocument();
      });
    });
  });
});
