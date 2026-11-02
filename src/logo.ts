import { makeLogo } from './geometry';

const LOGO = makeLogo();

// ---------- logo defs (ported from the design) ----------
export function logoDefs(): string {
  const L = LOGO;
  return `<defs>
<linearGradient id="nlClean" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"></stop><stop offset="1" stop-color="#F1EEE8"></stop></linearGradient>
<linearGradient id="nlDust" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#D8D2C8"></stop><stop offset="1" stop-color="#C2BAAD"></stop></linearGradient>
<linearGradient id="nlRim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".95"></stop><stop offset=".5" stop-color="#FFFFFF" stop-opacity="0"></stop><stop offset="1" stop-color="#6B6256" stop-opacity=".35"></stop></linearGradient>
<linearGradient id="nlGloss" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"></stop><stop offset=".45" stop-color="#FFFFFF" stop-opacity=".7"></stop><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"></stop></linearGradient>
<linearGradient id="nBlade" gradientUnits="userSpaceOnUse" x1="${L.gx1}" y1="${L.gy1}" x2="${L.gx2}" y2="${L.gy2}"><stop offset="0" stop-color="#7EA0FF"></stop><stop offset=".35" stop-color="#3D68F2"></stop><stop offset="1" stop-color="#1D3AB0"></stop></linearGradient>
<clipPath id="nClip"><path d="${L.sq}"></path></clipPath>
<filter id="nSoft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.2"></feGaussianBlur></filter>
<mask id="nMask" maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256"><rect width="256" height="256" fill="#FFFFFF"></rect><path d="${L.sector}" fill="#000000" filter="url(#nSoft)"></path></mask>
<filter id="nGrain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" stitchTiles="stitch"></feTurbulence><feColorMatrix type="saturate" values="0"></feColorMatrix></filter>
<filter id="nShadow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5"></feGaussianBlur></filter>
<filter id="nDrop" x="-20%" y="-20%" width="140%" height="160%"><feGaussianBlur stdDeviation="7"></feGaussianBlur></filter>
<symbol id="lgIcon" viewBox="0 0 256 256" overflow="visible">
<path d="${L.sq}" fill="#000000" opacity=".28" transform="translate(0 7)" filter="url(#nDrop)"></path>
<path d="${L.sq}" fill="url(#nlClean)"></path>
<g clip-path="url(#nClip)">
<path d="${L.sector}" fill="url(#nlGloss)"></path>
<path d="${L.streaks}" fill="none" stroke="#FFFFFF" stroke-opacity=".9" stroke-width="1.4" stroke-dasharray="34 9 58 12 22 7 46 10" stroke-linecap="round"></path>
<path d="${L.streaks}" fill="none" stroke="#000000" stroke-opacity=".05" stroke-width="1" stroke-dasharray="34 9 58 12 22 7 46 10" stroke-linecap="round" transform="translate(0 1.5)"></path>
<g mask="url(#nMask)"><rect width="256" height="256" fill="url(#nlDust)"></rect><rect width="256" height="256" filter="url(#nGrain)" opacity=".16"></rect><path d="${L.dotsS}" fill="#8C8478" opacity=".55"></path><path d="${L.dotsB}" fill="#8C8478" opacity=".8"></path></g>
<path d="${L.pile}" fill="#8C8478" opacity=".9"></path>
<path d="${L.blade}" stroke="#000000" stroke-opacity=".35" stroke-width="20" stroke-linecap="round" transform="translate(7 9)" filter="url(#nShadow)"></path>
<path d="${L.blade}" stroke="url(#nBlade)" stroke-width="20" stroke-linecap="round"></path>
<path d="${L.rubber}" stroke="#0E1840" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"></path>
<path d="${L.spec}" stroke="#FFFFFF" stroke-opacity=".75" stroke-width="3" stroke-linecap="round"></path>
</g>
<path d="${L.sqIn}" fill="none" stroke="url(#nlRim)" stroke-width="3"></path>
</symbol>
<linearGradient id="ndClean" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1E1F23"></stop><stop offset="1" stop-color="#141518"></stop></linearGradient>
<linearGradient id="ndDust" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#43464C"></stop><stop offset="1" stop-color="#30333A"></stop></linearGradient>
<linearGradient id="ndRim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".35"></stop><stop offset=".5" stop-color="#FFFFFF" stop-opacity="0"></stop><stop offset="1" stop-color="#000000" stop-opacity=".6"></stop></linearGradient>
<linearGradient id="ndGloss" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".1"></stop><stop offset=".45" stop-color="#FFFFFF" stop-opacity=".16"></stop><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"></stop></linearGradient>
<symbol id="lgIconDark" viewBox="0 0 256 256" overflow="visible">
<path d="${L.sq}" fill="#000000" opacity=".55" transform="translate(0 7)" filter="url(#nDrop)"></path>
<path d="${L.sq}" fill="url(#ndClean)"></path>
<g clip-path="url(#nClip)">
<path d="${L.sector}" fill="url(#ndGloss)"></path>
<path d="${L.streaks}" fill="none" stroke="#FFFFFF" stroke-opacity=".07" stroke-width="1.4" stroke-dasharray="34 9 58 12 22 7 46 10" stroke-linecap="round"></path>
<g mask="url(#nMask)"><rect width="256" height="256" fill="url(#ndDust)"></rect><rect width="256" height="256" filter="url(#nGrain)" opacity=".1"></rect><path d="${L.dotsS}" fill="#8A8F98" opacity=".55"></path><path d="${L.dotsB}" fill="#8A8F98" opacity=".8"></path></g>
<path d="${L.pile}" fill="#8A8F98" opacity=".9"></path>
<path d="${L.blade}" stroke="#000000" stroke-opacity=".6" stroke-width="20" stroke-linecap="round" transform="translate(7 9)" filter="url(#nShadow)"></path>
<path d="${L.blade}" stroke="url(#nBlade)" stroke-width="20" stroke-linecap="round"></path>
<path d="${L.rubber}" stroke="#0E1840" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"></path>
<path d="${L.spec}" stroke="#FFFFFF" stroke-opacity=".75" stroke-width="3" stroke-linecap="round"></path>
</g>
<path d="${L.sqIn}" fill="none" stroke="url(#ndRim)" stroke-width="3"></path>
</symbol>
<symbol id="lgIconS" viewBox="0 0 256 256" overflow="visible">
<path d="${L.sq}" fill="#000000" opacity=".22" transform="translate(0 6)" filter="url(#nDrop)"></path>
<path d="${L.sq}" fill="url(#nlDust)"></path>
<g clip-path="url(#nClip)"><path d="${L.sector}" fill="url(#nlClean)"></path><path d="${L.blade}" stroke="url(#nBlade)" stroke-width="28" stroke-linecap="round"></path></g>
<path d="${L.sqIn}" fill="none" stroke="url(#nlRim)" stroke-width="6"></path>
</symbol>
<symbol id="lgIconSDark" viewBox="0 0 256 256" overflow="visible">
<path d="${L.sq}" fill="#000000" opacity=".5" transform="translate(0 6)" filter="url(#nDrop)"></path>
<path d="${L.sq}" fill="url(#ndDust)"></path>
<g clip-path="url(#nClip)"><path d="${L.sector}" fill="url(#ndClean)"></path><path d="${L.blade}" stroke="url(#nBlade)" stroke-width="28" stroke-linecap="round"></path></g>
<path d="${L.sqIn}" fill="none" stroke="url(#ndRim)" stroke-width="6"></path>
</symbol>
</defs>`;
}

// Standalone tile for icon export. small = simplified mark for 32 px and below.
export function logoSvg(dark: boolean, small: boolean, size = 256): string {
  const id = (small ? 'lgIconS' : 'lgIcon') + (dark ? 'Dark' : '');
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}" viewBox="0 0 256 256">${logoDefs()}<use href="#${id}" xlink:href="#${id}" width="256" height="256"/></svg>`;
}
