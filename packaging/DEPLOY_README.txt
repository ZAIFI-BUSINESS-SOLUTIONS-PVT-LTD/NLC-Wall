================================================================
  LIVE SIGN WALL  —  Deployment Guide (client premises)
================================================================

WHAT YOU RECEIVED
-----------------
  SignWall.exe        <- the whole application (server). Nothing to install.
  DEPLOY_README.txt   <- this file.

You only run software on ONE computer: the "SERVER PC".
Tablets and the big display screen install NOTHING — they just open a web
browser pointed at the server PC. There is no internet required; everything
runs on the local Wi-Fi.


----------------------------------------------------------------
 STEP 1 — Put the exe on the SERVER PC
----------------------------------------------------------------
Copy SignWall.exe into its own folder, e.g.  C:\SignWall\
(The app will create its data next to the exe, so keep it in a real folder,
 not on the Desktop root.)


----------------------------------------------------------------
 STEP 2 — Start the server
----------------------------------------------------------------
Double-click  SignWall.exe.
A black console window opens and shows the addresses. Keep this window OPEN
for the whole event — closing it stops the server.

If Windows SmartScreen warns "Windows protected your PC":
   click  "More info"  ->  "Run anyway".  (Happens because the exe is unsigned.)


----------------------------------------------------------------
 STEP 3 — Find the server PC's IP address  (first time / if Wi-Fi changes)
----------------------------------------------------------------
Open Command Prompt on the server PC and run:
   ipconfig
Look for "IPv4 Address" under your active Wi-Fi adapter, e.g.
   IPv4 Address. . . . . . : 192.168.1.10
Write it down. Every tablet and the display will use this number.

TIP: ask the venue's IT to reserve a fixed IP for this PC in the router,
so the address never changes mid-event.


----------------------------------------------------------------
 STEP 4 — Allow the app through the firewall  (first time only)
----------------------------------------------------------------
Right-click Windows PowerShell -> "Run as administrator", then paste:

   New-NetFirewallRule -DisplayName "SignWall" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow

Without this, other devices can't reach the server.


----------------------------------------------------------------
 STEP 5 — Open the pages
----------------------------------------------------------------
Replace 192.168.1.10 with YOUR server IP from Step 3.

  On the server PC itself (to test):
     Input   ->  http://localhost:8000/
     Display ->  http://localhost:8000/display
     Admin   ->  http://localhost:8000/admin

  On the SIGNING TABLETS (same Wi-Fi):
     http://192.168.1.10:8000/

  On the BIG DISPLAY laptop (connected to TV/projector via HDMI):
     http://192.168.1.10:8000/display     (press F11 for fullscreen)

  On any ADMIN device:
     http://192.168.1.10:8000/admin


----------------------------------------------------------------
 TABLET SETUP (per tablet)
----------------------------------------------------------------
  - Connect the tablet to the SAME Wi-Fi as the server PC.
  - Open Chrome (Android) / Safari (iPad) -> go to  http://<server-ip>:8000/
  - Brightness = max,  Screen timeout = Never,  keep charger plugged in.
  - Lock it so visitors can't wander off:
      Android: Chrome menu -> Add to Home Screen, then enable Screen Pinning
               (Settings -> Security -> Screen Pinning) and pin the app.
      iPad:    Settings -> Accessibility -> Guided Access -> On, set a passcode;
               open the page, triple-click the side button -> Start.


----------------------------------------------------------------
 WHERE YOUR DATA LIVES
----------------------------------------------------------------
Next to SignWall.exe the app creates:
   signwall.db          - database of all signatures (survives restarts)
   signatures\<date>\   - a PNG of every signature, foldered by day
   signwall.log         - server log (useful if something goes wrong)

These are SAFE to back up by copying. "Clear wall" in the admin panel only
clears the live screen; it does NOT delete the saved PNGs.


----------------------------------------------------------------
 IF SOMETHING GOES WRONG
----------------------------------------------------------------
"Site can't be reached" on a tablet:
   - Tablet on the same Wi-Fi?  Server console window still open?
   - Firewall rule added (Step 4)?  Correct IP (Step 3)?
Display blank / not updating:
   - Refresh the display page once.
Server crashed:
   - Re-run SignWall.exe. All saved signatures are safe on disk;
     the live wall starts empty and fills as new signatures arrive.
Router restarted / IP changed:
   - Re-run ipconfig, update the URL on tablets and display.
================================================================
