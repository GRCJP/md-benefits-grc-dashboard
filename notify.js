#!/usr/bin/env node
/**
 * GRC Trust Center - Notification Script
 * Sends alerts for overdue, due-soon, and unassigned items
 *
 * Supports: Google Chat (webhook), Microsoft Teams (webhook), Email (SMTP)
 *
 * Usage:
 *   node notify.js                          # dry run — prints to console
 *   node notify.js --teams <webhook_url>    # send to Teams channel
 *   node notify.js --google <webhook_url>   # send to Google Chat space
 *   node notify.js --email <smtp_config>    # send via email
 *
 * Run on a schedule:
 *   crontab: 0 8 * * 1-5 cd /path/to/dashboard && node notify.js --teams <url>
 */

require("dotenv").config();
const API_KEY = process.env.LINEAR_API_KEY;
const TEAM_ID = "d4d5bf63-fae7-4938-9531-b1fb80618a8a";

async function gql(query) {
  const r = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: API_KEY },
    body: JSON.stringify({ query }),
  });
  const j = await r.json();
  if (j.errors) throw new Error(j.errors[0].message);
  return j.data;
}

async function getAlerts() {
  const data = await gql(`{
    issues(filter: { team: { id: { eq: "${TEAM_ID}" } }, state: { type: { nin: ["completed","canceled"] } } }, first: 150) {
      nodes {
        identifier title priority url dueDate
        state { name type }
        assignee { name email }
        labels { nodes { name } }
      }
    }
  }`);

  const now = new Date();
  const DAY = 86400000;
  const alerts = { critical: [], high: [], medium: [], info: [] };

  for (const i of data.issues.nodes) {
    if (i.title.startsWith("📊")) continue;
    const assignee = i.assignee?.name || "Unassigned";
    const email = i.assignee?.email || null;
    const labels = i.labels.nodes.map(l => l.name);

    if (i.dueDate) {
      const daysLeft = Math.ceil((new Date(i.dueDate) - now) / DAY);

      if (daysLeft < 0) {
        alerts.critical.push({
          type: "OVERDUE",
          id: i.identifier,
          title: i.title,
          detail: `${Math.abs(daysLeft)} days overdue (due ${i.dueDate})`,
          assignee, email, url: i.url, labels,
        });
      } else if (daysLeft <= 3) {
        alerts.critical.push({
          type: "DUE IMMINENT",
          id: i.identifier,
          title: i.title,
          detail: `Due in ${daysLeft} day${daysLeft === 1 ? "" : "s"} (${i.dueDate})`,
          assignee, email, url: i.url, labels,
        });
      } else if (daysLeft <= 7) {
        alerts.high.push({
          type: "DUE THIS WEEK",
          id: i.identifier,
          title: i.title,
          detail: `Due in ${daysLeft} days (${i.dueDate})`,
          assignee, email, url: i.url, labels,
        });
      } else if (daysLeft <= 14) {
        alerts.medium.push({
          type: "DUE SOON",
          id: i.identifier,
          title: i.title,
          detail: `Due in ${daysLeft} days (${i.dueDate})`,
          assignee, email, url: i.url, labels,
        });
      }
    }

    // Unassigned high-priority
    if (!i.assignee && i.priority <= 2) {
      alerts.high.push({
        type: "NO OWNER",
        id: i.identifier,
        title: i.title,
        detail: "High priority item has no assignee",
        assignee: "Unassigned", email: null, url: i.url, labels,
      });
    }
  }

  return alerts;
}

// ─── FORMATTERS ────────────────────────────────────────────

function formatConsole(alerts) {
  const all = [...alerts.critical, ...alerts.high, ...alerts.medium];
  if (!all.length) { console.log("✅ No alerts — all clear."); return; }

  console.log(`\n🔔 GRC Trust Center — Daily Alerts (${new Date().toLocaleDateString()})\n`);
  if (alerts.critical.length) {
    console.log("🔴 CRITICAL");
    alerts.critical.forEach(a => console.log(`   [${a.type}] ${a.id}: ${a.title}\n      → ${a.detail} | Owner: ${a.assignee}`));
  }
  if (alerts.high.length) {
    console.log("\n🟠 HIGH");
    alerts.high.forEach(a => console.log(`   [${a.type}] ${a.id}: ${a.title}\n      → ${a.detail} | Owner: ${a.assignee}`));
  }
  if (alerts.medium.length) {
    console.log("\n🟡 MEDIUM");
    alerts.medium.forEach(a => console.log(`   [${a.type}] ${a.id}: ${a.title}\n      → ${a.detail} | Owner: ${a.assignee}`));
  }
  console.log(`\n📊 Summary: ${alerts.critical.length} critical, ${alerts.high.length} high, ${alerts.medium.length} medium\n`);
}

function formatTeamsCard(alerts) {
  const all = [...alerts.critical, ...alerts.high, ...alerts.medium];
  const sections = [];

  if (alerts.critical.length) {
    sections.push({
      activityTitle: "🔴 Critical",
      facts: alerts.critical.map(a => ({
        name: `[${a.type}] ${a.id}`,
        value: `**${a.title}**  \n${a.detail} — Owner: ${a.assignee}`,
      })),
    });
  }
  if (alerts.high.length) {
    sections.push({
      activityTitle: "🟠 High Priority",
      facts: alerts.high.map(a => ({
        name: `[${a.type}] ${a.id}`,
        value: `**${a.title}**  \n${a.detail} — Owner: ${a.assignee}`,
      })),
    });
  }
  if (alerts.medium.length) {
    sections.push({
      activityTitle: "🟡 Upcoming",
      facts: alerts.medium.map(a => ({
        name: `[${a.type}] ${a.id}`,
        value: `**${a.title}**  \n${a.detail} — Owner: ${a.assignee}`,
      })),
    });
  }

  return {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    themeColor: alerts.critical.length ? "DC2626" : alerts.high.length ? "EA580C" : "CA8A04",
    summary: `GRC Alert: ${all.length} items need attention`,
    sections: [
      {
        activityTitle: `GRC Trust Center — Daily Alert`,
        activitySubtitle: `${new Date().toLocaleDateString()} | ${alerts.critical.length} critical, ${alerts.high.length} high, ${alerts.medium.length} upcoming`,
        activityImage: "https://img.icons8.com/fluency/48/shield.png",
      },
      ...sections,
    ],
  };
}

function formatGoogleChat(alerts) {
  const all = [...alerts.critical, ...alerts.high, ...alerts.medium];
  let text = `*GRC Trust Center — Daily Alert*\n${new Date().toLocaleDateString()} | ${alerts.critical.length} critical, ${alerts.high.length} high, ${alerts.medium.length} upcoming\n\n`;

  if (alerts.critical.length) {
    text += "🔴 *CRITICAL*\n";
    alerts.critical.forEach(a => { text += `• \`${a.type}\` *${a.id}*: ${a.title}\n   ${a.detail} — Owner: ${a.assignee}\n`; });
    text += "\n";
  }
  if (alerts.high.length) {
    text += "🟠 *HIGH*\n";
    alerts.high.forEach(a => { text += `• \`${a.type}\` *${a.id}*: ${a.title}\n   ${a.detail} — Owner: ${a.assignee}\n`; });
    text += "\n";
  }
  if (alerts.medium.length) {
    text += "🟡 *UPCOMING*\n";
    alerts.medium.forEach(a => { text += `• \`${a.type}\` *${a.id}*: ${a.title}\n   ${a.detail} — Owner: ${a.assignee}\n`; });
  }

  return { text };
}

// ─── SENDERS ───────────────────────────────────────────────

async function sendTeams(webhookUrl, alerts) {
  const card = formatTeamsCard(alerts);
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(card),
  });
  if (!res.ok) throw new Error(`Teams webhook failed: ${res.status} ${await res.text()}`);
  console.log("✅ Sent to Microsoft Teams");
}

async function sendGoogle(webhookUrl, alerts) {
  const msg = formatGoogleChat(alerts);
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(msg),
  });
  if (!res.ok) throw new Error(`Google Chat webhook failed: ${res.status} ${await res.text()}`);
  console.log("✅ Sent to Google Chat");
}

// ─── MAIN ──────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const alerts = await getAlerts();
  const all = [...alerts.critical, ...alerts.high, ...alerts.medium];

  if (!all.length) {
    console.log("✅ No alerts — all clear.");
    return;
  }

  // Always print to console
  formatConsole(alerts);

  // Send to Teams
  const teamsIdx = args.indexOf("--teams");
  if (teamsIdx !== -1 && args[teamsIdx + 1]) {
    await sendTeams(args[teamsIdx + 1], alerts);
  }

  // Send to Google Chat
  const googleIdx = args.indexOf("--google");
  if (googleIdx !== -1 && args[googleIdx + 1]) {
    await sendGoogle(args[googleIdx + 1], alerts);
  }

  // If no destination specified, just show help
  if (teamsIdx === -1 && googleIdx === -1) {
    console.log("─── To send notifications, use: ───");
    console.log("  Teams:  node notify.js --teams <webhook_url>");
    console.log("  Google: node notify.js --google <webhook_url>");
    console.log("  Both:   node notify.js --teams <url> --google <url>");
    console.log("\nSchedule daily (crontab -e):");
    console.log("  0 8 * * 1-5 cd /path/to/dashboard && node notify.js --teams <url>");
  }
}

main().catch(err => { console.error("Error:", err.message); process.exit(1); });
