#[cfg(target_os = "windows")]
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
#[cfg(target_os = "windows")]
use std::{env, fs, path::PathBuf};

fn main() {
    println!("cargo:rerun-if-changed=assets/windows-3d-viewer.ico.b64");

    #[cfg(target_os = "windows")]
    {
        let encoded = fs::read_to_string("assets/windows-3d-viewer.ico.b64")
            .expect("failed to read Windows 3D Viewer icon resource");
        let bytes = BASE64
            .decode(encoded.trim())
            .expect("failed to decode Windows 3D Viewer icon resource");
        let icon_path = PathBuf::from(env::var_os("OUT_DIR").expect("OUT_DIR is set"))
            .join("windows-3d-viewer.ico");
        fs::write(&icon_path, bytes).expect("failed to stage Windows 3D Viewer icon resource");

        let mut resource = winres::WindowsResource::new();
        resource.set_icon(icon_path.to_string_lossy().as_ref());
        resource
            .compile()
            .expect("failed to embed Windows 3D Viewer application icon");
    }
}
