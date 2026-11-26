import { useTranslation } from "react-i18next";
import { Tooltip } from "@editor/components/shared/Tooltip";
import { Icon } from "@editor/ui/Icon";
import type { QuickNavAccountMenu, QuickNavIdentity } from "@editor/contexts/QuickNavHostContext";
import "@editor/components/shared/quickNav/QuickNavRailAccount.css";

export interface QuickNavRailAccountProps {
  /** Opens the settings page on its first section. */
  onOpenSettings: () => void;
  /** Kept for the shared container's props; this build has no account menu. */
  onOpenShortcut: (to: string) => void;
  resolveMenu?: () => QuickNavAccountMenu | undefined;
  identity: QuickNavIdentity | null;
  /** Drawn as the current destination while the settings page is open. */
  active?: boolean;
}

/**
 * PDF Viewer is local-only: there is no account, sign-in or sign-out. Where
 * core shows an avatar with an account menu, this build shows a Settings button.
 */
export function QuickNavRailAccount({ onOpenSettings, active = false }: QuickNavRailAccountProps) {
  const { t } = useTranslation();
  const label = t("quickNav.accountMenu.settings", "Settings");

  return (
    <div className="quick-nav-rail-account" data-active={active || undefined}>
      <Tooltip content={label} position="right" arrow>
        {/* A span, not the button: Tooltip binds by cloning its child. */}
        <span className="quick-nav-rail-avatar-target" data-testid="config-button" data-tour="config-button">
          <button
            type="button"
            className="quick-nav-rail-avatar"
            aria-label={label}
            aria-current={active ? "page" : undefined}
            onClick={onOpenSettings}
          >
            <span aria-hidden className="quick-nav-rail-avatar__disc">
              <Icon name="settings" size="1.25rem" />
            </span>
          </button>
        </span>
      </Tooltip>
    </div>
  );
}
