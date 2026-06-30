/// <reference path="../pb_data/types.d.ts" />
// Server-side at-rest encryption for the "tasks" collection.
// Handlers run in isolated VM contexts, so the core module and key are
// acquired INSIDE each callback (outer-scope variables are not visible).

onRecordCreate((e) => {
  // react-doctor-disable-next-line react-doctor/no-dynamic-import-path -- PocketBase `require(`${__hooks}/..`)` is its required hook idiom
  const core = require(`${__hooks}/encryption-core.js`);
  const key = $os.getenv("GSD_TASKS_ENC_KEY");
  core.requireValidKey(key);
  core.encryptRecord(e.record, (s) => $security.encrypt(s, key));
  e.next();
}, "tasks");

onRecordUpdate((e) => {
  // react-doctor-disable-next-line react-doctor/no-dynamic-import-path -- PocketBase `require(`${__hooks}/..`)` is its required hook idiom
  const core = require(`${__hooks}/encryption-core.js`);
  const key = $os.getenv("GSD_TASKS_ENC_KEY");
  core.requireValidKey(key);
  core.encryptRecord(e.record, (s) => $security.encrypt(s, key));
  e.next();
}, "tasks");

onRecordEnrich((e) => {
  // react-doctor-disable-next-line react-doctor/no-dynamic-import-path -- PocketBase `require(`${__hooks}/..`)` is its required hook idiom
  const core = require(`${__hooks}/encryption-core.js`);
  const key = $os.getenv("GSD_TASKS_ENC_KEY");
  core.requireValidKey(key);
  core.decryptRecord(e.record, (s) => $security.decrypt(s, key));
  e.next();
}, "tasks");
