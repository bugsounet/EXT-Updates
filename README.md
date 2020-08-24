# Module: Update Notification

The `updatenotification` module is one of the default modules of the MagicMirror.
This will display a message whenever a new version of the MagicMirror application is available.

For configuration options, please check the [MagicMirror² documentation](https://docs.magicmirror.builders/modules/updatenotification.html).

---
This module is a Fork of `Update Notication` default module of MagicMirror

All credit to `Michael Teeuw https://michaelteeuw.nl` and not to me :)

V1.0.0 (24/08/20):
  * Added package.json
  * Added support for TelegramBot (auto send notification on new update)
  * Added NPM_UDPATE support (for npm @bugsounet/npmcheck library)
  
  Configuration sample is the same as the default module
```js
{
  module: "MMM-UpdateNotification",
  position: "top_bar",	// This can be any of the regions.
  config: {
    // The config property is optional.
    // See 'Configuration options' for more information.
  }
},
 ```
