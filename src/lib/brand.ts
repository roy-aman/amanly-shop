/* ===================================================================
   Amanly — brand constants

   The single place brand-level copy lives, so a wording change is one edit
   rather than a grep. Product/category copy is data and stays in the API;
   this file is only for the things the brand itself asserts.

   Note the store's *displayed* name still comes from `getPublicStore().name`
   (an operator can rename it in admin settings) — `BRAND_NAME` is the
   fallback and the mark, not the source of truth for the store name.
   =================================================================== */

export const BRAND_NAME = 'Amanly';

/** The primary tagline. Short, declarative, and a claim about curation —
 *  which is the exact perception the brand needs to earn. */
export const BRAND_TAGLINE = 'Fewer things, better made.';

/** Supporting line for meta descriptions, footers and auth chrome. */
export const BRAND_DESCRIPTION = 'Considered essentials for men.';
