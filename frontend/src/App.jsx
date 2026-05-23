import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import LiveMonitor from './pages/LiveMonitor';
import Dashboard from './pages/Dashboard';
import Heatmap from './pages/Heatmap';
import Settings from './pages/Settings';
import DigitalTwin from './pages/DigitalTwin';
import FatigueMonitor from './pages/FatigueMonitor';
import ShiftReport from './pages/ShiftReport';

function App() {
  const [activeTab, setActiveTab] = useState('live');
  const [selectedZone, setSelectedZone] = useState(null);

  const renderContent = () => {
    switch (activeTab) {
      case 'live':     return <LiveMonitor selectedZone={selectedZone} onZoneSelect={setSelectedZone} />;
      case 'dashboard': return <Dashboard selectedZone={selectedZone} onZoneSelect={(z) => setSelectedZone(z)} />;
      case 'heatmap':  return <Heatmap selectedZone={selectedZone} onZoneSelect={setSelectedZone} />;
      case 'twin':     return <DigitalTwin />;
      case 'fatigue':  return <FatigueMonitor />;
      case 'report':   return <ShiftReport />;
      case 'settings': return <Settings />;
      default:         return <LiveMonitor selectedZone={selectedZone} onZoneSelect={setSelectedZone} />;
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-background text-slate-200 overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 h-full overflow-hidden pb-16 md:pb-0">
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
