import { useState, useEffect, useRef, useCallback } from 'react';
import GitSimulator from './GitSimulator.jsx';
import * as d3 from 'd3';

const API = import.meta.env.VITE_API_BASE || '';
const T = {
  bg:'#06080f',surface:'#0c1220',surfaceAlt:'#111a2e',card:'#0f1628',
  border:'#1a2540',text:'#e2e8f0',textMuted:'#64748b',textDim:'#3e5068',
  accent:'#3b82f6',green:'#22c55e',red:'#ef4444',orange:'#f59e0b',
  purple:'#a78bfa',pink:'#ec4899',cyan:'#06b6d4',teal:'#14b8a6',
  branches:['#3b82f6','#22c55e','#a78bfa','#ec4899','#f59e0b','#06b6d4','#ef4444','#14b8a6','#6366f1','#84cc16'],
};
const shortSha=s=>s?.slice(0,7)||'';
const timeAgo=d=>{
  if(!d)return'';const s=Math.floor((Date.now()-new Date(d))/1000);
  if(s<60)return'just now';if(s<3600)return`${Math.floor(s/60)}m`;
  if(s<86400)return`${Math.floor(s/3600)}h`;if(s<2592000)return`${Math.floor(s/86400)}d`;
  return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric'});
};
const apiFetch=async(p,tk)=>{
  const h={};if(tk)h['x-github-token']=tk;
  const r=await fetch(`${API}${p}`,{headers:h});
  if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error||`HTTP ${r.status}`);}
  return r.json();
};
const getSha=p=>typeof p==='string'?p:p?.sha||'';

function AnimBg(){
  const ref=useRef(null);
  useEffect(()=>{
    const c=ref.current;if(!c)return;const ctx=c.getContext('2d');
    let w,h,pts=[],af;
    const resize=()=>{w=c.width=window.innerWidth;h=c.height=window.innerHeight;};
    resize();window.addEventListener('resize',resize);
    for(let i=0;i<50;i++)pts.push({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-.5)*.25,vy:(Math.random()-.5)*.25,r:Math.random()*1.2+.4,a:Math.random()*.2+.04});
    const draw=()=>{
      ctx.clearRect(0,0,w,h);
      ctx.strokeStyle='rgba(59,130,246,0.025)';ctx.lineWidth=.5;
      for(let x=0;x<w;x+=80){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
      for(let y=0;y<h;y+=80){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
      pts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;if(p.x<0)p.x=w;if(p.x>w)p.x=0;if(p.y<0)p.y=h;if(p.y>h)p.y=0;
        ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=`rgba(59,130,246,${p.a})`;ctx.fill();});
      for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){
        const dx=pts[i].x-pts[j].x,dy=pts[i].y-pts[j].y,dist=Math.sqrt(dx*dx+dy*dy);
        if(dist<130){ctx.beginPath();ctx.moveTo(pts[i].x,pts[i].y);ctx.lineTo(pts[j].x,pts[j].y);
          ctx.strokeStyle=`rgba(59,130,246,${.05*(1-dist/130)})`;ctx.lineWidth=.5;ctx.stroke();}}
      af=requestAnimationFrame(draw);
    };draw();
    return()=>{cancelAnimationFrame(af);window.removeEventListener('resize',resize);};
  },[]);
  return <canvas ref={ref} style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',zIndex:0,pointerEvents:'none'}}/>;
}

function CommitGraph({commits,branchColors,selectedSha,onSelect,compareMode,compareA,compareB,onCompareSelect}){
  const svgRef=useRef(null),wrapRef=useRef(null),zoomRef=useRef(null);
  const [dims,setDims]=useState({w:900,h:600});
  const [zoomLevel,setZoomLevel]=useState(1);

  useEffect(()=>{
    const el=wrapRef.current;if(!el)return;
    const ro=new ResizeObserver(e=>{const{width,height}=e[0].contentRect;if(width>0&&height>0)setDims({w:width,h:height});});
    ro.observe(el);return()=>ro.disconnect();
  },[]);

  const zoomTo=useCallback(s=>{
    if(!svgRef.current||!zoomRef.current)return;
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleTo,s);
  },[]);

  useEffect(()=>{
    if(!commits.length||!svgRef.current)return;
    const svg=d3.select(svgRef.current);
    svg.selectAll('*').remove();
    const ROW=65,COL=110,PT=60,PL=80;
    const branchNames=[...new Set(commits.map(c=>c.branch))];
    const bCol={};branchNames.forEach((b,i)=>{bCol[b]=i;});
    const msgStartX=PL+branchNames.length*COL+30;
    const pos=new Map();
    commits.forEach((c,i)=>{pos.set(c.sha,{x:PL+bCol[c.branch]*COL,y:PT+i*ROW});});
    const defs=svg.append('defs');
    const gl=defs.append('filter').attr('id','gl').attr('x','-80%').attr('y','-80%').attr('width','260%').attr('height','260%');
    gl.append('feGaussianBlur').attr('stdDeviation','5').attr('result','b');
    gl.append('feMerge').selectAll('feMergeNode').data(['b','SourceGraphic']).enter().append('feMergeNode').attr('in',d=>d);
    const root=svg.append('g').attr('class','graph-root');
    branchNames.forEach((b,i)=>{
      const x=PL+i*COL,col=branchColors[b]||T.accent;
      root.append('line').attr('x1',x).attr('x2',x).attr('y1',0).attr('y2',PT+commits.length*ROW+100)
        .attr('stroke',col).attr('stroke-opacity',.06).attr('stroke-width',1.5).attr('stroke-dasharray','3,8');
      root.append('text').attr('x',x).attr('y',25).attr('text-anchor','middle')
        .attr('fill',col).attr('font-size',10).attr('font-weight',700).attr('font-family','system-ui')
        .attr('opacity',.55).text(b.length>15?b.slice(0,13)+'..':b);
    });
    commits.forEach(c=>{
      const p=pos.get(c.sha);if(!p)return;
      const col=branchColors[c.branch]||T.accent;
      (c.parents||[]).forEach(par=>{
        const pp=pos.get(getSha(par));if(!pp)return;
        if(pp.x===p.x){
          root.append('line').attr('x1',p.x).attr('y1',p.y).attr('x2',pp.x).attr('y2',pp.y)
            .attr('stroke',col).attr('stroke-width',2.5).attr('stroke-opacity',.4).attr('stroke-linecap','round');
        }else{
          const my=(p.y+pp.y)/2;
          root.append('path').attr('d',`M${p.x},${p.y} C${p.x},${my} ${pp.x},${my} ${pp.x},${pp.y}`)
            .attr('fill','none').attr('stroke',col).attr('stroke-width',2).attr('stroke-opacity',.3)
            .attr('stroke-dasharray','5,4').attr('stroke-linecap','round');
        }
      });
    });
    commits.forEach(c=>{
      const p=pos.get(c.sha);if(!p)return;
      const col=branchColors[c.branch]||T.accent;
      const sel=c.sha===selectedSha;
      const cA=compareMode&&compareA===c.sha,cB=compareMode&&compareB===c.sha;
      const isMerge=(c.parents||[]).length>1;
      const r=isMerge?8:6;
      const aName=c.author?.name||c.author||'Unknown';
      const date=c.date||c.author?.date;
      const n=root.append('g').attr('transform',`translate(${p.x},${p.y})`).style('cursor','pointer');
      if(sel||cA||cB){
        const gc=cA?T.cyan:cB?T.orange:col;
        n.append('circle').attr('r',r+16).attr('fill',gc).attr('opacity',.07);
        n.append('circle').attr('r',r+10).attr('fill','none').attr('stroke',gc)
          .attr('stroke-width',1.5).attr('opacity',.25).attr('filter','url(#gl)');
      }
      const hr=n.append('circle').attr('r',r+12).attr('fill',col).attr('opacity',0);
      const outer=n.append('circle').attr('r',r+2).attr('fill',sel?col:T.bg).attr('stroke',col).attr('stroke-width',sel?3:2);
      const inner=n.append('circle').attr('r',r).attr('fill',col).attr('opacity',sel?1:.85);
      if(isMerge)n.append('circle').attr('r',3).attr('fill',T.bg);
      if(cA)n.append('text').attr('x',r+5).attr('y',-10).attr('fill',T.cyan).attr('font-size',9).attr('font-weight',800).text('A');
      if(cB)n.append('text').attr('x',r+5).attr('y',-10).attr('fill',T.orange).attr('font-size',9).attr('font-weight',800).text('B');
      n.append('text').attr('x',msgStartX-p.x).attr('y',-3)
        .attr('fill',sel?T.text:T.textMuted).attr('font-size',12).attr('font-family','system-ui')
        .attr('font-weight',sel?600:400)
        .text((c.message||'').substring(0,60)+((c.message||'').length>60?'...':''));
      n.append('text').attr('x',msgStartX-p.x).attr('y',13)
        .attr('fill',T.textDim).attr('font-size',10).attr('font-family','system-ui')
        .text(`${shortSha(c.sha)}  ·  ${aName}  ·  ${timeAgo(date)}`);
      const tt=n.append('g').attr('opacity',0);
      tt.append('rect').attr('x',-130).attr('y',-52).attr('rx',8).attr('width',260).attr('height',42)
        .attr('fill',T.card).attr('stroke',col+'55').attr('stroke-width',1);
      tt.append('text').attr('x',-120).attr('y',-35).attr('fill',col).attr('font-size',11)
        .attr('font-weight',700).attr('font-family',"'SF Mono',monospace").text(shortSha(c.sha));
      tt.append('text').attr('x',-55).attr('y',-35).attr('fill',T.text).attr('font-size',10)
        .attr('font-family','system-ui').text(aName.substring(0,22));
      tt.append('text').attr('x',-120).attr('y',-19).attr('fill',T.textMuted).attr('font-size',9.5)
        .attr('font-family','system-ui').text((c.message||'').substring(0,40));
      n.on('mouseenter',function(){
        hr.transition().duration(150).attr('opacity',.1);
        outer.transition().duration(150).attr('stroke-width',3.5);
        inner.transition().duration(150).attr('r',r+2);
        tt.transition().duration(200).attr('opacity',1);
        d3.select(this).raise();
      });
      n.on('mouseleave',function(){
        hr.transition().duration(200).attr('opacity',0);
        outer.transition().duration(200).attr('stroke-width',sel?3:2);
        inner.transition().duration(200).attr('r',r);
        tt.transition().duration(150).attr('opacity',0);
      });
      n.on('click',()=>{if(compareMode)onCompareSelect(c.sha);else onSelect(c);});
    });
    const zoomBehavior=d3.zoom().scaleExtent([0.1,6])
      .on('zoom',e=>{root.attr('transform',e.transform);setZoomLevel(e.transform.k);});
    svg.call(zoomBehavior).on('dblclick.zoom',null);
    svg.style('cursor','grab')
      .on('mousedown',function(){d3.select(this).style('cursor','grabbing');})
      .on('mouseup mouseleave',function(){d3.select(this).style('cursor','grab');});
    zoomRef.current=zoomBehavior;
    const initScale=Math.min(dims.w/(msgStartX+400),dims.h/(PT+commits.length*ROW+100),1);
    svg.call(zoomBehavior.transform,d3.zoomIdentity.translate(10,10).scale(Math.max(initScale,0.3)));
  },[commits,dims,selectedSha,compareMode,compareA,compareB,branchColors,onSelect,onCompareSelect]);

  return(
    <div ref={wrapRef} style={{width:'100%',height:'100%',position:'relative',overflow:'hidden'}}>
      <svg ref={svgRef} width="100%" height="100%" style={{background:'transparent',display:'block'}}/>
      <div style={{position:'absolute',bottom:14,right:14,display:'flex',flexDirection:'column',gap:3,
        background:T.card+'ee',border:`1px solid ${T.border}`,borderRadius:10,padding:4,
        backdropFilter:'blur(8px)',boxShadow:'0 4px 20px rgba(0,0,0,0.5)'}}>
        {[
          {l:'+',fn:()=>zoomTo(Math.min(zoomLevel*1.4,6))},
          {l:`${Math.round(zoomLevel*100)}%`,fn:null,s:{fontSize:9,color:T.textMuted,cursor:'default',background:'none',border:'none'}},
          {l:'−',fn:()=>zoomTo(Math.max(zoomLevel/1.4,0.1))},
          {l:'⟲',fn:()=>{if(svgRef.current&&zoomRef.current)d3.select(svgRef.current).transition().duration(400).call(zoomRef.current.transform,d3.zoomIdentity.translate(10,10).scale(0.8));}},
        ].map((b,i)=>(
          <button key={i} onClick={b.fn} style={{width:34,height:b.fn===null?20:34,background:T.surfaceAlt,
            border:`1px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:16,cursor:'pointer',
            display:'flex',alignItems:'center',justifyContent:'center',...(b.s||{})}}>{b.l}</button>
        ))}
      </div>
    </div>
  );
}

function CommitList({commits,selectedSha,onSelect,branchColors,compareMode,compareA,compareB,onCompareSelect}){
  return(
    <div style={{overflowY:'auto',height:'100%'}}>
      {commits.map(c=>{
        const col=branchColors[c.branch]||T.accent;
        const sel=c.sha===selectedSha;
        const cA=compareMode&&compareA===c.sha,cB=compareMode&&compareB===c.sha;
        const aName=c.author?.name||c.author||'Unknown';
        const date=c.date||c.author?.date;
        return(
          <div key={c.sha} onClick={()=>compareMode?onCompareSelect(c.sha):onSelect(c)} style={{
            padding:'11px 20px',cursor:'pointer',borderBottom:`1px solid ${T.border}`,
            background:sel?T.accent+'0a':cA?T.cyan+'08':cB?T.orange+'08':'transparent',
            borderLeft:`3px solid ${cA?T.cyan:cB?T.orange:col}`,display:'flex',gap:12,alignItems:'center'}}>
            <div style={{width:10,height:10,borderRadius:'50%',flexShrink:0,background:sel?col:T.bg,border:`2px solid ${col}`}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{color:T.text,fontSize:13,fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                {cA&&<span style={{color:T.cyan,fontWeight:800,marginRight:6}}>A</span>}
                {cB&&<span style={{color:T.orange,fontWeight:800,marginRight:6}}>B</span>}
                {c.message?.split('\n')[0]}
              </div>
              <div style={{display:'flex',gap:8,marginTop:4,alignItems:'center',flexWrap:'wrap'}}>
                <code style={{color:col,fontSize:11,background:col+'11',padding:'1px 6px',borderRadius:3}}>{shortSha(c.sha)}</code>
                <span style={{color:T.green,fontSize:11}}>{aName}</span>
                <span style={{color:T.textDim,fontSize:11}}>{timeAgo(date)}</span>
              </div>
            </div>
            <div style={{background:col+'15',color:col,padding:'2px 8px',borderRadius:4,fontSize:10,whiteSpace:'nowrap'}}>{c.branch}</div>
          </div>
        );
      })}
    </div>
  );
}

function FileDiffs({files,stats}){
  const[exp,setExp]=useState(new Set());
  const toggle=fn=>setExp(p=>{const s=new Set(p);s.has(fn)?s.delete(fn):s.add(fn);return s;});
  if(!files||!files.length)return <div style={{color:T.textDim,padding:20,textAlign:'center',fontSize:13}}>No file changes found</div>;
  return(
    <>
      <div style={{display:'flex',gap:14,marginBottom:14,fontSize:12,padding:'8px 12px',background:T.card,borderRadius:8,border:`1px solid ${T.border}`,color:T.textMuted}}>
        <span><strong style={{color:T.text}}>{files.length}</strong> files</span>
        {stats&&<><span style={{color:T.green}}>+{stats.additions||0}</span><span style={{color:T.red}}>-{stats.deletions||0}</span></>}
      </div>
      {files.map((f,i)=>{
        const sc=f.status==='added'?T.green:f.status==='removed'?T.red:f.status==='renamed'?T.cyan:T.orange;
        const sl=f.status==='added'?'A':f.status==='removed'?'D':f.status==='renamed'?'R':'M';
        const open=exp.has(f.filename);
        return(
          <div key={i} style={{background:T.card,borderRadius:8,marginBottom:6,border:`1px solid ${T.border}`,overflow:'hidden'}}>
            <div onClick={()=>toggle(f.filename)} style={{padding:'9px 12px',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',borderBottom:open?`1px solid ${T.border}`:'none'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,flex:1,minWidth:0}}>
                <span style={{color:sc,fontWeight:700,fontSize:10,background:sc+'18',padding:'1px 5px',borderRadius:3,fontFamily:'monospace'}}>{sl}</span>
                <span style={{color:T.text,fontSize:11.5,fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.filename}</span>
              </div>
              <div style={{display:'flex',gap:6,flexShrink:0,alignItems:'center'}}>
                <span style={{color:T.green,fontSize:10}}>+{f.additions}</span>
                <span style={{color:T.red,fontSize:10}}>-{f.deletions}</span>
                <span style={{color:T.textDim,transform:open?'rotate(180deg)':'none',transition:'transform .2s',fontSize:10}}>▾</span>
              </div>
            </div>
            {open&&f.patch&&(
              <pre style={{margin:0,padding:10,fontSize:11,lineHeight:1.65,overflowX:'auto',maxHeight:350,color:T.textMuted,fontFamily:"'SF Mono','Fira Code',monospace"}}>
                {f.patch.split('\n').map((line,li)=>(
                  <div key={li} style={{
                    color:line.startsWith('+')&&!line.startsWith('+++')?T.green:line.startsWith('-')&&!line.startsWith('---')?T.red:line.startsWith('@@')?T.purple:T.textMuted,
                    background:line.startsWith('+')&&!line.startsWith('+++')?'rgba(34,197,94,0.06)':line.startsWith('-')&&!line.startsWith('---')?'rgba(239,68,68,0.06)':'transparent',
                    padding:'0 6px',borderLeft:`2px solid ${line.startsWith('+')&&!line.startsWith('+++')?T.green+'33':line.startsWith('-')&&!line.startsWith('---')?T.red+'33':'transparent'}`,
                  }}>{line||' '}</div>
                ))}
              </pre>
            )}
          </div>
        );
      })}
    </>
  );
}

function CommitPanel({commit,owner,repo,token,onClose}){
  const[detail,setDetail]=useState(null);
  const[loading,setLoading]=useState(false);
  useEffect(()=>{
    if(!commit||!owner||!repo)return;setLoading(true);
    apiFetch(`/api/repo/${owner}/${repo}/commits/${commit.sha}`,token)
      .then(d=>{setDetail(d);setLoading(false);}).catch(()=>setLoading(false));
  },[commit?.sha,owner,repo,token]);
  if(!commit)return null;
  const aName=commit.author?.name||commit.author||'Unknown';
  const date=commit.date||commit.author?.date;
  return(
    <div style={{position:'fixed',top:0,right:0,width:'100%',maxWidth:580,height:'100vh',background:T.surface,borderLeft:`1px solid ${T.border}`,zIndex:1000,display:'flex',flexDirection:'column',boxShadow:'-8px 0 40px rgba(0,0,0,0.7)'}}>
      <div style={{padding:'12px 20px',borderBottom:`1px solid ${T.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',background:T.surfaceAlt,flexShrink:0}}>
        <span style={{color:T.text,fontWeight:600,fontSize:14}}>Commit Details</span>
        <button onClick={onClose} style={{background:'none',border:'none',color:T.textMuted,cursor:'pointer',fontSize:18,padding:'2px 6px'}}>✕</button>
      </div>
      <div style={{overflowY:'auto',flex:1,padding:'16px 20px'}}>
        <div style={{background:T.card,borderRadius:10,padding:16,border:`1px solid ${T.border}`,marginBottom:16}}>
          <code style={{color:T.accent,fontSize:11,background:T.accent+'15',padding:'2px 8px',borderRadius:4}}>{commit.sha}</code>
          {(commit.parents||[]).length>1&&<span style={{color:T.purple,fontSize:10,background:T.purple+'15',padding:'2px 8px',borderRadius:4,marginLeft:8}}>Merge</span>}
          <p style={{color:T.text,margin:'10px 0 6px',fontSize:13,fontWeight:600,lineHeight:1.5}}>{commit.message?.split('\n')[0]}</p>
          <div style={{color:T.textMuted,fontSize:11}}><span style={{color:T.green}}>{aName}</span>{date&&<span> · {timeAgo(date)}</span>}</div>
        </div>
        {loading?(
          <div style={{textAlign:'center',padding:30,color:T.textMuted,fontSize:13}}>
            <div style={{width:28,height:28,border:`2px solid ${T.border}`,borderTop:`2px solid ${T.accent}`,borderRadius:'50%',animation:'sp .7s linear infinite',margin:'0 auto 10px'}}/>Loading...<style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
          </div>
        ):detail?.files&&<FileDiffs files={detail.files} stats={detail.stats}/>}
      </div>
    </div>
  );
}

function ComparePanel({owner,repo,token,shaA,shaB,onClose}){
  const[data,setData]=useState(null);
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState('');
  useEffect(()=>{
    if(!shaA||!shaB||!owner||!repo)return;
    setLoading(true);setError('');
    apiFetch(`/api/repo/${owner}/${repo}/compare?base=${shaA}&head=${shaB}`,token)
      .then(d=>{setData(d);setLoading(false);})
      .catch(e=>{setError(e.message);setLoading(false);});
  },[shaA,shaB,owner,repo,token]);
  if(!shaA||!shaB)return null;
  return(
    <div style={{position:'fixed',top:0,right:0,width:'100%',maxWidth:580,height:'100vh',background:T.surface,borderLeft:`1px solid ${T.border}`,zIndex:1000,display:'flex',flexDirection:'column',boxShadow:'-8px 0 40px rgba(0,0,0,0.7)'}}>
      <div style={{padding:'12px 20px',borderBottom:`1px solid ${T.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',background:T.surfaceAlt,flexShrink:0}}>
        <span style={{color:T.text,fontWeight:600,fontSize:14}}>Compare: <span style={{color:T.cyan}}>{shortSha(shaA)}</span> → <span style={{color:T.orange}}>{shortSha(shaB)}</span></span>
        <button onClick={onClose} style={{background:'none',border:'none',color:T.textMuted,cursor:'pointer',fontSize:18,padding:'2px 6px'}}>✕</button>
      </div>
      <div style={{overflowY:'auto',flex:1,padding:'16px 20px'}}>
        {loading?(
          <div style={{textAlign:'center',padding:30,color:T.textMuted,fontSize:13}}>
            <div style={{width:28,height:28,border:`2px solid ${T.border}`,borderTop:`2px solid ${T.cyan}`,borderRadius:'50%',animation:'sp .7s linear infinite',margin:'0 auto 10px'}}/>Comparing...<style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
          </div>
        ):error?(
          <div style={{color:T.red,padding:20,textAlign:'center',fontSize:13}}>{error}</div>
        ):data?(
          <>
            <div style={{display:'flex',gap:12,marginBottom:16,padding:'10px 14px',background:T.card,borderRadius:10,border:`1px solid ${T.border}`,flexWrap:'wrap'}}>
              <div style={{color:T.textMuted,fontSize:12}}>Status: <strong style={{color:T.text}}>{data.status}</strong></div>
              <div style={{color:T.green,fontSize:12}}>Ahead: <strong>{data.ahead_by}</strong></div>
              <div style={{color:T.red,fontSize:12}}>Behind: <strong>{data.behind_by}</strong></div>
              <div style={{color:T.accent,fontSize:12}}>Commits: <strong>{data.total_commits}</strong></div>
            </div>
            {data.commits&&data.commits.length>0&&(
              <div style={{marginBottom:16}}>
                <div style={{color:T.textMuted,fontSize:11,fontWeight:600,marginBottom:8,textTransform:'uppercase',letterSpacing:1}}>Commits in range</div>
                {data.commits.slice(0,15).map((c,i)=>(
                  <div key={i} style={{padding:'6px 12px',borderLeft:`2px solid ${T.accent}33`,marginBottom:4,background:T.card,borderRadius:6}}>
                    <span style={{color:T.accent,fontSize:10,fontFamily:'monospace',marginRight:8}}>{shortSha(c.sha)}</span>
                    <span style={{color:T.text,fontSize:12}}>{c.message?.substring(0,50)}</span>
                    <span style={{color:T.textDim,fontSize:10,marginLeft:8}}>{c.author}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{color:T.textMuted,fontSize:11,fontWeight:600,marginBottom:8,textTransform:'uppercase',letterSpacing:1}}>File changes</div>
            <FileDiffs files={data.files}/>
          </>
        ):null}
      </div>
    </div>
  );
}

export default function App(){
  const[url,setUrl]=useState('');
  const[token,setToken]=useState('');
  const[showToken,setShowToken]=useState(false);
  const[repoInfo,setRepoInfo]=useState(null);
  const[branches,setBranches]=useState([]);
  const[commits,setCommits]=useState([]);
  const[branchColors,setBranchColors]=useState({});
  const[contributors,setContributors]=useState([]);
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState('');
  const[selectedCommit,setSelectedCommit]=useState(null);
  const[branchFilter,setBranchFilter]=useState('all');
  const[view,setView]=useState('graph');
  const[searchTerm,setSearchTerm]=useState('');
  const[appMode,setAppMode]=useState('explore');
  const[compareMode,setCompareMode]=useState(false);
  const[compareA,setCompareA]=useState(null);
  const[compareB,setCompareB]=useState(null);

  const parseRepo=u=>{
    const m=u.match(/github\.com\/([^/]+)\/([^/\s#?]+)/);
    if(m)return{owner:m[1],repo:m[2].replace(/\.git$/,'')};
    const parts=u.replace(/\.git$/,'').split('/').filter(Boolean);
    if(parts.length>=2)return{owner:parts[parts.length-2],repo:parts[parts.length-1]};
    return null;
  };
  const parsed=parseRepo(url);

  const fetchRepo=useCallback(async()=>{
    const p=parseRepo(url);if(!p){setError('Enter a valid GitHub URL');return;}
    setLoading(true);setError('');setCommits([]);setBranches([]);setRepoInfo(null);
    setSelectedCommit(null);setBranchFilter('all');setContributors([]);
    setCompareMode(false);setCompareA(null);setCompareB(null);
    try{
      const info=await apiFetch(`/api/repo/${p.owner}/${p.repo}`,token);setRepoInfo(info);
      const br=await apiFetch(`/api/repo/${p.owner}/${p.repo}/branches`,token);setBranches(br);
      const colors={};br.forEach((b,i)=>{colors[b.name]=T.branches[i%T.branches.length];});setBranchColors(colors);
      const all=new Map();
      await Promise.all(br.slice(0,10).map(async branch=>{
        try{const data=await apiFetch(`/api/repo/${p.owner}/${p.repo}/commits?sha=${encodeURIComponent(branch.name)}&per_page=40`,token);
          data.forEach(c=>{if(!all.has(c.sha))all.set(c.sha,{...c,branch:branch.name,message:c.message?.split('\n')[0]||''});});}catch{}
      }));
      setCommits([...all.values()].sort((a,b)=>new Date(b.author?.date||0)-new Date(a.author?.date||0)));
      try{setContributors(await apiFetch(`/api/repo/${p.owner}/${p.repo}/contributors`,token));}catch{}
    }catch(err){setError(err.message);}finally{setLoading(false);}
  },[url,token]);

  const onCompareSelect=sha=>{
    if(!compareA){setCompareA(sha);}
    else if(!compareB&&sha!==compareA){setCompareB(sha);}
    else{setCompareA(sha);setCompareB(null);}
  };

  const filtered=(branchFilter==='all'?commits:commits.filter(c=>c.branch===branchFilter))
    .filter(c=>{if(!searchTerm)return true;const s=searchTerm.toLowerCase();
      return(c.message||'').toLowerCase().includes(s)||(c.author?.name||'').toLowerCase().includes(s)||c.sha.startsWith(s);});

  const isMobile=typeof window!=='undefined'&&window.innerWidth<768;

  return(
    <div style={{background:T.bg,color:T.text,height:'100vh',fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",display:'flex',flexDirection:'column',position:'relative'}}>
      <AnimBg/>
      <header style={{padding:isMobile?'10px 12px':'10px 24px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',gap:isMobile?8:16,background:T.surface+'ee',flexShrink:0,zIndex:10,backdropFilter:'blur(12px)',flexWrap:isMobile?'wrap':'nowrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="19" r="2"/><circle cx="19" cy="12" r="2"/><line x1="12" y1="7" x2="12" y2="17"/><path d="M14 5h2a2 2 0 0 1 2 2v3"/></svg>
          <span style={{fontWeight:800,fontSize:isMobile?14:16}}>Visual<span style={{color:T.accent}}>Git</span></span>
        </div>
        <div style={{display:'flex',gap:2,background:T.bg+'cc',borderRadius:8,padding:2,border:`1px solid ${T.border}`,marginRight:8}}>
          {[{k:'explore',l:'🔍 Explore'},{k:'lab',l:'🧪 Git Lab'}].map(m=>(
            <button key={m.k} onClick={()=>setAppMode(m.k)} style={{background:appMode===m.k?T.accent+'1a':'transparent',color:appMode===m.k?T.accent:T.textMuted,border:'none',borderRadius:6,padding:'4px 12px',cursor:'pointer',fontSize:12,fontWeight:appMode===m.k?600:400}}>{m.l}</button>
          ))}
        </div>
        {appMode==='explore'&&(
          <div style={{flex:1,display:'flex',gap:8,minWidth:0}}>
            <div style={{flex:1,display:'flex',alignItems:'center',gap:6,background:T.bg+'cc',border:`1px solid ${T.border}`,borderRadius:8,padding:'0 10px'}}>
              <span style={{color:T.textDim,fontSize:13}}>🔍</span>
              <input value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>e.key==='Enter'&&fetchRepo()} placeholder="github.com/owner/repo"
                style={{flex:1,background:'none',border:'none',color:T.text,fontSize:13,outline:'none',padding:'8px 0',minWidth:0}}/>
            </div>
            <button onClick={()=>setShowToken(!showToken)} style={{background:token?T.green+'18':T.bg,border:`1px solid ${token?T.green+'44':T.border}`,borderRadius:8,padding:'0 10px',cursor:'pointer',color:token?T.green:T.textMuted,fontSize:14}}>🔑</button>
            <button onClick={fetchRepo} disabled={loading||!url} style={{background:`linear-gradient(135deg,${T.accent},${T.purple})`,color:'#fff',border:'none',borderRadius:8,padding:isMobile?'8px 14px':'8px 22px',fontWeight:600,cursor:loading?'wait':'pointer',fontSize:13,opacity:loading||!url?0.5:1}}>
              {loading?'...':'Explore'}</button>
          </div>
        )}
      </header>

      {appMode==='lab'?(
        <div style={{flex:1,overflow:'hidden',zIndex:10}}><GitSimulator/></div>
      ):(
      <>
      {showToken&&<div style={{padding:'8px 24px',background:T.surfaceAlt+'dd',borderBottom:`1px solid ${T.border}`,display:'flex',gap:8,alignItems:'center',flexShrink:0,zIndex:10}}>
        <span style={{color:T.textMuted,fontSize:12}}>Token:</span>
        <input value={token} onChange={e=>setToken(e.target.value)} placeholder="ghp_xxxx..." type="password" style={{flex:1,maxWidth:360,background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:'5px 10px',color:T.text,fontSize:12,outline:'none'}}/>
      </div>}

      {error&&<div style={{padding:'10px 24px',background:T.red+'12',borderBottom:`1px solid ${T.red}33`,color:T.red,fontSize:13,display:'flex',justifyContent:'space-between',flexShrink:0,zIndex:10}}>
        <span>{error}</span><button onClick={()=>setError('')} style={{background:'none',border:'none',color:T.red,cursor:'pointer'}}>✕</button></div>}

      {loading&&<div style={{flex:1,display:'flex',justifyContent:'center',alignItems:'center',zIndex:10}}>
        <div style={{textAlign:'center'}}><div style={{width:44,height:44,border:`3px solid ${T.border}`,borderTop:`3px solid ${T.accent}`,borderRadius:'50%',animation:'sp .8s linear infinite',margin:'0 auto'}}/><div style={{color:T.textMuted,fontSize:13,marginTop:16}}>Exploring {parsed?.owner}/{parsed?.repo}...</div><style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style></div>
      </div>}

      {!loading&&commits.length>0&&(
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',zIndex:10}}>
          {repoInfo&&(
            <div style={{padding:isMobile?'8px 12px':'10px 24px',background:T.surface+'dd',borderBottom:`1px solid ${T.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8,flexShrink:0,backdropFilter:'blur(8px)'}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                {repoInfo.owner?.avatar_url&&<img src={repoInfo.owner.avatar_url} alt="" style={{width:24,height:24,borderRadius:6}}/>}
                <div><span style={{fontWeight:700,fontSize:13}}><span style={{color:T.textMuted}}>{repoInfo.owner?.login}/</span>{repoInfo.name}</span>
                  {repoInfo.description&&!isMobile&&<div style={{color:T.textDim,fontSize:11,marginTop:1,maxWidth:300,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{repoInfo.description}</div>}</div>
              </div>
              <div style={{display:'flex',gap:isMobile?10:16,fontSize:11,flexWrap:'wrap'}}>
                {[{l:'⭐',v:repoInfo.stars?.toLocaleString(),c:T.orange},{l:'🔀',v:repoInfo.forks?.toLocaleString(),c:T.purple},{l:'●',v:commits.length,c:T.accent},{l:'⑂',v:branches.length,c:T.green},{l:'👥',v:contributors.length,c:T.pink}].map(s=>(
                  <span key={s.l} style={{color:T.textMuted}}>{s.l} <strong style={{color:s.c}}>{s.v}</strong></span>))}
              </div>
            </div>
          )}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 12px',borderBottom:`1px solid ${T.border}`,background:T.surfaceAlt+'dd',gap:8,flexWrap:'wrap',flexShrink:0,backdropFilter:'blur(8px)'}}>
            <div style={{display:'flex',gap:4,flexWrap:'wrap',flex:1,overflow:'hidden'}}>
              <button onClick={()=>setBranchFilter('all')} style={{background:branchFilter==='all'?T.accent+'18':'transparent',border:`1px solid ${branchFilter==='all'?T.accent+'44':T.border}`,color:branchFilter==='all'?T.accent:T.textMuted,borderRadius:6,padding:'2px 8px',fontSize:11,cursor:'pointer',fontWeight:branchFilter==='all'?600:400}}>All</button>
              {branches.slice(0,isMobile?3:15).map(b=>(
                <button key={b.name} onClick={()=>setBranchFilter(b.name)} style={{background:branchFilter===b.name?(branchColors[b.name]||T.accent)+'18':'transparent',border:`1px solid ${branchFilter===b.name?(branchColors[b.name]||T.accent)+'44':T.border}`,color:branchFilter===b.name?(branchColors[b.name]||T.accent):T.textMuted,borderRadius:6,padding:'2px 8px',fontSize:11,cursor:'pointer',fontWeight:branchFilter===b.name?600:400,maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.name}</button>))}
            </div>
            <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
              <button onClick={()=>{setCompareMode(!compareMode);setCompareA(null);setCompareB(null);}} style={{background:compareMode?T.cyan+'18':'transparent',border:`1px solid ${compareMode?T.cyan+'44':T.border}`,color:compareMode?T.cyan:T.textMuted,borderRadius:6,padding:'3px 10px',fontSize:11,cursor:'pointer',fontWeight:compareMode?600:400}}>{compareMode?'✕ Compare':'⇔ Compare'}</button>
              {!isMobile&&<div style={{display:'flex',alignItems:'center',gap:4,background:T.bg+'cc',border:`1px solid ${T.border}`,borderRadius:6,padding:'0 8px'}}>
                <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Search..." style={{background:'none',border:'none',color:T.text,fontSize:11,outline:'none',padding:'4px 0',width:100}}/></div>}
              <div style={{display:'flex',background:T.bg+'cc',borderRadius:6,padding:2,border:`1px solid ${T.border}`}}>
                {['graph','list'].map(v=>(<button key={v} onClick={()=>setView(v)} style={{background:view===v?T.accent+'1a':'transparent',color:view===v?T.accent:T.textMuted,border:'none',borderRadius:4,padding:'3px 10px',cursor:'pointer',fontSize:11,fontWeight:500,textTransform:'capitalize'}}>{v}</button>))}
              </div>
            </div>
          </div>
          {compareMode&&<div style={{padding:'6px 20px',background:T.cyan+'08',borderBottom:`1px solid ${T.cyan}22`,display:'flex',gap:12,alignItems:'center',fontSize:12,flexShrink:0,flexWrap:'wrap'}}>
            <span style={{color:T.cyan,fontWeight:600}}>Compare:</span>
            <span style={{color:T.textMuted}}>{!compareA?'Click commit A':!compareB?'Click commit B':'Showing diff'}</span>
            {compareA&&<code style={{color:T.cyan,fontSize:11}}>A: {shortSha(compareA)}</code>}
            {compareB&&<code style={{color:T.orange,fontSize:11}}>B: {shortSha(compareB)}</code>}
            {compareA&&<button onClick={()=>{setCompareA(null);setCompareB(null);}} style={{background:'none',border:`1px solid ${T.border}`,borderRadius:4,color:T.textMuted,fontSize:10,cursor:'pointer',padding:'1px 8px'}}>Reset</button>}
          </div>}
          <div style={{flex:1,overflow:'hidden'}}>
            {view==='graph'?
              <CommitGraph commits={filtered} branchColors={branchColors} selectedSha={selectedCommit?.sha} onSelect={setSelectedCommit} compareMode={compareMode} compareA={compareA} compareB={compareB} onCompareSelect={onCompareSelect}/>:
              <CommitList commits={filtered} selectedSha={selectedCommit?.sha} onSelect={setSelectedCommit} branchColors={branchColors} compareMode={compareMode} compareA={compareA} compareB={compareB} onCompareSelect={onCompareSelect}/>}
          </div>
        </div>
      )}

      {!loading&&commits.length===0&&!error&&(
        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:24,padding:40,zIndex:10}}>
          <div style={{position:'relative'}}>
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke={T.border} strokeWidth="1"><circle cx="6" cy="5" r="2"/><circle cx="18" cy="5" r="2"/><circle cx="12" cy="19" r="2"/><line x1="6" y1="7" x2="12" y2="17"/><line x1="18" y1="7" x2="12" y2="17"/></svg>
            <div style={{position:'absolute',top:-6,right:-10,width:22,height:22,background:`linear-gradient(135deg,${T.accent},${T.purple})`,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',animation:'pl 2s infinite'}}><span style={{fontSize:11}}>✦</span></div>
            <style>{`@keyframes pl{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.85)}}`}</style>
          </div>
          <div style={{textAlign:'center'}}>
            <h1 style={{fontSize:isMobile?22:28,fontWeight:800,margin:'0 0 8px'}}>Visual<span style={{color:T.accent}}>Git</span></h1>
            <p style={{color:T.textMuted,fontSize:13,maxWidth:400,margin:'0 auto',lineHeight:1.6}}>Explore any public GitHub repo — visualize commits, branches, diffs, and compare changes.</p>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'center'}}>
            {[{n:'facebook/react',d:'React'},{n:'vuejs/vue',d:'Vue'},{n:'denoland/deno',d:'Deno'},{n:'expressjs/express',d:'Express'}].map(r=>(
              <button key={r.n} onClick={()=>setUrl(`https://github.com/${r.n}`)} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:'10px 16px',color:T.text,cursor:'pointer',fontSize:12,textAlign:'left'}}>
                <div style={{fontWeight:600}}>{r.d}</div><div style={{color:T.textDim,fontSize:10,marginTop:2}}>{r.n}</div></button>))}
          </div>
        </div>
      )}

      {!compareMode&&<CommitPanel commit={selectedCommit} owner={parsed?.owner} repo={parsed?.repo} token={token} onClose={()=>setSelectedCommit(null)}/>}
      {compareMode&&compareA&&compareB&&<ComparePanel owner={parsed?.owner} repo={parsed?.repo} token={token} shaA={compareA} shaB={compareB} onClose={()=>{setCompareA(null);setCompareB(null);}}/>}
      </>
      )}
    </div>
  );
}