import { useEffect, useRef, useState } from 'react';

interface TabNavProps {
  tabs: string[];
  activeTab: number;
  onTabChange: (index: number) => void;
}

export default function TabNav({ tabs, activeTab, onTabChange }: TabNavProps) {
  const [indicatorLeft, setIndicatorLeft] = useState(0);
  const [indicatorWidth, setIndicatorWidth] = useState(0);
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const currentTab = tabsRef.current[activeTab];
    if (currentTab) {
      setIndicatorLeft(currentTab.offsetLeft);
      setIndicatorWidth(currentTab.offsetWidth);
    }
  }, [activeTab]);

  return (
    <div className="tab-nav">
      <div className="tab-nav-list" style={{ position: 'relative' }}>
        {tabs.map((tab, index) => (
          <button
            key={tab}
            ref={(el) => {
              tabsRef.current[index] = el;
            }}
            className={`tab-nav-item ${activeTab === index ? 'active' : ''}`}
            onClick={() => onTabChange(index)}
          >
            {tab}
          </button>
        ))}
        <div
          className="tab-nav-indicator"
          style={{
            position: 'absolute',
            left: `${indicatorLeft}px`,
            width: `${indicatorWidth}px`
          }}
        />
      </div>
    </div>
  );
}
