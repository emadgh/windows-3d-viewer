const std = @import("std");
const runner = @import("runner");
const native_sdk = @import("native_sdk");

pub const panic = std.debug.FullPanic(native_sdk.debug.capturePanic);

const bridge_origins = [_][]const u8{
    "zero://app",
    "http://127.0.0.1:5173",
};

const bridge_policies = [_]native_sdk.BridgeCommandPolicy{
    .{ .name = "app.registerFileAssociations", .origins = &bridge_origins },
    .{ .name = "app.openDefaultApps", .origins = &bridge_origins },
};

const register_associations_script =
    \\$ErrorActionPreference = 'Stop'
    \\$parentPid = (Get-CimInstance Win32_Process -Filter ("ProcessId=" + $PID)).ParentProcessId
    \\$exe = (Get-Process -Id $parentPid -ErrorAction Stop).Path
    \\if ([string]::IsNullOrWhiteSpace($exe)) { throw 'Could not resolve application executable path.' }
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
    \\Set-Item -Path $applicationCommand -Value ('"{0}" "%1"' -f $exe)
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
    \\    Set-Item -Path $commandKey -Value ('"{0}" "%1"' -f $exe)
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

const ViewerApp = struct {
    env_map: *std.process.Environ.Map,
    allocator: std.mem.Allocator,
    io: std.Io,
    bridge_handlers: [2]native_sdk.BridgeHandler = undefined,

    fn app(self: *@This()) native_sdk.App {
        return .{
            .context = self,
            .name = "windows-3d-viewer",
            .source = native_sdk.frontend.productionSource(.{ .dist = "frontend/dist" }),
            .source_fn = source,
        };
    }

    fn source(context: *anyopaque) anyerror!native_sdk.WebViewSource {
        const self: *@This() = @ptrCast(@alignCast(context));
        return native_sdk.frontend.sourceFromEnv(self.env_map, .{
            .dist = "frontend/dist",
            .entry = "index.html",
        });
    }

    fn bridge(self: *@This()) native_sdk.BridgeDispatcher {
        self.bridge_handlers = .{
            .{ .name = "app.registerFileAssociations", .context = self, .invoke_fn = registerFileAssociations },
            .{ .name = "app.openDefaultApps", .context = self, .invoke_fn = openDefaultApps },
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
};

pub fn main(init: std.process.Init) !void {
    var app = ViewerApp{
        .env_map = init.environ_map,
        .allocator = init.gpa,
        .io = init.io,
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
