# Automatic required iOS updates

One-time installation: `20261012010000_automatic_ios_required_updates.sql`.
The dedicated Supabase Cron job polls Apple's public US listing every five
minutes using the existing pg_net installation. It consumes the previous
response before requesting the next one. No Edge Function deployment,
service-role secret, or per-release configuration is needed.

Published, stable three-part versions become both `latest_version` and
`minimum_supported_version`. There is a one-hour propagation buffer after
Apple's published release time, plus at most approximately ten minutes for
the fetch/consume cycle under normal scheduler operation.

The existing native checker handles the blocking screen on launch/foreground.
Versions without that checker cannot be upgraded remotely. Network/config
errors in that existing checker still fail open; this is not an offline lock.
No web users are blocked.

The sync verifies app ID, bundle ID, software kind, version, release time, and
OS compatibility. It never lowers either threshold. Errors preserve the
previous configuration and are recorded privately in the sync state.

## Compatibility boundary

The existing configuration has one global iOS minimum, not a per-device rule.
Automatic enforcement therefore stops if Apple reports a release requiring
an OS newer than iOS 15.0, rather than stranding devices that cannot install it.
Changing the app's OS support floor requires a deliberate compatibility
policy update. The configured listing is the same US storefront used by the
existing Update button; it does not prove availability in every territory.
Use native three-part marketing versions, as required by the existing checker.

## Read-only verification

```sql
select platform, latest_version, minimum_supported_version, updated_at
from public.app_version_config where platform='ios';

select checked_at, last_success_at, last_result
from public.ios_app_store_sync_state where platform='ios';

select jobid, jobname, schedule, active
from cron.job where jobname='consumed-ios-app-store-sync';

select status, start_time, end_time
from cron.job_run_details
where jobid=(select jobid from cron.job where jobname='consumed-ios-app-store-sync')
order by start_time desc limit 5;
```

To pause automation, an authorized operator can set this one job inactive
with `cron.alter_job`. That does not undo the currently enforced minimum.
Never replay unrelated migrations or change other scheduled jobs.
