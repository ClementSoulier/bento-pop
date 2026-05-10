type ClassValue = string | number | boolean | null | undefined | ClassValue[];

export function clsx(...values: ClassValue[]): string {
  const out: string[] = [];
  const walk = (v: ClassValue) => {
    if (!v) return;
    if (typeof v === 'string' || typeof v === 'number') {
      out.push(String(v));
    } else if (Array.isArray(v)) {
      v.forEach(walk);
    }
  };
  values.forEach(walk);
  return out.join(' ');
}
