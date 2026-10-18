import '../../../styles/skeleton.css';

export function SkeletonDashboard() {
  return (
    <div className="skeleton-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="skeleton-dashboard__stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton skeleton-stat" style={{ height: '88px', borderRadius: '12px' }} />
        ))}
      </div>
      <div className="skeleton-dashboard__content" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="skeleton skeleton-card" style={{ height: 250, borderRadius: '16px' }} />
        <div className="skeleton-table-wrap" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="skeleton skeleton-text" style={{ height: '18px', borderRadius: '4px' }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default SkeletonDashboard;
