/// <reference path="../pb_data/types.d.ts" />
// Additive: legacy clients can omit this field without erasing saved placement.
migrate((app) => {
  const table = new DynamicModel({ count: 0 });
  app.db().newQuery("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'tasks'").one(table);
  if (table.count === 0) return;
  const collection = app.findCollectionByNameOrId("tasks");
  if (collection.fields.getByName("saved_at")) return;
  collection.fields.add(new TextField({ name: "saved_at", max: 50 }));
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("tasks");
  collection.fields.removeByName("saved_at");
  app.save(collection);
});
