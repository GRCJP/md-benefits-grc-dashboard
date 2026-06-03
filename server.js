require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;
const API_KEY = process.env.LINEAR_API_KEY;
const TEAM_ID = "d4d5bf63-fae7-4938-9531-b1fb80618a8a";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ─── CHAT ENDPOINT ───────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "No message provided" });

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });

    const data = await fetchLinearData();

    // Build concise data summary for context (under 4000 chars)
    const issueSummaries = data.issues.map(i =>
      `${i.id}: ${i.title} [${i.status}] P${i.priority} ${i.assignee||'Unassigned'} ${i.labels.filter(l=>!l.startsWith('Team:')).join(',')}`
    ).join('\n');

    const systemPrompt = `You are a GRC (Governance, Risk, and Compliance) operations assistant for the MD Benefits Trust Center. Answer questions about compliance data concisely and accurately. Use specific issue IDs and data when possible.

Current Data Summary:
- Total items: ${data.summary.total} | Open: ${data.summary.open} | Closed: ${data.summary.closed}
- Critical: ${data.summary.critical} | High: ${data.summary.high} | Medium: ${data.summary.medium} | Low: ${data.summary.low}

Frameworks: ${data.frameworks.map(f => `${f}: ${data.byFramework[f].open} open, ${data.byFramework[f].closed} closed, ${data.byFramework[f].critical} critical`).join(' | ')}

Teams: ${(data.teamLabels||[]).map(t => `${t}: ${data.byTeam[t]?.open||0} open, ${data.byTeam[t]?.critical||0} critical`).join(' | ')}

POA&M Status: In Progress: ${data.poamByStatus.inProgress}, Todo: ${data.poamByStatus.todo}, Backlog: ${data.poamByStatus.backlog}, Done: ${data.poamByStatus.done}

KEVs: ${data.kevs.open} open, ${data.kevs.resolved} resolved, ${data.kevs.overdue} overdue
Certs: ${data.certs.critical} expiring <7d, ${data.certs.warning} expiring 7-30d, ${data.certs.ok} ok
Docs: ${data.docs.overdue} overdue, ${data.docs.dueSoon} due soon, ${data.docs.completed} completed

Categories: ${data.categories.map(c => `${c}: ${data.byCategory[c]?.open||0} open`).join(', ')}

Action Items: ${data.actionItems.filter(i=>!['completed','canceled'].includes(i.statusType)).length} active (${data.incidents.filter(i=>!['completed','canceled'].includes(i.statusType)).length} incidents)

All Issues:
${issueSummaries.substring(0, 3000)}`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: message }],
      }),
    });

    const anthropicJson = await anthropicRes.json();
    if (anthropicJson.error) {
      return res.status(500).json({ error: anthropicJson.error.message });
    }

    const reply = anthropicJson.content?.[0]?.text || "No response generated.";
    res.json({ reply });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: err.message });
  }
});

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
  // Fetch issues across ALL teams in the organization
  const issueData = await gql(`{
    issues(first: 200) {
      nodes {
        id identifier title description priority url
        state { name type }
        labels { nodes { name } }
        project { name }
        team { name }
        assignee { id name email }
        createdAt updatedAt dueDate
      }
    }
  }`);

  const issues = issueData.issues.nodes;

  // Categorize
  const frameworks = ["CMS ARC-AMPE", "IRS Pub 1075", "NIST 800-53", "SSA", "OLA"];
  const severities = ["Critical", "High", "Medium", "Low"];
  const categories = ["Assessment", "POA&M", "Evidence", "ATO", "External Request", "Compliance", "Incident Response", "Pen Test Finding", "External Audit", "Aging Finding"];
  const teamLabels = ["Team: ISSO", "Team: Assessors", "Team: Tenant Support", "Team: POA&M Mgmt", "Team: IR"];

  const getLabels = (issue) => issue.labels.nodes.map((l) => l.name);
  const hasLabel = (issue, label) => getLabels(issue).includes(label);
  const isOpen = (issue) => !["completed", "canceled"].includes(issue.state.type);
  const isDone = (issue) => issue.state.type === "completed";
  const isMetrics = (issue) => issue.title.startsWith("📊");

  // Parse assignee name from description if no Linear assignee
  const ownerRegex = /(?:Assigned Owner|Owner|Assigned To|State Owner|Incident Commander|Reported By|Assessor):\s*\*?\*?([^*\n(]+)/i;
  function resolveAssignee(issue) {
    if (issue.assignee?.name) return issue.assignee.name;
    if (issue.description) {
      const m = issue.description.match(ownerRegex);
      if (m) return m[1].trim();
    }
    return "Unassigned";
  }

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
      assignee: resolveAssignee(i),
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

  // ─── AGE BUCKETS (for risk acceptance view) ───────────
  const now = new Date();
  const openIssues = workIssues.filter(isOpen);
  const ageMs = (i) => now - new Date(i.createdAt);
  const DAY = 86400000;
  const ageBuckets = {
    under1Month: openIssues.filter((i) => ageMs(i) < 30 * DAY).length,
    months1to6: openIssues.filter((i) => ageMs(i) >= 30 * DAY && ageMs(i) < 180 * DAY).length,
    months6to12: openIssues.filter((i) => ageMs(i) >= 180 * DAY && ageMs(i) < 365 * DAY).length,
    over12: openIssues.filter((i) => ageMs(i) >= 365 * DAY).length,
  };

  // ─── KEVs (CISA Known Exploited Vulnerabilities) ─────
  const kevIssues = workIssues.filter((i) => hasLabel(i, "KEV"));
  const kevs = {
    total: kevIssues.length,
    open: kevIssues.filter(isOpen).length,
    resolved: kevIssues.filter(isDone).length,
    overdue: kevIssues.filter((i) => isOpen(i) && i.dueDate && new Date(i.dueDate) < now).length,
    items: kevIssues.map((i) => {
      const due = i.dueDate ? new Date(i.dueDate) : null;
      const daysLeft = due ? Math.ceil((due - now) / DAY) : null;
      return {
        id: i.identifier, title: i.title, priority: i.priority,
        status: i.state.name, statusType: i.state.type,
        labels: getLabels(i), description: i.description,
        dueDate: i.dueDate, daysLeft,
      };
    }),
  };

  // ─── CERTIFICATE EXPIRATIONS ─────────────────────────
  const certIssues = workIssues.filter((i) => hasLabel(i, "Certificate"));
  const certs = {
    total: certIssues.length,
    critical: certIssues.filter((i) => i.dueDate && Math.ceil((new Date(i.dueDate) - now) / DAY) <= 7).length,
    warning: certIssues.filter((i) => { const d = i.dueDate ? Math.ceil((new Date(i.dueDate) - now) / DAY) : 999; return d > 7 && d <= 30; }).length,
    ok: certIssues.filter((i) => { const d = i.dueDate ? Math.ceil((new Date(i.dueDate) - now) / DAY) : 999; return d > 30; }).length,
    items: certIssues.map((i) => {
      const due = i.dueDate ? new Date(i.dueDate) : null;
      const daysLeft = due ? Math.ceil((due - now) / DAY) : null;
      return {
        id: i.identifier, title: i.title, priority: i.priority,
        status: i.state.name, statusType: i.state.type,
        labels: getLabels(i), description: i.description,
        dueDate: i.dueDate, daysLeft,
      };
    }).sort((a, b) => (a.daysLeft || 999) - (b.daysLeft || 999)),
  };

  // ─── DOCUMENT REVIEWS ────────────────────────────────
  const docIssues = workIssues.filter((i) => hasLabel(i, "Document Review"));
  const docs = {
    total: docIssues.length,
    overdue: docIssues.filter((i) => isOpen(i) && i.dueDate && new Date(i.dueDate) < now).length,
    dueSoon: docIssues.filter((i) => { const d = i.dueDate ? Math.ceil((new Date(i.dueDate) - now) / DAY) : 999; return isOpen(i) && d >= 0 && d <= 30; }).length,
    onTrack: docIssues.filter((i) => { const d = i.dueDate ? Math.ceil((new Date(i.dueDate) - now) / DAY) : 999; return isOpen(i) && d > 30; }).length,
    completed: docIssues.filter(isDone).length,
    items: docIssues.map((i) => {
      const due = i.dueDate ? new Date(i.dueDate) : null;
      const daysLeft = due ? Math.ceil((due - now) / DAY) : null;
      return {
        id: i.identifier, title: i.title, priority: i.priority,
        status: i.state.name, statusType: i.state.type,
        labels: getLabels(i), description: i.description,
        dueDate: i.dueDate, daysLeft,
      };
    }).sort((a, b) => (a.daysLeft || 999) - (b.daysLeft || 999)),
  };

  // ─── NOTIFICATIONS FEED ────────────────────────────────
  const notifications = [];
  const issueRef = (i) => ({
    id: i.identifier, title: i.title, assignee: resolveAssignee(i),
    assigneeEmail: i.assignee?.email || null, dueDate: i.dueDate, url: i.url,
    labels: getLabels(i), priority: i.priority,
  });

  for (const i of workIssues.filter(isOpen)) {
    if (!i.dueDate) continue;
    const daysLeft = Math.ceil((new Date(i.dueDate) - now) / DAY);

    if (daysLeft < 0) {
      notifications.push({ type: "overdue", severity: "critical", daysOverdue: Math.abs(daysLeft),
        message: `OVERDUE by ${Math.abs(daysLeft)} days`, ...issueRef(i) });
    } else if (daysLeft <= 3) {
      notifications.push({ type: "due_imminent", severity: "critical", daysLeft,
        message: `Due in ${daysLeft} day${daysLeft===1?'':'s'}`, ...issueRef(i) });
    } else if (daysLeft <= 7) {
      notifications.push({ type: "due_soon", severity: "high", daysLeft,
        message: `Due in ${daysLeft} days`, ...issueRef(i) });
    } else if (daysLeft <= 14) {
      notifications.push({ type: "upcoming", severity: "medium", daysLeft,
        message: `Due in ${daysLeft} days`, ...issueRef(i) });
    } else if (daysLeft <= 30) {
      notifications.push({ type: "reminder", severity: "low", daysLeft,
        message: `Due in ${daysLeft} days`, ...issueRef(i) });
    }
  }

  // Flag unassigned high-priority items
  for (const i of workIssues.filter(isOpen)) {
    if (!i.assignee && i.priority <= 2) {
      notifications.push({ type: "unassigned", severity: "high",
        message: "High priority item has no assignee", ...issueRef(i) });
    }
  }

  notifications.sort((a, b) => {
    const sev = { critical: 0, high: 1, medium: 2, low: 3 };
    return (sev[a.severity] ?? 4) - (sev[b.severity] ?? 4);
  });

  const mapIssue = (i) => ({
    id: i.identifier, title: i.title, priority: i.priority,
    status: i.state.name, statusType: i.state.type,
    labels: getLabels(i), project: i.project?.name,
    team: i.team?.name || "Unassigned",
    description: i.description, dueDate: i.dueDate,
    assignee: resolveAssignee(i),
  });

  // ─── BY TEAM (using actual Linear teams now) ─────────
  const realTeamNames = ["ISSO", "Assessors", "Tenant Support", "POA&M Management", "IR"];
  const byTeam = {};
  for (const tn of realTeamNames) {
    // Match by actual Linear team OR by "Team:" label (fallback)
    const ti = workIssues.filter(i => i.team?.name === tn || hasLabel(i, "Team: " + tn) || hasLabel(i, "Team: " + tn.replace("Management","Mgmt")));
    byTeam[tn] = {
      total: ti.length, open: ti.filter(isOpen).length, closed: ti.filter(isDone).length,
      critical: ti.filter(i => hasLabel(i, "Critical")).length,
      inProgress: ti.filter(i => i.state.type === "started").length,
    };
  }

  return {
    summary,
    byFramework,
    byCategory,
    byProject,
    byTeam,
    teamLabels: realTeamNames,
    poamByStatus,
    actionItems,
    incidents,
    ageBuckets,
    kevs,
    certs,
    docs,
    notifications,
    frameworks,
    categories,
    actionTags,
    issues: workIssues.map(mapIssue),
  };
}

app.listen(PORT, () => {
  console.log(`\n  MD Benefits GRC Trust Center running at http://localhost:${PORT}\n`);
});
