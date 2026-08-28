import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatsCard } from '@/components/dashboard/stats-card';
import { CompletionChart } from '@/components/dashboard/completion-chart';
import { QuadrantDistribution } from '@/components/dashboard/quadrant-distribution';
import { StreakIndicator } from '@/components/dashboard/streak-indicator';
import { TagAnalytics } from '@/components/dashboard/tag-analytics';
import { UpcomingDeadlines } from '@/components/dashboard/upcoming-deadlines';
import { TimeAnalytics } from '@/components/dashboard/time-analytics';
import {
  DashboardSkeleton,
  StatRailSkeleton,
  VerdictSkeleton,
} from '@/components/dashboard/dashboard-skeleton';
import { getDb } from '@/lib/db';
import type { TaskRecord } from '@/lib/types';
import type { TimeTrackingSummary, QuadrantTimeDistribution } from '@/lib/analytics';
import { createMockTask } from '@/tests/fixtures';

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
      render(<StatsCard value={42} title="Total tasks" />);

      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('Total tasks')).toBeInTheDocument();
    });

    it('should render a comparison as plain text, with no arrow glyph', () => {
      render(<StatsCard value={42} title="Closed today" note="15% above your recent pace" />);

      expect(screen.getByText(/15% above your recent pace/)).toBeInTheDocument();
      expect(screen.queryByText(/[\u2191\u2193]/)).not.toBeInTheDocument();
    });

    it('should render a downward comparison with the same neutral treatment', () => {
      const { container } = render(
        <StatsCard value={10} title="Closed today" note="8% below your recent pace" />
      );

      const note = screen.getByText(/8% below your recent pace/);
      expect(note).toBeInTheDocument();
      // Direction is carried by the words, never by colour (recipe acceptance bar).
      expect(note.className).toContain('text-foreground-muted');
      expect(container.querySelector('.text-status-overdue-ink')).not.toBeInTheDocument();
    });

    it('should render without a comparison', () => {
      render(<StatsCard value={5} title="Categories" />);

      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('Categories')).toBeInTheDocument();
    });

    it('should render zero value', () => {
      render(<StatsCard value={0} title="Overdue" />);

      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should render large numbers', () => {
      render(<StatsCard value={1234} title="All time closed" />);

      expect(screen.getByText('1234')).toBeInTheDocument();
    });

    it('should render without icon', () => {
      render(<StatsCard value={5} title="No icon" />);

      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('No icon')).toBeInTheDocument();
    });

    it('should render meta context when provided', () => {
      render(<StatsCard value={5} title="Active" meta="20 closed in 7 days" />);

      expect(screen.getByText(/20 closed in 7 days/)).toBeInTheDocument();
    });

    it('should render as a rail item, not a bordered card', () => {
      const { container } = render(<StatsCard value={5} title="Active" />);
      const root = container.firstElementChild as HTMLElement;

      // The hero band groups these with hairline dividers; a card border here
      // would rebuild the equal-weight card grid the recipe bans.
      expect(root.className).not.toContain('bg-card');
      expect(root.className).not.toContain('border-hair');
    });

    it('should render an inline sparkline when series has 2+ points', () => {
      const { container } = render(
        <StatsCard value={5} title="Trend" series={[1, 2, 3, 4, 5]} />
      );

      // Sparkline is an SVG polyline; presence is enough to verify the wiring.
      expect(container.querySelector('svg polyline')).toBeInTheDocument();
    });

    it('should draw every sparkline in the same neutral ink', () => {
      const { container } = render(
        <StatsCard value={5} title="Trend" series={[5, 4, 3, 2, 1]} />
      );

      // A seven-point series is not a judgement, so it never borrows the accent
      // or the overdue pigment (brief: tide means interaction, not decoration).
      const line = container.querySelector('svg polyline');
      expect(line?.getAttribute('class')).toContain('stroke-ink-hint');
    });
  });

  describe('StreakIndicator', () => {
    it('should render current streak count', () => {
      render(<StreakIndicator streakData={{ current: 7, longest: 10, lastCompletionDate: null, last7Days: [true, true, true, true, true, true, true] }} />);

      expect(screen.getByText('7')).toBeInTheDocument();
      expect(screen.getByText(/streak/i)).toBeInTheDocument();
    });

    it('should size to its content rather than stretching to fill', () => {
      const { container } = render(
        <StreakIndicator streakData={{ current: 3, longest: 15, lastCompletionDate: null, last7Days: [false, false, false, false, true, true, true] }} />
      );
      const root = container.firstElementChild as HTMLElement;

      // Regression: h-full resolved 100% against a grid row sized by the chart
      // beside it, overflowing 199px into the reflection prompts band below.
      expect(root.className).not.toContain('h-full');
    });

    it('should render longest streak as "Best" label', () => {
      render(<StreakIndicator streakData={{ current: 3, longest: 15, lastCompletionDate: null, last7Days: [false, false, false, false, true, true, true] }} />);

      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText(/best.*15/i)).toBeInTheDocument();
    });

    it('should handle zero streak with zero longest', () => {
      render(<StreakIndicator streakData={{ current: 0, longest: 0, lastCompletionDate: null, last7Days: [false, false, false, false, false, false, false] }} />);

      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText(/no streak yet/i)).toBeInTheDocument();
      // No "Best" label when longest is 0
      expect(screen.queryByText(/best/i)).not.toBeInTheDocument();
    });

    it('should render streak icon and label', () => {
      render(<StreakIndicator streakData={{ current: 5, longest: 10, lastCompletionDate: null, last7Days: [false, false, true, true, true, true, true] }} />);

      expect(screen.getByText(/streak/i)).toBeInTheDocument();
    });

    it('should render 7-day activity dots with labels', () => {
      render(<StreakIndicator streakData={{ current: 3, longest: 5, lastCompletionDate: null, last7Days: [false, false, false, false, true, true, true] }} />);

      expect(screen.getByText('Today')).toBeInTheDocument();
      expect(screen.getByText('6d')).toBeInTheDocument();
      expect(screen.getByText('1d')).toBeInTheDocument();
    });

    it('should not render gamified milestone badges', () => {
      render(<StreakIndicator streakData={{ current: 100, longest: 100, lastCompletionDate: null, last7Days: [true, true, true, true, true, true, true] }} />);

      // Milestone trophy badges were removed for the calm dashboard voice.
      expect(screen.queryByText('100 days')).not.toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
    });

    it('should show singular "day" for streak of 1', () => {
      render(<StreakIndicator streakData={{ current: 1, longest: 5, lastCompletionDate: null, last7Days: [false, false, false, false, false, false, true] }} />);

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('day')).toBeInTheDocument();
    });
  });

  describe('CompletionChart', () => {
    it('should render with empty data', () => {
      render(<CompletionChart data={[]} />);

      expect(screen.getByText(/completion trend/i)).toBeInTheDocument();
    });

    it('should render area chart', () => {
      const data = [
        { date: '2025-01-01', completed: 5, created: 3 },
        { date: '2025-01-02', completed: 2, created: 4 },
      ];

      render(<CompletionChart data={data} />);

      expect(screen.getByText(/completion trend/i)).toBeInTheDocument();
    });

    it('should render with multiple data points', () => {
      const data = Array.from({ length: 7 }, (_, i) => ({
        date: `2025-01-${String(i + 1).padStart(2, '0')}`,
        completed: Math.floor(Math.random() * 10),
        created: Math.floor(Math.random() * 10),
      }));

      render(<CompletionChart data={data} />);

      expect(screen.getByText(/completion trend/i)).toBeInTheDocument();
    });

    it('should render legend labels', () => {
      const data = [
        { date: '2025-01-01', completed: 5, created: 3 },
      ];

      render(<CompletionChart data={data} />);

      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Created')).toBeInTheDocument();
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
      expect(screen.getByText(/no active work to split yet/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Open matrix' })).toHaveAttribute('href', '/');
    });

    it('should render with task distribution and show total in center', () => {
      const distribution = {
        'urgent-important': 10,
        'not-urgent-important': 15,
        'urgent-not-important': 5,
        'not-urgent-not-important': 2,
      } as const;

      render(<QuadrantDistribution distribution={distribution} />);

      expect(screen.getByText(/quadrant distribution/i)).toBeInTheDocument();
      expect(screen.getByText('32')).toBeInTheDocument();
      expect(screen.getByText('active')).toBeInTheDocument();
    });

    it('should render donut chart with legend for non-zero quadrants', () => {
      const distribution = {
        'urgent-important': 10,
        'not-urgent-important': 20,
        'urgent-not-important': 0,
        'not-urgent-not-important': 0,
      } as const;

      render(<QuadrantDistribution distribution={distribution} />);

      expect(screen.getByText('Do First')).toBeInTheDocument();
      expect(screen.getByText('Schedule')).toBeInTheDocument();
      // Zero quadrants should not appear in legend
      expect(screen.queryByText('Delegate')).not.toBeInTheDocument();
      expect(screen.queryByText('Eliminate')).not.toBeInTheDocument();
    });

    it('should show individual counts in legend', () => {
      const distribution = {
        'urgent-important': 8,
        'not-urgent-important': 12,
        'urgent-not-important': 3,
        'not-urgent-not-important': 0,
      } as const;

      render(<QuadrantDistribution distribution={distribution} />);

      expect(screen.getByText('8')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should render with single quadrant populated', () => {
      const distribution = {
        'urgent-important': 5,
        'not-urgent-important': 0,
        'urgent-not-important': 0,
        'not-urgent-not-important': 0,
      } as const;

      render(<QuadrantDistribution distribution={distribution} />);

      const fives = screen.getAllByText('5');
      expect(fives.length).toBe(2); // center total + legend count
      expect(screen.getByText('Do First')).toBeInTheDocument();
    });
  });

  describe('TagAnalytics', () => {
    it('should render empty state when no tags', () => {
      render(<TagAnalytics tagStats={[]} />);

      expect(screen.getByText(/tag a task to see how each tag is tracking/i)).toBeInTheDocument();
    });

    it('should render tag statistics with completion info', () => {
      const tagStats = [
        { tag: 'work', count: 15, completionRate: 80, completedCount: 12 },
        { tag: 'personal', count: 10, completionRate: 60, completedCount: 6 },
        { tag: 'urgent', count: 5, completionRate: 100, completedCount: 5 },
      ];

      render(<TagAnalytics tagStats={tagStats} />);

      expect(screen.getByText('work')).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();
      expect(screen.getByText('12/15 done')).toBeInTheDocument();

      expect(screen.getByText('personal')).toBeInTheDocument();
      expect(screen.getByText('60%')).toBeInTheDocument();
    });

    it('should show completion rate progress bars', () => {
      const tagStats = [
        { tag: 'work', count: 10, completionRate: 75, completedCount: 7 },
      ];

      render(<TagAnalytics tagStats={tagStats} />);

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
        { tag: 'done', count: 5, completionRate: 100, completedCount: 5 },
      ];

      render(<TagAnalytics tagStats={tagStats} />);

      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('should respect maxTags limit', () => {
      const tagStats = Array.from({ length: 15 }, (_, i) => ({
        tag: `tag-${i}`,
        count: 10 - i,
        completionRate: 50,
        completedCount: 5,
      }));

      render(<TagAnalytics tagStats={tagStats} maxTags={3} />);

      expect(screen.getByText('tag-0')).toBeInTheDocument();
      expect(screen.getByText('tag-2')).toBeInTheDocument();
      expect(screen.queryByText('tag-3')).not.toBeInTheDocument();
    });
  });

  describe('TimeAnalytics', () => {
    const emptySummary: TimeTrackingSummary = {
      totalMinutesTracked: 0,
      totalMinutesEstimated: 0,
      tasksWithTimeTracking: 0,
      tasksWithEstimates: 0,
      tasksWithRunningTimers: 0,
      estimationAccuracy: 0,
      overEstimateTasks: 0,
      underEstimateTasks: 0,
    };

    const emptyDistribution: QuadrantTimeDistribution[] = [];

    it('should render empty state when no time data', () => {
      render(<TimeAnalytics summary={emptySummary} quadrantDistribution={emptyDistribution} />);

      expect(screen.getByRole('heading', { name: /time tracking/i })).toBeInTheDocument();
      expect(screen.getByText(/track time on a task to see where your hours go/i)).toBeInTheDocument();
    });

    it('should render summary stats when time data exists', () => {
      const summary: TimeTrackingSummary = {
        totalMinutesTracked: 150,
        totalMinutesEstimated: 180,
        tasksWithTimeTracking: 5,
        tasksWithEstimates: 4,
        tasksWithRunningTimers: 0,
        estimationAccuracy: 83,
        overEstimateTasks: 0,
        underEstimateTasks: 0,
      };

      render(<TimeAnalytics summary={summary} quadrantDistribution={emptyDistribution} />);

      expect(screen.getByText('Total tracked')).toBeInTheDocument();
      expect(screen.getByText('Total estimated')).toBeInTheDocument();
      expect(screen.getByText('Estimation accuracy')).toBeInTheDocument();
      expect(screen.getByText('Running timers')).toBeInTheDocument();
    });

    it('should show "good accuracy" label for accuracy 80-120', () => {
      const summary: TimeTrackingSummary = {
        ...emptySummary,
        tasksWithTimeTracking: 3,
        totalMinutesTracked: 100,
        estimationAccuracy: 95,
      };

      render(<TimeAnalytics summary={summary} quadrantDistribution={emptyDistribution} />);

      expect(screen.getByText('good accuracy')).toBeInTheDocument();
    });

    it('should show "under-estimating" label for low accuracy', () => {
      const summary: TimeTrackingSummary = {
        ...emptySummary,
        tasksWithTimeTracking: 3,
        totalMinutesTracked: 100,
        estimationAccuracy: 60,
      };

      render(<TimeAnalytics summary={summary} quadrantDistribution={emptyDistribution} />);

      expect(screen.getByText('under-estimating')).toBeInTheDocument();
    });

    it('should show "over-estimating" label for high accuracy', () => {
      const summary: TimeTrackingSummary = {
        ...emptySummary,
        tasksWithTimeTracking: 3,
        totalMinutesTracked: 100,
        estimationAccuracy: 150,
      };

      render(<TimeAnalytics summary={summary} quadrantDistribution={emptyDistribution} />);

      expect(screen.getByText('over-estimating')).toBeInTheDocument();
    });

    it('should show "not enough data" when accuracy is 0', () => {
      const summary: TimeTrackingSummary = {
        ...emptySummary,
        tasksWithTimeTracking: 1,
        totalMinutesTracked: 30,
        estimationAccuracy: 0,
      };

      render(<TimeAnalytics summary={summary} quadrantDistribution={emptyDistribution} />);

      expect(screen.getByText('not enough data')).toBeInTheDocument();
    });

    it('should show an em-dash for accuracy value when accuracy is 0', () => {
      const summary: TimeTrackingSummary = {
        ...emptySummary,
        tasksWithTimeTracking: 1,
        totalMinutesTracked: 30,
        estimationAccuracy: 0,
      };

      render(<TimeAnalytics summary={summary} quadrantDistribution={emptyDistribution} />);

      // Partial state: unknown is an em-dash, never "N/A" or a misleading 0.
      expect(screen.getByText('\u2014')).toBeInTheDocument();
      expect(screen.queryByText('N/A')).not.toBeInTheDocument();
    });

    it('should show running timers count with active label', () => {
      const summary: TimeTrackingSummary = {
        ...emptySummary,
        tasksWithTimeTracking: 2,
        totalMinutesTracked: 45,
        tasksWithRunningTimers: 2,
      };

      render(<TimeAnalytics summary={summary} quadrantDistribution={emptyDistribution} />);

      expect(screen.getByText('active now')).toBeInTheDocument();
    });

    it('should show "none active" when no running timers', () => {
      const summary: TimeTrackingSummary = {
        ...emptySummary,
        tasksWithTimeTracking: 2,
        totalMinutesTracked: 45,
        tasksWithRunningTimers: 0,
      };

      render(<TimeAnalytics summary={summary} quadrantDistribution={emptyDistribution} />);

      expect(screen.getByText('none active')).toBeInTheDocument();
    });

    it('should render quadrant time distribution bars', () => {
      const summary: TimeTrackingSummary = {
        ...emptySummary,
        tasksWithTimeTracking: 4,
        totalMinutesTracked: 200,
      };

      const distribution: QuadrantTimeDistribution[] = [
        { quadrantId: 'urgent-important', totalMinutes: 100, taskCount: 2, averageMinutesPerTask: 50 },
        { quadrantId: 'not-urgent-important', totalMinutes: 60, taskCount: 1, averageMinutesPerTask: 60 },
        { quadrantId: 'urgent-not-important', totalMinutes: 40, taskCount: 1, averageMinutesPerTask: 40 },
      ];

      render(<TimeAnalytics summary={summary} quadrantDistribution={distribution} />);

      expect(screen.getByText(/Do First \(Q1\)/)).toBeInTheDocument();
      expect(screen.getByText(/Schedule \(Q2\)/)).toBeInTheDocument();
      expect(screen.getByText(/Delegate \(Q3\)/)).toBeInTheDocument();
    });

    it('should render estimation insights when over/under counts exist', () => {
      const summary: TimeTrackingSummary = {
        ...emptySummary,
        tasksWithTimeTracking: 5,
        totalMinutesTracked: 200,
        overEstimateTasks: 3,
        underEstimateTasks: 2,
      };

      render(<TimeAnalytics summary={summary} quadrantDistribution={emptyDistribution} />);

      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText(/tasks over estimate/)).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText(/tasks under estimate/)).toBeInTheDocument();
    });

    it('should not render estimation insights when both counts are zero', () => {
      const summary: TimeTrackingSummary = {
        ...emptySummary,
        tasksWithTimeTracking: 2,
        totalMinutesTracked: 50,
        overEstimateTasks: 0,
        underEstimateTasks: 0,
      };

      render(<TimeAnalytics summary={summary} quadrantDistribution={emptyDistribution} />);

      expect(screen.queryByText(/tasks over estimate/)).not.toBeInTheDocument();
    });

    it('should render when only estimates exist (no tracking)', () => {
      const summary: TimeTrackingSummary = {
        ...emptySummary,
        tasksWithEstimates: 3,
        totalMinutesEstimated: 120,
      };

      render(<TimeAnalytics summary={summary} quadrantDistribution={emptyDistribution} />);

      expect(screen.getByText('Total estimated')).toBeInTheDocument();
    });

    it('should apply red color for very low accuracy', () => {
      const summary: TimeTrackingSummary = {
        ...emptySummary,
        tasksWithTimeTracking: 3,
        totalMinutesTracked: 100,
        estimationAccuracy: 40,
      };

      const { container } = render(
        <TimeAnalytics summary={summary} quadrantDistribution={emptyDistribution} />
      );

      // Should render with the danger (overdue) accuracy color
      const accuracyValue = container.querySelector('.text-status-overdue-ink');
      expect(accuracyValue).toBeInTheDocument();
    });

    it('should apply amber color for moderately off accuracy', () => {
      const summary: TimeTrackingSummary = {
        ...emptySummary,
        tasksWithTimeTracking: 3,
        totalMinutesTracked: 100,
        estimationAccuracy: 130,
      };

      const { container } = render(
        <TimeAnalytics summary={summary} quadrantDistribution={emptyDistribution} />
      );

      const accuracyValue = container.querySelector('.text-warning-dark');
      expect(accuracyValue).toBeInTheDocument();
    });
  });

  describe('DashboardSkeleton', () => {
    it('should render skeleton layout structure', () => {
      const { container } = render(<DashboardSkeleton />);

      // Should render the grid structure
      const grids = container.querySelectorAll('.grid');
      expect(grids.length).toBeGreaterThanOrEqual(3); // stats row + chart row + bottom row
    });

    it('should leave the measure rail to the header skeleton', () => {
      const { container } = render(<DashboardSkeleton />);

      // The three measures live in the hero band now, so the body skeleton must
      // not reserve a four-up card row the page will never render.
      expect(container.querySelector('.lg\\:grid-cols-4')).not.toBeInTheDocument();
    });

    it('should render three rail measures behind hairline dividers', () => {
      const { container } = render(<StatRailSkeleton />);

      const rail = container.querySelector('.sm\\:grid-cols-3');
      expect(rail).toBeInTheDocument();
      expect(rail?.children.length).toBe(3);
      expect(rail?.className).toContain('divide-x');
    });

    it('should hold the verdict geometry while the local read resolves', () => {
      const { container } = render(<VerdictSkeleton />);

      // Two lines, matching the serif lead and its observation.
      const root = container.firstElementChild as HTMLElement;
      expect(root.children.length).toBe(2);
      expect(root.getAttribute('aria-hidden')).toBe('true');
    });

    it('should render chart and donut skeletons in second row', () => {
      const { container } = render(<DashboardSkeleton />);

      const chartRow = container.querySelector('.lg\\:grid-cols-3');
      expect(chartRow).toBeInTheDocument();
    });

    it('should render list skeletons in bottom row', () => {
      const { container } = render(<DashboardSkeleton />);

      const bottomRow = container.querySelector('.lg\\:grid-cols-2');
      expect(bottomRow).toBeInTheDocument();
      expect(bottomRow?.children.length).toBe(2);
    });
  });

  describe('UpcomingDeadlines', () => {
    const now = Date.now();
    const oneDayMs = 86400000;

    const testTasks: TaskRecord[] = [
      createMockTask({
        id: 'overdue-1',
        title: 'Late Task',
        dueDate: new Date(now - oneDayMs).toISOString(),
      }),
      createMockTask({
        id: 'today-1',
        title: 'Due Today',
        dueDate: new Date(now).toISOString(),
      }),
      createMockTask({
        id: 'week-1',
        title: 'Due This Week',
        urgent: false,
        quadrant: 'not-urgent-important',
        dueDate: new Date(now + 3 * oneDayMs).toISOString(),
      }),
    ];

    it('should render empty state when no upcoming deadlines', () => {
      render(<UpcomingDeadlines tasks={[]} />);

      expect(screen.getByText(/no deadlines in the next seven days/i)).toBeInTheDocument();
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

      expect(screen.getByText(/overdue \(1\)/i)).toBeInTheDocument();
      expect(screen.getByText(/due today \(1\)/i)).toBeInTheDocument();
    });

    it('should call onTaskClick when task is clicked', async () => {
      const user = userEvent.setup();
      const onTaskClick = vi.fn();
      render(<UpcomingDeadlines tasks={testTasks} onTaskClick={onTaskClick} />);

      const lateTaskButton = screen.getByRole('button', { name: /Late Task/i });
      await user.click(lateTaskButton);

      expect(onTaskClick).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'overdue-1', title: 'Late Task' })
      );
    });

    it('should show count of overdue tasks', () => {
      render(<UpcomingDeadlines tasks={testTasks} />);

      expect(screen.getByText(/overdue/i)).toBeInTheDocument();
    });

    it('should not show completed tasks', () => {
      const tasksWithCompleted: TaskRecord[] = [
        ...testTasks,
        createMockTask({
          id: 'completed-overdue',
          title: 'Completed Overdue',
          completed: true,
          completedAt: new Date().toISOString(),
          dueDate: new Date(Date.now() - oneDayMs).toISOString(),
        }),
      ];

      render(<UpcomingDeadlines tasks={tasksWithCompleted} />);

      expect(screen.queryByText('Completed Overdue')).not.toBeInTheDocument();
      expect(screen.getByText('Late Task')).toBeInTheDocument();
    });

    it('should show overflow indicator when more than 5 tasks in a section', () => {
      const manyOverdueTasks = Array.from({ length: 7 }, (_, i) =>
        createMockTask({
          id: `overdue-${i}`,
          title: `Overdue Task ${i}`,
          dueDate: new Date(now - oneDayMs * (i + 1)).toISOString(),
        })
      );

      render(<UpcomingDeadlines tasks={manyOverdueTasks} />);

      expect(screen.getByText('+2 more')).toBeInTheDocument();
    });

    it('should handle tasks without onTaskClick gracefully', async () => {
      const user = userEvent.setup();
      render(<UpcomingDeadlines tasks={testTasks} />);

      // Clicking should not throw even without handler
      const lateTaskButton = screen.getByRole('button', { name: /Late Task/i });
      await user.click(lateTaskButton);
    });
  });
  describe('Finish-bar fixes', () => {
    const trackedSummary: TimeTrackingSummary = {
      totalMinutesTracked: 150,
      totalMinutesEstimated: 180,
      tasksWithTimeTracking: 5,
      tasksWithEstimates: 4,
      tasksWithRunningTimers: 1,
      estimationAccuracy: 83,
      overEstimateTasks: 1,
      underEstimateTasks: 2,
    };
    const trackedDistribution: QuadrantTimeDistribution[] = [
      { quadrantId: 'urgent-important', totalMinutes: 90, taskCount: 3 },
      { quadrantId: 'not-urgent-important', totalMinutes: 60, taskCount: 2 },
    ];
    const emptySummary: TimeTrackingSummary = {
      totalMinutesTracked: 0,
      totalMinutesEstimated: 0,
      tasksWithTimeTracking: 0,
      tasksWithEstimates: 0,
      tasksWithRunningTimers: 0,
      estimationAccuracy: 0,
      overEstimateTasks: 0,
      underEstimateTasks: 0,
    };

    it('should not animate layout properties on tag bars', () => {
      const { container } = render(
        <TagAnalytics tagStats={[{ tag: 'work', count: 4, completedCount: 2, completionRate: 50 }]} />
      );

      // width/left/top animations force reflow every frame (ui-craft-detect).
      expect(container.innerHTML).not.toMatch(/transition-\[width\]|transition-all/);
    });

    it('should not animate layout properties on quadrant time bars', () => {
      const { container } = render(
        <TimeAnalytics summary={trackedSummary} quadrantDistribution={trackedDistribution} />
      );

      expect(container.innerHTML).not.toMatch(/transition-\[width\]|transition-all/);
    });

    it('should set tabular-nums on every time-tracking figure', () => {
      const { container } = render(
        <TimeAnalytics summary={trackedSummary} quadrantDistribution={trackedDistribution} />
      );

      // Four KPI values, two quadrant rows, two estimation counts — all compared
      // against each other, so proportional figures make the columns unreadable.
      expect(container.querySelectorAll('.tabular-nums').length).toBeGreaterThanOrEqual(8);
    });

    it('should keep a border on the card built through cn()', () => {
      const { container } = render(
        <TimeAnalytics summary={trackedSummary} quadrantDistribution={trackedDistribution} />
      );
      const card = container.firstElementChild as HTMLElement;

      // twMerge groups border-hair with border-border and drops the former,
      // leaving border-width:0. `border` is a width utility it keeps.
      expect(card.className).toContain('border-border');
      expect(card.className).not.toContain('border-hair');
      expect(card.className).toMatch(/(^|\s)border(\s|$)/);
    });

    it('should offer a next step from the tags empty region', () => {
      render(<TagAnalytics tagStats={[]} />);

      expect(screen.getByText(/tag a task to see how each tag is tracking/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Open matrix' })).toHaveAttribute('href', '/');
    });

    it('should offer a next step from the time-tracking empty region', () => {
      render(<TimeAnalytics summary={emptySummary} quadrantDistribution={[]} />);

      expect(screen.getByText(/track time on a task to see where your hours go/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Open matrix' })).toHaveAttribute('href', '/');
    });

    it('should state an empty deadline list without cheerleading', () => {
      render(<UpcomingDeadlines tasks={[]} />);

      const copy = screen.getByText(/no deadlines in the next seven days/i);
      expect(copy).toBeInTheDocument();
      // brief.md anti-reference: no exclamation-point cheerleading.
      expect(copy.textContent).not.toContain('!');
    });

    it('should step the radius ladder rather than flattening it to one value', () => {
      const { container } = render(
        <TimeAnalytics summary={trackedSummary} quadrantDistribution={trackedDistribution} />
      );

      // Panel 14px (lg), the blocks nested inside it 12px (md).
      expect((container.firstElementChild as HTMLElement).className).toContain('rounded-lg');
      expect(container.querySelectorAll('.rounded-md').length).toBeGreaterThan(0);
    });

    it('should render deadline rows as controls on the control radius', () => {
      const tasks = [createMockTask({ id: 'due-1', title: 'Due soon', completed: false, dueDate: new Date(Date.now() + 86400000).toISOString() })];
      render(<UpcomingDeadlines tasks={tasks} />);

      const row = screen.getByRole('button', { name: /Due soon/i });
      expect(row.className).toContain('rounded-sm');
    });
  });
});
