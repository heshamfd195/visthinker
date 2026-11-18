import { execFile } from "node:child_process";
import { log } from "./log.ts";

/** Opens a link in the default browser. */
export function openInBrowser(url: string): void {
  const command =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open";
  execFile(command, [url], (error) => {
    if (error) log(`could not open the browser (${command}):`, error.message);
  });
}
