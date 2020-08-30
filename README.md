# Module: MMM-UpdateNotification

The `updatenotification` module is one of the default modules of the MagicMirror.
This will display a message whenever a new version of the MagicMirror application is available.

For configuration options, please check the [MagicMirror² documentation](https://docs.magicmirror.builders/modules/updatenotification.html).

---
This module is a Fork of `Update Notication` default module of MagicMirror

All credit to `Michael Teeuw https://michaelteeuw.nl` and not to me :)

I have just added TelegramBot notification and NPM Check result for my mpn libraries

Updates:

V1.0.1 (26/08/20):
  * Send TelegramBot notification when module is disabled too

V1.0.0 (25/08/20):
  * Added package.json
  * Added support for TelegramBot (auto send notification on new update)
  * Added NPM_UDPATE support (for npm @bugsounet/npmcheck library)
  * correct some part of Mich code (I don't like code with `self` value using)

 # Configuration sample is the same as the default module
 No Feature will be added, so the configuration is the same.
 
 You can, if you want just replace the name of module `updatenotification` by `MMM-UpdateNotification`
 
 Or create config:
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
 don't forget to delete or disable `updatenotification`, in this case
 
 # Installing 
 
 ```sh
 cd ~/MagicMirror/modules
 git clone https://github.com/bugsounet/MMM-UpdateNotification
 npm install
 ```
