import {
  createContext,
  useContext,
  useState,
  useRef,
  useMemo,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  SidebarState,
  SidebarRefs,
  SidebarContextValue,
  SidebarProviderProps,
} from "@editor/types/sidebar";

const SidebarContext = createContext<SidebarContextValue | undefined>(
  undefined,
);

interface SidebarDock {
  element: HTMLElement | null;
  setElement: Dispatch<SetStateAction<HTMLElement | null>>;
}

const SidebarDockContext = createContext<SidebarDock | undefined>(undefined);

/**
 * The slot in the left file sidebar that bookmarks, comments and attachments
 * render into (by portal, so they keep their own React context). Null element
 * means no left panel is mounted and the panels float on the right instead.
 */
export function useSidebarDock(): SidebarDock | undefined {
  return useContext(SidebarDockContext);
}

export function SidebarProvider({ children }: SidebarProviderProps) {
  const [dockElement, setDockElement] = useState<HTMLElement | null>(null);
  const dock = useMemo(
    () => ({ element: dockElement, setElement: setDockElement }),
    [dockElement],
  );
  // All sidebar state management
  const quickAccessRef = useRef<HTMLDivElement>(null);
  const toolPanelRef = useRef<HTMLDivElement>(null);

  const [leftPanelView, setLeftPanelView] = useState<
    "toolPicker" | "toolContent"
  >("toolPicker");
  const [readerMode, setReaderMode] = useState(false);

  const sidebarState: SidebarState = useMemo(
    () => ({
      leftPanelView,
      readerMode,
    }),
    [leftPanelView, readerMode],
  );

  const sidebarRefs: SidebarRefs = useMemo(
    () => ({
      quickAccessRef,
      toolPanelRef,
    }),
    [quickAccessRef, toolPanelRef],
  );

  const contextValue: SidebarContextValue = useMemo(
    () => ({
      sidebarState,
      sidebarRefs,
      setLeftPanelView,
      setReaderMode,
    }),
    [sidebarState, sidebarRefs, setLeftPanelView, setReaderMode],
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <SidebarDockContext.Provider value={dock}>
        {children}
      </SidebarDockContext.Provider>
    </SidebarContext.Provider>
  );
}

/** For components that render outside a SidebarProvider, such as the rail's tooltips. */
export function useOptionalSidebarContext(): SidebarContextValue | undefined {
  return useContext(SidebarContext);
}

export function useSidebarContext(): SidebarContextValue {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error("useSidebarContext must be used within a SidebarProvider");
  }
  return context;
}
