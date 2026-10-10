import type { Component } from 'svelte';

export interface DropdownOption {
  value: string;
  label: string;
  /** Small label after the name, e.g. "Default". */
  badge?: string;
  /** A brand logo (single-colour SVG path in a 24x24 box). */
  brand?: { path: string; hex: string };
  /** Or a multi-colour logo file. */
  img?: string;
  /** Or a Phosphor icon component. */
  icon?: Component<{ size?: number | string; weight?: 'regular' | 'fill' | 'bold' }>;
}
