const runtimeStatus = document.getElementById('runtime-status');
const platformLabel = document.getElementById('platform-label');
const profileLabel = document.getElementById('profile-label');
const launchPath = document.getElementById('launch-path');
const nextStep = document.getElementById('next-step');

if (!runtimeStatus || !platformLabel || !profileLabel || !launchPath || !nextStep) {
    // Shell DOM incomplete — bail silently
} else {
    const capacitor = window.Capacitor;
    const isNative = Boolean(capacitor?.isNativePlatform?.());
    const platform = capacitor?.getPlatform?.() ?? 'web';
    const storedSession = (() => {
        try {
            const raw =
                window.localStorage.getItem('lole_device_session_v2') ??
                window.localStorage.getItem('gebata_device_session_v2');
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    })();

    platformLabel.textContent = isNative ? `${platform} native shell` : 'Web fallback';
    runtimeStatus.textContent = isNative
        ? 'Native runtime detected. Device plugins are available to the shell.'
        : 'Running in fallback mode. Capacitor will load this bundle until a native target is attached.';

    if (isNative && capacitor.getServerUrl) {
        const serverUrl = capacitor.getServerUrl?.();
        if (serverUrl) {
            runtimeStatus.innerHTML = `Connected to <code>${serverUrl}</code>. Loading remote app...`;
        }
    }

    if (storedSession) {
        profileLabel.textContent =
            storedSession.device_profile ?? storedSession.device_type ?? 'paired';
        launchPath.textContent = storedSession.boot_path ?? '/device';
        nextStep.textContent = storedSession.boot_path
            ? 'Shared device state is cached locally. Point CAPACITOR_SERVER_URL at the routed /device experience to continue.'
            : 'Pairing is stored locally. The shared device shell can now take over at /device.';
    }
}
