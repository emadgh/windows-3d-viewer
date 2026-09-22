#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    borrow::Cow,
    env,
    error::Error,
    fs::{self, File},
    io::{Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    process::Command,
};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use rust_embed::Embed;
use serde::Deserialize;
use serde_json::{json, Value};
use tao::{
    dpi::LogicalSize,
    event::{Event, WindowEvent},
    event_loop::{ControlFlow, EventLoopBuilder},
    window::WindowBuilder,
};
use walkdir::WalkDir;
use wry::{
    http::{header::CONTENT_TYPE, Response},
    WebViewBuilder,
};

#[cfg(windows)]
use winreg::{enums::HKEY_CURRENT_USER, RegKey};

const APP_NAME: &str = "Windows 3D Viewer";
const APP_EXE_NAME: &str = "windows-3d-viewer.exe";
const APP_VERSION: &str = env!("CARGO_PKG_VERSION");
const FILE_CHUNK_BYTES: usize = 6000;

const SUPPORTED_EXTENSIONS: &[(&str, &str)] = &[
    (".glb", "GLB"),
    (".gltf", "glTF"),
    (".fbx", "FBX"),
    (".obj", "OBJ"),
    (".stl", "STL"),
    (".ply", "PLY"),
    (".dae", "COLLADA"),
    (".3mf", "3MF"),
    (".3ds", "3DS"),
    (".usdz", "USDZ"),
    (".wrl", "VRML"),
    (".vrml", "VRML"),
];

const SIDECAR_EXTENSIONS: &[&str] = &[
    "bin", "mtl", "png", "jpg", "jpeg", "webp", "bmp", "tga", "dds", "ktx2", "gif",
    "hdr", "exr",
];

const BRIDGE_INIT_SCRIPT: &str = r#"
(() => {
  if (window.zero && typeof window.zero.invoke === 'function') return;

  let nextId = 1;
  const pending = new Map();

  window.__w3dvResolve = (id, ok, value) => {
    const key = String(id);
    const entry = pending.get(key);
    if (!entry) return;
    pending.delete(key);

    if (ok) {
      entry.resolve(value);
    } else {
      const message = value && typeof value === 'object' && value.message
        ? value.message
        : String(value ?? 'Native command failed.');
      entry.reject(new Error(message));
    }
  };

  window.zero = {
    invoke(command, payload = {}) {
      return new Promise((resolve, reject) => {
        const id = String(nextId++);
        pending.set(id, { resolve, reject });
        window.ipc.postMessage(JSON.stringify({ id, command, payload }));
      });
    },
  };
})();
"#;

#[derive(Embed)]
#[folder = "frontend/dist/"]
struct FrontendAssets;

#[derive(Debug)]
enum UserEvent {
    Bridge(String),
}

#[derive(Debug, Deserialize)]
struct BridgeRequest {
    id: String,
    command: String,
    #[serde(default)]
    payload: Value,
}

#[derive(Debug)]
struct LaunchFile {
    relative: String,
    absolute: PathBuf,
}

#[derive(Debug)]
struct LaunchState {
    primary: String,
    files: Vec<LaunchFile>,
}

impl LaunchState {
    fn manifest(&self) -> Value {
        json!({
            "primary": self.primary,
            "files": self.files.iter().map(|file| file.relative.clone()).collect::<Vec<_>>(),
            "createdUtc": Value::Null,
        })
    }

    fn find(&self, relative: &str) -> Option<&LaunchFile> {
        self.files.iter().find(|file| file.relative == relative)
    }
}

fn path_to_web(path: &Path) -> String {
    path.components()
        .map(|component| component.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/")
}

fn extension_lower(path: &Path) -> Option<String> {
    path.extension()
        .map(|value| value.to_string_lossy().to_ascii_lowercase())
}

fn is_supported_model(path: &Path) -> bool {
    let Some(extension) = extension_lower(path) else {
        return false;
    };
    SUPPORTED_EXTENSIONS
        .iter()
        .any(|(candidate, _)| candidate.trim_start_matches('.') == extension)
}

fn build_launch_state() -> Option<LaunchState> {
    let argument = env::args_os().skip(1).find(|arg| {
        let text = arg.to_string_lossy();
        !text.starts_with('-')
    })?;

    let requested = PathBuf::from(argument);
    if !requested.is_file() || !is_supported_model(&requested) {
        return None;
    }

    let primary_absolute = fs::canonicalize(&requested).ok()?;
    let source_root = primary_absolute.parent()?.to_path_buf();
    let primary = primary_absolute.file_name()?.to_string_lossy().into_owned();

    let mut files = vec![LaunchFile {
        relative: primary.clone(),
        absolute: primary_absolute.clone(),
    }];

    for entry in WalkDir::new(&source_root).follow_links(false).into_iter().filter_map(Result::ok) {
        if !entry.file_type().is_file() {
            continue;
        }

        let path = entry.path();
        if path == primary_absolute {
            continue;
        }

        let Some(extension) = extension_lower(path) else {
            continue;
        };
        if !SIDECAR_EXTENSIONS.contains(&extension.as_str()) {
            continue;
        }

        let Ok(relative_path) = path.strip_prefix(&source_root) else {
            continue;
        };
        files.push(LaunchFile {
            relative: path_to_web(relative_path),
            absolute: path.to_path_buf(),
        });
    }

    files[1..].sort_by(|left, right| left.relative.cmp(&right.relative));
    Some(LaunchState { primary, files })
}

fn mime_for(path: &str) -> String {
    let extension = Path::new(path)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    match extension.as_str() {
        "html" => "text/html; charset=utf-8".to_string(),
        "js" | "mjs" => "text/javascript; charset=utf-8".to_string(),
        "css" => "text/css; charset=utf-8".to_string(),
        "json" => "application/json; charset=utf-8".to_string(),
        "wasm" => "application/wasm".to_string(),
        _ => mime_guess::from_path(path)
            .first_raw()
            .unwrap_or("application/octet-stream")
            .to_string(),
    }
}

fn asset_response(path: &str) -> Response<Cow<'static, [u8]>> {
    let requested = path.trim_start_matches('/');
    let key = if requested.is_empty() { "index.html" } else { requested };

    let asset = FrontendAssets::get(key).or_else(|| {
        if Path::new(key).extension().is_none() {
            FrontendAssets::get("index.html")
        } else {
            None
        }
    });

    match asset {
        Some(asset) => Response::builder()
            .status(200)
            .header(CONTENT_TYPE, mime_for(key))
            .header("Cache-Control", "no-cache")
            .header("Access-Control-Allow-Origin", "*")
            .body(asset.data)
            .expect("valid asset response"),
        None => Response::builder()
            .status(404)
            .header(CONTENT_TYPE, "text/plain; charset=utf-8")
            .body(Cow::Owned(b"Not Found".to_vec()))
            .expect("valid not-found response"),
    }
}

fn read_launch_file_chunk(state: &LaunchState, payload: &Value) -> Result<Value, String> {
    let relative = payload
        .get("path")
        .and_then(Value::as_str)
        .ok_or_else(|| "Missing launch file path.".to_string())?;
    let offset = payload.get("offset").and_then(Value::as_u64).unwrap_or(0);

    let launch_file = state
        .find(relative)
        .ok_or_else(|| format!("Launch file is not available: {relative}"))?;

    let mut file = File::open(&launch_file.absolute)
        .map_err(|error| format!("Could not open {}: {error}", launch_file.absolute.display()))?;
    let length = file
        .metadata()
        .map_err(|error| format!("Could not inspect {}: {error}", launch_file.absolute.display()))?
        .len();

    if offset > length {
        return Err(format!("Invalid launch file offset {offset} for {relative}."));
    }

    file.seek(SeekFrom::Start(offset))
        .map_err(|error| format!("Could not seek {relative}: {error}"))?;

    let mut buffer = vec![0_u8; FILE_CHUNK_BYTES];
    let read = file
        .read(&mut buffer)
        .map_err(|error| format!("Could not read {relative}: {error}"))?;
    buffer.truncate(read);

    let next_offset = offset + read as u64;
    Ok(json!({
        "data": BASE64.encode(buffer),
        "nextOffset": next_offset,
        "eof": next_offset >= length,
    }))
}

#[cfg(windows)]
fn register_file_associations() -> Result<(), String> {
    let exe = env::current_exe().map_err(|error| format!("Could not resolve executable path: {error}"))?;
    let exe_text = exe.to_string_lossy();
    let open_command = format!("\"{exe_text}\" \"%1\"");
    let icon_value = format!("\"{exe_text}\",0");

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let capability_relative = r"Software\EmadGH\Windows3DViewer\Capabilities";

    let (capabilities, _) = hkcu
        .create_subkey(capability_relative)
        .map_err(|error| format!("Could not create application capabilities: {error}"))?;
    capabilities
        .set_value("ApplicationName", &APP_NAME)
        .map_err(|error| error.to_string())?;
    capabilities
        .set_value("ApplicationDescription", &"Fast local 3D model viewer")
        .map_err(|error| error.to_string())?;
    let (file_associations, _) = capabilities
        .create_subkey("FileAssociations")
        .map_err(|error| error.to_string())?;

    let (registered_apps, _) = hkcu
        .create_subkey(r"Software\RegisteredApplications")
        .map_err(|error| error.to_string())?;
    registered_apps
        .set_value(APP_NAME, &capability_relative)
        .map_err(|error| error.to_string())?;

    let application_path = format!(r"Software\Classes\Applications\{APP_EXE_NAME}");
    let (application, _) = hkcu
        .create_subkey(&application_path)
        .map_err(|error| error.to_string())?;
    application
        .set_value("FriendlyAppName", &APP_NAME)
        .map_err(|error| error.to_string())?;
    let (application_command, _) = application
        .create_subkey(r"shell\open\command")
        .map_err(|error| error.to_string())?;
    application_command
        .set_value("", &open_command)
        .map_err(|error| error.to_string())?;
    let (supported_types, _) = application
        .create_subkey("SupportedTypes")
        .map_err(|error| error.to_string())?;

    for (extension, label) in SUPPORTED_EXTENSIONS {
        let token = extension.trim_start_matches('.');
        let prog_id = format!("Windows3DViewer.{token}");
        let prog_path = format!(r"Software\Classes\{prog_id}");
        let (prog_key, _) = hkcu.create_subkey(&prog_path).map_err(|error| error.to_string())?;
        let description = format!("Windows 3D Viewer {label} File");
        prog_key
            .set_value("", &description)
            .map_err(|error| error.to_string())?;

        let (icon_key, _) = prog_key
            .create_subkey("DefaultIcon")
            .map_err(|error| error.to_string())?;
        icon_key
            .set_value("", &icon_value)
            .map_err(|error| error.to_string())?;

        let (command_key, _) = prog_key
            .create_subkey(r"shell\open\command")
            .map_err(|error| error.to_string())?;
        command_key
            .set_value("", &open_command)
            .map_err(|error| error.to_string())?;

        let open_with_path = format!(r"Software\Classes\{extension}\OpenWithProgids");
        let (open_with, _) = hkcu
            .create_subkey(&open_with_path)
            .map_err(|error| error.to_string())?;
        open_with
            .set_value(&prog_id, &"")
            .map_err(|error| error.to_string())?;

        file_associations
            .set_value(*extension, &prog_id)
            .map_err(|error| error.to_string())?;
        supported_types
            .set_value(*extension, &"")
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[cfg(not(windows))]
fn register_file_associations() -> Result<(), String> {
    Err("File associations are supported only on Windows.".to_string())
}

fn open_default_apps() -> Result<(), String> {
    let registered_uri = "ms-settings:defaultapps?registeredAppUser=Windows%203D%20Viewer";
    if Command::new("explorer.exe").arg(registered_uri).spawn().is_ok() {
        return Ok(());
    }

    Command::new("explorer.exe")
        .arg("ms-settings:defaultapps")
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Could not open Windows Default Apps: {error}"))
}

fn dispatch_bridge(
    launch_state: &mut Option<LaunchState>,
    request: &BridgeRequest,
) -> Result<Value, String> {
    match request.command.as_str() {
        "app.registerFileAssociations" => {
            register_file_associations()?;
            Ok(json!({
                "registered": true,
                "requiresUserConfirmation": true,
                "version": APP_VERSION,
            }))
        }
        "app.openDefaultApps" => {
            open_default_apps()?;
            Ok(json!({ "opened": true }))
        }
        "app.getLaunchManifest" => Ok(launch_state
            .as_ref()
            .map(LaunchState::manifest)
            .unwrap_or(Value::Null)),
        "app.readLaunchFileChunk" => {
            let state = launch_state
                .as_ref()
                .ok_or_else(|| "There is no pending launch file.".to_string())?;
            read_launch_file_chunk(state, &request.payload)
        }
        "app.consumeLaunchRequest" => {
            let consumed = launch_state.take().is_some();
            Ok(json!({ "consumed": consumed }))
        }
        other => Err(format!("Unknown native command: {other}")),
    }
}

fn bridge_response_script(launch_state: &mut Option<LaunchState>, raw: &str) -> String {
    let request: BridgeRequest = match serde_json::from_str(raw) {
        Ok(request) => request,
        Err(_) => return String::new(),
    };

    let id = serde_json::to_string(&request.id).unwrap_or_else(|_| "\"\"".to_string());
    match dispatch_bridge(launch_state, &request) {
        Ok(value) => {
            let value = serde_json::to_string(&value).unwrap_or_else(|_| "null".to_string());
            format!("window.__w3dvResolve({id}, true, {value});")
        }
        Err(message) => {
            let error_value = serde_json::to_string(&json!({ "message": message }))
                .unwrap_or_else(|_| "{\"message\":\"Native command failed.\"}".to_string());
            format!("window.__w3dvResolve({id}, false, {error_value});")
        }
    }
}

fn write_fatal_log(message: &str) {
    let Ok(local_app_data) = env::var("LOCALAPPDATA") else {
        return;
    };
    let directory = PathBuf::from(local_app_data).join("Windows3DViewer");
    if fs::create_dir_all(&directory).is_ok() {
        let _ = fs::write(directory.join("startup-error.log"), message.as_bytes());
    }
}

fn run_app() -> Result<(), Box<dyn Error>> {
    let mut event_loop_builder = EventLoopBuilder::<UserEvent>::with_user_event();
    let event_loop = event_loop_builder.build();
    let proxy = event_loop.create_proxy();

    let window = WindowBuilder::new()
        .with_title(APP_NAME)
        .with_inner_size(LogicalSize::new(1400.0, 900.0))
        .with_min_inner_size(LogicalSize::new(800.0, 560.0))
        .build(&event_loop)?;

    let ipc_proxy = proxy.clone();
    let builder = WebViewBuilder::new()
        .with_custom_protocol("w3dv".into(), |_webview_id, request| {
            asset_response(request.uri().path())
        })
        .with_initialization_script(BRIDGE_INIT_SCRIPT)
        .with_ipc_handler(move |request| {
            let _ = ipc_proxy.send_event(UserEvent::Bridge(request.body().clone()));
        })
        .with_url("w3dv://localhost/index.html");

    #[cfg(windows)]
    let builder = {
        use wry::WebViewBuilderExtWindows;
        builder
            .with_https_scheme(true)
            .with_default_context_menus(false)
    };

    let webview = builder.build(&window)?;
    let mut launch_state = build_launch_state();

    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::Wait;
        let _keep_window_alive = &window;

        match event {
            Event::UserEvent(UserEvent::Bridge(raw)) => {
                let script = bridge_response_script(&mut launch_state, &raw);
                if !script.is_empty() {
                    let _ = webview.evaluate_script(&script);
                }
            }
            Event::WindowEvent {
                event: WindowEvent::CloseRequested,
                ..
            } => {
                *control_flow = ControlFlow::Exit;
            }
            _ => {}
        }
    });
}

fn main() {
    if let Err(error) = run_app() {
        let message = format!("Windows 3D Viewer failed to start:\n{error:#}");
        write_fatal_log(&message);
        #[cfg(debug_assertions)]
        eprintln!("{message}");
    }
}
