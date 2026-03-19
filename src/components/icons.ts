/**
 * Inline SVG icons — 16×16, stroke-based, consistent weight.
 * Used across section labels, buttons, and action sheet options.
 */

const ATTRS = 'width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

/** Player on field — running figure */
export const iconField = `<svg ${ATTRS}><circle cx="12" cy="5" r="2"/><path d="M7 21l3-7 2 2 4-6"/><path d="M17 21l-2-6"/></svg>`;

/** Bench — pause/seat */
export const iconBench = `<svg ${ATTRS}><rect x="4" y="10" width="16" height="4" rx="1"/><path d="M6 14v4"/><path d="M18 14v4"/></svg>`;

/** Unavailable — circle with line */
export const iconUnavailable = `<svg ${ATTRS}><circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/></svg>`;

/** Swap / substitution arrows */
export const iconSub = `<svg ${ATTRS}><path d="M16 3l4 4-4 4"/><path d="M20 7H4"/><path d="M8 21l-4-4 4-4"/><path d="M4 17h16"/></svg>`;

/** Clock / late */
export const iconLate = `<svg ${ATTRS}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`;

/** Injury / medical cross */
export const iconInjured = `<svg ${ATTRS}><path d="M8 2h8v6h6v8h-6v6H8v-6H2v-8h6z"/></svg>`;

/** Check / arrived */
export const iconArrived = `<svg ${ATTRS}><path d="M20 6L9 17l-5-5"/></svg>`;

/** Leaving / door exit */
export const iconLeaving = `<svg ${ATTRS}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;

/** Reset / undo circle */
export const iconReset = `<svg ${ATTRS}><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`;

/** Forward / next game */
export const iconNext = `<svg ${ATTRS}><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>`;

/** End / finish (checkmark) */
export const iconEnd = `<svg ${ATTRS}><path d="M20 6L9 17l-5-5"/></svg>`;

/** Settings / gear */
export const iconSettings = `<svg ${ATTRS}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`;

/** Users / squad */
export const iconSquad = `<svg ${ATTRS}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`;

/** Generate / play button */
export const iconGenerate = `<svg ${ATTRS}><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
