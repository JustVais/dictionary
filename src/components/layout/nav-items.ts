import { BookOpen, Layers, Search, BarChart3, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/vocabulary", label: "Vocabulary", icon: BookOpen },
  { href: "/cards", label: "Cards", icon: Layers },
  { href: "/translate", label: "Translate", icon: Search },
  { href: "/stats", label: "Stats", icon: BarChart3 },
];
