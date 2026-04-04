class VerveCli < Formula
  desc "Shadow CLI for Verve — workstation telemetry agent for cognitive load analysis"
  homepage "https://github.com/gyandeeps/verve-releases"
  version "0.0.0"
  license "MIT"

  if OS.mac? && Hardware::CPU.arm?
    url "https://github.com/gyandeeps/verve-releases/releases/download/v0.0.0/verve-cli-darwin-arm64.tar.gz"
    sha256 "PLACEHOLDER_ARM64" # arm64
  elsif OS.mac? && Hardware::CPU.intel?
    url "https://github.com/gyandeeps/verve-releases/releases/download/v0.0.0/verve-cli-darwin-amd64.tar.gz"
    sha256 "PLACEHOLDER_AMD64" # amd64
  end

  def install
    bin.install "verve-cli"
  end

  test do
    assert_match "verve-cli", shell_output("#{bin}/verve-cli --version 2>&1", 0)
  end

  service do
    run [opt_bin/"verve-cli"]
    keep_alive true
    log_path var/"log/verve-cli.log"
    error_log_path var/"log/verve-cli-error.log"
  end
end
