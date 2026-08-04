interface TabNavProps {
  tabs: string[];
  activeTab: number;
  onTabChange: (index: number) => void;
}

export default function TabNav({ tabs, activeTab, onTabChange }: TabNavProps) {
  return (
    <div className="tab-nav">
      <div className="tab-nav-list">
        {tabs.map((tab, index) => (
          <button
            key={tab}
            className={`tab-nav-item ${activeTab === index ? 'active' : ''}`}
            onClick={() => onTabChange(index)}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
}
