import { Link } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="noise-overlay" aria-hidden="true" />
      <div className="relative z-0 text-center animate-fade-in">
        <h1 className="text-7xl font-bold mb-4 text-foreground tracking-tight">404</h1>
        <p className="text-lg mb-8 text-muted-foreground">Page not found</p>
        <Link to="/">
          <Button className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2 active:scale-[0.98]">
            <ArrowLeft className="w-4 h-4" />
            Return home
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
