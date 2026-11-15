// Compare and mutate under the same database transaction. Clients use the
// dedicated route so a server without this contract cannot ignore a precondition.
const MUTABLE_FIELDS = [
  "owner", "task_id", "title", "description", "urgent", "important", "quadrant",
  "due_date", "completed", "completed_at", "recurrence", "tags", "subtasks",
  "dependencies", "notification_enabled", "notification_sent", "notify_before",
  "last_notification_at", "estimated_minutes", "time_spent", "time_entries",
  "snoozed_until", "saved_at", "focus_date", "focus_rank", "client_updated_at",
  "client_created_at", "device_id",
];

function checkedPatch(data, record) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new BadRequestError("A task patch is required.");
  }
  for (const field of Object.keys(data)) {
    if (MUTABLE_FIELDS.indexOf(field) === -1) throw new BadRequestError("Unknown task field.");
  }
  if ((data.owner !== undefined && data.owner !== record.getString("owner")) ||
      (data.task_id !== undefined && data.task_id !== record.getString("task_id"))) {
    throw new BadRequestError("Task identity is immutable.");
  }
  if (typeof data.client_updated_at !== "string" || !data.client_updated_at ||
      data.client_updated_at === record.getString("client_updated_at")) {
    throw new BadRequestError("An update must change the task version.");
  }
  return data;
}

function conditionalWrite(e, operation) {
  const body = e.requestInfo().body;
  if (!body || typeof body.expected_version !== "string" || body.expected_version.length > 64) {
    throw new BadRequestError("An expected task version is required.");
  }
  e.app.runInTransaction((txApp) => {
    const record = txApp.findRecordById("tasks", e.request.pathValue("id"));
    if (record.getString("owner") !== e.auth.id) throw new NotFoundError();
    if (record.getString("client_updated_at") !== body.expected_version) {
      throw new ApiError(412, "Task changed; refresh and retry.");
    }
    if (operation === "delete") txApp.delete(record);
    else {
      record.load(checkedPatch(body.data, record));
      // save validates fields and runs the encryption/realtime hooks.
      txApp.save(record);
    }
  });
  return e.noContent(204);
}

module.exports = { conditionalWrite };
