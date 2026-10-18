import '../../../styles/skeleton.css';

export function SkeletonTable({ rows = 8, cols = 5 }) {
  return (
    <table className="data-table skeleton-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {[...Array(cols)].map((_, i) => (
            <th key={i} style={{ padding: '12px 8px' }}>
              <div className="skeleton skeleton-text" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...Array(rows)].map((_, r) => (
          <tr key={r}>
            {[...Array(cols)].map((_, c) => (
              <td key={c} style={{ padding: '12px 8px' }}>
                <div className="skeleton skeleton-text" />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default SkeletonTable;
