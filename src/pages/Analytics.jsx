import React from 'react';
import { Activity, BrainCircuit } from 'lucide-react';
import { useData } from '../context/DataContext';

const Analytics = () => {
  const { products } = useData();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics & ML Insights</h1>
          <p className="page-subtitle">Dive deep into temperature data and model predictions</p>
        </div>
      </div>

      <div className="grid-2 mb-lg stagger-children">
        <section className="glass-card flex flex-col items-center justify-center text-center" style={{ minHeight: '300px' }}>
          <BrainCircuit size={48} className="text-accent mb-md opacity-50" />
          <h3 style={{ fontSize: 'var(--font-xl)', fontWeight: '600', marginBottom: '8px' }}>Model Insights</h3>
          <p className="text-muted" style={{ maxWidth: '400px' }}>
            The ML model is analyzing 10 unique features in real-time including temperature history, breach counts, and product category to predict food safety scores.
          </p>
        </section>

        <section className="glass-card">
          <div className="section-header">
            <h2 className="section-title">Safety Distribution</h2>
          </div>
          <div className="flex flex-col gap-md">
            {['Safe', 'Caution', 'Unsafe'].map((status) => {
              const count = products.filter(p => p.riskLevel === status).length;
              const percentage = products.length ? (count / products.length) * 100 : 0;
              const colorVar = status === 'Safe' ? 'var(--safe)' : status === 'Caution' ? 'var(--caution)' : 'var(--danger)';
              
              return (
                <div key={status}>
                  <div className="flex justify-between text-sm mb-xs">
                    <span>{status}</span>
                    <span className="text-muted">{count} items ({percentage.toFixed(0)}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${percentage}%`, height: '100%', background: colorVar, transition: 'width 1s ease-in-out' }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      
      <div className="glass-card stagger-children">
         <div className="section-header">
            <h2 className="section-title">Feature Importance Analysis</h2>
         </div>
         <p className="text-muted mb-md">How different inputs are currently weighing on the model's safety predictions across all products.</p>
         
         <div className="table-container">
           <table>
             <thead>
               <tr>
                 <th>Feature</th>
                 <th>Description</th>
                 <th>Avg Impact</th>
               </tr>
             </thead>
             <tbody>
               <tr>
                 <td>time_above_threshold</td>
                 <td>Cumulative minutes above safe temp</td>
                 <td><span className="text-danger">- High</span></td>
               </tr>
               <tr>
                 <td>max_temp_1h</td>
                 <td>Maximum temp spike in last hour</td>
                 <td><span className="text-caution">- Medium</span></td>
               </tr>
               <tr>
                 <td>breach_count_24h</td>
                 <td>Number of separate threshold crosses</td>
                 <td><span className="text-caution">- Medium</span></td>
               </tr>
               <tr>
                 <td>storage_duration</td>
                 <td>Total hours product has been stored</td>
                 <td><span className="text-muted">- Low</span></td>
               </tr>
             </tbody>
           </table>
         </div>
      </div>
    </div>
  );
};

export default Analytics;
