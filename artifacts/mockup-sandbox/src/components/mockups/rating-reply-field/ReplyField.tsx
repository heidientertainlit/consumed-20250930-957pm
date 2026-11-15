import { useRef, useState } from "react";
import Field from "./_Field";
import "./fixture.css";

const session = { access_token: "isolated-test-session" };
// Isolated preview boundary: no request can reach the live backend.
window.fetch = async () => new Response(JSON.stringify({
  friends: [{
    id: "local-friendship",
    friend: { id: "local-friend", user_name: "jamie.example", first_name: "Jamie", last_name: "Example" },
  }],
}), { status: 200, headers: { "Content-Type": "application/json" } });

export default function ReplyField() {
  const [open, setOpen] = useState(() => new URLSearchParams(window.location.search).get("open") === "1");
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string[]>([]);
  const fieldRef = useRef<HTMLDivElement>(null);
  const submit = async () => {
    if (submitting || !value.trim()) return;
    setSubmitting(true);
    const content = value.trim();
    await new Promise(resolve => setTimeout(resolve, 150));
    setSubmitted(current => [...current, content]);
    setValue("");
    setSubmitting(false);
  };
  return (
    <main className="min-h-screen bg-[#f8f6f8] px-3 py-8">
      <div className="mx-auto max-w-[560px] overflow-visible rounded-2xl bg-white shadow-sm">
        <button
          type="button"
          className="mx-4 my-2 min-h-11 text-[13px] text-gray-600"
          onClick={() => {
            setOpen(current => !current);
            setTimeout(() => fieldRef.current?.querySelector("input")?.focus(), 0);
          }}
        >Reply</button>
        {open && (
          <div className="border-t border-gray-100">
            <div ref={fieldRef} className="flex items-center gap-2 px-4 pb-4 pt-2.5">
              <Field value={value} onChange={setValue} onSubmit={submit} session={session} submitting={submitting} />
            </div>
          </div>
        )}
      </div>
      <output className="mx-auto mt-6 block max-w-[560px] text-[13px] text-gray-600" data-testid="submissions">
        {submitted.map((content, index) => <p key={index}>{content}</p>)}
      </output>
    </main>
  );
}
