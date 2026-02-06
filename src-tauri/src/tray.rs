use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIcon, TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState},
    AppHandle, Manager,
};
use std::sync::{Arc, Mutex};

/// Shared reference to the tray icon for dynamic updates
pub type TrayHandle = Arc<Mutex<Option<TrayIcon>>>;

pub fn create_tray_handle() -> TrayHandle {
    Arc::new(Mutex::new(None))
}

/// Build and register the system tray icon
pub fn setup_tray(app: &AppHandle, tray_handle: TrayHandle) -> Result<(), Box<dyn std::error::Error>> {
    // Menu items
    let show_item = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

    let tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .icon_as_template(true) // macOS: use template for dark/light mode
        .title("WDM") // Initial title on macOS menu bar
        .tooltip("Windsurf Data Manager")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event({
            let app_handle = app.clone();
            move |_app, event| {
                match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        std::process::exit(0);
                    }
                    _ => {}
                }
            }
        })
        .on_tray_icon_event({
            let app_handle = app.clone();
            move |_tray, event| {
                if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                    // Left click: show and focus main window
                    if let Some(window) = app_handle.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    // Store tray handle for later updates
    {
        let mut handle = tray_handle.lock().unwrap();
        *handle = Some(tray);
    }

    Ok(())
}
