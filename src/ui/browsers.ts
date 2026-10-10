import BrowserIcon from 'phosphor-svelte/lib/BrowserIcon';
import { siBrave, siFirefox, siGooglechrome, siLibrewolf, siOpera, siVivaldi } from 'simple-icons';
import chromiumLogo from '../assets/browsers/chromium.svg';
import edgeLogo from '../assets/browsers/edge.svg';
import type { DropdownOption } from './dropdown';

type Brand = { path: string; hex: string };
const brand = (i: Brand): Brand => ({ path: i.path, hex: `#${i.hex}` });

/** Name and logo of each browser the Rust side can read. Edge (SVG Logos, CC0) and Chromium (theSVG, MIT) are not in Simple Icons, so their logos are files. */
const META: Record<string, Pick<DropdownOption, 'label' | 'brand' | 'img' | 'icon'>> = {
  firefox: { label: 'Firefox', brand: brand(siFirefox) },
  chrome: { label: 'Google Chrome', brand: brand(siGooglechrome) },
  edge: { label: 'Microsoft Edge', img: edgeLogo },
  brave: { label: 'Brave', brand: brand(siBrave) },
  chromium: { label: 'Chromium', img: chromiumLogo },
  vivaldi: { label: 'Vivaldi', brand: brand(siVivaldi) },
  opera: { label: 'Opera', brand: brand(siOpera) },
  librewolf: { label: 'LibreWolf', brand: brand(siLibrewolf) },
};

export function browserOption(name: string, isDefault: boolean): DropdownOption {
  const m = META[name] ?? { label: name, icon: BrowserIcon };
  return { value: name, ...m, ...(isDefault ? { badge: 'Default' } : {}) };
}
