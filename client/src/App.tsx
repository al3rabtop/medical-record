import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ProfileProvider } from "./contexts/ProfileContext";
import Profiles from "./pages/Profiles";
import Report from "./pages/Report";
import { RequireAuth } from "./components/RequireAuth";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LocaleProvider } from "./contexts/LocaleContext";
import Home from "./pages/Home";
import Laboratory from "./pages/Laboratory";
import Login from "./pages/Login";
import Radiology from "./pages/Radiology";
import PhysicianReports from "./pages/PhysicianReports";
import Pathology from "./pages/Pathology";
import Timeline from "./pages/Timeline";
import Upload from "./pages/Upload";
import Admin from "./pages/Admin";
import Settings from "./pages/Settings";

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
      <Route path={"/settings"}>
        <RequireAuth><Settings /></RequireAuth>
      </Route>
      <Route path={"/admin"}>
        <RequireAuth><Admin /></RequireAuth>
      </Route>
      <Route path={"/upload"}>
        <RequireAuth><Upload /></RequireAuth>
      </Route>
      <Route path={"/timeline"}>
        <RequireAuth><Timeline /></RequireAuth>
      </Route>
      <Route path={"/profiles"}>
        <RequireAuth><Profiles /></RequireAuth>
      </Route>
      <Route path={"/report"}>
        <RequireAuth><Report /></RequireAuth>
      </Route>
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <LocaleProvider>
        <ThemeProvider defaultTheme="light" switchable>
          <TooltipProvider>
            <Toaster />
            <ProfileProvider>
              <Router />
            </ProfileProvider>
          </TooltipProvider>
        </ThemeProvider>
      </LocaleProvider>
    </ErrorBoundary>
  );
}

export default App;
