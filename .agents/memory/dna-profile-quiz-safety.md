---
name: DNA profile quiz safety
description: Loading and retake rules for the DNA tab on the user profile
---
The DNA profile lookup must begin in a neutral loading state, not `no_profile`. Show the “Take the Quiz” card only after the lookup has positively confirmed that no DNA profile exists.

Do not place a casual “Retake Quiz” action on the DNA profile screen. Retaking may feel destructive or imply that the current DNA history/profile could be replaced; keep the everyday actions focused on sharing and comparing.

**Why:** The false `no_profile` default briefly showed established users an outdated quiz CTA while their real DNA loaded, and Heidi considers a prominent retake control dangerous territory.

**How to apply:** Any surface that asynchronously checks DNA completion must distinguish loading from confirmed absence. Treat survey retakes as an intentional, separately explained flow rather than a profile-page quick action.