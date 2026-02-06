use std::process::Command;
use tauri::{AppHandle, Manager};

/// Focus our Tauri app window
pub fn focus_self(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        // Unminimize if minimized
        let _ = window.unminimize();
        // Bring to front and focus
        let _ = window.show();
        let _ = window.set_focus();
    }

    // Also activate the app at the OS level (macOS)
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("osascript")
            .args([
                "-e",
                r#"tell application "System Events" to set frontmost of (first process whose unix id is (do shell script "echo $PPID")) to true"#,
            ])
            .output();
    }
}

/// Focus Windsurf IDE window
pub fn focus_windsurf() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        // Try "Windsurf" first, fall back to detecting the process
        let script = r#"
            try
                tell application "Windsurf" to activate
            on error
                try
                    tell application "System Events"
                        set wsProc to first process whose name contains "Windsurf"
                        set frontmost of wsProc to true
                    end tell
                on error errMsg
                    error "Windsurf not found: " & errMsg
                end try
            end try
        "#;

        let output = Command::new("osascript")
            .args(["-e", script])
            .output()
            .map_err(|e| format!("Failed to run osascript: {}", e))?;

        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr);
            // Don't treat as hard error - Windsurf might just not be running
            eprintln!("[Focus] Windsurf focus failed: {}", err);
        }

        Ok(())
    }

    #[cfg(target_os = "windows")]
    {
        // On Windows, use PowerShell to activate Windsurf
        let script = r#"
            $wshell = New-Object -ComObject wscript.shell
            $proc = Get-Process -Name "Windsurf" -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($proc) {
                [void][System.Reflection.Assembly]::LoadWithPartialName('Microsoft.VisualBasic')
                [Microsoft.VisualBasic.Interaction]::AppActivate($proc.Id)
            }
        "#;
        let _ = Command::new("powershell")
            .args(["-Command", script])
            .output();
        Ok(())
    }

    #[cfg(target_os = "linux")]
    {
        // On Linux, use wmctrl or xdotool
        let _ = Command::new("wmctrl")
            .args(["-a", "Windsurf"])
            .output()
            .or_else(|_| {
                Command::new("xdotool")
                    .args(["search", "--name", "Windsurf", "windowactivate"])
                    .output()
            });
        Ok(())
    }
}
