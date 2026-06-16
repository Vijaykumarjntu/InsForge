import { useMemo, useState, useRef, useEffect } from 'react';
import { useRawSQL } from '#features/database/hooks/useRawSQL';
import { useSQLEditorContext } from '#features/database/contexts/SQLEditorContext';
import { Button, Tabs, Tab } from '@insforge/ui';
import { CodeEditor, DataGrid, type DataGridColumn, type DataGridRow } from '#components';
import { X, Plus } from 'lucide-react';
import { cn } from '#lib/utils/utils';
import { ExplainPlanTree } from '../components/ExplainPlanTree';
import { apiClient } from '#lib/api/client';

interface ResultsViewerProps {
  data: unknown;
}

// Helper to detect if data is an array of row objects
function isRowData(data: unknown): data is Record<string, unknown>[] {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    typeof data[0] === 'object' &&
    data[0] !== null &&
    !Array.isArray(data[0])
  );
}

// Convert SQL result rows to DataGrid format
function convertRowsToDataGridFormat(rows: Record<string, unknown>[]) {
  // Add synthetic id field if rows don't have one - ensure id is always a string
  const dataWithIds: DataGridRow[] = rows.map((row, index) => ({
    ...row,
    id: String(row.id || `row-${index}`),
  }));

  // Get all column keys from first row
  const columnKeys = Object.keys(rows[0]);

  // Create simple columns that render values as plain strings
  const columns: DataGridColumn<DataGridRow>[] = columnKeys.map((key) => ({
    key,
    name: key.charAt(0).toUpperCase() + key.slice(1),
    width: 'minmax(200px, 1fr)',
    resizable: true,
    sortable: true,
    editable: false,
  }));

  return { columns, data: dataWithIds };
}

function RawViewer({ data }: ResultsViewerProps) {
  const jsonString = JSON.stringify(data, null, 2);
  const lines = jsonString.split('\n');

  return (
    <div className="bg-[var(--alpha-4)] rounded-lg p-3 overflow-auto">
      <pre className="font-mono text-sm text-foreground leading-5 m-0">
        {lines.map((line, index) => (
          <div key={index} className="min-h-[1.25rem]">
            {line || <span>&nbsp;</span>}
          </div>
        ))}
      </pre>
    </div>
  );
}

function ResultsViewer({ data }: ResultsViewerProps) {
  const isTable = isRowData(data);

  const gridData = useMemo(() => {
    if (isTable && data.length > 0) {
      return convertRowsToDataGridFormat(data);
    }
    return null;
  }, [isTable, data]);

  if (isTable && gridData) {
    return (
      <DataGrid
        data={gridData.data}
        columns={gridData.columns}
        showSelection={false}
        showPagination={false}
        noPadding={true}
        className="h-full"
      />
    );
  }

  // Fallback to raw JSON if data isn't table-shaped
  return <RawViewer data={data} />;
}

interface ErrorViewerProps {
  error: Error;
}

function ErrorViewer({ error }: ErrorViewerProps) {
  return (
    <div className="bg-[var(--alpha-4)] rounded-lg p-3 overflow-auto">
      <pre className="font-mono text-sm text-destructive leading-5 m-0 whitespace-pre-wrap">
        {error.message}
      </pre>
    </div>
  );
}
export default function SQLEditorPage() {
  const {
    tabs,
    activeTab,
    activeTabId,
    addTab,
    removeTab,
    setActiveTab,
    updateTabQuery,
    updateTabName,
  } = useSQLEditorContext();

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState('');
  const [resultView, setResultView] = useState<'result' | 'table' | 'explain'>('result');
  const inputRef = useRef<HTMLInputElement>(null);

  // Existing Raw SQL hook for results/table tabs
  const { executeSQL, isPending, data, isSuccess, error, isError } = useRawSQL({
    showSuccessToast: true,
    showErrorToast: false,
  });

  // 🛠️ NEW EXPLAIN STATE HOOKS: Fully isolates the performance visualizer telemetry
  const [explainData, setExplainData] = useState<{
    success: boolean;
    error?: string;
    rawPlan?: any;
    metrics?: any;
  } | null>(null);
  const [isExplainPending, setIsExplainPending] = useState(false);

  useEffect(() => {
    if (editingTabId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingTabId]);

  // Unified execution router handling logic cleanly
  // const handleExecuteQuery = async () => {
  //   if (!activeTab?.query.trim() || isPending || isExplainPending) {
  //     return;
  //   }

  //   // If user is currently looking at the Explain tab, run the safe route instead!
  //   if (resultView === 'explain') {
  //     setIsExplainPending(true);
  //     setExplainData(null);
  //     try {
  //       const response = await fetch('/api/database/advance/explain', {
  //         method: 'POST',
  //         // headers: { 'Content-Type': 'application/json' },
  //         headers: apiClient.withAccessToken({
  //                 'Content-Type': 'application/json',
  //               }),
  //         body: JSON.stringify({ query: activeTab.query }),
  //       });
  //       const resJson = await response.json();
        
  //       if (resJson.success && resJson.data) {
  //         setExplainData({
  //           success: true,
  //           rawPlan: resJson.data.rawPlan,
  //           metrics: resJson.data.metrics
  //         });
  //       } else {
  //         setExplainData({
  //           success: false,
  //           error: resJson.error || 'Failed to parse execution plan tree structure.'
  //         });
  //       }
  //     } catch (err: any) {
  //       setExplainData({
  //         success: false,
  //         error: err.message || 'Network error encountered during plan calculation.'
  //       });
  //     } finally {
  //       setIsExplainPending(false);
  //     }
  //   } else {
  //     // Run normal raw data processing routine
  //     executeSQL({ query: activeTab.query, params: [] });
  //   }
  // };

  // Unified execution router handling logic cleanly
  const handleExecuteQuery = async () => {
    if (!activeTab?.query.trim() || isPending || isExplainPending) {
      return;
    }

    // If user is currently looking at the Explain tab, use the working ApiClient!
    if (resultView === 'explain') {
      setIsExplainPending(true);
      setExplainData(null);
      try {
        // 🎯 USE THE ACTIVE CLIENT INSTANCE DIRECTLY:
        // Automatically manages your JWT state, content-types, timeouts, and refresh flows!
        const resJson = await apiClient.request('/database/advance/explain', {
          method: 'POST',
          body: JSON.stringify({ query: activeTab.query }),
        });
        
        // ApiClient automatically parses JSON and returns the raw unnested body response
        if (resJson && resJson.success && resJson.data) {
          setExplainData({
            success: true,
            rawPlan: resJson.data.rawPlan,
            metrics: resJson.data.metrics
          });
        } else if (resJson && resJson.data) {
          // Fallback if success is true but object structures are flat
          setExplainData({
            success: true,
            rawPlan: resJson.data.rawPlan,
            metrics: resJson.data.metrics
          });
        } else {
          setExplainData({
            success: false,
            error: resJson?.error || 'Failed to parse execution plan tree structure.'
          });
        }
      } catch (err: any) {
        setExplainData({
          success: false,
          error: err.message || 'Network error encountered during plan calculation.'
        });
      } finally {
        setIsExplainPending(false);
      }
    } else {
      // Run normal raw data processing routine
      executeSQL({ query: activeTab.query, params: [] });
    }
  };

  // Automatically trigger an explanation generation if they toggle the tab after running a query
  useEffect(() => {
    if (resultView === 'explain' && activeTab?.query.trim() && !explainData && !isExplainPending) {
      handleExecuteQuery();
    }
  }, [resultView]);

  // 🛠️ Core text synchronization handler for the SQL Editor
  const handleQueryChange = (newQuery: string) => {
    if (activeTabId) {
      updateTabQuery(activeTabId, newQuery);
    }
  };

  const handleTabNameDoubleClick = (tabId: string, currentName: string) => {
    setEditingTabId(tabId);
    setEditingTabName(currentName);
  };

  const handleTabNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingTabName(e.target.value);
  };

  const handleTabNameBlur = () => {
    if (editingTabId && editingTabName.trim()) {
      updateTabName(editingTabId, editingTabName.trim());
    }
    setEditingTabId(null);
    setEditingTabName('');
  };

  const handleTabNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTabNameBlur();
    } else if (e.key === 'Escape') {
      setEditingTabId(null);
      setEditingTabName('');
    }
  };

  // Automatically trigger an explanation generation if they toggle the tab after running a query
  useEffect(() => {
    if (resultView === 'explain' && activeTab?.query.trim() && !explainData && !isExplainPending) {
      handleExecuteQuery();
    }
  }, [resultView]);

  // ... keep your exact handleQueryChange and naming handler methods untouched ...

  return (
    <div className="flex flex-col h-full bg-[rgb(var(--semantic-1))] overflow-hidden">
      {/* File management row blocks remain completely unchanged */}
      
      {/* ... (Keep your top navbar layout structure matching your exact implementation) ... */}

      {/* Main Content Workspace */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 w-full bg-[rgb(var(--semantic-0))] overflow-hidden">
          <CodeEditor
            editable
            language="sql"
            value={activeTab?.query || ''}
            onChange={handleQueryChange}
            placeholder="SELECT * from products LIMIT 10;"
          />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Action Navigation Header */}
          <div className="flex px-4 py-3 justify-between items-center shrink-0 border-t border-b border-[var(--alpha-8)] bg-[rgb(var(--semantic-0))]">
            <Tabs value={resultView} onValueChange={(val: any) => setResultView(val)}>
              <div className="flex gap-2">
                <Tab value="result">Result</Tab>
                <Tab value="table">Table View</Tab>
                <Tab value="explain">Explain Plan</Tab>
              </div>
            </Tabs>

            <Button 
              onClick={handleExecuteQuery} 
              disabled={isPending || isExplainPending || !activeTab?.query.trim()}
            >
              {isPending || isExplainPending ? 'Running...' : 'Run'}
            </Button>
          </div>

          {/* Dynamic View Panel Terminal */}
          <div className={cn('flex-1 min-h-0 w-full overflow-auto bg-[rgb(var(--semantic-0))]', resultView === 'result' && 'px-4 py-3')}>
            {resultView === 'explain' ? (
              <div className="p-4 bg-background h-full overflow-auto">
                {isExplainPending ? (
                  <p className="font-mono text-sm leading-5 text-foreground">Analyzing query execution path telemetry...</p>
                ) : explainData ? (
                  <ExplainPlanTree explainData={explainData} />
                ) : (
                  <p className="font-mono text-sm leading-5 text-foreground">Click Run to generate transaction-isolated execution plan tree diagram.</p>
                )}
              </div>
            ) : isError && error ? (
              <div className={resultView !== 'result' ? 'px-4 py-3' : ''}>
                <ErrorViewer error={error} />
              </div>
            ) : isSuccess && data ? (
              resultView === 'result' ? (
                <RawViewer data={data.rows || data} />
              ) : (
                <ResultsViewer data={data.rows || data} />
              )
            ) : (
              <p className={cn('font-mono text-sm leading-5 text-foreground', resultView !== 'result' && 'px-4 py-3')}>
                {isPending ? 'Executing query...' : 'Click Run to execute your query'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}