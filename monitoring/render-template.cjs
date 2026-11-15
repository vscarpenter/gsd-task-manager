const { readFileSync } = require("node:fs");
const { join } = require("node:path");

function renderTemplate() {
  const template = JSON.parse(readFileSync(join(__dirname, "stack.json"), "utf8"));
  const dashboard = JSON.parse(readFileSync(join(__dirname, "dashboard.json"), "utf8"));
  template.Resources.ProbeFunction.Properties.Code = {
    ZipFile: readFileSync(join(__dirname, "probe.cjs"), "utf8"),
  };
  template.Resources.Dashboard.Properties.DashboardBody = {
    "Fn::Sub": JSON.stringify(dashboard),
  };
  if (Buffer.byteLength(JSON.stringify(template)) > 51200) {
    throw new Error("Monitoring template exceeds the inline CloudFormation limit");
  }
  return template;
}

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(renderTemplate(), null, 2)}\n`);
}

module.exports = { renderTemplate };
