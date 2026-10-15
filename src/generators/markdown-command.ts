/** First line of the markdown (fenced or inline code) that starts with `prefix` and contains `needle`. */
export function commandFrom(md: string, prefix: string, needle: string): string {
  for (const line of md.split('\n')) {
    const m = new RegExp('^`?(' + prefix + ' .*' + needle + '[^`]*)`?$').exec(line.trim());
    if (m) return m[1];
  }
  throw new Error(`command not found in markdown: ${prefix} ... ${needle}`);
}
