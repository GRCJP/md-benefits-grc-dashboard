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
const LINEAR_API_KEY = "lin_api_TwIy5Fu6iNh1Vb8ePSCxxjh9v7FBrItXmNDejjIt";
const LINEAR_TEAM_ID = "d4d5bf63-fae7-4938-9531-b1fb80618a8a";

async function fetchFromLinear() {
  const r = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: LINEAR_API_KEY },
    body: JSON.stringify({ query: \`{
      issues(filter: { team: { id: { eq: "\${LINEAR_TEAM_ID}" } } }, first: 150) {
        nodes {
          id identifier title description priority url
          state { name type }
          labels { nodes { name } }
          project { name }
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
  const actionItems = workIssues.filter(i=>actionTags.some(t=>hasLabel(i,t))).map(i=>({id:i.identifier,title:i.title,priority:i.priority,status:i.state.name,statusType:i.state.type,labels:getLabels(i),project:i.project?.name,description:i.description,createdAt:i.createdAt,assignee:i.assignee?.name||"Unassigned",source:hasLabel(i,"Pen Test Finding")?"Pen Test":hasLabel(i,"External Audit")?"External Audit":hasLabel(i,"Incident Response")?"Incident":hasLabel(i,"Aging Finding")?"Aging Finding":"Other"}));
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
  const issueRef = i => ({id:i.identifier,title:i.title,assignee:i.assignee?.name||"Unassigned",dueDate:i.dueDate,url:i.url,labels:getLabels(i),priority:i.priority});
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

  return { summary,byFramework,byCategory,byProject,poamByStatus,actionItems,incidents,ageBuckets,kevs,certs,docs,notifications,frameworks,categories,actionTags,
    issues:workIssues.map(i=>({id:i.identifier,title:i.title,priority:i.priority,status:i.state.name,statusType:i.state.type,labels:getLabels(i),project:i.project?.name,description:i.description,dueDate:i.dueDate,assignee:i.assignee?.name||"Unassigned"})) };
}
`;

// Replace the loadData function to use client-side fetch
const output = src.replace(
  `async function loadData() {\n  const res = await fetch('/api/data');\n  DATA = await res.json();`,
  `${CLIENT_DATA_LOGIC}\nasync function loadData() {\n  DATA = await fetchFromLinear();`
);

fs.writeFileSync(path.join(__dirname, "docs", "index.html"), output);
console.log("Built docs/index.html for GitHub Pages");
