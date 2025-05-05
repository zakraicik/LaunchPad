import Navbar from "./Navbar";
import Footer from "./Footer";
import AnimatedBackground from "./AnimatedBackground";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <>
      <AnimatedBackground />
      <div className="relative min-h-screen flex flex-col z-1">
        <Navbar />
        <main className="flex-grow bg-gradient-to-b from-blue-50/10 to-white/10">
          {children}
        </main>
        <Footer />
      </div>
    </>
  );
}
