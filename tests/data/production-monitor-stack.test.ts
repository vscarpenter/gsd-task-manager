import { describe, expect, it } from "vitest";
import { renderTemplate } from "../../monitoring/render-template.cjs";

describe("production monitoring deployment boundaries", () => {
  it("runs independently every minute with only permissions for its own logs", () => {
    const template = renderTemplate();
    const resources = template.Resources;
    expect(resources.Schedule.Properties.ScheduleExpression).toBe("rate(1 minute)");
    expect(resources.Schedule.Properties.Targets[0].Input).toBe("{}");
    expect(resources.ProbeFunction.Properties).toMatchObject({ Runtime: "nodejs24.x", Timeout: 25, MemorySize: 256, ReservedConcurrentExecutions: 1 });
    expect(resources.ProbeFunction.Properties.Code.ZipFile).toContain("MonitorInternalFailure");
    expect(resources.ProbeLogGroup.Properties.RetentionInDays).toBe(7);
    const permissions = resources.ProbeRole.Properties.Policies.flatMap((p: { PolicyDocument: { Statement: unknown[] } }) => p.PolicyDocument.Statement);
    expect(permissions).toEqual([{
      Effect: "Allow", Action: ["logs:CreateLogStream", "logs:PutLogEvents"],
      Resource: { "Fn::GetAtt": ["ProbeLogGroup", "Arn"] },
    }]);
    expect(JSON.stringify(template)).not.toContain("secretsmanager:");
    expect(JSON.stringify(template)).not.toContain("s3:GetObject");
  });

  it("detects missing checks and a stopped monitor, and groups notification actions", () => {
    const resources = renderTemplate().Resources;
    for (const name of ["WebsiteAvailability", "WorkerAvailability", "AssetAvailability", "BackendAvailability", "Heartbeat"]) {
      expect(resources[name].Properties).toMatchObject({ TreatMissingData: "breaching", DatapointsToAlarm: 2, EvaluationPeriods: 3, Period: 60 });
      expect(resources[name].Properties.AlarmActions ?? []).toEqual([]);
    }
    expect(resources.CriticalAlarm.Type).toBe("AWS::CloudWatch::CompositeAlarm");
    expect(resources.CriticalAlarm.Properties.AlarmRule["Fn::Sub"]).toContain("${Heartbeat}");
    expect(resources.CriticalAlarm.Properties.AlarmActions).toEqual([{ Ref: "AlarmTopicArn" }]);
    expect(resources.CriticalAlarm.Properties.OKActions).toEqual([{ Ref: "AlarmTopicArn" }]);
    expect(renderTemplate().Parameters.NotificationsEnabled.Default).toBe("false");
  });

  it("uses existing resources only as metric dimensions and an alert destination", () => {
    const resources = Object.values(renderTemplate().Resources) as Array<{ Type: string; Properties: Record<string, unknown> }>;
    expect(resources.some((r) => r.Type === "AWS::CloudWatch::Dashboard")).toBe(true);
    const forbidden = new Set(["AWS::SNS::Topic", "AWS::SNS::Subscription", "AWS::SNS::TopicPolicy", "AWS::S3::Bucket", "AWS::EC2::Instance", "AWS::CloudFront::Distribution", "AWS::Lambda::Url", "AWS::Logs::SubscriptionFilter"]);
    expect(resources.filter((r) => forbidden.has(r.Type))).toEqual([]);
    expect(JSON.stringify(renderTemplate().Resources.ProbeFunction.Properties)).not.toContain("SENTRY");
  });
});
