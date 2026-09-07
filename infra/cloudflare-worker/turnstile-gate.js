/**
 * Cloudflare Worker: full-site Turnstile gate for kayasthaparivar.com.
 *
 * The site is a static export served by GitHub Pages, which has no server
 * of its own and therefore cannot verify anything. This Worker sits in
 * front of the zone (bound to a route covering the whole domain) and does
 * the actual gating:
 *
 *   - No valid signed session cookie?  Serve an interstitial page with a
 *     Cloudflare Turnstile widget instead of the real site.
 *   - Widget solved?  The form POSTs here, we verify the token server-side
 *     against Cloudflare's siteverify API (this is the part a client-JS-only
 *     gate can't do — the secret key never reaches the browser), then set
 *     a cookie and redirect back to the page the visitor actually wanted.
 *   - Valid cookie present?  Pass the request straight through to the real
 *     GitHub Pages origin.
 *
 * The cookie is HMAC-signed (see the SESSION_SECRET binding and signValue()
 * below) rather than a static marker value. This repo is public, so the
 * cookie *name* is not a secret — if the value were just a fixed string like
 * "1", anyone reading this file could set that cookie by hand and skip the
 * challenge forever. Signing it with a server-only secret means a valid
 * cookie can only come from this Worker after a real siteverify success.
 *
 * ---------------------------------------------------------------------
 * Why `resolveOverride` alone is not enough, and what we do instead:
 * ---------------------------------------------------------------------
 * A naive `fetch(request)` (or even `fetch(request, { cf: { resolveOverride:
 * "kayasthaparivar.github.io" } } )`) to pass a verified request through to
 * origin will loop forever: this Worker's route is bound to
 * `kayasthaparivar.com/*` (and `www.*`), and `resolveOverride` is documented
 * to only take effect when BOTH the request's URL host and the override
 * host are within the *same Cloudflare zone*. `kayasthaparivar.github.io`
 * is a different zone entirely (GitHub's), so Cloudflare ignores the
 * override, the subrequest goes out to `kayasthaparivar.com` again exactly
 * as before, the zone's own route matches again, and this Worker runs again
 * — infinite recursion (Cloudflare caps same-zone worker-to-worker chains
 * and will eventually hard-fail the request, but it's still broken).
 *
 * The documented fix: create an extra DNS record *inside this zone* that
 * points at the external origin, and resolve against THAT instead. This
 * repo's Terraform (infra/terraform/turnstile.tf) creates exactly that:
 *
 *   origin.kayasthaparivar.com   CNAME -> kayasthaparivar.github.io   (DNS only / grey-clouded)
 *
 * Because that record is unproxied and is not itself covered by the
 * `kayasthaparivar.com/*` worker route, resolving against it never
 * re-enters this Worker. We fetch the *original* request URL (so the
 * `Host: kayasthaparivar.com` header GitHub Pages needs to pick the right
 * repo is preserved) but override DNS resolution to that in-zone CNAME:
 *
 *   fetch(request, { cf: { resolveOverride: "origin.kayasthaparivar.com" } })
 *
 * That's the line to look at if this ever needs revisiting.
 */

const COOKIE_NAME = "cf_turnstile_verified";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24; // 1 day
const VERIFY_PATH = "/__turnstile-verify";
const TURNSTILE_SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// The cookie value is `<issuedAtSeconds>.<hex-hmac-sha256>`, signed with
// SESSION_SECRET. This is NOT optional decoration: this Worker's source is
// in a public repo, so anyone can read COOKIE_NAME and see that a naive
// "cookie present == verified" check would let them just send
// `Cookie: cf_turnstile_verified=1` forever and skip Turnstile entirely. The
// HMAC means a valid cookie value can only be produced by someone who knows
// SESSION_SECRET (i.e. this Worker, after a real siteverify success) — the
// timestamp is part of the signed payload so a captured cookie can't be
// replayed past COOKIE_MAX_AGE_SECONDS either.

// In-zone DNS record created by infra/terraform/turnstile.tf specifically so
// resolveOverride has a same-zone target that ultimately points at the real
// GitHub Pages origin. See the file-level comment above for why this exists.
const ORIGIN_RESOLVE_OVERRIDE = "origin.kayasthaparivar.com";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === VERIFY_PATH) {
      return handleVerify(request, env, url);
    }

    if (await hasValidSessionCookie(request, env)) {
      return proxyToOrigin(request);
    }

    return renderChallengePage({
      redirectTo: url.pathname + url.search,
      siteKey: env.TURNSTILE_SITE_KEY,
    });
  },
};

/** Forward an already-verified request to the real GitHub Pages origin. */
function proxyToOrigin(request) {
  return fetch(request, {
    cf: {
      resolveOverride: ORIGIN_RESOLVE_OVERRIDE,
    },
  });
}

function parseCookies(request) {
  const cookieHeader = request.headers.get("Cookie") || "";
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => {
        const idx = pair.indexOf("=");
        return idx === -1
          ? [pair, ""]
          : [pair.slice(0, idx), pair.slice(idx + 1)];
      }),
  );
}

/**
 * Validate the session cookie: it must be `<issuedAt>.<hmac>`, the hmac must
 * verify against SESSION_SECRET, and issuedAt must be within
 * COOKIE_MAX_AGE_SECONDS of now. Any failure (missing, malformed, wrong
 * signature, expired) is treated as "not verified" — same as no cookie.
 */
async function hasValidSessionCookie(request, env) {
  const value = parseCookies(request)[COOKIE_NAME];
  if (!value) return false;

  const dotIndex = value.indexOf(".");
  if (dotIndex === -1) return false;

  const issuedAtRaw = value.slice(0, dotIndex);
  const signature = value.slice(dotIndex + 1);
  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt)) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (nowSeconds - issuedAt > COOKIE_MAX_AGE_SECONDS) return false;
  if (issuedAt > nowSeconds + 60) return false; // reject clock-skew-implausible future timestamps

  const expectedSignature = await signValue(issuedAtRaw, env.SESSION_SECRET);
  return timingSafeEqual(signature, expectedSignature);
}

/** Build a fresh, signed cookie value stamped with the current time. */
async function createSessionCookieValue(env) {
  const issuedAtRaw = String(Math.floor(Date.now() / 1000));
  const signature = await signValue(issuedAtRaw, env.SESSION_SECRET);
  return `${issuedAtRaw}.${signature}`;
}

/** HMAC-SHA256(secret, value), hex-encoded, via Web Crypto (available in Workers). */
async function signValue(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(signatureBuffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time string comparison to avoid leaking signature bytes via timing. */
function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function handleVerify(request, env, url) {
  const formData = await request.formData();
  const token = formData.get("cf-turnstile-response");
  const redirectTo = sanitizeRedirect(formData.get("redirect_to"));
  const ip = request.headers.get("CF-Connecting-IP") || "";

  if (!token) {
    return renderChallengePage({
      redirectTo,
      siteKey: env.TURNSTILE_SITE_KEY,
      error: "Please complete the challenge before continuing.",
    });
  }

  const verifyBody = new FormData();
  verifyBody.append("secret", env.TURNSTILE_SECRET_KEY);
  verifyBody.append("response", token);
  if (ip) verifyBody.append("remoteip", ip);

  let outcome;
  try {
    const verifyResponse = await fetch(TURNSTILE_SITEVERIFY_URL, {
      method: "POST",
      body: verifyBody,
    });
    outcome = await verifyResponse.json();
  } catch (err) {
    outcome = { success: false };
  }

  if (!outcome.success) {
    return renderChallengePage({
      redirectTo,
      siteKey: env.TURNSTILE_SITE_KEY,
      error: "Verification failed. Please try again.",
    });
  }

  const cookieValue = await createSessionCookieValue(env);

  const headers = new Headers();
  headers.set("Location", redirectTo);
  headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=${cookieValue}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Lax`,
  );

  return new Response(null, { status: 302, headers });
}

/** Keep the post-challenge redirect confined to a same-site relative path. */
function sanitizeRedirect(value) {
  if (typeof value !== "string" || !value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/"; // avoid protocol-relative escape
  return value;
}

function renderChallengePage({ redirectTo, siteKey, error }) {
  const escapedRedirect = escapeHtml(redirectTo);
  const escapedSiteKey = escapeHtml(siteKey || "");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Verifying you're human · Kayastha Parivar</title>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    height: 100%;
    background: radial-gradient(circle at 50% 20%, #1a2236 0%, #0b0e17 65%, #07090f 100%);
    color: #e7ecfa;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  .wrap {
    min-height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .card {
    width: 100%;
    max-width: 420px;
    background: rgba(23, 29, 46, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 36px 32px;
    text-align: center;
    backdrop-filter: blur(16px);
    box-shadow: 0 0 0 1px rgba(99, 217, 232, 0.15), 0 0 32px rgba(99, 217, 232, 0.12);
  }
  h1 {
    font-size: 1.25rem;
    margin: 0 0 8px;
    background: linear-gradient(90deg, #6fd7e8, #c98ee8);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  p {
    margin: 0 0 24px;
    font-size: 0.92rem;
    line-height: 1.5;
    color: #a9b3cc;
  }
  .cf-turnstile {
    display: flex;
    justify-content: center;
    margin-bottom: 20px;
  }
  .error {
    margin: 0 0 16px;
    padding: 10px 14px;
    border-radius: 8px;
    background: rgba(224, 92, 92, 0.12);
    border: 1px solid rgba(224, 92, 92, 0.35);
    color: #f3a5a5;
    font-size: 0.85rem;
  }
  .footer {
    margin-top: 20px;
    font-size: 0.75rem;
    color: #6b7590;
  }
  noscript { color: #f3a5a5; font-size: 0.85rem; }
  button[type="submit"] {
    appearance: none;
    border: 1px solid rgba(111, 215, 232, 0.4);
    background: rgba(111, 215, 232, 0.12);
    color: #e7ecfa;
    border-radius: 8px;
    padding: 8px 20px;
    font-size: 0.85rem;
    cursor: pointer;
  }
  button[type="submit"]:hover { background: rgba(111, 215, 232, 0.2); }
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Just a quick check</h1>
      <p>We ask every visitor to confirm they're human once. This keeps automated scraping off the family tree — it takes a second.</p>
      ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
      <form method="POST" action="${VERIFY_PATH}" id="turnstile-form">
        <input type="hidden" name="redirect_to" value="${escapedRedirect}" />
        <div
          class="cf-turnstile"
          data-sitekey="${escapedSiteKey}"
          data-theme="dark"
          data-callback="onTurnstileSuccess"
        ></div>
        <button type="submit">Continue</button>
        <noscript>Please enable JavaScript to complete this check.</noscript>
      </form>
      <div class="footer">Kayastha Parivar &middot; kayasthaparivar.com</div>
    </div>
  </div>
  <script>
    // Turnstile calls this once the widget succeeds. The visible "Continue"
    // button above is a fallback (e.g. if this callback is slow to fire) —
    // without either one, there was previously no way to actually submit
    // the form after solving the widget, so the page just sat there.
    function onTurnstileSuccess() {
      document.getElementById("turnstile-form").submit();
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 403,
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "no-store",
    },
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
