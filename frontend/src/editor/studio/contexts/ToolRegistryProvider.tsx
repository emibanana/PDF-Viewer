import { useMemo } from "react";

import type { ToolId } from "@editor/types/toolId";
import type { ToolRegistry } from "@editor/data/toolsTaxonomy";
import ToolRegistryContext, { ToolRegistryCatalog } from "@editor/contexts/ToolRegistryContext";
import { useTranslatedToolCatalog } from "@editor/data/useTranslatedToolRegistry";
import { omitHiddenTools } from "@editor/config/toolAvailability";

interface ToolRegistryProviderProps {
  children: React.ReactNode;
}

/**
 * PDF Viewer's tool registry: the core catalog minus every tool that needs the
 * Java backend (see config/toolAvailability.ts). Filtering here, the single
 * place the registry is built, removes a tool from the menu, search, Automate
 * and deep links at once.
 */
export const ToolRegistryProvider: React.FC<ToolRegistryProviderProps> = ({ children }) => {
  const catalog = useTranslatedToolCatalog();

  const contextValue = useMemo<ToolRegistryCatalog>(() => {
    const regularTools = omitHiddenTools(catalog.regularTools);
    const superTools = omitHiddenTools(catalog.superTools);
    const linkTools = omitHiddenTools(catalog.linkTools);
    const allTools: ToolRegistry = {
      ...regularTools,
      ...superTools,
      ...linkTools,
    };

    const getToolById = (toolId: ToolId | null) => {
      if (!toolId) {
        return null;
      }
      return allTools[toolId] ?? null;
    };

    return { regularTools, superTools, linkTools, allTools, getToolById };
  }, [catalog]);

  return <ToolRegistryContext.Provider value={contextValue}>{children}</ToolRegistryContext.Provider>;
};
