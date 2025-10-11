import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskForm } from "@/components/task-form";
import type { TaskDraft } from "@/lib/types";

describe("TaskForm", () => {
  const defaultHandlers = {
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    onDelete: undefined
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with default empty values", () => {
    render(<TaskForm {...defaultHandlers} />);

    expect(screen.getByLabelText(/title/i)).toHaveValue("");
    expect(screen.getByLabelText(/description/i)).toHaveValue("");
    expect(screen.getByRole("button", { name: /save task/i })).toBeInTheDocument();
  });

  it("renders with initial values when provided", () => {
    const initialValues: TaskDraft = {
      title: "Test Task",
      description: "Test Description",
      urgent: false,
      important: true,
      dueDate: "2024-12-31T00:00:00.000Z",
      recurrence: "weekly",
      tags: ["work", "important"],
      subtasks: []
    };

    render(<TaskForm initialValues={initialValues} {...defaultHandlers} />);

    expect(screen.getByLabelText(/title/i)).toHaveValue("Test Task");
    expect(screen.getByLabelText(/description/i)).toHaveValue("Test Description");
    expect(screen.getByText("work")).toBeInTheDocument();
    expect(screen.getByText("important")).toBeInTheDocument();
  });

  it("submits form with valid data", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<TaskForm {...defaultHandlers} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/title/i), "New Task");
    await user.type(screen.getByLabelText(/description/i), "New Description");
    await user.click(screen.getByRole("button", { name: /save task/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "New Task",
          description: "New Description",
          urgent: true,
          important: true
        })
      );
    });
  });

  it("prevents submission when title is empty due to HTML5 validation", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<TaskForm {...defaultHandlers} onSubmit={onSubmit} />);

    const titleInput = screen.getByLabelText(/title/i);

    // Verify the input has the required attribute
    expect(titleInput).toBeRequired();

    await user.click(screen.getByRole("button", { name: /save task/i }));

    // Form should not submit when title is empty
    await waitFor(() => {
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  it("toggles urgency and importance correctly", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<TaskForm {...defaultHandlers} onSubmit={onSubmit} />);

    // Click "Not urgent"
    await user.click(screen.getByRole("button", { name: /not urgent/i }));

    // Click "Not important"
    await user.click(screen.getByRole("button", { name: /not important/i }));

    await user.type(screen.getByLabelText(/title/i), "Task");
    await user.click(screen.getByRole("button", { name: /save task/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          urgent: false,
          important: false
        })
      );
    });
  });

  it("adds and removes tags", async () => {
    const user = userEvent.setup();
    render(<TaskForm {...defaultHandlers} />);

    const tagInput = screen.getByPlaceholderText(/add tag/i);

    // Add a tag
    await user.type(tagInput, "work");
    await user.keyboard("{Enter}");

    expect(screen.getByText("work")).toBeInTheDocument();

    // Add another tag
    await user.type(tagInput, "urgent");
    await user.keyboard("{Enter}");

    expect(screen.getByText("urgent")).toBeInTheDocument();

    // Remove the first tag
    const removeButtons = screen.getAllByRole("button", { name: /remove .* tag/i });
    await user.click(removeButtons[0]);

    await waitFor(() => {
      expect(screen.queryByText("work")).not.toBeInTheDocument();
    });
    expect(screen.getByText("urgent")).toBeInTheDocument();
  });

  it("prevents duplicate tags", async () => {
    const user = userEvent.setup();
    render(<TaskForm {...defaultHandlers} />);

    const tagInput = screen.getByPlaceholderText(/add tag/i);

    await user.type(tagInput, "work");
    await user.keyboard("{Enter}");

    await user.type(tagInput, "work");
    await user.keyboard("{Enter}");

    // Should only have one "work" tag
    const workTags = screen.getAllByText("work");
    expect(workTags).toHaveLength(1);
  });

  it("adds and removes subtasks", async () => {
    const user = userEvent.setup();
    render(<TaskForm {...defaultHandlers} />);

    const subtaskInput = screen.getByPlaceholderText(/add subtask/i);

    // Add a subtask
    await user.type(subtaskInput, "First subtask");
    await user.keyboard("{Enter}");

    expect(screen.getByText("First subtask")).toBeInTheDocument();

    // Add another subtask
    await user.type(subtaskInput, "Second subtask");
    await user.keyboard("{Enter}");

    expect(screen.getByText("Second subtask")).toBeInTheDocument();

    // Remove the first subtask
    const removeButtons = screen.getAllByRole("button", { name: /remove subtask/i });
    await user.click(removeButtons[0]);

    await waitFor(() => {
      expect(screen.queryByText("First subtask")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Second subtask")).toBeInTheDocument();
  });

  it("toggles subtask completion", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<TaskForm {...defaultHandlers} onSubmit={onSubmit} />);

    const subtaskInput = screen.getByPlaceholderText(/add subtask/i);
    await user.type(subtaskInput, "Subtask to complete");
    await user.keyboard("{Enter}");

    // Toggle completion
    const checkbox = screen.getByRole("button", { name: /mark as complete/i });
    await user.click(checkbox);

    // Submit and verify
    await user.type(screen.getByLabelText(/title/i), "Task");
    await user.click(screen.getByRole("button", { name: /save task/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          subtasks: expect.arrayContaining([
            expect.objectContaining({
              title: "Subtask to complete",
              completed: true
            })
          ])
        })
      );
    });
  });

  it("sets recurrence type", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<TaskForm {...defaultHandlers} onSubmit={onSubmit} />);

    const recurrenceSelect = screen.getByLabelText(/recurrence/i);
    await user.selectOptions(recurrenceSelect, "daily");

    await user.type(screen.getByLabelText(/title/i), "Daily Task");
    await user.click(screen.getByRole("button", { name: /save task/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          recurrence: "daily"
        })
      );
    });
  });

  it("sets due date", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<TaskForm {...defaultHandlers} onSubmit={onSubmit} />);

    const dueDateInput = screen.getByLabelText(/due date/i);
    await user.type(dueDateInput, "2024-12-31");

    await user.type(screen.getByLabelText(/title/i), "Task with due date");
    await user.click(screen.getByRole("button", { name: /save task/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          dueDate: expect.stringContaining("2024-12-31")
        })
      );
    });
  });

  it("calls onCancel when cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(<TaskForm {...defaultHandlers} onCancel={onCancel} />);

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalled();
  });

  it("renders delete button when onDelete is provided", () => {
    const onDelete = vi.fn();

    render(<TaskForm {...defaultHandlers} onDelete={onDelete} />);

    expect(screen.getByRole("button", { name: /delete task/i })).toBeInTheDocument();
  });

  it("does not render delete button when onDelete is not provided", () => {
    render(<TaskForm {...defaultHandlers} />);

    expect(screen.queryByRole("button", { name: /delete task/i })).not.toBeInTheDocument();
  });

  it("calls onDelete when delete button is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();

    render(<TaskForm {...defaultHandlers} onDelete={onDelete} />);

    await user.click(screen.getByRole("button", { name: /delete task/i }));

    expect(onDelete).toHaveBeenCalled();
  });

  it("uses custom submit label when provided", () => {
    render(<TaskForm {...defaultHandlers} submitLabel="Update Task" />);

    expect(screen.getByRole("button", { name: /update task/i })).toBeInTheDocument();
  });

  it("disables submit button while submitting", async () => {
    const user = userEvent.setup();
    let resolveSubmit: () => void;
    const onSubmit = vi.fn(() => new Promise<void>(resolve => { resolveSubmit = resolve; }));

    render(<TaskForm {...defaultHandlers} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/title/i), "Task");
    const submitButton = screen.getByRole("button", { name: /save task/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });

    resolveSubmit!();

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it("trims whitespace from tags and subtasks", async () => {
    const user = userEvent.setup();
    render(<TaskForm {...defaultHandlers} />);

    // Add tag with whitespace
    const tagInput = screen.getByPlaceholderText(/add tag/i);
    await user.type(tagInput, "  work  ");
    await user.keyboard("{Enter}");

    expect(screen.getByText("work")).toBeInTheDocument();
    expect(screen.queryByText("  work  ")).not.toBeInTheDocument();

    // Add subtask with whitespace
    const subtaskInput = screen.getByPlaceholderText(/add subtask/i);
    await user.type(subtaskInput, "  subtask  ");
    await user.keyboard("{Enter}");

    expect(screen.getByText("subtask")).toBeInTheDocument();
    expect(screen.queryByText("  subtask  ")).not.toBeInTheDocument();
  });

  it("ignores empty tags and subtasks", async () => {
    const user = userEvent.setup();
    render(<TaskForm {...defaultHandlers} />);

    // Try to add empty tag
    const tagInput = screen.getByPlaceholderText(/add tag/i);
    await user.keyboard("{Enter}");

    // Should not add any tags
    expect(screen.queryByRole("button", { name: /remove .* tag/i })).not.toBeInTheDocument();

    // Try to add empty subtask
    const subtaskInput = screen.getByPlaceholderText(/add subtask/i);
    await user.keyboard("{Enter}");

    // Should not add any subtasks
    expect(screen.queryByRole("button", { name: /remove subtask/i })).not.toBeInTheDocument();
  });
});
