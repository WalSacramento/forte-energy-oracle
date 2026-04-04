import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden relative z-10">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <main
          className="flex-1 overflow-y-auto p-6"
          style={{ background: "var(--bg-base)" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
