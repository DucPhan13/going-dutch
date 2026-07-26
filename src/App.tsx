
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { GroupProvider } from "@/contexts/GroupContext";
import Dashboard from "@/pages/Dashboard";
import GroupDetail from "@/pages/GroupDetail";
import CreateGroup from "@/pages/CreateGroup";
import AddExpense from "@/pages/AddExpense";
import Friends from "@/pages/Friends";
import Activity from "@/pages/Activity";
import SettleUp from "@/pages/SettleUp";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <GroupProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/create-group" element={<CreateGroup />} />
            <Route path="/group/:id" element={<GroupDetail />} />
            <Route path="/group/:id/add-expense" element={<AddExpense />} />
            <Route path="/group/:id/settle-up" element={<SettleUp />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </GroupProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
