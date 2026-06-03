# GRC Trust Center Demo Script
## 15 minutes presentation + 15 minutes discussion

---

## BEFORE THE MEETING (2 min setup)
- Open dashboard: http://localhost:3000 (or GitHub Pages URL)
- Open Linear in another tab (keep ready to show a live close)
- Start on the Trust Center tab

---

## OPENING (1 minute)

**Say:**
"Today I want to show you how we can consolidate GRC operations into a single platform that gives leadership real-time visibility into compliance posture across CaseTrack, HealthConnect, RevenuePro, and the DataHub. Right now this information lives in spreadsheets, emails, and people's heads. What I'm going to show you eliminates that."

---

## PART 1: THE TRUST CENTER (4 minutes)

### Show the Executive Dashboard — Trust Center tab

**Posture Banner (30 sec)**
"At a glance — compliance health, risk score, and authorization status of every system. CaseTrack and RevenuePro are authorized, HealthConnect is conditional, DataHub is in review. These numbers are real — they're seeded from the latest assessment artifacts."

**KEY TALKING POINT — Living Compliance (30 sec)**
"This is important — these numbers aren't static. We load the latest SAR and POA&M workbook, which creates all findings as tracked items with severity, control mapping, and due dates. That's the baseline. From that point forward, every time the team closes a finding, remediates a control, or collects evidence, the compliance percentage updates. It's a living number — not a report that's outdated the day after the assessment."

**Vulnerability Management (30 sec)**
"Vulnerability posture across all sources — scans, pen tests, external audits, bug bounty. SLA compliance at 78%, remediation times by severity, and the trend is improving. These metrics update as the team works through findings in Linear."

**POA&M Health (30 sec)**
"POA&Ms by system — HealthConnect has the most at 12. Aging distribution shows what's been open too long. Risk acceptances tracked with review dates. Closure rate and milestone tracking."

**Evidence & ConMon (30 sec)**
"Evidence freshness, ConMon delivery at 83%, and automation progress. The OSCAL pipeline handles automated control testing — failures create findings automatically. Manual controls get flagged for review."

**Assessment & Audit (30 sec)**
"198 of 261 controls assessed. Quarterly findings trend going the right direction. Pen test and bug bounty summaries."

---

## PART 2: SYSTEM DRILL-DOWN (2 minutes)

### Click "Leadership Metrics" tab, then click HealthConnect card (yellow)

**Say:**
"HealthConnect is our Medicaid system under CMS ARC-AMPE — it's conditional right now. Let me show you why."

- "71% compliant — 5 compliance gaps including FTI encryption and ConMon delays"
- "Two risk acceptances with expiration dates and named owners"
- "Evidence completion only 68% — 11 items missing. This is blocking the full ATO."
- "Recent findings from the pen test and CMS assessment"

**Click DataHub (red):**
"Our biggest risk — 58% compliant, ConMon not established, 152 controls not yet assessed. But we can see it clearly now instead of discovering it during an audit."

---

## PART 3: THE ACCOUNTABILITY STORY (2 minutes)

### Click "Priority Efforts" in the sidebar

**Say:**
"Let me tell you why this matters. We had an OLA audit finding shared with the ISSO team two years ago. It was sent in an email. Nobody tracked it. Nobody owned it. It sat open for over two years until it resurfaced during assessment prep."

**Point to the aging finding:**
"In this system, that cannot happen. Every finding has a named owner, a due date, and automated escalation. Priority efforts are separated by source — pen test findings, external audit findings, active incidents. Each with accountability."

### Click "Intake Monitoring" in the sidebar

**Say:**
"We also track intake volume by agency — DHS has 14 open requests, 5 are over 30 days. MDH has 11. Every request has an SLA, an assignee, and a status. Leadership sees who's falling behind."

---

## PART 4: DATA SECURITY (2 minutes)

### Click "Data Security" in the sidebar

**Say:**
"We're tracking IRS 1075 FTI systems, CMS data, SSA PII. How do we protect sensitive details?"

**Walk through the diagram:**
"Three layers. Linear is the workflow layer — task titles, status, due dates. No hostnames, no IPs, no scan output. Microsoft Teams is the communication layer — sanitized automatically. SharePoint GCC High is the evidence vault — FedRAMP High authorized. That's where screenshots, scan results, and sensitive artifacts live."

### Click "Intake Filter" in the sidebar

**Live demo:**
"Let me show you. Here's a Wiz scan finding coming in with an IP address and hostname."

- Click "Wiz Scan Finding" preset
- Show the right panel — IP redacted, hostname redacted
- Click "Email w/ PII (Blocked)" — show the SSN getting hard-blocked
- Click "Clean Intake Form" — show it passing through clean

"Every intake source — Wiz, Qualys, Teams messages, emails — goes through this filter before it touches Linear."

---

## PART 5: WHY THIS TOOL (1 minute)

### Click "Why Linear" in the sidebar

**Don't read cards — just hit the key points:**
"Linear gives us POA&M lifecycle management, framework-isolated compliance views, built-in automation with no add-ons, and AI-powered search. When something needs dev work, it pushes to Jira automatically. Security team works here, dev team works in Jira, one source of truth."

---

## PART 6: LIVE PROOF (1 minute)

### Switch to Linear tab

**Close a POA&M item in Linear** (mark one as Done)

### Switch back to dashboard, refresh

**Say:**
"The number just changed. That's the point — this isn't a static report. Every time someone closes a finding, the compliance posture updates. Leadership always has the current picture."

---

## CLOSE (30 seconds)

"Every system, every framework, every finding — tracked with accountability. Assessment data sets the baseline, the team's daily work keeps it current. Nothing falls through the cracks. Questions?"

---

## DISCUSSION PREP — LIKELY QUESTIONS & ANSWERS

### "How do the compliance numbers stay accurate?"
"We seed the system from the latest assessment artifacts — the SAR, POA&M workbook, and control assessment results. That gives us the real baseline. From there, every remediation, every evidence collection, every closed finding updates the numbers in real time. When the next assessment runs, new findings come in and the cycle continues. The number is always anchored to real assessment data, not just ticket counts."

### "What does this cost?"
"Linear is $8/user/month. The dashboard is custom-built on our infrastructure. SharePoint GCC is already part of the state's Microsoft licensing. Total: about $100/month for a 12-person team."

### "Is Linear FedRAMP authorized?"
"No — and that's why we designed the data classification model. Linear handles workflow only. Sensitive artifacts stay in SharePoint GCC High which is FedRAMP High authorized. The sanitization layer enforces this automatically."

### "Why not just use Jira?"
"Linear is for GRC-specific workflows. When a finding needs dev work, it pushes to Jira automatically. Security team in Linear, dev team in Jira. The data classification architecture works with either tool — the compliance model is tool-agnostic."

### "How do we know people will actually use it?"
"Three things: Teams integration means they don't leave their tools. Automated escalation means overdue items surface to leadership. And visibility creates accountability — when the CISO sees your name next to an overdue finding, items get closed."

### "What about the OSCAL pipeline?"
"Monthly automated control assessments. Anything testable via API gets tested automatically. Failures create findings in Linear under the right framework. Manual controls get flagged for human review. We increase automation over time — targeting 60% by Q4."

### "How long to implement?"
"Dashboard and Linear workspace: 2-3 weeks to production. OSCAL pipeline: 4-6 weeks for initial controls, expanding quarterly. Teams integration: same day."

### "Who maintains this?"
"The dashboard builds itself from Linear data. The GRC team works in Linear as their daily tool. No separate data entry. Maintenance is keeping the workspace organized and expanding OSCAL automation."

### "What if we already have assessment data in spreadsheets?"
"We import it. The SAR findings, POA&M workbook, control assessment results — we load them as Linear issues with all the metadata. That becomes day one. From there, the team works them and the numbers stay current."
