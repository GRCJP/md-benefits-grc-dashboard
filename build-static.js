#!/usr/bin/env node
/**
 * Builds docs/index.html for GitHub Pages deployment.
 * Reads public/index.html and replaces the loadData() fetch('/api/data')
 * with inline Linear API call + data processing logic.
 */
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "public", "index.html"), "utf8");

// The data processing logic (same as server.js but runs in browser)
const CLIENT_DATA_LOGIC = `
const LINEAR_TEAM_ID = "d4d5bf63-fae7-4938-9531-b1fb80618a8a";

async function fetchFromLinear(apiKey) {
  const r = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: apiKey },
    body: JSON.stringify({ query: \`{
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
    }\` }),
  });
  const json = await r.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return processLinearData(json.data.issues.nodes);
}

function processLinearData(issues) {
  const frameworks = ["CMS ARC-AMPE", "IRS Pub 1075", "NIST 800-53", "SSA", "OLA"];
  const categories = ["Assessment", "POA&M", "Evidence", "ATO", "External Request", "Compliance", "Incident Response", "Pen Test Finding", "External Audit", "Aging Finding"];
  const getLabels = (i) => i.labels.nodes.map(l => l.name);
  const hasLabel = (i, l) => getLabels(i).includes(l);
  const isOpen = (i) => !["completed","canceled"].includes(i.state.type);
  const isDone = (i) => i.state.type === "completed";
  const workIssues = issues.filter(i => !i.title.startsWith("📊"));
  const now = new Date(), DAY = 86400000;

  const ownerRe = /(?:Assigned Owner|Owner|Assigned To|State Owner|Incident Commander|Reported By|Assessor):\\s*\\*?\\*?([^*\\n(]+)/i;
  function resolveAssignee(i) {
    if (i.assignee?.name) return i.assignee.name;
    if (i.description) { const m = i.description.match(ownerRe); if (m) return m[1].trim(); }
    return "Unassigned";
  }

  const summary = {
    total: workIssues.length,
    open: workIssues.filter(isOpen).length,
    closed: workIssues.filter(isDone).length,
    critical: workIssues.filter(i => hasLabel(i,"Critical") && isOpen(i)).length,
    high: workIssues.filter(i => hasLabel(i,"High") && isOpen(i)).length,
    medium: workIssues.filter(i => hasLabel(i,"Medium") && isOpen(i)).length,
    low: workIssues.filter(i => hasLabel(i,"Low") && isOpen(i)).length,
  };

  const byFramework = {};
  for (const fw of frameworks) {
    const fi = workIssues.filter(i => hasLabel(i, fw));
    byFramework[fw] = { total:fi.length, open:fi.filter(isOpen).length, closed:fi.filter(isDone).length, critical:fi.filter(i=>hasLabel(i,"Critical")).length, high:fi.filter(i=>hasLabel(i,"High")).length };
  }

  const byCategory = {};
  for (const cat of categories) {
    const ci = workIssues.filter(i => hasLabel(i, cat));
    byCategory[cat] = {
      total:ci.length, open:ci.filter(isOpen).length, closed:ci.filter(isDone).length,
      critical:ci.filter(i=>hasLabel(i,"Critical")).length, high:ci.filter(i=>hasLabel(i,"High")).length,
      inProgress:ci.filter(i=>i.state.type==="started").length, todo:ci.filter(i=>i.state.type==="unstarted").length, backlog:ci.filter(i=>i.state.type==="backlog").length,
      issues:ci.map(i=>({id:i.identifier,title:i.title,priority:i.priority,status:i.state.name,statusType:i.state.type,labels:getLabels(i),project:i.project?.name,description:i.description})),
    };
  }

  const byProject = {};
  for (const pn of ["Assessment Management","POA&M Tracker","External Request Management","ATO Package Management","Evidence Repository","Control Library"]) {
    const pi = workIssues.filter(i => i.project?.name === pn);
    byProject[pn] = { total:pi.length, open:pi.filter(isOpen).length, closed:pi.filter(isDone).length, inProgress:pi.filter(i=>i.state.type==="started").length, issues:pi.map(i=>({id:i.identifier,title:i.title,priority:i.priority,status:i.state.name,statusType:i.state.type,labels:getLabels(i),description:i.description})) };
  }

  const poamIssues = workIssues.filter(i => hasLabel(i,"POA&M"));
  const poamByStatus = { inProgress:poamIssues.filter(i=>i.state.type==="started").length, todo:poamIssues.filter(i=>i.state.type==="unstarted").length, backlog:poamIssues.filter(i=>i.state.type==="backlog").length, done:poamIssues.filter(isDone).length };

  const actionTags = ["Pen Test Finding","External Audit","Incident Response","Aging Finding","Accountability Gap"];
  const actionItems = workIssues.filter(i=>actionTags.some(t=>hasLabel(i,t))).map(i=>({id:i.identifier,title:i.title,priority:i.priority,status:i.state.name,statusType:i.state.type,labels:getLabels(i),project:i.project?.name,description:i.description,createdAt:i.createdAt,assignee:resolveAssignee(i),source:hasLabel(i,"Pen Test Finding")?"Pen Test":hasLabel(i,"External Audit")?"External Audit":hasLabel(i,"Incident Response")?"Incident":hasLabel(i,"Aging Finding")?"Aging Finding":"Other"}));
  const incidents = workIssues.filter(i=>hasLabel(i,"Incident Response")).map(i=>({id:i.identifier,title:i.title,priority:i.priority,status:i.state.name,statusType:i.state.type,labels:getLabels(i),description:i.description}));

  const openIssues = workIssues.filter(isOpen);
  const ageMs = i => now - new Date(i.createdAt);
  const ageBuckets = { under1Month:openIssues.filter(i=>ageMs(i)<30*DAY).length, months1to6:openIssues.filter(i=>ageMs(i)>=30*DAY&&ageMs(i)<180*DAY).length, months6to12:openIssues.filter(i=>ageMs(i)>=180*DAY&&ageMs(i)<365*DAY).length, over12:openIssues.filter(i=>ageMs(i)>=365*DAY).length };

  const mkDateItem = i => { const due=i.dueDate?new Date(i.dueDate):null; const dl=due?Math.ceil((due-now)/DAY):null; return {id:i.identifier,title:i.title,priority:i.priority,status:i.state.name,statusType:i.state.type,labels:getLabels(i),description:i.description,dueDate:i.dueDate,daysLeft:dl}; };

  const kevIssues = workIssues.filter(i=>hasLabel(i,"KEV"));
  const kevs = { total:kevIssues.length, open:kevIssues.filter(isOpen).length, resolved:kevIssues.filter(isDone).length, overdue:kevIssues.filter(i=>isOpen(i)&&i.dueDate&&new Date(i.dueDate)<now).length, items:kevIssues.map(mkDateItem) };

  const certIssues = workIssues.filter(i=>hasLabel(i,"Certificate"));
  const certs = { total:certIssues.length, critical:certIssues.filter(i=>i.dueDate&&Math.ceil((new Date(i.dueDate)-now)/DAY)<=7).length, warning:certIssues.filter(i=>{const d=i.dueDate?Math.ceil((new Date(i.dueDate)-now)/DAY):999;return d>7&&d<=30;}).length, ok:certIssues.filter(i=>{const d=i.dueDate?Math.ceil((new Date(i.dueDate)-now)/DAY):999;return d>30;}).length, items:certIssues.map(mkDateItem).sort((a,b)=>(a.daysLeft||999)-(b.daysLeft||999)) };

  const docIssues = workIssues.filter(i=>hasLabel(i,"Document Review"));
  const docs = { total:docIssues.length, overdue:docIssues.filter(i=>isOpen(i)&&i.dueDate&&new Date(i.dueDate)<now).length, dueSoon:docIssues.filter(i=>{const d=i.dueDate?Math.ceil((new Date(i.dueDate)-now)/DAY):999;return isOpen(i)&&d>=0&&d<=30;}).length, onTrack:docIssues.filter(i=>{const d=i.dueDate?Math.ceil((new Date(i.dueDate)-now)/DAY):999;return isOpen(i)&&d>30;}).length, completed:docIssues.filter(isDone).length, items:docIssues.map(mkDateItem).sort((a,b)=>(a.daysLeft||999)-(b.daysLeft||999)) };

  const notifications = [];
  const issueRef = i => ({id:i.identifier,title:i.title,assignee:resolveAssignee(i),dueDate:i.dueDate,url:i.url,labels:getLabels(i),priority:i.priority});
  for (const i of workIssues.filter(isOpen)) {
    if (!i.dueDate) continue;
    const dl = Math.ceil((new Date(i.dueDate)-now)/DAY);
    if (dl<0) notifications.push({type:"overdue",severity:"critical",message:\`OVERDUE by \${Math.abs(dl)} days\`,...issueRef(i)});
    else if (dl<=3) notifications.push({type:"due_imminent",severity:"critical",daysLeft:dl,message:\`Due in \${dl} day\${dl===1?'':'s'}\`,...issueRef(i)});
    else if (dl<=7) notifications.push({type:"due_soon",severity:"high",daysLeft:dl,message:\`Due in \${dl} days\`,...issueRef(i)});
    else if (dl<=14) notifications.push({type:"upcoming",severity:"medium",daysLeft:dl,message:\`Due in \${dl} days\`,...issueRef(i)});
    else if (dl<=30) notifications.push({type:"reminder",severity:"low",daysLeft:dl,message:\`Due in \${dl} days\`,...issueRef(i)});
  }
  for (const i of workIssues.filter(isOpen)) {
    if (!i.assignee && i.priority<=2) notifications.push({type:"unassigned",severity:"high",message:"No assignee",...issueRef(i)});
  }
  notifications.sort((a,b)=>{const s={critical:0,high:1,medium:2,low:3};return(s[a.severity]??4)-(s[b.severity]??4);});

  const realTeamNames = ["ISSO","Assessors","Tenant Support","POA&M Management","IR"];
  const byTeam = {};
  for (const tn of realTeamNames) {
    const ti = workIssues.filter(i => i.team?.name === tn || hasLabel(i, "Team: " + tn) || hasLabel(i, "Team: " + tn.replace("Management","Mgmt")));
    byTeam[tn] = { total:ti.length, open:ti.filter(isOpen).length, closed:ti.filter(isDone).length, critical:ti.filter(i=>hasLabel(i,"Critical")).length, inProgress:ti.filter(i=>i.state.type==="started").length };
  }

  return { summary,byFramework,byCategory,byProject,byTeam,teamLabels:realTeamNames,poamByStatus,actionItems,incidents,ageBuckets,kevs,certs,docs,notifications,frameworks,categories,actionTags,
    issues:workIssues.map(i=>({id:i.identifier,title:i.title,priority:i.priority,status:i.state.name,statusType:i.state.type,labels:getLabels(i),project:i.project?.name,team:i.team?.name||'Unassigned',description:i.description,dueDate:i.dueDate,assignee:resolveAssignee(i)})) };
}
`;

// Client-side chat logic for static build (calls Anthropic directly from browser)
const CLIENT_CHAT_LOGIC = `
const ANTHROPIC_API_KEY = localStorage.getItem("anthropic_api_key") || prompt("Enter Anthropic API Key (for AI chat, or press Cancel to skip):");
if (ANTHROPIC_API_KEY && !localStorage.getItem("anthropic_api_key")) localStorage.setItem("anthropic_api_key", ANTHROPIC_API_KEY);
`;

const CLIENT_CHAT_SEND = `
async function sendChat() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg || chatBusy) return;

  const apiKey = localStorage.getItem("anthropic_api_key");
  if (!apiKey) {
    const k = prompt("Enter Anthropic API Key:");
    if (k) localStorage.setItem("anthropic_api_key", k);
    else return;
  }

  chatBusy = true;
  input.value = '';
  document.getElementById('chatSendBtn').disabled = true;
  document.getElementById('chatSuggestions').style.display = 'none';

  const messages = document.getElementById('chatMessages');
  messages.innerHTML += \`<div class="chat-msg user"><div class="chat-bubble">\${msg.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div></div>\`;
  messages.innerHTML += \`<div id="chatTyping" class="chat-msg assistant"><div class="chat-bubble"><div class="chat-typing"><span></span><span></span><span></span></div></div></div>\`;
  messages.scrollTop = messages.scrollHeight;

  try {
    // Build system prompt from current DATA
    const issueSummaries = (DATA.issues||[]).map(i =>
      i.id+': '+i.title+' ['+i.status+'] P'+i.priority+' '+(i.assignee||'Unassigned')+' '+i.labels.filter(l=>!l.startsWith('Team:')).join(',')
    ).join('\\n');

    const s = DATA.summary||{};
    const systemPrompt = 'You are a GRC operations assistant for MD Benefits Trust Center. Answer concisely with issue IDs when possible.\\n'+
      'Total: '+s.total+' Open: '+s.open+' Closed: '+s.closed+' Critical: '+s.critical+' High: '+s.high+'\\n'+
      'Frameworks: '+(DATA.frameworks||[]).map(f => f+': '+(DATA.byFramework[f]?.open||0)+' open, '+(DATA.byFramework[f]?.critical||0)+' critical').join(' | ')+'\\n'+
      'KEVs: '+(DATA.kevs?.open||0)+' open, '+(DATA.kevs?.overdue||0)+' overdue | Certs: '+(DATA.certs?.critical||0)+' expiring <7d\\n'+
      'Issues:\\n'+issueSummaries.substring(0,3000);

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': localStorage.getItem('anthropic_api_key'),
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: msg }],
      }),
    });
    const data = await res.json();
    const typing = document.getElementById('chatTyping');
    if (typing) typing.remove();

    if (data.error) {
      messages.innerHTML += '<div class="chat-msg assistant"><div class="chat-bubble" style="color:#b91c1c;">Error: '+data.error.message+'</div></div>';
    } else {
      const reply = data.content?.[0]?.text || 'No response.';
      messages.innerHTML += '<div class="chat-msg assistant"><div class="chat-bubble">'+formatChatReply(reply)+'</div></div>';
    }
  } catch (err) {
    const typing = document.getElementById('chatTyping');
    if (typing) typing.remove();
    messages.innerHTML += '<div class="chat-msg assistant"><div class="chat-bubble" style="color:#b91c1c;">Failed to connect: '+err.message+'</div></div>';
  }

  messages.scrollTop = messages.scrollHeight;
  chatBusy = false;
  document.getElementById('chatSendBtn').disabled = false;
}
`;

// Replace the loadData function to use static snapshot with API key fallback
let output = src.replace(
  `async function loadData() {\n  const res = await fetch('/api/data');\n  DATA = await res.json();`,
  `${CLIENT_DATA_LOGIC}\n${CLIENT_CHAT_LOGIC}\nasync function loadData() {\n  try {\n    const snapshotRes = await fetch('data.json');\n    if (snapshotRes.ok) {\n      DATA = await snapshotRes.json();\n    } else {\n      throw new Error('No snapshot');\n    }\n  } catch(e) {\n    const LINEAR_API_KEY = localStorage.getItem("linear_api_key") || prompt("Enter Linear API Key:");\n    if (LINEAR_API_KEY && !localStorage.getItem("linear_api_key")) localStorage.setItem("linear_api_key", LINEAR_API_KEY);\n    DATA = await fetchFromLinear(LINEAR_API_KEY);\n  }`
);

// Replace the server-side sendChat with client-side version
output = output.replace(
  /let chatBusy = false;\nasync function sendChat\(\) \{[\s\S]*?document\.getElementById\('chatSendBtn'\)\.disabled = false;\n\}/,
  `let chatBusy = false;\n${CLIENT_CHAT_SEND}`
);

// Replace fetch('/api/chat'...) call pattern — the above regex handles the whole function

fs.writeFileSync(path.join(__dirname, "docs", "index.html"), output);
console.log("Built docs/index.html for GitHub Pages");
