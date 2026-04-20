import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebMcpRegister } from '@/components/webmcp-register';

const createTaskMock = vi.fn();

vi.mock('@/lib/tasks', () => ({
	createTask: (...args: unknown[]) => createTaskMock(...args),
}));

type Tool = {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
	execute: (input: Record<string, unknown>) => Promise<unknown>;
};

type ProvideContextArg = { tools: Tool[] };

describe('WebMcpRegister', () => {
	const provideContext = vi.fn<(arg: ProvideContextArg) => Promise<void>>();
	const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'modelContext');

	beforeEach(() => {
		provideContext.mockReset();
		provideContext.mockResolvedValue(undefined);
		createTaskMock.mockReset();
		Object.defineProperty(navigator, 'modelContext', {
			value: { provideContext },
			writable: true,
			configurable: true,
		});
	});

	afterEach(() => {
		if (originalDescriptor) {
			Object.defineProperty(navigator, 'modelContext', originalDescriptor);
		} else {
			Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, 'modelContext');
		}
	});

	it('registers a create_task tool with navigator.modelContext on mount', async () => {
		render(<WebMcpRegister />);

		await waitFor(() => expect(provideContext).toHaveBeenCalledTimes(1));

		const arg = provideContext.mock.calls[0]?.[0];
		expect(arg).toBeDefined();
		expect(arg?.tools).toHaveLength(1);
		expect(arg?.tools[0]?.name).toBe('create_task');
		expect(arg?.tools[0]?.inputSchema).toMatchObject({
			type: 'object',
			required: ['title'],
		});
	});

	it('execute() forwards normalized fields to lib/tasks createTask', async () => {
		createTaskMock.mockResolvedValue({
			id: 'task-1',
			quadrant: 'not-urgent-important',
			createdAt: '2026-04-20T00:00:00.000Z',
		});

		render(<WebMcpRegister />);
		await waitFor(() => expect(provideContext).toHaveBeenCalledTimes(1));

		const tool = provideContext.mock.calls[0]?.[0]?.tools[0];
		expect(tool).toBeDefined();
		const result = await tool!.execute({
			title: '  Write spec  ',
			urgent: true,
			important: true,
			tags: ['triage'],
		});

		expect(createTaskMock).toHaveBeenCalledWith(
			expect.objectContaining({
				title: 'Write spec',
				urgent: true,
				important: true,
				tags: ['triage'],
				recurrence: 'none',
				notificationEnabled: true,
			}),
		);
		expect(result).toEqual({
			id: 'task-1',
			quadrant: 'not-urgent-important',
			createdAt: '2026-04-20T00:00:00.000Z',
		});
	});

	it('is a no-op when navigator.modelContext is unavailable', async () => {
		Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, 'modelContext');

		render(<WebMcpRegister />);

		// Give the effect a chance to run; if it tried to call provideContext it would throw.
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(provideContext).not.toHaveBeenCalled();
		expect(createTaskMock).not.toHaveBeenCalled();
	});
});
