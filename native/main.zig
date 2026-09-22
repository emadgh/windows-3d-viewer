const std = @import("std");
const runner = @import("runner");
const native_sdk = @import("native_sdk");
const embedded_assets = @import("embedded_assets.zig");

pub const panic = std.debug.FullPanic(native_sdk.debug.capturePanic);

extern "kernel32" fn SetDllDirectoryW(lpPathName: [*:0]const u16) callconv(.winapi) i32;

const bridge_origins = [_][]const u8{
    "zero://app",
    "zero://inline",
    "http://127.0.0.1:5173",
};

const bridge_policies = [_]native_sdk.BridgeCommandPolicy{
    .{ .name = "app.registerFileAssociations", .origins = &bridge_origins },
    .{ .name = "app.openDefaultApps", .origins = &bridge_origins },
    .{ .name = "app.getLaunchManifest", .origins = &bridge_origins },
    .{ .name = "app.readLaunchFileChunk", .origins = &bridge_origins },
    .{ .name = "app.consumeLaunchRequest", .origins = &bridge_origins },
};

const launch_dir_name = "Windows3DViewer";
const runtime_dir_name = "runtime";
const launch_cache_name = "launch-cache";
const launch_manifest_name = "launch.json";
const max_manifest_bytes = 10 * 1024;
const file_chunk_bytes = 6000;

const register_associations_script =
    \\$ErrorActionPreference = 'Stop'
    \\$parentPid = (Get-CimInstance Win32_Process -Filter ("ProcessId=" + $PID)).ParentProcessId
    \\$exe = (Get-Process -Id $parentPid -ErrorAction Stop).Path
    \\if ([string]::IsNullOrWhiteSpace($exe)) { throw 'Could not resolve application executable path.' }
    \\$launcher = Join-Path $env:LOCALAPPDATA 'Windows3DViewer\\runtime\\open-model.ps1'
    \\if (-not (Test-Path -LiteralPath $launcher)) { throw ('File association launcher is missing: ' + $launcher) }
    \\$launchCommand = ('powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}" "{1}" "%1"' -f $launcher, $exe)
    \\$appName = 'Windows 3D Viewer'
    \\$capRelative = 'Software\\EmadGH\\Windows3DViewer\\Capabilities'
    \\$capPath = 'HKCU:\\' + $capRelative
    \\$classes = 'HKCU:\\Software\\Classes'
    \\$extensions = @('.glb','.gltf','.fbx','.obj','.stl','.ply','.dae','.3mf','.3ds','.usdz','.wrl','.vrml')
    \\$labels = @{'glb'='GLB';'gltf'='glTF';'fbx'='FBX';'obj'='OBJ';'stl'='STL';'ply'='PLY';'dae'='COLLADA';'3mf'='3MF';'3ds'='3DS';'usdz'='USDZ';'wrl'='VRML';'vrml'='VRML'}
    \\New-Item -Path $capPath -Force | Out-Null
    \\New-ItemProperty -Path $capPath -Name 'ApplicationName' -Value $appName -PropertyType String -Force | Out-Null
    \\New-ItemProperty -Path $capPath -Name 'ApplicationDescription' -Value 'Fast local 3D model viewer' -PropertyType String -Force | Out-Null
    \\$fileAssocPath = Join-Path $capPath 'FileAssociations'
    \\New-Item -Path $fileAssocPath -Force | Out-Null
    \\$registeredApps = 'HKCU:\\Software\\RegisteredApplications'
    \\New-Item -Path $registeredApps -Force | Out-Null
    \\New-ItemProperty -Path $registeredApps -Name $appName -Value $capRelative -PropertyType String -Force | Out-Null
    \\$applicationKey = Join-Path $classes 'Applications\\windows-3d-viewer.exe'
    \\New-Item -Path $applicationKey -Force | Out-Null
    \\New-ItemProperty -Path $applicationKey -Name 'FriendlyAppName' -Value $appName -PropertyType String -Force | Out-Null
    \\$applicationCommand = Join-Path $applicationKey 'shell\\open\\command'
    \\New-Item -Path $applicationCommand -Force | Out-Null
    \\Set-Item -Path $applicationCommand -Value $launchCommand
    \\$supportedTypes = Join-Path $applicationKey 'SupportedTypes'
    \\New-Item -Path $supportedTypes -Force | Out-Null
    \\foreach ($ext in $extensions) {
    \\    $token = $ext.TrimStart('.')
    \\    $progId = 'Windows3DViewer.' + $token
    \\    $progKey = Join-Path $classes $progId
    \\    New-Item -Path $progKey -Force | Out-Null
    \\    $label = if ($labels.ContainsKey($token)) { $labels[$token] } else { $token.ToUpperInvariant() }
    \\    Set-Item -Path $progKey -Value ('Windows 3D Viewer ' + $label + ' File')
    \\    $iconKey = Join-Path $progKey 'DefaultIcon'
    \\    New-Item -Path $iconKey -Force | Out-Null
    \\    Set-Item -Path $iconKey -Value ('"{0}",0' -f $exe)
    \\    $commandKey = Join-Path $progKey 'shell\\open\\command'
    \\    New-Item -Path $commandKey -Force | Out-Null
    \\    Set-Item -Path $commandKey -Value $launchCommand
    \\    $openWith = Join-Path $classes ($ext + '\\OpenWithProgids')
    \\    New-Item -Path $openWith -Force | Out-Null
    \\    New-ItemProperty -Path $openWith -Name $progId -Value '' -PropertyType String -Force | Out-Null
    \\    New-ItemProperty -Path $fileAssocPath -Name $ext -Value $progId -PropertyType String -Force | Out-Null
    \\    New-ItemProperty -Path $supportedTypes -Name $ext -Value '' -PropertyType String -Force | Out-Null
    \\}
;

const open_default_apps_script =
    \\$ErrorActionPreference = 'Stop'
    \\$uri = 'ms-settings:defaultapps?registeredAppUser=Windows%203D%20Viewer'
    \\try { Start-Process $uri -ErrorAction Stop } catch { Start-Process 'ms-settings:defaultapps' -ErrorAction Stop }
;

const ChunkRequest = struct {
    path: []const u8,
    offset: u64 = 0,
};

const EmbeddedRuntime = struct {
    root: []u8,
    asset_root: []u8,
};

fn fileExists(io: std.Io, path: []const u8) bool {
    std.Io.Dir.cwd().access(io, path, .{}) catch return false;
    return true;
}

fn prepareEmbeddedRuntime(init: std.process.Init) !EmbeddedRuntime {
    const local_app_data = init.environ_map.get("LOCALAPPDATA") orelse return error.LocalAppDataUnavailable;
    const root = try std.fs.path.join(init.gpa, &.{ local_app_data, launch_dir_name, runtime_dir_name });
    errdefer init.gpa.free(root);

    try std.Io.Dir.cwd().makePath(init.io, root);

    const marker_name = try std.fmt.allocPrint(init.gpa, ".payload-{s}.ready", .{embedded_assets.version});
    defer init.gpa.free(marker_name);
    const marker_path = try std.fs.path.join(init.gpa, &.{ root, marker_name });
    defer init.gpa.free(marker_path);
    const loader_path = try std.fs.path.join(init.gpa, &.{ root, "WebView2Loader.dll" });
    defer init.gpa.free(loader_path);
    const launcher_path = try std.fs.path.join(init.gpa, &.{ root, "open-model.ps1" });
    defer init.gpa.free(launcher_path);
    const index_path = try std.fs.path.join(init.gpa, &.{ root, "frontend", "dist", "index.html" });
    defer init.gpa.free(index_path);

    const ready = fileExists(init.io, marker_path) and
        fileExists(init.io, loader_path) and
        fileExists(init.io, launcher_path) and
        fileExists(init.io, index_path);

    if (!ready) {
        for (embedded_assets.assets) |asset| {
            const destination = try std.fs.path.join(init.gpa, &.{ root, asset.path });
            defer init.gpa.free(destination);
            if (std.fs.path.dirname(destination)) |parent| {
                try std.Io.Dir.cwd().makePath(init.io, parent);
            }
            try std.Io.Dir.cwd().writeFile(init.io, .{
                .sub_path = destination,
                .data = asset.data,
            });
        }
        try std.Io.Dir.cwd().writeFile(init.io, .{
            .sub_path = marker_path,
            .data = embedded_assets.version,
        });
    }

    const root_w = try std.unicode.utf8ToUtf16LeAllocZ(init.gpa, root);
    defer init.gpa.free(root_w);
    if (SetDllDirectoryW(root_w.ptr) == 0) return error.SetDllDirectoryFailed;

    const asset_root = try std.fs.path.join(init.gpa, &.{ root, "frontend", "dist" });
    errdefer init.gpa.free(asset_root);
    return .{ .root = root, .asset_root = asset_root };
}

const ViewerApp = struct {
    env_map: *std.process.Environ.Map,
    allocator: std.mem.Allocator,
    io: std.Io,
    asset_root: []const u8,
    bridge_handlers: [5]native_sdk.BridgeHandler = undefined,

    fn app(self: *@This()) native_sdk.App {
        return .{
            .context = self,
            .name = "windows-3d-viewer",
            .source = native_sdk.frontend.productionSource(.{
                .dist = self.asset_root,
                .entry = "index.html",
            }),
            .source_fn = source,
        };
    }

    fn source(context: *anyopaque) anyerror!native_sdk.WebViewSource {
        const self: *@This() = @ptrCast(@alignCast(context));
        return native_sdk.frontend.sourceFromEnv(self.env_map, .{
            .dist = self.asset_root,
            .entry = "index.html",
        });
    }

    fn bridge(self: *@This()) native_sdk.BridgeDispatcher {
        self.bridge_handlers = .{
            .{ .name = "app.registerFileAssociations", .context = self, .invoke_fn = registerFileAssociations },
            .{ .name = "app.openDefaultApps", .context = self, .invoke_fn = openDefaultApps },
            .{ .name = "app.getLaunchManifest", .context = self, .invoke_fn = getLaunchManifest },
            .{ .name = "app.readLaunchFileChunk", .context = self, .invoke_fn = readLaunchFileChunk },
            .{ .name = "app.consumeLaunchRequest", .context = self, .invoke_fn = consumeLaunchRequest },
        };
        return .{
            .policy = .{ .enabled = true, .commands = &bridge_policies },
            .registry = .{ .handlers = &self.bridge_handlers },
        };
    }

    fn runPowerShell(self: *@This(), script: []const u8) !void {
        const result = try std.process.run(self.allocator, self.io, .{
            .argv = &.{
                "powershell.exe",
                "-NoLogo",
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-WindowStyle",
                "Hidden",
                "-Command",
                script,
            },
            .stdout_limit = .limited(16 * 1024),
            .stderr_limit = .limited(16 * 1024),
        });
        defer self.allocator.free(result.stdout);
        defer self.allocator.free(result.stderr);

        if (result.term != .exited or result.term.exited != 0) {
            if (result.stderr.len > 0) std.debug.print("PowerShell command failed: {s}\n", .{result.stderr});
            return error.PowerShellCommandFailed;
        }
    }

    fn launchRoot(self: *@This()) ![]u8 {
        const local_app_data = self.env_map.get("LOCALAPPDATA") orelse return error.LocalAppDataUnavailable;
        return std.fs.path.join(self.allocator, &.{ local_app_data, launch_dir_name, launch_cache_name });
    }

    fn validRelativeLaunchPath(path: []const u8) bool {
        if (path.len == 0 or std.fs.path.isAbsolute(path)) return false;
        if (std.mem.indexOfScalar(u8, path, ':') != null) return false;
        var parts = std.mem.splitAny(u8, path, "/\\");
        while (parts.next()) |part| {
            if (std.mem.eql(u8, part, "..")) return false;
        }
        return true;
    }

    fn registerFileAssociations(context: *anyopaque, invocation: native_sdk.bridge.Invocation, output: []u8) anyerror![]const u8 {
        _ = invocation;
        _ = output;
        const self: *@This() = @ptrCast(@alignCast(context));
        try self.runPowerShell(register_associations_script);
        return "{\"registered\":true,\"requiresUserConfirmation\":true}";
    }

    fn openDefaultApps(context: *anyopaque, invocation: native_sdk.bridge.Invocation, output: []u8) anyerror![]const u8 {
        _ = invocation;
        _ = output;
        const self: *@This() = @ptrCast(@alignCast(context));
        try self.runPowerShell(open_default_apps_script);
        return "{\"opened\":true}";
    }

    fn getLaunchManifest(context: *anyopaque, invocation: native_sdk.bridge.Invocation, output: []u8) anyerror![]const u8 {
        _ = invocation;
        const self: *@This() = @ptrCast(@alignCast(context));
        const root = try self.launchRoot();
        defer self.allocator.free(root);
        const manifest_path = try std.fs.path.join(self.allocator, &.{ root, launch_manifest_name });
        defer self.allocator.free(manifest_path);

        const manifest = std.Io.Dir.cwd().readFileAlloc(self.io, manifest_path, self.allocator, .limited(max_manifest_bytes)) catch return "null";
        defer self.allocator.free(manifest);
        if (manifest.len > output.len) return error.LaunchManifestTooLarge;
        @memcpy(output[0..manifest.len], manifest);
        return output[0..manifest.len];
    }

    fn readLaunchFileChunk(context: *anyopaque, invocation: native_sdk.bridge.Invocation, output: []u8) anyerror![]const u8 {
        const self: *@This() = @ptrCast(@alignCast(context));
        var parsed = try std.json.parseFromSlice(ChunkRequest, self.allocator, invocation.request.payload, .{});
        defer parsed.deinit();
        const request = parsed.value;
        if (!validRelativeLaunchPath(request.path)) return error.InvalidLaunchPath;

        const root = try self.launchRoot();
        defer self.allocator.free(root);
        const file_path = try std.fs.path.join(self.allocator, &.{ root, request.path });
        defer self.allocator.free(file_path);

        var file = try std.Io.Dir.cwd().openFile(self.io, file_path, .{});
        defer file.close(self.io);
        const stat = try file.stat(self.io);
        if (request.offset > stat.size) return error.InvalidLaunchOffset;

        var chunk: [file_chunk_bytes]u8 = undefined;
        const read_len = try file.readPositionalAll(self.io, &chunk, request.offset);
        const next_offset = request.offset + read_len;
        const eof_text = if (next_offset >= stat.size) "true" else "false";

        var encoded: [std.base64.standard.Encoder.calcSize(file_chunk_bytes)]u8 = undefined;
        const encoded_len = std.base64.standard.Encoder.calcSize(read_len);
        const data = std.base64.standard.Encoder.encode(encoded[0..encoded_len], chunk[0..read_len]);
        return std.fmt.bufPrint(output, "{{\"data\":\"{s}\",\"nextOffset\":{d},\"eof\":{s}}}", .{ data, next_offset, eof_text });
    }

    fn consumeLaunchRequest(context: *anyopaque, invocation: native_sdk.bridge.Invocation, output: []u8) anyerror![]const u8 {
        _ = invocation;
        _ = output;
        const self: *@This() = @ptrCast(@alignCast(context));
        const root = try self.launchRoot();
        defer self.allocator.free(root);
        const manifest_path = try std.fs.path.join(self.allocator, &.{ root, launch_manifest_name });
        defer self.allocator.free(manifest_path);
        std.Io.Dir.cwd().deleteFile(self.io, manifest_path) catch {};
        return "{\"consumed\":true}";
    }
};

pub fn main(init: std.process.Init) !void {
    const runtime = try prepareEmbeddedRuntime(init);
    defer init.gpa.free(runtime.asset_root);
    defer init.gpa.free(runtime.root);

    var app = ViewerApp{
        .env_map = init.environ_map,
        .allocator = init.gpa,
        .io = init.io,
        .asset_root = runtime.asset_root,
    };

    try runner.runWithOptions(app.app(), .{
        .app_name = "Windows 3D Viewer",
        .window_title = "Windows 3D Viewer",
        .bundle_id = "com.emadgh.windows3dviewer",
        .bridge = app.bridge(),
        .security = .{
            .navigation = .{ .allowed_origins = &bridge_origins },
        },
    }, init);
}
