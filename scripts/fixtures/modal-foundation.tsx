// Actual application components; only auth/transport are replaced by the runner.
import React, { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../../client/src/lib/queryClient";
import { FeedbackDialog } from "../../client/src/components/feedback-dialog";
import ConsumptionTracker from "../../client/src/components/consumption-tracker";
import { ProgressUpdateSheet } from "../../client/src/components/progress-update-sheet";
import { QuickAddListSheet } from "../../client/src/components/quick-add-list-sheet";
import { FinishedMediaFollowUp } from "../../client/src/components/finished-media-follow-up";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "../../client/src/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "../../client/src/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../client/src/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuItem, DropdownMenuPortal,
} from "../../client/src/components/ui/dropdown-menu";

const params = new URLSearchParams(location.search);
const flow = params.get("flow") || "finished";
const elevated = params.has("elevated");
const media = { title: "Fixture movie", mediaType: "movie", externalId: "fixture", externalSource: "tmdb" };
const lists = ["Currently", "Want To", "Finished", "Did Not Finish", "Favorites"]
  .map((title, i) => ({ id: `list-${i}`, title, is_default: true, items: [] }));
const fx = (window as any).fx = {
  writes: [], requests: [], unexpected: [], navClicks: 0, closes: 0, saved: [], failNext: false, busy: false,
};
const realFetch = window.fetch.bind(window);
window.fetch = async (resource, options) => {
  const url = new URL(String(resource), location.href);
  if (url.origin === location.origin) return realFetch(resource, options);
  const name = url.pathname.split("/").at(-1)!;
  const payload = options?.body ? JSON.parse(String(options.body)) : null;
  fx.requests.push({ name, payload });
  if (fx.failNext && ["track-media", "update-item-progress"].includes(name)) {
    fx.failNext = false;
    return Response.json({ error: "Fixture save failed" }, { status: 500 });
  }
  switch (name) {
    case "media-search":
      return Response.json({ results: [{ title: media.title, type: "movie", creator: "Fixture creator", external_id: "fixture", external_source: "tmdb" }] });
    case "get-user-lists-with-media": return Response.json({ lists });
    case "get-media-details": return Response.json({ seasons: [{ seasonNumber: 1, episodeCount: 12 }], page_count: 300 });
    case "get-recommendations": return Response.json({ recommendations: [] });
    case "sync-creator-stats": return Response.json({ success: true });
    case "track-media":
    case "add-media-to-list":
    case "update-item-progress":
      fx.writes.push({ name, payload });
      return Response.json({ success: true, item_id: "fixture-item" });
    default:
      fx.unexpected.push(name);
      throw new Error("Unexpected fixture transport: " + name);
  }
};

function Controls() {
  const [choice, setChoice] = useState("one");
  const [nested, setNested] = useState(false);
  return <>
    <Select value={choice} onValueChange={setChoice}>
      <SelectTrigger aria-label="Fixture selection"><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="one">One</SelectItem><SelectItem value="two">Two</SelectItem></SelectContent>
    </Select>
    <Popover><PopoverTrigger>Open popover</PopoverTrigger>
      <PopoverContent><button onClick={() => fx.saved.push("popover")}>Popover action</button></PopoverContent>
    </Popover>
    <DropdownMenu><DropdownMenuTrigger>Open nested menu</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuSub><DropdownMenuSubTrigger>More choices</DropdownMenuSubTrigger>
          <DropdownMenuPortal><DropdownMenuSubContent>
            <DropdownMenuItem onSelect={() => fx.saved.push("submenu")}>Nested action</DropdownMenuItem>
          </DropdownMenuSubContent></DropdownMenuPortal>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
    <Dialog open={nested} onOpenChange={setNested}>
      <DialogTrigger>Nested form</DialogTrigger>
      <DialogContent><DialogTitle>Nested form title</DialogTitle><input aria-label="Nested input" /></DialogContent>
    </Dialog>
  </>;
}

function App() {
  const [open, setOpen] = useState(true);
  const [rating, setRating] = useState(0);
  const [reaction, setReaction] = useState("");
  const [spoilers, setSpoilers] = useState(false);
  const [busy, setBusy] = useState(false);
  const close = () => { fx.closes++; setOpen(false); };
  fx.reopen = () => setOpen(true);
  fx.setBusy = setBusy;
  return <>
    <div id="background" style={elevated ? { position: "fixed", inset: 0, zIndex: 99999, background: "#fafafa" } : {}}>
      <h1>Underlying page</h1>
      <button id="opener" onClick={() => setOpen(true)}>Open fixture</button>
      <input aria-label="Background input" />
      <nav id="fixture-nav" style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 84, zIndex: elevated ? 10 : 9999, background: "#ddd" }}>
        <button onClick={() => fx.navClicks++}>Navigation action</button>
      </nav>
      <div style={{ height: 1600 }}>Background scrolling content</div>
    </div>
    {flow === "feedback" && <FeedbackDialog isOpen={open} onClose={close} />}
    {flow === "tracker" && <ConsumptionTracker isOpen={open} onClose={close} />}
    {flow === "progress" && <ProgressUpdateSheet isOpen={open} onOpenChange={setOpen}
      item={{ id: "fixture-item", title: media.title, media_type: params.get("media") || "movie", progress: 3, total: 300, external_id: "fixture" }}
      showRemoveOption onRemove={() => fx.saved.push("removed")} onFinished={() => fx.saved.push("finished")} />}
    {flow === "add" && <QuickAddListSheet isOpen={open} onClose={close} media={media} elevated={elevated} />}
    {flow === "finished" && <FinishedMediaFollowUp isOpen={open} onClose={close} media={media}
      elevated={elevated} rating={rating} reaction={reaction} busy={busy} error={null}
      containsSpoilers={spoilers} onContainsSpoilersChange={setSpoilers}
      onRatingChange={setRating} onReactionChange={setReaction}
      onSubmit={() => { fx.saved.push({ rating, reaction, spoilers }); close(); }} />}
    {["controls", "nonmodal", "legacy"].includes(flow) && <Dialog layered={flow !== "legacy"} modal={flow !== "nonmodal"} open={open} onOpenChange={setOpen}>
      <DialogTrigger id="modal-trigger" style={{ position: "fixed", top: 80, left: 20 }}>Open controls</DialogTrigger>
      <DialogContent className="bg-white max-h-[85dvh] overflow-y-auto">
        <DialogTitle>Foundation controls</DialogTitle>
        <input aria-label="Parent input" defaultValue="preserved" />
        <Controls />
      </DialogContent>
    </Dialog>}
  </>;
}
createRoot(document.getElementById("root")!).render(
  <StrictMode><QueryClientProvider client={queryClient}><App /></QueryClientProvider></StrictMode>,
);
