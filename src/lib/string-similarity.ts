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
