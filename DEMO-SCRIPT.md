# GRC Trust Center Demo Script
## 15 minutes presentation + 15 minutes discussion

---

## BEFORE THE MEETING (2 min setup)
- Open dashboard: http://localhost:3000 (or GitHub Pages URL)
- Open Linear in another tab (show briefly)
- Have the Teams webhook ready if doing live notification demo
- Start on the Trust Center tab

---

## OPENING (1 minute)

**Say:**
"Today I want to walk you through how we can consolidate our GRC operations into a single platform that gives leadership real-time visibility into our compliance posture across CJAMS, CSMS, MORA, and the Shared Data Platform. Right now this information lives in spreadsheets, emails, and people's heads. What I'm going to show you eliminates that."

---

## PART 1: THE TRUST CENTER (5 minutes)

### Show the Executive Dashboard — Trust Center tab
**You're on screen. Point to each section:**

**Posture Banner (30 sec)**
"At a glance — our overall compliance health, risk score, and the authorization status of every system. You can see CJAMS and MORA are fully authorized, CSMS is conditional, and the Shared Data Platform is still in review. This updates in real time."

**Vulnerability Management (45 sec)**
"This breaks down our vulnerability posture across all sources — not just scan findings but pen tests, external audits, even bug bounty. We're at 78% SLA compliance for remediation. You can see remediation timelines by severity — critical findings average 12 days to close. The trend line shows we're improving — down 12% from last month."

**POA&M Health (45 sec)**
"POA&Ms are the heart of remediation tracking. We have [X] open across all systems. The aging distribution is critical — anything over 6 months gets flagged automatically. We track risk acceptances separately with review dates so nothing expires without a decision. The milestone bar shows 65% of remediation plans are on track."

**Evidence & ConMon (30 sec)**
"Evidence freshness is tracked automatically. We know what's current, what's stale, and what's missing — broken down by control family. ConMon delivery is at 83%. We're at 34% automation and targeting 60% by Q4 through the OSCAL pipeline integration."

**Assessment & Audit (30 sec)**
"198 of 261 controls assessed, and our quarterly findings trend is going the right direction — from 18 findings in Q3 down to 8 this quarter."

---

## PART 2: CLICK INTO A SYSTEM (3 minutes)

### Click "Leadership Metrics" tab, then click the CSMS card (yellow)

**Say:**
"Let me show you what this looks like at the system level. CSMS is our Medicaid system under CMS ARC-AMPE — it's conditional right now and here's why."

**Walk through the CSMS detail page:**
- "71% compliant — 5 active compliance gaps. The FTI encryption is critical, MFA enforcement is at 80%, and ConMon reports are 2 months behind."
- "Two risk acceptances — both with expiration dates and named owners."
- "Evidence completion is only 68% — 11 items missing. This is what's blocking the full ATO."
- "And here are the recent findings — the pen test in May found 4 critical/high issues."

**Then click back to the Shared Data Platform card (red):**
"This is our biggest risk — 58% compliant, ConMon not yet established, 152 controls not assessed. But now we can see that clearly instead of discovering it during an audit."

---

## PART 3: FRAMEWORK ISOLATION (1.5 minutes)

### Click "CMS ARC-AMPE" in the sidebar

**Say:**
"When the CMS assessor comes in, we're not scrambling to pull everything together. This view shows ONLY CMS ARC-AMPE — controls, POA&Ms, assessments, evidence, ATO packages — all isolated to this framework. Same for IRS Pub 1075, NIST, SSA."

"Notice the OSCAL pipeline banner — our automated compliance pipeline feeds findings directly into these framework views. Controls that can be tested automatically are, and everything else gets flagged for manual review."

---

## PART 4: THE OLA STORY (1.5 minutes)

### Click "Action Items" in the sidebar

**Say:**
"Let me tell you why this matters. We had an OLA audit finding that was shared with the ISSO team two years ago. It was sent in an email. Nobody tracked it. Nobody owned it. It sat open for over two years until it resurfaced during assessment prep."

**Point to the aging finding:**
"In this system, that can't happen. Every finding has a named owner, a due date, and automated escalation. The action items view separates pen test findings, external audit findings, and active incidents — each with accountability."

**Point to the notification bell:**
"And if something is approaching its deadline or overdue, the assignee gets notified through Microsoft Teams automatically."

---

## PART 5: DATA SECURITY (2 minutes)

**Say:**
"Now — the important question. We're tracking IRS 1075 FTI systems, CMS data, SSA PII. How do we protect the sensitive details?"

**Explain the architecture:**
"Linear is SOC 2 Type II certified and encrypts everything in transit and at rest. But it's not FedRAMP authorized, so we treat it as the workflow layer only."

**The data classification approach:**

"We follow a strict data classification model:

**What goes INTO Linear** — sanitized workflow data:
- Task titles: 'Collect AC-2 evidence for CSMS' — no hostnames, no IPs
- Status, assignees, due dates, framework labels
- Evidence reference IDs that point to the secure vault
- Remediation milestones and progress

**What stays OUT of Linear:**
- Screenshots, scan output, actual evidence artifacts
- Hostnames, IP addresses, architecture details
- Any FTI, CMS data references, or PII

**Where sensitive data lives:**
- Evidence artifacts go into SharePoint GCC High — which you already have through your Microsoft E5 GCC license and is FedRAMP High authorized
- Linear stores a reference: 'Evidence uploaded — EV-AC2-001, stored in SharePoint'
- The dashboard links both: you see the workflow status from Linear and the vault reference for the actual artifact

**The Teams integration follows the same rules:**
- When someone creates a task from a Teams conversation, the integration strips sensitive patterns before it hits Linear
- Hostnames, IPs, SSNs get flagged and redirected to the secure system
- The Linear task gets a sanitized version with a reference link

This way, the team works in Linear for task management and workflow, but sensitive compliance artifacts never leave your FedRAMP-authorized boundary."

---

## CLOSE (30 seconds)

**Say:**
"This gives leadership a trust center view they've never had. Every system, every framework, every finding — tracked with accountability. The OSCAL pipeline automates what it can. Teams integration keeps everyone connected. And the data classification model ensures we meet our Pub 1075 and CMS obligations for data handling."

"I have 15 minutes for questions."

---

## DISCUSSION PREP — LIKELY QUESTIONS & ANSWERS

### "What does this cost?"
"Linear is $8/user/month for the standard plan. The dashboard is custom-built and runs on our infrastructure. SharePoint GCC is already part of the state's Microsoft licensing. Total incremental cost is primarily the Linear seats — roughly $100/month for a 12-person GRC team."

### "Why not just use Jira?"
"Jira could work for task tracking, but it doesn't give us this executive layer out of the box. Linear's API is cleaner for building the trust center dashboard, and the UI is faster for the analysts doing daily work. The same dashboard approach could sit on top of Jira if that's preferred — the architecture is the same."

### "Is Linear FedRAMP authorized?"
"No, and that's exactly why we designed the data classification model. Linear handles workflow — who's doing what, what's the status, when is it due. Sensitive artifacts stay in SharePoint GCC High which is FedRAMP High authorized. We never put hostnames, scan results, or PII into Linear."

### "How do we know people will actually use it?"
"Three things: 1) The Teams integration means they don't have to leave the tools they already use — a message in Teams becomes a tracked task. 2) The notification system escalates automatically — overdue items alert assignees and their managers. 3) Leadership visibility creates accountability — when the CISO can see your name next to an overdue finding, people close their items."

### "What about the OSCAL pipeline?"
"The pipeline runs automated control assessments monthly. Anything that can be tested via API — like checking MFA enforcement, encryption settings, log forwarding — gets tested automatically. Failures create findings directly in Linear under the right framework. Manual controls get flagged for human review. Over time, we increase the automation percentage from 34% toward 60%+."

### "Can we see the Teams integration work?"
If you set up a webhook: "Let me show you — I'll trigger a notification right now." Run `node notify.js --teams <url>` live.

### "How long to implement?"
"The dashboard and Linear workspace can be production-ready in 2-3 weeks. The OSCAL pipeline integration is a parallel workstream — initial controls testing within 4-6 weeks, expanding automation over the following quarter. The Teams integration is same-day once we have the webhook configured."

### "Who maintains this?"
"The dashboard pulls live from Linear — no manual data entry for the metrics. The GRC team works in Linear as their daily tool. The trust center is the reporting layer that builds itself. Maintenance is primarily keeping the Linear workspace organized and expanding OSCAL automation."
