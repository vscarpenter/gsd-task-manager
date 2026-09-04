/// <reference path="../pb_data/types.d.ts" />
// Fail-closed abuse controls for the anonymous, write-only feedback collection.
// PocketBase hook callbacks execute in isolated VMs, so each callback keeps its
// policy checks and constants inside its own body.

onRecordCreateRequest((e) => {
  const settings = e.app.settings();
  const rateLimits = settings && settings.rateLimits;
  const logs = settings && settings.logs;
  const rules = rateLimits && Array.isArray(rateLimits.rules) ? rateLimits.rules : [];
  const feedbackRules = rules.filter((rule) => rule && rule.label === "feedback:create");
  const exactRateRule =
    feedbackRules.length === 1 &&
    feedbackRules[0].audience === "" &&
    feedbackRules[0].maxRequests === 30 &&
    feedbackRules[0].duration === 60;
  const privateLogs =
    logs &&
    typeof logs.maxDays === "number" &&
    logs.maxDays >= 0 &&
    logs.maxDays <= 1 &&
    logs.logIP === false &&
    logs.logAuthId === false;

  if (!rateLimits || rateLimits.enabled !== true || !exactRateRule || !privateLogs) {
    throw new InternalServerError("Anonymous feedback controls are not ready.");
  }

  e.next();
}, "feedback");

onRecordCreateExecute((e) => {
  const originalApp = e.app;
  try {
    originalApp.runInTransaction((txApp) => {
      const settings = txApp.settings();
      const rateLimits = settings && settings.rateLimits;
      const logs = settings && settings.logs;
      const rules = rateLimits && Array.isArray(rateLimits.rules) ? rateLimits.rules : [];
      const feedbackRules = rules.filter((rule) => rule && rule.label === "feedback:create");
      const exactRateRule =
        feedbackRules.length === 1 &&
        feedbackRules[0].audience === "" &&
        feedbackRules[0].maxRequests === 30 &&
        feedbackRules[0].duration === 60;
      const privateLogs =
        logs &&
        typeof logs.maxDays === "number" &&
        logs.maxDays >= 0 &&
        logs.maxDays <= 1 &&
        logs.logIP === false &&
        logs.logAuthId === false;

      if (!rateLimits || rateLimits.enabled !== true || !exactRateRule || !privateLogs) {
        throw new InternalServerError("Anonymous feedback controls are not ready.");
      }
      if (txApp.countRecords("feedback") >= 10000) {
        throw new TooManyRequestsError("Feedback capacity is temporarily full.");
      }

      e.app = txApp;
      e.next();
    });
  } finally {
    e.app = originalApp;
  }
}, "feedback");

cronAdd("gsd-feedback-retention", "17 3 * * *", () => {
  const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();

  $app.runInTransaction((txApp) => {
    while (true) {
      const expired = txApp.findRecordsByFilter(
        "feedback",
        "created < {:cutoff}",
        "created",
        250,
        0,
        { cutoff },
      );
      if (expired.length === 0) break;
      for (const record of expired) txApp.delete(record);
    }
  });
});

routerAdd(
  "GET",
  "/api/gsd/feedback-controls",
  (e) => {
    const settings = e.app.settings();
    const rateLimits = settings && settings.rateLimits;
    const logs = settings && settings.logs;
    const rules = rateLimits && Array.isArray(rateLimits.rules) ? rateLimits.rules : [];
    const feedbackRules = rules.filter((rule) => rule && rule.label === "feedback:create");
    const rateLimitReady =
      rateLimits &&
      rateLimits.enabled === true &&
      feedbackRules.length === 1 &&
      feedbackRules[0].audience === "" &&
      feedbackRules[0].maxRequests === 30 &&
      feedbackRules[0].duration === 60;
    const logPolicyReady =
      logs &&
      typeof logs.maxDays === "number" &&
      logs.maxDays >= 0 &&
      logs.maxDays <= 1 &&
      logs.logIP === false &&
      logs.logAuthId === false;
    const recordCount = e.app.countRecords("feedback");

    return e.json(200, {
      hookVersion: 1,
      ready: Boolean(rateLimitReady && logPolicyReady),
      accepting: Boolean(rateLimitReady && logPolicyReady && recordCount < 10000),
      rateLimit: { audience: "", maxRequests: 30, duration: 60 },
      quotaLimit: 10000,
      recordCount,
      retentionDays: 180,
      logMaxDays: logs && logs.maxDays,
      logIP: logs && logs.logIP,
      logAuthId: logs && logs.logAuthId,
    });
  },
  $apis.requireSuperuserAuth(),
);
