import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import OverviewPage from "@/pages/OverviewPage";
import TargetsPage from "@/pages/TargetsPage";
import TargetDetailPage from "@/pages/TargetDetailPage";
import AlertsPage from "@/pages/AlertsPage";
import ConfigPage from "@/pages/ConfigPage";

function App() {
  return (
    <BrowserRouter>
      <DashboardLayout>
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/targets" element={<TargetsPage />} />
          <Route path="/targets/:targetId" element={<TargetDetailPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/config" element={<ConfigPage />} />
        </Routes>
      </DashboardLayout>
    </BrowserRouter>
  );
}

export default App;
