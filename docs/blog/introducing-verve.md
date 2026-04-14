# Introducing Verve: Quantifying the Physiological Cost of Focus

In the world of professional software engineering, we track everything: CPU cycles, memory leaks, sprint velocity, and build times. But we almost never track the most critical infrastructure in the entire stack: **the developer's nervous system.**

We’ve all had those days—8 hours at the workstation, high "output" on paper, but a feeling of profound cognitive exhaustion by 5 PM. Until now, that exhaustion has been a ghost in the machine—invisible, unquantified, and impossible to optimize.

## What is Verve?

Verve is a high-fidelity, local-first telemetry bridge designed to correlate your workstation activity with your real-time physiological stress signals.

It consists of two primary components:

1. **The Shadow CLI:** A lightweight Go background process that monitors your active windows and idle time with surgical precision (<1% CPU overhead).
2. **The Mobile Hub:** A React Native command center that aggregates your physiological data (Heart Rate/BPM) via Apple HealthKit or Google Health Connect and marries it to your workstation telemetry.

The result is a unified view of your **Cognitive Load**.

## Who is it for?

Verve is built for the **Sovereign Developer**.

It’s for the engineer who:

- Values **Data Sovereignty:** Verve is 100% cloud-free. Your biometrics and application usage stay on your local network.
- Prioritizes **Deep Work:** You want to know which tools facilitate flow and which ones induce "micro-stress" (looking at you, Jira and Slack).
- Demands **Clinical Precision:** No rounded "consumer-soft" aesthetics. Verve uses a "Clinical Console" design system meant for high-density data analysis.

## What You Gain

By closing the gap between your monitor and your heartbeat, Verve surfaces nuanced behavioral profiles:

- **The Context-Switching Penalty:** Quantify the exact physiological cost of "mental churn."
- **Recovery Efficiency (RES):** Measure how quickly your nervous system returns to baseline during breaks.
- **Cognitive Divergence (CD):** Identify "Thinking Stress"—periods of high internal arousal while the workstation is idle, a hallmark of complex problem-solving.
- **The Focus Friction Index:** Identify "Expensive Apps" that leave you in a state of high arousal long after you've closed them.

## How to Use It

Setting up your private telemetry bridge takes less than two minutes:

### 1. Provision Your Workstation

Install the **Shadow CLI** using your preferred package manager:

**macOS (Homebrew):**

```bash
brew tap gyandeeps/homebrew-tap
brew install verve-cli
```

**Windows (Scoop):**

```bash
scoop bucket add verve https://github.com/gyandeeps/scoop-verve
scoop install verve-cli
```

### 2. Launch the Mobile Hub

Install the Mobile Hub (**iOS and Android ready for use**) and authorize Health data access via Apple HealthKit or Google Health Connect. You can find the latest Android release [here](https://expo.dev/accounts/gyandeeps/projects/verve/builds/cbd52d9b-6a9b-441f-8baa-df52a78d5c60).

### 3. Secure Handshake

The CLI will generate a 6-digit PIN. Enter it on your phone to establish a cryptographically secure, local-only link. Once paired, your data syncs automatically whenever you're on the same network.

## What’s Next?

We are just getting started. Here is what is on the immediate horizon for Verve:

- **Full Open Source Release:** We believe in absolute transparency for tools that handle biometric data. The full source code for both the Shadow CLI and the Mobile Hub will be open-sourced in the near future.
- **Advanced Biometric Correlation:** Integration of HRV (Heart Rate Variability) and Respiratory Rate to provide deeper "Physical Recovery" metrics.
- **Custom Edge Models:** The ability to swap local LLM models to suit your specific hardware constraints.

## The Verve Philosophy: Clinical & Private

Verve isn't another productivity tracker. It’s an **HCI (Human-Computer Interaction) Instrument**.

We believe that state-of-the-art behavioral analysis shouldn't require surrendering your privacy to a cloud provider. That’s why Verve runs **LLM-based behavioral synthesis (Phi-4-mini)** directly on your device. Your data never touches a public server.
