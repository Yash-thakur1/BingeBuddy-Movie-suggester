/**
 * Intelligent Email Validation Library
 * 
 * Performs client-side email validation including:
 * - Syntax & structure checks
 * - Domain typo detection with suggestions
 * - Disposable/temporary email domain blocking
 * - Domain existence validation via DNS-over-HTTPS
 * 
 * Privacy-safe: no emails are ever sent, no external verification services used.
 */

// ============================================
// Types
// ============================================

export type EmailSeverity = 'error' | 'warning' | 'success';

export interface EmailValidationResult {
  isValid: boolean;
  severity: EmailSeverity;
  message: string;
  suggestion?: string; // e.g. "Did you mean gmail.com?"
  suggestedEmail?: string; // full corrected email
}

// ============================================
// Common domain typo map
// ============================================

const DOMAIN_TYPO_MAP: Record<string, string> = {
  // Gmail
  'gmial.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmali.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.om': 'gmail.com',
  'gmail.cmo': 'gmail.com',
  'gmail.comm': 'gmail.com',
  'gmaul.com': 'gmail.com',
  'gmailcom': 'gmail.com',
  'gmsil.com': 'gmail.com',
  'gmeil.com': 'gmail.com',
  'gemail.com': 'gmail.com',
  'gimail.com': 'gmail.com',
  'gmqil.com': 'gmail.com',
  'g]mail.com': 'gmail.com',
  // Yahoo
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yhaoo.com': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'yahoo.cm': 'yahoo.com',
  'yahoo.om': 'yahoo.com',
  'yhoo.com': 'yahoo.com',
  'yaoo.com': 'yahoo.com',
  'yahho.com': 'yahoo.com',
  'yahoo.comm': 'yahoo.com',
  // Outlook / Hotmail
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outlook.co': 'outlook.com',
  'outlook.con': 'outlook.com',
  'outllook.com': 'outlook.com',
  'otlook.com': 'outlook.com',
  'outlookcom': 'outlook.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'htmail.com': 'hotmail.com',
  'hotmil.com': 'hotmail.com',
  'hotmailcom': 'hotmail.com',
  'homail.com': 'hotmail.com',
  // iCloud
  'iclod.com': 'icloud.com',
  'icloud.co': 'icloud.com',
  'icloud.con': 'icloud.com',
  'icoud.com': 'icloud.com',
  'iclould.com': 'icloud.com',
  // ProtonMail
  'protonmal.com': 'protonmail.com',
  'protonmail.co': 'protonmail.com',
  'protonmail.con': 'protonmail.com',
  'protonmial.com': 'protonmail.com',
  // Zoho
  'zoho.co': 'zoho.com',
  'zoho.con': 'zoho.com',
  // AOL
  'aol.co': 'aol.com',
  'aol.con': 'aol.com',
  // Generic TLD typos
  '.coom': '.com',
  '.comm': '.com',
};

// ============================================
// Disposable / temporary email domains
// ============================================

const DISPOSABLE_DOMAINS = new Set([
  // Most common disposable providers
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net',
  'tempmail.com', 'temp-mail.org', 'throwaway.email',
  'trashmail.com', 'trashmail.net', 'trashmail.org',
  'yopmail.com', 'yopmail.fr', 'sharklasers.com',
  'guerrillamailblock.com', 'grr.la', 'dispostable.com',
  'mailnesia.com', 'maildrop.cc', 'discard.email',
  'fakeinbox.com', 'mailcatch.com', 'tempail.com',
  'tempr.email', 'temp-mail.io', 'mohmal.com',
  'burner.kiwi', 'tempinbox.com', 'mailtemp.info',
  '10minutemail.com', '10minutemail.net', 'minutemail.com',
  'getairmail.com', 'getnada.com', 'nada.email',
  'emailondeck.com', 'throwawaymail.com',
  'crazymailing.com', 'mytemp.email', 'tempmailaddress.com',
  'tempmailo.com', 'emailfake.com', 'generator.email',
  'harakirimail.com', 'mailsac.com', 'meltmail.com',
  'mailnull.com', 'spamgourmet.com', 'mintemail.com',
  'safetymail.info', 'inboxkitten.com', 'binkmail.com',
  'bobmail.info', 'chammy.info', 'dropmail.me',
  'mailpoof.com', 'instantemailaddress.com',
  'tmail.ws', 'tmails.net', 'tmpmail.net', 'tmpmail.org',
  'guerrillamail.de', 'guerrillamail.biz', 'mailexpire.com',
  'spam4.me', 'spambox.us', 'trashymail.com',
  'mailzilla.com', 'tempmailgen.com',
  'wegwerfmail.de', 'wegwerfmail.net',
  'trash-mail.com', 'byom.de', 'tmail.com',
]);

// ============================================
// Well-known valid domains (skip DNS check)
// ============================================

const KNOWN_VALID_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'yahoo.co.in', 'yahoo.co.uk',
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'mac.com',
  'protonmail.com', 'proton.me', 'pm.me',
  'aol.com', 'zoho.com', 'zohomail.com',
  'mail.com', 'email.com', 'usa.com',
  'gmx.com', 'gmx.net', 'gmx.de',
  'yandex.com', 'yandex.ru',
  'tutanota.com', 'tuta.io',
  'fastmail.com', 'fastmail.fm',
  'hey.com', 'duck.com',
  'rediffmail.com', 'mail.ru',
  'cox.net', 'att.net', 'sbcglobal.net', 'comcast.net',
  'verizon.net', 'charter.net', 'earthlink.net',
  // Education
  'edu', 'ac.uk', 'ac.in',
  // Common country codes
  'co.uk', 'co.in', 'com.au', 'com.br', 'ca', 'de', 'fr', 'it', 'es',
]);

// ============================================
// Levenshtein distance for fuzzy domain matching
// ============================================

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

const POPULAR_DOMAINS = [
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com',
  'icloud.com', 'protonmail.com', 'aol.com', 'zoho.com',
  'mail.com', 'yandex.com', 'live.com', 'msn.com',
  'proton.me', 'gmx.com', 'fastmail.com', 'rediffmail.com',
];

/**
 * Find the closest popular domain using Levenshtein distance
 */
function findClosestDomain(domain: string): string | null {
  let bestMatch: string | null = null;
  let bestDist = Infinity;

  for (const popular of POPULAR_DOMAINS) {
    const dist = levenshteinDistance(domain.toLowerCase(), popular);
    // Only suggest if distance is 1 or 2 (very close typo)
    if (dist > 0 && dist <= 2 && dist < bestDist) {
      bestDist = dist;
      bestMatch = popular;
    }
  }

  return bestMatch;
}

// ============================================
// DNS domain validation via DNS-over-HTTPS
// ============================================

// Cache DNS results to avoid repeated lookups
const dnsCache = new Map<string, boolean>();

/**
 * Check if a domain has MX or A records using Cloudflare DNS-over-HTTPS.
 * Privacy-safe: only the domain is queried, no email is sent.
 */
async function checkDomainExists(domain: string): Promise<boolean> {
  // Check cache first
  if (dnsCache.has(domain)) {
    return dnsCache.get(domain)!;
  }

  try {
    // Try MX records first (mail-specific)
    const mxRes = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`,
      {
        headers: { Accept: 'application/dns-json' },
        signal: AbortSignal.timeout(3000),
      }
    );

    if (mxRes.ok) {
      const mxData = await mxRes.json();
      if (mxData.Answer && mxData.Answer.length > 0) {
        dnsCache.set(domain, true);
        return true;
      }
    }

    // Fallback: check A records (domain exists but may not have MX)
    const aRes = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`,
      {
        headers: { Accept: 'application/dns-json' },
        signal: AbortSignal.timeout(3000),
      }
    );

    if (aRes.ok) {
      const aData = await aRes.json();
      const exists = !!(aData.Answer && aData.Answer.length > 0);
      dnsCache.set(domain, exists);
      return exists;
    }

    // Network error → allow (don't block signup for DNS failures)
    dnsCache.set(domain, true);
    return true;
  } catch {
    // Timeout or network error → allow
    dnsCache.set(domain, true);
    return true;
  }
}

// ============================================
// Main validation function
// ============================================

/**
 * Comprehensive email validation — returns immediately for syntax/typo checks,
 * and asynchronously for DNS domain validation.
 */
export async function validateEmail(email: string): Promise<EmailValidationResult> {
  const trimmed = email.trim().toLowerCase();

  // Empty
  if (!trimmed) {
    return { isValid: false, severity: 'error', message: '' };
  }

  // Basic structure: must have exactly one @
  const atCount = (trimmed.match(/@/g) || []).length;
  if (atCount === 0) {
    return { isValid: false, severity: 'error', message: 'Missing @ symbol' };
  }
  if (atCount > 1) {
    return { isValid: false, severity: 'error', message: 'Only one @ symbol allowed' };
  }

  const [localPart, domain] = trimmed.split('@');

  // Local part checks
  if (!localPart || localPart.length === 0) {
    return { isValid: false, severity: 'error', message: 'Missing username before @' };
  }
  if (localPart.length > 64) {
    return { isValid: false, severity: 'error', message: 'Username too long (max 64 characters)' };
  }
  if (/^\./.test(localPart) || /\.$/.test(localPart)) {
    return { isValid: false, severity: 'error', message: 'Username cannot start or end with a dot' };
  }
  if (/\.\./.test(localPart)) {
    return { isValid: false, severity: 'error', message: 'Username cannot have consecutive dots' };
  }
  if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(localPart)) {
    return { isValid: false, severity: 'error', message: 'Username contains invalid characters' };
  }

  // Domain checks
  if (!domain || domain.length === 0) {
    return { isValid: false, severity: 'error', message: 'Missing domain after @' };
  }
  if (domain.length > 253) {
    return { isValid: false, severity: 'error', message: 'Domain name too long' };
  }
  if (!domain.includes('.')) {
    return { isValid: false, severity: 'error', message: 'Domain must include a dot (e.g. gmail.com)' };
  }

  const domainParts = domain.split('.');
  const tld = domainParts[domainParts.length - 1];

  if (tld.length < 2) {
    return { isValid: false, severity: 'error', message: 'Invalid domain extension' };
  }

  // Check each domain label
  for (const label of domainParts) {
    if (!label || label.length === 0) {
      return { isValid: false, severity: 'error', message: 'Domain has empty section' };
    }
    if (label.length > 63) {
      return { isValid: false, severity: 'error', message: 'Domain section too long' };
    }
    if (!/^[a-zA-Z0-9-]+$/.test(label)) {
      return { isValid: false, severity: 'error', message: 'Domain contains invalid characters' };
    }
    if (label.startsWith('-') || label.endsWith('-')) {
      return { isValid: false, severity: 'error', message: 'Domain sections cannot start or end with a hyphen' };
    }
  }

  // Check for disposable email domains
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      isValid: false,
      severity: 'error',
      message: 'Temporary email addresses are not allowed',
    };
  }

  // Check for known typos (exact match in map)
  const typoCorrection = DOMAIN_TYPO_MAP[domain];
  if (typoCorrection) {
    const suggestedEmail = `${localPart}@${typoCorrection}`;
    return {
      isValid: false,
      severity: 'warning',
      message: `Did you mean ${typoCorrection}?`,
      suggestion: typoCorrection,
      suggestedEmail,
    };
  }

  // Fuzzy match against popular domains (Levenshtein)
  if (!KNOWN_VALID_DOMAINS.has(domain)) {
    const closest = findClosestDomain(domain);
    if (closest && closest !== domain) {
      const suggestedEmail = `${localPart}@${closest}`;
      return {
        isValid: true, // allow but warn
        severity: 'warning',
        message: `Did you mean ${closest}?`,
        suggestion: closest,
        suggestedEmail,
      };
    }
  }

  // Known valid domain → instant success
  if (KNOWN_VALID_DOMAINS.has(domain)) {
    return { isValid: true, severity: 'success', message: 'Looks good!' };
  }

  // Unknown domain → check DNS
  const domainExists = await checkDomainExists(domain);
  if (!domainExists) {
    // Try fuzzy match one more time for domains that don't exist
    const closest = findClosestDomain(domain);
    if (closest) {
      const suggestedEmail = `${localPart}@${closest}`;
      return {
        isValid: false,
        severity: 'warning',
        message: `Domain doesn't appear to exist. Did you mean ${closest}?`,
        suggestion: closest,
        suggestedEmail,
      };
    }
    return {
      isValid: false,
      severity: 'error',
      message: "This domain doesn't appear to accept email",
    };
  }

  return { isValid: true, severity: 'success', message: 'Looks good!' };
}

/**
 * Quick synchronous syntax-only check (for keystroke-level feedback).
 * Returns null if syntax is fine, or an error message string.
 */
export function quickSyntaxCheck(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return null;

  if (!trimmed.includes('@')) return 'Missing @ symbol';

  const atCount = (trimmed.match(/@/g) || []).length;
  if (atCount > 1) return 'Only one @ symbol allowed';

  const [local, domain] = trimmed.split('@');
  if (!local) return 'Missing username before @';
  if (!domain) return null; // still typing domain
  if (domain.length > 0 && !domain.includes('.')) return null; // still typing
  if (domain.endsWith('.')) return null; // still typing TLD

  return null;
}
