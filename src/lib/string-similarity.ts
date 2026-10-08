/**
 * String Similarity & Fuzzy Matching Utility for PRMS Item Reconciliation
 */

/**
 * Standardize and clean item string:
 * - Lowercase
 * - Normalize multiple whitespaces
 * - Strip supplier bracket notes like "(JTA)", "[PT ...]"
 * - Strip punctuation symbols like "#", "/", "-", etc.
 */
export function cleanItemName(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, " ") // remove parentheses and contents: (JTA), (20KG)
    .replace(/\s*\[[^\]]*\]/g, " ") // remove square brackets
    .replace(/[^\w\s]/g, " ") // replace non-alphanumeric with space
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Compute Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Levenshtein similarity score (0.0 to 1.0)
 */
export function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(a, b);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Token Overlap & Dice Coefficient
 * Compares words regardless of order (e.g. "Cat Hitam Epoxy" vs "Epoxy Cat Hitam")
 */
export function tokenDiceSimilarity(a: string, b: string): number {
  const tokensA = a.split(" ").filter(Boolean);
  const tokensB = b.split(" ").filter(Boolean);

  if (tokensA.length === 0 && tokensB.length === 0) return 1.0;
  if (tokensA.length === 0 || tokensB.length === 0) return 0.0;

  const setB = new Set(tokensB);
  let intersection = 0;

  for (const token of tokensA) {
    if (setB.has(token)) {
      intersection++;
    } else {
      // Minor typo check per word:
      // Allow distance <= 2 for words >= 4 chars (e.g. tiner vs thinner, solven vs solvent)
      let bestWordSim = 0;
      for (const tb of tokensB) {
        if (tb.length >= 3 && token.length >= 3) {
          const dist = levenshteinDistance(token, tb);
          if (dist <= 2) {
            const sim = 1 - dist / Math.max(token.length, tb.length);
            if (sim > bestWordSim) bestWordSim = sim;
          }
        }
      }
      if (bestWordSim >= 0.6) {
        intersection += Math.max(0.7, bestWordSim);
      }
    }
  }

  // Sørensen–Dice coefficient
  return (2 * intersection) / (tokensA.length + tokensB.length);
}

const INDUSTRIAL_COLORS = new Set([
  "black", "hitam", "red", "merah", "white", "putih", "blue", "biru",
  "grey", "gray", "abu", "yellow", "kuning", "green", "hijau", "silver",
  "gold", "clear", "bening", "orange", "jingga", "brown", "coklat"
]);

/**
 * Extract critical identifying features from industrial product names:
 * - Specific numbers (SKU numbers, volume numbers)
 * - Alphanumeric codes (series/part codes e.g. T-7140, CKM10013, CMP10026)
 * - Color names
 */
export function extractProductFeatures(str: string): {
  nums: Set<string>;
  codes: Set<string>;
  colors: Set<string>;
} {
  const clean = (str || "").replace(/\s*\([^)]*\)/g, " "); // remove supplier tags in parentheses like (JTA)
  const words = clean.toUpperCase().split(/[\s,;:\|\/]+/);
  const nums = new Set<string>();
  const codes = new Set<string>();
  const colors = new Set<string>();

  for (const rawWord of words) {
    const w = rawWord.replace(/^[#\-_]+|[#\-_]+$/g, "");
    if (!w) continue;
    const lower = w.toLowerCase();
    if (INDUSTRIAL_COLORS.has(lower)) {
      colors.add(lower);
    } else if (/^\d{2,}$/.test(w)) {
      nums.add(w);
    } else if (w.length >= 4 && /[A-Z]/.test(w) && /\d/.test(w)) {
      codes.add(w);
    } else if (w.includes("-") && /\d/.test(w)) {
      codes.add(w);
    }
  }
  return { nums, codes, colors };
}

/**
 * Check if two product names have irreconcilable conflicts:
 * 1. Different colors (e.g. BLACK vs RED)
 * 2. Different alphanumeric part/SKU codes (e.g. CKM10013 vs CKC10031)
 * 3. Conflicting distinct numbers (e.g. 7140 vs 801, or 10037 vs 10026)
 */
export function hasProductConflict(str1: string, str2: string): boolean {
  const f1 = extractProductFeatures(str1);
  const f2 = extractProductFeatures(str2);

  // 1. Color conflict
  const diffCol1 = [...f1.colors].filter((c) => !f2.colors.has(c));
  const diffCol2 = [...f2.colors].filter((c) => !f1.colors.has(c));
  if (diffCol1.length > 0 && diffCol2.length > 0) return true;

  // 2. Alphanumeric SKU/part code conflict (e.g. CKM10013 vs CKC10031 or T-7140 vs T-801)
  const diffCode1 = [...f1.codes].filter((c) => !f2.codes.has(c));
  const diffCode2 = [...f2.codes].filter((c) => !f1.codes.has(c));
  if (diffCode1.length > 0 && diffCode2.length > 0) return true;

  // 3. Numbers conflict (e.g. 10037 vs 10026, or 7140 vs 801)
  const diffNum1 = [...f1.nums].filter((n) => !f2.nums.has(n));
  const diffNum2 = [...f2.nums].filter((n) => !f1.nums.has(n));
  if (diffNum1.length > 0 && diffNum2.length > 0) return true;

  return false;
}

/**
 * Composite string similarity score between 0.0 and 1.0
 */
export function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;

  const raw1 = str1.trim().toLowerCase();
  const raw2 = str2.trim().toLowerCase();

  // 1. Exact raw match
  if (raw1 === raw2) return 1.0;

  // Check product code / number / color conflicts
  if (hasProductConflict(str1, str2)) {
    return 0.0;
  }

  const clean1 = cleanItemName(str1);
  const clean2 = cleanItemName(str2);

  // 2. Exact cleaned match
  if (clean1 === clean2) return 0.98;

  // 3. Substring match (one is contained in the other)
  if (clean1.length >= 4 && clean2.length >= 4) {
    if (clean1.includes(clean2) || clean2.includes(clean1)) {
      const ratio = Math.min(clean1.length, clean2.length) / Math.max(clean1.length, clean2.length);
      return Math.max(0.85, 0.75 + ratio * 0.2);
    }
  }

  // 4. Token-based word overlap
  const tokenScore = tokenDiceSimilarity(clean1, clean2);

  // 5. Full string Levenshtein
  const levScore = levenshteinSimilarity(clean1, clean2);

  // Weighted composite score (Token score gives higher weight for multi-word industrial item names)
  const composite = tokenScore * 0.7 + levScore * 0.3;

  return Math.min(1.0, Math.round(composite * 100) / 100);
}

export type MatchResult<T> = {
  candidate: T;
  score: number;
  matchType: "EXACT" | "FUZZY";
};

/**
 * Find the best candidate from a list for a given target string
 */
export function findBestMatch<T>(
  target: string,
  candidates: T[],
  getName: (c: T) => string,
  threshold = 0.78
): MatchResult<T> | null {
  if (!target || candidates.length === 0) return null;

  const targetClean = cleanItemName(target);
  let bestMatch: T | null = null;
  let bestScore = 0;

  // First pass: Check for exact cleaned match
  for (const c of candidates) {
    const cName = getName(c);
    if (target.trim().toLowerCase() === cName.trim().toLowerCase()) {
      return { candidate: c, score: 1.0, matchType: "EXACT" };
    }
    if (cleanItemName(cName) === targetClean) {
      return { candidate: c, score: 0.98, matchType: "EXACT" };
    }
  }

  // Second pass: Calculate similarity scores
  for (const c of candidates) {
    const cName = getName(c);
    const score = calculateSimilarity(target, cName);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = c;
    }
  }

  if (bestMatch && bestScore >= threshold) {
    return {
      candidate: bestMatch,
      score: bestScore,
      matchType: bestScore >= 0.95 ? "EXACT" : "FUZZY",
    };
  }

  return null;
}

/**
 * Specialized Paint & Chemical Signature Types
 */
export type PaintSignature = {
  brand: "ORIGIN" | "NIPPON" | null;
  category: "THINNER" | "HARDENER" | "CLEAR" | "PRIMER" | "PAINT_KILLER" | "PAINT";
  isWashing: boolean;
  isPrimer: boolean;
  family: string | null;
  subType: string | null;
  colorCodes: Set<string>;
  catalogNums: Set<string>;
  specificNums: Set<string>;
  modelAcronyms: Set<string>;
  colors: Set<string>;
};

const PAINT_COLORS = new Set([
  "BLACK", "HITAM", "RED", "MERAH", "WHITE", "PUTIH", "BLUE", "BIRU",
  "GREY", "GRAY", "ABU", "YELLOW", "KUNING", "GREEN", "HIJAU", "SILVER",
  "BROWN", "COKLAT", "DARK", "CLEAR", "BENING"
]);

function cleanWords(str: string): string[] {
  return str
    .toUpperCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Extract structured chemical/paint identity features:
 * - Brand (Origin vs Nippon Paint)
 * - Category (Thinner, Hardener, Clear, Primer, Paint Killer, Paint)
 * - Resin Family (R-160, R-241, OPZ, Polyhard, etc.)
 * - Subtype (HS, MB, TG, CB)
 * - Exact alphanumeric color codes (NH-731P, NH-904M, NH-902, YR-656, R-575, G-546, 11SV41, ZBC, G01)
 * - 4-5 digit catalog numbers (10031, 10037, 10705, 56036, 18008)
 * - Specific thinner & product serial numbers (T-7140, T-801, T-2260, #260, #210, WW-28C, K-780)
 * - Model acronyms (CKC, CKM, CKY, CMX, CSU, CSW, CMP, CMU, 11BKxx, AC)
 * - Color descriptors (Black, Red, Yellow, Grey, Silver)
 */
export function extractPaintSignature(raw: string): PaintSignature {
  // Brand detection BEFORE stripping parentheses
  let brand: PaintSignature["brand"] = null;
  if (/\b(ORIGIN|ORIGIPLATE|OPZ|ECONET|PLANET)\b/i.test(raw)) brand = "ORIGIN";
  else if (/\b(R[\-\s]?(?:160|241|261|290|301|255|271)|NIPPON|POLYHARD)/i.test(raw)) brand = "NIPPON";

  const s = raw.toUpperCase().replace(/\s*\([^)]*\)/g, " ").replace(/\s*\[[^\]]*\]/g, " ");

  // 1. Category & functional qualifiers
  let category: PaintSignature["category"] = "PAINT";
  const isWashing = /\b(WASHING|WASH|CUCI)\b/.test(s);
  const isPrimer = /\b(PRIMER|EPOXY)\b/.test(s);

  if (/\b(THINNER|TINER)\b/.test(s)) category = "THINNER";
  else if (/\b(HARDENER|HARDNER|KATALIS)\b/.test(s)) category = "HARDENER";
  else if (/\b(CLEAR|VERNIS)\b/.test(s)) category = "CLEAR";
  else if (isPrimer) category = "PRIMER";
  else if (/\b(PAINT\s*KILL|PAINT\s*KILLER)\b/.test(s)) category = "PAINT_KILLER";

  // 2. Base model family: R160, R241, R261, R290, R301, OPZ, POLYHARD, PIKANET, ECONET, PLANET, PLANITTO
  let family: string | null = null;
  const mFam = s.match(/\b(R[\-\.\s]?(?:160|241|261|290|301|255|271)|OPZ|ORIGIPLATE\s*Z|POLYHARD|POLIHARD|PIKANET|ECONET|PLANET|PLANITTO)/);
  if (mFam) {
    const rawFam = mFam[1].replace(/[\-\.\s]/g, "");
    if (rawFam.startsWith("ORIGIPLATE")) family = "OPZ";
    else if (rawFam.startsWith("POLIHARD")) family = "POLYHARD";
    else family = rawFam;
  }
  if (!family && brand === "ORIGIN") {
    family = "OPZ";
  }

  // 3. SubType
  let subType: string | null = null;
  if (/\bHS\b/.test(s)) subType = "HS";
  else if (/\bMB\b/.test(s)) subType = "MB";
  else if (/\bTG\b/.test(s)) subType = "TG";
  else if (/\bCB\b/.test(s)) subType = "CB";

  // 4. Color codes: NH-731P, NH-904M, NH-902, NH-788, NH-797M, NH-830, YR-656, YR-642M, R-575, G-546, D66T, 11SV41, ZBC, G01
  const colorCodes = new Set<string>();
  const colorMatches = s.matchAll(/\b(NH|YR|G|R|B|Y|BG|RP)[\s\-\.]*(\d{2,3}[A-Z]*)\b/g);
  for (const cm of colorMatches) {
    if (cm[1] === "R" && ["160", "241", "261", "290", "301", "255", "271"].some((f) => cm[2].startsWith(f))) {
      continue;
    }
    colorCodes.add(`${cm[1]}${cm[2]}`.replace(/[\s\-\.]/g, ""));
  }
  if (/\b11SV41\b/.test(s)) colorCodes.add("11SV41");
  if (/\bD66T\b/.test(s)) colorCodes.add("D66T");
  if (/\bZBC\b/.test(s)) colorCodes.add("ZBC");
  if (/\bG[\-\s]?01\b/.test(s)) colorCodes.add("G01");

  // 5. Catalog numbers: 4-5 digits (e.g. 10031, 10037, 10705, 56036, 18008)
  const catalogNums = new Set<string>();
  const catMatches = s.matchAll(/\b(\d{4,5})\b/g);
  for (const cm of catMatches) {
    catalogNums.add(cm[1]);
  }

  // 6. Specific Thinner or Product Numbers (e.g. T-7140, T-801, T-2260, #260, #210, WW-28C, K-780)
  const specificNums = new Set<string>();
  const thinMatches = s.matchAll(/\bT[\s\-\.]*(\d{3,4})\b/g);
  for (const tm of thinMatches) specificNums.add(tm[1]);

  const hashMatches = s.matchAll(/#\s*P?(\d{2,4})\b/g);
  for (const hm of hashMatches) specificNums.add(hm[1]);

  const kMatches = s.matchAll(/\bK[\s\-\.]*(\d{3})\b/g);
  for (const km of kMatches) specificNums.add(km[1]);

  const wwMatches = s.matchAll(/\bWW[\s\-\.]*(\d{2,3}[A-Z]?)\b/g);
  for (const wm of wwMatches) specificNums.add(wm[1]);

  // 7. Model acronyms (CKC, CKM, CKY, CMX, CSU, CSW, CMP, CMU, 11BKxx, AC)
  const modelAcronyms = new Set<string>();
  const acrMatches = s.matchAll(/\b(C[KMPSU][A-Z]|11BK\d{2}|AC)\b/g);
  for (const am of acrMatches) modelAcronyms.add(am[1]);

  // 8. Basic Color words
  const colors = new Set<string>();
  const words = cleanWords(s);
  for (const w of words) {
    if (PAINT_COLORS.has(w)) colors.add(w);
  }

  return {
    brand,
    category,
    isWashing,
    isPrimer,
    family,
    subType,
    colorCodes,
    catalogNums,
    specificNums,
    modelAcronyms,
    colors,
  };
}

/**
 * Strict industrial paint matcher. Enforces positive matching rules and strict rejections:
 * - Brand mismatch (Origin vs Nippon) -> 0%
 * - Category mismatch (Thinner vs Paint vs Hardener) -> 0%
 * - Washing solvent vs Primer thinner mismatch -> 0%
 * - Resin family mismatch (R-160 vs R-241 vs OPZ) -> 0%
 * - Distinct thinner numbers mismatch (T-2260 vs T-7140) -> 0%
 * - Color code conflict (G-546 vs NH-902, NH-788 vs NH-902, YR-642M vs NH-902) -> 0%
 * - Catalog numbers mismatch (10085 vs 10031) -> 0%
 * - Model acronym conflict (CKY vs CMX) -> 0%
 * - Contradictory colors (Yellow vs Black) -> 0%
 */
export function matchPaintItem(
  namePainting: string,
  namePRMS: string
): { isMatch: boolean; score: number; reason: string } {
  if (!namePainting || !namePRMS) {
    return { isMatch: false, score: 0, reason: "Nama item kosong" };
  }

  const sig1 = extractPaintSignature(namePainting);
  const sig2 = extractPaintSignature(namePRMS);

  // RULE 0: Brand Mismatch (Origin vs Nippon)
  if (sig1.brand && sig2.brand && sig1.brand !== sig2.brand) {
    return { isMatch: false, score: 0, reason: `Beda Brand: ${sig1.brand} vs ${sig2.brand}` };
  }

  // RULE 1: Category Mismatch
  if (sig1.category === "THINNER" && sig2.category !== "THINNER") return { isMatch: false, score: 0, reason: "Kategori Beda" };
  if (sig2.category === "THINNER" && sig1.category !== "THINNER") return { isMatch: false, score: 0, reason: "Kategori Beda" };
  if (sig1.category === "HARDENER" && sig2.category !== "HARDENER") return { isMatch: false, score: 0, reason: "Kategori Beda" };
  if (sig2.category === "HARDENER" && sig1.category !== "HARDENER") return { isMatch: false, score: 0, reason: "Kategori Beda" };

  // RULE 1b: Washing vs Primer Thinner
  if (sig1.isWashing !== sig2.isWashing) {
    return { isMatch: false, score: 0, reason: "Washing vs Non-Washing" };
  }
  if (sig1.isPrimer !== sig2.isPrimer && (sig1.category === "THINNER" || sig2.category === "THINNER")) {
    return { isMatch: false, score: 0, reason: "Primer Thinner vs Other" };
  }

  // RULE 2: Family Mismatch
  if (sig1.family && sig2.family && sig1.family !== sig2.family) {
    return { isMatch: false, score: 0, reason: `Beda Family: ${sig1.family} vs ${sig2.family}` };
  }

  // RULE 3: Thinner/Specific Number Mismatch
  if (sig1.specificNums.size > 0 && sig2.specificNums.size > 0) {
    const hasOverlap = [...sig1.specificNums].some((n) => sig2.specificNums.has(n));
    if (!hasOverlap) return { isMatch: false, score: 0, reason: "Beda Nomor Thinner" };
  }

  // RULE 4: Color Code Conflict
  if (sig1.colorCodes.size > 0 && sig2.colorCodes.size > 0) {
    const hasOverlap = [...sig1.colorCodes].some((c1) =>
      [...sig2.colorCodes].some((c2) => c1 === c2 || (c1.length >= 4 && c2.length >= 4 && (c1.startsWith(c2) || c2.startsWith(c1))))
    );
    if (!hasOverlap) return { isMatch: false, score: 0, reason: "Beda Kode Warna" };
  }
  if (sig1.colorCodes.size > 0 && sig2.colorCodes.size === 0) {
    const raw2Clean = namePRMS.toUpperCase().replace(/[\-\.\s]/g, "");
    const found = [...sig1.colorCodes].some((c) => raw2Clean.includes(c));
    if (!found) return { isMatch: false, score: 0, reason: "Kode warna tidak ditemukan di PRMS" };
  }
  if (sig2.colorCodes.size > 0 && sig1.colorCodes.size === 0) {
    const raw1Clean = namePainting.toUpperCase().replace(/[\-\.\s]/g, "");
    const found = [...sig2.colorCodes].some((c) => raw1Clean.includes(c));
    if (!found) return { isMatch: false, score: 0, reason: "Kode warna tidak ditemukan di Painting" };
  }

  // RULE 5: Catalog Number Conflict (4-5 digits)
  if (sig1.catalogNums.size > 0 && sig2.catalogNums.size > 0) {
    const hasOverlap = [...sig1.catalogNums].some((n) => sig2.catalogNums.has(n));
    if (!hasOverlap) return { isMatch: false, score: 0, reason: "Beda Nomor Katalog" };
  }
  if (sig1.catalogNums.size > 0 && sig2.catalogNums.size === 0) {
    const raw2 = namePRMS.toUpperCase();
    const hasNum = [...sig1.catalogNums].some((n) => raw2.includes(n));
    if (!hasNum) return { isMatch: false, score: 0, reason: "Nomor katalog tidak ditemukan di PRMS" };
  }

  // RULE 6: Model Acronym Conflict (e.g. CKY vs CMX)
  if (sig1.modelAcronyms.size > 0 && sig2.modelAcronyms.size > 0) {
    const hasOverlap = [...sig1.modelAcronyms].some((a) => sig2.modelAcronyms.has(a));
    if (!hasOverlap) return { isMatch: false, score: 0, reason: "Beda Model Acronym" };
  }

  // RULE 7: Color Name Conflict (e.g. Yellow vs Black)
  if (sig1.colors.size > 0 && sig2.colors.size > 0) {
    const sharedColors = [...sig1.colors].filter((c) => sig2.colors.has(c));
    if (sharedColors.length === 0) {
      const diff1 = [...sig1.colors];
      const diff2 = [...sig2.colors];
      if (
        diff1.some((c) => ["YELLOW", "RED", "BLUE", "GREEN"].includes(c)) &&
        diff2.some((c) => ["BLACK", "WHITE", "GREY"].includes(c))
      ) {
        return { isMatch: false, score: 0, reason: "Beda Warna: " + diff1.join(",") + " vs " + diff2.join(",") };
      }
    }
  }

  // POSITIVE MATCH SCORING
  let score = 0;
  const sharedColors = [...sig1.colorCodes].filter((c1) =>
    [...sig2.colorCodes].some((c2) => c1 === c2 || (c1.startsWith(c2) || c2.startsWith(c1)))
  );
  const sharedCats = [...sig1.catalogNums].filter((n) => sig2.catalogNums.has(n));
  const sharedNums = [...sig1.specificNums].filter((n) => sig2.specificNums.has(n));

  if (sharedColors.length > 0) {
    score = 95;
    if (sig1.subType === sig2.subType) score = 100;
  } else if (sharedCats.length > 0) {
    score = 95;
    if (sig1.modelAcronyms.size > 0 && sig2.modelAcronyms.size > 0) {
      const hasAcr = [...sig1.modelAcronyms].some((a) => sig2.modelAcronyms.has(a));
      if (hasAcr) score = 100;
    }
  } else if (sharedNums.length > 0) {
    score = 95;
  } else {
    const w1 = cleanWords(namePainting);
    const w2 = cleanWords(namePRMS);
    const set2 = new Set(w2);
    let matchWords = 0;
    for (const w of w1) {
      if (set2.has(w)) matchWords++;
    }
    const dice = (2 * matchWords) / (w1.length + w2.length);
    score = Math.round(dice * 100);
  }

  return { isMatch: score >= 70, score, reason: "OK" };
}

/**
 * Intelligent similarity scoring specially tuned for paint and chemical items
 */
export function calculatePaintSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  const res = matchPaintItem(str1, str2);
  return res.score / 100;
}
