#![cfg_attr(windows, windows_subsystem = "windows")]

use std::{
    borrow::Cow,
    env,
    error::Error,
    fs::{self, File},
    io::{Read, Seek, SeekFrom},
    path::{Path, PathBuf},
};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use rust_embed::Embed;
use serde::Deserialize;
use serde_json::{json, Value};
use tao::{
    dpi::LogicalSize,
    event::{Event, WindowEvent},
    event_loop::{ControlFlow, EventLoopBuilder, EventLoopProxy},
    window::WindowBuilder,
};
use walkdir::WalkDir;
use wry::{
    http::{header::CONTENT_TYPE, Response},
    WebViewBuilder,
};

#[cfg(windows)]
use update_via_github::{UpdateConfig, UpdateManager, UpdateStatus};
#[cfg(windows)]
use winreg::{enums::HKEY_CURRENT_USER, RegKey};

const APP_NAME: &str = "Windows 3D Viewer";
const APP_EXE_NAME: &str = "windows-3d-viewer.exe";
const APP_VERSION: &str = env!("CARGO_PKG_VERSION");
const UPDATE_REPOSITORY: &str = "emadgh/windows-3d-viewer";
const UPDATE_CHECKSUM_ASSET: &str = "windows-3d-viewer.exe.sha256";
const FILE_CHUNK_BYTES: usize = 256 * 1024;

#[cfg(windows)]
type AppUpdater = UpdateManager;

#[cfg(not(windows))]
#[derive(Clone, Debug)]
struct AppUpdater;

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
    "bin", "mtl", "png", "jpg", "jpeg", "webp", "bmp", "tga", "dds", "ktx2", "gif", "hdr", "exr",
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
    OpenFile(PathBuf),
    LaunchReady(Option<LaunchState>),
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
    size: u64,
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
            "totalBytes": self.files.iter().map(|file| file.size).sum::<u64>(),
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

fn collect_gltf_uris(value: &Value, uris: &mut Vec<String>) {
    match value {
        Value::Object(object) => {
            if let Some(Value::String(uri)) = object.get("uri") {
                uris.push(uri.clone());
            }
            for value in object.values() {
                collect_gltf_uris(value, uris);
            }
        }
        Value::Array(values) => {
            for value in values {
                collect_gltf_uris(value, uris);
            }
        }
        _ => {}
    }
}

fn decode_uri_path(uri: &str) -> Option<String> {
    let uri = uri.split(['?', '#']).next()?;
    let bytes = uri.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;

    while index < bytes.len() {
        if bytes[index] == b'%' {
            let high = *bytes.get(index + 1)?;
            let low = *bytes.get(index + 2)?;
            let high = (high as char).to_digit(16)? as u8;
            let low = (low as char).to_digit(16)? as u8;
            decoded.push((high << 4) | low);
            index += 3;
        } else {
            decoded.push(bytes[index]);
            index += 1;
        }
    }

    String::from_utf8(decoded).ok()
}

fn gltf_document_json(model_path: &Path) -> Option<Vec<u8>> {
    const GLB_JSON_CHUNK: u32 = 0x4e4f534a;
    const MAX_JSON_BYTES: usize = 64 * 1024 * 1024;

    if extension_lower(model_path).as_deref() == Some("gltf") {
        let json = fs::read(model_path).ok()?;
        return (json.len() <= MAX_JSON_BYTES).then_some(json);
    }

    let mut file = File::open(model_path).ok()?;
    let mut header = [0_u8; 12];
    if file.read_exact(&mut header).is_err()
        || &header[0..4] != b"glTF"
        || u32::from_le_bytes(header[4..8].try_into().unwrap_or_default()) != 2
    {
        return None;
    }

    let mut chunk_header = [0_u8; 8];
    if file.read_exact(&mut chunk_header).is_err()
        || u32::from_le_bytes(chunk_header[4..8].try_into().unwrap_or_default()) != GLB_JSON_CHUNK
    {
        return None;
    }

    let json_length =
        u32::from_le_bytes(chunk_header[0..4].try_into().unwrap_or_default()) as usize;
    if json_length > MAX_JSON_BYTES {
        return None;
    }

    let mut json_bytes = vec![0_u8; json_length];
    file.read_exact(&mut json_bytes).ok()?;
    Some(json_bytes)
}

fn gltf_external_files(model_path: &Path, source_root: &Path) -> Vec<PathBuf> {
    let Some(json_bytes) = gltf_document_json(model_path) else {
        return Vec::new();
    };

    let Ok(document) = serde_json::from_slice::<Value>(&json_bytes) else {
        return Vec::new();
    };
    let mut uris = Vec::new();
    collect_gltf_uris(&document, &mut uris);

    let mut files = Vec::new();
    for uri in uris {
        if uri.starts_with("data:") || uri.contains("://") || uri.starts_with('/') {
            continue;
        }
        let Some(decoded) = decode_uri_path(&uri) else {
            continue;
        };
        if decoded.is_empty() {
            continue;
        }

        let candidate = source_root.join(decoded);
        let Ok(absolute) = fs::canonicalize(candidate) else {
            continue;
        };
        if !absolute.starts_with(source_root)
            || !absolute.is_file()
            || absolute == model_path
            || files.contains(&absolute)
        {
            continue;
        }
        files.push(absolute);
    }

    files
}

fn build_launch_state_for_path(requested: PathBuf) -> Option<LaunchState> {
    if !requested.is_file() || !is_supported_model(&requested) {
        return None;
    }

    let primary_absolute = fs::canonicalize(&requested).ok()?;
    let source_root = primary_absolute.parent()?.to_path_buf();
    let primary = primary_absolute.file_name()?.to_string_lossy().into_owned();
    let primary_size = fs::metadata(&primary_absolute).ok()?.len();

    let mut files = vec![LaunchFile {
        relative: primary.clone(),
        absolute: primary_absolute.clone(),
        size: primary_size,
    }];

    let sidecar_paths = match extension_lower(&primary_absolute).as_deref() {
        Some("glb" | "gltf") => gltf_external_files(&primary_absolute, &source_root),
        Some("stl" | "ply" | "3mf" | "usdz") => Vec::new(),
        _ => WalkDir::new(&source_root)
            .follow_links(false)
            .into_iter()
            .filter_map(Result::ok)
            .filter(|entry| entry.file_type().is_file())
            .filter_map(|entry| {
                let path = entry.into_path();
                let extension = extension_lower(&path)?;
                SIDECAR_EXTENSIONS
                    .contains(&extension.as_str())
                    .then_some(path)
            })
            .collect(),
    };

    for path in sidecar_paths {
        if path == primary_absolute {
            continue;
        }
        let Ok(relative_path) = path.strip_prefix(&source_root) else {
            continue;
        };
        let size = fs::metadata(&path)
            .map(|metadata| metadata.len())
            .unwrap_or(0);
        files.push(LaunchFile {
            relative: path_to_web(relative_path),
            absolute: path,
            size,
        });
    }

    files[1..].sort_by(|left, right| left.relative.cmp(&right.relative));
    Some(LaunchState { primary, files })
}

fn build_launch_state() -> Option<LaunchState> {
    // Explorer passes the selected file as a normal quoted argument. Look for
    // the first existing supported model instead of assuming it is the first
    // non-option argument; this also tolerates future launch flags and avoids
    // silently ignoring a valid path when an unrelated argument is present.
    let requested = env::args_os()
        .skip(1)
        .map(PathBuf::from)
        .find(|path| path.is_file() && is_supported_model(path))?;

    build_launch_state_for_path(requested)
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
    let key = if requested.is_empty() {
        "index.html"
    } else {
        requested
    };

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
        .map_err(|error| {
            format!(
                "Could not inspect {}: {error}",
                launch_file.absolute.display()
            )
        })?
        .len();

    if offset > length {
        return Err(format!(
            "Invalid launch file offset {offset} for {relative}."
        ));
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
        "length": length,
    }))
}

#[cfg(windows)]
const INSTANCE_SETTINGS_RELATIVE: &str = r"Software\EmadGH\Windows3DViewer\Settings";
#[cfg(windows)]
const SINGLE_INSTANCE_MUTEX_NAME: &str = r"Local\EmadGH.Windows3DViewer.SingleInstance";
#[cfg(windows)]
const SINGLE_INSTANCE_EVENT_NAME: &str = r"Local\EmadGH.Windows3DViewer.OpenFile";
#[cfg(windows)]
const SINGLE_INSTANCE_PENDING_FILE: &str = "single-instance-open.txt";
#[cfg(windows)]
const INSTANCE_MODE_VALUE: &str = "SingleInstance";
#[cfg(windows)]
const ERROR_ALREADY_EXISTS: u32 = 183;
#[cfg(windows)]
const EVENT_MODIFY_STATE: u32 = 0x0002;
#[cfg(windows)]
const INFINITE: u32 = 0xffff_ffff;
#[cfg(windows)]
const WAIT_OBJECT_0: u32 = 0;

#[cfg(windows)]
enum SingleInstanceGuard {
    Disabled,
    Primary {
        _mutex: isize,
        _event: isize,
        _pending_path: PathBuf,
    },
}

#[cfg(windows)]
fn wide_null(value: &str) -> Vec<u16> {
    use std::{ffi::OsStr, iter::once, os::windows::ffi::OsStrExt};

    OsStr::new(value).encode_wide().chain(once(0)).collect()
}

#[cfg(windows)]
fn instance_pending_path() -> Result<PathBuf, String> {
    let preferred = env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .map(|path| path.join("Windows3DViewer"));
    let fallback = env::temp_dir().join("Windows3DViewer");

    for directory in preferred.into_iter().chain(std::iter::once(fallback)) {
        if fs::create_dir_all(&directory).is_ok() {
            return Ok(directory.join(SINGLE_INSTANCE_PENDING_FILE));
        }
    }

    Err("Could not create a writable instance data directory.".to_string())
}

#[cfg(windows)]
fn single_instance_enabled() -> bool {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    hkcu.open_subkey(INSTANCE_SETTINGS_RELATIVE)
        .ok()
        .and_then(|settings| settings.get_value::<u32, _>(INSTANCE_MODE_VALUE).ok())
        .map(|value| value != 0)
        .unwrap_or(true)
}

#[cfg(not(windows))]
fn single_instance_enabled() -> bool {
    true
}

#[cfg(windows)]
fn set_single_instance_enabled(enabled: bool) -> Result<(), String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let (settings, _) = hkcu
        .create_subkey(INSTANCE_SETTINGS_RELATIVE)
        .map_err(|error| format!("Could not save instance mode: {error}"))?;
    settings
        .set_value(INSTANCE_MODE_VALUE, &(enabled as u32))
        .map_err(|error| format!("Could not save instance mode: {error}"))
}

#[cfg(not(windows))]
fn set_single_instance_enabled(_enabled: bool) -> Result<(), String> {
    Err("Instance mode is supported only on Windows.".to_string())
}

#[cfg(windows)]
fn forward_to_primary_instance() -> Result<(), String> {
    let pending_path = instance_pending_path()?;
    let requested = env::args_os()
        .skip(1)
        .map(PathBuf::from)
        .find(|path| path.is_file() && is_supported_model(path))
        .map(|path| path.to_string_lossy().into_owned())
        .unwrap_or_default();
    fs::write(&pending_path, requested.as_bytes())
        .map_err(|error| format!("Could not queue file for the running instance: {error}"))?;

    let event_name = wide_null(SINGLE_INSTANCE_EVENT_NAME);
    for _ in 0..50 {
        let event = unsafe { OpenEventW(EVENT_MODIFY_STATE, 0, event_name.as_ptr()) };
        if !event.is_null() {
            let signaled = unsafe { SetEvent(event) } != 0;
            unsafe {
                CloseHandle(event);
            }
            if signaled {
                return Ok(());
            }
            return Err("Could not notify the running Windows 3D Viewer instance.".to_string());
        }
        std::thread::sleep(std::time::Duration::from_millis(20));
    }

    Err("The running Windows 3D Viewer instance could not be reached.".to_string())
}

#[cfg(windows)]
fn establish_single_instance(
    proxy: &EventLoopProxy<UserEvent>,
) -> Result<Option<SingleInstanceGuard>, String> {
    if !single_instance_enabled() {
        return Ok(Some(SingleInstanceGuard::Disabled));
    }

    let mutex_name = wide_null(SINGLE_INSTANCE_MUTEX_NAME);
    let mutex = unsafe { CreateMutexW(std::ptr::null(), 0, mutex_name.as_ptr()) };
    if mutex.is_null() {
        return Err(format!(
            "Could not create the single-instance mutex: {}",
            unsafe { GetLastError() }
        ));
    }

    if unsafe { GetLastError() } == ERROR_ALREADY_EXISTS {
        unsafe {
            CloseHandle(mutex);
        }
        forward_to_primary_instance()?;
        return Ok(None);
    }

    let pending_path = instance_pending_path()?;
    let _ = fs::remove_file(&pending_path);
    let event_name = wide_null(SINGLE_INSTANCE_EVENT_NAME);
    let event = unsafe { CreateEventW(std::ptr::null(), 0, 0, event_name.as_ptr()) };
    if event.is_null() {
        unsafe {
            CloseHandle(mutex);
        }
        return Err(format!(
            "Could not create the single-instance event: {}",
            unsafe { GetLastError() }
        ));
    }

    let event_handle = event as isize;
    let listener_path = pending_path.clone();
    let listener_proxy = proxy.clone();
    std::thread::spawn(move || loop {
        let result =
            unsafe { WaitForSingleObject(event_handle as *mut std::ffi::c_void, INFINITE) };
        if result != WAIT_OBJECT_0 {
            break;
        }

        let Ok(contents) = fs::read_to_string(&listener_path) else {
            continue;
        };
        let _ = fs::remove_file(&listener_path);
        let path = PathBuf::from(contents.trim());
        if !path.as_os_str().is_empty() {
            let _ = listener_proxy.send_event(UserEvent::OpenFile(path));
        }
    });

    Ok(Some(SingleInstanceGuard::Primary {
        _mutex: mutex as isize,
        _event: event_handle,
        _pending_path: pending_path,
    }))
}

#[cfg(windows)]
#[link(name = "kernel32")]
unsafe extern "system" {
    fn CreateMutexW(
        mutex_attributes: *const std::ffi::c_void,
        initial_owner: i32,
        name: *const u16,
    ) -> *mut std::ffi::c_void;
    fn CreateEventW(
        event_attributes: *const std::ffi::c_void,
        manual_reset: i32,
        initial_state: i32,
        name: *const u16,
    ) -> *mut std::ffi::c_void;
    fn OpenEventW(
        desired_access: u32,
        inherit_handle: i32,
        name: *const u16,
    ) -> *mut std::ffi::c_void;
    fn SetEvent(event: *mut std::ffi::c_void) -> i32;
    fn WaitForSingleObject(handle: *mut std::ffi::c_void, milliseconds: u32) -> u32;
    fn CloseHandle(handle: *mut std::ffi::c_void) -> i32;
    fn GetLastError() -> u32;
}

#[cfg(windows)]
fn register_file_associations() -> Result<(), String> {
    use std::ptr;

    let exe = env::current_exe()
        .map_err(|error| format!("Could not resolve executable path: {error}"))?;
    let exe_text = exe.to_string_lossy();
    let open_command = format!("\"{exe_text}\" \"%1\"");

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
    let application_icon = format!("{exe_text},0");
    capabilities
        .set_value("ApplicationIcon", &application_icon)
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
    let (application_icon_key, _) = application
        .create_subkey("DefaultIcon")
        .map_err(|error| error.to_string())?;
    application_icon_key
        .set_value("", &application_icon)
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
        let (prog_key, _) = hkcu
            .create_subkey(&prog_path)
            .map_err(|error| error.to_string())?;
        let description = format!("Windows 3D Viewer {label} File");
        prog_key
            .set_value("", &description)
            .map_err(|error| error.to_string())?;

        // Do not assign the application icon to associated model files. Removing any
        // legacy DefaultIcon value lets Windows Shell use its normal/default file icon.
        let _ = prog_key.delete_subkey_all("DefaultIcon");

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

    // Explorer caches association and icon changes. Refresh it immediately so
    // Open With and the Default Apps page see the registration from this run.
    unsafe {
        SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, ptr::null(), ptr::null());
    }

    Ok(())
}

#[cfg(not(windows))]
fn register_file_associations() -> Result<(), String> {
    Err("File associations are supported only on Windows.".to_string())
}

#[cfg(windows)]
fn open_default_apps() -> Result<(), String> {
    use std::{ffi::OsStr, iter::once, os::windows::ffi::OsStrExt, ptr};

    fn wide(value: &str) -> Vec<u16> {
        OsStr::new(value).encode_wide().chain(once(0)).collect()
    }

    let operation = wide("open");
    let uri = wide("ms-settings:defaultapps?registeredAppUser=Windows%203D%20Viewer");
    let result = unsafe {
        ShellExecuteW(
            ptr::null_mut(),
            operation.as_ptr(),
            uri.as_ptr(),
            ptr::null(),
            ptr::null(),
            SW_SHOWNORMAL,
        )
    };

    if result as usize > 32 {
        Ok(())
    } else {
        Err(format!(
            "Could not open Windows Default Apps (ShellExecuteW returned {result})."
        ))
    }
}

#[cfg(not(windows))]
fn open_default_apps() -> Result<(), String> {
    Err("Windows Default Apps are available only on Windows.".to_string())
}

#[cfg(windows)]
const SHCNE_ASSOCCHANGED: u32 = 0x0800_0000;
#[cfg(windows)]
const SHCNF_IDLIST: u32 = 0x0000;
#[cfg(windows)]
const SW_SHOWNORMAL: i32 = 1;

#[cfg(windows)]
#[link(name = "shell32")]
unsafe extern "system" {
    fn SHChangeNotify(
        event_id: u32,
        flags: u32,
        item1: *const std::ffi::c_void,
        item2: *const std::ffi::c_void,
    );
    fn ShellExecuteW(
        hwnd: *mut std::ffi::c_void,
        operation: *const u16,
        file: *const u16,
        parameters: *const u16,
        directory: *const u16,
        show_command: i32,
    ) -> isize;
}

#[cfg(windows)]
fn build_updater() -> AppUpdater {
    let config = UpdateConfig::new(UPDATE_REPOSITORY, APP_EXE_NAME, APP_VERSION)
        .with_app_name(APP_NAME)
        .with_checksum_asset(UPDATE_CHECKSUM_ASSET)
        .with_required_checksum(true)
        .with_max_download_size(128 * 1024 * 1024)
        .with_min_executable_size(500_000);
    UpdateManager::new(config)
}

#[cfg(not(windows))]
fn build_updater() -> AppUpdater {
    AppUpdater
}

#[cfg(windows)]
fn start_initial_update_check(updater: &AppUpdater) {
    let _ = updater.start_check(false);
}

#[cfg(not(windows))]
fn start_initial_update_check(_updater: &AppUpdater) {}

#[cfg(windows)]
fn update_status_json(updater: &AppUpdater) -> Value {
    match updater.status() {
        UpdateStatus::Idle => json!({
            "state": "idle",
            "currentVersion": APP_VERSION,
        }),
        UpdateStatus::Checking => json!({
            "state": "checking",
            "currentVersion": APP_VERSION,
        }),
        UpdateStatus::UpToDate => json!({
            "state": "up-to-date",
            "currentVersion": APP_VERSION,
        }),
        UpdateStatus::Available(info) => json!({
            "state": "available",
            "currentVersion": APP_VERSION,
            "latestVersion": info.version,
            "releaseUrl": info.release_url,
        }),
        UpdateStatus::Downloading {
            info,
            downloaded,
            total,
        } => json!({
            "state": "downloading",
            "currentVersion": APP_VERSION,
            "latestVersion": info.version,
            "releaseUrl": info.release_url,
            "downloaded": downloaded,
            "total": total,
        }),
        UpdateStatus::Ready(info, _) => json!({
            "state": "ready",
            "currentVersion": APP_VERSION,
            "latestVersion": info.version,
            "releaseUrl": info.release_url,
        }),
        UpdateStatus::Failed(message) => json!({
            "state": "failed",
            "currentVersion": APP_VERSION,
            "message": message,
        }),
    }
}

#[cfg(not(windows))]
fn update_status_json(_updater: &AppUpdater) -> Value {
    json!({
        "state": "unsupported",
        "currentVersion": APP_VERSION,
        "message": "Automatic updates are available only in the packaged Windows application.",
    })
}

#[cfg(windows)]
fn dispatch_updater_command(updater: &AppUpdater, command: &str) -> Result<Value, String> {
    match command {
        "app.getUpdateStatus" => Ok(update_status_json(updater)),
        "app.checkForUpdates" => {
            let _ = updater.start_check(false);
            Ok(update_status_json(updater))
        }
        "app.downloadUpdate" => {
            let _ = updater.start_download();
            Ok(update_status_json(updater))
        }
        "app.applyUpdate" => {
            if !updater.apply_ready()? {
                return Err("No downloaded update is ready to install.".to_string());
            }

            std::thread::spawn(|| {
                std::thread::sleep(std::time::Duration::from_millis(350));
                std::process::exit(0);
            });

            Ok(json!({
                "applying": true,
                "currentVersion": APP_VERSION,
            }))
        }
        _ => Err(format!("Unknown updater command: {command}")),
    }
}

#[cfg(not(windows))]
fn dispatch_updater_command(_updater: &AppUpdater, command: &str) -> Result<Value, String> {
    match command {
        "app.getUpdateStatus" => Ok(update_status_json(_updater)),
        _ => Err("Automatic updates are supported only on Windows.".to_string()),
    }
}

fn dispatch_bridge(
    launch_state: &mut Option<LaunchState>,
    updater: &AppUpdater,
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
        "app.getInstanceMode" => Ok(json!({
            "singleInstance": single_instance_enabled(),
        })),
        "app.setInstanceMode" => {
            let single_instance = request
                .payload
                .get("singleInstance")
                .and_then(Value::as_bool)
                .ok_or_else(|| "Missing singleInstance setting.".to_string())?;
            set_single_instance_enabled(single_instance)?;
            Ok(json!({
                "singleInstance": single_instance,
                "restartRequired": true,
            }))
        }
        "app.getUpdateStatus"
        | "app.checkForUpdates"
        | "app.downloadUpdate"
        | "app.applyUpdate" => dispatch_updater_command(updater, request.command.as_str()),
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

fn bridge_response_script(
    launch_state: &mut Option<LaunchState>,
    updater: &AppUpdater,
    raw: &str,
) -> String {
    let request: BridgeRequest = match serde_json::from_str(raw) {
        Ok(request) => request,
        Err(_) => return String::new(),
    };

    let id = serde_json::to_string(&request.id).unwrap_or_else(|_| "\"\"".to_string());
    match dispatch_bridge(launch_state, updater, &request) {
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

    #[cfg(windows)]
    let instance_guard = match establish_single_instance(&proxy)? {
        Some(guard) => guard,
        None => return Ok(()),
    };

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
    let updater = build_updater();
    start_initial_update_check(&updater);
    #[cfg(windows)]
    let _keep_instance_guard_alive = &instance_guard;

    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::Wait;
        let _keep_window_alive = &window;

        match event {
            Event::UserEvent(UserEvent::Bridge(raw)) => {
                let script = bridge_response_script(&mut launch_state, &updater, &raw);
                if !script.is_empty() {
                    let _ = webview.evaluate_script(&script);
                }
            }
            Event::UserEvent(UserEvent::OpenFile(path)) => {
                let file_name = path
                    .file_name()
                    .map(|name| name.to_string_lossy().into_owned())
                    .unwrap_or_else(|| path.to_string_lossy().into_owned());
                let file_name =
                    serde_json::to_string(&file_name).unwrap_or_else(|_| "\"model\"".to_string());
                let _ = webview.evaluate_script(&format!(
                    "window.__w3dvShowNativeOpenStatus?.({file_name});"
                ));

                let launch_proxy = proxy.clone();
                std::thread::spawn(move || {
                    let state = build_launch_state_for_path(path);
                    let _ = launch_proxy.send_event(UserEvent::LaunchReady(state));
                });
            }
            Event::UserEvent(UserEvent::LaunchReady(Some(state))) => {
                launch_state = Some(state);
                let _ = webview.evaluate_script("window.__w3dvOpenNativeLaunchFile?.();");
            }
            Event::UserEvent(UserEvent::LaunchReady(None)) => {}
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
