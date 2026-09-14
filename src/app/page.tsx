/**
 * Placeholder entry point.
 *
 * PR 0 is scaffold only. The real entry is the participant-code gate
 * (PR 3) followed by the protocol runner (PR 5). See
 * docs/OPTEMP_FIELD_PORT_PLAN.md for the cut-line.
 */
export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-2xl font-semibold">OPTemp Field</h1>
      <p className="max-w-sm text-sm opacity-70">
        Scaffold. No data layer, protocol, or UI yet — see{" "}
        <code>docs/OPTEMP_FIELD_PORT_PLAN.md</code>.
      </p>
    </main>
  );
}
