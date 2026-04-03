//go:build windows

package telemetry

import (
	"path/filepath"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	user32                       = windows.NewLazySystemDLL("user32.dll")
	kernel32                     = windows.NewLazySystemDLL("kernel32.dll")
	procGetForegroundWindow      = user32.NewProc("GetForegroundWindow")
	procGetWindowTextW           = user32.NewProc("GetWindowTextW")
	procGetWindowThreadProcessID = user32.NewProc("GetWindowThreadProcessId")
	procGetLastInputInfo         = user32.NewProc("GetLastInputInfo")
)

type lastInputInfo struct {
	cbSize uint32
	dwTime uint32
}

// GetSystemTelemetry returns the active application, window title, and idle time on Windows
func GetSystemTelemetry() (string, string, int) {
	hwnd, _, _ := procGetForegroundWindow.Call()
	if hwnd == 0 {
		return "Unknown", "", 0
	}

	// 1. Get Window Title
	titleBuf := make([]uint16, 512)
	procGetWindowTextW.Call(hwnd, uintptr(unsafe.Pointer(&titleBuf[0])), uintptr(len(titleBuf)))
	winTitle := windows.UTF16ToString(titleBuf)

	// 2. Get Process Name
	var pid uint32
	procGetWindowThreadProcessID.Call(hwnd, uintptr(unsafe.Pointer(&pid)))

	appName := "Unknown"
	const processQueryLimitedInformation = 0x1000
	hProcess, err := windows.OpenProcess(processQueryLimitedInformation, false, pid)
	if err == nil {
		defer windows.CloseHandle(hProcess)
		exePathBuf := make([]uint16, windows.MAX_PATH)
		size := uint32(len(exePathBuf))
		err = windows.QueryFullProcessImageName(hProcess, 0, &exePathBuf[0], &size)
		if err == nil {
			fullPath := windows.UTF16ToString(exePathBuf[:size])
			appName = filepath.Base(fullPath)
		}
	}

	// 3. Get Idle Time
	var lii lastInputInfo
	lii.cbSize = uint32(unsafe.Sizeof(lii))
	procGetLastInputInfo.Call(uintptr(unsafe.Pointer(&lii)))

	// GetTickCount returns time since boot in ms
	tickCount, _, _ := kernel32.NewProc("GetTickCount").Call()
	idleMs := uint32(tickCount) - lii.dwTime
	idleSec := int(idleMs / 1000)

	return appName, winTitle, idleSec
}
