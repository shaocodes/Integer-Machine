import { useState } from 'react'
import './App.css'
import TabNav from './components/TabNav'
import ConversionTab from './components/ConversionTab'
import MultiplicationTab from './components/MultiplicationTab'
import DivisionTab from './components/DivisionTab'

const TABS = ['Conversion', 'Multiplication', 'Division']

function App() {
  const [activeTab, setActiveTab] = useState(0)

  return (
    <div className="app">
      <header className="app-header">
        <h1>Integer Machine</h1>
      </header>

      <TabNav
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="tab-content">
        {activeTab === 0 && (
          <div className="tab-panel" key="conversion">
            <ConversionTab />
          </div>
        )}
        {activeTab === 1 && (
          <div className="tab-panel" key="multiplication">
            <MultiplicationTab />
          </div>
        )}
        {activeTab === 2 && (
          <div className="tab-panel" key="division">
            <DivisionTab />
          </div>
        )}
      </div>
    </div>
  )
}

export default App
