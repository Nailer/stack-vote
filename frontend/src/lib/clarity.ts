/**
 * Recursively unwraps cvToValue()-shaped Clarity results ({ type, value })
 * into plain JS values. uint/int become bigint; everything else becomes
 * string / boolean / null / plain object as appropriate.
 */
export function unwrapClarity(raw: unknown): any {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "bigint" || typeof raw === "boolean" || typeof raw === "number") return raw;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw.map(unwrapClarity);

  if (typeof raw === "object" && "type" in (raw as any)) {
    const obj = raw as { type?: string; value?: unknown };
    const t = String(obj.type ?? "");

    if (t.startsWith("(optional") || t.startsWith("optional")) {
      if (obj.value === undefined || obj.value === null) return null;
      return unwrapClarity(obj.value);
    }
    if (t.startsWith("(response") || t.startsWith("response")) {
      return unwrapClarity(obj.value);
    }
    if (t.startsWith("(tuple") || t === "tuple") {
      const tupleVal = obj.value as Record<string, unknown>;
      const out: Record<string, any> = {};
      for (const key of Object.keys(tupleVal ?? {})) {
        out[key] = unwrapClarity(tupleVal[key]);
      }
      return out;
    }
    if (t === "uint" || t === "int") {
      return BigInt(String(obj.value));
    }
    if (t === "bool") {
      return Boolean(obj.value);
    }
    if (t === "principal" || t.startsWith("(string")) {
      return String(obj.value);
    }
    if ("value" in obj) {
      return unwrapClarity(obj.value);
    }
  }

  if (typeof raw === "object") {
    const out: Record<string, any> = {};
    for (const key of Object.keys(raw as Record<string, unknown>)) {
      out[key] = unwrapClarity((raw as Record<string, unknown>)[key]);
    }
    return out;
  }

  return raw;
}

export function isValidPrincipal(addr: string | null | undefined): addr is string {
  return typeof addr === "string" && /^(ST|SP)[0-9A-HJ-NP-Z]{38,41}$/.test(addr);
}
