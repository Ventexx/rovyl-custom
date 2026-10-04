import { AppItem, UIConfig, Workspace } from "./types";

/** Historical demo IDs are retained only to migrate old profiles to real installed apps. */
const BUNDLED_DEMO_APP_IDS: ReadonlySet<string> = new Set([
  "1a7a5818-4c99-4e4f-8a4d-3e28d4d7f5d7",
  "2b8b6818-5d99-4e4f-8a4d-3e28d4d7f5d8",
  "3c9c7818-6e99-4e4f-8a4d-3e28d4d7f5d9",
  "4da08818-7f99-4e4f-8a4d-3e28d4d7f5da",
  "5eb19818-8099-4e4f-8a4d-3e28d4d7f5db",
  "6fc2a818-9199-4e4f-8a4d-3e28d4d7f5dc",
  "70d3b818-a299-4e4f-8a4d-3e28d4d7f5dd",
  "81e4c818-b399-4e4f-8a4d-3e28d4d7f5de",
  "a306e818-d599-4e4f-8a4d-3e28d4d7f5e0",
  "antigravity-default",
  "cursor-default"
]);

export function workspaceContainsBundledDemoApp(workspace: Workspace): boolean {
  const scan = (items: AppItem[]): boolean => {
    for (const a of items) {
      if (a.id && BUNDLED_DEMO_APP_IDS.has(a.id)) return true;
      if (a.children?.length && scan(a.children)) return true;
    }
    return false;
  };
  return scan(workspace.apps);
}

/**
 * Main workspace before Start Menu discovery: vazio — nunca a roda de demonstração completa
 * (evita apps errados no primeiro paint / no disco). Era aqui que viviam os widgets internos.
 */
export const MINIMAL_MAIN_WORKSPACE_APPS: AppItem[] = [];

// Default Workspaces
export const DEFAULT_WORKSPACES: Workspace[] = [
  {
    id: "workspace-1",
    name: "Main",
    hotkey: 1,
    enabled: true,
    apps: MINIMAL_MAIN_WORKSPACE_APPS,
    color: "#3B82F6", // Blue
    /** Sem isto todos os workspaces entram na roda com o mesmo `Layers` e só se distinguem pelo nome. */
    pickerIconName: "Home",
  },
];

export const DEFAULT_UI_CONFIG: UIConfig = {
  accentColor: "#FFFFFF",
  radialHoverColor: "#FFFFFF",
  menuRadius: 140,
  iconSize: 64,
  fixedPosition: true,
  backdropOpacity: 0.2,
  menuOpacity: 0.8,
  menuBackgroundStyle: "circle",
  appSpacing: 10, // Default spacing between apps
  activationThreshold: 60,
  centerButton: {
    type: "none",
    target: "",
    label: "",
    iconName: "Circle",
  },
  showLabels: true,
  alwaysShowAppLabels: false,
  showLocationLabel: true,
  showBattery: false,
  clockPosition: "top-center",
  gameMode: {
    enabled: false,
    mode: "list",
    blockedApps: "",
    autoDetectGames: false,
  },
  globalShortcut: "Alt+Z",
  workspaces: DEFAULT_WORKSPACES,
  activeWorkspaceIndex: 0,
  workspaceSwitchMode: 'picker',
  appearanceTheme: 'black',
  radialSelectionMode: 'angle',
  enableMouseTrigger: false,
  mouseTriggerMode: 'click',
  mouseTriggerButton: 'middle',
  language: "en",
  performanceMode: false,
  mainStartMenuDiscoveryDone: false,
};

/**
 * Configs antigos guardaram atalhos `internal:*` (Notas / Alarme / Cronómetro / Pomodoro).
 * Esses widgets já não existem: sem esta limpeza na hidratação o radial mostraria ícones mortos.
 */
export function stripInternalWidgetApps(items: AppItem[]): AppItem[] {
  const out: AppItem[] = [];
  for (const a of items) {
    if (typeof a.command === "string" && a.command.startsWith("internal:")) continue;
    out.push(a.children?.length ? { ...a, children: stripInternalWidgetApps(a.children) } : a);
  }
  return out;
}

/** Aplica `stripInternalWidgetApps` a todos os workspaces e ao botão central. */
export function stripInternalWidgetsFromConfig(config: UIConfig): UIConfig {
  const workspaces = config.workspaces?.map((ws) => ({
    ...ws,
    apps: stripInternalWidgetApps(ws.apps ?? []),
  }));
  const center = config.centerButton;
  const centerIsInternal =
    typeof center?.target === "string" && center.target.startsWith("internal:");
  return {
    ...config,
    workspaces: workspaces ?? config.workspaces,
    centerButton: centerIsInternal
      ? { type: "none", target: "", label: "", iconName: "Circle" }
      : center,
  };
}
