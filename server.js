const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;
const API_KEY = "lin_api_TwIy5Fu6iNh1Vb8ePSCxxjh9v7FBrItXmNDejjIt";
const TEAM_ID = "d4d5bf63-fae7-4938-9531-b1fb80618a8a";

app.use(express.static(path.join(__dirname, "public")));

// Proxy endpoint to Linear API (keeps key server-side)
app.get("/api/data", async (_req, res) => {
  try {
    const data = await fetchLinearData();
    res.json(data);
  } catch (err) {
    console.error("Linear fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});

async function gql(query) {
  const r = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: API_KEY },
    body: JSON.stringify({ query }),
  });
  const json = await r.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

async function fetchLinearData() {
  // Fetch issues with labels, state, project, priority
  const issueData = await gql(`{
    issues(filter: { team: { id: { eq: "${TEAM_ID}" } } }, first: 100) {
      nodes {
        id identifier title description priority
        state { name type }
        labels { nodes { name } }
        project { name }
        createdAt updatedAt
      }
    }
  }`);

  const issues = issueData.issues.nodes;

  // Categorize
  const frameworks = ["CMS ARC-AMPE", "IRS Pub 1075", "NIST 800-53", "SSA", "OLA"];
  const severities = ["Critical", "High", "Medium", "Low"];
  const categories = ["Assessment", "POA&M", "Evidence", "ATO", "External Request", "Compliance", "Incident Response", "Pen Test Finding", "External Audit", "Aging Finding"];

  const getLabels = (issue) => issue.labels.nodes.map((l) => l.name);
  const hasLabel = (issue, label) => getLabels(issue).includes(label);
  const isOpen = (issue) => !["completed", "canceled"].includes(issue.state.type);
  const isDone = (issue) => issue.state.type === "completed";
  const isMetrics = (issue) => issue.title.startsWith("📊");

  // Filter out metrics dashboard issues from counts
  const workIssues = issues.filter((i) => !isMetrics(i));

  // Framework compliance (from control library issues)
  const controlIssues = workIssues.filter((i) => i.project?.name === "Control Library");

  // Build summary
  const summary = {
    total: workIssues.length,
    open: workIssues.filter(isOpen).length,
    closed: workIssues.filter(isDone).length,
    critical: workIssues.filter((i) => hasLabel(i, "Critical") && isOpen(i)).length,
    high: workIssues.filter((i) => hasLabel(i, "High") && isOpen(i)).length,
    medium: workIssues.filter((i) => hasLabel(i, "Medium") && isOpen(i)).length,
    low: workIssues.filter((i) => hasLabel(i, "Low") && isOpen(i)).length,
    overdue: workIssues.filter((i) => i.priority === 1 && isOpen(i)).length,
  };

  // By framework
  const byFramework = {};
  for (const fw of frameworks) {
    const fwIssues = workIssues.filter((i) => hasLabel(i, fw));
    byFramework[fw] = {
      total: fwIssues.length,
      open: fwIssues.filter(isOpen).length,
      closed: fwIssues.filter(isDone).length,
      critical: fwIssues.filter((i) => hasLabel(i, "Critical")).length,
      high: fwIssues.filter((i) => hasLabel(i, "High")).length,
    };
  }

  // By category
  const byCategory = {};
  for (const cat of categories) {
    const catIssues = workIssues.filter((i) => hasLabel(i, cat));
    byCategory[cat] = {
      total: catIssues.length,
      open: catIssues.filter(isOpen).length,
      closed: catIssues.filter(isDone).length,
      critical: catIssues.filter((i) => hasLabel(i, "Critical")).length,
      high: catIssues.filter((i) => hasLabel(i, "High")).length,
      inProgress: catIssues.filter((i) => i.state.type === "started").length,
      todo: catIssues.filter((i) => i.state.type === "unstarted").length,
      backlog: catIssues.filter((i) => i.state.type === "backlog").length,
      issues: catIssues.map((i) => ({
        id: i.identifier,
        title: i.title,
        priority: i.priority,
        status: i.state.name,
        statusType: i.state.type,
        labels: getLabels(i),
        project: i.project?.name,
        description: i.description,
      })),
    };
  }

  // By project
  const byProject = {};
  const projectNames = [
    "Assessment Management",
    "POA&M Tracker",
    "External Request Management",
    "ATO Package Management",
    "Evidence Repository",
    "Control Library",
  ];
  for (const pn of projectNames) {
    const pIssues = workIssues.filter((i) => i.project?.name === pn);
    byProject[pn] = {
      total: pIssues.length,
      open: pIssues.filter(isOpen).length,
      closed: pIssues.filter(isDone).length,
      inProgress: pIssues.filter((i) => i.state.type === "started").length,
      issues: pIssues.map((i) => ({
        id: i.identifier,
        title: i.title,
        priority: i.priority,
        status: i.state.name,
        statusType: i.state.type,
        labels: getLabels(i),
        description: i.description,
      })),
    };
  }

  // POA&M specific
  const poamIssues = workIssues.filter((i) => hasLabel(i, "POA&M"));
  const poamByStatus = {
    inProgress: poamIssues.filter((i) => i.state.type === "started").length,
    todo: poamIssues.filter((i) => i.state.type === "unstarted").length,
    backlog: poamIssues.filter((i) => i.state.type === "backlog").length,
    done: poamIssues.filter(isDone).length,
  };

  // Action Items & Accountability — high-visibility items
  const actionTags = ["Pen Test Finding", "External Audit", "Incident Response", "Aging Finding", "Accountability Gap"];
  const actionItems = workIssues
    .filter((i) => actionTags.some((t) => hasLabel(i, t)))
    .map((i) => ({
      id: i.identifier,
      title: i.title,
      priority: i.priority,
      status: i.state.name,
      statusType: i.state.type,
      labels: getLabels(i),
      project: i.project?.name,
      description: i.description,
      createdAt: i.createdAt,
      source: hasLabel(i, "Pen Test Finding") ? "Pen Test" : hasLabel(i, "External Audit") ? "External Audit" : hasLabel(i, "Incident Response") ? "Incident" : hasLabel(i, "Aging Finding") ? "Aging Finding" : "Other",
    }));

  // Incidents specifically
  const incidents = workIssues
    .filter((i) => hasLabel(i, "Incident Response"))
    .map((i) => ({
      id: i.identifier,
      title: i.title,
      priority: i.priority,
      status: i.state.name,
      statusType: i.state.type,
      labels: getLabels(i),
      description: i.description,
    }));

  return {
    summary,
    byFramework,
    byCategory,
    byProject,
    poamByStatus,
    actionItems,
    incidents,
    frameworks,
    categories,
    actionTags,
    issues: workIssues.map((i) => ({
      id: i.identifier,
      title: i.title,
      priority: i.priority,
      status: i.state.name,
      statusType: i.state.type,
      labels: getLabels(i),
      project: i.project?.name,
      description: i.description,
    })),
  };
}

app.listen(PORT, () => {
  console.log(`\n  MD Benefits GRC Trust Center running at http://localhost:${PORT}\n`);
});
