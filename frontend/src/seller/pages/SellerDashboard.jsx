import React from 'react';
import { useNavigate } from 'react-router-dom';
import { widgets, legend, deepCards, hours, chart, SVG } from '../data/sellerData';

// polyline point builder — maps a 24-value series into the chart viewBox.
const pts = (vals, maxY, x0 = 44) => {
  const x1 = 520, y0 = 16, y1 = 176, n = vals.length;
  return vals.map((v, i) => {
    const x = x0 + ((x1 - x0) * i) / (n - 1);
    const y = y1 - (y1 - y0) * (Math.min(v, maxY) / maxY);
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
};

export default function SellerDashboard() {
  const nav = useNavigate();
  return (
    <div style={{ maxWidth: 1500, margin: '0 auto', padding: '16px 16px 60px' }}>
      {/* widget cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12, marginBottom: 18 }}>
        {widgets.map((w, i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid #d5d9d9', borderRadius: 8, padding: '12px 14px', minHeight: 92 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 12.5, color: '#111', fontWeight: 600 }}>{w.label}</div>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="3"><polyline points="6 9 12 15 18 9" /></svg>
            </div>
            <div style={{ height: 1, background: '#eaeded', margin: '8px 0' }} />
            {w.stars ? (
              <div style={{ color: '#e77600', fontSize: 14, letterSpacing: 1 }}>★★★★★ <b style={{ color: '#111', fontSize: 16 }}>{w.value}</b></div>
            ) : (
              <div style={{ fontSize: 22, fontWeight: 700 }}>{w.value}</div>
            )}
            <div style={{ fontSize: 11, color: '#565959', marginTop: 3 }}>{w.sub}</div>
          </div>
        ))}
      </div>

      {/* compare sales */}
      <div style={{ background: '#eaf4fb', border: '1px solid #d5e3f0', borderRadius: 8, padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Compare Sales</h2>
          <div style={{ display: 'flex', border: '1px solid #007185', borderRadius: 4, overflow: 'hidden', fontSize: 13 }}>
            <span style={{ padding: '6px 14px', background: '#007185', color: '#fff' }}>Graph view</span>
            <span style={{ padding: '6px 14px', background: '#fff', color: '#007185', cursor: 'pointer' }}>Table view</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <ChartCard yLabels={['6', '4', '2', '0']} axisTitle="Units ordered" x0={40}
            series={[[chart.u_year, 6, '#9aa0a0'], [chart.u_week, 6, '#f6a623'], [chart.u_yest, 6, '#d0491f'], [chart.u_today, 6, '#24b0c9']]} pad={40} />
          <ChartCard yLabels={['300', '200', '100', '0']} axisTitle="Ordered product sales" x0={46}
            series={[[chart.s_year, 300, '#9aa0a0'], [chart.s_week, 300, '#f6a623'], [chart.s_yest, 300, '#d0491f'], [chart.s_today, 300, '#24b0c9']]} pad={46} />
        </div>
        {/* legend */}
        <div style={{ display: 'grid', gridTemplateColumns: '150px repeat(4,1fr)', gap: 0, marginTop: 14, background: '#fff', border: '1px solid #d5d9d9', borderRadius: 6, padding: '14px 16px' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Compare</div>
            <div className="sc-teal" style={{ fontSize: 12.5, marginTop: 3 }}>What's this</div>
          </div>
          {legend.map((l, i) => (
            <div key={i} style={{ borderLeft: '1px solid #eaeded', paddingLeft: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 15, height: 15, border: '1px solid #888', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', background: l.check }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4"><polyline points="20 6 9 17 4 12" /></svg>
                </span>
                <b style={{ fontSize: 13, color: l.color }}>{l.name}</b>
              </div>
              <div style={{ fontSize: 11.5, color: '#565959', margin: '5px 0 0 22px' }}>{l.when}</div>
              <div style={{ fontSize: 11.5, color: '#111', margin: '2px 0 0 22px' }}>{l.units}</div>
              <div style={{ fontSize: 11.5, color: '#111', margin: '1px 0 0 22px' }}>{l.money}</div>
            </div>
          ))}
        </div>
      </div>

      {/* deep dive */}
      <div style={{ background: '#fff', border: '1px solid #d5d9d9', borderRadius: 8, padding: '18px 20px', marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Deep dive your ASIN performance</h2>
            <div style={{ fontSize: 12, color: '#565959', marginTop: 2 }}>Comparing Monday-Sunday ending Jun 1, 2025 to the previous Monday-Sunday</div>
          </div>
          <div className="sc-teal" style={{ fontSize: 13 }}>Hide ASINs</div>
        </div>
        <div style={{ display: 'flex', gap: 10, margin: '16px 0', flexWrap: 'wrap' }}>
          <Pill active>Products with Declining Sales</Pill>
          <Pill>Products with Increasing Sales</Pill>
          <Pill muted>Declining Traffic Products</Pill>
          <Pill>Products Below Market Average</Pill>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {deepCards.map((d, i) => (
            <div key={i} style={{ width: 340, border: '1px solid #d5d9d9', borderRadius: 8, padding: 14 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 4, background: d.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6"><path d={SVG.shoe} /><path d="M9 8V6a3 3 0 016 0v2" /></svg>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#565959', lineHeight: 1.35 }}>{d.title}</div>
                  <div style={{ fontSize: 12, color: '#565959', marginTop: 3 }}>{d.asin}</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: '#111', margin: '12px 0 10px' }}>This ASIN observed <b>{d.decline}</b> decline in OPS</div>
              <button onClick={() => nav('/seller/inventory')} style={{ background: '#007185', color: '#fff', fontSize: 13, borderRadius: 4, padding: '6px 16px', border: 'none', cursor: 'pointer' }}>View Details</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChartCard({ yLabels, axisTitle, series, x0, pad }) {
  const gridY = [16, 68.7, 121.3, 176];
  const labelY = [20, 72, 125, 180];
  return (
    <div style={{ background: '#fff', border: '1px solid #d5d9d9', borderRadius: 6, padding: '12px 10px 6px' }}>
      <svg viewBox="0 0 530 190" style={{ width: '100%', height: 'auto' }}>
        {gridY.map((y, i) => <line key={i} x1={x0} y1={y} x2="524" y2={y} stroke={i === 3 ? '#d5d9d9' : '#eaeded'} />)}
        {yLabels.map((t, i) => <text key={i} x={x0 - 10} y={labelY[i]} textAnchor="end" fontSize="10" fill="#888">{t}</text>)}
        <text x="14" y="119" textAnchor="middle" fontSize="10" fill="#565959" transform="rotate(-90 14 119)">{axisTitle}</text>
        {series.map(([vals, maxY, color], i) => (
          <polyline key={i} points={pts(vals, maxY, x0)} fill="none" stroke={color} strokeWidth={i === 0 ? 1.4 : 1.6} />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: `2px 6px 4px ${pad}px` }}>
        {hours.map((h, i) => <span key={i} style={{ fontSize: 7.5, color: '#888', transform: 'rotate(-45deg)', transformOrigin: 'center', whiteSpace: 'nowrap' }}>{h}</span>)}
      </div>
    </div>
  );
}

function Pill({ children, active, muted }) {
  const style = active
    ? { background: '#007185', color: '#fff', border: 'none' }
    : muted
    ? { border: '1px solid #d5d9d9', color: '#565959', background: '#fff' }
    : { border: '1px solid #007185', color: '#007185', background: '#fff' };
  return <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, padding: '6px 15px', borderRadius: 16, cursor: 'pointer', ...style }}>{children}</span>;
}
