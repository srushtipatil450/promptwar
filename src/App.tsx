import React, { Suspense, lazy } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AppShell } from './components/layout/AppShell';
import { LabLinkProvider, useLabLink } from './context/LabLinkContext';
import { AchievementsView } from './views/AchievementsView';
import { AlternativeFinderView } from './views/AlternativeFinderView';
import { CompatibilityGraphView } from './views/CompatibilityGraphView';
import { CrossDeptSharingView } from './views/CrossDeptSharingView';
import { EquipmentExplorerView } from './views/EquipmentExplorerView';
import { EquipmentHealthView } from './views/EquipmentHealthView';
import { EquipmentTrackingView } from './views/EquipmentTrackingView';
import { FairAccessView } from './views/FairAccessView';
import { FeasibilityCheckerView } from './views/FeasibilityCheckerView';
import { IdleResourcesView } from './views/IdleResourcesView';
import { LabMapView } from './views/LabMapView';
import { LabPassportView } from './views/LabPassportView';
import { LiveLabPulseView } from './views/LiveLabPulseView';
import { MyBookingsView } from './views/MyBookingsView';
import { NotificationsView } from './views/NotificationsView';
import { OverviewView } from './views/OverviewView';
import { PredictiveAvailabilityView } from './views/PredictiveAvailabilityView';
import { ProjectJourneyPlannerView } from './views/ProjectJourneyPlannerView';
import { ProjectMatcherView } from './views/ProjectMatcherView';
import { ResourceRescueView } from './views/ResourceRescueView';
import { SafetyReadinessView } from './views/SafetyReadinessView';
import { SettingsView } from './views/SettingsView';
import { SmartSchedulingView } from './views/SmartSchedulingView';
import { WaitingListView } from './views/WaitingListView';

const LazyDigitalLabTwinView = lazy(() =>
  import('./views/DigitalLabTwinView').then((mod) => ({ default: mod.DigitalLabTwinView }))
);

const renderActiveView = (activeView: string) => {
  switch (activeView) {
    case 'overview':
      return <OverviewView />;
    case 'live-pulse':
      return <LiveLabPulseView />;
    case 'project-matcher':
      return <ProjectMatcherView />;
    case 'journey-planner':
      return <ProjectJourneyPlannerView />;
    case 'equipment-explorer':
      return <EquipmentExplorerView />;
    case 'digital-twin':
      return (
        <Suspense
          fallback={
            <div className="flex h-64 items-center justify-center rounded-2xl border border-[#E6EAF0] bg-white text-xs text-[#718096]">
              Loading Interactive Digital Laboratory Twin...
            </div>
          }
        >
          <LazyDigitalLabTwinView />
        </Suspense>
      );
    case 'alternative-finder':
      return <AlternativeFinderView />;
    case 'resource-rescue':
      return <ResourceRescueView />;
    case 'lab-map':
      return <LabMapView />;
    case 'compatibility-graph':
      return <CompatibilityGraphView />;
    case 'feasibility-checker':
      return <FeasibilityCheckerView />;
    case 'my-bookings':
      return <MyBookingsView />;
    case 'smart-scheduling':
      return <SmartSchedulingView />;
    case 'cross-dept-sharing':
      return <CrossDeptSharingView />;
    case 'waiting-list':
      return <WaitingListView />;
    case 'predictive-availability':
      return <PredictiveAvailabilityView />;
    case 'idle-resources':
      return <IdleResourcesView />;
    case 'equipment-tracking':
      return <EquipmentTrackingView />;
    case 'equipment-health':
      return <EquipmentHealthView />;
    case 'lab-passport':
      return <LabPassportView />;
    case 'safety-readiness':
      return <SafetyReadinessView />;
    case 'fair-access':
      return <FairAccessView />;
    case 'achievements':
      return <AchievementsView />;
    case 'notifications':
      return <NotificationsView />;
    case 'settings':
      return <SettingsView />;
    default:
      return <OverviewView />;
  }
};

const ViewRouter: React.FC = () => {
  const { activeView } = useLabLink();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeView}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      >
        {renderActiveView(activeView)}
      </motion.div>
    </AnimatePresence>
  );
};

export default function App() {
  return (
    <LabLinkProvider>
      <AppShell>
        <ViewRouter />
      </AppShell>
    </LabLinkProvider>
  );
}
