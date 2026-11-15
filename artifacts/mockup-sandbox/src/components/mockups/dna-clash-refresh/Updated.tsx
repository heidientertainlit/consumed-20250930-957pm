import { QueryClient, QueryClientProvider } from "./_query";
import UpdatedSource from "./_UpdatedSource";
import PreviewHarness from "./_PreviewHarness";
import "./fixture.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});

export default function Updated() {
  return (
    <QueryClientProvider client={queryClient}>
      <PreviewHarness label="Updated · extracted production component">
        {(props) => <UpdatedSource {...props} />}
      </PreviewHarness>
    </QueryClientProvider>
  );
}
