/// <reference path="../pb_data/types.d.ts" />
routerAdd("PATCH", "/api/gsd/tasks/{id}", (e) => {
  const contract = require(`${__hooks}/task-write-contract.js`);
  return contract.conditionalWrite(e, "update");
}, $apis.requireAuth("users"));

routerAdd("DELETE", "/api/gsd/tasks/{id}", (e) => {
  const contract = require(`${__hooks}/task-write-contract.js`);
  return contract.conditionalWrite(e, "delete");
}, $apis.requireAuth("users"));
