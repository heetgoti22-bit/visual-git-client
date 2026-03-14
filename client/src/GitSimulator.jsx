import { useState, useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';

const T = {
  bg:'#06080f',surface:'#0c1220',surfaceAlt:'#111a2e',card:'#0f1628',
  border:'#1a2540',text:'#e2e8f0',textMuted:'#64748b',textDim:'#3e5068',
  accent:'#3b82f6',green:'#22c55e',red:'#ef4444',orange:'#f59e0b',
  purple:'#a78bfa',pink:'#ec4899',cyan:'#06b6d4',
};

// ─── Sample repo state generator ───
function createSampleRepo() {
  const commits = [
    { sha:'c1', message:'Initial commit', branch:'main', parents:[], author:'Alice', files:{ 'index.js':'console.log("hello");', 'README.md':'# Project' } },
    { sha:'c2', message:'Add user model', branch:'main', parents:['c1'], author:'Bob', files:{ 'user.js':'class User {}', 'index.js':'import User from "./user";' } },
    { sha:'c3', message:'Add auth middleware', branch:'main', parents:['c2'], author:'Alice', files:{ 'auth.js':'function auth(req,res,next){ next(); }', 'index.js':'import auth from "./auth";' } },
    { sha:'c4', message:'Add login page', branch:'feature/login', parents:['c2'], author:'Charlie', files:{ 'login.jsx':'export default function Login(){ return <form/>; }', 'styles.css':'.login { padding: 20px; }' } },
    { sha:'c5', message:'Add validation', branch:'feature/login', parents:['c4'], author:'Charlie', files:{ 'login.jsx':'export default function Login(){ validate(); return <form/>; }', 'validate.js':'export function validate(){ return true; }' } },
    { sha:'c6', message:'Fix auth bug', branch:'main', parents:['c3'], author:'Bob', files:{ 'auth.js':'function auth(req,res,next){ if(req.token) next(); }' } },
    { sha:'c7', message:'Add dashboard', branch:'feature/dashboard', parents:['c3'], author:'Diana', files:{ 'dashboard.jsx':'export default function Dash(){ return <div>Dashboard</div>; }' } },
    { sha:'c8', message:'Add charts', branch:'feature/dashboard', parents:['c7'], author:'Diana', files:{ 'dashboard.jsx':'export default function Dash(){ return <div><Chart/></div>; }', 'chart.jsx':'export default function Chart(){ return <canvas/>; }' } },
  ];
  return commits;
}

// ─── Explanations for each operation ───
const EXPLANATIONS = {
  cherrypick: {
    title: 'Cherry-Pick',
    icon: '🍒',
    short: 'Apply a single commit from one branch onto another',
    detail: `Cherry-pick copies a commit's changes and creates a NEW commit on the target branch. 
The original commit stays untouched on its source branch.

**What Git does internally:**
1. Computes the diff introduced by the selected commit
2. Applies that diff to the current HEAD
3. Creates a new commit with the same message but a NEW SHA
4. The new commit has the current HEAD as its parent (not the original parent)

**Key insight:** Cherry-pick creates a duplicate — the same changes now exist in two places. 
This can cause conflicts if both branches are later merged.`,
    command: 'git cherry-pick <commit-sha>',
  },
  rebase: {
    title: 'Interactive Rebase',
    icon: '📐',
    short: 'Replay commits on top of a different base',
    detail: `Rebase rewrites history by replaying your branch's commits on top of the target branch's latest commit.

**What Git does internally:**
1. Finds the common ancestor of the two branches
2. Saves the diffs for each commit on your branch
3. Resets your branch to the target branch's tip
4. Replays each saved diff one by one, creating NEW commits
5. Each new commit gets a new SHA (history is rewritten)

**Interactive rebase (git rebase -i) lets you:**
• **Pick** — keep the commit as-is
• **Reword** — change the commit message
• **Squash** — merge into the previous commit
• **Drop** — remove the commit entirely
• **Reorder** — change the order of commits

**Key insight:** Never rebase commits that have been pushed to a shared branch. 
It rewrites history, which breaks other developers' references.`,
    command: 'git rebase -i <target-branch>',
  },
  merge: {
    title: 'Merge',
    icon: '🔀',
    short: 'Combine two branches by creating a merge commit',
    detail: `Merge integrates changes from one branch into another by creating a special commit with TWO parents.

**What Git does internally:**
1. Finds the common ancestor (merge base) of the two branches
2. Performs a three-way merge: base vs branch-A vs branch-B
3. If no conflicts: auto-creates a merge commit with both branch tips as parents
4. If conflicts: pauses and asks you to resolve manually

**Types of merge:**
• **Fast-forward** — if no divergence, just moves the pointer (no merge commit)
• **Three-way merge** — creates a merge commit when branches have diverged
• **Squash merge** — combines all commits into one (no merge commit, linear history)

**Key insight:** Merge preserves the complete history and branch structure. 
The merge commit is the only commit in Git with more than one parent.`,
    command: 'git merge <source-branch>',
  },
  conflict: {
    title: 'Conflict Resolution',
    icon: '⚔️',
    short: 'Resolve when two branches modify the same code',
    detail: `Conflicts occur when Git cannot automatically merge changes because both branches modified the same lines.

**When conflicts happen:**
• During merge, rebase, or cherry-pick
• When two branches edit the same line in the same file
• When one branch deletes a file that another branch modified

**How Git marks conflicts:**
\`\`\`
<<<<<<< HEAD (yours)
const greeting = "Hello World";
=======
const greeting = "Hi there";
>>>>>>> feature-branch (theirs)
\`\`\`

**Resolution process:**
1. Open each conflicted file
2. Choose: keep yours, keep theirs, or write a new version
3. Remove the conflict markers
4. Stage the resolved files: git add <file>
5. Complete: git commit (for merge) or git rebase --continue

**Key insight:** The three-way merge view (yours/base/theirs) makes resolution easier
because you can see what the code looked like BEFORE either change.`,
    command: 'git mergetool  OR  manual edit + git add',
  },
};

// ─── Mini Graph for simulation ───
function SimGraph({ commits, highlight, dragFrom, dragTo, operation, animating }) {
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const [dims, setDims] = useState({ w: 600, h: 400 });

  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(e => {
      const { width, height } = e[0].contentRect;
      if (width > 0 && height > 0) setDims({ w: width, h: height });
    });
    ro.observe(el); return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const branchNames = [...new Set(commits.map(c => c.branch))];
    const branchCol = {}; const colors = [T.accent, T.green, T.purple, T.pink, T.orange, T.cyan];
    branchNames.forEach((b, i) => { branchCol[b] = i; });

    const COL = 120, ROW = 70, PL = 80, PT = 50;
    const root = svg.append('g');

    // Positions
    const byBranch = {};
    commits.forEach(c => { if (!byBranch[c.branch]) byBranch[c.branch] = []; byBranch[c.branch].push(c); });
    const pos = new Map();
    Object.entries(byBranch).forEach(([branch, bcs]) => {
      bcs.forEach((c, i) => {
        pos.set(c.sha, { x: PL + branchCol[branch] * COL, y: PT + i * ROW });
      });
    });

    // Branch labels
    branchNames.forEach((b, i) => {
      const x = PL + i * COL, col = colors[i % colors.length];
      root.append('line').attr('x1', x).attr('x2', x).attr('y1', 20).attr('y2', PT + 8 * ROW)
        .attr('stroke', col).attr('stroke-opacity', .08).attr('stroke-width', 2);
      root.append('text').attr('x', x).attr('y', 15).attr('text-anchor', 'middle')
        .attr('fill', col).attr('font-size', 11).attr('font-weight', 700).attr('font-family', 'system-ui').text(b);
    });

    // Edges
    commits.forEach(c => {
      const p = pos.get(c.sha); if (!p) return;
      const col = colors[branchCol[c.branch] % colors.length];
      (c.parents || []).forEach(pSha => {
        const pp = pos.get(pSha); if (!pp) return;
        if (pp.x === p.x) {
          root.append('line').attr('x1', p.x).attr('y1', p.y).attr('x2', pp.x).attr('y2', pp.y)
            .attr('stroke', col).attr('stroke-width', 2.5).attr('stroke-opacity', .4);
        } else {
          const my = (p.y + pp.y) / 2;
          root.append('path').attr('d', `M${p.x},${p.y} C${p.x},${my} ${pp.x},${my} ${pp.x},${pp.y}`)
            .attr('fill', 'none').attr('stroke', col).attr('stroke-width', 2).attr('stroke-opacity', .3).attr('stroke-dasharray', '5,4');
        }
      });
    });

    // Animated arrow for drag operations
    if (dragFrom && dragTo && pos.get(dragFrom) && pos.get(dragTo)) {
      const from = pos.get(dragFrom), to = pos.get(dragTo);
      const arrow = root.append('g');
      arrow.append('line').attr('x1', from.x).attr('y1', from.y).attr('x2', to.x).attr('y2', to.y)
        .attr('stroke', T.cyan).attr('stroke-width', 2.5).attr('stroke-dasharray', '8,4')
        .attr('marker-end', 'url(#arrowhead)');

      // Arrowhead
      const defs = svg.append('defs');
      defs.append('marker').attr('id', 'arrowhead').attr('viewBox', '0 0 10 10')
        .attr('refX', 8).attr('refY', 5).attr('markerWidth', 8).attr('markerHeight', 8)
        .attr('orient', 'auto').append('path').attr('d', 'M 0 0 L 10 5 L 0 10 z').attr('fill', T.cyan);
    }

    // Nodes
    commits.forEach(c => {
      const p = pos.get(c.sha); if (!p) return;
      const col = colors[branchCol[c.branch] % colors.length];
      const isHighlight = highlight?.includes(c.sha);
      const isDragSrc = dragFrom === c.sha;
      const isDragTgt = dragTo === c.sha;
      const isNew = c.isNew;

      const n = root.append('g').attr('transform', `translate(${p.x},${p.y})`);

      // Glow
      if (isHighlight || isDragSrc || isDragTgt || isNew) {
        const gc = isDragSrc ? T.cyan : isDragTgt ? T.orange : isNew ? T.green : col;
        n.append('circle').attr('r', 18).attr('fill', gc).attr('opacity', .1);
        if (isNew) {
          n.append('circle').attr('r', 14).attr('fill', 'none').attr('stroke', T.green)
            .attr('stroke-width', 2).attr('stroke-dasharray', '3,3').attr('opacity', .6);
        }
      }

      n.append('circle').attr('r', 8).attr('fill', isNew ? T.bg : T.bg).attr('stroke', isNew ? T.green : col)
        .attr('stroke-width', isHighlight || isNew ? 3 : 2);
      n.append('circle').attr('r', 5).attr('fill', isNew ? T.green : col).attr('opacity', .85);

      // Labels
      if (isDragSrc) n.append('text').attr('y', -16).attr('text-anchor', 'middle').attr('fill', T.cyan).attr('font-size', 10).attr('font-weight', 700).text('SOURCE');
      if (isDragTgt) n.append('text').attr('y', -16).attr('text-anchor', 'middle').attr('fill', T.orange).attr('font-size', 10).attr('font-weight', 700).text('TARGET');
      if (isNew) n.append('text').attr('y', -16).attr('text-anchor', 'middle').attr('fill', T.green).attr('font-size', 10).attr('font-weight', 700).text('NEW');

      // Message
      n.append('text').attr('x', 16).attr('y', -2).attr('fill', isNew ? T.green : isHighlight ? T.text : T.textMuted)
        .attr('font-size', 11).attr('font-family', 'system-ui').attr('font-weight', isNew ? 600 : 400)
        .text(c.message.substring(0, 30));
      n.append('text').attr('x', 16).attr('y', 12).attr('fill', T.textDim).attr('font-size', 9)
        .attr('font-family', "'SF Mono',monospace").text(c.sha + ' · ' + c.author);
    });

    // Zoom
    const zoom = d3.zoom().scaleExtent([0.3, 3]).on('zoom', e => root.attr('transform', e.transform));
    svg.call(zoom).style('cursor', 'grab')
      .on('mousedown', function () { d3.select(this).style('cursor', 'grabbing'); })
      .on('mouseup mouseleave', function () { d3.select(this).style('cursor', 'grab'); });
    svg.call(zoom.transform, d3.zoomIdentity.translate(10, 10).scale(Math.min(dims.w / (PL + branchNames.length * COL + 200), 1)));

  }, [commits, dims, highlight, dragFrom, dragTo, animating]);

  return (
    <div ref={wrapRef} style={{ width: '100%', height: '100%', minHeight: 300 }}>
      <svg ref={svgRef} width="100%" height="100%" style={{ background: 'transparent' }} />
    </div>
  );
}

// ─── Conflict Resolution Panel ───
function ConflictResolver({ onResolve }) {
  const [resolved, setResolved] = useState('');
  const ours = 'const greeting = "Hello World";\nconst version = 2;\nmodule.exports = { greeting, version };';
  const base = 'const greeting = "Hello";\nconst version = 1;\nmodule.exports = { greeting, version };';
  const theirs = 'const greeting = "Hi there";\nconst version = 1;\nconst debug = true;\nmodule.exports = { greeting, version, debug };';

  return (
    <div>
      <div style={{ color: T.textMuted, fontSize: 12, marginBottom: 12 }}>
        Both branches modified <code style={{ color: T.accent }}>config.js</code>. Resolve the conflict below:
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'OURS (HEAD)', code: ours, color: T.green, key: 'ours' },
          { label: 'BASE (ancestor)', code: base, color: T.textMuted, key: 'base' },
          { label: 'THEIRS (incoming)', code: theirs, color: T.cyan, key: 'theirs' },
        ].map(p => (
          <div key={p.key} style={{ background: T.bg, borderRadius: 8, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '6px 10px', borderBottom: `1px solid ${T.border}`, fontSize: 10, fontWeight: 700, color: p.color, textTransform: 'uppercase', letterSpacing: 1 }}>
              {p.label}
            </div>
            <pre style={{ padding: 10, fontSize: 11, lineHeight: 1.6, color: T.text, fontFamily: "'SF Mono',monospace", margin: 0, whiteSpace: 'pre-wrap' }}>{p.code}</pre>
            <button onClick={() => setResolved(p.code)} style={{
              width: '100%', padding: '6px', background: p.color + '15', border: 'none', borderTop: `1px solid ${T.border}`,
              color: p.color, fontSize: 11, cursor: 'pointer', fontWeight: 600,
            }}>Use this version</button>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: T.text, marginBottom: 6 }}>Resolved output (edit manually or click a version above):</div>
        <textarea value={resolved} onChange={e => setResolved(e.target.value)}
          style={{
            width: '100%', minHeight: 100, background: T.bg, border: `1px solid ${resolved ? T.green + '55' : T.border}`,
            borderRadius: 8, padding: 12, color: T.text, fontSize: 12, fontFamily: "'SF Mono',monospace",
            outline: 'none', resize: 'vertical',
          }}
          placeholder="Write or select the resolved version..." />
      </div>

      <button onClick={() => { if (resolved) onResolve(resolved); }} disabled={!resolved}
        style={{
          background: resolved ? T.green : T.border, color: '#fff', border: 'none', borderRadius: 8,
          padding: '10px 24px', fontWeight: 600, fontSize: 13, cursor: resolved ? 'pointer' : 'not-allowed', opacity: resolved ? 1 : 0.5,
        }}>
        ✓ Mark as Resolved & Stage
      </button>
    </div>
  );
}

// ─── Rebase Reorder Panel ───
function RebaseReorder({ commits: branchCommits, onReorder }) {
  const [items, setItems] = useState(branchCommits.map((c, i) => ({ ...c, action: 'pick', order: i })));
  const [dragIdx, setDragIdx] = useState(null);

  const actions = ['pick', 'reword', 'squash', 'drop'];
  const actionColors = { pick: T.green, reword: T.accent, squash: T.purple, drop: T.red };

  const moveUp = i => { if (i === 0) return; const n = [...items]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setItems(n); };
  const moveDown = i => { if (i === items.length - 1) return; const n = [...items]; [n[i], n[i + 1]] = [n[i + 1], n[i]]; setItems(n); };
  const setAction = (i, a) => { const n = [...items]; n[i].action = a; setItems(n); };

  return (
    <div>
      <div style={{ color: T.textMuted, fontSize: 12, marginBottom: 12 }}>
        Reorder commits, change actions, then apply the rebase:
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
        {items.map((c, i) => (
          <div key={c.sha} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
            background: c.action === 'drop' ? T.red + '08' : T.card, borderRadius: 8,
            border: `1px solid ${c.action === 'drop' ? T.red + '33' : T.border}`,
            opacity: c.action === 'drop' ? 0.5 : 1,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button onClick={() => moveUp(i)} style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer', fontSize: 10, padding: 0 }}>▲</button>
              <button onClick={() => moveDown(i)} style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer', fontSize: 10, padding: 0 }}>▼</button>
            </div>
            <select value={c.action} onChange={e => setAction(i, e.target.value)}
              style={{
                background: actionColors[c.action] + '18', color: actionColors[c.action],
                border: `1px solid ${actionColors[c.action]}44`, borderRadius: 4, padding: '2px 6px',
                fontSize: 11, fontWeight: 700, outline: 'none', cursor: 'pointer',
              }}>
              {actions.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <code style={{ color: T.accent, fontSize: 11 }}>{c.sha}</code>
            <span style={{ color: T.text, fontSize: 12, flex: 1, textDecoration: c.action === 'drop' ? 'line-through' : 'none' }}>{c.message}</span>
            <span style={{ color: T.textDim, fontSize: 10 }}>{c.author}</span>
          </div>
        ))}
      </div>
      <button onClick={() => onReorder(items)} style={{
        background: `linear-gradient(135deg,${T.accent},${T.purple})`, color: '#fff', border: 'none',
        borderRadius: 8, padding: '10px 24px', fontWeight: 600, fontSize: 13, cursor: 'pointer',
      }}>
        Apply Rebase
      </button>
    </div>
  );
}

// ═══════════════════════════════════════
// MAIN SIMULATOR COMPONENT
// ═══════════════════════════════════════
export default function GitSimulator() {
  const [commits, setCommits] = useState(createSampleRepo());
  const [operation, setOperation] = useState(null); // cherrypick | rebase | merge | conflict
  const [step, setStep] = useState(0); // 0=explain, 1=simulate, 2=result
  const [highlight, setHighlight] = useState(null);
  const [dragFrom, setDragFrom] = useState(null);
  const [dragTo, setDragTo] = useState(null);
  const [resultCommits, setResultCommits] = useState(null);
  const [conflictResolved, setConflictResolved] = useState(false);

  const reset = () => {
    setCommits(createSampleRepo());
    setOperation(null); setStep(0); setHighlight(null);
    setDragFrom(null); setDragTo(null); setResultCommits(null);
    setConflictResolved(false);
  };

  // Simulate cherry-pick
  const runCherryPick = () => {
    setDragFrom('c5'); setDragTo('c6');
    setHighlight(['c5', 'c6']);
    setTimeout(() => {
      const newCommits = [...commits, {
        sha: 'c5\'', message: 'Add validation (cherry-picked)', branch: 'main',
        parents: ['c6'], author: 'Charlie', isNew: true,
        files: { 'validate.js': 'export function validate(){ return true; }' },
      }];
      setResultCommits(newCommits); setStep(2);
    }, 1500);
  };

  // Simulate merge
  const runMerge = () => {
    setDragFrom('c5'); setDragTo('c6');
    setHighlight(['c4', 'c5', 'c6']);
    setTimeout(() => {
      const newCommits = [...commits, {
        sha: 'm1', message: 'Merge feature/login into main', branch: 'main',
        parents: ['c6', 'c5'], author: 'Alice', isNew: true,
        files: { 'login.jsx': 'merged', 'validate.js': 'merged' },
      }];
      setResultCommits(newCommits); setStep(2);
    }, 1500);
  };

  // Simulate conflict
  const runConflict = () => {
    setHighlight(['c3', 'c4']); setStep(1);
  };

  const resolveConflict = (code) => {
    setConflictResolved(true);
    const newCommits = [...commits, {
      sha: 'm2', message: 'Merge feature/login into main (conflict resolved)', branch: 'main',
      parents: ['c6', 'c5'], author: 'Alice', isNew: true,
      files: { 'config.js': code },
    }];
    setResultCommits(newCommits); setStep(2);
  };

  const displayCommits = resultCommits || commits;
  const info = operation ? EXPLANATIONS[operation] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{
        padding: '12px 20px', borderBottom: `1px solid ${T.border}`, background: T.surface + 'ee',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', gap: 8,
      }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(EXPLANATIONS).map(([key, val]) => (
            <button key={key} onClick={() => { reset(); setOperation(key); }}
              style={{
                background: operation === key ? T.accent + '1a' : T.card,
                border: `1px solid ${operation === key ? T.accent + '55' : T.border}`,
                color: operation === key ? T.accent : T.textMuted, borderRadius: 8,
                padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontWeight: operation === key ? 600 : 400,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
              <span>{val.icon}</span> {val.title}
            </button>
          ))}
        </div>
        <button onClick={reset} style={{
          background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
          padding: '6px 14px', fontSize: 12, cursor: 'pointer', color: T.textMuted,
        }}>↺ Reset</button>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', flexDirection: typeof window !== 'undefined' && window.innerWidth < 900 ? 'column' : 'row' }}>
        {/* Left — Graph */}
        <div style={{ flex: 1, minWidth: 0, borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column' }}>
          <SimGraph commits={displayCommits} highlight={highlight} dragFrom={dragFrom} dragTo={dragTo} operation={operation} />
          {/* Step indicator */}
          {operation && step < 2 && (
            <div style={{ padding: '10px 16px', borderTop: `1px solid ${T.border}`, background: T.surfaceAlt, flexShrink: 0 }}>
              {operation === 'cherrypick' && step === 0 && (
                <button onClick={() => { setStep(1); runCherryPick(); }} style={{ background: T.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  🍒 Cherry-pick c5 → main
                </button>
              )}
              {operation === 'merge' && step === 0 && (
                <button onClick={() => { setStep(1); runMerge(); }} style={{ background: T.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  🔀 Merge feature/login → main
                </button>
              )}
              {operation === 'conflict' && step === 0 && (
                <button onClick={runConflict} style={{ background: T.red, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  ⚔️ Simulate Merge Conflict
                </button>
              )}
              {operation === 'rebase' && step === 0 && (
                <button onClick={() => setStep(1)} style={{ background: T.purple, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  📐 Start Interactive Rebase
                </button>
              )}
              {step === 1 && operation !== 'conflict' && operation !== 'rebase' && (
                <div style={{ color: T.cyan, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 16, height: 16, border: `2px solid ${T.cyan}`, borderTop: '2px solid transparent', borderRadius: '50%', animation: 'sp .7s linear infinite' }} />
                  Applying {info?.title}...
                  <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
                </div>
              )}
            </div>
          )}
          {step === 2 && (
            <div style={{ padding: '10px 16px', borderTop: `1px solid ${T.border}`, background: T.green + '08', flexShrink: 0 }}>
              <div style={{ color: T.green, fontSize: 13, fontWeight: 600 }}>✓ {info?.title} completed successfully! Check the graph for the new commit.</div>
            </div>
          )}
        </div>

        {/* Right — Info Panel */}
        <div style={{ width: typeof window !== 'undefined' && window.innerWidth < 900 ? '100%' : 380, flexShrink: 0, overflowY: 'auto', padding: 20, background: T.surface }}>
          {!operation ? (
            <div style={{ textAlign: 'center', paddingTop: 40 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🧪</div>
              <h2 style={{ color: T.text, fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Git Operations Lab</h2>
              <p style={{ color: T.textMuted, fontSize: 13, lineHeight: 1.6, maxWidth: 300, margin: '0 auto' }}>
                Select an operation above to see how Git works internally. Each simulation shows the before/after state of the commit graph with step-by-step explanations.
              </p>
              <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(EXPLANATIONS).map(([key, val]) => (
                  <button key={key} onClick={() => { reset(); setOperation(key); }}
                    style={{
                      background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
                      padding: '12px 16px', cursor: 'pointer', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                    <span style={{ fontSize: 24 }}>{val.icon}</span>
                    <div>
                      <div style={{ color: T.text, fontSize: 13, fontWeight: 600 }}>{val.title}</div>
                      <div style={{ color: T.textDim, fontSize: 11, marginTop: 2 }}>{val.short}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 28 }}>{info.icon}</span>
                <div>
                  <h2 style={{ color: T.text, fontSize: 18, fontWeight: 700, margin: 0 }}>{info.title}</h2>
                  <div style={{ color: T.textMuted, fontSize: 12, marginTop: 2 }}>{info.short}</div>
                </div>
              </div>

              {/* Command */}
              <div style={{ background: T.bg, borderRadius: 8, padding: '10px 14px', marginBottom: 16, border: `1px solid ${T.border}` }}>
                <div style={{ color: T.textDim, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Command</div>
                <code style={{ color: T.green, fontSize: 12, fontFamily: "'SF Mono',monospace" }}>$ {info.command}</code>
              </div>

              {/* Explanation */}
              <div style={{ color: T.textMuted, fontSize: 12, lineHeight: 1.8, whiteSpace: 'pre-wrap', marginBottom: 20 }}>
                {info.detail.split('**').map((part, i) =>
                  i % 2 === 0 ? <span key={i}>{part}</span> : <strong key={i} style={{ color: T.text }}>{part}</strong>
                )}
              </div>

              {/* Conflict resolver */}
              {operation === 'conflict' && step === 1 && !conflictResolved && (
                <ConflictResolver onResolve={resolveConflict} />
              )}

              {/* Rebase reorder */}
              {operation === 'rebase' && step === 1 && (
                <RebaseReorder
                  commits={commits.filter(c => c.branch === 'feature/login')}
                  onReorder={(items) => {
                    setHighlight(items.filter(i => i.action !== 'drop').map(i => i.sha));
                    const kept = items.filter(i => i.action !== 'drop');
                    const newCommits = [
                      ...commits.filter(c => c.branch === 'main'),
                      ...commits.filter(c => c.branch === 'feature/dashboard'),
                      ...kept.map((c, i) => ({
                        ...c,
                        sha: c.sha + "'",
                        message: c.action === 'squash' ? `(squashed) ${c.message}` : c.action === 'reword' ? `[reworded] ${c.message}` : c.message,
                        parents: [i === 0 ? 'c6' : kept[i - 1].sha + "'"],
                        isNew: true,
                      })),
                    ];
                    setResultCommits(newCommits); setStep(2);
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}