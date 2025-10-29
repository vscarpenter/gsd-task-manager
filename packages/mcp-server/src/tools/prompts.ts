import type { Prompt } from '@modelcontextprotocol/sdk/types.js';

/**
 * Prompt definitions for common task management workflows
 * Prompts provide pre-built conversational templates for Claude
 */

export const dailyStandupPrompt: Prompt = {
  name: 'daily-standup',
  description: "Daily task review: today's tasks, overdue items, and productivity summary",
  arguments: [],
};

export const weeklyReviewPrompt: Prompt = {
  name: 'weekly-review',
  description: 'Weekly productivity analysis: completion stats, trends, and top quadrants',
  arguments: [],
};

export const focusModePrompt: Prompt = {
  name: 'focus-mode',
  description: 'Get urgent and important tasks (Q1: Do First) to focus on right now',
  arguments: [],
};

export const upcomingDeadlinesPrompt: Prompt = {
  name: 'upcoming-deadlines',
  description: 'Show all overdue tasks, tasks due today, and tasks due this week',
  arguments: [],
};

export const productivityReportPrompt: Prompt = {
  name: 'productivity-report',
  description: 'Comprehensive productivity report with metrics, streaks, and insights',
  arguments: [],
};

export const tagAnalysisPrompt: Prompt = {
  name: 'tag-analysis',
  description: 'Analyze task distribution and completion rates by tags/projects',
  arguments: [],
};

export const allPrompts: Prompt[] = [
  dailyStandupPrompt,
  weeklyReviewPrompt,
  focusModePrompt,
  upcomingDeadlinesPrompt,
  productivityReportPrompt,
  tagAnalysisPrompt,
];

/**
 * Get prompt message for a given prompt name
 */
export function getPromptMessage(name: string): { role: string; content: { type: string; text: string } } {
  const prompts: Record<string, string> = {
    'daily-standup': `Give me a daily standup report:

1. Show tasks due today
2. Show overdue tasks
3. Show tasks I completed today
4. Give me a quick productivity summary

Make it concise and actionable.`,

    'weekly-review': `Give me a weekly productivity review:

1. Tasks completed this week vs last week
2. Current streak status
3. Quadrant distribution analysis
4. Top tags and their completion rates
5. Key insights and recommendations

Format as a professional status report.`,

    'focus-mode': `Help me focus right now:

1. List all urgent AND important tasks (Q1: Do First quadrant)
2. Prioritize by due date (overdue first, then soonest)
3. Highlight any blocking dependencies
4. Suggest which task to start with

Keep it brief - I need to get to work!`,

    'upcoming-deadlines': `Show me all upcoming deadlines:

1. Overdue tasks (most urgent)
2. Tasks due today
3. Tasks due this week

For each group, show task titles and how overdue/soon they are. Flag any that have dependencies.`,

    'productivity-report': `Generate a comprehensive productivity report:

1. Overall task statistics (active, completed, total)
2. Completion metrics (today, this week, this month)
3. Streak analysis (current and longest)
4. Quadrant performance breakdown
5. Tag-based insights
6. Upcoming deadlines summary
7. Key recommendations for improvement

Format as an executive summary with key takeaways.`,

    'tag-analysis': `Analyze my tasks by tags:

1. List all tags with task counts
2. Show completion rates for each tag
3. Identify high-performing and low-performing tags
4. Suggest which projects/areas need attention
5. Highlight any patterns (e.g., work tags vs personal tags)

Help me understand where my time is going.`,
  };

  const text = prompts[name];
  if (!text) {
    throw new Error(`Unknown prompt: ${name}`);
  }

  return {
    role: 'user',
    content: {
      type: 'text',
      text,
    },
  };
}
