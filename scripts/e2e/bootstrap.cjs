// Test environment only: never load the application before isolating its profile.
const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");
const profile = process.env.PIGEON_E2E_PROFILE;
if (!profile || !path.isAbsolute(profile))
  throw Error("PIGEON_E2E_PROFILE must be an absolute isolated profile");
if (
  fs.readFileSync(path.join(profile, ".pigeon-e2e-profile"), "utf8") !==
  "pigeon-e2e-v1\n"
) {
  throw Error(
    "Refusing to load Pigeon without an isolated-test profile marker",
  );
}
app.setPath("userData", profile);
app.setPath("sessionData", profile);
const requestedRoot=process.env.PIGEON_E2E_APP_ROOT;
if(requestedRoot&&!path.isAbsolute(requestedRoot))throw Error('PIGEON_E2E_APP_ROOT must be absolute');
const root = requestedRoot || path.resolve(__dirname, "../..");
app.getAppPath = () => root;
fs.writeFileSync(
  path.join(profile, "e2e-environment.json"),
  JSON.stringify({
    userData: app.getPath("userData"),
    appPath: app.getAppPath(),
    electron: process.versions.electron,
  }),
);
if (process.env.PIGEON_E2E_HEADLESS === "1") {
  app.on("browser-window-created", (_event, window) => {
    window.once("ready-to-show", () => window.setSize(1440, 1000));
  });
}
const saveTarget=process.env.PIGEON_E2E_SAVE_TARGET;
if(saveTarget){const relative=path.relative(profile,saveTarget);if(!path.isAbsolute(saveTarget)||relative.startsWith('..')||path.isAbsolute(relative))throw Error('Save target must be inside the isolated profile');require('electron').dialog.showSaveDialog=async()=>({canceled:false,filePath:saveTarget});}
require(path.join(root,"electron/main.js"));
