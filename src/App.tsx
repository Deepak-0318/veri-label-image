import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Annotate from "./pages/Annotate";
import Auth from "./pages/Auth";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Settings from "./pages/Settings";

import Data from "./pages/Data";
import Tasks from "./pages/Tasks";
import PipelineBuilder from "./pages/PipelineBuilder";
import PipelineRuns from "./pages/PipelineRuns";
import PerformTask from "./pages/PerformTask";
import Exports from "./pages/Exports";
import Team from "./pages/Team";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
    <ThemeProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
          <Route path="/projects/:projectId" element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
          <Route path="/annotate/:fileId" element={<ProtectedRoute><Annotate /></ProtectedRoute>} />
          <Route path="/annotate/:projectId/:fileId" element={<ProtectedRoute><Annotate /></ProtectedRoute>} />
          <Route path="/data" element={<ProtectedRoute><Data /></ProtectedRoute>} />
          <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
          <Route path="/tasks/:taskId/perform" element={<ProtectedRoute><PerformTask /></ProtectedRoute>} />
          <Route path="/pipelines" element={<ProtectedRoute><PipelineBuilder /></ProtectedRoute>} />
          <Route path="/pipeline-runs" element={<ProtectedRoute><PipelineRuns /></ProtectedRoute>} />
          
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/exports" element={<ProtectedRoute><Exports /></ProtectedRoute>} />
          <Route path="/team" element={<ProtectedRoute><Team /></ProtectedRoute>} />
          <Route path="/auth" element={<Auth />} />
          {/* Legacy redirects */}
          <Route path="/files" element={<ProtectedRoute><Data /></ProtectedRoute>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
