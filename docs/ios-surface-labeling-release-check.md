# iOS surface-labeling release check

Use the existing authorized build configuration. Do not enable the paused
PostHog migration, rotate keys, or change capture/recording settings.

## Build and copy current assets

```sh
npm run prepare:ios
```

This runs the normal web build and `cap copy ios`, then compares every built
file with its packaged copy. It stops before copying if the existing PostHog
build key is missing, controlled ingestion is enabled, or expected labeling
code is absent. It never prints the key or modifies environment settings.

This replaces generated web assets with the latest application source, not
just the labeling changes. Review all intended release changes normally.
The command does not change the native version/build, sync native dependencies,
create a signed archive, publish the website, or submit to App Store Connect.

## Required physical-iPhone check before submission

Use the actual candidate installed from the newly prepared native project.
Under the existing consent/account rules, verify a pageview, a custom event,
and a real autocaptured interaction have:

```text
surface: ios_app
platform: ios
```

Verify browser usage, including Safari on that same iPhone, instead has:

```text
surface: web_app
platform: web
```

Confirm capture remains blocked when existing consent/authorization blocks it,
and labels survive an ordinary sign-out/sign-in or SDK reset.

The isolated SDK tests are not physical-device evidence. A generated web bundle
is not an installed or signed native release. Do not mark the device check
complete until the candidate binary itself has been tested.

Backend-generated events remain separate; no origin labels are inferred for them.