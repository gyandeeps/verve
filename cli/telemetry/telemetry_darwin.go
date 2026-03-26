//go:build darwin

package telemetry

/*
#cgo LDFLAGS: -framework Foundation -framework AppKit -framework CoreGraphics -framework ApplicationServices
#include "c/telemetry_darwin.h"
#include <stdlib.h>
*/
import "C"

import "unsafe"

// GetSystemTelemetry returns the active application, window title, and idle time
func GetSystemTelemetry() (string, string, int) {
	cAppName := C.GetActiveApp()
	appName := C.GoString(cAppName)
	C.free(unsafe.Pointer(cAppName))

	cWinTitle := C.GetActiveWindowTitle()
	winTitle := C.GoString(cWinTitle)
	C.free(unsafe.Pointer(cWinTitle))

	idleTime := int(C.GetIdleTime())

	return appName, winTitle, idleTime
}
