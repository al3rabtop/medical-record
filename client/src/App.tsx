import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { RequireAuth } from "./components/RequireAuth";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Laboratory from "./pages/Laboratory";
import Login from "./pages/Login";
import Radiology from "./pages/Radiology";
import PhysicianReports from "./pages/PhysicianReports";
import Pathology from "./pages/Pathology";
import Timeline from "./pages/Timeline";

function Router() {
  return (
    <Switch>
      <Route path={"/login"} component={Login} />
      <Route path={"/"}>
        <RequireAuth><Home /></RequireAuth>
      </Route>
      <Route path={"/labs"}>
        <RequireAuth><Laboratory /></RequireAuth>
      </Route>
      <Route path={"/radiology"}>
        <RequireAuth><Radiology /></RequireAuth>
      </Route>
      <Route path={"/physician-reports"}>
        <RequireAuth><PhysicianReports /></RequireAuth>
      </Route>
      <Route path={"/pathology"}>
        <RequireAuth><Pathology /></RequireAuth>
      </Route>
      <Route path={"/timeline"}>
        <RequireAuth><Timeline /></RequireAuth>
      </Route>
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
