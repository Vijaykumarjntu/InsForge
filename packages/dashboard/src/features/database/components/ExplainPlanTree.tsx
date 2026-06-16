import React from 'react';

interface ExplainNodeProps {
  node: any;
}

/**
 * Recursive React node explorer that digs through the Postgres Plan graph tree 
 * to surface costs, row counts, and scan types out to the frontend surface view.
 */
export const ExplainPlanNode: React.FC<ExplainNodeProps> = ({ node }) => {
  if (!node) return null;

  const nodeType = node['Node Type'] || 'Unknown Action';
  const totalCost = node['Total Cost'] || 0;
  const planRows = node['Plan Rows'] || 0;
  const actualTime = node['Actual Total Time'] || 0;
  const actualRows = node['Actual Rows'] || 0;

  // Highlight sequential scans prominently to simplify debugging
  const isWarningNode = nodeType === 'Seq Scan';

  return (
    <div style={{ marginLeft: 20, marginTop: 10, fontFamily: 'monospace' }}>
      <div style={{ 
        padding: '10px', 
        borderLeft: isWarningNode ? '3px solid #f59e0b' : '3px solid #10b981',
        backgroundColor: '#111827',
        borderRadius: '0 4px 4px 0',
        color: '#f3f4f6',
        maxWidth: '600px'
      }}>
        <strong style={{ color: isWarningNode ? '#f59e0b' : '#34d399' }}>➔ {nodeType}</strong>
        <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: 4 }}>
          Cost: {totalCost} | Est. Rows: {planRows} | Actual Time: {actualTime}ms | Actual Rows: {actualRows}
        </div>
      </div>
      
      {/* Recursively crawl nested node plans down through the join trees */}
      {node['Plans'] && node['Plans'].map((subNode: any, idx: number) => (
        <ExplainPlanNode key={idx} node={subNode} />
      ))}
    </div>
  );
};

interface ExplainPlanTreeProps {
  explainData: {
    success: boolean;
    error?: string;
    rawPlan?: any;
    metrics?: { executionTimeMs: number };
  };
}

export const ExplainPlanTree: React.FC<ExplainPlanTreeProps> = ({ explainData }) => {
  if (!explainData.success) {
    return (
      <div style={{ padding: 16, backgroundColor: '#7f1d1d', color: '#fca5a5', borderRadius: 6, fontFamily: 'monospace' }}>
        ⚠️ Error Analysing Query: {explainData.error}
      </div>
    );
  }

  const rootPlan = Array.isArray(explainData.rawPlan) 
    ? explainData.rawPlan[0]?.['Plan'] 
    : explainData.rawPlan?.['Plan'];

  const totalTime = explainData.metrics?.executionTimeMs || 0;

  return (
    <div style={{ padding: '16px', backgroundColor: '#030712', borderRadius: '8px' }}>
      <div style={{ color: '#9ca3af', fontWeight: 'bold', borderBottom: '1px solid #374151', paddingBottom: 8, marginBottom: 12 }}>
        ⏱️ Total execution time: <span style={{ color: '#10b981' }}>{totalTime}ms</span>
      </div>
      <ExplainPlanNode node={rootPlan} />
    </div>
  );
};