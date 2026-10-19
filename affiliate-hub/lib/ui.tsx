export function ErrorBox({ error }: { error?: string }) {
  if (!error) return null;
  return <div className="panel error">{error}</div>;
}

export function Notice({ notice }: { notice?: string }) {
  if (!notice) return null;
  return <div className="panel ok">{notice}</div>;
}

export type SP = Promise<Record<string, string | undefined>>;
