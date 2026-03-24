import { useState, useEffect, useRef, useCallback } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, LabelList, AreaChart, Area, RadialBarChart, RadialBar, Legend } from "recharts";
import { supabase, signIn, signOut as sbSignOut, getProfile, loadWorkspaceState, saveWorkspaceState } from "./lib/supabase.js";

// ── AI helper (calls Vercel serverless function → Groq) ──────────────────────
async function aiChat({ messages, system, max_tokens = 800 }) {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, system, max_tokens }),
  });
  if (!res.ok) throw new Error("AI request failed");
  const data = await res.json();
  return data.text;
}

const T = {
  bg:"#060b14", surface:"#0d1625", card:"#111c2e", border:"#1a2d4a",
  accent:"#00d4ff", green:"#00e87a", amber:"#ffb300", red:"#ff4757",
  purple:"#a855f7", pink:"#ec4899", text:"#e8f0fe", muted:"#4a6080", dim:"#2a3f5f",
};
const mono = { fontFamily:"'JetBrains Mono',monospace" };
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:${T.bg};font-family:'Rajdhani',sans-serif;color:${T.text}}
  ::-webkit-scrollbar{width:4px;height:4px}
  ::-webkit-scrollbar-track{background:${T.surface}}
  ::-webkit-scrollbar-thumb{background:${T.border};border-radius:2px}
  input,select,textarea{font-family:'Rajdhani',sans-serif!important}
  input[type="date"]{color-scheme:dark}
  input[type="date"]::-webkit-calendar-picker-indicator{filter:invert(.5) sepia(1) saturate(3) hue-rotate(160deg);cursor:pointer}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  @keyframes wave{0%,60%,100%{transform:initial}30%{transform:translateY(-6px)}}
  @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
  .fade-in{animation:fadeIn .25s ease forwards}
  .pulse{animation:pulse 2s infinite}
  .spin{animation:spin 1s linear infinite}
  .wave span{display:inline-block;width:3px;background:${T.red};border-radius:2px;height:16px;margin:0 1px}
  .wave span:nth-child(1){animation:wave 1.2s 0s infinite}
  .wave span:nth-child(2){animation:wave 1.2s .1s infinite}
  .wave span:nth-child(3){animation:wave 1.2s .2s infinite}
  .wave span:nth-child(4){animation:wave 1.2s .3s infinite}
  .wave span:nth-child(5){animation:wave 1.2s .4s infinite}
`;

// ── US-MARKET DATA ─────────────────────────────────────────────────────────────
const USERS = [
  {id:1,username:"admin", password:"123",name:"Marcus Reid",  role:"CEO",              initials:"MR",isAdmin:true, dept:"Executive",  color:"#00d4ff"},
  {id:2,username:"jordan",password:"123",name:"Jordan Blake", role:"Head of Sales",    initials:"JB",isAdmin:false,dept:"Sales",       color:"#00e87a"},
  {id:3,username:"priya", password:"123",name:"Priya Sharma", role:"HR Director",      initials:"PS",isAdmin:false,dept:"HR",          color:"#a855f7"},
  {id:4,username:"derek", password:"123",name:"Derek Cole",   role:"VP Engineering",   initials:"DC",isAdmin:true, dept:"Engineering", color:"#ffb300"},
  {id:5,username:"sofia", password:"123",name:"Sofia Torres", role:"Head of Marketing",initials:"ST",isAdmin:false,dept:"Marketing",   color:"#ec4899"},
];

const COMPANIES = [
  {id:"c1",name:"Titan Software",   color:"#00d4ff",industry:"SaaS / B2B",       hq:"San Francisco, CA", size:"Series B"},
  {id:"c2",name:"Apex Commerce",    color:"#00e87a",industry:"E-Commerce",        hq:"Austin, TX",        size:"Series A"},
  {id:"c3",name:"Vertex Logistics", color:"#ffb300",industry:"Supply Chain Tech", hq:"Chicago, IL",       size:"Seed"},
];

const PROJECTS = [
  {id:"p1",name:"Platform v3.0",        companyId:"c1",members:[1,2,4],   status:"Active",  deadline:"2025-06-30",color:"#00d4ff",desc:"Full-stack platform rebuild"},
  {id:"p2",name:"Mobile App Launch",    companyId:"c1",members:[4,5],     status:"Active",  deadline:"2025-03-31",color:"#a855f7",desc:"iOS + Android launch"},
  {id:"p3",name:"US Market Expansion",  companyId:"c2",members:[2,3,5],   status:"Active",  deadline:"2025-04-30",color:"#00e87a",desc:"Expand to 10 new US states"},
  {id:"p4",name:"Last-Mile Automation", companyId:"c3",members:[1,3,4],   status:"Planning",deadline:"2025-09-30",color:"#ffb300",desc:"ML-driven route optimization"},
];

const SC  = {"Completed":"#00e87a","In Progress":"#ffb300","Waiting":"#00d4ff","Not Started":"#ff4757"};
const PC  = {"Week":"#a855f7","Month":"#00e87a","Quarter":"#ffb300","Half-Year":"#f97316","Year":"#ec4899"};
const PRC = {"High":"#ff4757","Medium":"#ffb300","Low":"#00e87a"};
const PRI = {"High":"▲","Medium":"●","Low":"▼"};
const PERIODS  = ["Week","Month","Quarter","Half-Year","Year"];
const STATUSES = ["Not Started","In Progress","Waiting","Completed"];
const PRIOS    = ["High","Medium","Low"];
const KANBAN_COLS = ["Backlog","To Do","In Progress","In Review","Done"];

// KPI history: last 6 months (oldest → newest)
const INIT_KPIS = [
  // ── REVENUE ──────────────────────────────────────────────────────────────
  {id:"k1",name:"Monthly Recurring Revenue",abbr:"MRR",category:"Revenue",
   unit:"$",prefix:true,format:"currency",target:200000,current:168000,
   trend:"up",trendPct:18,status:"on_track",owner:"Marcus Reid",period:"Monthly",
   description:"Total predictable revenue per month from all active subscriptions",
   history:[98000,112000,124000,138000,155000,168000],
   benchmark:"$200K by Q2 2025"},
  {id:"k2",name:"Annual Recurring Revenue",abbr:"ARR",category:"Revenue",
   unit:"$",prefix:true,format:"currency",target:2400000,current:2016000,
   trend:"up",trendPct:18,status:"on_track",owner:"Marcus Reid",period:"Annual",
   description:"MRR × 12 — the gold standard SaaS growth metric",
   history:[1176000,1344000,1488000,1656000,1860000,2016000],
   benchmark:"$2.4M by EOY"},
  {id:"k3",name:"Customer Acquisition Cost",abbr:"CAC",category:"Revenue",
   unit:"$",prefix:true,format:"currency",target:350,current:420,
   trend:"down",trendPct:-8,status:"needs_attention",owner:"Jordan Blake",period:"Monthly",
   description:"Total sales & marketing spend ÷ new customers acquired",
   history:[580,520,490,460,455,420],
   benchmark:"< $350 target"},
  {id:"k4",name:"Lifetime Value",abbr:"LTV",category:"Revenue",
   unit:"$",prefix:true,format:"currency",target:4000,current:3200,
   trend:"up",trendPct:6,status:"on_track",owner:"Jordan Blake",period:"Rolling",
   description:"Average revenue per customer over their entire lifecycle",
   history:[2400,2600,2800,2900,3000,3200],
   benchmark:"LTV/CAC > 3×"},
  {id:"k5",name:"LTV / CAC Ratio",abbr:"LTV:CAC",category:"Revenue",
   unit:"×",prefix:false,format:"ratio",target:4,current:7.6,
   trend:"up",trendPct:12,status:"exceeds",owner:"Marcus Reid",period:"Rolling",
   description:"Measure of how efficiently you acquire customers vs their value",
   history:[4.1,5.0,5.7,6.3,7.1,7.6],
   benchmark:"Best-in-class > 5×"},
  // ── PRODUCT ──────────────────────────────────────────────────────────────
  {id:"k6",name:"Monthly Active Users",abbr:"MAU",category:"Product",
   unit:"",prefix:false,format:"number",target:50000,current:22000,
   trend:"up",trendPct:22,status:"at_risk",owner:"Sofia Torres",period:"Monthly",
   description:"Unique users who perform at least one action in a 30-day window",
   history:[8000,10500,12800,15600,18000,22000],
   benchmark:"50K by H1 2025"},
  {id:"k7",name:"Daily Active Users",abbr:"DAU",category:"Product",
   unit:"",prefix:false,format:"number",target:8000,current:4800,
   trend:"up",trendPct:15,status:"on_track",owner:"Sofia Torres",period:"Daily",
   description:"Unique users active on any given day",
   history:[1800,2200,2900,3500,4100,4800],
   benchmark:"DAU/MAU stickiness > 20%"},
  {id:"k8",name:"Net Promoter Score",abbr:"NPS",category:"Product",
   unit:"pts",prefix:false,format:"score",target:60,current:34,
   trend:"up",trendPct:6,status:"needs_attention",owner:"Jordan Blake",period:"Quarterly",
   description:"% Promoters minus % Detractors — key loyalty indicator",
   history:[18,22,24,28,32,34],
   benchmark:"60+ is world-class"},
  {id:"k9",name:"Monthly Churn Rate",abbr:"Churn",category:"Product",
   unit:"%",prefix:false,format:"percent",target:3,current:3.2,
   trend:"down",trendPct:-4,status:"needs_attention",owner:"Jordan Blake",period:"Monthly",
   description:"Percentage of customers who cancel per month",
   history:[5.1,4.8,4.4,4.0,3.6,3.2],
   benchmark:"< 3% is healthy for SaaS"},
  {id:"k10",name:"Feature Adoption Rate",abbr:"FAR",category:"Product",
   unit:"%",prefix:false,format:"percent",target:65,current:48,
   trend:"up",trendPct:8,status:"on_track",owner:"Derek Cole",period:"Monthly",
   description:"% of users who use core features at least once per month",
   history:[28,32,38,41,44,48],
   benchmark:"65% target"},
  // ── PEOPLE ───────────────────────────────────────────────────────────────
  {id:"k11",name:"Employee NPS",abbr:"eNPS",category:"People",
   unit:"pts",prefix:false,format:"score",target:70,current:48,
   trend:"up",trendPct:4,status:"on_track",owner:"Priya Sharma",period:"Quarterly",
   description:"How likely employees are to recommend working here",
   history:[28,32,36,40,45,48],
   benchmark:"50+ is good, 70+ excellent"},
  {id:"k12",name:"Time to Hire",abbr:"TTH",category:"People",
   unit:"days",prefix:false,format:"number",target:21,current:28,
   trend:"down",trendPct:-12,status:"needs_attention",owner:"Priya Sharma",period:"Monthly",
   description:"Average days from job posting to signed offer",
   history:[45,42,38,35,32,28],
   benchmark:"< 21 days target"},
  {id:"k13",name:"Headcount Growth",abbr:"HCG",category:"People",
   unit:"%",prefix:false,format:"percent",target:30,current:18,
   trend:"up",trendPct:3,status:"on_track",owner:"Priya Sharma",period:"Annual",
   description:"YoY percentage growth in total full-time employees",
   history:[8,10,12,14,16,18],
   benchmark:"Target 30% by EOY"},
  // ── OPERATIONS ────────────────────────────────────────────────────────────
  {id:"k14",name:"API Uptime",abbr:"Uptime",category:"Operations",
   unit:"%",prefix:false,format:"percent",target:99.9,current:99.7,
   trend:"up",trendPct:0.1,status:"on_track",owner:"Derek Cole",period:"Monthly",
   description:"Percentage of time the API is available and responding normally",
   history:[99.1,99.3,99.4,99.5,99.6,99.7],
   benchmark:"99.9% SLA target"},
  {id:"k15",name:"P95 API Latency",abbr:"Latency",category:"Operations",
   unit:"ms",prefix:false,format:"number",target:200,current:310,
   trend:"down",trendPct:-14,status:"needs_attention",owner:"Derek Cole",period:"Monthly",
   description:"95th percentile API response time — most users experience this or better",
   history:[520,480,440,400,360,310],
   benchmark:"< 200ms target"},
  {id:"k16",name:"Sprint Velocity",abbr:"Velocity",category:"Operations",
   unit:"sp",prefix:false,format:"number",target:40,current:32,
   trend:"up",trendPct:7,status:"on_track",owner:"Derek Cole",period:"Per Sprint",
   description:"Story points completed per 2-week sprint",
   history:[18,22,24,26,30,32],
   benchmark:"40sp per sprint target"},
];

const INIT_GOALS = [
  {id:1, goal:"Close $2M ARR by Q2",              cat:"Revenue",    owner:"Marcus Reid",  period:"Quarter",  status:"In Progress",progress:62,priority:"High",  budget:0,       deadline:"2025-06-30",companyId:"c1",projectId:"p1"},
  {id:2, goal:"Launch mobile app on App Store",   cat:"Product",    owner:"Derek Cole",   period:"Quarter",  status:"In Progress",progress:74,priority:"High",  budget:250000,  deadline:"2025-03-31",companyId:"c1",projectId:"p2"},
  {id:3, goal:"Hire 5 senior engineers",          cat:"Hiring",     owner:"Priya Sharma", period:"Month",    status:"In Progress",progress:40,priority:"High",  budget:80000,   deadline:"2025-03-31",companyId:"c1",projectId:"p1"},
  {id:4, goal:"Expand to 10 new US states",       cat:"Growth",     owner:"Jordan Blake", period:"Half-Year",status:"In Progress",progress:30,priority:"High",  budget:150000,  deadline:"2025-06-30",companyId:"c2",projectId:"p3"},
  {id:5, goal:"Reach 50K monthly active users",   cat:"Product",    owner:"Sofia Torres", period:"Half-Year",status:"In Progress",progress:44,priority:"High",  budget:0,       deadline:"2025-06-30",companyId:"c1",projectId:"p2"},
  {id:6, goal:"Double NPS from 34 to 68",         cat:"CX",         owner:"Jordan Blake", period:"Year",     status:"In Progress",progress:28,priority:"High",  budget:0,       deadline:"2025-12-31",companyId:"c1",projectId:"p1"},
  {id:7, goal:"Automate BI reporting pipeline",   cat:"Data",       owner:"Derek Cole",   period:"Half-Year",status:"Not Started",progress:0, priority:"Medium",budget:40000,   deadline:"2025-06-30",companyId:"c1",projectId:"p1"},
  {id:8, goal:"SOC 2 Type II certification",      cat:"Security",   owner:"Derek Cole",   period:"Year",     status:"Not Started",progress:0, priority:"Medium",budget:60000,   deadline:"2025-12-31",companyId:"c1",projectId:"p1"},
  {id:9, goal:"Launch affiliate program",         cat:"Marketing",  owner:"Sofia Torres", period:"Quarter",  status:"Waiting",    progress:12,priority:"Medium",budget:20000,   deadline:"2025-03-31",companyId:"c2",projectId:"p3"},
  {id:10,goal:"Cut churn rate below 3%",          cat:"Retention",  owner:"Jordan Blake", period:"Year",     status:"In Progress",progress:35,priority:"High",  budget:0,       deadline:"2025-12-31",companyId:"c1",projectId:"p1"},
];

const INIT_TASKS = [
  {id:1,title:"Review auth module PR #147",       assignee:"Derek Cole",  company:"c1",project:"p1",cat:"Engineering",priority:"High",  status:"In Progress",dueDate:"2025-03-07",timerStart:null,loggedHours:1.5,notes:"OAuth2 + MFA",       rating:null,subtasks:[{id:11,text:"Review auth flow",done:true},{id:12,text:"Check edge cases",done:false}],  kanban:"In Review",  recurring:null,effort:3},
  {id:2,title:"Investor deck for Series B",       assignee:"Marcus Reid", company:"c1",project:"p1",cat:"Finance",    priority:"High",  status:"To Do",      dueDate:"2025-03-10",timerStart:null,loggedHours:0,  notes:"",                   rating:null,subtasks:[{id:21,text:"Financials slide",done:false},{id:22,text:"Market size slide",done:false}],kanban:"To Do",      recurring:null,effort:5},
  {id:3,title:"Q1 competitor research report",    assignee:"Priya Sharma",company:"c2",project:"p3",cat:"Research",   priority:"Medium",status:"To Do",      dueDate:"2025-03-15",timerStart:null,loggedHours:0.5,notes:"Focus on Salesforce",  rating:null,subtasks:[{id:31,text:"Top 5 competitors",done:false}],                                           kanban:"Backlog",    recurring:null,effort:5},
  {id:4,title:"Set up CI/CD on GitHub Actions",   assignee:"Derek Cole",  company:"c1",project:"p2",cat:"DevOps",     priority:"Medium",status:"Completed",  dueDate:"2025-03-05",timerStart:null,loggedHours:3.0,notes:"Node 20 + Jest",       rating:5,   subtasks:[],                                                                                         kanban:"Done",       recurring:null,effort:3},
  {id:5,title:"Q2 budget review with CFO",        assignee:"Marcus Reid", company:"c1",project:"p1",cat:"Finance",    priority:"High",  status:"In Progress",dueDate:"2025-03-12",timerStart:null,loggedHours:0.8,notes:"Need projections",      rating:null,subtasks:[{id:51,text:"Prepare spreadsheet",done:true}],                                           kanban:"In Progress",recurring:"monthly",effort:2},
  {id:6,title:"Weekly sales pipeline review",     assignee:"Jordan Blake",company:"c1",project:"p1",cat:"Sales",      priority:"Medium",status:"To Do",      dueDate:"2025-03-10",timerStart:null,loggedHours:0,  notes:"",                   rating:null,subtasks:[],                                                                                         kanban:"To Do",      recurring:"weekly", effort:1},
  {id:7,title:"App Store submission package",     assignee:"Derek Cole",  company:"c1",project:"p2",cat:"Engineering",priority:"High",  status:"To Do",      dueDate:"2025-03-28",timerStart:null,loggedHours:0,  notes:"Screenshots + copy",  rating:null,subtasks:[{id:71,text:"Screenshot set",done:false},{id:72,text:"App description",done:false},{id:73,text:"Privacy policy",done:false}],kanban:"Backlog",recurring:null,effort:4},
  {id:8,title:"Launch email campaign — Q2",       assignee:"Sofia Torres",company:"c2",project:"p3",cat:"Marketing",  priority:"Medium",status:"To Do",      dueDate:"2025-03-20",timerStart:null,loggedHours:0,  notes:"Mailchimp",          rating:null,subtasks:[],                                                                                         kanban:"To Do",      recurring:null,effort:3},
];

const INIT_TODOS = [
  {id:1,text:"Send Series B investor deck",       done:false,priority:"High",  tag:"Finance",    dueDate:"2025-03-07",assignee:"Marcus Reid",  notes:"Sequoia + a16z",companyId:"c1",projectId:"p1"},
  {id:2,text:"Review auth module PR",             done:false,priority:"High",  tag:"Engineering",dueDate:"2025-03-07",assignee:"Derek Cole",   notes:"",              companyId:"c1",projectId:"p2"},
  {id:3,text:"Update employee handbook",          done:true, priority:"Low",   tag:"HR",         dueDate:"2025-03-05",assignee:"Priya Sharma", notes:"",              companyId:"c1",projectId:"p1"},
  {id:4,text:"Extend offer to senior engineer",   done:false,priority:"High",  tag:"Hiring",     dueDate:"2025-03-08",assignee:"Priya Sharma", notes:"L5 backend",    companyId:"c1",projectId:"p1"},
  {id:5,text:"Configure Datadog monitoring",      done:false,priority:"Medium",tag:"DevOps",     dueDate:"2025-03-10",assignee:"Derek Cole",   notes:"",              companyId:"c1",projectId:"p2"},
  {id:6,text:"Draft Q2 marketing plan",           done:false,priority:"High",  tag:"Marketing",  dueDate:"2025-03-12",assignee:"Sofia Torres", notes:"",              companyId:"c2",projectId:"p3"},
  {id:7,text:"Run 1:1s — engineering team",       done:false,priority:"Medium",tag:"Management", dueDate:"2025-03-09",assignee:"Derek Cole",   notes:"6 people",      companyId:"c1",projectId:"p1"},
  {id:8,text:"Finalize route optimization spec",  done:false,priority:"High",  tag:"Engineering",dueDate:"2025-04-01",assignee:"Marcus Reid",  notes:"",              companyId:"c3",projectId:"p4"},
];

const INIT_OKRS = [
  {id:"o1",objective:"Become the #1 B2B SaaS tool for SMBs in the US",period:"H1 2025",owner:"Marcus Reid",companyId:"c1",progress:48,keyResults:[
    {id:"kr1",text:"Reach $2M ARR",              target:2,    current:1.24,unit:"M",    progress:62},
    {id:"kr2",text:"50K Monthly Active Users",   target:50000,current:22000,unit:"users",progress:44},
    {id:"kr3",text:"NPS score ≥ 60",             target:60,   current:34,  unit:"pts",  progress:57},
    {id:"kr4",text:"Land 3 enterprise accounts", target:3,    current:1,   unit:"accts",progress:33},
  ]},
  {id:"o2",objective:"Build a world-class remote-first engineering team",period:"2025",owner:"Derek Cole",companyId:"c1",progress:38,keyResults:[
    {id:"kr5",text:"Hire 5 senior engineers",     target:5,    current:2,   unit:"people",progress:40},
    {id:"kr6",text:"P95 API latency < 200ms",     target:200,  current:310, unit:"ms",   progress:35},
    {id:"kr7",text:"Test coverage ≥ 85%",         target:85,   current:61,  unit:"%",    progress:72},
  ]},
  {id:"o3",objective:"Dominate US e-commerce fulfillment market",period:"H1 2025",owner:"Jordan Blake",companyId:"c2",progress:29,keyResults:[
    {id:"kr8",text:"Expand to 10 new US states",  target:10,   current:3,   unit:"states",progress:30},
    {id:"kr9",text:"Revenue from new markets $500K",target:500, current:120, unit:"K",    progress:24},
    {id:"kr10",text:"Partner with 20 warehouses",  target:20,   current:6,   unit:"WH",   progress:30},
  ]},
];

const INIT_DOCS = [
  {id:"d1",title:"Platform v3 Architecture",      type:"doc",    content:"## Overview\nPlatform v3 is built on a microservices architecture deployed on AWS EKS.\n\n## Core Services\n- Auth Service (Node.js + Passport)\n- API Gateway (Kong)\n- Notification Service (SQS + Lambda)\n- Analytics Pipeline (Kinesis + Redshift)\n\n## Tech Stack\nFrontend: React 18, TypeScript, Tailwind\nBackend: Node.js, PostgreSQL, Redis",category:"Engineering",author:"Derek Cole",   date:"2025-03-01",projectId:"p1"},
  {id:"d2",title:"Q1 All-Hands Meeting Notes",    type:"meeting",content:"## Date: March 3, 2025\n## Attendees: Full team (23 people)\n\n## Key Announcements\n1. Series B fundraising process starts Q2\n2. Mobile app targeting Mar 31 launch\n3. New hire: 2 engineers joining March 17\n\n## Action Items\n- Marcus: Finalize investor deck by March 10\n- Jordan: Q1 pipeline update by March 7\n- Priya: Onboarding plan for new hires",category:"Meetings",  author:"Marcus Reid", date:"2025-03-03",projectId:"p1"},
  {id:"d3",title:"Employee Onboarding SOP",       type:"sop",    content:"## Day 1\n1. Laptop + accounts setup (IT)\n2. Benefits enrollment\n3. Intro calls with team leads\n\n## Week 1\n1. Product deep-dive with PM\n2. Codebase walkthrough with senior engineer\n3. First task assigned\n\n## 30-Day Check-in\n- Performance expectations\n- OKR alignment",category:"HR",       author:"Priya Sharma",date:"2025-02-15",projectId:"p1"},
  {id:"d4",title:"Sales Playbook 2025",           type:"doc",    content:"## ICP (Ideal Customer Profile)\n- B2B SaaS companies\n- 10–200 employees\n- US-based, Series A or bootstrapped\n- Pain: manual ops, no unified dashboard\n\n## Discovery Questions\n1. What tools do you use today for goal tracking?\n2. How many hours/week on reporting?\n3. Who owns OKRs at your company?\n\n## Objection Handling\n- Too expensive → ROI calculator\n- Too complex → 30-min onboarding guarantee",category:"Sales",     author:"Jordan Blake",date:"2025-02-28",projectId:"p3"},
];

const INIT_SHIPS = [
  {id:"SH-001",date:"2025-03-01",am:"Jordan Blake",dest:"Amazon FBA — East",   skus:"SKU-PRO-01, SKU-ENT-01",qty:500, status:"Shipped",   tracking:"1Z999AA1012345678",companyId:"c2"},
  {id:"SH-002",date:"2025-03-03",am:"Marcus Reid", dest:"Shopify Fulfillment", skus:"SKU-STD-01",             qty:200, status:"In Transit",tracking:"9400111899223397988015",companyId:"c2"},
  {id:"SH-003",date:"2025-03-05",am:"Jordan Blake",dest:"Amazon FBA — West",   skus:"SKU-PRO-01",             qty:150, status:"Delivered", tracking:"1Z999AA1012345679",companyId:"c2"},
  {id:"SH-004",date:"2025-03-06",am:"Derek Cole",  dest:"Direct B2B — NYC",    skus:"SKU-ENT-01, SKU-ENT-02", qty:50,  status:"Packing",   tracking:"—",                companyId:"c3"},
];

const INIT_STANDUPS = [];

// ── UI ATOMS ───────────────────────────────────────────────────────────────────
const inp = (x={})=>({background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,padding:"7px 11px",color:T.text,fontSize:13,outline:"none",width:"100%",...x});
const bS  = (bg=T.accent,x={})=>({background:bg,border:"none",borderRadius:6,padding:"7px 14px",color:bg===T.surface?"#64748b":T.bg,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"'Rajdhani',sans-serif",letterSpacing:.5,...x});

function Tag({c,sm,children}){return <span style={{background:c+"18",color:c,padding:sm?"1px 5px":"2px 7px",borderRadius:3,fontSize:sm?9:11,fontWeight:700,letterSpacing:.5,border:`1px solid ${c}30`,whiteSpace:"nowrap"}}>{children}</span>;}
function Card({children,style={}}){return <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:14,...style}}>{children}</div>;}

// Professional initials avatar — replaces all emoji avatars
function Av({user,size=32,fontSize,style={}}){
  const u = typeof user==="string" ? USERS.find(x=>x.name===user)||{initials:user.slice(0,2).toUpperCase(),color:T.muted} : user;
  const initials = u.initials || (u.name ? u.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase() : "?");
  const fs = fontSize || Math.round(size*0.35);
  return(
    <div style={{width:size,height:size,borderRadius:Math.round(size*0.28),background:u.color+"22",
      border:`1px solid ${u.color}50`,display:"flex",alignItems:"center",justifyContent:"center",
      flexShrink:0,color:u.color,fontWeight:700,fontSize:fs,letterSpacing:.5,
      fontFamily:"'JetBrains Mono',monospace",...style}}>
      {initials}
    </div>
  );
}
function STitle({children,accent=T.accent,right}){
  return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:3,height:16,background:accent,borderRadius:2}}/>
        <h2 style={{fontSize:16,fontWeight:700,letterSpacing:1,color:T.text,textTransform:"uppercase"}}>{children}</h2>
      </div>
      {right&&<div>{right}</div>}
    </div>
  );
}
function Fld({label,children,col}){return(<div style={col?{gridColumn:col}:{}}><label style={{display:"block",fontSize:9,color:T.muted,letterSpacing:1,marginBottom:4}}>{label}</label>{children}</div>);}
function DatePicker({value,onChange}){return <input type="date" value={value||""} onChange={e=>onChange(e.target.value)} style={inp()}/>;}
function PrioPicker({value,onChange}){
  return(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4}}>
    {PRIOS.map(p=><button key={p} onClick={()=>onChange(p)} style={{padding:"6px 3px",borderRadius:5,border:`2px solid ${value===p?PRC[p]:T.border}`,background:value===p?PRC[p]+"20":"transparent",color:value===p?PRC[p]:T.muted,cursor:"pointer",fontFamily:"'Rajdhani',sans-serif",fontWeight:700,fontSize:11,transition:"all .15s"}}>{PRI[p]} {p}</button>)}
  </div>);
}
function ProgressRing({pct,size=60,stroke=6,color=T.accent}){
  const r=size/2-stroke; const circ=2*Math.PI*r;
  return(
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.border} strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={circ*(1-pct/100)} strokeLinecap="round" style={{transition:"stroke-dashoffset .5s"}}/>
      </svg>
      <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",textAlign:"center"}}>
        <div style={{fontSize:size>50?13:10,fontWeight:800,color,...mono}}>{pct}%</div>
      </div>
    </div>
  );
}
const CTT=({active,payload,label})=>{if(!active||!payload?.length)return null;return(<div style={{background:"#0d1625",border:`1px solid ${T.border}`,borderRadius:7,padding:"7px 12px",...mono}}>{label&&<p style={{fontWeight:700,color:T.muted,fontSize:11,marginBottom:3}}>{label}</p>}{payload.map((p,i)=><p key={i} style={{color:p.fill||p.color||T.text,fontSize:12,margin:"1px 0"}}>{p.name}: <b>{p.value}</b></p>)}</div>);};
const fmtUSD=(n)=>n>=1000000?`$${(n/1000000).toFixed(1)}M`:n>=1000?`$${(n/1000).toFixed(0)}K`:`$${n}`;

// ── LOGIN (Supabase Auth) ─────────────────────────────────────────────────────
function Login({onLogin}){
  const [email,setEmail]=useState(""); const [pw,setPw]=useState(""); const [e,setE]=useState(""); const [loading,setLoading]=useState(false);
  const go=async()=>{
    if(!email||!pw)return;
    setLoading(true);setE("");
    try{
      const {user}=await signIn(email,pw);
      const profile=await getProfile(user.id);
      onLogin({id:user.id,username:email.split("@")[0],name:profile.name,role:profile.role,initials:profile.initials,color:profile.color,dept:profile.dept,isAdmin:profile.is_admin});
    }catch(err){setE(err.message||"Invalid credentials");}
    setLoading(false);
  };
  // Demo account quick-fill
  const demoAccounts=[
    {email:"admin@titan.demo",name:"Marcus Reid",role:"CEO",color:"#00d4ff"},
    {email:"jordan@titan.demo",name:"Jordan Blake",role:"Head of Sales",color:"#00e87a"},
    {email:"priya@titan.demo",name:"Priya Sharma",role:"HR Director",color:"#a855f7"},
    {email:"derek@titan.demo",name:"Derek Cole",role:"VP Engineering",color:"#ffb300"},
    {email:"sofia@titan.demo",name:"Sofia Torres",role:"Head of Marketing",color:"#ec4899"},
  ];
  return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse at 20% 50%,#00d4ff07 0%,transparent 60%),radial-gradient(ellipse at 80% 20%,#a855f707 0%,transparent 60%)`}}/>
      <div style={{position:"absolute",inset:0,backgroundImage:`linear-gradient(${T.border}18 1px,transparent 1px),linear-gradient(90deg,${T.border}18 1px,transparent 1px)`,backgroundSize:"40px 40px",opacity:.4}}/>
      <div className="fade-in" style={{width:380,zIndex:10}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:40,marginBottom:5}}>🦁</div>
          <h1 style={{fontSize:24,fontWeight:700,letterSpacing:3,color:T.accent,...mono}}>TITAN OS</h1>
          <p style={{color:T.muted,fontSize:10,letterSpacing:2,marginTop:3}}>COMMAND & CONTROL · v4.0</p>
        </div>
        <Card style={{padding:24}}>
          <Fld label="EMAIL"><input style={inp()} value={email} onChange={e=>{setEmail(e.target.value);setE("");}} placeholder="admin@titan.demo" onKeyDown={e=>e.key==="Enter"&&go()}/></Fld>
          <div style={{height:10}}/>
          <Fld label="PASSWORD"><input style={inp()} type="password" value={pw} onChange={e=>{setPw(e.target.value);setE("");}} placeholder="••••••" onKeyDown={e=>e.key==="Enter"&&go()}/></Fld>
          <div style={{height:16}}/>
          {e&&<p style={{color:T.red,fontSize:11,textAlign:"center",marginBottom:10}}>{e}</p>}
          <button style={bS(T.accent,{width:"100%",padding:"9px",fontSize:14,letterSpacing:1,opacity:loading?.6:1})} onClick={go} disabled={loading}>{loading?"SIGNING IN…":"SIGN IN →"}</button>
          <div style={{marginTop:16,padding:10,background:T.surface,borderRadius:6}}>
            <p style={{fontSize:9,color:T.muted,marginBottom:5,letterSpacing:1}}>DEMO ACCOUNTS (password: titan123!)</p>
            {demoAccounts.map(u=><div key={u.email} onClick={()=>{setEmail(u.email);setPw("titan123!");}} style={{display:"flex",alignItems:"center",gap:7,padding:"4px 0",cursor:"pointer"}}><div style={{width:24,height:24,borderRadius:7,background:u.color+"22",border:`1px solid ${u.color}50`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:u.color,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{u.name.split(" ").map(w=>w[0]).join("")}</div><span style={{fontSize:11,color:T.accent,...mono}}>{u.email.split("@")[0]}</span><span style={{fontSize:10,color:T.muted}}>— {u.role}</span></div>)}
          </div>
        </Card>
      </div>
    </div>
  );
}

const NAV=[
  {k:"mywork",   i:"⊡",l:"My Work"},
  {k:"dashboard",i:"◈",l:"Dashboard"},
  {k:"kanban",   i:"▦",l:"Kanban"},
  {k:"kpis",     i:"◑",l:"KPIs"},
  {k:"goals",    i:"◎",l:"Goals"},
  {k:"okrs",     i:"◉",l:"OKRs"},
  {k:"tasks",    i:"⏱",l:"Tasks"},
  {k:"todos",    i:"✓", l:"To-Do's"},
  {k:"focus",    i:"◎",l:"Focus"},
  {k:"standup",  i:"◷",l:"Standup"},
  {k:"meetings", i:"◑",l:"Meetings"},
  {k:"workspace",i:"◆",l:"Workspace"},
  {k:"team",     i:"◉",l:"Team"},
  {k:"projects", i:"▤",l:"Projects"},
  {k:"docs",     i:"▧",l:"Docs"},
  {k:"logistics",i:"◫",l:"Logistics"},
  {k:"ai",       i:"⬡",l:"AI"},
  {k:"analytics",i:"◬",l:"Analytics"},
];

// ══════════════════════════════════════════════════════════════════════════════
// ROOT
// ══════════════════════════════════════════════════════════════════════════════
export default function App(){
  const [user,setUser]     = useState(null);
  const [page,setPage]     = useState("mywork");
  const [kpis,setKpis]     = useState(INIT_KPIS);
  const [tasks,setTasks]   = useState(INIT_TASKS);
  const [todos,setTodos]   = useState(INIT_TODOS);
  const [goals,setGoals]   = useState(INIT_GOALS);
  const [okrs,setOkrs]     = useState(INIT_OKRS);
  const [docs,setDocs]     = useState(INIT_DOCS);
  const [ships,setShips]   = useState(INIT_SHIPS);
  const [standups,setStandups]   = useState(INIT_STANDUPS);
  const [companies]              = useState(COMPANIES);
  const [projects,setProjects]   = useState(PROJECTS);
  const [notifs,setNotifs]       = useState([
    {id:1,msg:"🔴 Investor deck due in 3 days!",         time:"just now"},
    {id:2,msg:"✅ CI/CD pipeline setup completed",       time:"2h ago"},
    {id:3,msg:"⬡ AI drafted your standup — check it out",time:"3h ago"},
  ]);
  const [showNotifs,setShowNotifs] = useState(false);
  const [ticker,setTicker]         = useState(0);
  const [workSessions,setWS]       = useState({});
  const [authLoading,setAuthLoading] = useState(true);
  const saveTimerRef = useRef(null);
  const skipNextSync = useRef(false); // prevent save→subscribe→save loop

  useEffect(()=>{const id=setInterval(()=>setTicker(t=>t+1),1000);return()=>clearInterval(id);},[]);

  // ── Supabase session restore ──────────────────────────────────────────────
  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      if(session?.user){
        getProfile(session.user.id).then(profile=>{
          setUser({id:session.user.id,username:session.user.email?.split("@")[0],name:profile.name,role:profile.role,initials:profile.initials,color:profile.color,dept:profile.dept,isAdmin:profile.is_admin});
        }).catch(()=>setAuthLoading(false));
      } else setAuthLoading(false);
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      if(!session)setUser(null);
      setAuthLoading(false);
    });
    return()=>subscription.unsubscribe();
  },[]);

  // ── Helper: apply remote workspace data to local state ──────────────────
  const applyRemoteState=(data)=>{
    if(!data)return;
    skipNextSync.current=true; // prevent re-save from these setState calls
    if(data.kpis)setKpis(data.kpis);
    if(data.tasks)setTasks(data.tasks);
    if(data.todos)setTodos(data.todos);
    if(data.goals)setGoals(data.goals);
    if(data.okrs)setOkrs(data.okrs);
    if(data.docs)setDocs(data.docs);
    if(data.ships)setShips(data.ships);
    if(data.standups)setStandups(data.standups);
    if(data.projects)setProjects(data.projects);
    if(data.workSessions)setWS(data.workSessions);
    // Reset sync guard after React batches the updates
    setTimeout(()=>{skipNextSync.current=false;},500);
  };

  // ── Load workspace state from Supabase on login ───────────────────────────
  useEffect(()=>{
    if(!user)return;
    loadWorkspaceState().then(data=>{
      applyRemoteState(data);
      setAuthLoading(false);
    }).catch(()=>setAuthLoading(false));
  },[user]);

  // ── Supabase Realtime: sync workspace state across all logged-in users ────
  useEffect(()=>{
    if(!user)return;
    const channel=supabase.channel("workspace-sync").on(
      "postgres_changes",
      {event:"UPDATE",schema:"public",table:"workspace_state",filter:"id=eq.default"},
      (payload)=>{
        const data=payload.new?.data;
        if(data)applyRemoteState(data);
      }
    ).subscribe();
    return()=>{supabase.removeChannel(channel);};
  },[user]);

  // ── Auto-save workspace state (debounced 2s) ─────────────────────────────
  useEffect(()=>{
    if(!user)return;
    if(skipNextSync.current)return; // don't re-save data we just received
    if(saveTimerRef.current)clearTimeout(saveTimerRef.current);
    saveTimerRef.current=setTimeout(()=>{
      saveWorkspaceState({kpis,tasks,todos,goals,okrs,docs,ships,standups,projects,workSessions}).catch(()=>{});
    },2000);
    return()=>{if(saveTimerRef.current)clearTimeout(saveTimerRef.current);};
  },[kpis,tasks,todos,goals,okrs,docs,ships,standups,projects,workSessions]);

  const addNotif = (msg)=>setNotifs(p=>[{id:Date.now(),msg,time:"just now"},...p.slice(0,9)]);
  const eH = (ts,base)=>ts?base+(Date.now()-ts)/3600000:base;
  const fmtT = (h)=>{const s=Math.floor(h*3600);return`${Math.floor(s/3600)}:${String(Math.floor((s%3600)/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;};
  const fmtMs= (ms)=>{const s=Math.floor(ms/1000);return`${Math.floor(s/3600)}:${String(Math.floor((s%3600)/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;};

  // Single-active-timer
  const toggleTimer=(id)=>setTasks(prev=>{
    const t=prev.find(x=>x.id===id); if(!t) return prev;
    if(t.timerStart){const extra=(Date.now()-t.timerStart)/3600000;addNotif(`⏸ Paused: "${t.title}"`);return prev.map(x=>x.id===id?{...x,timerStart:null,loggedHours:+(x.loggedHours+extra).toFixed(2)}:x);}
    addNotif(`▶ Started: "${t.title}"`);
    return prev.map(x=>{if(x.id===id)return{...x,timerStart:Date.now(),status:"In Progress",kanban:"In Progress"};if(x.timerStart){const extra=(Date.now()-x.timerStart)/3600000;return{...x,timerStart:null,loggedHours:+(x.loggedHours+extra).toFixed(2)};}return x;});
  });

  const completeTask=(id)=>setTasks(prev=>prev.map(t=>{
    if(t.id!==id) return t;
    const extra=t.timerStart?(Date.now()-t.timerStart)/3600000:0;
    addNotif(`✅ Completed: "${t.title}"`);
    return{...t,status:"Completed",kanban:"Done",timerStart:null,loggedHours:+(t.loggedHours+extra).toFixed(2)};
  }));

  // Work sessions keyed by user NAME (shared between USERS array and Supabase auth)
  const wsOf=(name)=>workSessions[name]||{status:"out",checkIn:null,breakStart:null,totalBreakMs:0,log:[]};
  const checkIn =(name)=>{const now=Date.now();setWS(p=>({...p,[name]:{...wsOf(name),status:"working",checkIn:now,log:[...wsOf(name).log,{ev:"checkin",ts:now}]}}));addNotif(`🟢 ${name} checked in`);};
  const startBk =(name)=>{const now=Date.now();setWS(p=>({...p,[name]:{...wsOf(name),status:"break",breakStart:now,log:[...wsOf(name).log,{ev:"break",ts:now}]}}));};
  const endBk   =(name)=>{const ws=wsOf(name);const now=Date.now();const add=ws.breakStart?now-ws.breakStart:0;setWS(p=>({...p,[name]:{...ws,status:"working",breakStart:null,totalBreakMs:ws.totalBreakMs+add,log:[...ws.log,{ev:"back",ts:now}]}}));};
  const checkOut=(name)=>{const now=Date.now();setWS(p=>({...p,[name]:{...wsOf(name),status:"out",log:[...wsOf(name).log,{ev:"checkout",ts:now}]}}));};

  if(authLoading) return <><style>{css}</style><div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{textAlign:"center"}}><div style={{fontSize:40,marginBottom:10}}>🦁</div><p style={{color:T.muted,fontSize:12,letterSpacing:2}}>LOADING...</p></div></div></>;
  if(!user) return <><style>{css}</style><Login onLogin={u=>{setUser(u);addNotif(`👋 Welcome back, ${u.name}!`);}}/></>;

  const myTasks = user.isAdmin?tasks:tasks.filter(t=>t.assignee===user.name);
  const myTodos = user.isAdmin?todos:todos.filter(t=>t.assignee===user.name);
  const myGoals = user.isAdmin?goals:goals.filter(g=>g.owner===user.name);
  const myOkrs  = user.isAdmin?okrs:okrs.filter(o=>o.owner===user.name);
  const myProjs = user.isAdmin?projects:projects.filter(p=>p.members.includes(user.id));
  const pending = todos.filter(t=>!t.done).length;
  const activeT = tasks.find(t=>t.timerStart);
  const ws = wsOf(user.name);
  const netWork = ws.checkIn?(Date.now()-ws.checkIn)-ws.totalBreakMs-(ws.breakStart?Date.now()-ws.breakStart:0):0;

  const props={user,tasks:myTasks,setTasks,todos:myTodos,setTodos,goals:myGoals,setGoals,okrs:myOkrs,setOkrs,kpis,setKpis,docs,setDocs,ships,setShips,standups,setStandups,companies,projects:myProjs,setProjects,addNotif,toggleTimer,completeTask,eH,fmtT,fmtMs,ticker,ws,checkIn,startBk,endBk,checkOut,netWork,wsOf,setPage,allTasks:tasks,allGoals:goals,fmtUSD};

  return(
    <>
      <style>{css}</style>
      <div style={{display:"flex",minHeight:"100vh",background:T.bg}}>
        {/* SIDEBAR */}
        <div style={{width:188,background:T.surface,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",position:"fixed",top:0,bottom:0,left:0,zIndex:50,overflowY:"auto"}}>
          <div style={{padding:"14px 13px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:7}}>
              <span style={{fontSize:18}}>🦁</span>
              <div><div style={{fontSize:13,fontWeight:700,letterSpacing:2,color:T.accent,...mono}}>TITAN</div><div style={{fontSize:7,color:T.muted,letterSpacing:1}}>CONTROL OS · US</div></div>
            </div>
          </div>
          {/* Work status */}
          <div style={{padding:"7px 11px",borderBottom:`1px solid ${T.border}`,background:T.bg,flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:5}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:ws.status==="working"?T.green:ws.status==="break"?T.amber:T.muted}} className={ws.status!=="out"?"pulse":""}/>
              <span style={{fontSize:9,color:ws.status==="working"?T.green:ws.status==="break"?T.amber:T.muted,fontWeight:700,letterSpacing:.5}}>{ws.status==="working"?"WORKING":ws.status==="break"?"ON BREAK":"OFFLINE"}</span>
              {ws.status!=="out"&&<span style={{marginLeft:"auto",fontSize:8,color:T.muted,...mono}}>{fmtMs(netWork)}</span>}
            </div>
            <div style={{display:"flex",gap:3}}>
              {ws.status==="out"&&<button onClick={()=>checkIn(user.name)} style={bS(T.green,{flex:1,padding:"3px 0",fontSize:9,color:T.bg,letterSpacing:.5})}>CHECK IN</button>}
              {ws.status==="working"&&<><button onClick={()=>startBk(user.name)} style={bS(T.amber,{flex:1,padding:"3px 0",fontSize:9,color:T.bg})}>☕ BREAK</button><button onClick={()=>checkOut(user.name)} style={bS(T.red,{flex:1,padding:"3px 0",fontSize:9,color:"#fff"})}>OUT</button></>}
              {ws.status==="break"&&<button onClick={()=>endBk(user.name)} style={bS(T.accent,{flex:1,padding:"3px 0",fontSize:9,color:T.bg})}>▶ BACK</button>}
            </div>
          </div>
          <nav style={{flex:1,padding:"8px 6px"}}>
            {NAV.map(n=>(
              <button key={n.k} onClick={()=>setPage(n.k)}
                style={{width:"100%",display:"flex",alignItems:"center",gap:7,padding:"7px 8px",borderRadius:5,border:"none",cursor:"pointer",marginBottom:1,
                  background:page===n.k?`${T.accent}15`:"transparent",color:page===n.k?T.accent:T.muted,
                  borderLeft:page===n.k?`2px solid ${T.accent}`:"2px solid transparent",
                  fontFamily:"'Rajdhani',sans-serif",fontWeight:600,fontSize:12,letterSpacing:.5,transition:"all .15s"}}>
                <span style={{fontSize:12,...mono,flexShrink:0}}>{n.i}</span>{n.l}
                {n.k==="todos"&&pending>0&&<span style={{marginLeft:"auto",background:T.red,color:"#fff",borderRadius:"50%",width:14,height:14,fontSize:8,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800}}>{pending}</span>}
                {n.k==="tasks"&&activeT&&<span style={{marginLeft:"auto",background:T.green,color:T.bg,borderRadius:"50%",width:14,height:14,fontSize:8,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800}} className="pulse">▶</span>}
              </button>
            ))}
          </nav>
          <div style={{padding:"9px 11px",borderTop:`1px solid ${T.border}`,flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:6}}>
              <Av user={user} size={32}/>
              <div style={{flex:1,overflow:"hidden"}}><div style={{fontSize:12,fontWeight:700,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{user.name}</div><div style={{fontSize:9,color:T.muted}}>{user.role}</div></div>
            </div>
            <button onClick={()=>{sbSignOut().catch(()=>{});setUser(null);}} style={bS(T.surface,{width:"100%",padding:"4px",fontSize:10,color:T.muted,letterSpacing:.5})}>⟵ SIGN OUT</button>
          </div>
        </div>

        {/* MAIN */}
        <div style={{marginLeft:188,flex:1,display:"flex",flexDirection:"column"}}>
          <div style={{height:46,background:T.surface,borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",padding:"0 20px",gap:10,position:"sticky",top:0,zIndex:40}}>
            <div style={{flex:1,fontSize:10,color:T.muted,letterSpacing:.5}}>TITAN OS <span style={{color:T.dim,margin:"0 5px"}}>/</span><span style={{color:T.accent}}>{NAV.find(n=>n.k===page)?.l?.toUpperCase()}</span></div>
            {activeT&&<div style={{display:"flex",alignItems:"center",gap:5,background:T.green+"15",border:`1px solid ${T.green}40`,borderRadius:5,padding:"2px 9px"}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:T.green}} className="pulse"/>
              <span style={{fontSize:9,color:T.green,...mono}}>{activeT.title.slice(0,24)}{activeT.title.length>24?"…":""} — {fmtT(eH(activeT.timerStart,activeT.loggedHours))}</span>
            </div>}
            <span style={{fontSize:9,color:T.muted,...mono}}>{new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>
            <div style={{position:"relative"}}>
              <button onClick={()=>setShowNotifs(!showNotifs)} style={{background:"none",border:`1px solid ${T.border}`,borderRadius:5,padding:"4px 9px",color:T.text,cursor:"pointer",fontSize:12,position:"relative"}}>
                🔔{notifs.length>0&&<span style={{position:"absolute",top:-3,right:-3,background:T.red,borderRadius:"50%",width:12,height:12,fontSize:7,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800}}>{notifs.length}</span>}
              </button>
              {showNotifs&&<div style={{position:"absolute",right:0,top:34,background:T.card,border:`1px solid ${T.border}`,borderRadius:9,width:270,zIndex:200,boxShadow:"0 20px 60px #00000080"}}>
                <div style={{padding:"8px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between"}}><span style={{fontWeight:700,fontSize:12}}>Notifications</span><button onClick={()=>setNotifs([])} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:10}}>Clear</button></div>
                {notifs.map(n=><div key={n.id} style={{padding:"7px 12px",borderBottom:`1px solid ${T.bg}`,display:"flex",gap:7}}><div style={{flex:1}}><p style={{fontSize:11,color:T.text}}>{n.msg}</p><p style={{fontSize:9,color:T.muted,marginTop:1}}>{n.time}</p></div><button onClick={()=>setNotifs(p=>p.filter(x=>x.id!==n.id))} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:10}}>✕</button></div>)}
                {notifs.length===0&&<p style={{padding:14,textAlign:"center",color:T.muted,fontSize:11}}>All clear 🎉</p>}
              </div>}
            </div>
          </div>

          <div style={{flex:1,padding:20,overflowY:"auto"}} className="fade-in" key={page}>
            {page==="mywork"    && <MyWorkPage    {...props}/>}
            {page==="dashboard" && <DashPage      {...props}/>}
            {page==="kanban"    && <KanbanPage    {...props}/>}
            {page==="kpis"      && <KPIsPage      {...props}/>}
            {page==="goals"     && <GoalsPage     {...props}/>}
            {page==="okrs"      && <OKRsPage      {...props}/>}
            {page==="tasks"     && <TasksPage     {...props}/>}
            {page==="todos"     && <TodosPage     {...props}/>}
            {page==="focus"     && <FocusPage     {...props}/>}
            {page==="standup"   && <StandupPage   {...props}/>}
            {page==="meetings"  && <MeetingAIPage {...props}/>}
            {page==="workspace" && <WorkspacePage {...props}/>}
            {page==="team"      && <TeamPage      {...props}/>}
            {page==="projects"  && <ProjectsPage  {...props}/>}
            {page==="docs"      && <DocsPage      {...props}/>}
            {page==="logistics" && <LogisticsPage {...props}/>}
            {page==="ai"        && <AIPage        {...props}/>}
            {page==="analytics" && <AnalyticsPage {...props}/>}
          </div>
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MY WORK
// ══════════════════════════════════════════════════════════════════════════════
function MyWorkPage({user,tasks,todos,goals,eH,fmtT,ticker,setPage,toggleTimer,completeTask}){
  const today=new Date().toISOString().split("T")[0];
  const overdue=tasks.filter(t=>t.dueDate&&t.dueDate<today&&t.status!=="Completed");
  const dueToday=tasks.filter(t=>t.dueDate===today&&t.status!=="Completed");
  const highPrio=tasks.filter(t=>t.priority==="High"&&t.status!=="Completed");
  const donePct=goals.length?Math.round(goals.reduce((s,g)=>s+g.progress,0)/goals.length):0;
  const activeT=tasks.find(t=>t.timerStart);
  return(
    <div>
      <div style={{marginBottom:16}}>
        <h1 style={{fontSize:20,fontWeight:700}}>Good morning, {user.name.split(" ")[0]}!</h1>
        <p style={{color:T.muted,fontSize:11,marginTop:3}}>Here's your day — {new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</p>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:16}}>
        {[{l:"OVERDUE",v:overdue.length,c:T.red,fn:()=>setPage("tasks")},{l:"DUE TODAY",v:dueToday.length,c:T.amber,fn:()=>setPage("tasks")},{l:"HIGH PRIO",v:highPrio.length,c:PRC.High,fn:()=>setPage("tasks")},{l:"OPEN TO-DO",v:todos.filter(t=>!t.done).length,c:"#60a5fa",fn:()=>setPage("todos")},{l:"GOAL AVG",v:donePct+"%",c:T.green,fn:()=>setPage("goals")}].map(c=>(
          <Card key={c.l} style={{textAlign:"center",padding:"11px 8px",border:`1px solid ${c.c}25`,cursor:"pointer",position:"relative",overflow:"hidden"}} onClick={c.fn}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:c.c,opacity:.5}}/>
            <div style={{fontSize:20,fontWeight:800,color:c.c,...mono}}>{c.v}</div>
            <div style={{fontSize:8,color:T.muted,marginTop:2,letterSpacing:1}}>{c.l}</div>
          </Card>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Card>
          <p style={{fontSize:9,color:T.muted,letterSpacing:1,marginBottom:10}}>🎯 FOCUS RIGHT NOW</p>
          {activeT?(
            <div style={{background:T.bg,borderRadius:8,padding:12,border:`1px solid ${T.green}40`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span style={{fontSize:13,fontWeight:600,color:T.green}}>{activeT.title}</span>
                <span style={{fontSize:14,color:T.green,...mono,fontWeight:800}} className="pulse">{fmtT(eH(activeT.timerStart,activeT.loggedHours))}</span>
              </div>
              <div style={{display:"flex",gap:6}}><button onClick={()=>completeTask(activeT.id)} style={bS(T.green,{flex:1,padding:"5px",fontSize:11,color:T.bg})}>✓ COMPLETE</button><button onClick={()=>toggleTimer(activeT.id)} style={bS(T.amber,{flex:1,padding:"5px",fontSize:11,color:T.bg})}>⏸ PAUSE</button></div>
            </div>
          ):(
            highPrio.length>0?(
              <div>
                <p style={{fontSize:11,color:T.muted,marginBottom:8}}>Suggested — start with your top priority:</p>
                <div style={{background:T.bg,borderRadius:7,padding:10,marginBottom:6}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>{highPrio[0].title}</div>
                  <div style={{display:"flex",gap:5,marginBottom:8}}><Tag c={PRC[highPrio[0].priority]} sm>{highPrio[0].priority}</Tag>{highPrio[0].dueDate&&<Tag c={T.muted} sm>Due {highPrio[0].dueDate}</Tag>}</div>
                  <button onClick={()=>toggleTimer(highPrio[0].id)} style={bS(T.green,{width:"100%",padding:"6px",fontSize:11,color:T.bg})}>▶ START TIMER</button>
                </div>
              </div>
            ):<p style={{color:T.muted,fontSize:12,textAlign:"center",padding:16}}>🎉 No urgent tasks. Great job!</p>
          )}
        </Card>
        <Card>
          <p style={{fontSize:9,color:T.muted,letterSpacing:1,marginBottom:10}}>🔴 OVERDUE</p>
          {overdue.length===0?<p style={{color:T.muted,fontSize:11,textAlign:"center",padding:12}}>✓ Nothing overdue!</p>:
            overdue.slice(0,4).map(t=>(
              <div key={t.id} style={{display:"flex",gap:8,alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${T.border}`}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:T.red,flexShrink:0}}/>
                <div style={{flex:1}}><div style={{fontSize:12}}>{t.title}</div><div style={{fontSize:9,color:T.red}}>Due {t.dueDate}</div></div>
                <button onClick={()=>toggleTimer(t.id)} style={bS(T.surface,{padding:"3px 7px",fontSize:9,border:`1px solid ${T.border}`,color:T.muted})}>▶</button>
              </div>
            ))
          }
        </Card>
        <Card>
          <p style={{fontSize:9,color:T.muted,letterSpacing:1,marginBottom:10}}>📅 DUE TODAY</p>
          {dueToday.length===0?<p style={{color:T.muted,fontSize:11,textAlign:"center",padding:12}}>✓ Nothing due today!</p>:
            dueToday.map(t=>(
              <div key={t.id} style={{display:"flex",gap:8,alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${T.border}`}}>
                <Tag c={PRC[t.priority]} sm>{PRI[t.priority]}</Tag>
                <span style={{flex:1,fontSize:12}}>{t.title}</span>
                <button onClick={()=>toggleTimer(t.id)} style={bS(t.timerStart?T.amber:T.green,{padding:"3px 7px",fontSize:9,color:T.bg})}>{t.timerStart?"⏸":"▶"}</button>
              </div>
            ))
          }
        </Card>
        <Card>
          <p style={{fontSize:9,color:T.muted,letterSpacing:1,marginBottom:10}}>◎ GOAL SNAPSHOT</p>
          {goals.slice(0,4).map(g=>(
            <div key={g.id} style={{marginBottom:9}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:11}}>{g.goal}</span><span style={{fontSize:10,color:SC[g.status],...mono,fontWeight:700}}>{g.progress}%</span></div>
              <div style={{height:3,background:T.bg,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:g.progress+"%",background:SC[g.status],borderRadius:2}}/></div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// KANBAN
// ══════════════════════════════════════════════════════════════════════════════
function KanbanPage({tasks,setTasks,user,addNotif,companies,projects,toggleTimer,completeTask,eH,fmtT,ticker}){
  const [compF,setCompF]=useState(null);
  const [dragId,setDragId]=useState(null);
  const [dragOver,setDragOver]=useState(null);
  const [showAdd,setShowAdd]=useState(null);
  const BL={title:"",assignee:user.name,company:companies[0]?.id||"",project:"",cat:"Engineering",priority:"Medium",dueDate:"",notes:""};
  const [form,setForm]=useState(BL);
  const filtered=tasks.filter(t=>compF?t.company===compF:true);
  const moveCard=(id,col)=>{setTasks(p=>p.map(t=>{if(t.id!==id)return t;const ns=col==="Done"?"Completed":col==="In Progress"?"In Progress":"Not Started";addNotif(`📋 "${t.title.slice(0,20)}" → ${col}`);return{...t,kanban:col,status:ns};}));};
  const save=()=>{if(!form.title)return;setTasks(p=>[...p,{...form,id:Date.now(),kanban:showAdd||"To Do",status:"Not Started",timerStart:null,loggedHours:0,rating:null,subtasks:[],recurring:null,effort:2}]);addNotif(`📋 Task added`);setShowAdd(null);setForm(BL);};
  const colC={Backlog:T.muted,"To Do":T.accent,"In Progress":T.amber,"In Review":T.purple,Done:T.green};
  return(
    <div>
      <STitle accent={T.accent} right={<div style={{display:"flex",gap:5}}>{[null,...companies].map(c=><button key={c?.id||"all"} onClick={()=>setCompF(c?.id||null)} style={{padding:"3px 9px",borderRadius:3,border:`1px solid ${compF===(c?.id||null)?(c?c.color:T.accent):T.border}`,background:compF===(c?.id||null)?(c?c.color+"20":T.accent+"20"):"transparent",color:compF===(c?.id||null)?(c?c.color:T.accent):T.muted,cursor:"pointer",fontSize:10,fontWeight:700,fontFamily:"'Rajdhani',sans-serif"}}>{c?.name||"ALL"}</button>)}</div>}>Kanban Board</STitle>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:9}}>
        {KANBAN_COLS.map(col=>{
          const cards=filtered.filter(t=>(t.kanban||"To Do")===col||(col==="Done"&&t.status==="Completed"&&!t.kanban));
          return(
            <div key={col} onDragOver={e=>{e.preventDefault();setDragOver(col);}} onDrop={()=>{if(dragId!==null){moveCard(dragId,col);setDragId(null);setDragOver(null);}}} onDragLeave={()=>setDragOver(null)}
              style={{background:dragOver===col?colC[col]+"10":T.surface,borderRadius:9,border:`1px solid ${dragOver===col?colC[col]:T.border}`,transition:"all .15s",minHeight:380,display:"flex",flexDirection:"column"}}>
              <div style={{padding:"9px 10px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
                <div style={{display:"flex",alignItems:"center",gap:5}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:colC[col]}}/>
                  <span style={{fontSize:10,fontWeight:700,letterSpacing:.5}}>{col.toUpperCase()}</span>
                  <span style={{fontSize:8,color:T.muted,background:T.border,borderRadius:2,padding:"1px 4px",...mono}}>{cards.length}</span>
                </div>
                <button onClick={()=>setShowAdd(col)} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:14}} onMouseEnter={e=>e.currentTarget.style.color=T.accent} onMouseLeave={e=>e.currentTarget.style.color=T.muted}>+</button>
              </div>
              {showAdd===col&&(
                <div style={{padding:8,background:T.card,borderBottom:`1px solid ${T.border}`}}>
                  <input style={inp({marginBottom:5,fontSize:12})} placeholder="Task title…" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} onKeyDown={e=>e.key==="Enter"&&save()} autoFocus/>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:5}}>
                    <select style={inp({fontSize:11,padding:"3px 5px"})} value={form.assignee} onChange={e=>setForm({...form,assignee:e.target.value})}>{USERS.map(u=><option key={u.id} value={u.name}>{u.name}</option>)}</select>
                    <select style={inp({fontSize:11,padding:"3px 5px"})} value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>{PRIOS.map(p=><option key={p}>{p}</option>)}</select>
                  </div>
                  <div style={{display:"flex",gap:4}}><button style={bS(T.accent,{flex:1,padding:"4px",fontSize:10,color:T.bg})} onClick={save}>ADD</button><button style={bS(T.surface,{flex:1,padding:"4px",fontSize:10,color:T.muted})} onClick={()=>setShowAdd(null)}>✕</button></div>
                </div>
              )}
              <div style={{flex:1,padding:"7px",display:"flex",flexDirection:"column",gap:5,overflowY:"auto"}}>
                {cards.map(t=>{
                  const running=!!t.timerStart; const co=companies.find(c=>c.id===t.company);
                  const subDone=t.subtasks?.filter(s=>s.done).length||0; const subTotal=t.subtasks?.length||0;
                  return(
                    <div key={t.id} draggable onDragStart={()=>setDragId(t.id)} onDragEnd={()=>setDragId(null)}
                      style={{background:T.card,borderRadius:7,padding:"9px 10px",border:`1px solid ${running?T.green:T.border}`,cursor:"grab",opacity:dragId===t.id?.5:1,transition:"border .15s"}}>
                      {running&&<div style={{height:2,background:T.green,borderRadius:2,marginBottom:5}} className="pulse"/>}
                      <p style={{fontSize:12,fontWeight:600,color:running?T.green:T.text,marginBottom:5,lineHeight:1.3}}>{t.title}</p>
                      <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:5}}>
                        <Tag c={PRC[t.priority]} sm>{PRI[t.priority]} {t.priority}</Tag>
                        {co&&<Tag c={co.color} sm>{co.name}</Tag>}
                        {t.recurring&&<Tag c={T.purple} sm>↻</Tag>}
                      </div>
                      {subTotal>0&&<div style={{fontSize:9,color:T.muted,marginBottom:5}}>☑ {subDone}/{subTotal}</div>}
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div style={{display:"flex",gap:4,alignItems:"center"}}>
                          {USERS.find(u=>u.name===t.assignee)&&<Av user={t.assignee} size={20}/>}
                          {t.dueDate&&<span style={{fontSize:9,color:T.muted}}>{t.dueDate}</span>}
                        </div>
                        <div style={{display:"flex",gap:3}}>
                          {col!=="Done"&&<button onClick={()=>toggleTimer(t.id)} style={{background:"none",border:`1px solid ${running?T.amber:T.green}30`,borderRadius:3,padding:"2px 5px",cursor:"pointer",fontSize:9,color:running?T.amber:T.green}}>{running?"⏸":"▶"}</button>}
                          {col!=="Done"&&<button onClick={()=>moveCard(t.id,"Done")} style={{background:"none",border:`1px solid ${T.green}30`,borderRadius:3,padding:"2px 5px",cursor:"pointer",fontSize:9,color:T.green}}>✓</button>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {cards.length===0&&<div style={{textAlign:"center",padding:"20px 0",color:T.dim,fontSize:10}}>Drop cards here</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// OKRs
// ══════════════════════════════════════════════════════════════════════════════
function OKRsPage({okrs,setOkrs,user,addNotif,companies}){
  const [showAdd,setShowAdd]=useState(false);
  const BL={objective:"",period:"Q2 2025",owner:user.name,companyId:companies[0]?.id||"",keyResults:[]};
  const [form,setForm]=useState(BL);
  const [krText,setKrText]=useState(""); const [krTarget,setKrTarget]=useState(""); const [krUnit,setKrUnit]=useState("");
  const addKR=()=>{if(!krText||!krTarget)return;setForm(f=>({...f,keyResults:[...f.keyResults,{id:"kr"+Date.now(),text:krText,target:parseFloat(krTarget),current:0,unit:krUnit,progress:0}]}));setKrText("");setKrTarget("");setKrUnit("");};
  const save=()=>{if(!form.objective||!form.keyResults.length)return;const avg=Math.round(form.keyResults.reduce((s,kr)=>s+kr.progress,0)/form.keyResults.length);setOkrs(p=>[...p,{...form,id:"o"+Date.now(),progress:avg}]);addNotif(`🎯 OKR: "${form.objective}"`);setShowAdd(false);setForm(BL);};
  const updateKR=(oid,krid,current)=>{setOkrs(p=>p.map(o=>{if(o.id!==oid)return o;const krs=o.keyResults.map(kr=>{if(kr.id!==krid)return kr;const pct=Math.min(100,Math.round((current/kr.target)*100));return{...kr,current:parseFloat(current)||0,progress:pct};});return{...o,keyResults:krs,progress:Math.round(krs.reduce((s,kr)=>s+kr.progress,0)/krs.length)};}));};
  return(
    <div>
      <STitle accent={T.purple} right={<button style={bS(T.purple,{color:"#fff"})} onClick={()=>setShowAdd(!showAdd)}>+ NEW OBJECTIVE</button>}>OKRs</STitle>
      {showAdd&&<Card style={{marginBottom:14,border:`1px solid ${T.purple}40`}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
          <Fld label="OBJECTIVE *" col="1/-1"><input style={inp()} value={form.objective} onChange={e=>setForm({...form,objective:e.target.value})} placeholder="What do you want to achieve?"/></Fld>
          <Fld label="PERIOD"><input style={inp()} value={form.period} onChange={e=>setForm({...form,period:e.target.value})} placeholder="Q2 2025"/></Fld>
          <Fld label="OWNER"><select style={inp()} value={form.owner} onChange={e=>setForm({...form,owner:e.target.value})}>{USERS.map(u=><option key={u.id} value={u.name}>{u.name}</option>)}</select></Fld>
          <Fld label="COMPANY"><select style={inp()} value={form.companyId} onChange={e=>setForm({...form,companyId:e.target.value})}>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Fld>
        </div>
        <div style={{background:T.bg,borderRadius:7,padding:10,marginBottom:10}}>
          <p style={{fontSize:9,color:T.muted,letterSpacing:1,marginBottom:7}}>KEY RESULTS</p>
          {form.keyResults.map((kr,i)=><div key={kr.id} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 0",borderBottom:`1px solid ${T.border}`}}><div style={{width:4,height:4,borderRadius:"50%",background:T.purple,flexShrink:0}}/><span style={{flex:1,fontSize:11}}>{kr.text}</span><span style={{fontSize:10,color:T.muted,...mono}}>Target: {kr.target} {kr.unit}</span><button onClick={()=>setForm(f=>({...f,keyResults:f.keyResults.filter((_,j)=>j!==i)}))} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:11}}>✕</button></div>)}
          <div style={{display:"grid",gridTemplateColumns:"3fr 1fr 1fr auto",gap:6,marginTop:7}}>
            <input style={inp({fontSize:11})} value={krText} onChange={e=>setKrText(e.target.value)} placeholder="Key Result description…"/>
            <input style={inp({fontSize:11})} value={krTarget} onChange={e=>setKrTarget(e.target.value)} placeholder="Target" type="number"/>
            <input style={inp({fontSize:11})} value={krUnit} onChange={e=>setKrUnit(e.target.value)} placeholder="Unit"/>
            <button style={bS(T.purple,{color:"#fff",padding:"6px 10px",fontSize:11})} onClick={addKR}>+ KR</button>
          </div>
        </div>
        <div style={{display:"flex",gap:7}}><button style={bS(T.purple,{color:"#fff"})} onClick={save}>SAVE OKR</button><button style={bS(T.surface,{color:T.muted})} onClick={()=>setShowAdd(false)}>CANCEL</button></div>
      </Card>}
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {okrs.map(o=>{
          const co=companies.find(c=>c.id===o.companyId);
          const pc=o.progress>=70?T.green:o.progress>=40?T.amber:T.red;
          return(
            <Card key={o.id}>
              <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
                <ProgressRing pct={o.progress} size={68} stroke={7} color={pc}/>
                <div style={{flex:1}}>
                  <div style={{display:"flex",gap:7,alignItems:"center",marginBottom:6,flexWrap:"wrap"}}>
                    <h3 style={{fontSize:15,fontWeight:700}}>{o.objective}</h3>
                    <Tag c={T.purple} sm>{o.period}</Tag>{co&&<Tag c={co.color} sm>{co.name}</Tag>}<Tag c={T.muted} sm>👤 {o.owner}</Tag>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {o.keyResults.map(kr=>{
                      const krc=kr.progress>=70?T.green:kr.progress>=40?T.amber:T.red;
                      return(
                        <div key={kr.id} style={{background:T.bg,borderRadius:6,padding:"8px 10px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                            <span style={{fontSize:12,flex:1}}>{kr.text}</span>
                            <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
                              <span style={{fontSize:10,color:T.muted,...mono}}>{kr.current} / {kr.target} {kr.unit}</span>
                              <span style={{fontSize:11,fontWeight:800,color:krc,...mono}}>{kr.progress}%</span>
                            </div>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <div style={{flex:1,height:4,background:T.surface,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:kr.progress+"%",background:krc,borderRadius:2,transition:"width .4s"}}/></div>
                            <input type="number" value={kr.current} min={0} max={kr.target} onChange={e=>updateKR(o.id,kr.id,e.target.value)} style={inp({width:70,fontSize:10,padding:"2px 6px",textAlign:"center"})}/>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TASKS
// ══════════════════════════════════════════════════════════════════════════════
function TasksPage({tasks,setTasks,user,addNotif,toggleTimer,completeTask,eH,fmtT,companies,projects,ticker}){
  const [showAdd,setShowAdd]=useState(false);
  const [exp,setExp]=useState(null);
  const BL={title:"",assignee:user.name,company:companies[0]?.id||"",project:"",cat:"Engineering",priority:"Medium",dueDate:"",notes:"",recurring:null,effort:2};
  const [form,setForm]=useState(BL);
  const [subInputs,setSubInputs]=useState({});
  const save=()=>{if(!form.title)return;setTasks(p=>[...p,{...form,id:Date.now(),kanban:"To Do",status:"To Do",timerStart:null,loggedHours:0,rating:null,subtasks:[]}]);addNotif(`📋 Task: "${form.title}"`);setShowAdd(false);setForm(BL);};
  const toggleSub=(tid,sid)=>setTasks(p=>p.map(t=>t.id!==tid?t:{...t,subtasks:t.subtasks.map(s=>s.id!==sid?s:{...s,done:!s.done})}));
  const addSub=(tid,text)=>{if(!text)return;setTasks(p=>p.map(t=>t.id!==tid?t:{...t,subtasks:[...t.subtasks,{id:Date.now(),text,done:false}]}));};
  const activeTask=tasks.find(t=>t.timerStart);
  const projsForComp=projects.filter(p=>!form.company||p.companyId===form.company);
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <STitle accent={T.amber}>Tasks & Timer</STitle>
        <div style={{display:"flex",gap:7,alignItems:"center"}}>
          {activeTask&&<div style={{display:"flex",alignItems:"center",gap:5,background:T.green+"15",border:`1px solid ${T.green}40`,borderRadius:5,padding:"3px 9px"}}><div style={{width:5,height:5,borderRadius:"50%",background:T.green}} className="pulse"/><span style={{fontSize:9,color:T.green,...mono}}>{activeTask.title.slice(0,22)}… — {fmtT(eH(activeTask.timerStart,activeTask.loggedHours))}</span></div>}
          <button style={bS(T.amber,{color:T.bg})} onClick={()=>setShowAdd(!showAdd)}>+ NEW TASK</button>
        </div>
      </div>
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:7,padding:"6px 12px",marginBottom:12,fontSize:11,color:T.muted,display:"flex",gap:7,alignItems:"center"}}>
        <span style={{color:T.amber}}>⚡</span><span><b style={{color:T.text}}>Single-focus mode:</b> Starting a timer auto-pauses any running task. Click a card to expand subtasks.</span>
      </div>
      {showAdd&&<Card style={{marginBottom:12,border:`1px solid ${T.amber}40`}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
          <Fld label="TITLE *" col="1/-1"><input style={inp()} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="What needs to be done?"/></Fld>
          <Fld label="ASSIGNEE"><select style={inp()} value={form.assignee} onChange={e=>setForm({...form,assignee:e.target.value})}>{USERS.map(u=><option key={u.id} value={u.name}>{u.initials} — {u.name}</option>)}</select></Fld>
          <Fld label="COMPANY"><select style={inp()} value={form.company} onChange={e=>setForm({...form,company:e.target.value,project:""})}>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Fld>
          <Fld label="PROJECT"><select style={inp()} value={form.project} onChange={e=>setForm({...form,project:e.target.value})}><option value="">— None —</option>{projsForComp.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Fld>
          <Fld label="CATEGORY"><select style={inp()} value={form.cat} onChange={e=>setForm({...form,cat:e.target.value})}>{["Engineering","Sales","Marketing","Finance","HR","Research","DevOps","Design","Legal"].map(c=><option key={c}>{c}</option>)}</select></Fld>
          <Fld label="PRIORITY"><PrioPicker value={form.priority} onChange={v=>setForm({...form,priority:v})}/></Fld>
          <Fld label="DUE DATE"><DatePicker value={form.dueDate} onChange={v=>setForm({...form,dueDate:v})}/></Fld>
          <Fld label="STORY POINTS"><input style={inp()} type="number" min={1} max={13} value={form.effort} onChange={e=>setForm({...form,effort:parseInt(e.target.value)||1})}/></Fld>
          <Fld label="RECURRING"><select style={inp()} value={form.recurring||""} onChange={e=>setForm({...form,recurring:e.target.value||null})}><option value="">None</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></Fld>
          <Fld label="NOTES" col="1/-1"><input style={inp()} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></Fld>
        </div>
        <div style={{display:"flex",gap:7}}><button style={bS(T.amber,{color:T.bg})} onClick={save}>CREATE TASK</button><button style={bS(T.surface,{color:T.muted})} onClick={()=>setShowAdd(false)}>CANCEL</button></div>
      </Card>}
      <div style={{display:"flex",flexDirection:"column",gap:7}}>
        {tasks.map(t=>{
          const hrs=eH(t.timerStart,t.loggedHours); const running=!!t.timerStart;
          const paused=!running&&t.loggedHours>0&&t.status!=="Completed";
          const co=companies.find(c=>c.id===t.company); const proj=projects.find(p=>p.id===t.project);
          const subDone=t.subtasks?.filter(s=>s.done).length||0; const subTotal=t.subtasks?.length||0;
          const isExp=exp===t.id;
          return(
            <Card key={t.id} style={{borderLeft:`3px solid ${running?T.green:SC[t.status]||T.border}`,opacity:t.status==="Completed"?.6:1,position:"relative"}}>
              {running&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:T.green,opacity:.7}} className="pulse"/>}
              <div style={{display:"flex",gap:10,alignItems:"center",cursor:"pointer"}} onClick={()=>setExp(isExp?null:t.id)}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",gap:5,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
                    <span style={{fontSize:13,fontWeight:600,color:running?T.green:T.text}}>{t.title}</span>
                    <Tag c={PRC[t.priority]} sm>{PRI[t.priority]} {t.priority}</Tag>
                    {paused&&<Tag c={T.purple} sm>⏸ PAUSED</Tag>}
                    {t.recurring&&<Tag c={T.purple} sm>↻ {t.recurring}</Tag>}
                    {co&&<Tag c={co.color} sm>{co.name}</Tag>}
                    {proj&&<Tag c={proj.color} sm>{proj.name}</Tag>}
                    {subTotal>0&&<Tag c={T.muted} sm>☑ {subDone}/{subTotal}</Tag>}
                    {t.effort&&<Tag c={T.dim} sm>{t.effort}sp</Tag>}
                    {t.rating&&<span style={{fontSize:10}}>{"⭐".repeat(t.rating)}</span>}
                  </div>
                  <div style={{fontSize:10,color:T.muted,display:"flex",gap:10,flexWrap:"wrap"}}>
                    <span>👤 {t.assignee}</span>{t.dueDate&&<span>📅 {t.dueDate}</span>}{t.notes&&<span>📝 {t.notes}</span>}
                  </div>
                </div>
                <div style={{textAlign:"center",minWidth:90}}>
                  <div style={{fontSize:running?17:13,fontWeight:700,color:running?T.green:paused?T.purple:T.muted,...mono}} className={running?"pulse":""}>{fmtT(hrs)}</div>
                  <div style={{fontSize:7,color:T.muted,letterSpacing:1}}>{running?"RUNNING":paused?"PAUSED":"LOGGED"}</div>
                </div>
                <div style={{display:"flex",gap:5,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                  {t.status!=="Completed"&&<><button onClick={()=>toggleTimer(t.id)} style={bS(running?T.amber:T.green,{padding:"5px 11px",fontSize:11,color:T.bg})}>{running?"⏸":"▶"}</button><button onClick={()=>completeTask(t.id)} style={bS(T.surface,{padding:"5px 9px",fontSize:11,border:`1px solid ${T.border}`,color:T.muted})}>✓</button></>}
                  {t.status==="Completed"&&!t.rating&&user.isAdmin&&[1,2,3,4,5].map(r=><button key={r} onClick={()=>setTasks(p=>p.map(x=>x.id===t.id?{...x,rating:r}:x))} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:T.amber}}>⭐</button>)}
                  <button onClick={()=>setTasks(p=>p.filter(x=>x.id!==t.id))} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:12}} onMouseEnter={e=>e.currentTarget.style.color=T.red} onMouseLeave={e=>e.currentTarget.style.color=T.muted}>✕</button>
                  <span style={{color:T.muted,fontSize:11}}>{isExp?"▲":"▼"}</span>
                </div>
              </div>
              {isExp&&<div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${T.border}`}}>
                <p style={{fontSize:9,color:T.muted,letterSpacing:1,marginBottom:7}}>SUBTASKS</p>
                {t.subtasks?.map(s=><div key={s.id} style={{display:"flex",gap:7,alignItems:"center",padding:"5px 0",borderBottom:`1px solid ${T.bg}`}}>
                  <button onClick={()=>toggleSub(t.id,s.id)} style={{width:16,height:16,borderRadius:"50%",border:`2px solid ${s.done?T.green:T.muted}`,background:s.done?T.green:"transparent",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",color:T.bg,fontSize:8,fontWeight:800}}>{s.done?"✓":""}</button>
                  <span style={{fontSize:11,color:s.done?T.muted:T.text,textDecoration:s.done?"line-through":"none",flex:1}}>{s.text}</span>
                </div>)}
                <div style={{display:"flex",gap:6,marginTop:7}}>
                  <input style={inp({flex:1,fontSize:11})} value={subInputs[t.id]||""} onChange={e=>setSubInputs(s=>({...s,[t.id]:e.target.value}))} placeholder="Add subtask…" onKeyDown={e=>e.key==="Enter"&&(addSub(t.id,subInputs[t.id]),setSubInputs(s=>({...s,[t.id]:""})))}/>
                  <button style={bS(T.accent,{padding:"5px 10px",fontSize:11,color:T.bg})} onClick={()=>{addSub(t.id,subInputs[t.id]);setSubInputs(s=>({...s,[t.id]:""}));}}>+ ADD</button>
                </div>
              </div>}
            </Card>
          );
        })}
        {tasks.length===0&&<Card style={{textAlign:"center",padding:28,color:T.muted}}>No tasks yet.</Card>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FOCUS / POMODORO
// ══════════════════════════════════════════════════════════════════════════════
function FocusPage({tasks,toggleTimer,completeTask,eH,fmtT,ticker}){
  const [mode,setMode]=useState("pomodoro");
  const MODES={pomodoro:25,short:5,long:15,custom:null};
  const [customMin,setCustomMin]=useState(30);
  const [running,setRunning]=useState(false);
  const [secondsLeft,setSecondsLeft]=useState(25*60);
  const [sessions,setSessions]=useState(0);
  const [selectedTask,setSelectedTask]=useState(null);
  const [focusNotes,setFocusNotes]=useState("");
  const intervalRef=useRef(null);
  const totalSec=mode==="custom"?customMin*60:(MODES[mode]||25)*60;

  useEffect(()=>{
    if(running){intervalRef.current=setInterval(()=>{setSecondsLeft(s=>{if(s<=1){clearInterval(intervalRef.current);setRunning(false);setSessions(n=>n+1);if(selectedTask)completeTask(selectedTask);return 0;}return s-1;});},1000);}
    else clearInterval(intervalRef.current);
    return()=>clearInterval(intervalRef.current);
  },[running]);

  const switchMode=(m)=>{setMode(m);setRunning(false);setSecondsLeft((MODES[m]||customMin)*60);};
  const toggle=()=>{if(!running&&secondsLeft===0)setSecondsLeft(totalSec);setRunning(r=>!r);if(!running&&selectedTask)toggleTimer(selectedTask);};
  const reset=()=>{setRunning(false);setSecondsLeft(totalSec);};
  const pct=Math.round((1-secondsLeft/totalSec)*100);
  const mm=Math.floor(secondsLeft/60); const ss=secondsLeft%60;
  const circ=2*Math.PI*110;
  const activeTasks=tasks.filter(t=>t.status!=="Completed");

  return(
    <div style={{maxWidth:640,margin:"0 auto"}}>
      <STitle accent={T.green}>Focus Mode — Pomodoro</STitle>
      <div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:20}}>
        {[["pomodoro","🍅 Pomodoro (25m)"],["short","☕ Short Break (5m)"],["long","🌿 Long Break (15m)"],["custom","⚙ Custom"]].map(([m,l])=>(
          <button key={m} onClick={()=>switchMode(m)} style={{padding:"6px 12px",borderRadius:5,border:`1px solid ${mode===m?T.green:T.border}`,background:mode===m?T.green+"20":"transparent",color:mode===m?T.green:T.muted,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"'Rajdhani',sans-serif"}}>{l}</button>
        ))}
      </div>
      {mode==="custom"&&<div style={{textAlign:"center",marginBottom:16}}><input type="number" value={customMin} onChange={e=>{setCustomMin(parseInt(e.target.value)||1);setSecondsLeft((parseInt(e.target.value)||1)*60);}} style={inp({width:100,textAlign:"center",fontSize:18,fontWeight:700,...mono})} min={1} max={120}/><span style={{color:T.muted,fontSize:12,marginLeft:8}}>minutes</span></div>}
      <div style={{display:"flex",justifyContent:"center",marginBottom:20}}>
        <div style={{position:"relative",width:260,height:260}}>
          <svg width="260" height="260" style={{transform:"rotate(-90deg)"}}>
            <circle cx="130" cy="130" r="110" fill="none" stroke={T.border} strokeWidth="8"/>
            <circle cx="130" cy="130" r="110" fill="none" stroke={running?T.green:T.muted} strokeWidth="8" strokeDasharray={circ} strokeDashoffset={circ*(1-pct/100)} strokeLinecap="round" style={{transition:"stroke-dashoffset .8s linear,stroke .3s"}}/>
          </svg>
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",textAlign:"center"}}>
            <div style={{fontSize:52,fontWeight:800,color:running?T.green:T.text,...mono,letterSpacing:4,lineHeight:1}} className={running?"pulse":""}>{String(mm).padStart(2,"0")}:{String(ss).padStart(2,"0")}</div>
            <div style={{fontSize:10,color:T.muted,letterSpacing:2,marginTop:6}}>{running?"● FOCUSING":"READY"}</div>
            <div style={{fontSize:12,color:T.purple,marginTop:4}}>Session #{sessions+1}</div>
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:20}}>
        <button onClick={toggle} style={bS(running?T.amber:T.green,{padding:"10px 28px",fontSize:15,color:T.bg,letterSpacing:1})}>{running?"⏸ PAUSE":"▶ START"}</button>
        <button onClick={reset}  style={bS(T.surface,{padding:"10px 16px",fontSize:15,color:T.muted,border:`1px solid ${T.border}`})}>↺ RESET</button>
      </div>
      <Card style={{marginBottom:12}}>
        <p style={{fontSize:9,color:T.muted,letterSpacing:1,marginBottom:8}}>🎯 LINK TO TASK (auto-completes when timer ends)</p>
        <select style={inp()} value={selectedTask||""} onChange={e=>setSelectedTask(parseInt(e.target.value)||null)}>
          <option value="">— Free focus —</option>
          {activeTasks.map(t=><option key={t.id} value={t.id}>{PRI[t.priority]} {t.title}</option>)}
        </select>
      </Card>
      <Card style={{marginBottom:12}}>
        <p style={{fontSize:9,color:T.muted,letterSpacing:1,marginBottom:8}}>📝 FOCUS NOTES</p>
        <textarea value={focusNotes} onChange={e=>setFocusNotes(e.target.value)} style={inp({height:80,resize:"vertical"})} placeholder="What are you working on? Blockers? Ideas?"/>
      </Card>
      <Card>
        <p style={{fontSize:9,color:T.muted,letterSpacing:1,marginBottom:8}}>SESSION STATS</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
          {[{l:"SESSIONS TODAY",v:sessions,c:T.purple},{l:"FOCUS TIME",v:`${sessions*(mode==="custom"?customMin:MODES[mode]||25)}m`,c:T.green},{l:"TO LONG BREAK",v:`${4-(sessions%4)} sessions`,c:T.amber}].map(c=>(
            <div key={c.l} style={{background:T.bg,borderRadius:6,padding:"9px",textAlign:"center"}}>
              <div style={{fontSize:18,fontWeight:800,color:c.c,...mono}}>{c.v}</div>
              <div style={{fontSize:8,color:T.muted,letterSpacing:.5}}>{c.l}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DAILY STANDUP + MOOD
// ══════════════════════════════════════════════════════════════════════════════
function StandupPage({user,tasks,goals,standups,setStandups,addNotif}){
  const today=new Date().toISOString().split("T")[0];
  const todayStandup=standups.find(s=>s.date===today&&s.userId===user.id);
  const [form,setForm]=useState({yesterday:"",today_plan:"",blockers:"",mood:3});
  const [generating,setGenerating]=useState(false);
  const moodEmoji=["😴","😔","😐","🙂","🚀"];
  const moodLabel=["Exhausted","Low","Okay","Good","On Fire!"];
  const moodColor=["#60a5fa",T.red,T.amber,T.green,"#ec4899"];

  const submit=()=>{
    if(!form.yesterday&&!form.today_plan)return;
    const entry={...form,date:today,userId:user.id,userName:user.name,userInitials:user.initials,userColor:user.color,ts:Date.now()};
    setStandups(p=>[...p.filter(s=>!(s.date===today&&s.userId===user.id)),entry]);
    addNotif("📢 Standup submitted!");
  };

  const generateAI=async()=>{
    setGenerating(true);
    const myOpen=tasks.filter(t=>t.status!=="Completed"&&t.assignee===user.name);
    const myDone=tasks.filter(t=>t.status==="Completed"&&t.assignee===user.name);
    const prompt=`Generate a concise professional daily standup update for ${user.name} (${user.role}) at a US tech startup.
Open tasks: ${myOpen.map(t=>t.title).join(", ")||"none"}
Recently completed: ${myDone.slice(0,3).map(t=>t.title).join(", ")||"none"}
Goal progress: ${goals.filter(g=>g.owner===user.name).map(g=>`${g.goal}(${g.progress}%)`).join(", ")||"none"}
Format: 3 short bullets — Yesterday / Today / Blockers. Max 2 sentences each. Professional and direct.`;
    try{
      const text=await aiChat({messages:[{role:"user",content:prompt}],max_tokens:400});
      const lines=text.split("\n").filter(l=>l.trim()&&!l.match(/^#+/));
      if(lines[0])setForm(f=>({...f,yesterday:lines[0].replace(/^[•\-\*\d\.]\s*/,"").replace(/^Yesterday[:\s]*/i,"").trim()}));
      if(lines[1])setForm(f=>({...f,today_plan:lines[1].replace(/^[•\-\*\d\.]\s*/,"").replace(/^Today[:\s]*/i,"").trim()}));
      if(lines[2])setForm(f=>({...f,blockers:lines[2].replace(/^[•\-\*\d\.]\s*/,"").replace(/^Blockers?[:\s]*/i,"").trim()}));
    }catch{/* silent */}
    setGenerating(false);
  };

  const teamStandups=standups.filter(s=>s.date===today);
  const moodData=USERS.map(u=>{const s=standups.filter(x=>x.userId===u.id).sort((a,b)=>b.ts-a.ts)[0];return{...u,mood:s?.mood,date:s?.date};});

  return(
    <div>
      <STitle accent={T.amber}>Daily Standup</STitle>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <div>
          <Card style={{marginBottom:10,border:`1px solid ${T.amber}40`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <p style={{fontSize:11,fontWeight:700}}>📢 Your Standup — {new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"})}</p>
              <button onClick={generateAI} style={bS(T.purple,{padding:"5px 10px",fontSize:10,color:"#fff",display:"flex",alignItems:"center",gap:4})} disabled={generating}>
                {generating?<span className="spin">⬡</span>:"⬡"} {generating?"Drafting…":"AI Draft"}
              </button>
            </div>
            <div style={{marginBottom:12}}>
              <p style={{fontSize:9,color:T.muted,letterSpacing:1,marginBottom:7}}>TODAY'S ENERGY</p>
              <div style={{display:"flex",gap:6,justifyContent:"space-between"}}>
                {moodEmoji.map((e,i)=>(
                  <button key={i} onClick={()=>setForm(f=>({...f,mood:i+1}))} style={{flex:1,padding:"7px 4px",borderRadius:7,border:`2px solid ${form.mood===i+1?moodColor[i]:T.border}`,background:form.mood===i+1?moodColor[i]+"20":"transparent",cursor:"pointer",textAlign:"center",transition:"all .15s"}}>
                    <div style={{fontSize:18}}>{e}</div><div style={{fontSize:8,color:form.mood===i+1?moodColor[i]:T.muted,marginTop:2}}>{moodLabel[i]}</div>
                  </button>
                ))}
              </div>
            </div>
            <Fld label="✅ YESTERDAY"><textarea style={inp({height:65,resize:"none"})} value={form.yesterday} onChange={e=>setForm({...form,yesterday:e.target.value})} placeholder="What did you complete?"/></Fld>
            <div style={{height:8}}/>
            <Fld label="🎯 TODAY"><textarea style={inp({height:65,resize:"none"})} value={form.today_plan} onChange={e=>setForm({...form,today_plan:e.target.value})} placeholder="What's your plan?"/></Fld>
            <div style={{height:8}}/>
            <Fld label="🚧 BLOCKERS"><textarea style={inp({height:50,resize:"none"})} value={form.blockers} onChange={e=>setForm({...form,blockers:e.target.value})} placeholder="Any blockers or help needed?"/></Fld>
            <div style={{height:10}}/>
            <button style={bS(T.amber,{width:"100%",padding:"9px",fontSize:13,color:T.bg})} onClick={submit}>{todayStandup?"✓ UPDATE STANDUP":"📢 SUBMIT STANDUP"}</button>
          </Card>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <Card>
            <p style={{fontSize:9,color:T.muted,letterSpacing:1,marginBottom:10}}>👥 TEAM ENERGY TODAY</p>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
              {moodData.map(u=>(
                <div key={u.id} style={{textAlign:"center",minWidth:55}}>
                  <Av user={u} size={34} style={{margin:"0 auto 4px"}}/>
                  <div style={{fontSize:18,marginTop:2}}>{u.mood?moodEmoji[u.mood-1]:"—"}</div>
                  <div style={{fontSize:9,color:u.mood?moodColor[u.mood-1]:T.muted,marginTop:1}}>{u.mood?moodLabel[u.mood-1]:"No check-in"}</div>
                </div>
              ))}
            </div>
            <p style={{fontSize:9,color:T.muted}}>{moodData.filter(u=>u.mood).length}/{USERS.length} submitted today</p>
          </Card>
          <Card style={{flex:1,overflowY:"auto",maxHeight:340}}>
            <p style={{fontSize:9,color:T.muted,letterSpacing:1,marginBottom:10}}>📋 TODAY'S UPDATES</p>
            {teamStandups.length===0&&<p style={{color:T.muted,fontSize:11,textAlign:"center",padding:16}}>No standups submitted yet.</p>}
            {teamStandups.map(s=>{
              const su=USERS.find(u=>u.id===s.userId)||{initials:s.userName?.slice(0,2)||"?",color:T.muted};
              return(
              <div key={s.userId} style={{background:T.bg,borderRadius:7,padding:10,marginBottom:8}}>
                <div style={{display:"flex",gap:7,alignItems:"center",marginBottom:7}}>
                  <Av user={su} size={28}/>
                  <div><div style={{fontSize:12,fontWeight:700}}>{s.userName}</div>{s.mood&&<span style={{fontSize:16}}>{moodEmoji[s.mood-1]}</span>}</div>
                </div>
                {s.yesterday&&<div style={{marginBottom:5}}><span style={{fontSize:9,color:T.green,letterSpacing:1}}>YESTERDAY</span><p style={{fontSize:11,marginTop:2}}>{s.yesterday}</p></div>}
                {s.today_plan&&<div style={{marginBottom:5}}><span style={{fontSize:9,color:T.amber,letterSpacing:1}}>TODAY</span><p style={{fontSize:11,marginTop:2}}>{s.today_plan}</p></div>}
                {s.blockers&&<div><span style={{fontSize:9,color:T.red,letterSpacing:1}}>BLOCKERS</span><p style={{fontSize:11,marginTop:2}}>{s.blockers}</p></div>}
              </div>
            );})}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MEETING AI — Recording + Transcription + Summary
// ══════════════════════════════════════════════════════════════════════════════
function MeetingAIPage({user,tasks,goals}){
  const INIT_MEETINGS=[
    {id:"m1",title:"Series B Investor Prep",date:"2025-03-05",duration:"38:22",participants:["Marcus Reid","Jordan Blake"],lang:"en-US",
      transcript:[{t:"00:00",speaker:"Marcus Reid",text:"Okay, let's walk through the Series B deck. I want to make sure we nail the unit economics slide."},{t:"00:18",speaker:"Jordan Blake",text:"Revenue is up 18% QoQ. We're slightly behind the 20% target but the trend is solid."},{t:"00:35",speaker:"Marcus Reid",text:"Good. What's our customer acquisition cost right now?"},{t:"00:48",speaker:"Jordan Blake",text:"CAC is $420, LTV is around $3,200. So LTV/CAC ratio is 7.6x which is strong for our stage."},{t:"01:08",speaker:"Marcus Reid",text:"Perfect. Let's emphasize that in the deck. And what about churn?"},{t:"01:18",speaker:"Jordan Blake",text:"Monthly churn is at 3.2%, we want to get it below 3% by end of Q2."}],
      summary:"Series B prep meeting. Revenue +18% QoQ, $420 CAC, $3.2K LTV (7.6x ratio). Churn at 3.2%, target <3% by Q2. Investor deck needs unit economics emphasis.",
      actionItems:[{text:"Marcus: Finalize unit economics slide",assignee:"Marcus Reid",done:false,priority:"High"},{text:"Jordan: Build churn reduction roadmap",assignee:"Jordan Blake",done:false,priority:"High"},{text:"Marcus: Send deck to Sequoia by March 10",assignee:"Marcus Reid",done:false,priority:"High"}],
      decisions:["Focus deck on unit economics and LTV/CAC story","Target Sequoia and a16z as lead investors","Push for Q2 close"],sentiment:"positive"},
    {id:"m2",title:"Sprint Planning — Platform v3",date:"2025-03-03",duration:"24:10",participants:["Derek Cole","Jordan Blake"],lang:"en-US",
      transcript:[{t:"00:00",speaker:"Derek Cole",text:"Alright, sprint capacity is 8 story points this week."},{t:"00:10",speaker:"Jordan Blake",text:"Auth module should be the top priority. That's 3 points."},{t:"00:20",speaker:"Derek Cole",text:"Agreed. Then App Store submission package is 4 points. Leaves 1 for documentation."},{t:"00:36",speaker:"Jordan Blake",text:"Works. Any technical blockers from last sprint?"},{t:"00:44",speaker:"Derek Cole",text:"API rate limiting hit us. I'll add it to next sprint backlog."}],
      summary:"Sprint planning: 8sp capacity. Auth module (3sp) + App Store package (4sp) + docs (1sp). API rate limiting deferred to next sprint.",
      actionItems:[{text:"Derek: Complete auth module",assignee:"Derek Cole",done:true,priority:"High"},{text:"Derek: Add API rate limiting to backlog",assignee:"Derek Cole",done:true,priority:"Low"},{text:"Jordan: Review App Store copy",assignee:"Jordan Blake",done:false,priority:"Medium"}],
      decisions:["Auth module is sprint #1 priority","API rate limiting deferred","App Store submission by March 28"],sentiment:"neutral"},
  ];

  const [view,setView]         = useState("list");
  const [meetings,setMeetings] = useState(INIT_MEETINGS);
  const [active,setActive]     = useState(null);
  const [recording,setRecording]       = useState(false);
  const [paused,setPaused]             = useState(false);
  const [transcript,setTranscript]     = useState([]);
  const [interim,setInterim]           = useState("");
  const [elapsed,setElapsed]           = useState(0);
  const [lang,setLang]                 = useState("en-US");
  const [meetingTitle,setMeetingTitle] = useState("");
  const [participants,setParticipants] = useState([user.name]);
  const [activeSpeaker,setActiveSpeaker]= useState(user.name);
  const [processing,setProcessing]     = useState(false);
  const [summary,setSummary]           = useState("");
  const [actionItems,setActionItems]   = useState([]);
  const [decisions,setDecisions]       = useState([]);
  const [sentiment,setSentiment]       = useState("");

  const recognitionRef = useRef(null);
  const timerRef       = useRef(null);
  const transcriptRef  = useRef([]);
  const bottomRef      = useRef(null);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[transcript,interim]);

  useEffect(()=>{
    if(recording&&!paused){timerRef.current=setInterval(()=>setElapsed(e=>e+1),1000);}
    else clearInterval(timerRef.current);
    return()=>clearInterval(timerRef.current);
  },[recording,paused]);

  const fmtTime=(s)=>`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  const startRecognition=useCallback(()=>{
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){alert("Speech recognition requires Chrome or Edge browser.");return;}
    const rec=new SR(); rec.continuous=true; rec.interimResults=true; rec.lang=lang; rec.maxAlternatives=1;
    rec.onresult=(e)=>{
      let final=""; let inter="";
      for(let i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal)final+=e.results[i][0].transcript+" ";else inter+=e.results[i][0].transcript;}
      setInterim(inter);
      if(final.trim()){const entry={t:fmtTime(elapsed),speaker:activeSpeaker,text:final.trim(),ts:Date.now()};transcriptRef.current=[...transcriptRef.current,entry];setTranscript([...transcriptRef.current]);setInterim("");}
    };
    rec.onerror=(e)=>{if(e.error!=="aborted")console.warn("SR error:",e.error);};
    rec.onend=()=>{if(recognitionRef.current&&!paused){try{rec.start();}catch{}}};
    recognitionRef.current=rec;
    try{rec.start();}catch(e){console.warn(e);}
  },[lang,activeSpeaker,elapsed,paused]);

  const startRecording=()=>{
    if(!meetingTitle.trim()){alert("Please enter a meeting title.");return;}
    setRecording(true);setPaused(false);setTranscript([]);setInterim("");setElapsed(0);setSummary("");setActionItems([]);setDecisions([]);transcriptRef.current=[];startRecognition();
  };
  const pauseRecording=()=>{setPaused(p=>{if(!p)recognitionRef.current?.stop();else startRecognition();return!p;});};
  const stopRecording=()=>{recognitionRef.current?.stop();recognitionRef.current=null;setRecording(false);setPaused(false);setInterim("");};

  const generateSummary=async()=>{
    const fullText=transcriptRef.current.map(l=>`[${l.t}] ${l.speaker}: ${l.text}`).join("\n");
    if(!fullText.trim()){alert("No transcript to summarize.");return;}
    setProcessing(true);setSummary("");setActionItems([]);setDecisions([]);setSentiment("");
    const prompt=`You are a professional meeting assistant for a US tech startup. Analyze this transcript and return ONLY valid JSON (no markdown):

TRANSCRIPT:
${fullText}

Return exactly:
{"summary":"2-3 sentence executive summary","actionItems":[{"text":"action description","assignee":"name or TBD","priority":"High|Medium|Low","done":false}],"decisions":["decision 1","decision 2"],"sentiment":"positive|neutral|negative|mixed","keyTopics":["topic1","topic2","topic3"]}`;
    try{
      const raw=await aiChat({messages:[{role:"user",content:prompt}],max_tokens:1500});
      let parsed; try{parsed=JSON.parse(raw);}catch{parsed=JSON.parse(raw.replace(/```json|```/g,"").trim());}
      setSummary(parsed.summary||"Summary generated.");setActionItems((parsed.actionItems||[]).map((a,i)=>({...a,id:i})));setDecisions(parsed.decisions||[]);setSentiment(parsed.sentiment||"neutral");
      const m={id:"m"+Date.now(),title:meetingTitle,date:new Date().toISOString().split("T")[0],duration:fmtTime(elapsed),participants,lang,transcript:transcriptRef.current,summary:parsed.summary||"",actionItems:(parsed.actionItems||[]).map((a,i)=>({...a,id:i})),decisions:parsed.decisions||[],sentiment:parsed.sentiment||"neutral",keyTopics:parsed.keyTopics||[]};
      setMeetings(prev=>[m,...prev]);
    }catch{setSummary("⚠️ AI analysis failed. Transcript saved.");}
    setProcessing(false);
  };

  const savePlain=()=>{
    const m={id:"m"+Date.now(),title:meetingTitle,date:new Date().toISOString().split("T")[0],duration:fmtTime(elapsed),participants,lang,transcript:transcriptRef.current,summary:"No AI summary.",actionItems:[],decisions:[],sentiment:"neutral"};
    setMeetings(prev=>[m,...prev]);setView("list");setSummary("");setTranscript([]);setMeetingTitle("");setElapsed(0);
  };

  const exportMeeting=(m)=>{
    const lines=[`# ${m.title}`,`Date: ${m.date}  |  Duration: ${m.duration}  |  Participants: ${m.participants.join(", ")}`,`Sentiment: ${m.sentiment}`,``,`## Summary`,m.summary,``,
      ...(m.decisions?.length?[`## Decisions`,...m.decisions.map(d=>`- ${d}`),``]:[]),
      ...(m.actionItems?.length?[`## Action Items`,...m.actionItems.map(a=>`- [${a.done?"x":" "}] ${a.text} (${a.assignee}, ${a.priority})`),``]:[]),
      `## Transcript`,...m.transcript.map(s=>`[${s.t}] **${s.speaker}**: ${s.text}`)];
    const blob=new Blob([lines.join("\n")],{type:"text/markdown"});
    const url=URL.createObjectURL(blob); const a=document.createElement("a");a.href=url;a.download=`${m.title.replace(/\s+/g,"-")}.md`;a.click();URL.revokeObjectURL(url);
  };

  const scC={positive:T.green,neutral:T.amber,negative:T.red,mixed:T.purple};
  const scI={positive:"😊",neutral:"😐",negative:"😟",mixed:"🔀"};

  const LANGS=[{code:"en-US",label:"🇺🇸 English (US)"},{code:"en-GB",label:"🇬🇧 English (UK)"},{code:"es-ES",label:"🇪🇸 Spanish"},{code:"fr-FR",label:"🇫🇷 French"},{code:"de-DE",label:"🇩🇪 German"}];
  const SPEAKERS=[...USERS.map(u=>u.name),"Client","Investor","Guest"];

  // LIST VIEW
  if(view==="list") return(
    <div>
      <STitle accent={T.pink} right={<button onClick={()=>{setView("record");setSummary("");setTranscript([]);setElapsed(0);setMeetingTitle("");setActionItems([]);setDecisions([]);}} style={bS(T.red,{padding:"8px 16px",fontSize:12,color:"#fff",display:"flex",alignItems:"center",gap:6})}><span style={{fontSize:14}}>🔴</span> NEW MEETING</button>}>Meeting AI</STitle>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:16}}>
        {[{l:"TOTAL",v:meetings.length,c:T.accent},{l:"ACTION ITEMS",v:meetings.reduce((s,m)=>s+m.actionItems.length,0),c:T.amber},{l:"OPEN ACTIONS",v:meetings.reduce((s,m)=>s+m.actionItems.filter(a=>!a.done).length,0),c:T.red},{l:"DECISIONS",v:meetings.reduce((s,m)=>s+m.decisions.length,0),c:T.green}].map(c=>(
          <Card key={c.l} style={{textAlign:"center",borderTop:`2px solid ${c.c}`}}><div style={{fontSize:24,fontWeight:800,color:c.c,...mono}}>{c.v}</div><div style={{fontSize:8,color:T.muted,letterSpacing:1,marginTop:2}}>{c.l}</div></Card>
        ))}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {meetings.map(m=>{
          const sC=scC[m.sentiment]||T.muted; const openA=m.actionItems.filter(a=>!a.done).length;
          return(
            <Card key={m.id} style={{cursor:"pointer",transition:"border .15s"}} onClick={()=>{setActive(m);setView("detail");}} onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent} onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
              <div style={{display:"flex",gap:12,alignItems:"center"}}>
                <div style={{width:42,height:42,borderRadius:"50%",background:sC+"20",border:`2px solid ${sC}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{scI[m.sentiment]||"🎙️"}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
                    <span style={{fontSize:14,fontWeight:700}}>{m.title}</span>
                    <Tag c={sC} sm>{(m.sentiment||"neutral").toUpperCase()}</Tag>
                    {openA>0&&<Tag c={T.red} sm>{openA} OPEN ACTION{openA>1?"S":""}</Tag>}
                    {m.keyTopics?.map(t=><Tag key={t} c={T.purple} sm>{t}</Tag>)}
                  </div>
                  <p style={{fontSize:11,color:T.muted,lineHeight:1.5,marginBottom:5}}>{m.summary}</p>
                  <div style={{display:"flex",gap:10,fontSize:10,color:T.muted}}>
                    <span>📅 {m.date}</span><span>⏱ {m.duration}</span><span>👥 {m.participants.join(", ")}</span><span>📝 {m.transcript.length} segments</span><span>✅ {m.actionItems.length} actions</span>
                  </div>
                </div>
                <div style={{display:"flex",gap:5}}>
                  <button onClick={e=>{e.stopPropagation();exportMeeting(m);}} style={bS(T.surface,{padding:"5px 9px",fontSize:10,color:T.muted,border:`1px solid ${T.border}`})}>⬇</button>
                  <span style={{color:T.muted,fontSize:18,alignSelf:"center"}}>→</span>
                </div>
              </div>
            </Card>
          );
        })}
        {meetings.length===0&&<Card style={{textAlign:"center",padding:40,color:T.muted}}><div style={{fontSize:32,marginBottom:8}}>🎙️</div><p>No meetings yet. Hit NEW MEETING to start recording!</p></Card>}
      </div>
    </div>
  );

  // RECORD VIEW
  if(view==="record") return(
    <div>
      <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:16}}>
        <button onClick={()=>{stopRecording();setView("list");}} style={bS(T.surface,{color:T.muted,border:`1px solid ${T.border}`})}>← Back</button>
        <h2 style={{fontSize:17,fontWeight:700,flex:1}}>🎙️ RECORDING STUDIO</h2>
        {recording&&<Tag c={T.red}>🔴 LIVE</Tag>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"300px 1fr",gap:14}}>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <Card>
            <p style={{fontSize:9,color:T.muted,letterSpacing:1,marginBottom:8}}>MEETING DETAILS</p>
            <div style={{marginBottom:8}}><label style={{fontSize:9,color:T.muted,letterSpacing:1,display:"block",marginBottom:4}}>TITLE *</label><input style={inp()} value={meetingTitle} onChange={e=>setMeetingTitle(e.target.value)} placeholder="Q1 Board Meeting…" disabled={recording}/></div>
            <div style={{marginBottom:8}}><label style={{fontSize:9,color:T.muted,letterSpacing:1,display:"block",marginBottom:4}}>LANGUAGE</label><select style={inp()} value={lang} onChange={e=>setLang(e.target.value)} disabled={recording}>{LANGS.map(l=><option key={l.code} value={l.code}>{l.label}</option>)}</select></div>
            <div><label style={{fontSize:9,color:T.muted,letterSpacing:1,display:"block",marginBottom:5}}>PARTICIPANTS</label>
              <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:5}}>{participants.map(p=><span key={p} style={{background:T.accent+"20",color:T.accent,padding:"2px 8px",borderRadius:3,fontSize:10,display:"flex",alignItems:"center",gap:4}}>{p}{!recording&&<button onClick={()=>setParticipants(prev=>prev.filter(x=>x!==p))} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:10,padding:0}}>✕</button>}</span>)}</div>
              {!recording&&<select style={inp({fontSize:11})} onChange={e=>{if(e.target.value&&!participants.includes(e.target.value))setParticipants(p=>[...p,e.target.value]);e.target.value="";}}>
                <option value="">+ Add participant…</option>
                {SPEAKERS.filter(s=>!participants.includes(s)).map(s=><option key={s}>{s}</option>)}
              </select>}
            </div>
          </Card>
          {recording&&<Card style={{border:`1px solid ${T.green}40`}}>
            <p style={{fontSize:9,color:T.muted,letterSpacing:1,marginBottom:8}}>ACTIVE SPEAKER</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
              {participants.map(p=>(
                <button key={p} onClick={()=>setActiveSpeaker(p)} style={{padding:"7px 5px",borderRadius:5,border:`2px solid ${activeSpeaker===p?T.green:T.border}`,background:activeSpeaker===p?T.green+"20":"transparent",color:activeSpeaker===p?T.green:T.muted,cursor:"pointer",fontFamily:"'Rajdhani',sans-serif",fontWeight:700,fontSize:11,transition:"all .15s"}}>
                  {activeSpeaker===p&&<span className="pulse" style={{display:"inline-block",width:5,height:5,borderRadius:"50%",background:T.green,marginRight:4}}/>}{p}
                </button>
              ))}
            </div>
            <p style={{fontSize:9,color:T.muted,marginTop:7}}>Tap to assign speech to speaker</p>
          </Card>}
          <Card style={{textAlign:"center"}}>
            <div style={{fontSize:44,fontWeight:800,color:recording?(paused?T.amber:T.red):T.muted,...mono,letterSpacing:4,marginBottom:6}} className={recording&&!paused?"pulse":""}>{fmtTime(elapsed)}</div>
            {recording&&!paused&&<div className="wave" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:2,height:20,marginBottom:8}}>{[1,2,3,4,5].map(i=><span key={i}/>)}</div>}
            {!recording?(
              <button onClick={startRecording} style={bS(T.red,{width:"100%",padding:"10px",fontSize:14,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",gap:7})}><span style={{width:10,height:10,borderRadius:"50%",background:"#fff"}}/>START RECORDING</button>
            ):(
              <div style={{display:"flex",gap:6}}>
                <button onClick={pauseRecording} style={bS(T.amber,{flex:1,padding:"8px",fontSize:11,color:T.bg})}>{paused?"▶ RESUME":"⏸ PAUSE"}</button>
                <button onClick={stopRecording}  style={bS(T.surface,{flex:1,padding:"8px",fontSize:11,color:T.muted,border:`1px solid ${T.border}`})}>⏹ STOP</button>
              </div>
            )}
          </Card>
          {!recording&&transcript.length>0&&(
            <Card style={{border:`1px solid ${T.purple}40`}}>
              <p style={{fontSize:9,color:T.muted,letterSpacing:1,marginBottom:8}}>AI PROCESSING</p>
              {summary?<div><Tag c={T.green} sm>✓ SUMMARY READY</Tag><button onClick={()=>setView("list")} style={bS(T.surface,{width:"100%",marginTop:8,color:T.muted,border:`1px solid ${T.border}`})}>← BACK TO LIST</button></div>:
              <div>
                <button onClick={generateSummary} disabled={processing} style={bS(T.purple,{width:"100%",padding:"9px",fontSize:12,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",gap:7})}>
                  {processing?<span style={{display:"inline-flex",gap:3}}>{[0,1,2].map(i=><span key={i} style={{width:5,height:5,borderRadius:"50%",background:"#fff",animation:`pulse 1s ${i*.2}s infinite`}}/>)}</span>:"⬡"} {processing?"ANALYZING…":"⬡ AI SUMMARY"}
                </button>
                <button onClick={savePlain} style={bS(T.surface,{width:"100%",marginTop:5,color:T.muted,border:`1px solid ${T.border}`,fontSize:10})}>Save without summary</button>
              </div>}
            </Card>
          )}
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <Card style={{flex:1,minHeight:340,display:"flex",flexDirection:"column"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:10,flexShrink:0}}>
              <p style={{fontSize:9,color:T.muted,letterSpacing:1}}>📝 LIVE TRANSCRIPT</p>
              <div style={{display:"flex",gap:6,alignItems:"center"}}><Tag c={T.accent} sm>{LANGS.find(l=>l.code===lang)?.label}</Tag><span style={{fontSize:9,color:T.muted,...mono}}>{transcript.length} segments</span></div>
            </div>
            <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:7}}>
              {transcript.length===0&&!interim&&<div style={{textAlign:"center",padding:40,color:T.muted}}><div style={{fontSize:32,marginBottom:8}}>🎤</div><p style={{fontSize:12}}>{recording?"Listening… Start speaking!":"Hit START RECORDING to begin"}</p>{recording&&<p style={{fontSize:10,color:T.dim,marginTop:4}}>Allow microphone access in your browser</p>}</div>}
              {transcript.map((seg,i)=>{
                const SC={Marcus:T.accent,"Jordan Blake":T.green,"Priya Sharma":T.purple,"Derek Cole":T.amber,"Sofia Torres":T.pink}; const sc=SC[seg.speaker]||T.muted;
                return(<div key={i} style={{display:"flex",gap:9,alignItems:"flex-start"}}><span style={{fontSize:9,color:T.muted,...mono,minWidth:36,flexShrink:0,marginTop:3}}>{seg.t}</span><div style={{background:T.surface,borderRadius:7,padding:"7px 10px",flex:1,borderLeft:`2px solid ${sc}`}}><span style={{fontSize:10,fontWeight:700,color:sc,display:"block",marginBottom:2}}>{seg.speaker}</span><p style={{fontSize:12,lineHeight:1.5}}>{seg.text}</p></div></div>);
              })}
              {interim&&<div style={{display:"flex",gap:9,alignItems:"flex-start",opacity:.6}}><span style={{fontSize:9,color:T.muted,...mono,minWidth:36,flexShrink:0,marginTop:3}}>live</span><div style={{background:T.surface,borderRadius:7,padding:"7px 10px",flex:1,borderLeft:`2px dashed ${T.red}`}}><span style={{fontSize:10,fontWeight:700,color:T.red,display:"block",marginBottom:2}}>{activeSpeaker} <span className="pulse">●</span></span><p style={{fontSize:12,color:T.muted,fontStyle:"italic"}}>{interim}</p></div></div>}
              <div ref={bottomRef}/>
            </div>
          </Card>
          {(summary||processing)&&(
            <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:8}}>
              <Card style={{border:`1px solid ${T.purple}40`}}>
                <div style={{display:"flex",gap:7,alignItems:"center",marginBottom:9}}><p style={{fontSize:9,color:T.muted,letterSpacing:1}}>⬡ AI SUMMARY</p>{sentiment&&<Tag c={scC[sentiment]||T.muted} sm>{scI[sentiment]} {sentiment.toUpperCase()}</Tag>}</div>
                {processing?<p style={{color:T.muted,fontSize:12,fontStyle:"italic"}}>Analyzing with Claude AI…</p>:<p style={{fontSize:13,lineHeight:1.7}}>{summary}</p>}
              </Card>
              {decisions.length>0&&<Card><p style={{fontSize:9,color:T.muted,letterSpacing:1,marginBottom:8}}>🏛️ DECISIONS</p>{decisions.map((d,i)=><div key={i} style={{display:"flex",gap:7,padding:"6px 0",borderBottom:`1px solid ${T.border}`}}><span style={{color:T.green}}>◈</span><p style={{fontSize:12}}>{d}</p></div>)}</Card>}
              {actionItems.length>0&&<Card><p style={{fontSize:9,color:T.muted,letterSpacing:1,marginBottom:8}}>✅ ACTION ITEMS</p>{actionItems.map((a,i)=>(
                <div key={i} style={{display:"flex",gap:8,alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${T.border}`}}>
                  <button onClick={()=>setActionItems(prev=>prev.map((x,j)=>j===i?{...x,done:!x.done}:x))} style={{width:16,height:16,borderRadius:"50%",border:`2px solid ${a.done?T.green:a.priority==="High"?T.red:T.amber}`,background:a.done?T.green:"transparent",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",color:T.bg,fontSize:8,fontWeight:800}}>{a.done?"✓":""}</button>
                  <span style={{flex:1,fontSize:12,color:a.done?T.muted:T.text,textDecoration:a.done?"line-through":"none"}}>{a.text}</span>
                  <Tag c={a.priority==="High"?T.red:a.priority==="Medium"?T.amber:T.green} sm>{a.priority}</Tag>
                  {a.assignee&&<Tag c={T.accent} sm>👤 {a.assignee}</Tag>}
                </div>
              ))}</Card>}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // DETAIL VIEW
  if(view==="detail"&&active) return(
    <div>
      <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:14}}>
        <button onClick={()=>setView("list")} style={bS(T.surface,{color:T.muted,border:`1px solid ${T.border}`})}>← All Meetings</button>
        <h2 style={{fontSize:17,fontWeight:700,flex:1}}>{active.title}</h2>
        <Tag c={scC[active.sentiment]||T.muted}>{scI[active.sentiment]} {(active.sentiment||"neutral").toUpperCase()}</Tag>
        <button onClick={()=>exportMeeting(active)} style={bS(T.surface,{color:T.muted,border:`1px solid ${T.border}`,fontSize:11})}>⬇ Export .md</button>
      </div>
      <div style={{display:"flex",gap:7,marginBottom:14,flexWrap:"wrap"}}>
        <Tag c={T.muted}>📅 {active.date}</Tag><Tag c={T.muted}>⏱ {active.duration}</Tag><Tag c={T.accent}>👥 {active.participants.join(", ")}</Tag><Tag c={T.muted}>📝 {active.transcript.length} segments</Tag>
        {active.keyTopics?.map(t=><Tag key={t} c={T.purple} sm>{t}</Tag>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 370px",gap:14}}>
        <Card style={{maxHeight:"78vh",overflowY:"auto"}}>
          <p style={{fontSize:9,color:T.muted,letterSpacing:1,marginBottom:12}}>📝 FULL TRANSCRIPT</p>
          {active.transcript.map((seg,i)=>{
            const SC={"Marcus Reid":T.accent,"Jordan Blake":T.green,"Priya Sharma":T.purple,"Derek Cole":T.amber,"Sofia Torres":T.pink}; const sc=SC[seg.speaker]||T.muted;
            return(<div key={i} style={{display:"flex",gap:9,alignItems:"flex-start",marginBottom:9}}><span style={{fontSize:9,color:T.muted,...mono,minWidth:38,flexShrink:0,marginTop:4}}>{seg.t}</span><div style={{background:T.surface,borderRadius:7,padding:"8px 11px",flex:1,borderLeft:`2px solid ${sc}`}}><span style={{fontSize:10,fontWeight:700,color:sc,display:"block",marginBottom:2}}>{seg.speaker}</span><p style={{fontSize:12,lineHeight:1.6}}>{seg.text}</p></div></div>);
          })}
          {active.transcript.length===0&&<p style={{color:T.muted,fontSize:12,textAlign:"center",padding:20}}>No transcript available</p>}
        </Card>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <Card style={{border:`1px solid ${T.purple}40`}}><p style={{fontSize:9,color:T.muted,letterSpacing:1,marginBottom:8}}>⬡ AI SUMMARY</p><p style={{fontSize:12,lineHeight:1.7}}>{active.summary}</p></Card>
          {active.decisions?.length>0&&<Card><p style={{fontSize:9,color:T.muted,letterSpacing:1,marginBottom:8}}>🏛️ DECISIONS</p>{active.decisions.map((d,i)=><div key={i} style={{display:"flex",gap:7,padding:"6px 0",borderBottom:`1px solid ${T.border}`}}><span style={{color:T.green}}>◈</span><p style={{fontSize:11}}>{d}</p></div>)}</Card>}
          <Card>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><p style={{fontSize:9,color:T.muted,letterSpacing:1}}>✅ ACTION ITEMS</p><span style={{fontSize:9,color:T.muted,...mono}}>{active.actionItems.filter(a=>!a.done).length} open</span></div>
            {active.actionItems.length===0&&<p style={{color:T.muted,fontSize:11,textAlign:"center",padding:10}}>No action items</p>}
            {active.actionItems.map((a,i)=>(
              <div key={i} style={{display:"flex",gap:7,alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${T.border}`}}>
                <button onClick={()=>{const updated={...active,actionItems:active.actionItems.map((x,j)=>j===i?{...x,done:!x.done}:x)};setActive(updated);setMeetings(prev=>prev.map(m=>m.id!==active.id?m:updated));}} style={{width:15,height:15,borderRadius:"50%",border:`2px solid ${a.done?T.green:T.amber}`,background:a.done?T.green:"transparent",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",color:T.bg,fontSize:8,fontWeight:800}}>{a.done?"✓":""}</button>
                <span style={{flex:1,fontSize:11,color:a.done?T.muted:T.text,textDecoration:a.done?"line-through":"none"}}>{a.text}</span>
                <Tag c={a.priority==="High"?T.red:a.priority==="Medium"?T.amber:T.green} sm>{a.priority}</Tag>
                {a.assignee&&<Tag c={T.accent} sm>{a.assignee}</Tag>}
              </div>
            ))}
          </Card>
          {active.transcript.length>0&&<Card>
            <p style={{fontSize:9,color:T.muted,letterSpacing:1,marginBottom:8}}>🎤 SPEAKER BREAKDOWN</p>
            {Object.entries(active.transcript.reduce((acc,seg)=>{acc[seg.speaker]=(acc[seg.speaker]||0)+1;return acc;},{})).sort((a,b)=>b[1]-a[1]).map(([speaker,count])=>{
              const pct=Math.round(count/active.transcript.length*100);
              const sc={"Marcus Reid":T.accent,"Jordan Blake":T.green,"Priya Sharma":T.purple,"Derek Cole":T.amber,"Sofia Torres":T.pink}[speaker]||T.muted;
              return(<div key={speaker} style={{marginBottom:7}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{fontSize:11}}>{speaker}</span><span style={{fontSize:9,color:T.muted,...mono}}>{count} turns · {pct}%</span></div><div style={{height:3,background:T.bg,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:pct+"%",background:sc,borderRadius:2}}/></div></div>);
            })}
          </Card>}
        </div>
      </div>
    </div>
  );
  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// WORKSPACE
// ══════════════════════════════════════════════════════════════════════════════
function WorkspacePage({user,ws,checkIn,startBk,endBk,checkOut,wsOf,fmtMs,netWork,ticker}){
  const SC={working:T.green,break:T.amber,out:T.muted};
  const co=ws.checkIn?new Date(ws.checkIn):null;
  return(
    <div>
      <STitle accent={T.green}>Workspace — Time Tracking</STitle>
      <Card style={{marginBottom:14,border:`2px solid ${SC[ws.status]}40`,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:SC[ws.status]}}/>
        <div style={{display:"flex",gap:20,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{textAlign:"center",minWidth:130}}>
            <div style={{fontSize:40,fontWeight:800,color:SC[ws.status],...mono,lineHeight:1}} className={ws.status!=="out"?"pulse":""}>
              {ws.status!=="out"?fmtMs(netWork):"--:--:--"}
            </div>
            <div style={{fontSize:9,color:T.muted,letterSpacing:1,marginTop:3}}>NET WORK TIME</div>
          </div>
          <div style={{flex:1,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {[{l:"STATUS",v:ws.status.toUpperCase(),c:SC[ws.status]},{l:"CHECK-IN",v:co?co.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}):"—",c:T.text},{l:"BREAKS",v:fmtMs(ws.totalBreakMs),c:T.amber}].map(c=>(
              <div key={c.l} style={{background:T.bg,borderRadius:7,padding:"9px",textAlign:"center"}}><div style={{fontSize:16,fontWeight:800,color:c.c,...mono}}>{c.v}</div><div style={{fontSize:8,color:T.muted,letterSpacing:1}}>{c.l}</div></div>
            ))}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:7,minWidth:130}}>
            {ws.status==="out"&&<button onClick={()=>checkIn(user.name)} style={bS(T.green,{padding:"10px 14px",fontSize:13,color:T.bg,letterSpacing:.5})}>🟢 CHECK IN</button>}
            {ws.status==="working"&&<><button onClick={()=>startBk(user.name)} style={bS(T.amber,{padding:"9px 14px",fontSize:12,color:T.bg})}>☕ BREAK</button><button onClick={()=>checkOut(user.name)} style={bS(T.red,{padding:"9px 14px",fontSize:12,color:"#fff"})}>🔴 CHECK OUT</button></>}
            {ws.status==="break"&&<><div style={{textAlign:"center",fontSize:11,color:T.amber,...mono}} className="pulse">ON BREAK</div><button onClick={()=>endBk(user.name)} style={bS(T.accent,{padding:"9px 14px",fontSize:12,color:T.bg})}>▶ BACK</button></>}
          </div>
        </div>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Card>
          <p style={{fontSize:9,color:T.muted,letterSpacing:1,marginBottom:10}}>TEAM STATUS</p>
          {USERS.map(u=>{const w=wsOf(u.name);const col=SC[w.status];const net=w.checkIn?(Date.now()-w.checkIn)-w.totalBreakMs-(w.breakStart?Date.now()-w.breakStart:0):0;return(<div key={u.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:`1px solid ${T.border}`}}><Av user={u} size={30}/><div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{u.name}</div><div style={{fontSize:9,color:T.muted}}>{u.role}</div></div><div style={{textAlign:"right"}}><div style={{fontSize:9,fontWeight:700,color:col}}><span style={{display:"inline-block",width:5,height:5,borderRadius:"50%",background:col,marginRight:3}} className={w.status!=="out"?"pulse":""}/>{w.status.toUpperCase()}</div>{w.status!=="out"&&<div style={{fontSize:8,color:T.muted,...mono}}>{fmtMs(net)}</div>}</div></div>);})}
        </Card>
        <Card>
          <p style={{fontSize:9,color:T.muted,letterSpacing:1,marginBottom:10}}>SESSION LOG</p>
          {ws.log.length===0&&<p style={{color:T.muted,fontSize:11,textAlign:"center",padding:16}}>No events yet. Check in to start!</p>}
          {ws.log.slice().reverse().map((ev,i)=>{const ic={checkin:"🟢",break:"☕",back:"🔵",checkout:"🔴"};const lb={checkin:"Checked in",break:"Break started",back:"Back from break",checkout:"Checked out"};return(<div key={i} style={{display:"flex",gap:8,alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${T.border}`}}><span style={{fontSize:12}}>{ic[ev.ev]}</span><span style={{flex:1,fontSize:11}}>{lb[ev.ev]}</span><span style={{fontSize:9,color:T.muted,...mono}}>{new Date(ev.ts).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</span></div>);})}
        </Card>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TEAM — Workload Heatmap
// ══════════════════════════════════════════════════════════════════════════════
function TeamPage({tasks,goals,todos,wsOf,fmtMs,ticker,allTasks}){
  const tAll=allTasks||tasks;
  const workloadData=USERS.map(u=>{
    const ut=tAll.filter(t=>t.assignee===u.name&&t.status!=="Completed");
    const totalSP=ut.reduce((s,t)=>s+(t.effort||2),0);
    const highPrio=ut.filter(t=>t.priority==="High").length;
    const ws=wsOf(u.name);
    const net=ws.checkIn?(Date.now()-ws.checkIn)-ws.totalBreakMs-(ws.breakStart?Date.now()-ws.breakStart:0):0;
    const activeTask=tAll.find(t=>t.assignee===u.name&&t.timerStart);
    const load=totalSP>=15?"OVERLOADED":totalSP>=8?"HIGH":totalSP>=3?"MODERATE":totalSP>0?"LOW":"NONE";
    const lC={OVERLOADED:T.red,HIGH:T.amber,MODERATE:"#60a5fa",LOW:T.green,NONE:T.muted};
    return{...u,ut,totalSP,highPrio,ws,net,activeTask,load,lC:lC[load]};
  });
  const onlineCount=workloadData.filter(u=>u.ws.status==="working").length;
  const breakCount=workloadData.filter(u=>u.ws.status==="break").length;
  const offlineCount=workloadData.filter(u=>u.ws.status==="out").length;
  return(
    <div>
      <STitle accent={T.accent}>Team & Workload</STitle>
      {/* Quick presence summary */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
        {[{l:"ONLINE NOW",v:onlineCount,c:T.green,icon:"🟢"},{l:"ON BREAK",v:breakCount,c:T.amber,icon:"☕"},{l:"OFFLINE",v:offlineCount,c:T.muted,icon:"⚫"}].map(s=>(
          <Card key={s.l} style={{textAlign:"center",padding:"10px 6px",border:`1px solid ${s.c}30`}}>
            <div style={{fontSize:11,marginBottom:3}}>{s.icon}</div>
            <div style={{fontSize:22,fontWeight:800,color:s.c,...mono}}>{s.v}</div>
            <div style={{fontSize:8,color:T.muted,letterSpacing:1}}>{s.l}</div>
          </Card>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,marginBottom:14}}>
        {workloadData.map(u=>{
          const capPct=Math.min(100,Math.round(u.totalSP/15*100));
          const ug=goals.filter(g=>g.owner===u.name);
          const avg=ug.length?Math.round(ug.reduce((s,g)=>s+g.progress,0)/ug.length):0;
          const presenceC=u.ws.status==="working"?T.green:u.ws.status==="break"?T.amber:T.muted;
          const presenceLabel=u.ws.status==="working"?"ONLINE":u.ws.status==="break"?"ON BREAK":"OFFLINE";
          return(
            <Card key={u.id} style={{border:`1px solid ${presenceC}30`,borderLeft:`3px solid ${presenceC}`}}>
              <div style={{display:"flex",gap:11,alignItems:"flex-start",marginBottom:10}}>
                <div style={{position:"relative"}}><Av user={u} size={46}/><div style={{position:"absolute",bottom:-1,right:-1,width:10,height:10,borderRadius:"50%",background:presenceC,border:`2px solid ${T.surface}`}} className={u.ws.status!=="out"?"pulse":""}/></div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:3,flexWrap:"wrap"}}>
                    <span style={{fontSize:13,fontWeight:700}}>{u.name}</span>
                    <Tag c={presenceC} sm>{presenceLabel}</Tag>
                    <span style={{fontSize:9,color:u.lC,fontWeight:700,background:u.lC+"18",padding:"1px 6px",borderRadius:3}}>WL: {u.load}</span>
                  </div>
                  <div style={{fontSize:10,color:T.muted}}>{u.role} · {u.dept}</div>
                  {u.activeTask&&<div style={{fontSize:10,color:T.accent,marginTop:3}}><span className="pulse" style={{display:"inline-block",width:5,height:5,borderRadius:"50%",background:T.green,marginRight:4}}/>Working on: <strong>{u.activeTask.title}</strong></div>}
                  {u.ws.status==="working"&&!u.activeTask&&<div style={{fontSize:10,color:T.muted,marginTop:3,fontStyle:"italic"}}>Checked in — no active task</div>}
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  {u.ws.status!=="out"&&<div style={{...mono,fontSize:12,color:presenceC,fontWeight:700}}>{fmtMs(u.net)}</div>}
                  {u.ws.status==="out"&&<div style={{fontSize:9,color:T.muted}}>Not checked in</div>}
                </div>
              </div>
              <div style={{marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:T.muted,marginBottom:3}}><span>WORKLOAD ({u.totalSP} SP)</span><span style={{color:u.lC}}>{u.totalSP} / 15 SP</span></div>
                <div style={{height:4,background:T.bg,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:capPct+"%",background:`linear-gradient(90deg,${u.color},${u.lC})`,borderRadius:3,transition:"width .4s"}}/></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5}}>
                {[{l:"Open",v:u.ut.length,c:u.color},{l:"High",v:u.highPrio,c:T.red},{l:"Goal%",v:avg+"%",c:T.green},{l:"To-Do",v:todos.filter(t=>t.assignee===u.name&&!t.done).length,c:T.purple}].map(x=>(
                  <div key={x.l} style={{background:T.bg,borderRadius:5,padding:"5px 4px",textAlign:"center"}}><div style={{fontSize:15,fontWeight:800,color:x.c,...mono}}>{x.v}</div><div style={{fontSize:7,color:T.muted}}>{x.l}</div></div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
      <Card>
        <p style={{fontSize:9,color:T.muted,letterSpacing:1,marginBottom:10}}>STORY POINTS DISTRIBUTION</p>
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={workloadData.map(u=>({name:u.name.split(" ")[0],SP:u.totalSP,fill:u.lC}))} barSize={28}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border}/><XAxis dataKey="name" tick={{fill:T.muted,fontSize:11}} axisLine={false} tickLine={false}/><YAxis tick={{fill:T.muted,fontSize:9}} axisLine={false} tickLine={false}/><Tooltip content={<CTT/>}/>
            <Bar dataKey="SP" name="Story Points" radius={[4,4,0,0]}>{workloadData.map((u,i)=><Cell key={i} fill={u.lC}/>)}<LabelList dataKey="SP" position="top" style={{fill:T.text,fontSize:10,fontWeight:700}}/></Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// GOALS, TODOS, PROJECTS, DOCS, LOGISTICS — abbreviated but complete
// ══════════════════════════════════════════════════════════════════════════════
function GoalsPage({goals,setGoals,user,addNotif,companies,projects}){
  const [period,setPeriod]=useState(null); const [showAdd,setShowAdd]=useState(false);
  const BL={goal:"",cat:"",owner:user.name,period:"Month",status:"Not Started",progress:0,priority:"Medium",budget:0,deadline:"",companyId:companies[0]?.id||"",projectId:""};
  const [form,setForm]=useState(BL);
  const filtered=period?goals.filter(g=>g.period===period):goals;
  const save=()=>{if(!form.goal)return;setGoals(p=>[...p,{...form,id:Date.now()}]);addNotif(`✨ Goal: "${form.goal}"`);setShowAdd(false);setForm(BL);};
  const upd=(id,f,v)=>setGoals(p=>p.map(g=>g.id===id?{...g,[f]:v}:g));
  return(
    <div>
      <STitle accent={T.purple} right={<button style={bS(T.accent)} onClick={()=>setShowAdd(!showAdd)}>+ ADD GOAL</button>}>Goals</STitle>
      {showAdd&&<Card style={{marginBottom:12,border:`1px solid ${T.accent}40`}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
          <Fld label="GOAL *" col="1/-1"><input style={inp()} value={form.goal} onChange={e=>setForm({...form,goal:e.target.value})} placeholder="What outcome do you want to achieve?"/></Fld>
          <Fld label="CATEGORY"><input style={inp()} value={form.cat} onChange={e=>setForm({...form,cat:e.target.value})} placeholder="Revenue, Product, Hiring…"/></Fld>
          <Fld label="OWNER"><select style={inp()} value={form.owner} onChange={e=>setForm({...form,owner:e.target.value})}>{USERS.map(u=><option key={u.id} value={u.name}>{u.name}</option>)}</select></Fld>
          <Fld label="PERIOD"><select style={inp()} value={form.period} onChange={e=>setForm({...form,period:e.target.value})}>{PERIODS.map(p=><option key={p}>{p}</option>)}</select></Fld>
          <Fld label="COMPANY"><select style={inp()} value={form.companyId} onChange={e=>setForm({...form,companyId:e.target.value,projectId:""})}>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Fld>
          <Fld label="PROJECT"><select style={inp()} value={form.projectId} onChange={e=>setForm({...form,projectId:e.target.value})}><option value="">— None —</option>{projects.filter(p=>p.companyId===form.companyId).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Fld>
          <Fld label="PRIORITY"><PrioPicker value={form.priority} onChange={v=>setForm({...form,priority:v})}/></Fld>
          <Fld label="DEADLINE"><DatePicker value={form.deadline} onChange={v=>setForm({...form,deadline:v})}/></Fld>
          <Fld label="BUDGET"><input style={inp()} type="number" value={form.budget} onChange={e=>setForm({...form,budget:parseInt(e.target.value)||0})} placeholder="50000"/></Fld>
        </div>
        <div style={{display:"flex",gap:7}}><button style={bS(T.green,{color:T.bg})} onClick={save}>SAVE</button><button style={bS(T.surface,{color:T.muted})} onClick={()=>setShowAdd(false)}>CANCEL</button></div>
      </Card>}
      <div style={{display:"flex",gap:5,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        {[null,...PERIODS].map(p=><button key={p||"all"} onClick={()=>setPeriod(p)} style={{padding:"3px 9px",borderRadius:3,border:`1px solid ${period===p?(p?PC[p]:T.accent):T.border}`,background:period===p?(p?PC[p]+"20":T.accent+"20"):"transparent",color:period===p?(p?PC[p]:T.accent):T.muted,cursor:"pointer",fontSize:10,fontWeight:700,fontFamily:"'Rajdhani',sans-serif"}}>{p||"ALL"}</button>)}
        <span style={{marginLeft:"auto",fontSize:10,color:T.muted}}>{filtered.length} goals</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:9}}>
        {filtered.map(g=>{const co=companies.find(c=>c.id===g.companyId);const proj=projects.find(p=>p.id===g.projectId);return(
          <Card key={g.id} style={{borderLeft:`3px solid ${PC[g.period]}`}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
              <div style={{flex:1,marginRight:8}}><p style={{fontSize:13,fontWeight:600,marginBottom:4}}>{g.goal}</p>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}><Tag c={PC[g.period]} sm>{g.period}</Tag><Tag c={PRC[g.priority]} sm>{PRI[g.priority]} {g.priority}</Tag>{co&&<Tag c={co.color} sm>{co.name}</Tag>}{proj&&<Tag c={proj.color} sm>{proj.name}</Tag>}</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:18,fontWeight:800,color:SC[g.status],...mono}}>{g.progress}%</div></div>
            </div>
            <div style={{height:3,background:T.bg,borderRadius:2,overflow:"hidden",marginBottom:7}}><div style={{height:"100%",width:g.progress+"%",background:SC[g.status],borderRadius:2,transition:"width .4s"}}/></div>
            <div style={{display:"flex",gap:7,alignItems:"center",marginBottom:5}}>
              <input type="range" min={0} max={100} value={g.progress} onChange={e=>upd(g.id,"progress",parseInt(e.target.value))} style={{flex:1,height:3}}/>
              <select value={g.status} onChange={e=>upd(g.id,"status",e.target.value)} style={inp({width:"auto",fontSize:10,padding:"2px 5px"})}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:T.muted}}><span>👤 {g.owner}</span>{g.deadline&&<span>📅 {g.deadline}</span>}{g.budget>0&&<span>💰 {fmtUSD(g.budget)}</span>}</div>
          </Card>
        );})}
      </div>
    </div>
  );
}

function TodosPage({todos,setTodos,user,addNotif,companies,projects}){
  const [filter,setFilter]=useState("all"); const [prio,setPrio]=useState("all"); const [showAdd,setShowAdd]=useState(false);
  const BL={text:"",priority:"Medium",tag:"",dueDate:"",assignee:user.name,notes:"",companyId:companies[0]?.id||"",projectId:""};
  const [form,setForm]=useState(BL);
  const visible=todos.filter(t=>filter==="all"?true:filter==="done"?t.done:!t.done).filter(t=>prio==="all"?true:t.priority===prio).sort((a,b)=>({High:0,Medium:1,Low:2})[a.priority]-({High:0,Medium:1,Low:2})[b.priority]);
  const toggle=(id)=>setTodos(p=>p.map(t=>{if(t.id!==id)return t;const done=!t.done;if(done)addNotif(`✅ Done: "${t.text}"`);return{...t,done};}));
  const save=()=>{if(!form.text)return;setTodos(p=>[...p,{...form,id:Date.now(),done:false}]);addNotif(`📝 Added: "${form.text}"`);setShowAdd(false);setForm(BL);};
  const donePct=todos.length?Math.round(todos.filter(t=>t.done).length/todos.length*100):0;
  return(
    <div>
      <STitle accent={T.green} right={<button style={bS(T.green,{color:T.bg})} onClick={()=>setShowAdd(!showAdd)}>+ ADD</button>}>To-Do Tracker</STitle>
      {showAdd&&<Card style={{marginBottom:12,border:`1px solid ${T.green}40`}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
          <Fld label="TASK *" col="1/-1"><input style={inp()} value={form.text} onChange={e=>setForm({...form,text:e.target.value})} placeholder="What needs to be done?"/></Fld>
          <Fld label="PRIORITY"><PrioPicker value={form.priority} onChange={v=>setForm({...form,priority:v})}/></Fld>
          <Fld label="TAG"><input style={inp()} value={form.tag} onChange={e=>setForm({...form,tag:e.target.value})} placeholder="Engineering, Sales…"/></Fld>
          <Fld label="DUE DATE"><DatePicker value={form.dueDate} onChange={v=>setForm({...form,dueDate:v})}/></Fld>
          <Fld label="ASSIGNEE"><select style={inp()} value={form.assignee} onChange={e=>setForm({...form,assignee:e.target.value})}>{USERS.map(u=><option key={u.id} value={u.name}>{u.name}</option>)}</select></Fld>
          <Fld label="COMPANY"><select style={inp()} value={form.companyId} onChange={e=>setForm({...form,companyId:e.target.value,projectId:""})}>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Fld>
          <Fld label="PROJECT"><select style={inp()} value={form.projectId} onChange={e=>setForm({...form,projectId:e.target.value})}><option value="">— None —</option>{projects.filter(p=>p.companyId===form.companyId).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Fld>
          <Fld label="NOTES"><input style={inp()} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></Fld>
        </div>
        <div style={{display:"flex",gap:7}}><button style={bS(T.green,{color:T.bg})} onClick={save}>SAVE</button><button style={bS(T.surface,{color:T.muted})} onClick={()=>setShowAdd(false)}>CANCEL</button></div>
      </Card>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 260px",gap:12,alignItems:"start"}}>
        <div>
          <div style={{display:"flex",gap:5,marginBottom:9,flexWrap:"wrap"}}>
            <div style={{display:"flex",background:T.surface,borderRadius:5,padding:2,gap:2}}>{[["all","ALL"],["pending","ACTIVE"],["done","DONE"]].map(([v,l])=><button key={v} onClick={()=>setFilter(v)} style={{padding:"3px 9px",borderRadius:3,border:"none",cursor:"pointer",fontSize:10,fontWeight:700,background:filter===v?T.accent:"transparent",color:filter===v?T.bg:T.muted,fontFamily:"'Rajdhani',sans-serif"}}>{l}</button>)}</div>
            {["all","High","Medium","Low"].map(p=><button key={p} onClick={()=>setPrio(p)} style={{padding:"3px 9px",borderRadius:3,border:`1px solid ${prio===p?PRC[p]||T.accent:T.border}`,background:"transparent",color:prio===p?PRC[p]||T.accent:T.muted,cursor:"pointer",fontSize:10,fontWeight:700,fontFamily:"'Rajdhani',sans-serif"}}>{p==="all"?"ALL":p.toUpperCase()}</button>)}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            {visible.map(t=>{const co=companies.find(c=>c.id===t.companyId);const proj=projects.find(p=>p.id===t.projectId);return(
              <Card key={t.id} style={{opacity:t.done?.55:1,borderLeft:`3px solid ${t.done?T.green:PRC[t.priority]}`}}>
                <div style={{display:"flex",alignItems:"center",gap:7}}>
                  <button onClick={()=>toggle(t.id)} style={{width:16,height:16,borderRadius:"50%",border:`2px solid ${t.done?T.green:PRC[t.priority]}`,background:t.done?T.green:"transparent",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",color:T.bg,fontSize:8,fontWeight:800}}>{t.done?"✓":""}</button>
                  <span style={{flex:1,fontSize:12,color:t.done?T.muted:T.text,textDecoration:t.done?"line-through":"none"}}>{t.text}</span>
                  <Tag c={PRC[t.priority]} sm>{PRI[t.priority]} {t.priority}</Tag>
                  {t.tag&&<Tag c={T.purple} sm>{t.tag}</Tag>}
                  {co&&<Tag c={co.color} sm>{co.name}</Tag>}
                  {t.dueDate&&<span style={{fontSize:9,color:T.muted,whiteSpace:"nowrap"}}>📅 {t.dueDate}</span>}
                  <span style={{fontSize:10,color:T.muted,whiteSpace:"nowrap"}}>👤 {t.assignee.split(" ")[0]}</span>
                  <button onClick={()=>setTodos(p=>p.filter(x=>x.id!==t.id))} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:11}} onMouseEnter={e=>e.currentTarget.style.color=T.red} onMouseLeave={e=>e.currentTarget.style.color=T.muted}>✕</button>
                </div>
                {t.notes&&<p style={{fontSize:9,color:T.muted,marginTop:4,paddingLeft:23}}>📝 {t.notes}</p>}
              </Card>
            );})}
            {visible.length===0&&<Card style={{textAlign:"center",padding:24,color:T.muted}}>🎉 All clear!</Card>}
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
          <Card style={{textAlign:"center"}}>
            <p style={{fontSize:8,color:T.muted,letterSpacing:1,marginBottom:9}}>COMPLETION</p>
            <ProgressRing pct={donePct} size={80} stroke={7} color={T.green}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginTop:9}}>
              {[{l:"Total",v:todos.length,c:T.accent},{l:"Done",v:todos.filter(t=>t.done).length,c:T.green},{l:"Urgent",v:todos.filter(t=>!t.done&&t.priority==="High").length,c:T.red},{l:"Open",v:todos.filter(t=>!t.done).length,c:T.amber}].map(c=>(
                <div key={c.l} style={{background:T.bg,borderRadius:4,padding:5,textAlign:"center"}}><div style={{fontSize:15,fontWeight:800,color:c.c,...mono}}>{c.v}</div><div style={{fontSize:7,color:T.muted}}>{c.l}</div></div>
              ))}
            </div>
          </Card>
          <Card>
            <p style={{fontSize:8,color:T.muted,letterSpacing:1,marginBottom:8}}>BY TAG</p>
            {Object.entries(todos.reduce((a,t)=>{if(t.tag){a[t.tag]=a[t.tag]||{total:0,done:0};a[t.tag].total++;if(t.done)a[t.tag].done++;}return a;},{})).map(([tag,{total,done}])=>(
              <div key={tag} style={{marginBottom:6}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{fontSize:10,color:T.muted}}>{tag}</span><span style={{fontSize:8,color:T.muted,...mono}}>{done}/{total}</span></div><div style={{height:3,background:T.bg,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:(done/total*100)+"%",background:T.green,borderRadius:2}}/></div></div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

function ProjectsPage({projects,setProjects,companies,goals,tasks,addNotif}){
  const [showAdd,setShowAdd]=useState(false);
  const BL={name:"",companyId:companies[0]?.id||"",members:[],status:"Planning",deadline:"",description:"",color:"#00d4ff"};
  const [form,setForm]=useState(BL);
  const save=()=>{if(!form.name)return;setProjects(p=>[...p,{...form,id:"p"+Date.now()}]);addNotif(`◆ Project: "${form.name}"`);setShowAdd(false);setForm(BL);};
  const toggleM=(uid)=>setForm(f=>({...f,members:f.members.includes(uid)?f.members.filter(x=>x!==uid):[...f.members,uid]}));
  return(
    <div>
      <STitle accent={T.purple} right={<button style={bS(T.purple,{color:"#fff"})} onClick={()=>setShowAdd(!showAdd)}>+ NEW PROJECT</button>}>Projects</STitle>
      {showAdd&&<Card style={{marginBottom:12,border:`1px solid ${T.purple}40`}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
          <Fld label="NAME *"><input style={inp()} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Fld>
          <Fld label="COMPANY"><select style={inp()} value={form.companyId} onChange={e=>setForm({...form,companyId:e.target.value})}>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Fld>
          <Fld label="STATUS"><select style={inp()} value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{["Planning","Active","On Hold","Completed"].map(s=><option key={s}>{s}</option>)}</select></Fld>
          <Fld label="DEADLINE"><DatePicker value={form.deadline} onChange={v=>setForm({...form,deadline:v})}/></Fld>
          <Fld label="COLOR"><div style={{display:"flex",gap:6}}><input type="color" value={form.color} onChange={e=>setForm({...form,color:e.target.value})} style={{width:38,height:32,border:`1px solid ${T.border}`,borderRadius:5,cursor:"pointer",background:"none",padding:2}}/><input style={inp({flex:1})} value={form.color} onChange={e=>setForm({...form,color:e.target.value})}/></div></Fld>
          <Fld label="DESCRIPTION"><input style={inp()} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></Fld>
          <Fld label="TEAM MEMBERS" col="1/-1">
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:3}}>{USERS.map(u=><button key={u.id} onClick={()=>toggleM(u.id)} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:5,border:`1px solid ${form.members.includes(u.id)?T.accent:T.border}`,background:form.members.includes(u.id)?T.accent+"20":"transparent",cursor:"pointer",fontFamily:"'Rajdhani',sans-serif",color:form.members.includes(u.id)?T.accent:T.muted,fontSize:11}}><Av user={u} size={20}/>{u.name}{form.members.includes(u.id)&&<span style={{color:T.accent}}>✓</span>}</button>)}</div>
          </Fld>
        </div>
        <div style={{display:"flex",gap:7}}><button style={bS(T.purple,{color:"#fff"})} onClick={save}>CREATE</button><button style={bS(T.surface,{color:T.muted})} onClick={()=>setShowAdd(false)}>CANCEL</button></div>
      </Card>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>
        {projects.map(proj=>{
          const co=companies.find(c=>c.id===proj.companyId);
          const pg=goals.filter(g=>g.projectId===proj.id);
          const pt=tasks.filter(t=>t.project===proj.id);
          const avg=pg.length?Math.round(pg.reduce((s,g)=>s+g.progress,0)/pg.length):0;
          const members=USERS.filter(u=>proj.members.includes(u.id));
          const stC={Active:T.green,Planning:T.amber,"On Hold":T.red,Completed:T.purple};
          return(
            <Card key={proj.id} style={{borderLeft:`3px solid ${proj.color}`,position:"relative"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                <div><div style={{fontSize:14,fontWeight:700}}>{proj.name}</div>{co&&<div style={{marginTop:3}}><Tag c={co.color} sm>{co.name}</Tag></div>}</div>
                <div style={{textAlign:"right"}}><Tag c={stC[proj.status]||T.muted} sm>{proj.status}</Tag>{proj.deadline&&<div style={{fontSize:9,color:T.muted,marginTop:3}}>📅 {proj.deadline}</div>}</div>
              </div>
              {proj.description&&<p style={{fontSize:10,color:T.muted,marginBottom:8}}>{proj.description}</p>}
              <div style={{height:4,background:T.bg,borderRadius:2,overflow:"hidden",marginBottom:7}}><div style={{height:"100%",width:avg+"%",background:proj.color,borderRadius:2}}/></div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,fontSize:10,color:T.muted}}><span>{pg.length} goals · {pt.length} tasks</span><span style={{color:proj.color,...mono,fontWeight:700}}>{avg}%</span></div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{members.map(u=><Av key={u.id} user={u} size={24} style={{borderRadius:"50%"}} />)}{members.length===0&&<span style={{fontSize:10,color:T.muted}}>No members yet</span>}</div>
              <button onClick={()=>setProjects(p=>p.filter(x=>x.id!==proj.id))} style={{position:"absolute",top:10,right:10,background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:11}} onMouseEnter={e=>e.currentTarget.style.color=T.red} onMouseLeave={e=>e.currentTarget.style.color=T.muted}>✕</button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function DocsPage({docs,setDocs,user,addNotif,projects}){
  const [showAdd,setShowAdd]=useState(false); const [editing,setEditing]=useState(null); const [search,setSearch]=useState(""); const [catF,setCatF]=useState("all");
  const BL={title:"",type:"doc",content:"",category:"General",author:user.name,projectId:""};
  const [form,setForm]=useState(BL);
  const visible=docs.filter(d=>catF==="all"?true:d.category===catF).filter(d=>d.title.toLowerCase().includes(search.toLowerCase())||d.content.toLowerCase().includes(search.toLowerCase()));
  const typeC={doc:T.accent,meeting:T.amber,sop:T.green};
  const typeI={doc:"▧",meeting:"◷",sop:"☑"};
  const save=()=>{if(!form.title)return;const d={...form,id:"d"+Date.now(),date:new Date().toISOString().split("T")[0]};if(editing){setDocs(p=>p.map(x=>x.id===editing?{...x,...form}:x));addNotif(`📝 Doc updated: "${form.title}"`);}else{setDocs(p=>[...p,d]);addNotif(`📝 Doc created: "${form.title}"`);}setShowAdd(false);setEditing(null);setForm(BL);};
  return(
    <div>
      <STitle accent={T.accent} right={<button style={bS(T.accent)} onClick={()=>{setShowAdd(true);setEditing(null);setForm(BL);}}>+ NEW DOC</button>}>Docs & Wiki</STitle>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <input style={inp({width:220,fontSize:12})} value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search docs…"/>
        <div style={{display:"flex",gap:4}}>{["all",...new Set(docs.map(d=>d.category))].map(c=><button key={c} onClick={()=>setCatF(c)} style={{padding:"3px 9px",borderRadius:3,border:`1px solid ${catF===c?T.accent:T.border}`,background:catF===c?T.accent+"20":"transparent",color:catF===c?T.accent:T.muted,cursor:"pointer",fontSize:10,fontWeight:700,fontFamily:"'Rajdhani',sans-serif"}}>{c.toUpperCase()}</button>)}</div>
      </div>
      {(showAdd||editing)&&<Card style={{marginBottom:12,border:`1px solid ${T.accent}40`}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
          <Fld label="TITLE *" col="1/-1"><input style={inp()} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></Fld>
          <Fld label="TYPE"><select style={inp()} value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option value="doc">Document</option><option value="meeting">Meeting Notes</option><option value="sop">SOP / Runbook</option></select></Fld>
          <Fld label="CATEGORY"><input style={inp()} value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/></Fld>
          <Fld label="PROJECT"><select style={inp()} value={form.projectId} onChange={e=>setForm({...form,projectId:e.target.value})}><option value="">— None —</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Fld>
          <Fld label="CONTENT" col="1/-1"><textarea style={{...inp({height:160,resize:"vertical",fontSize:12}),fontFamily:"'JetBrains Mono',monospace"}} value={form.content} onChange={e=>setForm({...form,content:e.target.value})} placeholder="Markdown supported…"/></Fld>
        </div>
        <div style={{display:"flex",gap:7}}><button style={bS(T.accent)} onClick={save}>SAVE</button><button style={bS(T.surface,{color:T.muted})} onClick={()=>{setShowAdd(false);setEditing(null);}}>CANCEL</button></div>
      </Card>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
        {visible.map(d=>{const proj=projects.find(p=>p.id===d.projectId);return(
          <Card key={d.id} style={{cursor:"pointer",borderTop:`2px solid ${typeC[d.type]||T.accent}`}} onClick={()=>{setForm({title:d.title,type:d.type,content:d.content,category:d.category,author:d.author,projectId:d.projectId||""});setEditing(d.id);setShowAdd(false);}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}><span style={{fontSize:15,...mono,color:typeC[d.type]||T.accent}}>{typeI[d.type]||"▧"}</span><div style={{display:"flex",gap:4}}><Tag c={typeC[d.type]||T.accent} sm>{d.type.toUpperCase()}</Tag><button onClick={e=>{e.stopPropagation();setDocs(p=>p.filter(x=>x.id!==d.id));}} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:11}} onMouseEnter={e=>e.currentTarget.style.color=T.red} onMouseLeave={e=>e.currentTarget.style.color=T.muted}>✕</button></div></div>
            <h3 style={{fontSize:13,fontWeight:700,marginBottom:5}}>{d.title}</h3>
            <p style={{fontSize:10,color:T.muted,marginBottom:6,lineHeight:1.5,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{d.content.replace(/#{1,3}\s/g,"").slice(0,90)}…</p>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:T.muted}}><span>👤 {d.author.split(" ")[0]}</span><span>📅 {d.date}</span></div>
            {proj&&<div style={{marginTop:5}}><Tag c={proj.color} sm>{proj.name}</Tag></div>}
          </Card>
        );})}
      </div>
    </div>
  );
}

function LogisticsPage({ships,setShips,user,addNotif,companies}){
  const [showAdd,setShowAdd]=useState(false);
  const BL={dest:"Amazon FBA — East",skus:"",qty:1,am:user.name,companyId:companies[0]?.id||"",date:""};
  const [form,setForm]=useState(BL);
  const save=()=>{if(!form.skus)return;const id=`SH-${String(ships.length+1).padStart(3,"0")}`;setShips(p=>[...p,{...form,id,date:form.date||new Date().toISOString().split("T")[0],status:"Packing",tracking:"—"}]);addNotif(`📦 Shipment ${id} created`);setShowAdd(false);setForm(BL);};
  const stC={Packing:T.muted,Shipped:T.accent,"In Transit":T.amber,Delivered:T.green};
  return(
    <div>
      <STitle accent={T.purple} right={<button style={bS(T.purple,{color:"#fff"})} onClick={()=>setShowAdd(!showAdd)}>+ SHIPMENT</button>}>Logistics & Fulfillment</STitle>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,marginBottom:12}}>
        {[{l:"TOTAL",v:ships.length,c:T.accent},{l:"IN TRANSIT",v:ships.filter(s=>s.status==="In Transit").length,c:T.amber},{l:"DELIVERED",v:ships.filter(s=>s.status==="Delivered").length,c:T.green},{l:"UNITS",v:ships.reduce((s,x)=>s+x.qty,0),c:T.purple}].map(c=><Card key={c.l} style={{textAlign:"center",borderTop:`2px solid ${c.c}`}}><div style={{fontSize:22,fontWeight:800,color:c.c,...mono}}>{c.v}</div><div style={{fontSize:8,color:T.muted,letterSpacing:1}}>{c.l}</div></Card>)}
      </div>
      {showAdd&&<Card style={{marginBottom:12,border:`1px solid ${T.purple}40`}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr 1fr",gap:8,marginBottom:8}}>
          <Fld label="COMPANY"><select style={inp()} value={form.companyId} onChange={e=>setForm({...form,companyId:e.target.value})}>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Fld>
          <Fld label="DESTINATION"><select style={inp()} value={form.dest} onChange={e=>setForm({...form,dest:e.target.value})}>{["Amazon FBA — East","Amazon FBA — West","Amazon FBA — Central","Shopify Fulfillment","Direct B2B — NYC","Direct B2B — LA","3PL — Chicago"].map(d=><option key={d}>{d}</option>)}</select></Fld>
          <Fld label="SKU(s)"><input style={inp()} value={form.skus} onChange={e=>setForm({...form,skus:e.target.value})} placeholder="SKU-PRO-01…"/></Fld>
          <Fld label="QTY"><input style={inp()} type="number" value={form.qty} onChange={e=>setForm({...form,qty:parseInt(e.target.value)||1})}/></Fld>
          <Fld label="SHIP DATE"><DatePicker value={form.date} onChange={v=>setForm({...form,date:v})}/></Fld>
          <Fld label="ACCOUNT MGR"><select style={inp()} value={form.am} onChange={e=>setForm({...form,am:e.target.value})}>{USERS.map(u=><option key={u.id} value={u.name}>{u.name}</option>)}</select></Fld>
        </div>
        <div style={{display:"flex",gap:7}}><button style={bS(T.purple,{color:"#fff"})} onClick={save}>CREATE</button><button style={bS(T.surface,{color:T.muted})} onClick={()=>setShowAdd(false)}>CANCEL</button></div>
      </Card>}
      <Card>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
          <thead><tr>{["ID","DATE","AM","DESTINATION","SKUs","QTY","COMPANY","STATUS","TRACKING",""].map(h=><th key={h} style={{padding:"6px 8px",textAlign:"left",color:T.muted,fontSize:8,letterSpacing:1,borderBottom:`1px solid ${T.border}`}}>{h}</th>)}</tr></thead>
          <tbody>{ships.map((s,i)=>{const co=companies.find(c=>c.id===s.companyId);return(
            <tr key={s.id} style={{background:i%2===0?T.card:"transparent",borderBottom:`1px solid ${T.border}`}}>
              <td style={{padding:"7px 8px",color:T.accent,fontSize:10,...mono}}>{s.id}</td>
              <td style={{padding:"7px 8px",color:T.muted,fontSize:9}}>{s.date}</td>
              <td style={{padding:"7px 8px",fontSize:11}}>{s.am.split(" ")[0]}</td>
              <td style={{padding:"7px 8px",fontSize:10}}>{s.dest}</td>
              <td style={{padding:"7px 8px",color:T.muted,fontSize:9}}>{s.skus}</td>
              <td style={{padding:"7px 8px",textAlign:"center",...mono}}>{s.qty}</td>
              <td style={{padding:"7px 8px"}}>{co&&<Tag c={co.color} sm>{co.name}</Tag>}</td>
              <td style={{padding:"7px 8px"}}><select value={s.status} onChange={e=>setShips(p=>p.map(x=>x.id===s.id?{...x,status:e.target.value}:x))} style={inp({width:"auto",padding:"2px 5px",fontSize:9,color:stC[s.status]||T.text})}>{["Packing","Shipped","In Transit","Delivered"].map(st=><option key={st}>{st}</option>)}</select></td>
              <td style={{padding:"7px 8px",color:T.muted,fontSize:9,...mono}}>{s.tracking}</td>
              <td style={{padding:"7px 8px"}}><button onClick={()=>setShips(p=>p.filter(x=>x.id!==s.id))} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:11}} onMouseEnter={e=>e.currentTarget.style.color=T.red} onMouseLeave={e=>e.currentTarget.style.color=T.muted}>✕</button></td>
            </tr>
          );})}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD + ANALYTICS + AI — consolidated
// ══════════════════════════════════════════════════════════════════════════════
function DashPage({goals,tasks,todos,ships,user,setPage,eH,fmtT,companies,projects,ticker,fmtUSD,wsOf,fmtMs,allTasks}){
  const done=goals.filter(g=>g.status==="Completed").length;
  const avg=goals.length?Math.round(goals.reduce((s,g)=>s+g.progress,0)/goals.length):0;
  const sD=Object.entries(goals.reduce((a,g)=>{a[g.status]=(a[g.status]||0)+1;return a;},{})).map(([n,v])=>({name:n,value:v,fill:SC[n]}));
  const pD=PERIODS.map(p=>{const gs=goals.filter(g=>g.period===p);return{name:p,avg:gs.length?Math.round(gs.reduce((s,g)=>s+g.progress,0)/gs.length):0,fill:PC[p]};});

  // ── Team live status data ──
  const tAll=allTasks||tasks;
  const teamData=USERS.map(u=>{
    const ws=wsOf(u.name);
    const net=ws.checkIn?(Date.now()-ws.checkIn)-ws.totalBreakMs-(ws.breakStart?Date.now()-ws.breakStart:0):0;
    const ut=tAll.filter(t=>t.assignee===u.name&&t.status!=="Completed");
    const totalSP=ut.reduce((s,t)=>s+(t.effort||2),0);
    const highPrio=ut.filter(t=>t.priority==="High").length;
    const activeTask=tAll.find(t=>t.assignee===u.name&&t.timerStart);
    const completedToday=tAll.filter(t=>t.assignee===u.name&&t.status==="Completed"&&t.completedAt&&new Date(t.completedAt).toDateString()===new Date().toDateString()).length;
    const load=totalSP>=15?"OVERLOADED":totalSP>=8?"HIGH":totalSP>=3?"MODERATE":totalSP>0?"LOW":"NONE";
    const lC={OVERLOADED:T.red,HIGH:T.amber,MODERATE:"#60a5fa",LOW:T.green,NONE:T.muted};
    return{...u,ws,net,ut,totalSP,highPrio,activeTask,completedToday,load,lC:lC[load]};
  });
  const onlineCount=teamData.filter(u=>u.ws.status==="working").length;
  const breakCount=teamData.filter(u=>u.ws.status==="break").length;
  const offlineCount=teamData.filter(u=>u.ws.status==="out").length;
  const notCheckedIn=teamData.filter(u=>u.ws.status==="out");
  const totalHoursToday=teamData.reduce((s,u)=>s+(u.net>0?u.net:0),0);
  const tasksWithTimers=tAll.filter(t=>t.timerStart).length;

  // ── Activity feed: merge all employee session logs ──
  const allLogs=USERS.flatMap(u=>{const ws=wsOf(u.name);return(ws.log||[]).map(ev=>({...ev,user:u}));}).sort((a,b)=>b.ts-a.ts).slice(0,15);
  const evIcon={checkin:"🟢",break:"☕",back:"🔵",checkout:"🔴"};
  const evLabel={checkin:"checked in",break:"went on break",back:"back from break",checkout:"checked out"};

  return(
    <div>
      <STitle accent={T.accent}>Command Center</STitle>

      {/* ── TEAM PRESENCE BAR — the first thing a CEO sees ── */}
      <Card style={{marginBottom:12,border:`1px solid ${T.accent}25`,padding:"10px 14px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:10,height:10,borderRadius:"50%",background:T.green}} className="pulse"/><span style={{fontSize:13,fontWeight:700,color:T.green}}>{onlineCount}</span><span style={{fontSize:10,color:T.muted}}>Online</span></div>
            <div style={{width:1,height:18,background:T.border}}/>
            <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:10,height:10,borderRadius:"50%",background:T.amber}}/><span style={{fontSize:13,fontWeight:700,color:T.amber}}>{breakCount}</span><span style={{fontSize:10,color:T.muted}}>On Break</span></div>
            <div style={{width:1,height:18,background:T.border}}/>
            <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:10,height:10,borderRadius:"50%",background:T.muted}}/><span style={{fontSize:13,fontWeight:700,color:T.muted}}>{offlineCount}</span><span style={{fontSize:10,color:T.muted}}>Offline</span></div>
            <div style={{width:1,height:18,background:T.border}}/>
            <div style={{display:"flex",alignItems:"center",gap:5}}><span style={{fontSize:11,color:T.accent}}>⏱</span><span style={{fontSize:13,fontWeight:700,color:T.accent,...mono}}>{tasksWithTimers}</span><span style={{fontSize:10,color:T.muted}}>Active Timers</span></div>
            <div style={{width:1,height:18,background:T.border}}/>
            <div style={{display:"flex",alignItems:"center",gap:5}}><span style={{fontSize:11,color:T.purple}}>⏳</span><span style={{fontSize:13,fontWeight:700,color:T.purple,...mono}}>{fmtMs(totalHoursToday)}</span><span style={{fontSize:10,color:T.muted}}>Team Hours Today</span></div>
          </div>
          {notCheckedIn.length>0&&<div style={{display:"flex",alignItems:"center",gap:5}}>
            <span style={{fontSize:9,color:T.red,fontWeight:700}}>NOT CHECKED IN:</span>
            {notCheckedIn.map(u=><Av key={u.id} user={u} size={20} style={{borderRadius:"50%",opacity:.5}}/>)}
          </div>}
        </div>
      </Card>

      {/* ── KPI ROW ── */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:7,marginBottom:14}}>
        {[{l:"GOALS",v:goals.length,c:T.accent},{l:"COMPLETED",v:done,c:T.green},{l:"AVG PROGRESS",v:avg+"%",c:T.purple},{l:"COMPANIES",v:companies.length,c:T.pink},{l:"PROJECTS",v:projects.length,c:T.amber},{l:"OPEN TODOS",v:todos.filter(t=>!t.done).length,c:"#60a5fa"}].map(c=>(
          <Card key={c.l} style={{textAlign:"center",padding:"10px 6px",border:`1px solid ${c.c}25`,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:c.c,opacity:.5}}/>
            <div style={{fontSize:20,fontWeight:800,color:c.c,...mono}}>{c.v}</div>
            <div style={{fontSize:7,color:T.muted,marginTop:2,letterSpacing:1}}>{c.l}</div>
          </Card>
        ))}
      </div>

      {/* ── LIVE TEAM STATUS + ACTIVITY FEED ── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><p style={{fontSize:8,color:T.muted,letterSpacing:1}}>LIVE TEAM STATUS</p><button onClick={()=>setPage("team")} style={{background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:10}}>→ TEAM</button></div>
          {teamData.map(u=>{const presenceC=u.ws.status==="working"?T.green:u.ws.status==="break"?T.amber:T.muted;const presenceLabel=u.ws.status==="working"?"ONLINE":u.ws.status==="break"?"ON BREAK":"OFFLINE";return(
            <div key={u.id} style={{display:"flex",gap:8,alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${T.border}`,opacity:u.ws.status==="out"?.5:1}}>
              <div style={{position:"relative"}}><Av user={u} size={32}/><div style={{position:"absolute",bottom:-1,right:-1,width:8,height:8,borderRadius:"50%",background:presenceC,border:`2px solid ${T.surface}`}} className={u.ws.status!=="out"?"pulse":""}/></div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}><span style={{fontSize:11,fontWeight:700}}>{u.name}</span><span style={{fontSize:8,color:presenceC,fontWeight:700,background:presenceC+"18",padding:"1px 5px",borderRadius:3,letterSpacing:.5}}>{presenceLabel}</span></div>
                <div style={{fontSize:9,color:T.muted}}>{u.role}</div>
                {u.activeTask&&<div style={{fontSize:9,color:T.accent,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}><span className="pulse" style={{display:"inline-block",width:4,height:4,borderRadius:"50%",background:T.green,marginRight:4}}/>Task: <strong>{u.activeTask.title}</strong></div>}
                {u.ws.status==="working"&&!u.activeTask&&<div style={{fontSize:9,color:T.amber,marginTop:2,fontStyle:"italic"}}>Online — no active task timer</div>}
                {u.ws.status==="out"&&<div style={{fontSize:9,color:T.muted,marginTop:2}}>Not checked in</div>}
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                {u.ws.status!=="out"&&<div style={{fontSize:11,fontWeight:700,color:presenceC,...mono}}>{fmtMs(u.net)}</div>}
                <div style={{fontSize:8,color:u.lC,...mono,fontWeight:600}}>WL: {u.load}</div>
              </div>
            </div>
          );})}
        </Card>
        <Card>
          <p style={{fontSize:8,color:T.muted,letterSpacing:1,marginBottom:8}}>TEAM ACTIVITY FEED</p>
          {allLogs.length===0&&<div style={{textAlign:"center",padding:24}}><div style={{fontSize:28,marginBottom:8}}>📋</div><p style={{color:T.muted,fontSize:11}}>No activity yet today.</p><p style={{color:T.muted,fontSize:9,marginTop:4}}>Employee check-ins, breaks, and checkouts will appear here in real-time.</p></div>}
          {allLogs.map((ev,i)=>(
            <div key={i} style={{display:"flex",gap:7,alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${T.border}`}}>
              <span style={{fontSize:12,flexShrink:0}}>{evIcon[ev.ev]}</span>
              <Av user={ev.user} size={20} style={{flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <span style={{fontSize:11}}><strong>{ev.user.name.split(" ")[0]}</strong> {evLabel[ev.ev]}</span>
              </div>
              <span style={{fontSize:9,color:T.muted,...mono,flexShrink:0}}>{new Date(ev.ts).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}</span>
            </div>
          ))}
        </Card>
      </div>

      {/* ── EMPLOYEE WORKLOAD HEATMAP ── */}
      <Card style={{marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}><p style={{fontSize:8,color:T.muted,letterSpacing:1}}>EMPLOYEE WORKLOAD & ASSIGNMENTS</p><button onClick={()=>setPage("team")} style={{background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:10}}>→ DETAILS</button></div>
        <div style={{display:"grid",gridTemplateColumns:`repeat(${USERS.length},1fr)`,gap:8}}>
          {teamData.map(u=>{
            const capPct=Math.min(100,Math.round(u.totalSP/15*100));
            const ug=goals.filter(g=>g.owner===u.name);
            const goalAvg=ug.length?Math.round(ug.reduce((s,g)=>s+g.progress,0)/ug.length):0;
            const presenceC=u.ws.status==="working"?T.green:u.ws.status==="break"?T.amber:T.muted;
            return(
              <div key={u.id} style={{background:T.bg,borderRadius:7,padding:8,textAlign:"center",border:`1px solid ${presenceC}30`,borderTop:`3px solid ${presenceC}`,opacity:u.ws.status==="out"?.6:1}}>
                <div style={{position:"relative",display:"inline-block",marginBottom:4}}><Av user={u} size={36}/><div style={{position:"absolute",bottom:-1,right:-1,width:8,height:8,borderRadius:"50%",background:presenceC,border:`2px solid ${T.bg}`}} className={u.ws.status!=="out"?"pulse":""}/></div>
                <div style={{fontSize:10,fontWeight:700,marginBottom:1}}>{u.name.split(" ")[0]}</div>
                <div style={{fontSize:8,color:presenceC,fontWeight:700,marginBottom:3}}>{u.ws.status==="working"?"ONLINE":u.ws.status==="break"?"BREAK":"OFFLINE"}</div>
                {u.ws.status!=="out"&&<div style={{fontSize:9,color:presenceC,...mono,fontWeight:700,marginBottom:3}}>{fmtMs(u.net)}</div>}
                <div style={{fontSize:8,color:u.lC,fontWeight:700,background:u.lC+"18",padding:"1px 5px",borderRadius:3,display:"inline-block",marginBottom:4}}>WL: {u.load}</div>
                <div style={{height:4,background:T.surface,borderRadius:3,overflow:"hidden",margin:"4px 0"}}><div style={{height:"100%",width:capPct+"%",background:`linear-gradient(90deg,${u.color},${u.lC})`,borderRadius:3}}/></div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:3}}>
                  {[{l:"Tasks",v:u.ut.length,c:u.color},{l:"High",v:u.highPrio,c:T.red},{l:"Goal%",v:goalAvg+"%",c:T.green},{l:"SP",v:u.totalSP,c:T.purple}].map(x=>(
                    <div key={x.l} style={{padding:3,borderRadius:3,background:T.surface}}><div style={{fontSize:12,fontWeight:800,color:x.c,...mono}}>{x.v}</div><div style={{fontSize:6,color:T.muted}}>{x.l}</div></div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── CHARTS ROW ── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <Card><p style={{fontSize:8,color:T.muted,letterSpacing:1,marginBottom:8}}>GOAL STATUS</p><ResponsiveContainer width="100%" height={200}><PieChart><Pie data={sD} cx="50%" cy="50%" outerRadius={78} innerRadius={35} dataKey="value" paddingAngle={3}>{sD.map((e,i)=><Cell key={i} fill={e.fill}/>)}</Pie><Tooltip content={<CTT/>}/><Legend formatter={v=><span style={{color:T.muted,fontSize:10}}>{v}</span>}/></PieChart></ResponsiveContainer></Card>
        <Card><p style={{fontSize:8,color:T.muted,letterSpacing:1,marginBottom:8}}>PROGRESS BY TIME HORIZON</p><ResponsiveContainer width="100%" height={200}><BarChart data={pD} barSize={22}><CartesianGrid strokeDasharray="3 3" stroke={T.border}/><XAxis dataKey="name" tick={{fill:T.muted,fontSize:10}} axisLine={false} tickLine={false}/><YAxis domain={[0,100]} tick={{fill:T.muted,fontSize:9}} axisLine={false} tickLine={false}/><Tooltip content={<CTT/>}/><Bar dataKey="avg" name="%" radius={[3,3,0,0]}>{pD.map((e,i)=><Cell key={i} fill={e.fill}/>)}<LabelList dataKey="avg" position="top" style={{fill:T.text,fontSize:10,fontWeight:700}} formatter={v=>v+"%"}/></Bar></BarChart></ResponsiveContainer></Card>
      </div>

      {/* ── ACTIVE TASKS + PROJECTS ── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><p style={{fontSize:8,color:T.muted,letterSpacing:1}}>ACTIVE TASKS</p><button onClick={()=>setPage("tasks")} style={{background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:10}}>→ ALL</button></div>
          {tasks.filter(t=>t.status!=="Completed").slice(0,6).map(t=>{const assigneeUser=USERS.find(x=>x.name===t.assignee);const aw=wsOf(t.assignee);return(
            <div key={t.id} style={{display:"flex",gap:7,alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${T.border}`}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:t.timerStart?T.green:T.amber,flexShrink:0}} className={t.timerStart?"pulse":""}/>
              <div style={{flex:1}}><div style={{fontSize:11}}>{t.title}</div><div style={{display:"flex",alignItems:"center",gap:4,marginTop:2}}>{assigneeUser&&<Av user={assigneeUser} size={14} style={{borderRadius:"50%"}}/>}<span style={{fontSize:9,color:T.muted}}>{t.assignee}</span><span style={{width:4,height:4,borderRadius:"50%",background:aw.status==="working"?T.green:aw.status==="break"?T.amber:T.muted,display:"inline-block"}} className={aw.status!=="out"?"pulse":""}/><span style={{fontSize:9,color:T.muted}}>{t.dueDate}</span></div></div>
              <span style={{fontSize:9,color:T.accent,...mono}}>{eH(t.timerStart,t.loggedHours).toFixed(1)}h</span>
            </div>
          );})}
        </Card>
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><p style={{fontSize:8,color:T.muted,letterSpacing:1}}>PROJECTS</p><button onClick={()=>setPage("projects")} style={{background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:10}}>→ ALL</button></div>
          {projects.map(proj=>{const co=companies.find(c=>c.id===proj.companyId);const pg=goals.filter(g=>g.projectId===proj.id);const pct=pg.length?Math.round(pg.reduce((s,g)=>s+g.progress,0)/pg.length):0;const mems=USERS.filter(u=>proj.members.includes(u.id));return(<div key={proj.id} style={{display:"flex",gap:7,alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${T.border}`}}><div style={{width:5,height:5,borderRadius:"50%",background:proj.color,flexShrink:0}}/><div style={{flex:1}}><div style={{fontSize:11}}>{proj.name}</div><div style={{fontSize:9,color:T.muted,display:"flex",alignItems:"center",gap:3,marginTop:2}}>{co?.name} · {mems.map(u=><Av key={u.id} user={u} size={14} style={{borderRadius:"50%",fontSize:7}}/>)}</div></div><span style={{fontSize:9,color:proj.color,...mono,fontWeight:700}}>{pct}%</span></div>);})}
        </Card>
      </div>
    </div>
  );
}

function AIPage({user,goals,tasks,todos,projects}){
  const [msgs,setMsgs]=useState([{role:"assistant",content:`Hey ${user.name}! 👋 I'm Titan AI. I can see your ${goals.length} goals, ${tasks.filter(t=>t.status!=="Completed").length} open tasks, ${todos.filter(t=>!t.done).length} pending to-dos across ${projects.length} active projects. What do you need?`}]);
  const [input,setInput]=useState(""); const [loading,setLoading]=useState(false); const ref=useRef();
  useEffect(()=>{ref.current?.scrollIntoView({behavior:"smooth"});},[msgs]);
  const ctx=`You are Titan AI, an intelligent work OS assistant for ${user.name} (${user.role}) at a US tech startup. Current data: ${tasks.filter(t=>t.status!=="Completed").length} open tasks, ${tasks.filter(t=>t.priority==="High"&&t.status!=="Completed").length} high-priority open, ${tasks.filter(t=>t.timerStart).length} active timers, ${todos.filter(t=>!t.done).length} pending todos, avg goal progress ${goals.length?Math.round(goals.reduce((s,g)=>s+g.progress,0)/goals.length):0}%, ${projects.length} projects. Zero-progress goals: ${goals.filter(g=>g.progress===0).map(g=>g.goal).join(", ")||"none"}. Be concise, smart, actionable. US business context. English only.`;
  const send=async()=>{
    if(!input.trim()||loading)return;
    const um={role:"user",content:input};setMsgs(p=>[...p,um]);setInput("");setLoading(true);
    try{const text=await aiChat({messages:[...msgs.filter((_,i)=>i>0),um].map(m=>({role:m.role,content:m.content})),system:ctx,max_tokens:800});setMsgs(p=>[...p,{role:"assistant",content:text||"Error"}]);}
    catch{setMsgs(p=>[...p,{role:"assistant",content:"⚠️ Connection error."}]);}
    setLoading(false);
  };
  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 120px)"}}>
      <STitle accent={T.accent}>AI Assistant</STitle>
      <div style={{display:"flex",gap:5,marginBottom:9,flexWrap:"wrap",flexShrink:0}}>
        {["What should I focus on?","Who's overloaded?","Analyze goal progress","What's at risk?","Draft my weekly summary"].map(q=><button key={q} onClick={()=>setInput(q)} style={{padding:"3px 9px",borderRadius:3,border:`1px solid ${T.border}`,background:"transparent",color:T.muted,cursor:"pointer",fontSize:10,fontFamily:"'Rajdhani',sans-serif",transition:"all .15s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.accent;e.currentTarget.style.color=T.accent;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.muted;}}>{q}</button>)}
      </div>
      <Card style={{flex:1,overflowY:"auto",marginBottom:9,display:"flex",flexDirection:"column",gap:9,minHeight:200}}>
        {msgs.map((m,i)=><div key={i} style={{display:"flex",gap:7,alignItems:"flex-start",flexDirection:m.role==="user"?"row-reverse":"row"}}>
          {m.role==="user"
            ? <Av user={user} size={26} style={{borderRadius:5,flexShrink:0}}/>
            : <div style={{width:26,height:26,borderRadius:5,background:T.purple+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0,border:`1px solid ${T.purple}30`,color:T.purple,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>AI</div>
          }
          <div style={{maxWidth:"74%",background:m.role==="user"?T.accent+"10":T.surface,borderRadius:7,padding:"8px 11px",border:`1px solid ${m.role==="user"?T.accent+"30":T.border}`}}><p style={{fontSize:12,color:T.text,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{m.content}</p></div>
        </div>)}
        {loading&&<div style={{display:"flex",gap:7}}><div style={{width:26,height:26,borderRadius:5,background:T.purple+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>⬡</div><div style={{background:T.surface,borderRadius:7,padding:"8px 11px",border:`1px solid ${T.border}`}}><div style={{display:"flex",gap:3}}>{[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:"50%",background:T.purple,animation:`pulse 1s ${i*.2}s infinite`}}/>)}</div></div></div>}
        <div ref={ref}/>
      </Card>
      <div style={{display:"flex",gap:7,flexShrink:0}}>
        <input style={{...inp(),flex:1,padding:"8px 11px"}} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()} placeholder="Ask Titan AI anything… (Enter to send)"/>
        <button style={bS(T.accent,{padding:"8px 16px",fontSize:13,color:T.bg})} onClick={send} disabled={loading}>{loading?"…":"→"}</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// KPIs PAGE
// ══════════════════════════════════════════════════════════════════════════════
function KPIsPage({kpis,setKpis,user,addNotif,companies,projects}){
  const [catFilter,setCatFilter]  = useState("All");
  const [view,setView]            = useState("grid");   // grid | table | detail
  const [selected,setSelected]    = useState(null);     // KPI id for detail
  const [showAdd,setShowAdd]      = useState(false);
  const CATS = ["All","Revenue","Product","People","Operations"];
  const STATUS_CFG = {
    on_track:   {label:"On Track",    color:"#00e87a", bg:"rgba(0,232,122,.12)"},
    exceeds:    {label:"Exceeds",     color:"#00d4ff", bg:"rgba(0,212,255,.12)"},
    needs_attention:{label:"Attention",color:"#ffb300",bg:"rgba(255,179,0,.12)"},
    at_risk:    {label:"At Risk",     color:"#ff4757", bg:"rgba(255,71,87,.12)"},
  };
  const CAT_COLOR = {Revenue:"#00e87a",Product:"#00d4ff",People:"#a855f7",Operations:"#f59e0b"};
  const BL={name:"",abbr:"",category:"Revenue",unit:"$",prefix:true,format:"currency",target:0,current:0,trend:"up",trendPct:0,status:"on_track",owner:user.name,period:"Monthly",description:"",history:[0,0,0,0,0,0],benchmark:""};
  const [form,setForm]= useState(BL);

  const visible = catFilter==="All" ? kpis : kpis.filter(k=>k.category===catFilter);

  const fmtVal=(kpi,val)=>{
    if(kpi.format==="currency"){
      if(val>=1000000) return `$${(val/1000000).toFixed(1)}M`;
      if(val>=1000)    return `$${(val/1000).toFixed(0)}K`;
      return `$${val}`;
    }
    if(kpi.format==="percent") return `${val}%`;
    if(kpi.format==="ratio")   return `${val}×`;
    if(kpi.format==="score")   return `${val}`;
    if(val>=1000000) return `${(val/1000000).toFixed(1)}M`;
    if(val>=1000)    return `${(val/1000).toFixed(0)}K`;
    return `${val}`;
  };

  const pctToTarget=(kpi)=>{
    // for metrics where lower is better (CAC, Churn, Latency, TTH)
    const lowerBetter = ["CAC","Churn","Latency","TTH"].includes(kpi.abbr);
    if(lowerBetter){
      if(kpi.current<=kpi.target) return 100;
      return Math.round(kpi.target/kpi.current*100);
    }
    return Math.min(100,Math.round(kpi.current/kpi.target*100));
  };

  const sparkPath=(history,w=120,h=36)=>{
    const mn=Math.min(...history); const mx=Math.max(...history);
    const range=mx-mn||1;
    const pts=history.map((v,i)=>[
      Math.round(i*(w/(history.length-1))),
      Math.round(h-(v-mn)/range*h)
    ]);
    return "M"+pts.map(p=>p.join(",")).join(" L");
  };

  const save=()=>{
    if(!form.name||!form.abbr) return;
    setKpis(p=>[...p,{...form,id:"k"+Date.now()}]);
    addNotif(`◑ KPI added: "${form.name}"`);
    setShowAdd(false); setForm(BL);
  };

  const updateCurrent=(id,val)=>{
    setKpis(p=>p.map(k=>{
      if(k.id!==id) return k;
      const newHist=[...k.history.slice(1),parseFloat(val)||0];
      const trend=val>k.current?"up":val<k.current?"down":"flat";
      const trendPct=k.current>0?Math.round(((val-k.current)/k.current)*100):0;
      let status="on_track";
      const pct=pctToTarget({...k,current:parseFloat(val)||0});
      if(pct>=100) status="exceeds";
      else if(pct>=80) status="on_track";
      else if(pct>=50) status="needs_attention";
      else status="at_risk";
      return{...k,current:parseFloat(val)||0,history:newHist,trend,trendPct:Math.abs(trendPct),status};
    }));
    if(selected===id) setSelected(id);
  };

  // summary stats
  const onTrack   = kpis.filter(k=>k.status==="on_track"||k.status==="exceeds").length;
  const atRisk    = kpis.filter(k=>k.status==="at_risk").length;
  const attention = kpis.filter(k=>k.status==="needs_attention").length;
  const avgPct    = Math.round(kpis.reduce((s,k)=>s+pctToTarget(k),0)/kpis.length);

  const detail = selected ? kpis.find(k=>k.id===selected) : null;

  return(
    <div>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <STitle accent={T.accent}>KPI Dashboard</STitle>
        <div style={{display:"flex",gap:7}}>
          <div style={{display:"flex",background:T.surface,borderRadius:6,padding:3,gap:2}}>
            {[["grid","▦"],["table","▤"]].map(([v,i])=><button key={v} onClick={()=>setView(v)} style={{padding:"4px 10px",borderRadius:4,border:"none",cursor:"pointer",fontSize:12,background:view===v?T.accent:"transparent",color:view===v?T.bg:T.muted,fontFamily:"'Rajdhani',sans-serif",fontWeight:700}}>{i}</button>)}
          </div>
          <button style={bS(T.accent)} onClick={()=>setShowAdd(!showAdd)}>+ ADD KPI</button>
        </div>
      </div>

      {/* Summary KPI cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:16}}>
        {[
          {l:"TOTAL KPIs",   v:kpis.length,  c:T.accent},
          {l:"ON TRACK",     v:onTrack,       c:T.green},
          {l:"NEEDS ATTENTION",v:attention,   c:T.amber},
          {l:"AT RISK",      v:atRisk,        c:T.red},
          {l:"AVG TO TARGET",v:avgPct+"%",    c:T.purple},
        ].map(c=>(
          <Card key={c.l} style={{textAlign:"center",padding:"12px 8px",border:`1px solid ${c.c}25`,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:c.c,opacity:.6}}/>
            <div style={{fontSize:22,fontWeight:800,color:c.c,...mono}}>{c.v}</div>
            <div style={{fontSize:8,color:T.muted,marginTop:3,letterSpacing:1}}>{c.l}</div>
          </Card>
        ))}
      </div>

      {/* Category filter */}
      <div style={{display:"flex",gap:5,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        {CATS.map(c=>(
          <button key={c} onClick={()=>setCatFilter(c)}
            style={{padding:"3px 12px",borderRadius:4,border:`1px solid ${catFilter===c?(CAT_COLOR[c]||T.accent):T.border}`,
              background:catFilter===c?(CAT_COLOR[c]||T.accent)+"20":"transparent",
              color:catFilter===c?(CAT_COLOR[c]||T.accent):T.muted,
              cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"'Rajdhani',sans-serif"}}>
            {c}
          </button>
        ))}
        <span style={{marginLeft:"auto",fontSize:10,color:T.muted}}>{visible.length} metrics</span>
      </div>

      {/* Add form */}
      {showAdd&&(
        <Card style={{marginBottom:14,border:`1px solid ${T.accent}40`}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:8}}>
            <Fld label="METRIC NAME *"><input style={inp()} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Monthly Recurring Revenue"/></Fld>
            <Fld label="ABBR *"><input style={inp()} value={form.abbr} onChange={e=>setForm({...form,abbr:e.target.value})} placeholder="MRR"/></Fld>
            <Fld label="CATEGORY">
              <select style={inp()} value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>
                {["Revenue","Product","People","Operations"].map(c=><option key={c}>{c}</option>)}
              </select>
            </Fld>
            <Fld label="FORMAT">
              <select style={inp()} value={form.format} onChange={e=>setForm({...form,format:e.target.value})}>
                {["currency","percent","ratio","score","number"].map(c=><option key={c}>{c}</option>)}
              </select>
            </Fld>
            <Fld label="CURRENT VALUE"><input style={inp()} type="number" value={form.current} onChange={e=>setForm({...form,current:parseFloat(e.target.value)||0})}/></Fld>
            <Fld label="TARGET"><input style={inp()} type="number" value={form.target} onChange={e=>setForm({...form,target:parseFloat(e.target.value)||0})}/></Fld>
            <Fld label="OWNER">
              <select style={inp()} value={form.owner} onChange={e=>setForm({...form,owner:e.target.value})}>
                {USERS.map(u=><option key={u.id} value={u.name}>{u.name}</option>)}
              </select>
            </Fld>
            <Fld label="PERIOD"><input style={inp()} value={form.period} onChange={e=>setForm({...form,period:e.target.value})} placeholder="Monthly"/></Fld>
            <Fld label="DESCRIPTION" col="1/-1"><input style={inp()} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="What does this metric measure?"/></Fld>
            <Fld label="BENCHMARK" col="1/-1"><input style={inp()} value={form.benchmark} onChange={e=>setForm({...form,benchmark:e.target.value})} placeholder="Industry benchmark or target context"/></Fld>
          </div>
          <div style={{display:"flex",gap:7}}>
            <button style={bS(T.green,{color:T.bg})} onClick={save}>SAVE KPI</button>
            <button style={bS(T.surface,{color:T.muted})} onClick={()=>setShowAdd(false)}>CANCEL</button>
          </div>
        </Card>
      )}

      {/* Detail panel */}
      {detail&&(
        <Card style={{marginBottom:14,border:`2px solid ${CAT_COLOR[detail.category]||T.accent}40`,position:"relative"}}>
          <button onClick={()=>setSelected(null)} style={{position:"absolute",top:10,right:10,background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:14}}>✕</button>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
            <div>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
                <Tag c={CAT_COLOR[detail.category]||T.accent} sm>{detail.category}</Tag>
                <span style={{...STATUS_CFG[detail.status],background:STATUS_CFG[detail.status].bg,padding:"2px 8px",borderRadius:3,fontSize:10,fontWeight:700}}>{STATUS_CFG[detail.status]?.label}</span>
              </div>
              <h3 style={{fontSize:16,fontWeight:700,marginBottom:4}}>{detail.name}</h3>
              <p style={{fontSize:11,color:T.muted,lineHeight:1.6,marginBottom:8}}>{detail.description}</p>
              <div style={{fontSize:10,color:T.muted,marginBottom:3}}>📐 {detail.benchmark}</div>
              <div style={{fontSize:10,color:T.muted}}>👤 {detail.owner} · {detail.period}</div>
            </div>
            <div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                <div style={{background:T.bg,borderRadius:7,padding:10,textAlign:"center"}}>
                  <div style={{fontSize:24,fontWeight:800,color:CAT_COLOR[detail.category]||T.accent,...mono}}>{fmtVal(detail,detail.current)}</div>
                  <div style={{fontSize:9,color:T.muted,letterSpacing:1}}>CURRENT</div>
                </div>
                <div style={{background:T.bg,borderRadius:7,padding:10,textAlign:"center"}}>
                  <div style={{fontSize:24,fontWeight:800,color:T.muted,...mono}}>{fmtVal(detail,detail.target)}</div>
                  <div style={{fontSize:9,color:T.muted,letterSpacing:1}}>TARGET</div>
                </div>
              </div>
              <div style={{marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:T.muted,marginBottom:4}}>
                  <span>Progress to target</span>
                  <span style={{color:CAT_COLOR[detail.category]||T.accent,...mono}}>{pctToTarget(detail)}%</span>
                </div>
                <div style={{height:6,background:T.border,borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",width:pctToTarget(detail)+"%",background:STATUS_CFG[detail.status]?.color||T.green,borderRadius:3,transition:"width .5s"}}/>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:10,color:T.muted}}>Update current:</span>
                <input type="number" defaultValue={detail.current} onBlur={e=>updateCurrent(detail.id,e.target.value)}
                  style={{...inp({width:100,fontSize:12,padding:"4px 8px",textAlign:"center"})}}/>
              </div>
            </div>
            <div>
              <p style={{fontSize:9,color:T.muted,letterSpacing:1,marginBottom:8}}>6-MONTH TREND</p>
              <svg width="100%" height="60" viewBox="0 0 120 40" style={{overflow:"visible"}}>
                <path d={sparkPath(detail.history,120,36)} fill="none" stroke={CAT_COLOR[detail.category]||T.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                {detail.history.map((v,i)=>{
                  const mn=Math.min(...detail.history); const mx=Math.max(...detail.history); const range=mx-mn||1;
                  const x=Math.round(i*(120/(detail.history.length-1)));
                  const y=Math.round(36-(v-mn)/range*36);
                  return <circle key={i} cx={x} cy={y} r="3" fill={CAT_COLOR[detail.category]||T.accent}/>;
                })}
              </svg>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:T.muted,marginTop:4}}>
                <span>6mo ago</span><span>Now</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:5,marginTop:10}}>
                {[
                  {l:"6mo ago",v:fmtVal(detail,detail.history[0]),c:T.muted},
                  {l:"3mo ago",v:fmtVal(detail,detail.history[3]),c:T.muted},
                  {l:"MoM Δ",  v:(detail.trend==="up"?"↑":"↓")+" "+detail.trendPct+"%",c:detail.trend==="up"?T.green:T.red},
                ].map(x=>(
                  <div key={x.l} style={{background:T.bg,borderRadius:5,padding:"6px",textAlign:"center"}}>
                    <div style={{fontSize:11,fontWeight:700,color:x.c,...mono}}>{x.v}</div>
                    <div style={{fontSize:8,color:T.muted}}>{x.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* GRID view */}
      {view==="grid"&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
          {visible.map(k=>{
            const pct = pctToTarget(k);
            const sc  = STATUS_CFG[k.status]||STATUS_CFG.on_track;
            const cc  = CAT_COLOR[k.category]||T.accent;
            const mn=Math.min(...k.history); const mx=Math.max(...k.history); const range=mx-mn||1;
            const isSelected = selected===k.id;
            return(
              <Card key={k.id} style={{
                cursor:"pointer",borderLeft:`3px solid ${cc}`,
                border:isSelected?`2px solid ${cc}`:`1px solid ${T.border}`,
                borderLeft:`3px solid ${cc}`,transition:"border .15s"
              }} onClick={()=>setSelected(isSelected?null:k.id)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div style={{flex:1,marginRight:10}}>
                    <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:3}}>
                      <span style={{fontSize:13,fontWeight:700}}>{k.name}</span>
                      <Tag c={cc} sm>{k.abbr}</Tag>
                    </div>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                      <Tag c={cc} sm>{k.category}</Tag>
                      <span style={{...sc,background:sc.bg,padding:"1px 6px",borderRadius:3,fontSize:9,fontWeight:700,color:sc.color}}>{sc.label}</span>
                      <Tag c={T.muted} sm>{k.period}</Tag>
                    </div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:22,fontWeight:800,color:sc.color,...mono,lineHeight:1}}>{fmtVal(k,k.current)}</div>
                    <div style={{fontSize:10,color:T.muted,marginTop:2}}>target {fmtVal(k,k.target)}</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{height:4,background:T.border,borderRadius:2,overflow:"hidden",marginBottom:6}}>
                  <div style={{height:"100%",width:pct+"%",background:sc.color,borderRadius:2,transition:"width .5s"}}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <span style={{fontSize:10,color:T.muted}}>👤 {k.owner}</span>
                  <span style={{fontSize:10,color:sc.color,...mono,fontWeight:700}}>{pct}% to target</span>
                </div>

                {/* Sparkline */}
                <div style={{display:"flex",alignItems:"flex-end",gap:2,height:28}}>
                  {k.history.map((v,i)=>{
                    const h=Math.max(2,Math.round(((v-mn)/range)*24));
                    const isCurrent=i===k.history.length-1;
                    return <div key={i} style={{flex:1,height:h,background:isCurrent?cc:cc+"40",borderRadius:1,transition:"height .3s"}}/>;
                  })}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:9,color:T.muted}}>
                  <span>6mo ago</span>
                  <span style={{color:k.trend==="up"?T.green:k.trend==="down"?T.red:T.muted,fontWeight:700}}>
                    {k.trend==="up"?"↑":k.trend==="down"?"↓":"→"} {k.trendPct}% MoM
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* TABLE view */}
      {view==="table"&&(
        <Card>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>
              <tr>
                {["METRIC","CATEGORY","CURRENT","TARGET","TO TARGET","TREND","STATUS","OWNER",""].map(h=>(
                  <th key={h} style={{padding:"8px 10px",textAlign:"left",color:T.muted,fontSize:9,letterSpacing:1,borderBottom:`1px solid ${T.border}`}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((k,i)=>{
                const pct=pctToTarget(k);
                const sc=STATUS_CFG[k.status]||STATUS_CFG.on_track;
                const cc=CAT_COLOR[k.category]||T.accent;
                return(
                  <tr key={k.id} style={{background:i%2===0?T.card:"transparent",cursor:"pointer"}}
                    onClick={()=>setSelected(selected===k.id?null:k.id)}
                    onMouseEnter={e=>e.currentTarget.style.background=T.border}
                    onMouseLeave={e=>e.currentTarget.style.background=i%2===0?T.card:"transparent"}>
                    <td style={{padding:"9px 10px"}}>
                      <div style={{fontSize:12,fontWeight:600}}>{k.name}</div>
                      <div style={{fontSize:9,color:T.muted}}>{k.description.slice(0,50)}…</div>
                    </td>
                    <td style={{padding:"9px 10px"}}><Tag c={cc} sm>{k.category}</Tag></td>
                    <td style={{padding:"9px 10px",fontWeight:700,color:sc.color,...mono}}>{fmtVal(k,k.current)}</td>
                    <td style={{padding:"9px 10px",color:T.muted,...mono}}>{fmtVal(k,k.target)}</td>
                    <td style={{padding:"9px 10px",minWidth:90}}>
                      <div style={{display:"flex",alignItems:"center",gap:5}}>
                        <div style={{flex:1,height:4,background:T.border,borderRadius:2,overflow:"hidden"}}>
                          <div style={{height:"100%",width:pct+"%",background:sc.color,borderRadius:2}}/>
                        </div>
                        <span style={{fontSize:10,color:sc.color,...mono,minWidth:28}}>{pct}%</span>
                      </div>
                    </td>
                    <td style={{padding:"9px 10px"}}>
                      <span style={{color:k.trend==="up"?T.green:k.trend==="down"?T.red:T.muted,fontWeight:700,fontSize:12}}>
                        {k.trend==="up"?"↑":k.trend==="down"?"↓":"→"} {k.trendPct}%
                      </span>
                    </td>
                    <td style={{padding:"9px 10px"}}>
                      <span style={{background:sc.bg,color:sc.color,padding:"2px 7px",borderRadius:3,fontSize:10,fontWeight:700}}>{sc.label}</span>
                    </td>
                    <td style={{padding:"9px 10px",color:T.muted,fontSize:11}}>{k.owner.split(" ")[0]}</td>
                    <td style={{padding:"9px 10px"}}>
                      <button onClick={e=>{e.stopPropagation();setKpis(p=>p.filter(x=>x.id!==k.id));}}
                        style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:12}}
                        onMouseEnter={e=>e.currentTarget.style.color=T.red}
                        onMouseLeave={e=>e.currentTarget.style.color=T.muted}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Category summary */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginTop:16}}>
        {["Revenue","Product","People","Operations"].map(cat=>{
          const catKpis=kpis.filter(k=>k.category===cat);
          const catOk=catKpis.filter(k=>k.status==="on_track"||k.status==="exceeds").length;
          const catAvg=catKpis.length?Math.round(catKpis.reduce((s,k)=>s+pctToTarget(k),0)/catKpis.length):0;
          const cc=CAT_COLOR[cat]||T.accent;
          return(
            <Card key={cat} style={{borderTop:`2px solid ${cc}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span style={{fontSize:12,fontWeight:700,color:cc}}>{cat}</span>
                <span style={{fontSize:10,color:T.muted,...mono}}>{catKpis.length} KPIs</span>
              </div>
              <div style={{fontSize:24,fontWeight:800,color:cc,...mono,marginBottom:4}}>{catAvg}%</div>
              <div style={{fontSize:9,color:T.muted,marginBottom:6}}>avg to target</div>
              <div style={{height:4,background:T.border,borderRadius:2,overflow:"hidden"}}>
                <div style={{height:"100%",width:catAvg+"%",background:cc,borderRadius:2}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:9,color:T.muted}}>
                <span style={{color:T.green}}>{catOk} on track</span>
                <span style={{color:T.red}}>{catKpis.length-catOk} off track</span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function AnalyticsPage({goals,tasks,todos,companies,projects}){
  const sD=Object.entries(goals.reduce((a,g)=>{a[g.status]=(a[g.status]||0)+1;return a;},{})).map(([n,v])=>({name:n,value:v,fill:SC[n]}));
  const pD=PERIODS.map(p=>{const gs=goals.filter(g=>g.period===p);return{name:p,Completed:gs.filter(g=>g.status==="Completed").length,Remaining:gs.length-gs.filter(g=>g.status==="Completed").length,avg:gs.length?Math.round(gs.reduce((s,g)=>s+g.progress,0)/gs.length):0,fill:PC[p]};});
  const cD=companies.map(c=>{const cg=goals.filter(g=>g.companyId===c.id);return{name:c.name,avg:cg.length?Math.round(cg.reduce((s,g)=>s+g.progress,0)/cg.length):0,fill:c.color};});
  const eD=USERS.map(u=>({name:u.name.split(" ")[0],sp:tasks.filter(t=>t.assignee===u.name&&t.status!=="Completed").reduce((s,t)=>s+(t.effort||2),0),fill:u.color}));
  const rD=PERIODS.map(p=>{const gs=goals.filter(g=>g.period===p);return{name:p,value:gs.length?Math.round(gs.reduce((s,g)=>s+g.progress,0)/gs.length):0,fill:PC[p]};});
  return(
    <div>
      <STitle accent={T.amber}>Analytics</STitle>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:7,marginBottom:14}}>
        {[{l:"TOTAL GOALS",v:goals.length,c:T.accent},{l:"COMPLETED",v:goals.filter(g=>g.status==="Completed").length,c:T.green},{l:"HOURS LOGGED",v:tasks.reduce((s,t)=>s+t.loggedHours,0).toFixed(1),c:T.amber},{l:"STORY POINTS",v:tasks.filter(t=>t.status!=="Completed").reduce((s,t)=>s+(t.effort||2),0),c:T.purple},{l:"COMPANIES",v:companies.length,c:T.pink}].map(c=>(
          <Card key={c.l} style={{textAlign:"center",borderTop:`2px solid ${c.c}`}}><div style={{fontSize:22,fontWeight:800,color:c.c,...mono}}>{c.v}</div><div style={{fontSize:8,color:T.muted,letterSpacing:1,marginTop:2}}>{c.l}</div></Card>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <Card><p style={{fontSize:8,color:T.muted,letterSpacing:1,marginBottom:8}}>GOAL STATUS</p><ResponsiveContainer width="100%" height={200}><PieChart><Pie data={sD} cx="50%" cy="50%" outerRadius={80} innerRadius={35} dataKey="value" paddingAngle={3}>{sD.map((e,i)=><Cell key={i} fill={e.fill}/>)}</Pie><Tooltip content={<CTT/>}/><Legend formatter={v=><span style={{color:T.muted,fontSize:10}}>{v}</span>}/></PieChart></ResponsiveContainer></Card>
        <Card><p style={{fontSize:8,color:T.muted,letterSpacing:1,marginBottom:8}}>RADIAL PROGRESS BY PERIOD</p><ResponsiveContainer width="100%" height={200}><RadialBarChart cx="50%" cy="50%" innerRadius={18} outerRadius={92} data={rD} startAngle={90} endAngle={-270}><RadialBar background={{fill:T.bg}} dataKey="value" cornerRadius={4} label={{position:"insideStart",fill:"#fff",fontSize:9,fontWeight:700,formatter:v=>v+"%"}}>{rD.map((e,i)=><Cell key={i} fill={e.fill}/>)}</RadialBar><Tooltip content={<CTT/>}/><Legend iconType="circle" formatter={(v,e)=><span style={{color:e.color,fontSize:10}}>{v}</span>}/></RadialBarChart></ResponsiveContainer></Card>
        <Card><p style={{fontSize:8,color:T.muted,letterSpacing:1,marginBottom:8}}>TEAM STORY POINTS</p><ResponsiveContainer width="100%" height={180}><BarChart data={eD} barSize={26}><CartesianGrid strokeDasharray="3 3" stroke={T.border}/><XAxis dataKey="name" tick={{fill:T.muted,fontSize:11}} axisLine={false} tickLine={false}/><YAxis tick={{fill:T.muted,fontSize:9}} axisLine={false} tickLine={false}/><Tooltip content={<CTT/>}/><Bar dataKey="sp" name="Open SP" radius={[4,4,0,0]}>{eD.map((e,i)=><Cell key={i} fill={e.fill}/>)}<LabelList dataKey="sp" position="top" style={{fill:T.text,fontSize:10,fontWeight:700}}/></Bar></BarChart></ResponsiveContainer></Card>
        <Card><p style={{fontSize:8,color:T.muted,letterSpacing:1,marginBottom:8}}>PROGRESS BY COMPANY</p><ResponsiveContainer width="100%" height={180}><BarChart data={cD} barSize={30}><CartesianGrid strokeDasharray="3 3" stroke={T.border}/><XAxis dataKey="name" tick={{fill:T.muted,fontSize:10}} axisLine={false} tickLine={false}/><YAxis domain={[0,100]} tick={{fill:T.muted,fontSize:9}} axisLine={false} tickLine={false}/><Tooltip content={<CTT/>}/><Bar dataKey="avg" name="Avg %" radius={[4,4,0,0]}>{cD.map((e,i)=><Cell key={i} fill={e.fill}/>)}<LabelList dataKey="avg" position="top" style={{fill:T.text,fontSize:10,fontWeight:700}} formatter={v=>v+"%"}/></Bar></BarChart></ResponsiveContainer></Card>
      </div>
      <Card><p style={{fontSize:8,color:T.muted,letterSpacing:1,marginBottom:8}}>COMPLETED vs REMAINING BY TIME HORIZON</p><ResponsiveContainer width="100%" height={150}><BarChart data={pD} barSize={30}><CartesianGrid strokeDasharray="3 3" stroke={T.border}/><XAxis dataKey="name" tick={{fill:T.muted,fontSize:10}} axisLine={false} tickLine={false}/><YAxis tick={{fill:T.muted,fontSize:9}} axisLine={false} tickLine={false}/><Tooltip content={<CTT/>}/><Legend formatter={v=><span style={{color:T.muted,fontSize:10}}>{v}</span>}/><Bar dataKey="Completed" stackId="a" fill={T.green}><LabelList dataKey="Completed" position="center" style={{fill:"#fff",fontSize:10,fontWeight:700}}/></Bar><Bar dataKey="Remaining" stackId="a" fill={T.border} radius={[3,3,0,0]}><LabelList dataKey="Remaining" position="center" style={{fill:T.muted,fontSize:10}}/></Bar></BarChart></ResponsiveContainer></Card>
    </div>
  );
}
