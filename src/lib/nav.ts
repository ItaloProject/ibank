import type { LucideIcon } from "lucide-react";
import {
  Home,
  CreditCard,
  TrendingUp,
  BarChart2,
  CalendarDays,
  CalendarCheck,
  Repeat2,
  Receipt,
  Target,
  Landmark,
  LineChart,
  Scale,
  PlayCircle,
  Settings,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Só no mobile: aparece no bottom nav (além de Início). */
  bottomTab?: boolean;
};

export type NavGroup = {
  id: string;
  label: string;
  /** Destaque visual (Investimentos). */
  accent?: boolean;
  items: NavItem[];
};

/**
 * Fonte única da navegação do app (sidebar, Mais, Configurações).
 * Ordem = hierarquia de uso no dia a dia.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "inicio",
    label: "Início",
    items: [{ href: "/", label: "Dashboard", icon: Home }],
  },
  {
    id: "financas",
    label: "Finanças",
    items: [
      { href: "/cartao", label: "Cartão", icon: CreditCard, bottomTab: true },
      { href: "/planejamento", label: "Planejamento", icon: CalendarDays, bottomTab: true },
      { href: "/entrada-saida", label: "Entrada/Saída", icon: Repeat2 },
      { href: "/parcelamentos", label: "Parcelamentos", icon: Receipt },
      { href: "/relatorios", label: "Relatórios", icon: BarChart2 },
    ],
  },
  {
    id: "investimentos",
    label: "Investimentos",
    accent: true,
    items: [
      { href: "/investimentos", label: "Investimentos", icon: TrendingUp, bottomTab: true },
      { href: "/rentabilidade", label: "Rentabilidade", icon: LineChart },
      { href: "/rebalancear", label: "Rebalancear", icon: Scale },
      { href: "/proventos", label: "Proventos", icon: CalendarCheck },
      { href: "/impostos", label: "Imposto de Renda", icon: Landmark },
      { href: "/metas", label: "Metas", icon: Target },
    ],
  },
  {
    id: "aprenda",
    label: "Aprenda",
    items: [{ href: "/videos", label: "Vídeos", icon: PlayCircle }],
  },
];

/** Rotas que o usuário não pode ocultar. */
export const ALWAYS_VISIBLE_HREFS = new Set([
  "/",
  "/configuracoes",
  "/investimentos",
]);

export const SYSTEM_NAV_ITEMS: NavItem[] = [
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export function flattenNavItems(groups: NavGroup[] = NAV_GROUPS): NavItem[] {
  return groups.flatMap((g) => g.items);
}

export function getHideableNavItems(): (NavItem & { group: string })[] {
  return NAV_GROUPS.flatMap((g) =>
    g.items
      .filter((item) => !ALWAYS_VISIBLE_HREFS.has(item.href))
      .map((item) => ({ ...item, group: g.label }))
  );
}

export function getBottomTabs(): NavItem[] {
  const home = NAV_GROUPS.find((g) => g.id === "inicio")?.items[0];
  const tabs = flattenNavItems().filter((i) => i.bottomTab);
  return home ? [home, ...tabs] : tabs;
}

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export const HIDDEN_PAGES_KEY = "ibank_hidden_pages";

export function readHiddenPages(): Set<string> {
  try {
    const saved = localStorage.getItem(HIDDEN_PAGES_KEY);
    return new Set(saved ? JSON.parse(saved) : []);
  } catch {
    return new Set();
  }
}

export function isPageVisible(href: string, hidden: Set<string>): boolean {
  return ALWAYS_VISIBLE_HREFS.has(href) || !hidden.has(href);
}
