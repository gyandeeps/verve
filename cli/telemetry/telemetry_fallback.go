//go:build !darwin && !windows

package telemetry

// GetSystemTelemetry is the fallback for non-macOS systems since CGO CoreGraphics bindings are darwin only
func GetSystemTelemetry() (string, string, int) {
	return "DummyApp (Not Darwin)", "DummyTitle", 0
}
