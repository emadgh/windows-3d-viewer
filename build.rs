fn main() {
    println!("cargo:rerun-if-changed=assets/windows-3d-viewer.ico");

    #[cfg(target_os = "windows")]
    {
        let mut resource = winres::WindowsResource::new();
        resource.set_icon("assets/windows-3d-viewer.ico");
        resource
            .compile()
            .expect("failed to embed Windows 3D Viewer application icon");
    }
}
