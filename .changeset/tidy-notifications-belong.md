---
'@zxkit/noti': minor
---

Add `useNoti()`, a component-owned notification API that automatically dismisses its live notification on unmount. Ownership follows promise outcomes and updates, while replacements from other components or the global API remain untouched. Late calls from an unmounted hook do not display notifications.
