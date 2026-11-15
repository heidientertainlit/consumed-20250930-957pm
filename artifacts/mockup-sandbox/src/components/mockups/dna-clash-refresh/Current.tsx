import { QueryClient, QueryClientProvider } from "./_query";
import BaselineSource from "./_BaselinePreview";
import PreviewHarness from "./_PreviewHarness";
import "./fixture.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});

export default function Current() {
  return (
    <QueryClientProvider client={queryClient}>
      <PreviewHarness label="Current · unchanged baseline source">
        {(props) => <BaselineSource {...props} />}
      </PreviewHarness>
    </QueryClientProvider>
  );
}
