import React from 'react';
import { useNavigate } from 'react-router-dom';
import { dash, dashGrades, dashActions } from '../data/sellerData';

export default function ReturnsDashboard() {
  const nav = useNavigate();
  return (
    <div style={{ maxWidth: 1500, margin: '0 auto', padding: '16px 16px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Returns &amp; Recovery — this month</h1>
          <div style={{ fontSize: 12.5, color: '#565959', marginTop: 3 }}>AARAV RETAIL · Jun 2025 · powered by the AI Grading Assistant</div>
        </div>
        <button onClick={() => nav('/seller/returns')} style={{ background: '#fff', border: '1px solid #007185', color: '#007185', fontSize: 13, borderRadius: 8, padding: '8px 14px', cursor: 'pointer' }}>&#8592; Manage Returns</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginTop: 16 }}>
        <Kpi label="Returns processed" value={dash.processed} sub="this month" />
        <Kpi label="Value recovered" value={dash.recovered} sub="resale + fees + SAFE-T + warranty" green />
        <Kpi label="Hours saved" value={dash.hours} sub="vs. manual grading" />
        <Kpi label="Avg AI confidence" value={dash.confidence} sub="across all grades" />
        <Kpi label="SAFE-T win rate" value={dash.safetWin} sub={dash.safetWinSub} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <Card title={`Where the ${dash.recovered} came from`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
            {dash.breakdown.map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eaeded' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: '#111' }}><span style={{ width: 10, height: 10, borderRadius: 3, background: b.c }} />{b.k}</span>
                <b style={{ fontSize: 13.5 }}>{b.v}</b>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Grade distribution">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 150 }}>
            {dashGrades.map((g, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#111', marginBottom: 4 }}>{g.n}</div>
                <div style={{ width: '100%', maxWidth: 44, borderRadius: '6px 6px 0 0', background: g.c, height: `${g.h}%` }} />
                <div style={{ fontSize: 12, fontWeight: 800, color: g.c, marginTop: 6 }}>{g.g}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <Card title="Recovery action mix">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {dashActions.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 82, fontSize: 12, color: '#111', flexShrink: 0 }}>{a.k}</div>
                <div style={{ flex: 1, height: 16, background: '#eff1f1', borderRadius: 8, overflow: 'hidden' }}><div style={{ height: '100%', width: `${a.w}%`, background: a.c, borderRadius: 8 }} /></div>
                <div style={{ width: 22, textAlign: 'right', fontSize: 12, fontWeight: 700 }}>{a.n}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Recent activity">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {dash.activity.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 11, padding: '10px 0', borderBottom: '1px solid #eaeded' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: a.c, marginTop: 4, flexShrink: 0 }} />
                <div style={{ flex: 1 }}><div style={{ fontSize: 13, color: '#111' }}>{a.t}</div><div style={{ fontSize: 11.5, color: '#565959', marginTop: 1 }}>{a.m}</div></div>
                <div style={{ fontSize: 11, color: '#8a8f8f', whiteSpace: 'nowrap' }}>{a.when}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

const Kpi = ({ label, value, sub, green }) => (
  <div style={{ background: green ? '#e6f4ea' : '#fff', border: `1px solid ${green ? '#bfe2ca' : '#d5d9d9'}`, borderRadius: 10, padding: 16 }}>
    <div style={{ fontSize: 12, color: green ? '#0a6b4a' : '#565959', fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: 30, fontWeight: 800, marginTop: 4, color: green ? '#0a6b4a' : '#111' }}>{value}</div>
    <div style={{ fontSize: 11, color: green ? '#107a45' : '#8a8f8f' }}>{sub}</div>
  </div>
);
const Card = ({ title, children }) => (
  <div style={{ background: '#fff', border: '1px solid #d5d9d9', borderRadius: 10, padding: '18px 20px' }}>
    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>{title}</div>
    {children}
  </div>
);
